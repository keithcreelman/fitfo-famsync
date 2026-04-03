-- Event comments for parent coordination
CREATE TABLE IF NOT EXISTS event_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view event comments" ON event_comments
  FOR SELECT USING (user_id = auth.uid() OR event_id IN (
    SELECT id FROM events WHERE household_id IN (SELECT get_my_household_ids())
  ));

CREATE POLICY "Users can create comments" ON event_comments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own comments" ON event_comments
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX idx_event_comments_event ON event_comments(event_id);

-- Notification preferences per user
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  daily_digest BOOLEAN DEFAULT true,
  daily_digest_time TIME DEFAULT '07:00',
  weekly_digest BOOLEAN DEFAULT true,
  weekly_digest_day INT DEFAULT 0, -- 0=Sunday
  weekly_digest_time TIME DEFAULT '20:00',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON notification_preferences
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can manage own preferences" ON notification_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own preferences" ON notification_preferences
  FOR UPDATE USING (user_id = auth.uid());
