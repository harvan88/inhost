#!/usr/bin/env bun
/**
 * INHOST - Simple Database Reset (Windows compatible)
 */

import { pool } from '../packages/shared/src/database/config';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function main() {
  console.log('🚀 INHOST - Database Reset & Setup\n');

  try {
    // 1. Test connection
    const version = await pool.query('SELECT version()');
    console.log('✅ PostgreSQL connected');
    console.log('');

    // 2. Reset database
    console.log('⚠️  WARNING: This will DELETE ALL DATA!');
    console.log('   Press Ctrl+C to cancel, or wait 3 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('🔥 Resetting database...');
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query('GRANT ALL ON SCHEMA public TO inhost_user');
    await pool.query('GRANT ALL ON SCHEMA public TO public');
    console.log('✅ Database reset complete\n');

    // 3. Read SQL file
    console.log('📋 Creating tables...');
    const sqlPath = join(process.cwd(), 'scripts', 'create-multi-tenancy-tables.sql');
    let sql = await readFile(sqlPath, 'utf-8');

    // Remove comments
    sql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    // Execute the entire SQL at once
    await pool.query(sql);
    console.log('✅ Tables created\n');

    // 4. Verify
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `);

    console.log('📊 Database tables:');
    tables.rows.forEach((row: any) => console.log(`  ✅ ${row.table_name}`));
    console.log('');

    // 5. Check test data
    const tenantsCount = await pool.query('SELECT COUNT(*) FROM tenants');
    const usersCount = await pool.query('SELECT COUNT(*) FROM tenant_users');

    console.log('📈 Test data:');
    console.log(`  - Tenants: ${tenantsCount.rows[0].count}`);
    console.log(`  - Users: ${usersCount.rows[0].count}\n`);

    if (parseInt(tenantsCount.rows[0].count) > 0) {
      const tenants = await pool.query('SELECT name, slug, plan FROM tenants');
      console.log('👥 Tenants:');
      tenants.rows.forEach((t: any) => console.log(`  - ${t.name} (${t.slug}) - ${t.plan}`));
      console.log('');

      const users = await pool.query('SELECT email, role FROM tenant_users');
      console.log('👤 Users:');
      users.rows.forEach((u: any) => console.log(`  - ${u.email} (${u.role})`));
      console.log('');
    }

    console.log('✅ Database setup complete!\n');
    console.log('🚀 Next steps:');
    console.log('   1. Start server: bun --cwd apps/api-gateway dev');
    console.log('   2. Test login with tenant user email\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
