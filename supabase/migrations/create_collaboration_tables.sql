-- Миграция: Система совместной работы над проектами
-- Создание таблиц для управления участниками, изменениями и presence

-- 1. Таблица участников проектов
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Telegram username: tg-@username
  role TEXT NOT NULL CHECK (role IN ('read', 'write', 'admin')),
  invited_by TEXT NOT NULL, -- Telegram username пригласившего
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'removed')),
  
  UNIQUE(project_id, user_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для project_members
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_status ON project_members(status);

-- 2. Таблица изменений проектов (Event Sourcing)
CREATE TABLE IF NOT EXISTS project_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN (
    'video_added', 'video_moved', 'video_deleted', 
    'folder_created', 'folder_renamed', 'folder_deleted',
    'project_updated', 'member_added', 'member_removed', 'member_role_changed'
  )),
  entity_type TEXT NOT NULL, -- 'video', 'folder', 'project', 'member'
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  vector_clock JSONB DEFAULT '{}'::jsonb, -- Для конфликт-резолюции
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для project_changes
CREATE INDEX IF NOT EXISTS idx_project_changes_project_time ON project_changes(project_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_project_changes_entity ON project_changes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_project_changes_user ON project_changes(user_id);

-- 3. Таблица presence (кто сейчас редактирует)
CREATE TABLE IF NOT EXISTS project_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  entity_type TEXT, -- 'video', 'folder', null (общий просмотр)
  entity_id UUID,
  cursor_position JSONB, -- Для показа курсора
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Уникальный индекс для project_presence (вместо UNIQUE constraint с COALESCE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_presence_unique 
ON project_presence(project_id, user_id, COALESCE(entity_type, ''), COALESCE(entity_id::text, ''));

-- Индексы для project_presence
CREATE INDEX IF NOT EXISTS idx_presence_project ON project_presence(project_id);
CREATE INDEX IF NOT EXISTS idx_presence_user ON project_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON project_presence(last_seen);

-- 4. Обновление таблицы projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ;

-- 5. Обновление таблицы saved_videos для синхронизации
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS last_modified_by TEXT;
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 6. Функция для автоматической очистки старых presence записей
CREATE OR REPLACE FUNCTION cleanup_stale_presence()
RETURNS void AS $$
BEGIN
  DELETE FROM project_presence 
  WHERE last_seen < NOW() - INTERVAL '30 seconds';
END;
$$ LANGUAGE plpgsql;

-- 7. Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_members_updated_at
  BEFORE UPDATE ON project_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7.5. Helper function для RLS (избегает рекурсии при проверке членства)
-- Эта функция обходит RLS на project_members, используя SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_project_member_role(
  p_project_id TEXT,
  p_user_id TEXT,
  p_min_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = p_project_id
      AND pm.user_id = p_user_id
      AND pm.status = 'active'
      AND (
        p_min_role = 'read'
        OR (p_min_role = 'write' AND pm.role IN ('write', 'admin'))
        OR (p_min_role = 'admin' AND pm.role = 'admin')
      )
  );
END;
$$;

-- 7.6. Функция для установки контекста пользователя (для RLS)
CREATE OR REPLACE FUNCTION public.set_user_context(p_user_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.current_user_id', p_user_id, false);
END;
$$;

-- 8. RLS Policies для project_members
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики если они существуют
DROP POLICY IF EXISTS "Users can view memberships in their projects" ON project_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON project_members;
DROP POLICY IF EXISTS "Owners can view project members" ON project_members;
DROP POLICY IF EXISTS "Owners and admins can add members" ON project_members;
DROP POLICY IF EXISTS "Owners and admins can update members" ON project_members;

-- Упрощенные политики без рекурсии
-- Пользователи видят свои членства
CREATE POLICY "Users can view their own memberships"
  ON project_members FOR SELECT
  USING (user_id = current_setting('app.current_user_id', true));

-- Владельцы проектов могут видеть всех участников своих проектов
CREATE POLICY "Owners can view project members"
  ON project_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_members.project_id
      AND p.owner_id = current_setting('app.current_user_id', true)
    )
  );

-- Только владельцы могут добавлять участников (без проверки через project_members)
CREATE POLICY "Owners can add members"
  ON project_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id
      AND p.owner_id = current_setting('app.current_user_id', true)
    )
  );

-- Только владельцы могут обновлять участников (без проверки через project_members)
CREATE POLICY "Owners can update members"
  ON project_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id
      AND p.owner_id = current_setting('app.current_user_id', true)
    )
  );

-- 9. RLS Policies для project_changes
ALTER TABLE project_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view project changes" ON project_changes;
DROP POLICY IF EXISTS "Write members can create changes" ON project_changes;

-- Участники проекта могут видеть изменения в проекте (используем функцию для избежания рекурсии)
CREATE POLICY "Members can view project changes"
  ON project_changes FOR SELECT
  USING (
    public.is_project_member_role(
      project_changes.project_id,
      current_setting('app.current_user_id', true),
      'read'
    )
  );

-- Участники с правами write могут создавать изменения
CREATE POLICY "Write members can create changes"
  ON project_changes FOR INSERT
  WITH CHECK (
    public.is_project_member_role(
      project_changes.project_id,
      current_setting('app.current_user_id', true),
      'write'
    )
  );

-- 10. RLS Policies для project_presence
ALTER TABLE project_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view presence" ON project_presence;
DROP POLICY IF EXISTS "Members can update their presence" ON project_presence;

-- Участники проекта могут видеть presence (используем функцию для избежания рекурсии)
CREATE POLICY "Members can view presence"
  ON project_presence FOR SELECT
  USING (
    public.is_project_member_role(
      project_presence.project_id,
      current_setting('app.current_user_id', true),
      'read'
    )
  );

-- Участники могут обновлять свой presence
CREATE POLICY "Members can update their presence"
  ON project_presence FOR ALL
  USING (
    user_id = current_setting('app.current_user_id', true) AND
    public.is_project_member_role(
      project_presence.project_id,
      current_setting('app.current_user_id', true),
      'read'
    )
  )
  WITH CHECK (
    user_id = current_setting('app.current_user_id', true) AND
    public.is_project_member_role(
      project_presence.project_id,
      current_setting('app.current_user_id', true),
      'read'
    )
  );
