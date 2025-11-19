/**
 * Rate Limiting Middleware V2
 *
 * Versión mejorada que usa IServiceGate en lugar de planes hardcodeados.
 * Sistema flexible basado en capacidades por usuario.
 *
 * Ventajas sobre V1:
 * - No depende de planes (free/premium/enterprise)
 * - Configuración granular por usuario
 * - Fácil A/B testing y feature flags
 * - Extensible para diferentes servicios
 *
 * @module middleware/rateLimitingV2
 */

import { Elysia } from 'elysia';
import type { IServiceGate, ServiceId } from '../core/interfaces';
import { logger } from './logger';

export interface RateLimitConfigV2 {
  serviceGate: IServiceGate;
  getUserId: (request: Request) => string | undefined;
  service?: ServiceId; // Por defecto 'rate-limiting'
}

/**
 * Crear middleware de rate limiting basado en capacidades
 *
 * @example
 * ```typescript
 * const serviceGate = new CapabilityBasedServiceGate();
 *
 * const app = new Elysia()
 *   .use(rateLimitingV2({
 *     serviceGate,
 *     getUserId: (req) => req.headers.get('x-user-id') || 'anonymous'
 *   }))
 *   .post('/messages', async (ctx) => {
 *     // Ruta protegida por rate limiting
 *   });
 * ```
 */
export function rateLimitingV2(config: RateLimitConfigV2) {
  const service: ServiceId = config.service || 'rate-limiting';

  return new Elysia()
    .onRequest(async ({ request, set }) => {
      const userId = config.getUserId(request) || 'anonymous';

      // Verificar si el usuario puede usar el servicio
      const result = await config.serviceGate.canUseService(userId, service);

      // Añadir headers informativos SIEMPRE
      if (result.metadata?.limit) {
        set.headers['X-RateLimit-Limit'] = result.metadata.limit.toString();
      }

      if (result.metadata?.remaining !== undefined) {
        set.headers['X-RateLimit-Remaining'] = result.metadata.remaining.toString();
      }

      if (result.metadata?.resetAt) {
        set.headers['X-RateLimit-Reset'] = Math.floor(result.metadata.resetAt.getTime() / 1000).toString();
      }

      // Si no está permitido, retornar 429
      if (!result.allowed) {
        logger.warn('Rate limit exceeded (V2)', {
          userId,
          service,
          reason: result.reason,
          metadata: result.metadata
        });

        set.status = 429;

        const retryAfter = result.metadata?.resetAt
          ? Math.ceil((result.metadata.resetAt.getTime() - Date.now()) / 1000)
          : 60;

        set.headers['Retry-After'] = retryAfter.toString();

        return {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: result.reason || 'Rate limit exceeded',
            service,
            limit: result.metadata?.limit,
            currentUsage: result.metadata?.currentUsage,
            retryAfter,
            resetAt: result.metadata?.resetAt?.toISOString(),
            timestamp: new Date().toISOString()
          }
        };
      }

      // Registrar uso del servicio
      await config.serviceGate.recordServiceUsage(userId, service);

      logger.debug('Rate limit check passed (V2)', {
        userId,
        service,
        remaining: result.metadata?.remaining,
        limit: result.metadata?.limit
      });
    });
}

/**
 * Middleware de rate limiting para WebSocket (V2)
 */
export function wsRateLimitingV2(serviceGate: IServiceGate) {
  return {
    /**
     * Verificar rate limit para mensajes WebSocket
     */
    async checkWsMessage(userId: string, service: ServiceId = 'websocket'): Promise<{
      allowed: boolean;
      reason?: string;
      retryAfter?: number;
    }> {
      const result = await serviceGate.canUseService(userId, service);

      if (!result.allowed) {
        logger.warn('WebSocket message rate limit exceeded (V2)', {
          userId,
          service,
          reason: result.reason
        });

        const retryAfter = result.metadata?.resetAt
          ? Math.ceil((result.metadata.resetAt.getTime() - Date.now()) / 1000)
          : 60;

        return {
          allowed: false,
          reason: result.reason,
          retryAfter
        };
      }

      // Registrar uso
      await serviceGate.recordServiceUsage(userId, service);

      return { allowed: true };
    }
  };
}
