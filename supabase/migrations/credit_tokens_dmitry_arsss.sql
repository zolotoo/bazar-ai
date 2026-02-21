-- Зачислить токены: DmitryLazdin — 1500, arsssokol — 200

INSERT INTO public.users (telegram_username, token_balance, last_login)
VALUES
  ('dmitrylazdin', 1500, NOW()),
  ('arsssokol', 200, NOW())
ON CONFLICT (telegram_username) DO UPDATE
SET token_balance = public.users.token_balance + EXCLUDED.token_balance;
