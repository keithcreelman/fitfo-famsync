ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'postponed'));
