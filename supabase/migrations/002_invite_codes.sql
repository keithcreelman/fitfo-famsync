-- Add invite_code to households for shareable short codes
ALTER TABLE households ADD COLUMN invite_code TEXT UNIQUE;

-- Create index for fast lookup
CREATE INDEX idx_households_invite_code ON households(invite_code);

-- Allow anyone authenticated to look up a household by invite code (for joining)
CREATE POLICY "Anyone can lookup by invite code" ON households
  FOR SELECT USING (
    invite_code IS NOT NULL
    AND auth.uid() IS NOT NULL
  );
