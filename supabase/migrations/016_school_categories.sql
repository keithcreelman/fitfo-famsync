ALTER TABLE events DROP CONSTRAINT IF EXISTS events_category_check;
ALTER TABLE events ADD CONSTRAINT events_category_check CHECK (category IN (
  'school', 'no_school', 'half_day', 'vacation', 'school_misc',
  'sports', 'lacrosse', 'soccer', 'basketball', 'flag_football',
  'medical', 'band', 'appointment', 'chore', 'homework', 'workout',
  'parenting_discussion', 'travel', 'other'
));
