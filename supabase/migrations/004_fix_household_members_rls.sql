-- Fix: household_members SELECT policy was too restrictive
-- Users couldn't see their OWN accepted membership row right after inserting it
-- because get_my_household_ids() runs in a context where it might not see the
-- just-created row yet. Adding user_id = auth.uid() as an explicit escape hatch
-- so a user can always see their own membership rows.

DROP POLICY IF EXISTS "Members can view household members" ON household_members;

CREATE POLICY "Members can view household members" ON household_members
  FOR SELECT USING (
    household_id IN (SELECT get_my_household_ids())
    OR user_id = auth.uid()
    OR invite_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
