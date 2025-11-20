#!/usr/bin/env bun
/**
 * Fix Last Message Fields
 *
 * Updates the denormalized lastMessage fields in conversations table
 * based on existing messages. This script is idempotent and safe to run multiple times.
 *
 * Usage:
 *   bun scripts/fix-last-message.ts
 */

import { pool } from '@inhost/shared';

async function fixLastMessageFields() {
  console.log('🔧 Fixing lastMessage fields in conversations...\n');

  try {
    // Update all conversations with their most recent message
    const result = await pool.query(`
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
      WHERE c.id = m.conversation_id
      RETURNING c.id, c.last_message_text, c.last_message_at;
    `);

    console.log(`✅ Updated ${result.rowCount} conversations\n`);

    // Verify the fix
    console.log('📊 Verification:');
    const verification = await pool.query(`
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
    `);

    console.log('\nConversations after fix:');
    console.log('='.repeat(80));
    verification.rows.forEach((row: any) => {
      console.log(`${row.end_user_name} (${row.channel})`);
      console.log(`  Last message: ${row.last_message_text || 'NULL'}`);
      console.log(`  Last message at: ${row.last_message_at || 'NULL'}\n`);
    });

    console.log('✅ Fix completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Error fixing lastMessage fields:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Execute fix
fixLastMessageFields()
  .then(() => {
    console.log('✅ Process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
