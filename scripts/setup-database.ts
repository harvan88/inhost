/**
 * Database Setup Script
 *
 * Verifica conexión a PostgreSQL y crea tablas si no existen.
 * Ejecutar: bun run scripts/setup-database.ts
 */

import { pool } from '@inhost/shared';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function checkConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT version()');
    console.log('✅ PostgreSQL connected:', result.rows[0].version);
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function checkTablesExist(): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('messages', 'conversations', 'users', 'user_capabilities', 'service_usage', 'capability_templates')
      ORDER BY table_name
    `);

    const tables = result.rows.map(row => row.table_name);
    console.log('\n📋 Existing tables:', tables.join(', ') || 'none');

    const requiredTables = ['messages', 'conversations', 'users', 'user_capabilities', 'service_usage', 'capability_templates'];
    const missingTables = requiredTables.filter(t => !tables.includes(t));

    if (missingTables.length > 0) {
      console.log('⚠️  Missing tables:', missingTables.join(', '));
      return false;
    }

    console.log('✅ All required tables exist');
    return true;
  } catch (error) {
    console.error('❌ Error checking tables:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function createTables(): Promise<void> {
  console.log('\n🔨 Creating database tables...');

  try {
    // Leer SQL files
    const basePath = join(process.cwd(), 'scripts');
    const createTablesSQL = await readFile(join(basePath, 'create-tables.sql'), 'utf-8');
    const createCapabilitiesSQL = await readFile(join(basePath, 'create-capabilities-tables.sql'), 'utf-8');

    // Ejecutar SQL para crear tablas básicas
    console.log('  → Creating base tables (messages, conversations, users)...');
    await pool.query(createTablesSQL);

    // Ejecutar SQL para crear tablas de capacidades
    console.log('  → Creating capabilities tables (user_capabilities, service_usage, templates)...');
    await pool.query(createCapabilitiesSQL);

    console.log('✅ Tables created successfully');
  } catch (error) {
    console.error('❌ Error creating tables:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

async function verifyTemplates(): Promise<void> {
  try {
    const result = await pool.query('SELECT name, description FROM capability_templates ORDER BY name');

    console.log('\n📦 Capability Templates:');
    for (const row of result.rows) {
      console.log(`  • ${row.name}: ${row.description}`);
    }
  } catch (error) {
    console.log('⚠️  Templates not yet created (will be created when tables are set up)');
  }
}

async function main() {
  console.log('🚀 INHOST Database Setup\n');

  // 1. Verificar conexión
  const connected = await checkConnection();
  if (!connected) {
    console.log('\n❌ Cannot proceed without database connection.');
    console.log('💡 Make sure PostgreSQL is running:');
    console.log('   bun run dev:db');
    process.exit(1);
  }

  // 2. Verificar tablas
  const tablesExist = await checkTablesExist();

  if (!tablesExist) {
    console.log('\n❓ Some tables are missing. Create them? (y/n)');

    // En modo no-interactivo, crear automáticamente
    if (process.env.CI || process.env.AUTO_CREATE_TABLES === 'true') {
      await createTables();
    } else {
      console.log('💡 Run with AUTO_CREATE_TABLES=true to auto-create tables');
      console.log('   AUTO_CREATE_TABLES=true bun run scripts/setup-database.ts');
    }
  }

  // 3. Verificar templates
  await verifyTemplates();

  // 4. Cerrar pool
  await pool.end();

  console.log('\n✅ Database setup complete!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
