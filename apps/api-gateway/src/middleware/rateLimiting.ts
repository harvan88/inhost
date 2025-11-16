/**
 * Rate Limiting Middleware
 *
 * Middleware de Elysia que implementa rate limiting para proteger la API.
 * Usa IRateLimiter para verificar límites por usuario y plan.
 *
 * Headers retornados:
 * - X-RateLimit-Limit: Límite total de requests por minuto
 * - X-RateLimit-Remaining: Requests restantes en la ventana actual
 * - X-RateLimit-Reset: Timestamp UNIX cuando se resetea el contador
 * - Retry-After: Segundos hasta que se puede reintentar (solo en 429)
 *
 * @module middleware/rateLimiting
 */

import { Elysia } from 'elysia';
import type { IRateLimiter, Plan } from '../core/interfaces';
import { logger } from './logger';

export interface RateLimitConfig {
  rateLimiter: IRateLimiter;
  getUserId: (request: Request) => string | undefined;
  getPlan: (userId: string) => Plan;
}

/**
 * Crear middleware de rate limiting
 *
 * @example
 * ```typescript
 * const rateLimiter = new MemoryRateLimiter();
 * rateLimiter.startCleanup();
 *
 * const app = new Elysia()
 *   .use(rateLimiting({
 *     rateLimiter,
 *     getUserId: (req) => req.headers.get('x-user-id') || 'anonymous',
 *     getPlan: (userId) => userId === 'anonymous' ? 'free' : 'premium'
 *   }))
 *   .post('/messages', async (ctx) => {
 *     // Esta ruta está protegida por rate limiting
 *   });
 * ```
 */
export function rateLimiting(config: RateLimitConfig) {
  return new Elysia()
    .derive(async ({ request, set }) => {
      // Obtener userId y plan
      const userId = config.getUserId(request) || 'anonymous';
      const plan = config.getPlan(userId);

      // Verificar límite
      const result = await config.rateLimiter.checkLimit(userId, plan);

      // Añadir headers de rate limit
      set.headers['X-RateLimit-Limit'] = result.limit.toString();
      set.headers['X-RateLimit-Remaining'] = result.remaining.toString();
      set.headers['X-RateLimit-Reset'] = Math.floor(result.resetAt.getTime() / 1000).toString();

      // Si no está permitido, retornar 429
      if (!result.allowed) {
        logger.warn('Rate limit exceeded', {
          userId,
          plan,
          limit: result.limit,
          retryAfter: result.retryAfter
        });

        set.status = 429;
        set.headers['Retry-After'] = (result.retryAfter || 60).toString();

        return {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          limit: result.limit,
          retryAfter: result.retryAfter,
          resetAt: result.resetAt.toISOString()
        };
      }

      // Registrar el request
      await config.rateLimiter.recordRequest(userId, plan);

      logger.debug('Rate limit check passed', {
        userId,
        plan,
        remaining: result.remaining,
        limit: result.limit
      });

      return {
        rateLimitInfo: result
      };
    });
}

/**
 * Crear middleware de rate limiting simple para WebSocket
 *
 * @example
 * ```typescript
 * const app = new Elysia()
 *   .ws('/realtime', {
 *     open(ws) {
 *       // Verificar rate limit al conectar
 *     }
 *   })
 *   .use(wsRateLimiting({ rateLimiter }));
 * ```
 */
export function wsRateLimiting(rateLimiter: IRateLimiter) {
  const connectionAttempts = new Map<string, { count: number; resetAt: Date }>();

  return {
    /**
     * Verificar rate limit para conexiones WebSocket
     */
    async checkWsConnection(userId: string, plan: Plan = 'free'): Promise<boolean> {
      // Límite de conexiones: 5 por minuto
      const now = new Date();
      const limit = 5;

      let attempts = connectionAttempts.get(userId);

      if (!attempts || now >= attempts.resetAt) {
        attempts = {
          count: 1,
          resetAt: new Date(now.getTime() + 60000)
        };
        connectionAttempts.set(userId, attempts);
        return true;
      }

      if (attempts.count >= limit) {
        logger.warn('WebSocket connection rate limit exceeded', { userId, plan, limit });
        return false;
      }

      attempts.count++;
      return true;
    },

    /**
     * Verificar rate limit para mensajes WebSocket
     */
    async checkWsMessage(userId: string, plan: Plan = 'free'): Promise<boolean> {
      const result = await rateLimiter.checkLimit(userId, plan);

      if (!result.allowed) {
        logger.warn('WebSocket message rate limit exceeded', {
          userId,
          plan,
          limit: result.limit
        });
        return false;
      }

      await rateLimiter.recordRequest(userId, plan);
      return true;
    }
  };
}
