-- Таблица проектов
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#f97316',
  icon TEXT DEFAULT 'folder',
  folders JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индекс для быстрого поиска по пользователю
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Добавляем новые колонки в saved_videos для транскрибации
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS download_url TEXT;
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS transcript_id TEXT;
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS transcript_status TEXT DEFAULT NULL;
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS transcript_text TEXT;

-- Добавляем project_id для связи видео с проектом
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS folder_id TEXT;
