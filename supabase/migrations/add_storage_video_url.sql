-- Видео в Supabase Storage — воспроизведение без Vercel proxy (снижает Fast Origin Transfer)
-- storage_video_url = Supabase URL, если видео уже закешировано

ALTER TABLE videos ADD COLUMN IF NOT EXISTS storage_video_url TEXT;
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS storage_video_url TEXT;

-- Bucket для видео (Reels ~10–60 MB каждый)
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Публичное чтение
DROP POLICY IF EXISTS "Public read videos" ON storage.objects;
CREATE POLICY "Public read videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos');
