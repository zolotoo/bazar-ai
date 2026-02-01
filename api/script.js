// Vercel Serverless — стиль сценария: анализ примеров ИЛИ генерация по промту (Gemini). Один файл = одна функция (лимит Hobby 12).
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const hasExamples = Array.isArray(body.examples) && body.examples.length > 0;
  const hasGenerate = body.prompt && typeof body.transcript_text === 'string' && !body.feedback;
  const hasRefine = body.feedback && typeof body.prompt === 'string' && typeof body.transcript_text === 'string' && typeof body.script_text === 'string';
  const hasRefineByDiff = body.script_ai != null && body.script_human != null && typeof body.prompt === 'string' && typeof body.transcript_text === 'string';
  const hasChat = body.action === 'chat' && Array.isArray(body.messages) && body.messages.length > 0 && typeof body.prompt === 'string';

  if (hasExamples) return handleAnalyze(req, res);
  if (hasRefineByDiff) return handleRefineByDiff(req, res);
  if (hasRefine) return handleRefine(req, res);
  if (hasGenerate) return handleGenerate(req, res);
  if (hasChat) return handleChat(req, res);
  return res.status(400).json({
    error: 'Use examples[] (analyze), prompt+transcript_text (generate), feedback+script_text (refine), script_ai+script_human (refine by diff), or action:chat+messages[] (chat)',
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

async function handleRefine(req, res) {
  const { prompt, transcript_text, translation_text, script_text, feedback } = req.body;
  if (!feedback || typeof feedback !== 'string' || !feedback.trim()) {
    return res.status(400).json({ error: 'feedback is required' });
  }
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const userText = `Текущий промт для генерации сценария:
---
${prompt.trim()}
---

По этому промту был сгенерирован сценарий.

Исходный сценарий (оригинал):
${transcript_text.trim()}
${translation_text && translation_text.trim() ? '\nПеревод на русский:\n' + translation_text.trim() : ''}

Сгенерированный сценарий:
${script_text.trim()}

Обратная связь пользователя:
${feedback.trim()}

Задача: обнови промт так, чтобы в следующий раз нейросеть избегала того, что не так, и сохраняла то, что хорошо. Верни только один валидный JSON без лишнего текста и без запятой перед }. Переносы в строках — только \\n.
{
  "prompt": "обновлённый полный текст промта (на русском)",
  "meta": {
    "rules": ["правило 1", ...],
    "doNot": ["чего избегать", ...],
    "summary": "краткое описание стиля в 1–2 предложения"
  },
  "clarifying_questions": ["один короткий уточняющий вопрос, если нужен", "второй вопрос или не включай"]
}
Если уточнения не нужны — clarifying_questions не включай или пустой массив.`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userText }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
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
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
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
    const newPrompt = typeof parsed.prompt === 'string' ? parsed.prompt : '';
    const meta = parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {};
    const clarifying_questions = Array.isArray(parsed.clarifying_questions) ? parsed.clarifying_questions.filter((q) => typeof q === 'string' && q.trim()) : [];
    if (!newPrompt) return res.status(502).json({ error: 'Gemini did not return a valid prompt' });
    return res.status(200).json({
      success: true,
      prompt: newPrompt,
      meta: {
        rules: Array.isArray(meta.rules) ? meta.rules : [],
        doNot: Array.isArray(meta.doNot) ? meta.doNot : [],
        summary: typeof meta.summary === 'string' ? meta.summary : '',
      },
      clarifying_questions: clarifying_questions.slice(0, 3),
    });
  } catch (err) {
    console.error('script refine error:', err);
    return res.status(500).json({ error: 'Failed to refine prompt', details: err.message });
  }
}

async function handleRefineByDiff(req, res) {
  const { prompt, transcript_text, translation_text, script_ai, script_human } = req.body;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const userText = `Текущий промт для генерации сценария:
---
${prompt.trim()}
---

По этому промту нейросеть сгенерировала сценарий. Пользователь вручную отредактировал его до своего идеального варианта.

Исходный сценарий (оригинал):
${transcript_text.trim()}
${translation_text && String(translation_text).trim() ? '\nПеревод на русский:\n' + String(translation_text).trim() : ''}

Сценарий, который сгенерировала нейросеть:
---
${String(script_ai).trim()}
---

Идеальный сценарий после правок пользователя:
---
${String(script_human).trim()}
---

Задача: пойми, что пользователь изменил и почему это важно (структура, тон, добавления, удаления). Обнови промт так, чтобы в следующий раз нейросеть сразу выдавала сценарий ближе к идеалу пользователя. Верни только один валидный JSON без лишнего текста и без запятой перед }. Переносы в строках — только \\n.
{
  "prompt": "обновлённый полный текст промта (на русском)",
  "meta": {
    "rules": ["правило 1", ...],
    "doNot": ["чего избегать", ...],
    "summary": "краткое описание стиля в 1–2 предложения"
  },
  "clarifying_questions": ["один короткий вопрос: почему изменил вот это?", "второй или не включай"]
}
Если нужны 1–2 уточняющих вопроса (почему изменил X, зачем добавил Y) — верни в clarifying_questions. Иначе не включай или пустой массив.`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userText }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
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
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
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
    const newPrompt = typeof parsed.prompt === 'string' ? parsed.prompt : '';
    const meta = parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {};
    const clarifying_questions = Array.isArray(parsed.clarifying_questions) ? parsed.clarifying_questions.filter((q) => typeof q === 'string' && q.trim()) : [];
    if (!newPrompt) return res.status(502).json({ error: 'Gemini did not return a valid prompt' });
    return res.status(200).json({
      success: true,
      prompt: newPrompt,
      meta: {
        rules: Array.isArray(meta.rules) ? meta.rules : [],
        doNot: Array.isArray(meta.doNot) ? meta.doNot : [],
        summary: typeof meta.summary === 'string' ? meta.summary : '',
      },
      clarifying_questions: clarifying_questions.slice(0, 3),
    });
  } catch (err) {
    console.error('script refineByDiff error:', err);
    return res.status(500).json({ error: 'Failed to refine prompt', details: err.message });
  }
}

/** Чат с нейронкой для доработки промта: многораундовый диалог */
async function handleChat(req, res) {
  const { messages, prompt, transcript_text, translation_text, script_text } = req.body;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const systemParts = [
    'Ты помощник по доработке промта для генерации сценариев видео. Пользователь хочет улучшить промт, чтобы нейросеть генерировала сценарии в нужном стиле.',
    '',
    'Текущий промт:',
    '---',
    prompt.trim(),
    '---',
    '',
  ];
  if (transcript_text && transcript_text.trim()) {
    systemParts.push('Контекст — исходник видео (оригинал):');
    systemParts.push(transcript_text.trim().slice(0, 1500) + (transcript_text.length > 1500 ? '...' : ''));
    systemParts.push('');
  }
  if (translation_text && translation_text.trim()) {
    systemParts.push('Перевод на русский (фрагмент):');
    systemParts.push(translation_text.trim().slice(0, 800) + (translation_text.length > 800 ? '...' : ''));
    systemParts.push('');
  }
  if (script_text && script_text.trim()) {
    systemParts.push('Текущий сценарий (сгенерированный или редактируемый):');
    systemParts.push(script_text.trim().slice(0, 1000) + (script_text.length > 1000 ? '...' : ''));
    systemParts.push('');
  }
  systemParts.push('Отвечай на русском. Можешь предлагать конкретные правки промта — тогда в конце ответа добавь блок в формате:');
  systemParts.push('___ОБНОВЛЁННЫЙ_ПРОМТ___');
  systemParts.push('(полный текст нового промта)');
  systemParts.push('___КОНЕЦ_ПРОМТ___');
  systemParts.push('Если правки не нужны — не добавляй этот блок.');

  const contents = [
    { role: 'user', parts: [{ text: systemParts.join('\n') }] },
    { role: 'model', parts: [{ text: 'Понял. Жду твои пожелания по промту — что изменить, добавить, убрать. Отвечу и при необходимости предложу обновлённый вариант.' }] },
  ];

  for (const m of messages) {
    if (m.role === 'user' && m.content?.trim()) {
      contents.push({ role: 'user', parts: [{ text: String(m.content).trim() }] });
    } else if (m.role === 'assistant' && m.content?.trim()) {
      contents.push({ role: 'model', parts: [{ text: String(m.content).trim() }] });
    }
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.5 },
        }),
      }
    );
    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errBody);
      return res.status(502).json({ error: 'Gemini API error', details: errBody });
    }
    const data = await geminiRes.json();
    let reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!reply) return res.status(502).json({ error: 'Gemini returned empty response' });

    let suggestedPrompt = null;
    const match = reply.match(/___ОБНОВЛЁННЫЙ_ПРОМТ___\s*([\s\S]*?)\s*___КОНЕЦ_ПРОМТ___/);
    if (match) {
      suggestedPrompt = match[1].trim();
      reply = reply.replace(/___ОБНОВЛЁННЫЙ_ПРОМТ___\s*[\s\S]*?\s*___КОНЕЦ_ПРОМТ___/g, '').trim();
    }

    return res.status(200).json({
      success: true,
      reply,
      suggested_prompt: suggestedPrompt || undefined,
    });
  } catch (err) {
    console.error('script chat error:', err);
    return res.status(500).json({ error: 'Failed to chat', details: err.message });
  }
}
