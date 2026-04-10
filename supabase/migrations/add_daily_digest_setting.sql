-- Добавляем флаг "утренний дайджест" в таблицу пользователей
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_digest_enabled BOOLEAN DEFAULT false;
