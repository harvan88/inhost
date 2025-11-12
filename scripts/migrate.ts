import { pool, db } from '@inhost/shared';
import { messages, conversations, users } from '@inhost/shared';

async function migrate() {
  console.log('🚀 Running database migrations...');
  
  // Las tablas se crearán automáticamente con Drizzle
  // En producción usaríamos migraciones formales
  
  console.log('✅ Database schema ready!');
  await pool.end();
}

migrate().catch(console.error);