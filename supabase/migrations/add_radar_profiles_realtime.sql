-- Добавляем radar_profiles в realtime для синхронизации радара между участниками проекта
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'radar_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.radar_profiles;
  END IF;
END $$;
