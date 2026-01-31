// Vercel Serverless — анализ примеров (оригинал + перевод + моя адаптация) → промт стиля через Gemini
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { examples } = req.body;
  if (!Array.isArray(examples) || examples.length === 0 || examples.length > 10) {
    return res.status(400).json({
      error: 'examples is required: array of 1–10 items with transcript_text, translation_text, script_text',
    });
  }

  for (const ex of examples) {
    if (!ex.transcript_text || !ex.script_text) {
      return res.status(400).json({
        error: 'Each example must have transcript_text and script_text. translation_text is optional.',
      });
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

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

Ответ пришли строго в формате JSON без markdown-блоков и без лишнего текста:
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

  const userText = parts.join('');

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userText }] }],
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
    const rawText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!rawText) {
      return res.status(502).json({ error: 'Gemini returned empty response' });
    }

    // Убираем возможные markdown-обёртки
    let jsonStr = rawText;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const parsed = JSON.parse(jsonStr);
    const prompt = typeof parsed.prompt === 'string' ? parsed.prompt : '';
    const meta = parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {};

    if (!prompt) {
      return res.status(502).json({ error: 'Gemini did not return a valid prompt' });
    }

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
    console.error('script-style-analyze error:', err);
    return res.status(500).json({
      error: 'Failed to analyze style',
      details: err.message,
    });
  }
}
