-- Миграция: Добавление полей для ссылок и ответственных в saved_videos
-- Добавляем поля для работы с видео: ссылки на заготовку и готовое, ответственные за сценарий и монтаж

-- Добавляем поля для ссылок
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS draft_link TEXT;
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS final_link TEXT;

-- Добавляем поля для ответственных
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS script_responsible TEXT;
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS editing_responsible TEXT;

-- Комментарии к полям для документации
COMMENT ON COLUMN saved_videos.draft_link IS 'Ссылка на заготовку видео';
COMMENT ON COLUMN saved_videos.final_link IS 'Ссылка на готовое видео';
COMMENT ON COLUMN saved_videos.script_responsible IS 'Кто отвечает за сценарий';
COMMENT ON COLUMN saved_videos.editing_responsible IS 'Кто отвечает за монтаж';
