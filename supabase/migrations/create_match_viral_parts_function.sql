-- RPC match_viral_parts — обобщённый поиск похожих фрагментов сценария по part_type.
-- Аналог match_viral_hooks, но принимает part_type параметром: 'hook' | 'body' | 'cta'.
-- Используется для retrieval body/cta при генерации полного сценария
-- (Sonnet получает 3 слоя: 5 хуков + 5 тел + 5 концовок как fewer-shot examples).

CREATE OR REPLACE FUNCTION match_viral_parts(
  query_embedding vector(1024),
  filter_part_type text,
  match_count int DEFAULT 5,
  filter_niche text DEFAULT NULL,
  min_view_count int DEFAULT 50000
)
RETURNS TABLE (
  id uuid,
  video_id uuid,
  part_type text,
  content text,
  content_lang text,
  niche text,
  script_length text,
  view_count int,
  tier text,
  url text,
  owner_username text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ve.id,
    ve.video_id,
    ve.part_type,
    ve.content,
    ve.content_lang,
    ve.niche,
    ve.script_length,
    ve.view_count,
    ve.tier,
    ve.url,
    ve.owner_username,
    1 - (ve.embedding <=> query_embedding) AS similarity
  FROM video_embeddings ve
  WHERE ve.part_type = filter_part_type
    AND COALESCE(ve.view_count, 0) >= COALESCE(min_view_count, 0)
    AND (filter_niche IS NULL OR ve.niche = filter_niche)
  ORDER BY ve.embedding <=> query_embedding
  LIMIT match_count;
$$;
