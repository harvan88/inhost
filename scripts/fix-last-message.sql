-- Fix Last Message Fields
-- Updates the denormalized lastMessage fields in conversations table
-- This is safe to run multiple times (idempotent)

-- Update all conversations with their most recent message
UPDATE conversations c
SET
  last_message_id = m.id,
  last_message_text = (m.content->>'text'),
  last_message_type = m.type,
  last_message_at = m.created_at,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (conversation_id)
    id,
    conversation_id,
    content,
    type,
    created_at
  FROM messages
  ORDER BY conversation_id, created_at DESC
) m
WHERE c.id = m.conversation_id;

-- Verify the fix
SELECT
  c.id,
  c.channel,
  c.last_message_text,
  c.last_message_at,
  e.name as end_user_name
FROM conversations c
LEFT JOIN end_users e ON c.end_user_id = e.id
ORDER BY c.updated_at DESC
LIMIT 10;
