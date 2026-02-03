-- Таблица для профилей радара (отслеживаемые Instagram-аккаунты по проектам)
-- Хранит данные в Supabase вместо localStorage — профили не пропадают при смене устройства/браузера
CREATE TABLE IF NOT EXISTS radar_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  instagram_username TEXT NOT NULL,
  update_frequency_days INTEGER DEFAULT 7,
  last_checked_at TIMESTAMPTZ,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  avatar_url TEXT,
  full_name TEXT,
  reels_count INTEGER,
  UNIQUE(project_id, user_id, instagram_username)
);

CREATE INDEX IF NOT EXISTS idx_radar_profiles_project_user ON radar_profiles(project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_radar_profiles_user_id ON radar_profiles(user_id);

ALTER TABLE radar_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own radar profiles" ON radar_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own radar profiles" ON radar_profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own radar profiles" ON radar_profiles
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete own radar profiles" ON radar_profiles
  FOR DELETE USING (true);
