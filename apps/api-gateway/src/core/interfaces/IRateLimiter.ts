/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\core\interfaces\IRateLimiter.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Handles i rate limiter functionality"
 *
 * DEPENDENCIES:
 *   internal: []
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["IRateLimiter","Plan","RateLimitResult","RateLimiterConfig"]
 *   inputs: "None"
 *   outputs: "Promise<RateLimitResult>"
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
 * === DOC_END :: IRateLimiter.ts ===
 */

/**
 * Plan del usuario (determina límites)
 */
export type Plan = 'free' | 'premium' | 'enterprise';

/**
 * Resultado de la verificación de límite
 */
export interface RateLimitResult {
  allowed: boolean;              // ¿Se permite el request?
  limit: number;                 // Límite configurado
  remaining: number;             // Requests restantes en la ventana actual
  resetAt: Date;                 // Cuándo se resetea el contador
  retryAfter?: number;           // Segundos hasta que se puede reintentar (si blocked)
}

/**
 * Configuración de rate limiting
 */
export interface RateLimiterConfig {
  limits: {
    free: {
      messagesPerMinute: number;
      burstAllowance?: number;
    };
    premium: {
      messagesPerMinute: number;
      burstAllowance?: number;
    };
    enterprise: {
      messagesPerMinute: number;
      burstAllowance?: number;
    };
  };
}

/**
 * Interface para Rate Limiting
 *
 * Esta interface define el contrato para controlar la tasa de mensajes por usuario.
 * Las implementaciones pueden variar en complejidad:
 * - V1: Contador simple en memoria
 * - V2: Redis con ventana deslizante
 * - V3: Algoritmo token bucket con burst allowance
 *
 * @example
 * ```typescript
 * // V1: Simple en memoria
 * class MemoryRateLimiter implements IRateLimiter {
 *   async checkLimit(userId: string, plan: Plan): Promise<RateLimitResult> {
 *     const count = this.counts.get(userId) || 0;
 *     const limit = this.getLimitForPlan(plan);
 *     return {
 *       allowed: count < limit,
 *       limit,
 *       remaining: Math.max(0, limit - count),
 *       resetAt: new Date(Date.now() + 60000)
 *     };
 *   }
 * }
 *
 * // V2: Redis persistente
 * class RedisRateLimiter implements IRateLimiter {
 *   async checkLimit(userId: string, plan: Plan): Promise<RateLimitResult> {
 *     const key = `rate:${userId}:minute`;
 *     const count = await redis.incr(key);
 *     if (count === 1) await redis.expire(key, 60);
 *     // ...
 *   }
 * }
 * ```
 */
export interface IRateLimiter {
  /**
   * Verificar si el usuario puede enviar un mensaje
   *
   * @param userId - ID del usuario
   * @param plan - Plan del usuario (free, premium, enterprise)
   * @returns Resultado con información del límite
   */
  checkLimit(userId: string, plan: Plan): Promise<RateLimitResult>;

  /**
   * Registrar un request (incrementar contador)
   *
   * @param userId - ID del usuario
   * @param plan - Plan del usuario
   */
  recordRequest(userId: string, plan: Plan): Promise<void>;

  /**
   * Resetear el contador de un usuario (útil para testing o admin)
   *
   * @param userId - ID del usuario
   */
  reset(userId: string): Promise<void>;

  /**
   * Obtener el límite configurado para un plan
   *
   * @param plan - Plan del usuario
   * @returns Mensajes permitidos por minuto
   */
  getLimitForPlan(plan: Plan): number;

  /**
   * Configurar los límites
   *
   * @param config - Configuración de límites
   */
  configure(config: RateLimiterConfig): void;
}
