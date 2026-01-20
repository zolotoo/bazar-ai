-- Таблица для отслеживания Instagram аккаунтов
CREATE TABLE IF NOT EXISTS tracked_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  instagram_username TEXT NOT NULL,
  update_frequency_hours INTEGER DEFAULT 24,
  last_checked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, instagram_username)
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_tracked_accounts_user_id ON tracked_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_tracked_accounts_username ON tracked_accounts(instagram_username);

-- Разрешения RLS (Row Level Security)
ALTER TABLE tracked_accounts ENABLE ROW LEVEL SECURITY;

-- Политика для чтения своих записей
CREATE POLICY "Users can read own tracked accounts" ON tracked_accounts
  FOR SELECT USING (true);

-- Политика для вставки своих записей
CREATE POLICY "Users can insert own tracked accounts" ON tracked_accounts
  FOR INSERT WITH CHECK (true);

-- Политика для обновления своих записей
CREATE POLICY "Users can update own tracked accounts" ON tracked_accounts
  FOR UPDATE USING (true);

-- Политика для удаления своих записей
CREATE POLICY "Users can delete own tracked accounts" ON tracked_accounts
  FOR DELETE USING (true);
