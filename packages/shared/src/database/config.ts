/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "database/config.ts"
 *   type: "config"
 *   layer: "frontend"
 *   domain: "database"
 *   purpose: "Handles config functionality"
 *
 * DEPENDENCIES:
 *   internal: []
 *   external: []
 *   infrastructure: ["PostgreSQL"]
 *
 * CONTRACTS:
 *   exports: ["db","pool"]
 *   inputs: "None"
 *   outputs: "void"
 *   errors: "None"
 *
 * INTEGRATION:
 *   data_flow: "Input → Processing → Output"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: []
 *   critical: false
 *
 * === DOC_END :: config.ts ===
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Configuración de conexión PostgreSQL
export const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'inhost_user',
  password: 'inhost_password',
  database: 'inhost',
});

export const db = drizzle(pool);