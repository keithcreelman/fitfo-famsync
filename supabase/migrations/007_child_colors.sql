-- Add color column to children for visual identification
ALTER TABLE children ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6b7280';
