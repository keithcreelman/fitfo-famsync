-- FamSync Co-Parenting App — Initial Schema
-- Run this in Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE TABLES
-- ============================================

CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'parent' CHECK (role IN ('parent', 'guardian', 'viewer')),
  invited_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ,
  invite_email TEXT,
  invite_status TEXT DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted', 'declined')),
  privacy_acknowledged_at TIMESTAMPTZ,
  UNIQUE(household_id, user_id)
);

CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nickname TEXT,
  birth_date DATE,
  grade TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- EVENTS / CALENDAR
-- ============================================

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'other' CHECK (category IN (
    'school', 'sports', 'medical', 'band', 'appointment',
    'chore', 'homework', 'workout', 'parenting_discussion',
    'travel', 'other'
  )),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  location TEXT,
  all_day BOOLEAN DEFAULT false,
  source_type TEXT DEFAULT 'manual' CHECK (source_type IN (
    'manual', 'nlp_quick_add', 'ics_import', 'screenshot_import',
    'email_import', 'pdf_import', 'calendar_sync'
  )),
  source_artifact_id UUID,
  requires_discussion BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE event_children (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, child_id)
);

-- ============================================
-- MONTHLY MEETING SYSTEM
-- ============================================

CREATE TABLE meeting_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  week_of_month INT CHECK (week_of_month BETWEEN 1 AND 4),
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
  time_of_day TIME NOT NULL,
  duration_minutes INT CHECK (duration_minutes IN (15, 30)),
  backup_day_of_week INT,
  backup_time TIME,
  reminder_hours_before INT[] DEFAULT '{24, 1}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(household_id)
);

CREATE TABLE meeting_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES meeting_schedules(id),
  scheduled_date TIMESTAMPTZ NOT NULL,
  is_backup BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'completed', 'missed', 'rescheduled'
  )),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- DISCUSSION NOTES / AGENDA
-- ============================================

CREATE TABLE discussion_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  body TEXT,
  priority TEXT DEFAULT 'next_meeting' CHECK (priority IN (
    'urgent', 'next_meeting', 'future', 'informational'
  )),
  is_private BOOLEAN DEFAULT true,
  promoted_at TIMESTAMPTZ,
  meeting_instance_id UUID REFERENCES meeting_instances(id),
  child_id UUID REFERENCES children(id),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'discussed', 'resolved', 'deferred')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- IMPORT PIPELINE
-- ============================================

CREATE TABLE imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('ics', 'screenshot', 'email', 'pdf')),
  file_path TEXT,
  raw_extracted_text TEXT,
  parsed_data JSONB,
  confidence_score DECIMAL(3,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected')),
  event_id UUID REFERENCES events(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- CALENDAR CONNECTIONS
-- ============================================

CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  provider TEXT NOT NULL CHECK (provider IN ('google', 'apple', 'outlook')),
  access_token TEXT,
  refresh_token TEXT,
  calendar_id TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  household_id UUID REFERENCES households(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- AUDIT LOG
-- ============================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_household_members_user ON household_members(user_id);
CREATE INDEX idx_household_members_household ON household_members(household_id);
CREATE INDEX idx_events_household ON events(household_id);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_household_start ON events(household_id, start_time);
CREATE INDEX idx_children_household ON children(household_id);
CREATE INDEX idx_discussion_notes_household ON discussion_notes(household_id);
CREATE INDEX idx_discussion_notes_creator ON discussion_notes(created_by);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_audit_log_household ON audit_log(household_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function: get household IDs for current user
CREATE OR REPLACE FUNCTION get_my_household_ids()
RETURNS SETOF UUID AS $$
  SELECT household_id FROM household_members
  WHERE user_id = auth.uid() AND invite_status = 'accepted'
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Households: members can read their households
CREATE POLICY "Members can view household" ON households
  FOR SELECT USING (id IN (SELECT get_my_household_ids()));
CREATE POLICY "Authenticated users can create households" ON households
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Household members: members can view co-members, anyone can check invites
CREATE POLICY "Members can view household members" ON household_members
  FOR SELECT USING (
    household_id IN (SELECT get_my_household_ids())
    OR invite_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
CREATE POLICY "Parents can invite members" ON household_members
  FOR INSERT WITH CHECK (
    household_id IN (SELECT get_my_household_ids())
    OR user_id = auth.uid()
  );
CREATE POLICY "Members can update own membership" ON household_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR invite_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Children: household members can CRUD
CREATE POLICY "Members can view children" ON children
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Members can add children" ON children
  FOR INSERT WITH CHECK (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Members can update children" ON children
  FOR UPDATE USING (household_id IN (SELECT get_my_household_ids()));

-- Events: household members can CRUD
CREATE POLICY "Members can view events" ON events
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Members can create events" ON events
  FOR INSERT WITH CHECK (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Members can update events" ON events
  FOR UPDATE USING (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Members can delete events" ON events
  FOR DELETE USING (household_id IN (SELECT get_my_household_ids()));

-- Event children: follow event access
CREATE POLICY "Members can view event children" ON event_children
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE household_id IN (SELECT get_my_household_ids()))
  );
CREATE POLICY "Members can link event children" ON event_children
  FOR INSERT WITH CHECK (
    event_id IN (SELECT id FROM events WHERE household_id IN (SELECT get_my_household_ids()))
  );

-- Meeting schedules: household members
CREATE POLICY "Members can view meeting schedules" ON meeting_schedules
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Members can manage meeting schedules" ON meeting_schedules
  FOR INSERT WITH CHECK (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Members can update meeting schedules" ON meeting_schedules
  FOR UPDATE USING (household_id IN (SELECT get_my_household_ids()));

-- Meeting instances: household members
CREATE POLICY "Members can view meeting instances" ON meeting_instances
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Members can manage meeting instances" ON meeting_instances
  FOR INSERT WITH CHECK (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Members can update meeting instances" ON meeting_instances
  FOR UPDATE USING (household_id IN (SELECT get_my_household_ids()));

-- Discussion notes: private notes only visible to creator, shared notes to household
CREATE POLICY "Users can view own private notes" ON discussion_notes
  FOR SELECT USING (
    (is_private = true AND created_by = auth.uid())
    OR (is_private = false AND household_id IN (SELECT get_my_household_ids()))
  );
CREATE POLICY "Members can create notes" ON discussion_notes
  FOR INSERT WITH CHECK (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Users can update own notes" ON discussion_notes
  FOR UPDATE USING (created_by = auth.uid());

-- Imports: household members
CREATE POLICY "Members can view imports" ON imports
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Members can create imports" ON imports
  FOR INSERT WITH CHECK (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "Members can update imports" ON imports
  FOR UPDATE USING (household_id IN (SELECT get_my_household_ids()));

-- Calendar connections: user's own only
CREATE POLICY "Users can view own connections" ON calendar_connections
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can manage own connections" ON calendar_connections
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own connections" ON calendar_connections
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own connections" ON calendar_connections
  FOR DELETE USING (user_id = auth.uid());

-- Notifications: user's own only
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Audit log: household members can read
CREATE POLICY "Members can view audit log" ON audit_log
  FOR SELECT USING (household_id IN (SELECT get_my_household_ids()));
CREATE POLICY "System can create audit entries" ON audit_log
  FOR INSERT WITH CHECK (true);
