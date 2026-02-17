-- Баланс токенов пользователя. Начальный баланс 20.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'token_balance') THEN
    ALTER TABLE public.users ADD COLUMN token_balance integer NOT NULL DEFAULT 20;
  END IF;
  UPDATE public.users SET token_balance = 20 WHERE token_balance IS NULL;
END $$;
