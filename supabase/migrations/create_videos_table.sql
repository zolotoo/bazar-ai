-- Общая таблица видео (кеш метаданных и транскрибаций)
-- Хранит данные о видео независимо от пользователей
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcode TEXT UNIQUE NOT NULL,
  
  -- Метаданные Instagram
  instagram_id TEXT,
  url TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  owner_username TEXT,
  
  -- Статистика (обновляется при каждом запросе)
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  taken_at BIGINT,
  
  -- Транскрибация (делается один раз, используется всеми)
  download_url TEXT,
  transcript_id TEXT,
  transcript_status TEXT DEFAULT NULL, -- null, downloading, processing, completed, error
  transcript_text TEXT,
  transcript_language TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индекс для быстрого поиска по shortcode
CREATE INDEX IF NOT EXISTS idx_videos_shortcode ON videos(shortcode);

-- Индекс для поиска по owner
CREATE INDEX IF NOT EXISTS idx_videos_owner ON videos(owner_username);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS trigger_videos_updated_at ON videos;
CREATE TRIGGER trigger_videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION update_videos_updated_at();

-- RLS (Row Level Security) - все могут читать, но не изменять напрямую
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Политика: все могут читать
CREATE POLICY "Anyone can read videos" ON videos
  FOR SELECT USING (true);

-- Политика: вставка через сервис (или отключить RLS для этой таблицы)
CREATE POLICY "Service can insert videos" ON videos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update videos" ON videos
  FOR UPDATE USING (true);
