-- Удалить из БД все данные пользователя @Malaya03rus (telegram_username: malaya03rus, user_id: tg-malaya03rus).
-- Выполнить в Supabase SQL Editor. Необратимо.

DO $$
DECLARE
  v_user_id TEXT := 'tg-malaya03rus';
  v_username TEXT := 'malaya03rus';
BEGIN
  -- Присутствие в проектах
  DELETE FROM public.project_presence WHERE user_id = v_user_id;
  -- История изменений в проектах
  DELETE FROM public.project_changes WHERE user_id = v_user_id;
  -- Черновики сценариев
  DELETE FROM public.script_drafts WHERE user_id = v_user_id;
  -- Сохранённые видео (рилсы)
  DELETE FROM public.saved_videos WHERE user_id = v_user_id;
  -- Сохранённые карусели
  DELETE FROM public.saved_carousels WHERE user_id = v_user_id;
  -- Радар: отслеживаемые профили
  DELETE FROM public.radar_profiles WHERE user_id = v_user_id;
  -- Отслеживаемые аккаунты (если таблица есть)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tracked_accounts') THEN
    DELETE FROM public.tracked_accounts WHERE user_id = v_user_id;
  END IF;
  -- Участник в чужих проектах
  DELETE FROM public.project_members WHERE user_id = v_user_id;
  -- Участники в проектах, которыми владеет пользователь (затем удалим сами проекты)
  DELETE FROM public.project_members WHERE project_id IN (SELECT id FROM public.projects WHERE user_id = v_user_id);
  -- Проекты, владельцем которых является пользователь
  DELETE FROM public.projects WHERE user_id = v_user_id;
  -- Сессии (выйти из всех устройств)
  DELETE FROM public.sessions WHERE telegram_username = v_username;
  -- Коды входа (если таблица есть)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auth_codes') THEN
    DELETE FROM public.auth_codes WHERE telegram_username = v_username;
  END IF;
  -- Запись пользователя
  DELETE FROM public.users WHERE telegram_username = v_username;
END $$;
