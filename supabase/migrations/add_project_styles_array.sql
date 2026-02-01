-- Несколько стилей в одном проекте: [{ id, name, prompt, meta, examplesCount }]
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_styles JSONB DEFAULT '[]';

COMMENT ON COLUMN projects.project_styles IS 'Массив стилей: [{ "id": "uuid", "name": "Короткие", "prompt": "...", "meta": {...}, "examplesCount": 3 }]. legacy: style_prompt мигрирует в первый стиль при чтении.';
