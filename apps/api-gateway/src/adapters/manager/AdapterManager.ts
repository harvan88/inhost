import type { MessageChannel, MessageEnvelope } from '@inhost/shared';
import type { IAdapter, SendResult } from '../../core/interfaces';
import { logger } from '../../middleware/logger';

/**
 * Adapter Manager
 *
 * Gestiona todos los adapters del sistema.
 * Responsabilidades:
 * - Registrar/desregistrar adapters
 * - Rutear mensajes al adapter correcto según canal
 * - Health checks de adapters
 * - Inicialización y lifecycle management
 *
 * @example
 * ```typescript
 * const manager = new AdapterManager();
 *
 * // Registrar adapters
 * manager.register(new SimulatedWhatsAppAdapter());
 * manager.register(new SimulatedTelegramAdapter());
 *
 * // Inicializar todos
 * await manager.initializeAll();
 *
 * // Enviar mensaje
 * const result = await manager.sendMessage(envelope);
 * ```
 */
export class AdapterManager {
  private adapters: Map<MessageChannel, IAdapter> = new Map();

  /**
   * Registrar un adapter
   *
   * @param adapter - Adapter a registrar
   */
  register(adapter: IAdapter): void {
    if (this.adapters.has(adapter.channel)) {
      logger.warn('Adapter already registered, replacing', {
        channel: adapter.channel,
        oldId: this.adapters.get(adapter.channel)?.id,
        newId: adapter.id
      });
    }

    this.adapters.set(adapter.channel, adapter);

    logger.info('Adapter registered', {
      id: adapter.id,
      name: adapter.name,
      channel: adapter.channel,
      version: adapter.version
    });
  }

  /**
   * Desregistrar un adapter
   *
   * @param channel - Canal del adapter a desregistrar
   */
  unregister(channel: MessageChannel): void {
    const adapter = this.adapters.get(channel);

    if (!adapter) {
      logger.warn('Attempting to unregister non-existent adapter', { channel });
      return;
    }

    this.adapters.delete(channel);

    logger.info('Adapter unregistered', {
      id: adapter.id,
      channel
    });
  }

  /**
   * Obtener adapter por canal
   *
   * @param channel - Canal del adapter
   * @returns Adapter o undefined
   */
  getAdapter(channel: MessageChannel): IAdapter | undefined {
    return this.adapters.get(channel);
  }

  /**
   * Verificar si existe adapter para un canal
   *
   * @param channel - Canal a verificar
   * @returns true si existe
   */
  hasAdapter(channel: MessageChannel): boolean {
    return this.adapters.has(channel);
  }

  /**
   * Obtener todos los adapters disponibles
   *
   * @returns Array de adapters
   */
  getAll(): IAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Obtener información de todos los adapters
   *
   * @returns Array con info de cada adapter
   */
  getAvailableInfo() {
    return Array.from(this.adapters.values()).map(adapter => ({
      id: adapter.id,
      name: adapter.name,
      channel: adapter.channel,
      version: adapter.version
    }));
  }

  /**
   * Inicializar todos los adapters
   */
  async initializeAll(): Promise<void> {
    logger.info('Initializing all adapters', {
      count: this.adapters.size
    });

    const promises = Array.from(this.adapters.values()).map(adapter =>
      adapter.initialize().catch(error => {
        logger.error('Failed to initialize adapter', {
          id: adapter.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      })
    );

    await Promise.all(promises);

    logger.info('All adapters initialized');
  }

  /**
   * Iniciar todos los adapters
   */
  async startAll(): Promise<void> {
    logger.info('Starting all adapters', {
      count: this.adapters.size
    });

    const promises = Array.from(this.adapters.values()).map(adapter =>
      adapter.start().catch(error => {
        logger.error('Failed to start adapter', {
          id: adapter.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      })
    );

    await Promise.all(promises);

    logger.info('All adapters started');
  }

  /**
   * Detener todos los adapters
   */
  async stopAll(): Promise<void> {
    logger.info('Stopping all adapters', {
      count: this.adapters.size
    });

    const promises = Array.from(this.adapters.values()).map(adapter =>
      adapter.stop().catch(error => {
        logger.error('Failed to stop adapter', {
          id: adapter.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      })
    );

    await Promise.all(promises);

    logger.info('All adapters stopped');
  }

  /**
   * Enviar mensaje a través del adapter correcto
   *
   * @param envelope - Mensaje a enviar
   * @returns Resultado del envío
   * @throws Error si no existe adapter para el canal
   */
  async sendMessage(envelope: MessageEnvelope): Promise<SendResult> {
    const adapter = this.adapters.get(envelope.channel);

    if (!adapter) {
      const error = new Error(
        `No adapter found for channel: ${envelope.channel}`
      );

      logger.error('Adapter not found', {
        channel: envelope.channel,
        messageId: envelope.id
      });

      throw error;
    }

    // Verificar health del adapter antes de enviar
    const isHealthy = await adapter.isHealthy();

    if (!isHealthy) {
      logger.warn('Adapter is unhealthy', {
        channel: envelope.channel,
        adapterId: adapter.id
      });

      return {
        success: false,
        messageId: envelope.id,
        status: 'failed',
        error: {
          code: 'ADAPTER_UNHEALTHY',
          message: `Adapter ${adapter.id} is not healthy`,
          retryable: true
        },
        timestamp: new Date().toISOString()
      };
    }

    // Enviar mensaje
    logger.debug('Sending message through adapter', {
      messageId: envelope.id,
      channel: envelope.channel,
      adapterId: adapter.id
    });

    try {
      const result = await adapter.sendMessage(envelope);

      if (result.success) {
        logger.info('Message sent successfully', {
          messageId: envelope.id,
          platformMessageId: result.platformMessageId,
          channel: envelope.channel
        });
      } else {
        logger.warn('Message send failed', {
          messageId: envelope.id,
          channel: envelope.channel,
          error: result.error
        });
      }

      return result;

    } catch (error) {
      logger.error('Error sending message', {
        messageId: envelope.id,
        channel: envelope.channel,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        messageId: envelope.id,
        status: 'failed',
        error: {
          code: 'ADAPTER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Health check de todos los adapters
   *
   * @returns Map con status de cada adapter
   */
  async healthCheckAll(): Promise<Map<MessageChannel, boolean>> {
    const results = new Map<MessageChannel, boolean>();

    const promises = Array.from(this.adapters.entries()).map(
      async ([channel, adapter]) => {
        try {
          const isHealthy = await adapter.isHealthy();
          results.set(channel, isHealthy);
        } catch (error) {
          logger.error('Health check failed', {
            channel,
            adapterId: adapter.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          results.set(channel, false);
        }
      }
    );

    await Promise.all(promises);

    return results;
  }

  /**
   * Obtener estadísticas de los adapters
   *
   * @returns Estadísticas
   */
  getStats() {
    return {
      totalAdapters: this.adapters.size,
      adapters: this.getAvailableInfo()
    };
  }
}
