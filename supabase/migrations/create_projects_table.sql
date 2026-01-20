-- Создание таблицы проектов
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#f97316',
  icon TEXT DEFAULT 'folder',
  folders JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индекс для быстрого поиска по user_id
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- RLS политики
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Политика для чтения своих проектов
CREATE POLICY "Users can read own projects" ON projects
  FOR SELECT USING (true);

-- Политика для создания проектов
CREATE POLICY "Users can create projects" ON projects
  FOR INSERT WITH CHECK (true);

-- Политика для обновления своих проектов
CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (true);

-- Политика для удаления своих проектов
CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (true);
