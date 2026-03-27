-- ─────────────────────────────────────────────────────────────────────────────
-- 1. saved_videos: translation of Instagram caption + post description field
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE saved_videos
  ADD COLUMN IF NOT EXISTS caption_translation TEXT,
  ADD COLUMN IF NOT EXISTS post_description     TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. projects: description templates (title + body text for posting descriptions)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS description_templates JSONB DEFAULT '[]'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. video_comments table — team comments per video
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id   UUID        NOT NULL REFERENCES saved_videos(id) ON DELETE CASCADE,
  project_id TEXT,
  user_id    TEXT        NOT NULL,
  username   TEXT,
  content    TEXT        NOT NULL CHECK (char_length(content) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by video
CREATE INDEX IF NOT EXISTS video_comments_video_id_idx ON video_comments(video_id);
CREATE INDEX IF NOT EXISTS video_comments_project_id_idx ON video_comments(project_id);

-- Row level security — project members can read/write
ALTER TABLE video_comments ENABLE ROW LEVEL SECURITY;

-- Allow all reads (same pattern as the rest of the app)
CREATE POLICY "video_comments_select" ON video_comments
  FOR SELECT USING (true);

-- Allow any authenticated insert
CREATE POLICY "video_comments_insert" ON video_comments
  FOR INSERT WITH CHECK (true);

-- Allow delete (any user can delete, fine-grained check done in app)
CREATE POLICY "video_comments_delete" ON video_comments
  FOR DELETE USING (true);

-- Enable realtime for live comment feed
ALTER PUBLICATION supabase_realtime ADD TABLE video_comments;
