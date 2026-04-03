-- Store parent home addresses for drive time calculations
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_label TEXT; -- e.g. "Dad's house", "Mom's house"
