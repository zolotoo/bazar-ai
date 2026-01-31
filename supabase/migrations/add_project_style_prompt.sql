-- Промт стиля сценария проекта: few-shot по примерам (оригинал + перевод + моя адаптация)
-- Один промт на проект: если в проекте несколько людей — общий стиль проекта

ALTER TABLE projects ADD COLUMN IF NOT EXISTS style_prompt TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS style_meta JSONB DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS style_examples_count INTEGER DEFAULT 0;

COMMENT ON COLUMN projects.style_prompt IS 'Рабочий промт для генерации сценария в стиле проекта (на основе 1–5 примеров)';
COMMENT ON COLUMN projects.style_meta IS 'Мета: правила, стоп-слова, приёмы (результат анализа примеров)';
COMMENT ON COLUMN projects.style_examples_count IS 'Количество примеров, по которым построен промт';
