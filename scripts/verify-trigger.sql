-- Verify Database Trigger
-- Checks if the lastMessage trigger is properly installed

-- Check if trigger exists
SELECT
  trigger_name,
  event_object_table,
  action_statement,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_conversation_last_message';

-- Check if function exists
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_name = 'update_conversation_last_message';
