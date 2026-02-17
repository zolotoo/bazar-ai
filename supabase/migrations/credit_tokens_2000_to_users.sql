-- Зачислить по 2000 токенов указанным пользователям.
-- Если пользователя нет в users — создаётся запись с token_balance = 2000.
-- Если есть — к текущему балансу добавляется 2000.

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
