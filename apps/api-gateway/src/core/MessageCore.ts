/**
 * MessageCore
 *
 * Núcleo de mensajería - Orquestador LIGERO
 *
 * Responsabilidades:
 * 1. Recibe mensajes entrantes de cualquier fuente
 * 2. Persiste inmediatamente con garantías
 * 3. Notifica estados a todos los interesados
 * 4. Entrega mensajes salientes a adapters
 *
 * NO contiene lógica pesada - delega a servicios especializados.
 * Es autónomo pero no aislado - se comunica mediante contratos claros.
 */

import type { MessageEnvelopeV2 as MessageEnvelope } from '@inhost/shared';
import { MessageStatus, MessageType } from '@inhost/shared';
import type {
  IPersistenceService,
  INotificationService,
  IPlanResolver,
  IOwnerChecker,
  SendResult
} from './interfaces';
import type { AdapterManager } from '../adapters/manager';
import { logger } from '../middleware/logger';

export interface MessageCoreConfig {
  enablePersistence?: boolean;
  enableNotifications?: boolean;
  enablePlanChecks?: boolean;
}

export class MessageCore {
  private config: MessageCoreConfig = {
    enablePersistence: true,
    enableNotifications: true,
    enablePlanChecks: true
  };

  constructor(
    private persistence: IPersistenceService,
    private notifications: INotificationService,
    private planResolver: IPlanResolver,
    private ownerChecker: IOwnerChecker,
    private adapters: AdapterManager
  ) {}

  /**
   * Configura el núcleo
   */
  configure(config: Partial<MessageCoreConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Recibe mensaje entrante desde cualquier fuente
   * (adapter, UI, extensión)
   */
  async receive(envelope: MessageEnvelope): Promise<void> {
    logger.info('📥 MessageCore: Receiving message', {
      id: envelope.id,
      type: envelope.type,
      channel: envelope.channel,
      from: envelope.metadata?.from
    });

    try {
      // 1. Persistir inmediatamente (garantía local)
      if (this.config.enablePersistence) {
        await this.persistence.save(envelope);
        logger.debug('💾 Message persisted', { id: envelope.id });
      }

      // 2. Notificar a interesados (WebSocket, etc.)
      if (this.config.enableNotifications) {
        await this.notifications.broadcast(envelope);
        logger.debug('📢 Message broadcasted', { id: envelope.id });
      }

      // 3. Si es mensaje entrante, actualizar estado
      if (envelope.type === MessageType.INCOMING) {
        await this.updateStatus(envelope.id, MessageStatus.RECEIVED);
      }

      logger.info('✅ MessageCore: Message received successfully', {
        id: envelope.id
      });
    } catch (error) {
      logger.error('❌ MessageCore: Error receiving message', {
        id: envelope.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Envía mensaje saliente a través del adapter apropiado
   */
  async send(envelope: MessageEnvelope): Promise<SendResult> {
    logger.info('📤 MessageCore: Sending message', {
      id: envelope.id,
      type: envelope.type,
      channel: envelope.channel,
      to: envelope.metadata?.to
    });

    try {
      // 1. Verificar plan (si está habilitado)
      if (this.config.enablePlanChecks && envelope.metadata?.ownerId) {
        const canSend = await this.planResolver.canPerformAction(
          envelope.metadata.ownerId,
          'send_message'
        );

        if (!canSend) {
          const result: SendResult = {
            success: false,
            messageId: envelope.id,
            status: 'failed',
            error: {
              code: 'PLAN_LIMIT_EXCEEDED',
              message: 'Plan limit exceeded for sending messages',
              retryable: false
            },
            timestamp: new Date().toISOString()
          };

          logger.warn('⚠️  Plan limit exceeded', { userId: envelope.metadata.ownerId });
          return result;
        }
      }

      // 2. Persistir antes de enviar
      if (this.config.enablePersistence) {
        await this.persistence.save(envelope);
      }

      // 3. Actualizar estado a "sending"
      await this.updateStatus(envelope.id, MessageStatus.SENDING);

      // 4. Delegar envío al adapter apropiado
      const result = await this.adapters.sendMessage(envelope);

      // 5. Actualizar estado según resultado
      if (result.success) {
        await this.updateStatus(envelope.id, MessageStatus.SENT);
        logger.info('✅ Message sent successfully', { id: envelope.id });
      } else {
        await this.updateStatus(envelope.id, MessageStatus.FAILED);
        logger.error('❌ Message send failed', {
          id: envelope.id,
          error: result.error
        });
      }

      // 6. Registrar uso en el plan
      if (this.config.enablePlanChecks && envelope.metadata?.ownerId) {
        await this.planResolver.recordUsage(envelope.metadata.ownerId, 'send_message');
      }

      return result;
    } catch (error) {
      logger.error('❌ MessageCore: Error sending message', {
        id: envelope.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      await this.updateStatus(envelope.id, MessageStatus.FAILED);

      return {
        success: false,
        messageId: envelope.id,
        status: 'failed',
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Actualiza el estado de un mensaje y notifica
   */
  async updateStatus(
    messageId: string,
    status: MessageStatus,
    timestamp?: string
  ): Promise<void> {
    logger.debug('🔄 MessageCore: Updating status', {
      messageId,
      status
    });

    try {
      // 1. Persistir cambio de estado
      if (this.config.enablePersistence) {
        await this.persistence.updateStatus(messageId, status, timestamp);
      }

      // 2. Notificar cambio de estado
      if (this.config.enableNotifications) {
        await this.notifications.broadcastStatus({
          messageId,
          status,
          timestamp: timestamp || new Date().toISOString()
        });
      }

      logger.debug('✅ Status updated', { messageId, status });
    } catch (error) {
      logger.error('❌ MessageCore: Error updating status', {
        messageId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // No re-throw - el error de notificación no debe romper el flujo
    }
  }

  /**
   * Obtiene un mensaje por ID
   */
  async getMessage(messageId: string): Promise<MessageEnvelope | null> {
    return await this.persistence.get(messageId);
  }

  /**
   * Verifica si un owner está online
   */
  async isOwnerOnline(userId: string): Promise<boolean> {
    return await this.ownerChecker.isOnline(userId);
  }

  /**
   * Obtiene estadísticas del núcleo
   */
  async getStats(): Promise<{
    persistence: any;
    notifications: any;
    adapters: any;
  }> {
    const [persistenceStats, notificationStats, adapterHealth] = await Promise.all([
      this.persistence.getStats(),
      Promise.resolve(this.notifications.getStats()),
      this.adapters.healthCheckAll()
    ]);

    return {
      persistence: persistenceStats,
      notifications: notificationStats,
      adapters: Object.fromEntries(adapterHealth)
    };
  }
}
