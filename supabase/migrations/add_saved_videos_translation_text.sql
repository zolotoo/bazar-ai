-- Колонка перевода в saved_videos (сохраняется после получения от API перевода)
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS translation_text TEXT;
COMMENT ON COLUMN saved_videos.translation_text IS 'Перевод транскрипции (например с Google/Gemini API)';
