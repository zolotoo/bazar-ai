-- Bucket для превью видео (постоянные URL вместо истекающих Instagram CDN)
-- Выполнить в Supabase SQL Editor, если миграция не создаёт bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Публичное чтение (URL работают без авторизации)
DROP POLICY IF EXISTS "Public read thumbnails" ON storage.objects;
CREATE POLICY "Public read thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails');
