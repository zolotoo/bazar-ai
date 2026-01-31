-- Динамические ссылки и ответственные: массивы { label, value } с возможностью переименования и добавления пунктов

ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS links JSONB DEFAULT NULL;
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS responsibles JSONB DEFAULT NULL;

COMMENT ON COLUMN saved_videos.links IS 'Массив ссылок: [{ "label": "Заготовка", "value": "url" }, ...]';
COMMENT ON COLUMN saved_videos.responsibles IS 'Массив ответственных: [{ "label": "За сценарий", "value": "Имя" }, ...]';
