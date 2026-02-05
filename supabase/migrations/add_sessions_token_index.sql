-- Индекс для быстрой проверки сессии при загрузке приложения
-- Запрос: WHERE token = ? AND expires_at > ?
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_token_expires ON sessions(token, expires_at);
