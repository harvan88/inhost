import { pool } from '@inhost/shared';

async function checkTables() {
  console.log('🔍 Checking database tables...');
  
  try {
    const result = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name IN ('tenants', 'end_users', 'message_enrichments', 'conversations', 'messages')
      ORDER BY table_name, ordinal_position;
    `);
    
    console.log('📊 Tables and columns:');
    let currentTable = '';
    result.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        currentTable = row.table_name;
        console.log(`\n📋 ${currentTable}:`);
      }
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking tables:', error);
  } finally {
    await pool.end();
  }
}

checkTables().catch(console.error);
