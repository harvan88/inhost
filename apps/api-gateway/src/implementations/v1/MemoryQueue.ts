/**
 * Memory Queue V1
 *
 * Implementación simple de cola en memoria usando un array.
 * Funciona perfectamente para desarrollo y testing.
 *
 * Limitaciones V1:
 * - Los mensajes se pierden al reiniciar
 * - No hay persistencia
 * - No funciona en modo distribuido
 *
 * V2 mejorará:
 * - Redis para persistencia
 * - Soporte multi-proceso
 * - Colas con prioridad
 *
 * @module implementations/v1
 */

import type {
  IMessageQueue,
  QueueStats,
  MessageQueueConfig
} from '../../core/interfaces';
import type { MessageEnvelopeV2 as MessageEnvelope } from '@inhost/shared';
import { logger } from '../../middleware/logger';

interface QueueMetrics {
  processed: number;
  failed: number;
  totalProcessingTime: number;
  lastReset: Date;
}

export class MemoryQueue implements IMessageQueue {
  private queue: MessageEnvelope[] = [];
  private processing: Set<string> = new Set();
  private resetInterval?: Timer;
  private metrics: QueueMetrics = {
    processed: 0,
    failed: 0,
    totalProcessingTime: 0,
    lastReset: new Date()
  };
  private config: MessageQueueConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    maxQueueSize: 10000,
    processingTimeout: 30000
  };

  /**
   * Agregar mensaje a la cola
   */
  async enqueue(message: MessageEnvelope): Promise<void> {
    // Verificar límite de tamaño
    if (this.config.maxQueueSize && this.queue.length >= this.config.maxQueueSize) {
      logger.error('Queue is full', {
        size: this.queue.length,
        maxSize: this.config.maxQueueSize,
        messageId: message.id
      });
      throw new Error(`Queue is full (max: ${this.config.maxQueueSize})`);
    }

    this.queue.push(message);

    logger.debug('Message enqueued', {
      messageId: message.id,
      channel: message.channel,
      queueSize: this.queue.length
    });
  }

  /**
   * Obtener y remover el siguiente mensaje de la cola
   */
  async dequeue(): Promise<MessageEnvelope | null> {
    const message = this.queue.shift();

    if (message) {
      this.processing.add(message.id);
      logger.debug('Message dequeued', {
        messageId: message.id,
        channel: message.channel,
        remaining: this.queue.length
      });
    }

    return message || null;
  }

  /**
   * Ver el siguiente mensaje sin removerlo
   */
  async peek(): Promise<MessageEnvelope | null> {
    return this.queue[0] || null;
  }

  /**
   * Obtener el tamaño de la cola
   */
  async size(): Promise<number> {
    return this.queue.length;
  }

  /**
   * Verificar si la cola está vacía
   */
  async isEmpty(): Promise<boolean> {
    return this.queue.length === 0;
  }

  /**
   * Limpiar la cola
   */
  async clear(): Promise<void> {
    const size = this.queue.length;
    this.queue = [];
    this.processing.clear();

    logger.info('Queue cleared', { messagesRemoved: size });
  }

  /**
   * Obtener estadísticas de la cola
   */
  async getStats(): Promise<QueueStats> {
    const averageProcessingTime = this.metrics.processed > 0
      ? this.metrics.totalProcessingTime / this.metrics.processed
      : 0;

    return {
      size: this.queue.length,
      processing: this.processing.size,
      failed: this.metrics.failed,
      processed: this.metrics.processed,
      averageProcessingTime
    };
  }

  /**
   * Configurar la cola
   */
  configure(config: MessageQueueConfig): void {
    this.config = { ...this.config, ...config };

    logger.info('Queue configured', {
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
      maxQueueSize: this.config.maxQueueSize,
      processingTimeout: this.config.processingTimeout
    });
  }

  /**
   * Marcar un mensaje como procesado exitosamente
   */
  markAsProcessed(messageId: string, processingTime: number): void {
    this.processing.delete(messageId);
    this.metrics.processed++;
    this.metrics.totalProcessingTime += processingTime;

    logger.debug('Message processed', {
      messageId,
      processingTime,
      totalProcessed: this.metrics.processed
    });
  }

  /**
   * Marcar un mensaje como fallido
   */
  markAsFailed(messageId: string): void {
    this.processing.delete(messageId);
    this.metrics.failed++;

    logger.warn('Message failed', {
      messageId,
      totalFailed: this.metrics.failed
    });
  }

  /**
   * Resetear métricas (útil para testing o cada 24h)
   */
  resetMetrics(): void {
    try {
      const previousMetrics = { ...this.metrics };

      this.metrics = {
        processed: 0,
        failed: 0,
        totalProcessingTime: 0,
        lastReset: new Date()
      };

      logger.info('Queue metrics reset', {
        previous: {
          processed: previousMetrics.processed,
          failed: previousMetrics.failed,
          averageTime: previousMetrics.processed > 0
            ? previousMetrics.totalProcessingTime / previousMetrics.processed
            : 0
        }
      });
    } catch (error) {
      logger.error('Queue metrics reset failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Iniciar reset automático de métricas (cada 24h)
   */
  startAutoReset(): void {
    // Prevenir múltiples intervals
    if (this.resetInterval) {
      logger.warn('Queue auto-reset already started');
      return;
    }

    this.resetInterval = setInterval(() => this.resetMetrics(), 24 * 60 * 60 * 1000);
    logger.info('Queue auto-reset started (every 24h)');
  }

  /**
   * Detener reset automático de métricas
   */
  stopAutoReset(): void {
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
      this.resetInterval = undefined;
      logger.info('Queue auto-reset stopped');
    }
  }
}
