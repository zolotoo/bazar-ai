-- viral_multiplier: единая метрика "залётности" для рилсов и каруселей.
-- Для рилсов: view_count / instagram_profiles.avg_bottom3_views
-- Для каруселей: like_count / instagram_profiles.avg_bottom3_likes
-- Значение пишется при добавлении (если статистика профиля уже есть в БД)
-- и при нажатии кнопки "Полный расчёт виральности".
-- NULL = не рассчитано (профиль ещё не парсился).

ALTER TABLE saved_videos
  ADD COLUMN IF NOT EXISTS viral_multiplier FLOAT;

ALTER TABLE saved_carousels
  ADD COLUMN IF NOT EXISTS viral_multiplier FLOAT;

CREATE INDEX IF NOT EXISTS idx_saved_videos_viral_multiplier
  ON saved_videos (viral_multiplier DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_saved_carousels_viral_multiplier
  ON saved_carousels (viral_multiplier DESC NULLS LAST);

-- Обновляем view: теперь viral_coef = viral_multiplier (для обратной совместимости сортировки).
CREATE OR REPLACE VIEW saved_videos_with_viral AS
SELECT *, COALESCE(viral_multiplier, 0) AS viral_coef
FROM saved_videos;

COMMENT ON COLUMN saved_videos.viral_multiplier IS 'x-множитель: view_count / avg_bottom3_views автора. NULL = не рассчитано.';
COMMENT ON COLUMN saved_carousels.viral_multiplier IS 'x-множитель: like_count / avg_bottom3_likes автора. NULL = не рассчитано.';
