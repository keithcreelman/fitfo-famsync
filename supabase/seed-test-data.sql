-- ============================================
-- TEST DATA CLEANUP
-- Run this to wipe all test data before going live
-- ============================================

-- DELETE in correct order (respecting foreign keys)
DELETE FROM audit_log;
DELETE FROM notifications;
DELETE FROM imports;
DELETE FROM discussion_notes;
DELETE FROM meeting_instances;
DELETE FROM meeting_schedules;
DELETE FROM event_children;
DELETE FROM events;
DELETE FROM children;
DELETE FROM household_members;
DELETE FROM households;
DELETE FROM profiles;
-- Note: auth.users must be deleted from Supabase dashboard (Authentication > Users)

-- After cleanup, you start fresh with real accounts
