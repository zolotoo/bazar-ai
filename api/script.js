// Vercel Serverless — стиль сценария: анализ примеров ИЛИ генерация по промту (Gemini). Один файл = одна функция (лимит Hobby 12).
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const hasExamples = Array.isArray(body.examples) && body.examples.length > 0;
  const hasGenerate = body.prompt && typeof body.transcript_text === 'string';

  if (hasExamples) return handleAnalyze(req, res);
  if (hasGenerate) return handleGenerate(req, res);
  return res.status(400).json({
    error: 'Either examples[] (analyze) or prompt+transcript_text (generate) required',
  });
}

async function handleAnalyze(req, res) {
  const { examples } = req.body;
  if (examples.length > 10) {
    return res.status(400).json({ error: 'examples: max 10 items' });
  }
  for (const ex of examples) {
    if (!ex.transcript_text || !ex.script_text) {
      return res.status(400).json({
        error: 'Each example must have transcript_text and script_text.',
      });
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const parts = [];
  parts.push(`Задача: по примерам адаптации сценариев выявить закономерности и сформулировать промт для нейросети.

У тебя есть примеры. В каждом примере:
1) Исходный сценарий (оригинал, транскрипт)
2) Перевод на русский (если есть)
3) Моя адаптация — как я переписал сценарий

Нужно:
— выявить закономерности моей адаптации;
— зафиксировать правила (логика, стиль, структура, типовые трансформации);
— сформулировать один рабочий промт, пригодный для повторного использования при генерации нового сценария по новому исходнику.

Ответ пришли строго в формате JSON без markdown-блоков и без лишнего текста. Один валидный JSON: без запятой перед закрывающей скобкой, переносы в строках только как \\n.
{
  "prompt": "полный текст промта для нейросети (на русском)",
  "meta": {
    "rules": ["правило 1", "правило 2", ...],
    "doNot": ["чего избегать", ...],
    "summary": "краткое описание стиля в 1–2 предложения"
  }
}
`);

  examples.forEach((ex, i) => {
    parts.push(`\n--- Пример ${i + 1} ---\n`);
    parts.push(`Исходный сценарий (оригинал):\n${ex.transcript_text}\n`);
    if (ex.translation_text && ex.translation_text.trim()) {
      parts.push(`Перевод на русский:\n${ex.translation_text}\n`);
    }
    parts.push(`Моя адаптация:\n${ex.script_text}\n`);
  });

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: parts.join('') }] }],
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
        }),
      }
    );
    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errBody);
      return res.status(502).json({ error: 'Gemini API error', details: errBody });
    }
    const data = await geminiRes.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!rawText) return res.status(502).json({ error: 'Gemini returned empty response' });
    let jsonStr = (rawText.match(/\{[\s\S]*\}/) || [null])[0] || rawText;
    // Убираем типичные ошибки Gemini: trailing comma
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      // Ещё попытка: обрезать до последнего полного объекта (часто модель дописывает текст после })
      const lastBrace = jsonStr.lastIndexOf('}');
      if (lastBrace > 0) {
        try {
          parsed = JSON.parse(jsonStr.slice(0, lastBrace + 1).replace(/,(\s*[}\]])/g, '$1'));
        } catch (_) {
          throw parseErr;
        }
      } else {
        throw parseErr;
      }
    }
    const prompt = typeof parsed.prompt === 'string' ? parsed.prompt : '';
    const meta = parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {};
    if (!prompt) return res.status(502).json({ error: 'Gemini did not return a valid prompt' });
    return res.status(200).json({
      success: true,
      prompt,
      meta: {
        rules: Array.isArray(meta.rules) ? meta.rules : [],
        doNot: Array.isArray(meta.doNot) ? meta.doNot : [],
        summary: typeof meta.summary === 'string' ? meta.summary : '',
      },
    });
  } catch (err) {
    console.error('script analyze error:', err);
    return res.status(500).json({ error: 'Failed to analyze style', details: err.message });
  }
}

async function handleGenerate(req, res) {
  const { prompt, transcript_text, translation_text } = req.body;
  if (!prompt.trim()) return res.status(400).json({ error: 'prompt is required' });
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const userParts = [];
  userParts.push('Исходный сценарий (оригинал):\n' + transcript_text.trim());
  if (translation_text && typeof translation_text === 'string' && translation_text.trim()) {
    userParts.push('\nПеревод на русский:\n' + translation_text.trim());
  }
  userParts.push('\n\nСгенерируй мой сценарий (адаптацию) по этим данным. Выводи только текст сценария, без пояснений.');
  const userText = userParts.join('');

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          systemInstruction: { parts: [{ text: prompt.trim() }] },
          generationConfig: { temperature: 0.4 },
        }),
      }
    );
    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errBody);
      return res.status(502).json({ error: 'Gemini API error', details: errBody });
    }
    const data = await geminiRes.json();
    const script = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!script) return res.status(502).json({ error: 'Gemini returned empty script' });
    return res.status(200).json({ success: true, script });
  } catch (err) {
    console.error('script generate error:', err);
    return res.status(500).json({ error: 'Failed to generate script', details: err.message });
  }
}
