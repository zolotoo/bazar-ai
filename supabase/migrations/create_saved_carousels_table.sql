-- Таблица сохранённых каруселей Instagram (посты с несколькими фото/слайдами)
-- Аналог saved_videos, но для каруселей: те же проекты, папки, ответственные
CREATE TABLE IF NOT EXISTS saved_carousels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  folder_id TEXT,

  -- Метаданные поста (карусель)
  shortcode TEXT NOT NULL,
  url TEXT,
  caption TEXT,
  owner_username TEXT,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  taken_at BIGINT,
  slide_count INTEGER DEFAULT 0,
  -- URL первого слайда для превью (остальные можно подгружать по API при открытии)
  thumbnail_url TEXT,

  -- «Транскрибация» по фото: Vision API (описание + текст с каждого слайда) → один текст на карусель
  transcript_status TEXT DEFAULT NULL,  -- null, processing, completed, error
  transcript_text TEXT,                 -- склеенный текст по всем слайдам
  transcript_slides JSONB DEFAULT NULL, -- [{ "slide_index": 0, "description": "...", "text": "..." }, ...]
  translation_text TEXT,

  -- Сценарий, ссылки, ответственные (как у saved_videos)
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

COMMENT ON TABLE saved_carousels IS 'Сохранённые карусели Instagram: пост с несколькими слайдами, «транскрипт» через Vision по фото';
COMMENT ON COLUMN saved_carousels.transcript_slides IS 'Результат Vision по каждому слайду: описание + извлечённый текст';
COMMENT ON COLUMN saved_carousels.transcript_text IS 'Объединённый текст по всем слайдам (как transcript_text у рилсов)';

-- RLS (как у saved_videos: доступ по user_id и project_id)
ALTER TABLE saved_carousels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own carousels" ON saved_carousels
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own carousels" ON saved_carousels
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own carousels" ON saved_carousels
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete own carousels" ON saved_carousels
  FOR DELETE USING (true);
