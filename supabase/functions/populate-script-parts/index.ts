// Supabase Edge Function — Заполнение video_embeddings ТЕЛОМ и КОНЦОВКОЙ вирусных видео.
// Аналог populate-video-hooks, но извлекает body + cta как отдельные фрагменты текста и embeds их.
// В отличие от video_skeletons (структурная сигнатура — архитектура), здесь сохраняются конкретные
// удачные ФОРМУЛИРОВКИ — Sonnet использует их при генерации как fewer-shot examples в нише.
//
// Поддерживает пагинацию: ?offset=0&limit=20
//
// Для каждого видео:
// 1. Берём translation_text (если есть) или transcript_text
// 2. Gemini Flash: разбивает транскрипцию на hook | body | cta + определяет нишу
//    (hook не сохраняем — он уже обрабатывается populate-video-hooks)
// 3. Jina API: embed body и cta отдельно → vector(1024)
// 4. Insert 2 строки в video_embeddings (part_type='body' и 'cta')

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY')!;
const JINA_API_KEY = Deno.env.get('JINA_API_KEY')!;

const GEMINI_MODEL = 'google/gemini-2.5-flash';
const JINA_MODEL = 'jina-embeddings-v3';

const NICHES = [
  'fitness', 'nutrition', 'business', 'motivation', 'education',
  'entertainment', 'lifestyle', 'beauty', 'travel', 'tech',
  'finance', 'relationships', 'parenting', 'cooking', 'sport', 'other',
] as const;
type Niche = typeof NICHES[number];

function getTier(viewCount: number): string {
  if (viewCount >= 1_000_000) return '1m+';
  if (viewCount >= 500_000) return '500k+';
  if (viewCount >= 100_000) return '100k+';
  return '50k+';
}

function getScriptLength(text: string): 'short' | 'medium' | 'long' {
  const words = text.trim().split(/\s+/).length;
  if (words < 80) return 'short';
  if (words < 200) return 'medium';
  return 'long';
}

// Gemini: разбить транскрипцию на hook + body + cta + niche.
async function parseScriptParts(transcript: string): Promise<{
  body: string;
  cta: string;
  niche: Niche;
} | null> {
  const prompt = `Ты анализируешь транскрипцию короткого видео (Reel / Short).

ТРАНСКРИПЦИЯ:
"""
${transcript.slice(0, 4000)}
"""

Задача — разбить её на 3 части по смыслу:
1. HOOK — первые 1-3 предложения, цепляют внимание (~3 секунды)
2. BODY — основное содержание видео (середина)
3. CTA — концовка / призыв к действию / закрывающий поинт (последние 1-3 предложения)

Также определи НИШУ — одну из: ${NICHES.join(', ')}.

Если в видео нет явного CTA — верни последнее предложение как cta.
Если транскрипция очень короткая (одно-два предложения) — верни hook=весь текст, body="", cta="".

Ответ СТРОГО в JSON, без markdown:
{"hook": "...", "body": "...", "cta": "...", "niche": "одно_слово_из_списка"}`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim() ?? '';

  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);
    const niche = (NICHES as readonly string[]).includes(parsed.niche) ? parsed.niche as Niche : 'other';
    const body = typeof parsed.body === 'string' ? parsed.body.trim() : '';
    const cta = typeof parsed.cta === 'string' ? parsed.cta.trim() : '';
    if (!body && !cta) return null;
    return { body, cta, niche };
  } catch {
    return null;
  }
}

// Jina: embed текст → vector(1024).
async function embedText(text: string): Promise<number[] | null> {
  const res = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${JINA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: JINA_MODEL,
      input: [text],
      task: 'retrieval.passage',
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data?.data?.[0]?.embedding ?? null;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50);
  const minViews = parseInt(url.searchParams.get('min_views') ?? '50000', 10);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, url, owner_username, view_count, transcript_text, translation_text')
    .gte('view_count', minViews)
    .not('transcript_text', 'is', null)
    .neq('transcript_text', '')
    .order('view_count', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (!videos || videos.length === 0) {
    return new Response(JSON.stringify({ processed: 0, message: 'No more videos' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Пропускаем видео где УЖЕ есть и body, и cta
  const videoIds = videos.map((v) => v.id);
  const { data: existing } = await supabase
    .from('video_embeddings')
    .select('video_id, part_type')
    .in('video_id', videoIds)
    .in('part_type', ['body', 'cta']);

  const existingSet = new Set((existing ?? []).map((e) => `${e.video_id}:${e.part_type}`));

  const results = {
    processed_bodies: 0,
    processed_ctas: 0,
    skipped: 0,
    errors: 0,
    total: videos.length,
  };

  for (const video of videos) {
    try {
      const hasBody = existingSet.has(`${video.id}:body`);
      const hasCta = existingSet.has(`${video.id}:cta`);
      if (hasBody && hasCta) {
        results.skipped++;
        continue;
      }

      const transcript = (video.translation_text?.trim() || video.transcript_text?.trim()) ?? '';
      if (!transcript || transcript.length < 30) {
        results.errors++;
        continue;
      }

      const parsed = await parseScriptParts(transcript);
      if (!parsed) {
        results.errors++;
        await sleep(200);
        continue;
      }

      const tier = getTier(video.view_count ?? 0);
      const scriptLength = getScriptLength(transcript);
      const baseRow = {
        video_id: video.id,
        content_lang: 'ru',
        niche: parsed.niche,
        script_length: scriptLength,
        view_count: video.view_count ?? 0,
        tier,
        url: video.url,
        owner_username: video.owner_username,
      };

      // BODY
      if (!hasBody && parsed.body && parsed.body.length >= 20) {
        const bodyEmb = await embedText(parsed.body);
        if (bodyEmb) {
          const { error: bodyErr } = await supabase
            .from('video_embeddings')
            .insert({
              ...baseRow,
              part_type: 'body',
              content: parsed.body,
              embedding: JSON.stringify(bodyEmb),
            });
          if (!bodyErr) results.processed_bodies++;
          else results.errors++;
        } else {
          results.errors++;
        }
        await sleep(200);
      }

      // CTA
      if (!hasCta && parsed.cta && parsed.cta.length >= 5) {
        const ctaEmb = await embedText(parsed.cta);
        if (ctaEmb) {
          const { error: ctaErr } = await supabase
            .from('video_embeddings')
            .insert({
              ...baseRow,
              part_type: 'cta',
              content: parsed.cta,
              embedding: JSON.stringify(ctaEmb),
            });
          if (!ctaErr) results.processed_ctas++;
          else results.errors++;
        } else {
          results.errors++;
        }
        await sleep(200);
      }

      await sleep(100);
    } catch {
      results.errors++;
      await sleep(300);
    }
  }

  return new Response(JSON.stringify({
    ...results,
    next_offset: offset + limit,
    message: `Тел: ${results.processed_bodies}, концовок: ${results.processed_ctas}, пропущено ${results.skipped}, ошибок ${results.errors}`,
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
