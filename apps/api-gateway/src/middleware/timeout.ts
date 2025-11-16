/**
 * Timeout Protection Middleware
 *
 * Middleware que implementa:
 * 1. Timeouts para operaciones lentas
 * 2. Circuit Breaker para proteger contra fallos en cascada
 * 3. Fallback responses cuando las operaciones fallan
 *
 * Circuit Breaker States:
 * - CLOSED: Normal, todas las requests pasan
 * - OPEN: Bloqueado, todas las requests fallan inmediatamente
 * - HALF_OPEN: Probando, algunas requests pasan para verificar recuperación
 *
 * @module middleware/timeout
 */

import { Elysia } from 'elysia';
import { logger } from './logger';

export interface TimeoutConfig {
  timeout: number;                   // Timeout en ms (default: 5000)
  circuitBreakerThreshold?: number;  // Fallos antes de abrir circuito (default: 5)
  circuitBreakerResetTime?: number;  // Tiempo antes de intentar cerrar (default: 30000)
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

/**
 * Circuit Breaker simple para proteger contra fallos en cascada
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;

  constructor(
    private threshold: number = 5,
    private resetTime: number = 30000
  ) {}

  /**
   * Verificar si el circuito permite la operación
   */
  canExecute(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Verificar si es tiempo de probar recuperación
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;

      if (timeSinceLastFailure >= this.resetTime) {
        logger.info('Circuit breaker entering HALF_OPEN state');
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        return true;
      }

      return false;
    }

    // HALF_OPEN: permitir algunas requests
    return true;
  }

  /**
   * Registrar éxito de operación
   */
  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      // Si hay 3 éxitos consecutivos, cerrar el circuito
      if (this.successCount >= 3) {
        logger.info('Circuit breaker closing after successful recovery');
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset counter on success
      this.failureCount = 0;
    }
  }

  /**
   * Registrar fallo de operación
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      logger.warn('Circuit breaker re-opening after failure in HALF_OPEN state');
      this.state = CircuitState.OPEN;
      return;
    }

    if (this.failureCount >= this.threshold) {
      logger.error('Circuit breaker OPEN after threshold reached', {
        failures: this.failureCount,
        threshold: this.threshold
      });
      this.state = CircuitState.OPEN;
    }
  }

  /**
   * Obtener estado actual
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset manual (útil para testing)
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

/**
 * Ejecutar función con timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
}

/**
 * Middleware de timeout para operaciones
 */
export function timeoutProtection(config: TimeoutConfig = { timeout: 5000 }) {
  const circuitBreaker = new CircuitBreaker(
    config.circuitBreakerThreshold,
    config.circuitBreakerResetTime
  );

  return new Elysia()
    // Siempre inyectar withProtection en el contexto
    .derive(() => {
      logger.info('🔧 Timeout middleware: injecting withProtection');
      return {
        circuitBreaker,
        timeout: config.timeout,
        /**
         * Ejecutar operación con timeout y circuit breaker
         */
        async withProtection<T>(
          operation: () => Promise<T>,
          fallback?: T
        ): Promise<T> {
          try {
            const result = await withTimeout(
              operation,
              config.timeout,
              `Operation exceeded ${config.timeout}ms timeout`
            );

            circuitBreaker.recordSuccess();
            return result;
          } catch (error: any) {
            circuitBreaker.recordFailure();

            logger.error('Protected operation failed', {
              error: error.message,
              circuitState: circuitBreaker.getState()
            });

            if (fallback !== undefined) {
              logger.info('Using fallback value after operation failure');
              return fallback;
            }

            throw error;
          }
        }
      };
    })
    // Verificar circuit breaker ANTES de procesar la request
    .onBeforeHandle(({ set }) => {
      if (!circuitBreaker.canExecute()) {
        logger.warn('Request blocked by circuit breaker', {
          state: circuitBreaker.getState()
        });

        set.status = 503;
        return {
          success: false,
          error: {
            code: 'CIRCUIT_BREAKER_OPEN',
            message: 'Service temporarily unavailable',
            retryAfter: Math.ceil(config.circuitBreakerResetTime! / 1000) || 30,
            timestamp: new Date().toISOString()
          }
        };
      }
    });
}

/**
 * Middleware de timeout simple (sin circuit breaker)
 */
export function simpleTimeout(timeoutMs: number = 5000) {
  return new Elysia()
    .derive(() => ({
      /**
       * Ejecutar operación con timeout
       */
      async withTimeout<T>(
        operation: () => Promise<T>,
        customTimeout?: number
      ): Promise<T> {
        const timeout = customTimeout || timeoutMs;

        return withTimeout(
          operation,
          timeout,
          `Operation exceeded ${timeout}ms timeout`
        );
      }
    }));
}

/**
 * Wrapper para adapters con timeout
 *
 * @example
 * ```typescript
 * const protectedAdapter = withAdapterTimeout(whatsappAdapter, 5000);
 *
 * try {
 *   const result = await protectedAdapter.sendMessage(envelope);
 * } catch (error) {
 *   // Timeout o error del adapter
 * }
 * ```
 */
export function withAdapterTimeout<T extends { sendMessage: Function }>(
  adapter: T,
  timeoutMs: number = 5000
): T {
  return new Proxy(adapter, {
    get(target, prop) {
      const original = target[prop as keyof T];

      // Solo wrappear el método sendMessage
      if (prop === 'sendMessage' && typeof original === 'function') {
        return async (...args: any[]) => {
          try {
            return await withTimeout(
              () => original.apply(target, args),
              timeoutMs,
              `Adapter sendMessage exceeded ${timeoutMs}ms timeout`
            );
          } catch (error: any) {
            logger.error('Adapter timeout', {
              adapter: adapter.constructor.name,
              error: error.message,
              timeout: timeoutMs
            });

            // Retornar resultado de error
            return {
              success: false,
              error: error.message,
              timestamp: new Date().toISOString()
            };
          }
        };
      }

      return original;
    }
  });
}
