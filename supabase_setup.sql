-- ============================================
-- Supabase Setup SQL для telegram-content-crm
-- ============================================
-- Скопируйте и выполните этот SQL в Supabase SQL Editor
-- (Settings → SQL Editor → New query)

-- Создание таблицы inbox_videos
CREATE TABLE IF NOT EXISTS inbox_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  preview_url TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'on_canvas')),
  view_count INTEGER,
  like_count INTEGER,
  comment_count INTEGER,
  taken_at TIMESTAMPTZ,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Включаем Real-time подписки для таблицы
-- Это позволяет приложению получать обновления в реальном времени
ALTER PUBLICATION supabase_realtime ADD TABLE inbox_videos;

-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_inbox_videos_status ON inbox_videos(status);
CREATE INDEX IF NOT EXISTS idx_inbox_videos_created_at ON inbox_videos(created_at DESC);

-- Включаем Row Level Security (RLS) для безопасности
ALTER TABLE inbox_videos ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики, если они существуют (для повторного запуска)
DROP POLICY IF EXISTS "Allow read pending videos" ON inbox_videos;
DROP POLICY IF EXISTS "Allow update status" ON inbox_videos;
DROP POLICY IF EXISTS "Allow insert videos" ON inbox_videos;

-- Политика: все могут читать видео со статусом 'pending'
CREATE POLICY "Allow read pending videos"
  ON inbox_videos FOR SELECT
  USING (status = 'pending');

-- Политика: все могут обновлять статус на 'on_canvas'
CREATE POLICY "Allow update status"
  ON inbox_videos FOR UPDATE
  USING (true)
  WITH CHECK (status = 'on_canvas');

-- Политика: все могут вставлять новые видео
CREATE POLICY "Allow insert videos"
  ON inbox_videos FOR INSERT
  WITH CHECK (true);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS update_inbox_videos_updated_at ON inbox_videos;
CREATE TRIGGER update_inbox_videos_updated_at
    BEFORE UPDATE ON inbox_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Готово! Теперь таблица настроена и готова к использованию.
