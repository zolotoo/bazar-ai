-- Приводим user_id в project_members к lowercase для совпадения с сессией (tg-username)
-- Иначе приглашённый не видит проект в общих
UPDATE project_members
SET user_id = LOWER(user_id)
WHERE user_id != LOWER(user_id);
