#!/usr/bin/env bun
/**
 * INHOST - Database Reset for Windows (no psql required)
 *
 * Ejecuta los scripts SQL en orden:
 * 1. DROP SCHEMA public CASCADE
 * 2. CREATE SCHEMA public
 * 3. create-multi-tenancy-tables.sql
 * 4. create-capabilities-tables.sql
 */

import { pool } from '../packages/shared/src/database/config';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function executeSQL(sqlContent: string, description: string) {
  console.log(`\n📝 ${description}...`);

  // Split by semicolon but keep function bodies intact
  const statements: string[] = [];
  let current = '';
  let dollarQuoteDepth = 0;

  for (const line of sqlContent.split('\n')) {
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('--') || trimmed.length === 0) {
      continue;
    }

    // Track $$ for function definitions
    const dollarCount = (line.match(/\$\$/g) || []).length;
    dollarQuoteDepth += dollarCount;

    current += line + '\n';

    // If we're not inside a function and line ends with ;
    if (dollarQuoteDepth % 2 === 0 && trimmed.endsWith(';')) {
      statements.push(current.trim());
      current = '';
    }
  }

  // Add last statement if any
  if (current.trim().length > 0) {
    statements.push(current.trim());
  }

  // Execute statements
  let successCount = 0;
  let errorCount = 0;

  for (const statement of statements) {
    if (statement.length === 0) continue;

    try {
      await pool.query(statement);
      successCount++;

      // Log important operations
      if (statement.includes('CREATE TABLE')) {
        const match = statement.match(/CREATE TABLE[^(]*?(\w+)/i);
        if (match) console.log(`  ✅ Table: ${match[1]}`);
      } else if (statement.includes('CREATE FUNCTION')) {
        const match = statement.match(/CREATE.*?FUNCTION\s+(\w+)/i);
        if (match) console.log(`  ✅ Function: ${match[1]}`);
      } else if (statement.includes('INSERT INTO tenants')) {
        console.log(`  ✅ Inserted test tenant`);
      }
    } catch (err: any) {
      errorCount++;
      // Only show errors that are not "already exists"
      if (!err.message.includes('already exists')) {
        console.log(`  ⚠️  ${err.message.split('\n')[0]}`);
      }
    }
  }

  console.log(`  Done: ${successCount} statements executed, ${errorCount} errors`);
}

async function main() {
  console.log('🚀 INHOST - Database Reset (Windows)\n');

  try {
    // 1. Test connection
    const version = await pool.query('SELECT version()');
    console.log('✅ PostgreSQL connected');
    console.log(`   ${version.rows[0].version.split('\n')[0]}`);

    // 2. Warning
    console.log('\n⚠️  WARNING: This will DELETE ALL DATA in the database!');
    console.log('   Press Ctrl+C to cancel, or wait 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. Reset database
    console.log('\n🔥 Dropping all tables...');
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query('GRANT ALL ON SCHEMA public TO inhost_user');
    await pool.query('GRANT ALL ON SCHEMA public TO public');
    console.log('✅ Database reset complete');

    // 4. Create multi-tenancy tables
    const multiTenancySQL = await readFile(
      join(process.cwd(), 'scripts', 'create-multi-tenancy-tables.sql'),
      'utf-8'
    );
    await executeSQL(multiTenancySQL, 'Creating multi-tenancy tables');

    // 5. Create capabilities tables
    const capabilitiesSQL = await readFile(
      join(process.cwd(), 'scripts', 'create-capabilities-tables.sql'),
      'utf-8'
    );
    await executeSQL(capabilitiesSQL, 'Creating capabilities tables');

    // 6. Verify tables
    console.log('\n📊 Verifying database...');
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\n✅ Database tables:');
    tables.rows.forEach((row: any) => console.log(`   - ${row.table_name}`));

    // 7. Check test data
    const tenantsCount = await pool.query('SELECT COUNT(*) FROM tenants');
    const usersCount = await pool.query('SELECT COUNT(*) FROM tenant_users');

    console.log('\n📈 Test data:');
    console.log(`   - Tenants: ${tenantsCount.rows[0].count}`);
    console.log(`   - Users: ${usersCount.rows[0].count}`);

    if (parseInt(tenantsCount.rows[0].count) > 0) {
      const tenants = await pool.query('SELECT name, slug, plan FROM tenants LIMIT 5');
      console.log('\n👥 Sample tenants:');
      tenants.rows.forEach((t: any) =>
        console.log(`   - ${t.name} (${t.slug}) - Plan: ${t.plan}`)
      );

      const users = await pool.query('SELECT email, name, role FROM tenant_users LIMIT 5');
      console.log('\n👤 Sample users:');
      users.rows.forEach((u: any) =>
        console.log(`   - ${u.email} (${u.name}) - Role: ${u.role}`)
      );
    }

    console.log('\n✅ Database setup complete!\n');
    console.log('🚀 Next steps:');
    console.log('   1. Start server: bun --cwd apps/api-gateway dev');
    console.log('   2. Login with a tenant user email from above');
    console.log('   3. Password needs to be set via signup or updated manually\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
