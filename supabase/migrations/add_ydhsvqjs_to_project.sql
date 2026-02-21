-- Добавить пользователя ydhsvqjs: 200 токенов + участник проекта project-1770464000987

-- 1. Создать/обновить пользователя в users
INSERT INTO public.users (telegram_username, token_balance, last_login)
VALUES ('ydhsvqjs', 200, NOW())
ON CONFLICT (telegram_username) DO UPDATE
SET token_balance = public.users.token_balance + 200;

-- 2. Добавить в project_members с ролью write
INSERT INTO public.project_members (project_id, user_id, role, invited_by, joined_at, status)
VALUES (
  'project-1770464000987',
  'tg-@ydhsvqjs',
  'write',
  'tg-@sergeyzolotykh',
  NOW(),
  'active'
)
ON CONFLICT (project_id, user_id) DO UPDATE
SET role = 'write',
    status = 'active',
    joined_at = NOW();
