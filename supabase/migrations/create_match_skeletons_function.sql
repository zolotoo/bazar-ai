-- RPC-функция match_skeletons — поиск похожих структурных скелетов по cosine similarity.
-- Аналог match_viral_hooks, но возвращает структурное описание видео (sections, hook_type, cta_type),
-- по которому Sonnet/Gemini генерирует новый сценарий с тем же скелетом, но под тему и tone юзера.

CREATE OR REPLACE FUNCTION match_skeletons(
  query_embedding vector(1024),
  match_count int DEFAULT 5,
  filter_niche text DEFAULT NULL,
  min_view_count int DEFAULT 50000,
  min_total_seconds int DEFAULT NULL,
  max_total_seconds int DEFAULT NULL,
  filter_format_type text DEFAULT NULL,
  freshness_days int DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  video_id uuid,
  total_seconds integer,
  format_type text,
  structure_summary text,
  sections jsonb,
  hook_type text,
  cta_type text,
  pacing text,
  key_transitions jsonb,
  niche text,
  view_count integer,
  like_count integer,
  share_to_view_ratio numeric,
  tier text,
  taken_at bigint,
  url text,
  owner_username text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    s.id,
    s.video_id,
    s.total_seconds,
    s.format_type,
    s.structure_summary,
    s.sections,
    s.hook_type,
    s.cta_type,
    s.pacing,
    s.key_transitions,
    s.niche,
    s.view_count,
    s.like_count,
    s.share_to_view_ratio,
    s.tier,
    s.taken_at,
    s.url,
    s.owner_username,
    1 - (s.embedding <=> query_embedding) AS similarity
  FROM video_skeletons s
  WHERE s.embedding IS NOT NULL
    AND COALESCE(s.view_count, 0) >= COALESCE(min_view_count, 0)
    AND (filter_niche IS NULL OR s.niche = filter_niche)
    AND (min_total_seconds IS NULL OR s.total_seconds >= min_total_seconds)
    AND (max_total_seconds IS NULL OR s.total_seconds <= max_total_seconds)
    AND (filter_format_type IS NULL OR s.format_type = filter_format_type)
    AND (
      freshness_days IS NULL
      OR s.taken_at IS NULL
      OR s.taken_at >= (EXTRACT(EPOCH FROM NOW()) * 1000 - freshness_days::bigint * 86400000)
    )
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
$$;
