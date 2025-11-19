#!/usr/bin/env bun
/**
 * INHOST - Reset Database and Setup Multi-Tenancy
 *
 * Este script:
 * 1. ELIMINA todas las tablas existentes (DROP SCHEMA public CASCADE)
 * 2. Crea el esquema desde cero
 * 3. Ejecuta los scripts SQL de multi-tenancy
 */

import { pool } from '../packages/shared/src/database/config';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function main() {
  console.log('🚀 INHOST - Database Reset & Setup\n');

  try {
    // 1. Test connection
    const version = await pool.query('SELECT version()');
    console.log('✅ PostgreSQL connected:', version.rows[0].version.split('\n')[0]);
    console.log('');

    // 2. Reset database (DROP all tables)
    console.log('⚠️  WARNING: This will DELETE ALL DATA in the database!');
    console.log('   Press Ctrl+C to cancel, or wait 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n🔥 Dropping all tables...');
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query('GRANT ALL ON SCHEMA public TO inhost_user');
    await pool.query('GRANT ALL ON SCHEMA public TO public');
    console.log('✅ Database reset complete');
    console.log('');

    // 3. Read and execute multi-tenancy SQL script
    console.log('📋 Creating multi-tenancy tables...');
    const sqlPath = join(process.cwd(), 'scripts', 'create-multi-tenancy-tables.sql');
    const sql = await readFile(sqlPath, 'utf-8');

    // Split by statement and execute (skip comments and empty lines)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));

    let successCount = 0;
    for (const statement of statements) {
      try {
        if (statement.includes('CREATE') || statement.includes('INSERT') || statement.includes('SELECT apply_')) {
          await pool.query(statement);
          successCount++;

          // Log major operations
          if (statement.includes('CREATE TABLE')) {
            const match = statement.match(/CREATE TABLE[^(]*(\w+)/i);
            if (match) console.log(`  ✅ Table: ${match[1]}`);
          }
        }
      } catch (err: any) {
        // Ignore "already exists" errors
        if (!err.message.includes('already exists')) {
          console.log(`  ⚠️  Warning: ${err.message.split('\n')[0]}`);
        }
      }
    }

    console.log(`\n✅ Created ${successCount} database objects`);
    console.log('');

    // 4. Verify tables
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📊 Database tables:');
    tables.rows.forEach((row: any) => console.log(`  - ${row.table_name}`));
    console.log('');

    // 5. Check for test data
    const tenantsCount = await pool.query('SELECT COUNT(*) FROM tenants');
    const usersCount = await pool.query('SELECT COUNT(*) FROM tenant_users');

    console.log('📈 Test data:');
    console.log(`  - Tenants: ${tenantsCount.rows[0].count}`);
    console.log(`  - Users: ${usersCount.rows[0].count}`);
    console.log('');

    if (parseInt(tenantsCount.rows[0].count) > 0) {
      const tenants = await pool.query('SELECT name, slug, plan FROM tenants LIMIT 3');
      console.log('👥 Sample tenants:');
      tenants.rows.forEach((t: any) => console.log(`  - ${t.name} (${t.slug}) - ${t.plan}`));
      console.log('');
    }

    console.log('✅ Database setup complete!');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('   1. Start the server: bun --cwd apps/api-gateway dev');
    console.log('   2. Test login with: admin@tiendaxyz.com');
    console.log('   3. Check /admin/sync/initial endpoint');
    console.log('');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
