-- Permanent storage for Telegram username -> chat_id mapping.
-- Fixes the issue where getUpdates loses chat_ids after buffer overflow / 24h expiry.
CREATE TABLE IF NOT EXISTS telegram_chats (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  chat_id BIGINT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_chats_username ON telegram_chats(username);
CREATE INDEX IF NOT EXISTS idx_telegram_chats_chat_id ON telegram_chats(chat_id);

-- Allow anon access (used from frontend + webhook API)
ALTER TABLE telegram_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "telegram_chats_allow_all" ON telegram_chats FOR ALL USING (true) WITH CHECK (true);
