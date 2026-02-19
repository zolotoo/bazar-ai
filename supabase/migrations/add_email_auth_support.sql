-- 1. Extend users table with user_id and email for dual auth support
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- Backfill user_id for existing Telegram users
UPDATE users SET user_id = 'tg-' || telegram_username WHERE user_id IS NULL;

-- 2. Extend sessions table for email auth
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auth_method TEXT DEFAULT 'telegram';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Backfill sessions
UPDATE sessions
SET user_id = 'tg-' || telegram_username,
    auth_method = 'telegram'
WHERE user_id IS NULL AND telegram_username IS NOT NULL;

-- 3. User identity linking table
CREATE TABLE IF NOT EXISTS user_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_username TEXT UNIQUE,
  email TEXT UNIQUE,
  supabase_uid UUID UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT at_least_one_identity CHECK (telegram_username IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_user_links_telegram ON user_links(telegram_username);
CREATE INDEX IF NOT EXISTS idx_user_links_email ON user_links(email);

ALTER TABLE user_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_links_allow_all" ON user_links FOR ALL USING (true) WITH CHECK (true);

-- 4. Seed user_links from existing users
INSERT INTO user_links (telegram_username)
SELECT telegram_username FROM users
ON CONFLICT (telegram_username) DO NOTHING;
