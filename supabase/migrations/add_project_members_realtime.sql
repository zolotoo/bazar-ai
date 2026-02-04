-- Добавляем project_members в realtime для синхронизации участников в реальном времени
-- Позволяет всем клиентам видеть изменения при добавлении/удалении участников
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'project_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_members;
  END IF;
END $$;
