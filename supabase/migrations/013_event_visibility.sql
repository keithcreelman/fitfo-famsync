-- Event visibility for spectator access
-- public = visible to spectators (sports, band, etc.)
-- private = parents only (medical, appointments, parenting discussions)
ALTER TABLE events ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'private'));

-- Default: all sports/band events are public, everything else private
UPDATE events SET visibility = 'public' WHERE category IN ('sports', 'lacrosse', 'soccer', 'basketball', 'flag_football', 'band');

-- Add viewer role support (spectators join with limited access)
-- The existing household_members table already supports role='viewer'
-- Viewers can only see events where visibility='public'
