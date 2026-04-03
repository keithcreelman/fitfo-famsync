-- Event photos/videos
CREATE TABLE IF NOT EXISTS event_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id),
  file_path TEXT NOT NULL, -- Supabase Storage path
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- image/jpeg, video/mp4, etc.
  file_size INT, -- bytes
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '1 year')
);

ALTER TABLE event_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view event media" ON event_media
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE household_id IN (SELECT get_my_household_ids()))
  );

CREATE POLICY "Members can upload media" ON event_media
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Uploaders can delete own media" ON event_media
  FOR DELETE USING (uploaded_by = auth.uid());

CREATE INDEX idx_event_media_event ON event_media(event_id);
CREATE INDEX idx_event_media_expires ON event_media(expires_at);
