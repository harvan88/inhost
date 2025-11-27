/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/implementations/v1/MemoryRateLimiter.ts"
 *   type: "service"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Implementación V1 de IRateLimiter usando memoria (Map) para rate limiting por plan de usuario. Límites aumentados para desarrollo: free=100/min, premium=200/min, enterprise=500/min"
 *
 * DEPENDENCIES:
 *   internal: ["../../core/interfaces", "../../middleware/logger"]
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["MemoryRateLimiter"]
 *   inputs: ["string:userId", "Plan"]
 *   outputs: ["Promise<RateLimitResult>", "Promise<void>"]
 *   errors: []
 *
 * INTEGRATION:
 *   data_flow: "[HTTP Request] → [middleware/rateLimiting] → [checkLimit] → [Map lookup] → [allow/deny response]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["services/index.ts", "middleware/rateLimiting.ts"]
 *   uses: ["core/interfaces/IRateLimiter", "middleware/logger"]
 *   critical: true
 *
 * === DOC_END :: MemoryRateLimiter.ts ===
 */

/**
 * Memory Rate Limiter V1
 *
 * Implementación simple de rate limiting en memoria.
 * Usa un mapa para contar requests por usuario en ventanas de 1 minuto.
 *
 * Limitaciones V1:
 * - Solo funciona en un proceso (no distribuido)
 * - Los contadores se pierden al reiniciar
 * - No usa algoritmos avanzados (token bucket, sliding window)
 *
 * V2 mejorará:
 * - Redis para compartir entre procesos
 * - Sliding window para mayor precisión
 * - Burst allowance
 *
 * @module implementations/v1
 */

import type {
  IRateLimiter,
  Plan,
  RateLimitResult,
  RateLimiterConfig
} from '../../core/interfaces';
import { logger } from '../../middleware/logger';

interface UserLimit {
  count: number;
  resetAt: Date;
}

export class MemoryRateLimiter implements IRateLimiter {
  private limits: Map<string, UserLimit> = new Map();
  private config: RateLimiterConfig = {
    limits: {
      free: {
        messagesPerMinute: 100,  // Aumentado de 12 a 100 para desarrollo
        burstAllowance: 20
      },
      premium: {
        messagesPerMinute: 200,  // Aumentado de 30 a 200
        burstAllowance: 50
      },
      enterprise: {
        messagesPerMinute: 500,  // Aumentado de 100 a 500
        burstAllowance: 100
      }
    }
  };

  /**
   * Verificar si el usuario puede enviar un mensaje
   */
  async checkLimit(userId: string, plan: Plan): Promise<RateLimitResult> {
    const now = new Date();
    const limit = this.getLimitForPlan(plan);

    // Obtener o crear el límite del usuario
    let userLimit = this.limits.get(userId);

    // Si no existe o ya expiró, crear uno nuevo
    if (!userLimit || now >= userLimit.resetAt) {
      userLimit = {
        count: 0,
        resetAt: new Date(now.getTime() + 60000) // +1 minuto
      };
      this.limits.set(userId, userLimit);
    }

    const allowed = userLimit.count < limit;
    const remaining = Math.max(0, limit - userLimit.count);
    const retryAfter = allowed ? undefined : Math.ceil((userLimit.resetAt.getTime() - now.getTime()) / 1000);

    return {
      allowed,
      limit,
      remaining,
      resetAt: userLimit.resetAt,
      retryAfter
    };
  }

  /**
   * Registrar un request (incrementar contador)
   */
  async recordRequest(userId: string, plan: Plan): Promise<void> {
    const now = new Date();
    let userLimit = this.limits.get(userId);

    if (!userLimit || now >= userLimit.resetAt) {
      userLimit = {
        count: 1,
        resetAt: new Date(now.getTime() + 60000)
      };
      this.limits.set(userId, userLimit);
    } else {
      userLimit.count++;
    }

    logger.debug('Rate limit recorded', {
      userId,
      plan,
      count: userLimit.count,
      resetAt: userLimit.resetAt
    });
  }

  /**
   * Resetear el contador de un usuario
   */
  async reset(userId: string): Promise<void> {
    this.limits.delete(userId);
    logger.info('Rate limit reset', { userId });
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
    logger.info('Rate limiter configured', {
      free: config.limits.free.messagesPerMinute,
      premium: config.limits.premium.messagesPerMinute,
      enterprise: config.limits.enterprise.messagesPerMinute
    });
  }

  /**
   * Limpiar límites expirados (útil para no crecer indefinidamente)
   */
  cleanup(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [userId, userLimit] of this.limits.entries()) {
      if (now >= userLimit.resetAt) {
        this.limits.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Rate limiter cleanup', { cleaned, remaining: this.limits.size });
    }
  }

  /**
   * Iniciar limpieza periódica (cada 5 minutos)
   */
  startCleanup(): void {
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
    logger.info('Rate limiter cleanup started');
  }
}
