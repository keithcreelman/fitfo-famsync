-- Fix: household_members SELECT and UPDATE policies referenced auth.users directly,
-- which the anon role cannot access. This caused "permission denied for table users"
-- on every query to household_members.
-- Removed the invite_email = (SELECT email FROM auth.users ...) conditions.

DROP POLICY IF EXISTS "Members can view household members" ON household_members;
CREATE POLICY "Members can view household members" ON household_members
  FOR SELECT USING (
    household_id IN (SELECT get_my_household_ids())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Members can update own membership" ON household_members;
CREATE POLICY "Members can update own membership" ON household_members
  FOR UPDATE USING (user_id = auth.uid());
