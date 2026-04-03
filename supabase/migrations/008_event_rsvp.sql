-- RSVP / availability tracking per event per user
CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'not_going')),
  note TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- RLS
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view event rsvps" ON event_rsvps
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE household_id IN (SELECT get_my_household_ids()))
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can manage own rsvps" ON event_rsvps
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own rsvps" ON event_rsvps
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own rsvps" ON event_rsvps
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX idx_event_rsvps_event ON event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_user ON event_rsvps(user_id);
