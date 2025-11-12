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