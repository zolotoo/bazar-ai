-- Bucket для превью видео (постоянные URL вместо истекающих Instagram CDN)
-- ОБЯЗАТЕЛЬНО: выполнить в Supabase Dashboard → SQL Editor
-- Или создать вручную: Storage → New bucket → id: thumbnails, Public: true

INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Публичное чтение (URL работают без авторизации)
DROP POLICY IF EXISTS "Public read thumbnails" ON storage.objects;
CREATE POLICY "Public read thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails');
