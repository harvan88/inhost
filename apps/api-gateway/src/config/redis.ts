/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\config\redis.ts"
 *   type: "config"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Handles redis functionality"
 *
 * DEPENDENCIES:
 *   internal: ["../middleware/logger"]
 *   external: ["ioredis"]
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["RATE_LIMIT_BACKEND","getRedisClient","shouldUseRedis"]
 *   inputs: "None"
 *   outputs: "Redis"
 *   errors: "None"
 *
 * INTEGRATION:
 *   data_flow: "Request → Middleware → Handler → Response"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: ["../middleware/logger","ioredis"]
 *   critical: false
 *
 * === DOC_END :: redis.ts ===
 */

/**
 * Redis Configuration (Sprint 4)
 *
 * Configuración centralizada de Redis para toda la aplicación.
 * Usa ioredis con opciones optimizadas para Bun.
 */

import Redis from 'ioredis';
import { logger } from '../middleware/logger';

/**
 * Redis client singleton
 */
let redisClient: Redis | null = null;

/**
 * Configuración de Redis desde environment variables
 */
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
};

/**
 * Obtener instancia de Redis (singleton)
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_CONFIG);

    redisClient.on('connect', () => {
      logger.info('🔴 Redis client connecting...');
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis client ready', {
        host: REDIS_CONFIG.host,
        port: REDIS_CONFIG.port,
        db: REDIS_CONFIG.db
      });
    });

    redisClient.on('error', (error) => {
      logger.error('❌ Redis client error', {
        error: error.message
      });
    });

    redisClient.on('close', () => {
      logger.warn('⚠️  Redis client closed');
    });

    redisClient.on('reconnecting', () => {
      logger.info('🔄 Redis client reconnecting...');
    });
  }

  return redisClient;
}

/**
 * Verificar conexión a Redis
 */
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch (error) {
    logger.error('Redis connection check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Cerrar conexión a Redis (para shutdown graceful)
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

/**
 * Backend selector: memory o redis
 */
export const RATE_LIMIT_BACKEND = process.env.RATE_LIMIT_BACKEND || 'memory';

export function shouldUseRedis(): boolean {
  return RATE_LIMIT_BACKEND === 'redis';
}
