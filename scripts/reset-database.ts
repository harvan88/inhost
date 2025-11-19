#!/usr/bin/env bun
/**
 * Reset Database - Limpiar y recrear datos de prueba
 *
 * ⚠️ ADVERTENCIA: Esto BORRARÁ todos los datos existentes
 *
 * Uso:
 *   bun scripts/reset-database.ts
 */

import { db } from '@inhost/shared';
import { sql } from 'drizzle-orm';

async function resetDatabase() {
  console.log('⚠️  ADVERTENCIA: Esto borrará TODOS los datos de la base de datos');
  console.log('⏳ Iniciando en 3 segundos...\n');

  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    console.log('🗑️  Eliminando datos existentes...\n');

    // Orden correcto para evitar violaciones de FK
    console.log('   • Eliminando message_reads...');
    await db.execute(sql`TRUNCATE TABLE message_reads CASCADE`);

    console.log('   • Eliminando message_feedback...');
    await db.execute(sql`TRUNCATE TABLE message_feedback CASCADE`);

    console.log('   • Eliminando mentions...');
    await db.execute(sql`TRUNCATE TABLE mentions CASCADE`);

    console.log('   • Eliminando messages...');
    await db.execute(sql`TRUNCATE TABLE messages CASCADE`);

    console.log('   • Eliminando conversations...');
    await db.execute(sql`TRUNCATE TABLE conversations CASCADE`);

    console.log('   • Eliminando end_users...');
    await db.execute(sql`TRUNCATE TABLE end_users CASCADE`);

    console.log('   • Eliminando admin_users...');
    await db.execute(sql`TRUNCATE TABLE admin_users CASCADE`);

    console.log('   • Eliminando tenants...');
    await db.execute(sql`TRUNCATE TABLE tenants CASCADE`);

    console.log('\n✅ Base de datos limpiada completamente');
    console.log('\n🌱 Ahora ejecuta: bun scripts/seed-database.ts');

  } catch (error) {
    console.error('\n❌ Error durante el reset:', error);
    throw error;
  }
}

// Ejecutar reset
resetDatabase()
  .then(() => {
    console.log('✅ Reset completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
