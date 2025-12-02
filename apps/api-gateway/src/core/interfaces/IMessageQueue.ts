/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\core\interfaces\IMessageQueue.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Handles i message queue functionality"
 *
 * DEPENDENCIES:
 *   internal: []
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["IMessageQueue","MessageQueueConfig","QueueStats"]
 *   inputs: "None"
 *   outputs: "Promise<void>"
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
 * === DOC_END :: IMessageQueue.ts ===
 */

import type { MessageEnvelopeV2 as MessageEnvelope } from '@inhost/shared';

/**
 * Estadísticas de la cola
 */
export interface QueueStats {
  size: number;                  // Mensajes en cola
  processing: number;            // Mensajes siendo procesados
  failed: number;                // Mensajes fallidos (últimas 24h)
  processed: number;             // Mensajes procesados (últimas 24h)
  averageProcessingTime: number; // Tiempo promedio de procesamiento (ms)
}

/**
 * Configuración de la cola de mensajes
 */
export interface MessageQueueConfig {
  maxRetries?: number;           // Reintentos máximos
  retryDelay?: number;           // Delay inicial entre reintentos (ms)
  maxQueueSize?: number;         // Tamaño máximo de cola
  processingTimeout?: number;    // Timeout para procesamiento (ms)
}

/**
 * Interface para Message Queue
 *
 * Esta interface define el contrato para la cola de mensajes.
 * Las implementaciones pueden variar:
 * - V1: Array en memoria
 * - V2: Redis para persistencia
 * - V3: Redis + PostgreSQL para garantías completas
 *
 * @example
 * ```typescript
 * // V1: Simple en memoria
 * class MemoryQueue implements IMessageQueue {
 *   private queue: MessageEnvelope[] = [];
 *
 *   async enqueue(message: MessageEnvelope): Promise<void> {
 *     this.queue.push(message);
 *   }
 *
 *   async dequeue(): Promise<MessageEnvelope | null> {
 *     return this.queue.shift() || null;
 *   }
 * }
 *
 * // V2: Redis
 * class RedisQueue implements IMessageQueue {
 *   async enqueue(message: MessageEnvelope): Promise<void> {
 *     await redis.lpush('queue', JSON.stringify(message));
 *   }
 *
 *   async dequeue(): Promise<MessageEnvelope | null> {
 *     const msg = await redis.rpop('queue');
 *     return msg ? JSON.parse(msg) : null;
 *   }
 * }
 *
 * // V3: Persistente (Redis + DB)
 * class PersistentQueue implements IMessageQueue {
 *   async enqueue(message: MessageEnvelope): Promise<void> {
 *     // Guardar en DB primero (garantía de no pérdida)
 *     await db.messages.create(message);
 *     // Luego encolar en Redis (velocidad)
 *     await redis.lpush('queue', message.id);
 *   }
 * }
 * ```
 */
export interface IMessageQueue {
  /**
   * Agregar mensaje a la cola
   *
   * @param message - Mensaje a encolar
   */
  enqueue(message: MessageEnvelope): Promise<void>;

  /**
   * Obtener y remover el siguiente mensaje de la cola
   *
   * @returns Mensaje o null si la cola está vacía
   */
  dequeue(): Promise<MessageEnvelope | null>;

  /**
   * Ver el siguiente mensaje sin removerlo
   *
   * @returns Mensaje o null si la cola está vacía
   */
  peek(): Promise<MessageEnvelope | null>;

  /**
   * Obtener el tamaño de la cola
   *
   * @returns Número de mensajes en cola
   */
  size(): Promise<number>;

  /**
   * Verificar si la cola está vacía
   *
   * @returns true si está vacía
   */
  isEmpty(): Promise<boolean>;

  /**
   * Limpiar la cola (remover todos los mensajes)
   */
  clear(): Promise<void>;

  /**
   * Obtener estadísticas de la cola
   *
   * @returns Estadísticas
   */
  getStats(): Promise<QueueStats>;

  /**
   * Configurar la cola
   *
   * @param config - Configuración
   */
  configure(config: MessageQueueConfig): void;
}
