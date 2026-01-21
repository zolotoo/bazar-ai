-- Таблица статистики Instagram профилей
-- Хранит среднее/медиану/минимум просмотров для расчёта "залётности" видео
CREATE TABLE IF NOT EXISTS instagram_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  
  -- Базовая информация о профиле
  full_name TEXT,
  biography TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  media_count INTEGER DEFAULT 0,
  profile_pic_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  
  -- Статистика по видео (рассчитывается по последним N роликам)
  videos_analyzed INTEGER DEFAULT 0,        -- Сколько видео проанализировано
  avg_views INTEGER DEFAULT 0,              -- Среднее кол-во просмотров
  median_views INTEGER DEFAULT 0,           -- Медиана просмотров
  min_views INTEGER DEFAULT 0,              -- Минимум просмотров
  max_views INTEGER DEFAULT 0,              -- Максимум просмотров
  avg_likes INTEGER DEFAULT 0,              -- Среднее кол-во лайков
  median_likes INTEGER DEFAULT 0,           -- Медиана лайков
  avg_comments INTEGER DEFAULT 0,           -- Среднее кол-во комментов
  
  -- Даты
  stats_updated_at TIMESTAMPTZ,             -- Когда последний раз обновляли статистику
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индекс для быстрого поиска по username
CREATE INDEX IF NOT EXISTS idx_instagram_profiles_username ON instagram_profiles(username);

-- Индекс для поиска профилей которые давно не обновлялись
CREATE INDEX IF NOT EXISTS idx_instagram_profiles_stats_updated ON instagram_profiles(stats_updated_at);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_instagram_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS trigger_instagram_profiles_updated_at ON instagram_profiles;
CREATE TRIGGER trigger_instagram_profiles_updated_at
  BEFORE UPDATE ON instagram_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_instagram_profiles_updated_at();

-- RLS (Row Level Security)
ALTER TABLE instagram_profiles ENABLE ROW LEVEL SECURITY;

-- Политика: все могут читать
CREATE POLICY "Anyone can read instagram_profiles" ON instagram_profiles
  FOR SELECT USING (true);

-- Политика: вставка разрешена
CREATE POLICY "Anyone can insert instagram_profiles" ON instagram_profiles
  FOR INSERT WITH CHECK (true);

-- Политика: обновление разрешено
CREATE POLICY "Anyone can update instagram_profiles" ON instagram_profiles
  FOR UPDATE USING (true);

-- Добавляем связь с tracked_profiles (радар)
-- Если таблица tracked_profiles существует, добавляем ссылку на instagram_profiles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tracked_profiles') THEN
    -- Добавляем колонку если её нет
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tracked_profiles' AND column_name = 'instagram_profile_id') THEN
      ALTER TABLE tracked_profiles ADD COLUMN instagram_profile_id UUID REFERENCES instagram_profiles(id);
    END IF;
  END IF;
END $$;

-- Добавляем связь с saved_videos
-- Если видео из профиля который есть в нашей базе, храним ссылку
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_videos') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'saved_videos' AND column_name = 'author_profile_id') THEN
      ALTER TABLE saved_videos ADD COLUMN author_profile_id UUID REFERENCES instagram_profiles(id);
    END IF;
  END IF;
END $$;
