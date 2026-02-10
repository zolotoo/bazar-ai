-- Среднее из 3 постов с наименьшими лайками (для расчёта «x от мин» у каруселей)
ALTER TABLE instagram_profiles ADD COLUMN IF NOT EXISTS avg_bottom3_likes INTEGER DEFAULT 0;

COMMENT ON COLUMN instagram_profiles.avg_bottom3_likes IS 'Среднее из 3 постов с наименьшими лайками (для залётности каруселей)';
