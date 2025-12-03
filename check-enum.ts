import { pool } from '@inhost/shared';

async function checkEnum() {
  console.log('🔍 Checking message_enrichments type enum...');
  
  try {
    // Verificar si hay un constraint CHECK para el enum
    const result = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as consrc 
      FROM pg_constraint 
      WHERE conrelid = 'message_enrichments'::regclass 
      AND contype = 'c';
    `);
    
    console.log('📊 Constraints on message_enrichments:');
    result.rows.forEach(row => {
      console.log(`   - ${row.conname}: ${row.consrc}`);
    });
    
    // Verificar valores existentes en la tabla
    const valuesResult = await pool.query(`
      SELECT DISTINCT type FROM message_enrichments;
    `);
    
    console.log('\n📊 Current type values in table:');
    valuesResult.rows.forEach(row => {
      console.log(`   - ${row.type}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking enum:', error);
  } finally {
    await pool.end();
  }
}

checkEnum().catch(console.error);
