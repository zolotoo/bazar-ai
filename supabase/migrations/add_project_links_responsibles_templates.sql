-- Шаблоны ссылок и ответственных на уровне проекта (видны всем видео проекта и в общих проектах — всем участникам)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS links_template JSONB DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS responsibles_template JSONB DEFAULT NULL;

COMMENT ON COLUMN projects.links_template IS 'Шаблон пунктов ссылок: [{ "id": "link-0", "label": "Заготовка" }, ...]. Применяется ко всем видео проекта.';
COMMENT ON COLUMN projects.responsibles_template IS 'Шаблон пунктов ответственных: [{ "id": "resp-0", "label": "За сценарий" }, ...]. Применяется ко всем видео проекта.';
