-- RPC для подсчёта видео по папкам без лимита PostgREST в 1000 строк.
-- Считает GROUP BY folder_id на стороне БД.
-- folder_id может быть NULL (видео без папки) — возвращаем как '__null__'.

CREATE OR REPLACE FUNCTION count_saved_videos_by_folder(
  p_project_id TEXT,
  p_user_ids TEXT[]
)
RETURNS TABLE (folder_key TEXT, cnt BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(folder_id, '__null__') AS folder_key,
    COUNT(*)::BIGINT AS cnt
  FROM saved_videos
  WHERE
    CASE
      WHEN p_project_id IS NULL THEN project_id IS NULL
      ELSE project_id = p_project_id
    END
    AND user_id = ANY(p_user_ids)
  GROUP BY folder_id;
$$;

COMMENT ON FUNCTION count_saved_videos_by_folder IS
  'Счётчики видео по папкам для сайдбара. Обходит лимит PostgREST в 1000 строк.';
