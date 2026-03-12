-- Добавить @malaya03rus в проект «Каина / ЛБ» принудительно (активный участник с ролью write).

-- 1. Создать запись в users, если пользователя ещё нет
INSERT INTO public.users (telegram_username, token_balance, last_login)
VALUES ('malaya03rus', 20, NOW())
ON CONFLICT (telegram_username) DO NOTHING;

-- 2. Добавить в проект по имени «Каина / ЛБ» (или обновить, если уже есть)
INSERT INTO public.project_members (project_id, user_id, role, invited_by, joined_at, status)
SELECT p.id, 'tg-malaya03rus', 'write', 'tg-sergeyzolotykh', NOW(), 'active'
FROM public.projects p
WHERE p.name ILIKE 'каина / лб'
LIMIT 1
ON CONFLICT (project_id, user_id) DO UPDATE
SET role = 'write', status = 'active', joined_at = NOW();
