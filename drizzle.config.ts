import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './packages/shared/src/database/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'inhost_user',
    password: process.env.DB_PASSWORD || 'inhost_password',
    database: process.env.DB_NAME || 'inhost',
    ssl: false,
  },
  verbose: true,
  strict: true,
});
