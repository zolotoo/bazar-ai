-- ============================================================
-- Выполни этот файл в Supabase: SQL Editor → New query → вставь ниже → Run
-- Создаёт таблицу saved_carousels и колонку slide_urls
-- ============================================================

-- Таблица сохранённых каруселей Instagram
CREATE TABLE IF NOT EXISTS saved_carousels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  folder_id TEXT,

  shortcode TEXT NOT NULL,
  url TEXT,
  caption TEXT,
  owner_username TEXT,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  taken_at BIGINT,
  slide_count INTEGER DEFAULT 0,
  thumbnail_url TEXT,
  slide_urls JSONB DEFAULT NULL,

  transcript_status TEXT DEFAULT NULL,
  transcript_text TEXT,
  transcript_slides JSONB DEFAULT NULL,
  translation_text TEXT,

  script_text TEXT,
  draft_link TEXT,
  final_link TEXT,
  script_responsible TEXT,
  editing_responsible TEXT,
  links JSONB DEFAULT NULL,
  responsibles JSONB DEFAULT NULL,

  added_at TIMESTAMPTZ DEFAULT NOW(),
  last_modified_by TEXT,
  last_modified_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1,

  UNIQUE(user_id, shortcode)
);

CREATE INDEX IF NOT EXISTS idx_saved_carousels_user_id ON saved_carousels(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_carousels_project_id ON saved_carousels(project_id);
CREATE INDEX IF NOT EXISTS idx_saved_carousels_folder_id ON saved_carousels(folder_id);
CREATE INDEX IF NOT EXISTS idx_saved_carousels_added_at ON saved_carousels(added_at DESC);

ALTER TABLE saved_carousels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own carousels" ON saved_carousels;
DROP POLICY IF EXISTS "Users can insert own carousels" ON saved_carousels;
DROP POLICY IF EXISTS "Users can update own carousels" ON saved_carousels;
DROP POLICY IF EXISTS "Users can delete own carousels" ON saved_carousels;

CREATE POLICY "Users can read own carousels" ON saved_carousels FOR SELECT USING (true);
CREATE POLICY "Users can insert own carousels" ON saved_carousels FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own carousels" ON saved_carousels FOR UPDATE USING (true);
CREATE POLICY "Users can delete own carousels" ON saved_carousels FOR DELETE USING (true);

-- На случай если таблица уже была создана без slide_urls
ALTER TABLE saved_carousels ADD COLUMN IF NOT EXISTS slide_urls JSONB DEFAULT NULL;
