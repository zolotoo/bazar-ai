-- Отдельные папки для каруселей (не связаны с папками рилсов)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS carousel_folders JSONB DEFAULT '[]';

COMMENT ON COLUMN projects.carousel_folders IS 'Папки для каруселей проекта; папки рилсов хранятся в folders';
