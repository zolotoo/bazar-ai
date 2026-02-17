-- ============================================================
-- Один раз выполните этот скрипт в Supabase: SQL Editor → New query → вставьте → Run
-- Чтобы система токенов заработала + зачисление 2000 шести пользователям
-- ============================================================

-- 1) Таблица users: создать, если её ещё нет (логин через Telegram уже мог её создать)
CREATE TABLE IF NOT EXISTS public.users (
  telegram_username text PRIMARY KEY,
  last_login timestamptz,
  token_balance integer NOT NULL DEFAULT 20
);

-- 2) Добавить колонку token_balance, если таблица была без неё
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'token_balance'
  ) THEN
    ALTER TABLE public.users ADD COLUMN token_balance integer NOT NULL DEFAULT 20;
  END IF;
  UPDATE public.users SET token_balance = 20 WHERE token_balance IS NULL;
END $$;

-- 3) Зачислить по 2000 токенов указанным пользователям
INSERT INTO public.users (telegram_username, token_balance, last_login)
VALUES
  ('maximevdokimov92', 2000, NOW()),
  ('pavelpantsevich', 2000, NOW()),
  ('kainamag', 2000, NOW()),
  ('podmarrkov', 2000, NOW()),
  ('sergeyzolotykh', 2000, NOW()),
  ('blessloli', 2000, NOW())
ON CONFLICT (telegram_username) DO UPDATE
SET token_balance = public.users.token_balance + 2000;
