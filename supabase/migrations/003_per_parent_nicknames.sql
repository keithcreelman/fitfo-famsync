-- Per-parent nicknames: each parent can set their own nickname for each child
-- The master name stays on the children table, shared across household

CREATE TABLE child_nicknames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(child_id, user_id)
);

ALTER TABLE child_nicknames ENABLE ROW LEVEL SECURITY;

-- Users can see nicknames for children in their household
CREATE POLICY "Members can view child nicknames" ON child_nicknames
  FOR SELECT USING (
    child_id IN (
      SELECT c.id FROM children c
      WHERE c.household_id IN (SELECT get_my_household_ids())
    )
  );

-- Users can only set their own nicknames
CREATE POLICY "Users can set own nicknames" ON child_nicknames
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own nicknames" ON child_nicknames
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own nicknames" ON child_nicknames
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX idx_child_nicknames_child ON child_nicknames(child_id);
CREATE INDEX idx_child_nicknames_user ON child_nicknames(user_id);
