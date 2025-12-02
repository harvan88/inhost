/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "database/db.ts"
 *   type: "utility"
 *   layer: "frontend"
 *   domain: "database"
 *   purpose: "Handles db functionality"
 *
 * DEPENDENCIES:
 *   internal: ["./schema"]
 *   external: []
 *   infrastructure: ["PostgreSQL"]
 *
 * CONTRACTS:
 *   exports: ["db","pool"]
 *   inputs: "None"
 *   outputs: "Promise<boolean>"
 *   errors: "None"
 *
 * INTEGRATION:
 *   data_flow: "Request → Middleware → Handler → Response"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: ["./schema"]
 *   critical: false
 *
 * === DOC_END :: db.ts ===
 */

/**
 * Drizzle Database Client
 *
 * Cliente de base de datos PostgreSQL usando Drizzle ORM
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Crear pool de conexiones PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'inhost_user',
  password: process.env.DB_PASSWORD || 'inhost_password',
  database: process.env.DB_NAME || 'inhost',
  ssl: false, // Disable SSL for local development
  max: 20, // Máximo 20 conexiones en el pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Crear cliente Drizzle con el schema
export const db = drizzle(pool, { schema });

// Exportar el pool para casos de uso avanzados
export { pool };

// Health check de la base de datos
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
}

// Cerrar conexiones (útil para shutdown graceful)
export async function closeDatabaseConnections(): Promise<void> {
  await pool.end();
  console.log('✅ Database connections closed');
}
