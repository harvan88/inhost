/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/core/MessageCore.ts"
 *   type: "service"
 *   layer: "backend"
 *   domain: "messaging"
 *   purpose: "Orquestador central de mensajería: recibe, persiste, notifica y envía mensajes a través de adapters, coordinando el ciclo de vida completo de mensajes"
 *
 * DEPENDENCIES:
 *   internal: ["@inhost/shared", "./interfaces", "../adapters/manager", "../middleware/logger", "../extensions"]
 *   external: []
 *   infrastructure: ["persistence-backend", "websocket", "messaging-adapters", "extension-host"]
 *
 * CONTRACTS:
 *   exports: ["MessageCore", "MessageCoreConfig"]
 *   inputs: ["MessageEnvelope", "MessageCoreConfig", "IPersistenceService", "INotificationService", "IPlanResolver", "IOwnerChecker", "AdapterManager"]
 *   outputs: ["Promise<void>", "Promise<SendResult>", "Promise<MessageEnvelope | null>", "Promise<boolean>"]
 *   errors: ["PLAN_LIMIT_EXCEEDED", "INTERNAL_ERROR"]
 *
 * INTEGRATION:
 *   data_flow: "[Adapter/UI/Extension] → [receive/send methods] → [persistence.save] → [extensionHost.processMessage] → [notifications.broadcast] → [WebSocket clients]"
 *   events_emitted: ["message:new", "message:status", "enrichment:batch"]
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["services/index.ts", "routes/websocket.ts"]
 *   uses: ["IPersistenceService", "INotificationService", "IPlanResolver", "IOwnerChecker", "AdapterManager"]
 *   critical: true
 *
 * === DOC_END :: MessageCore.ts ===
 */

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

import type { MessageEnvelopeV2 as MessageEnvelope, NewMessageEnrichment } from '@inhost/shared';
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
import type { IExtensionHost, ExtensionContext, ProcessingResult } from '../extensions';

export interface MessageCoreConfig {
  enablePersistence?: boolean;
  enableNotifications?: boolean;
  enablePlanChecks?: boolean;
  enableExtensions?: boolean;
}

export class MessageCore {
  private config: MessageCoreConfig = {
    enablePersistence: true,
    enableNotifications: true,
    enablePlanChecks: true,
    enableExtensions: true
  };

  private extensionHost: IExtensionHost | null = null;

  constructor(
    private persistence: IPersistenceService,
    private notifications: INotificationService,
    private planResolver: IPlanResolver,
    private ownerChecker: IOwnerChecker,
    private adapters: AdapterManager
  ) {}

  /**
   * Configura el Extension Host (opcional)
   */
  setExtensionHost(host: IExtensionHost): void {
    this.extensionHost = host;
    logger.info('🧩 ExtensionHost attached to MessageCore');
  }

  /**
   * Configura el núcleo
   */
  configure(config: Partial<MessageCoreConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Recibe mensaje entrante desde cualquier fuente (adapter, UI)
   * Retorna el resultado de la persistencia para que el caller sepa si tuvo éxito
   */
  async receive(envelope: MessageEnvelope): Promise<{ persisted: boolean; error?: string }> {
    logger.info('📥 MessageCore: Receiving message', {
      id: envelope.id,
      type: envelope.type,
      channel: envelope.channel,
      from: envelope.metadata?.from
    });

    let persisted = false;

    try {
      // 1. Persistir inmediatamente (garantía local)
      if (this.config.enablePersistence) {
        await this.persistence.save(envelope);
        persisted = true;
        logger.info('💾 Message persisted successfully', { id: envelope.id });
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

      // 4. Procesar extensiones (solo mensajes entrantes)
      console.log('🔍 Checking extension processing', {
        enableExtensions: this.config.enableExtensions,
        hasExtensionHost: !!this.extensionHost,
        isIncoming: envelope.type === MessageType.INCOMING,
        messageId: envelope.id
      });
      
      if (this.config.enableExtensions && this.extensionHost && envelope.type === MessageType.INCOMING) {
        console.log('🚀 Processing extensions for message', { messageId: envelope.id });
        await this.processExtensions(envelope);
      }

      logger.info('✅ MessageCore: Message received successfully', {
        id: envelope.id,
        persisted
      });

      return { persisted };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ MessageCore: Error receiving message', {
        id: envelope.id,
        error: errorMessage
      });

      // Retornar error en vez de throw para que el endpoint pueda informar al cliente
      return { persisted: false, error: errorMessage };
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
   * Procesa extensiones para un mensaje entrante
   * Construye ExtensionContext y llama al ExtensionHost
   */
  private async processExtensions(envelope: MessageEnvelope): Promise<void> {
    console.log('🎯 processExtensions called', { messageId: envelope.id });
    if (!this.extensionHost) {
      console.log('❌ No extension host');
      return;
    }

    const startTime = Date.now();

    try {
      // Construir ExtensionContext desde MessageEnvelope
      const context: ExtensionContext = {
        tenantId: 'default', // tenantId no existe en metadata, usar valor por defecto
        messageId: envelope.id,
        conversationId: envelope.metadata?.conversationId || envelope.id,
        text: envelope.content?.text || '',
        contentType: 'text/plain', // type no existe en content, usar valor por defecto
        channel: envelope.channel,
        type: envelope.type === MessageType.INCOMING ? 'incoming' : 'outgoing',
        from: envelope.metadata?.from || '',
        to: envelope.metadata?.to || '',
        timestamp: envelope.metadata?.timestamp || new Date().toISOString(),
      };

      console.log('🧩 Processing extensions for message', {
        messageId: envelope.id,
        tenantId: context.tenantId,
      });

      // Ejecutar extensiones
      const result: ProcessingResult = await this.extensionHost.processMessage(context);

      console.log('🧩 Extensions processed', {
        messageId: envelope.id,
        enrichmentCount: result.enrichments.length,
        errorCount: result.errors.length,
        totalTimeMs: result.totalTimeMs,
      });

      // Persistir y broadcast enrichments si hay resultados
      if (result.enrichments.length > 0) {
        // 1. Mapear a formato de BD
        const dbEnrichments: NewMessageEnrichment[] = result.enrichments.map((e) => ({
          messageId: envelope.id,
          tenantId: context.tenantId,
          extensionId: e.extensionId,
          type: e.type as any,
          payload: e.payload,
          confidence: e.confidence,
          processingTimeMs: e.processingTimeMs,
        }));

        // 2. Persistir en PostgreSQL
        if (this.config.enablePersistence) {
          await this.persistence.saveEnrichments(dbEnrichments);
        }

        // 3. Broadcast via WebSocket
        if (this.config.enableNotifications) {
          await this.notifications.broadcastEnrichments({
            messageId: envelope.id,
            enrichments: result.enrichments,
            processingTimeMs: result.totalTimeMs,
          });
          logger.debug('📢 Enrichments persisted and broadcasted', {
            messageId: envelope.id,
            count: result.enrichments.length,
          });
        }
      }

      // Log errores si los hay
      if (result.errors.length > 0) {
        logger.warn('⚠️ Extension errors during processing', {
          messageId: envelope.id,
          errors: result.errors,
        });
      }
    } catch (error) {
      // No romper el flujo principal por errores de extensiones
      logger.error('❌ Error processing extensions', {
        messageId: envelope.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });
    }
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
