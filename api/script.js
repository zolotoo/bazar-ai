// Vercel Serverless — стиль сценария: анализ примеров ИЛИ генерация по промту (OpenRouter/Gemini).

import { callOpenRouter, MODELS, MODELS_FALLBACK } from '../lib/openRouter.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

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

  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });

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
    const { text: rawText } = await callOpenRouter({
      apiKey: OPENROUTER_API_KEY,
      model: MODELS.FLASH,
      messages: [{ role: 'user', content: parts.join('') }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });
    if (!rawText) return res.status(502).json({ error: 'OpenRouter returned empty response' });

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
    const promptText = typeof parsed.prompt === 'string' ? parsed.prompt : '';
    const meta = parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {};
    if (!promptText) return res.status(502).json({ error: 'Invalid JSON structure' });
    return res.status(200).json({
      success: true,
      prompt: promptText,
      meta: {
        rules: Array.isArray(meta.rules) ? meta.rules : [],
        doNot: Array.isArray(meta.doNot) ? meta.doNot : [],
        summary: typeof meta.summary === 'string' ? meta.summary : '',
      },
    });
  } catch (err) {
    console.error('script analyze error:', err);
    return res.status(502).json({ error: 'OpenRouter API error', details: err.message });
  }
}

async function handleGenerate(req, res) {
  const { prompt, transcript_text, translation_text } = req.body;
  if (!prompt.trim()) return res.status(400).json({ error: 'prompt is required' });
  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });

  const userParts = [];
  userParts.push('Исходный сценарий (оригинал):\n' + transcript_text.trim());
  if (translation_text && typeof translation_text === 'string' && translation_text.trim()) {
    userParts.push('\nПеревод на русский:\n' + translation_text.trim());
  }
  userParts.push('\n\nСгенерируй мой сценарий (адаптацию) по этим данным. Выводи только текст сценария, без пояснений.');
  let userText = userParts.join('');
  const MAX_CHARS = 100000;
  if (userText.length > MAX_CHARS) {
    userText = userText.slice(0, MAX_CHARS) + '\n\n[... текст обрезан из-за длины ...]';
  }

  const messages = [
    { role: 'system', content: prompt.trim() },
    { role: 'user', content: userText },
  ];

  let lastErr = null;
  for (const model of MODELS_FALLBACK) {
    try {
      const { text: script } = await callOpenRouter({
        apiKey: OPENROUTER_API_KEY,
        model,
        messages,
        temperature: 0.4,
      });
      if (script && script.trim()) return res.status(200).json({ success: true, script: script.trim() });
    } catch (err) {
      lastErr = err.message;
      if (err.message?.includes('429')) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }
  const errMsg =
    lastErr?.includes('429')
      ? 'Лимит OpenRouter API исчерпан. Попробуйте позже.'
      : 'OpenRouter returned empty script. Try again or shorten the transcript.';
  return res.status(502).json({ error: errMsg });
}

async function handleRefine(req, res) {
  const { prompt, transcript_text, translation_text, script_text, feedback } = req.body;
  if (!feedback || typeof feedback !== 'string' || !feedback.trim()) {
    return res.status(400).json({ error: 'feedback is required' });
  }
  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });

  const userText = `Ты дообучаешь промт для генерации сценариев. Пользователь дал обратную связь — нужно КОНКРЕТНО учесть её в промте.

ТЕКУЩИЙ ПРОМТ (его нужно обновить, сохранив всё важное):
---
${prompt.trim()}
---

КОНТЕКСТ:
Исходный сценарий (оригинал):
${transcript_text.trim()}
${translation_text && translation_text.trim() ? '\nПеревод на русский:\n' + translation_text.trim() : ''}

Сгенерированный сценарий (то, что не устроило пользователя):
${script_text.trim()}

ОБРАТНАЯ СВЯЗЬ ПОЛЬЗОВАТЕЛЯ:
«${feedback.trim()}»

ИНСТРУКЦИИ:
1. Разбери обратную связь: что именно не так? что пользователь хочет изменить/добавить/убрать?
2. Обнови промт так, чтобы учесть обратную связь. Можешь менять, добавлять, убирать правила — промт должен быть гибким и отражать актуальные пожелания пользователя.
3. Если старые правила противоречат обратной связи — измени или убери их. Если нужно — добавь новые.

Верни только валидный JSON. Переносы в строках — только \\n.
{
  "prompt": "полный обновлённый промт (учти обратную связь, при необходимости замени противоречащие правила)",
  "meta": {
    "rules": ["правило 1", "правило 2", ...],
    "doNot": ["чего избегать", ...],
    "summary": "краткое описание стиля"
  },
  "clarifying_questions": []
}
Если нужны уточняющие вопросы — добавь в clarifying_questions. Иначе пустой массив.`;

  const refineModels = [MODELS.PRO_3, MODELS.FLASH];
  let rawText = null;
  for (const model of refineModels) {
    try {
      const result = await callOpenRouter({
        apiKey: OPENROUTER_API_KEY,
        model,
        messages: [{ role: 'user', content: userText }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });
      rawText = result.text;
      if (rawText) break;
    } catch (err) {
      if (err.message?.includes('429')) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  try {
    if (!rawText) return res.status(502).json({ error: 'OpenRouter returned empty response' });

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
    const clarifying_questions = Array.isArray(parsed.clarifying_questions)
      ? parsed.clarifying_questions.filter((q) => typeof q === 'string' && q.trim())
      : [];
    if (!newPrompt) return res.status(502).json({ error: 'Invalid JSON structure' });
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
    return res.status(502).json({ error: 'OpenRouter API error', details: err.message });
  }
}

/** Простой diff: что добавлено/убрано между двумя текстами */
function computeSimpleDiff(before, after) {
  const a = String(before).trim().split(/\n/).filter(Boolean);
  const b = String(after).trim().split(/\n/).filter(Boolean);
  const setA = new Set(a);
  const setB = new Set(b);
  const added = b.filter((line) => !setA.has(line));
  const removed = a.filter((line) => !setB.has(line));
  return { added, removed };
}

async function handleRefineByDiff(req, res) {
  const { prompt, transcript_text, translation_text, script_ai, script_human, feedback } = req.body;
  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });

  const { added, removed } = computeSimpleDiff(script_ai, script_human);
  const diffHint =
    added.length > 0 || removed.length > 0
      ? `\n\nПОДСКАЗКА (строки, которые пользователь добавил/убрал):\nДобавлено: ${added.slice(0, 15).join(' | ') || '—'}\nУбрано: ${removed.slice(0, 15).join(' | ') || '—'}`
      : '';

  const userText = `Ты дообучаешь промт по правкам пользователя. Нейросеть сгенерировала сценарий, пользователь отредактировал его. Нужно понять КОНКРЕТНО что изменилось и добавить правила в промт.

ТЕКУЩИЙ ПРОМТ (сохрани все правила, добавь новые):
---
${prompt.trim()}
---

КОНТЕКСТ — исходник:
${transcript_text.trim()}
${translation_text && String(translation_text).trim() ? '\nПеревод:\n' + String(translation_text).trim() : ''}

СЦЕНАРИЙ НЕЙРОСЕТИ (до правок):
---
${String(script_ai).trim()}
---

ИДЕАЛЬНЫЙ СЦЕНАРИЙ ПОЛЬЗОВАТЕЛЯ (после правок):
---
${String(script_human).trim()}
---
${feedback && String(feedback).trim() ? `\nДОПОЛНИТЕЛЬНЫЙ КОММЕНТАРИЙ ПОЛЬЗОВАТЕЛЯ:\n«${String(feedback).trim()}»\n` : ''}
${diffHint}

ИНСТРУКЦИИ:
1. Сравни два сценария построчно. Выпиши: что пользователь ДОБАВИЛ, что УБРАЛ, что ИЗМЕНИЛ (структура, тон, формулировки).
2. Обнови промт так, чтобы в следующий раз нейросеть выдавала сценарий ближе к идеалу пользователя. Можешь менять, добавлять, убирать правила — промт должен быть гибким.
3. Если старые правила противоречат правкам пользователя — измени или убери их. Добавь новые правила на основе правок.

Верни только валидный JSON. Переносы в строках — только \\n.
{
  "changes_identified": ["что изменил пользователь 1", "что изменил 2", ...],
  "prompt": "полный обновлённый промт (учти правки, при необходимости замени противоречащие правила)",
  "meta": {
    "rules": ["правило 1", "правило 2", ...],
    "doNot": ["чего избегать", ...],
    "summary": "краткое описание стиля"
  },
  "clarifying_questions": []
}
changes_identified — список конкретных изменений. clarifying_questions — уточняющие вопросы, если нужны.`;

  const refineByDiffModels = [MODELS.PRO_3, MODELS.FLASH];
  let rawText = null;
  for (const model of refineByDiffModels) {
    try {
      const result = await callOpenRouter({
        apiKey: OPENROUTER_API_KEY,
        model,
        messages: [{ role: 'user', content: userText }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });
      rawText = result.text;
      if (rawText) break;
    } catch (err) {
      if (err.message?.includes('429')) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  try {
    if (!rawText) return res.status(502).json({ error: 'OpenRouter returned empty response' });

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
    const clarifying_questions = Array.isArray(parsed.clarifying_questions)
      ? parsed.clarifying_questions.filter((q) => typeof q === 'string' && q.trim())
      : [];
    if (!newPrompt) return res.status(502).json({ error: 'Invalid JSON structure' });
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
    return res.status(502).json({ error: 'OpenRouter API error', details: err.message });
  }
}

/** Чат с нейронкой для доработки промта: многораундовый диалог */
async function handleChat(req, res) {
  const { messages, prompt, transcript_text, translation_text, script_text } = req.body;
  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });

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

  const chatMessages = [
    { role: 'system', content: 'Ты помощник по доработке промта для генерации сценариев. Отвечай на русском. Можешь предлагать правки — добавляй блок ___ОБНОВЛЁННЫЙ_ПРОМТ___ (текст) ___КОНЕЦ_ПРОМТ___' },
    { role: 'user', content: systemParts.join('\n') },
    { role: 'assistant', content: 'Понял. Жду твои пожелания по промту — что изменить, добавить, убрать. Отвечу и при необходимости предложу обновлённый вариант.' },
  ];

  for (const m of messages) {
    if (m.role === 'user' && m.content?.trim()) {
      chatMessages.push({ role: 'user', content: String(m.content).trim() });
    } else if (m.role === 'assistant' && m.content?.trim()) {
      chatMessages.push({ role: 'assistant', content: String(m.content).trim() });
    }
  }

  try {
    const { text: reply } = await callOpenRouter({
      apiKey: OPENROUTER_API_KEY,
      model: MODELS.FLASH,
      messages: chatMessages,
      temperature: 0.5,
    });
    if (!reply) return res.status(502).json({ error: 'OpenRouter returned empty response' });

    let suggestedPrompt = null;
    const match = reply.match(/___ОБНОВЛЁННЫЙ_ПРОМТ___\s*([\s\S]*?)\s*___КОНЕЦ_ПРОМТ___/);
    if (match) {
      suggestedPrompt = match[1].trim();
      const cleanReply = reply.replace(/___ОБНОВЛЁННЫЙ_ПРОМТ___\s*[\s\S]*?\s*___КОНЕЦ_ПРОМТ___/g, '').trim();
      return res.status(200).json({
        success: true,
        reply: cleanReply,
        suggested_prompt: suggestedPrompt || undefined,
      });
    }

    return res.status(200).json({
      success: true,
      reply,
      suggested_prompt: suggestedPrompt || undefined,
    });
  } catch (err) {
    console.error('script chat error:', err);
    return res.status(502).json({ error: 'OpenRouter API error', details: err.message });
  }
}
