-- View для сортировки saved_videos по виральности в БД (views / (days * 1000))
-- taken_at — unix timestamp в секундах; виральность = view_count / (дней с публикации * 1000)
CREATE OR REPLACE VIEW saved_videos_with_viral AS
SELECT *,
  CASE
    WHEN view_count IS NOT NULL AND view_count > 0 AND taken_at IS NOT NULL AND taken_at > 0
    THEN (
      view_count::float
      / GREATEST(1, (EXTRACT(EPOCH FROM NOW()) - (CASE WHEN taken_at > 1e12 THEN taken_at / 1000.0 ELSE taken_at::float END)) / 86400)
      / 1000
    )
    ELSE 0
  END AS viral_coef
FROM saved_videos;

COMMENT ON VIEW saved_videos_with_viral IS 'saved_videos + viral_coef для ORDER BY виральности на стороне БД';
