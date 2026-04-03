-- Store parent override per event (null = use custody schedule default)
ALTER TABLE events ADD COLUMN IF NOT EXISTS assigned_parent TEXT CHECK (assigned_parent IN ('dad', 'mom'));
