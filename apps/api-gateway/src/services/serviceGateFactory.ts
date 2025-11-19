/**
 * Service Gate Factory
 *
 * Crea la instancia apropiada de ServiceGate basándose en disponibilidad:
 * - V2 (DatabaseServiceGate) si PostgreSQL está disponible
 * - V1 (CapabilityBasedServiceGate) como fallback
 *
 * @module services/serviceGateFactory
 */

import type { IServiceGate } from '../core/interfaces';
import { CapabilityBasedServiceGate } from '../implementations/v1';
import { DatabaseServiceGate } from '../implementations/v2';
import { logger } from '../middleware/logger';
import { pool } from '@inhost/shared';

/**
 * Verifica si PostgreSQL está disponible
 */
async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Crea ServiceGate con fallback automático
 */
export async function createServiceGate(): Promise<IServiceGate> {
  const dbAvailable = await checkDatabaseConnection();

  if (dbAvailable) {
    logger.info('✅ PostgreSQL available - using DatabaseServiceGate (V2)');
    return new DatabaseServiceGate();
  } else {
    logger.warn('⚠️  PostgreSQL not available - falling back to CapabilityBasedServiceGate (V1)');
    logger.warn('⚠️  Capabilities will be stored in memory and lost on restart');
    logger.warn('⚠️  To use V2, start PostgreSQL: bun run dev:db');
    return new CapabilityBasedServiceGate();
  }
}

/**
 * Crea ServiceGate de forma síncrona (para export)
 * Usa V2 por defecto, fallback a V1 si hay error
 */
export function createServiceGateSync(): IServiceGate {
  try {
    return new DatabaseServiceGate();
  } catch (error) {
    logger.warn('⚠️  Failed to initialize DatabaseServiceGate (V2), using V1 fallback');
    logger.warn('⚠️  Error:', error instanceof Error ? error.message : 'Unknown error');
    return new CapabilityBasedServiceGate();
  }
}
