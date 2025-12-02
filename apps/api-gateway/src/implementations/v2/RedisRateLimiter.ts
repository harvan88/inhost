/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\implementations\v2\RedisRateLimiter.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Handles redis rate limiter functionality"
 *
 * DEPENDENCIES:
 *   internal: ["../../config/redis","../../middleware/logger"]
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["RedisRateLimiter"]
 *   inputs: "None"
 *   outputs: "Promise<RateLimitResult>"
 *   errors: "None"
 *
 * INTEGRATION:
 *   data_flow: "Request → Middleware → Handler → Response"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: ["../../config/redis","../../middleware/logger"]
 *   critical: false
 *
 * === DOC_END :: RedisRateLimiter.ts ===
 */

/**
 * Redis Rate Limiter V2 (Sprint 4)
 *
 * Implementación de rate limiting con Redis usando operaciones atómicas.
 * Resuelve las race conditions del MemoryRateLimiter V1.
 *
 * Ventajas V2:
 * - ✅ Operaciones atómicas (INCR) - no race conditions
 * - ✅ Compartido entre múltiples instancias/servidores
 * - ✅ TTL automático (no necesita cleanup)
 * - ✅ Distribuido - listo para clustering
 *
 * @module implementations/v2
 */

import type {
  IRateLimiter,
  Plan,
  RateLimitResult,
  RateLimiterConfig
} from '../../core/interfaces';
import { getRedisClient } from '../../config/redis';
import { logger } from '../../middleware/logger';

export class RedisRateLimiter implements IRateLimiter {
  private config: RateLimiterConfig = {
    limits: {
      free: {
        messagesPerMinute: 12,
        burstAllowance: 5
      },
      premium: {
        messagesPerMinute: 30,
        burstAllowance: 10
      },
      enterprise: {
        messagesPerMinute: 100,
        burstAllowance: 20
      }
    }
  };

  private redis = getRedisClient();

  /**
   * Verificar si el usuario puede enviar un mensaje
   * Usa INCR (atómico) - resuelve race conditions
   */
  async checkLimit(userId: string, plan: Plan): Promise<RateLimitResult> {
    const now = Date.now();
    const limit = this.getLimitForPlan(plan);
    const key = this.getKey(userId);

    try {
      // INCR es atómico - no hay race condition posible
      const count = await this.redis.incr(key);

      // Si es el primer request, setear TTL de 60 segundos
      if (count === 1) {
        await this.redis.expire(key, 60);
      }

      // Obtener TTL restante para resetAt
      const ttl = await this.redis.ttl(key);
      const resetAt = new Date(now + ttl * 1000);

      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);
      const retryAfter = allowed ? undefined : ttl;

      logger.debug('🔴 Redis rate limit check', {
        userId,
        plan,
        count,
        limit,
        allowed,
        remaining,
        ttl
      });

      return {
        allowed,
        limit,
        remaining,
        resetAt,
        retryAfter
      };
    } catch (error) {
      logger.error('❌ Redis rate limiter error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        plan
      });

      // Fallback: permitir en caso de error Redis
      return {
        allowed: true,
        limit,
        remaining: limit,
        resetAt: new Date(now + 60000)
      };
    }
  }

  /**
   * Registrar un request
   * NO NECESARIO en V2 - el INCR en checkLimit ya lo hace
   */
  async recordRequest(userId: string, plan: Plan): Promise<void> {
    // NO-OP en Redis: INCR en checkLimit() ya incrementó el contador
    logger.debug('🔴 Redis rate limit record (no-op)', {
      userId,
      plan,
      note: 'INCR already done in checkLimit()'
    });
  }

  /**
   * Resetear el contador de un usuario
   */
  async reset(userId: string): Promise<void> {
    const key = this.getKey(userId);

    try {
      await this.redis.del(key);
      logger.info('🔴 Redis rate limit reset', { userId, key });
    } catch (error) {
      logger.error('❌ Redis rate limiter reset error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
    }
  }

  /**
   * Obtener el límite configurado para un plan
   */
  getLimitForPlan(plan: Plan): number {
    return this.config.limits[plan].messagesPerMinute;
  }

  /**
   * Configurar los límites
   */
  configure(config: RateLimiterConfig): void {
    this.config = config;
    logger.info('🔴 Redis rate limiter configured', {
      free: config.limits.free.messagesPerMinute,
      premium: config.limits.premium.messagesPerMinute,
      enterprise: config.limits.enterprise.messagesPerMinute
    });
  }

  /**
   * Obtener key de Redis para el usuario
   */
  private getKey(userId: string): string {
    // Formato: rate:userId:minute:timestamp-en-minutos
    // El timestamp cambia cada minuto, permitiendo ventanas deslizantes
    const minuteTimestamp = Math.floor(Date.now() / 60000);
    return `rate:${userId}:${minuteTimestamp}`;
  }

  /**
   * Limpiar límites expirados
   * NO NECESARIO en V2 - Redis TTL lo hace automáticamente
   */
  cleanup(): void {
    // NO-OP en Redis: TTL automático
    logger.debug('🔴 Redis rate limiter cleanup (no-op)', {
      note: 'Redis TTL handles expiration automatically'
    });
  }

  /**
   * Iniciar limpieza periódica
   * NO NECESARIO en V2 - Redis TTL lo hace automáticamente
   */
  startCleanup(): void {
    // NO-OP en Redis: TTL automático
    logger.info('🔴 Redis rate limiter cleanup not needed', {
      note: 'Redis TTL handles expiration automatically'
    });
  }

  /**
   * Obtener estadísticas de Redis (útil para debugging)
   */
  async getStats(): Promise<{
    totalKeys: number;
    users: string[];
  }> {
    try {
      const keys = await this.redis.keys('rate:*');
      const users = [...new Set(keys.map(k => k.split(':')[1]))];

      return {
        totalKeys: keys.length,
        users
      };
    } catch (error) {
      logger.error('❌ Redis rate limiter stats error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        totalKeys: 0,
        users: []
      };
    }
  }
}
