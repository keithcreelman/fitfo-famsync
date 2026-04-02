-- Bypass RLS for household creation via a SECURITY DEFINER function
-- This runs with the function owner's permissions, not the caller's
CREATE OR REPLACE FUNCTION create_household_with_member(
  p_name TEXT,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_household_id UUID;
  v_code TEXT;
BEGIN
  -- Generate invite code
  v_code := upper(substr(md5(random()::text), 1, 6));

  -- Create household
  INSERT INTO households (name, created_by, invite_code)
  VALUES (p_name, p_user_id, v_code)
  RETURNING id INTO v_household_id;

  -- Add creator as accepted member
  INSERT INTO household_members (household_id, user_id, role, invite_status, joined_at, privacy_acknowledged_at)
  VALUES (v_household_id, p_user_id, 'parent', 'accepted', now(), now());

  RETURN json_build_object(
    'household_id', v_household_id,
    'invite_code', v_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
