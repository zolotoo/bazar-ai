// Supabase Edge Function — Заполнение video_skeletons структурными скелетами вирусных видео.
// Аналог populate-video-hooks, но извлекает структурную сигнатуру (тип формата, секции,
// тип хука, тип CTA, темп) для RAG при генерации полного сценария.
//
// Поддерживает пагинацию: ?offset=0&limit=20
//
// Для каждого видео:
// 1. Берём translation_text (если есть) или transcript_text
// 2. Gemini Flash: извлекает скелет → JSON с структурным описанием
// 3. Jina API: embed сериализованный скелет → vector(1024)
// 4. Сохраняем в video_skeletons (UPSERT по video_id)

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

const FORMAT_TYPES = [
  'talking_head', 'tutorial', 'story', 'listicle',
  'skit', 'opinion', 'reaction', 'showcase',
] as const;
type FormatType = typeof FORMAT_TYPES[number];

const HOOK_TYPES = [
  'curiosity', 'shock', 'question', 'pattern_interrupt',
  'jenga', 'story_setup', 'none',
] as const;
type HookType = typeof HOOK_TYPES[number];

const CTA_TYPES = [
  'soft_loop', 'save_bait', 'comment_bait', 'profile_visit', 'none',
] as const;
type CtaType = typeof CTA_TYPES[number];

const PACING = ['fast', 'medium', 'slow'] as const;
type Pacing = typeof PACING[number];

interface Skeleton {
  niche: Niche;
  format_type: FormatType;
  structure_summary: string;
  sections: Array<{ start_sec: number; end_sec: number; type: string; purpose: string }>;
  hook_type: HookType;
  cta_type: CtaType;
  pacing: Pacing;
  key_transitions: string[];
  estimated_seconds: number;
}

function getTier(viewCount: number): string {
  if (viewCount >= 1_000_000) return '1m+';
  if (viewCount >= 500_000) return '500k+';
  if (viewCount >= 100_000) return '100k+';
  return '50k+';
}

// Оценка длительности из транскрипции (≈2.5 слова/сек разговорной речи).
function estimateSecondsFromText(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(5, Math.round(words / 2.5));
}

// Gemini: извлечь структурный скелет видео.
async function extractSkeleton(transcript: string, viewCount: number): Promise<Skeleton | null> {
  const estSeconds = estimateSecondsFromText(transcript);
  const prompt = `Ты анализируешь короткое видео (Instagram Reel / TikTok / YouTube Short) для извлечения структурного скелета.
Скелет — это "матрица" по которой можно создать новое видео в той же структуре, но на другую тему.

ТРАНСКРИПЦИЯ:
"""
${transcript.slice(0, 5000)}
"""

Оценочная длительность: ~${estSeconds} сек
Просмотры видео: ${viewCount}

Задача — извлечь структурную сигнатуру в виде JSON.

Поля:
1. niche — одна из: ${NICHES.join(', ')}
2. format_type — одна из: ${FORMAT_TYPES.join(', ')}
3. structure_summary — однострочное описание скелета на русском (например: "сетап → разворот → возврат к хуку")
4. sections — массив секций с тайм-кодами:
   [{"start_sec":0,"end_sec":3,"type":"hook","purpose":"коротко зачем секция"}, ...]
   Допустимые types: hook, context, development, climax, resolution, cta, transition
5. hook_type — одно из: ${HOOK_TYPES.join(', ')}
6. cta_type — одно из: ${CTA_TYPES.join(', ')}
7. pacing — одно из: ${PACING.join(', ')}
8. key_transitions — массив 1-3 строк на русском, описывающих ключевые переходы (например: "на 8 секунде смена кадра и тона", "разворот ожидания на 15-й")
9. estimated_seconds — твоя оценка длительности видео в секундах (целое число)

Если транскрипция очень короткая или пустая — верни структуру с минимальными значениями, но строго в формате JSON.

Ответ СТРОГО в JSON, без комментариев и markdown.`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim() ?? '';

  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);
    const niche = (NICHES as readonly string[]).includes(parsed.niche) ? parsed.niche as Niche : 'other';
    const format_type = (FORMAT_TYPES as readonly string[]).includes(parsed.format_type)
      ? parsed.format_type as FormatType : 'talking_head';
    const hook_type = (HOOK_TYPES as readonly string[]).includes(parsed.hook_type)
      ? parsed.hook_type as HookType : 'none';
    const cta_type = (CTA_TYPES as readonly string[]).includes(parsed.cta_type)
      ? parsed.cta_type as CtaType : 'none';
    const pacing = (PACING as readonly string[]).includes(parsed.pacing)
      ? parsed.pacing as Pacing : 'medium';

    return {
      niche,
      format_type,
      structure_summary: typeof parsed.structure_summary === 'string'
        ? parsed.structure_summary.slice(0, 300) : '',
      sections: Array.isArray(parsed.sections) ? parsed.sections.slice(0, 15) : [],
      hook_type,
      cta_type,
      pacing,
      key_transitions: Array.isArray(parsed.key_transitions)
        ? parsed.key_transitions.slice(0, 5).map((s: unknown) => String(s)) : [],
      estimated_seconds: Number.isFinite(parsed.estimated_seconds)
        ? Math.max(3, Math.min(300, Math.round(parsed.estimated_seconds)))
        : estSeconds,
    };
  } catch {
    return null;
  }
}

// Сериализация скелета в текст для embedding (не транскрипт, а сама структура).
function serializeSkeleton(s: Skeleton): string {
  const sections = s.sections
    .map((sec) => `${sec.type}(${sec.purpose ?? ''})`)
    .join(' → ');
  return [
    `Формат: ${s.format_type}`,
    `Структура: ${s.structure_summary}`,
    `Длина: ${s.estimated_seconds} сек`,
    `Секции: ${sections}`,
    `Хук: ${s.hook_type}`,
    `CTA: ${s.cta_type}`,
    `Темп: ${s.pacing}`,
    `Переходы: ${s.key_transitions.join('; ')}`,
  ].join('\n');
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
    .select('id, url, owner_username, view_count, like_count, comment_count, taken_at, transcript_text, translation_text')
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

  // Пропускаем уже обработанные
  const videoIds = videos.map((v) => v.id);
  const { data: existing } = await supabase
    .from('video_skeletons')
    .select('video_id')
    .in('video_id', videoIds);

  const existingIds = new Set((existing ?? []).map((e) => e.video_id));
  const toProcess = videos.filter((v) => !existingIds.has(v.id));

  const results = {
    processed: 0,
    skipped: existingIds.size,
    errors: 0,
    total: videos.length,
  };

  for (const video of toProcess) {
    try {
      const transcript = (video.translation_text?.trim() || video.transcript_text?.trim()) ?? '';
      if (!transcript || transcript.length < 20) {
        results.errors++;
        continue;
      }

      const skeleton = await extractSkeleton(transcript, video.view_count ?? 0);
      if (!skeleton) {
        results.errors++;
        await sleep(200);
        continue;
      }

      const serialized = serializeSkeleton(skeleton);
      const embedding = await embedText(serialized);
      if (!embedding) {
        results.errors++;
        await sleep(200);
        continue;
      }

      const tier = getTier(video.view_count ?? 0);

      const { error: insertError } = await supabase
        .from('video_skeletons')
        .upsert({
          video_id: video.id,
          total_seconds: skeleton.estimated_seconds,
          format_type: skeleton.format_type,
          structure_summary: skeleton.structure_summary,
          sections: skeleton.sections,
          hook_type: skeleton.hook_type,
          cta_type: skeleton.cta_type,
          pacing: skeleton.pacing,
          key_transitions: skeleton.key_transitions,
          niche: skeleton.niche,
          view_count: video.view_count ?? 0,
          like_count: video.like_count ?? null,
          comment_count: video.comment_count ?? null,
          tier,
          taken_at: video.taken_at ?? null,
          url: video.url,
          owner_username: video.owner_username,
          embedding: JSON.stringify(embedding),
          embedding_text: serialized,
        }, { onConflict: 'video_id' });

      if (insertError) {
        results.errors++;
      } else {
        results.processed++;
      }

      await sleep(300);
    } catch {
      results.errors++;
      await sleep(300);
    }
  }

  return new Response(JSON.stringify({
    ...results,
    next_offset: offset + limit,
    message: `Обработано ${results.processed} видео, пропущено ${results.skipped} (уже есть), ошибок ${results.errors}`,
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
