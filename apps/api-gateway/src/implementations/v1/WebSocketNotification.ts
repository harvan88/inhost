/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\implementations\v1\WebSocketNotification.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Handles web socket notification functionality"
 *
 * DEPENDENCIES:
 *   internal: ["../../middleware/logger"]
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["WebSocketNotification"]
 *   inputs: "None"
 *   outputs: "Promise<void>"
 *   errors: "None"
 *
 * INTEGRATION:
 *   data_flow: "WebSocket → Handler → Store → UI"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: ["../../middleware/logger"]
 *   critical: true
 *
 * === DOC_END :: WebSocketNotification.ts ===
 */

/**
 * WebSocketNotification (V1)
 *
 * Implementación simple de notificaciones vía WebSocket.
 * Broadcast a todos los clientes conectados.
 *
 * Características V1:
 * - Broadcast simple a todas las conexiones
 * - Tracking de conexiones en memoria
 * - Ideal para desarrollo single-server
 *
 * V2 usará rooms/canales para filtrado
 * V3 agregará Redis PubSub para clustering
 */

import type { MessageEnvelopeV2 as MessageEnvelope } from '@inhost/shared';
import type {
  INotificationService,
  NotificationTarget,
  StatusUpdate,
  TypingIndicator,
  ConversationReadEvent,
  ConversationUpdatedEvent,
  EnrichmentBatchEvent
} from '../../core/interfaces';
import { logger } from '../../middleware/logger';

interface Connection {
  userId: string;
  connectionId: string;
  connectedAt: string;
  lastActivity: string;
  metadata?: Record<string, unknown>;
  ws?: any; // WebSocket connection (to be injected)
}

export class WebSocketNotification implements INotificationService {
  private connections: Map<string, Connection> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();

  async broadcast(
    envelope: MessageEnvelope,
    target?: NotificationTarget
  ): Promise<void> {
    const event = {
      type: 'message:new',
      data: envelope,
      timestamp: new Date().toISOString()
    };

    if (target?.userId) {
      // Broadcast a un usuario específico
      await this.broadcastToUser(target.userId, event);
    } else {
      // Broadcast a todos
      await this.broadcastToAll(event);
    }

    logger.debug('📢 WebSocketNotification: Message broadcasted', {
      messageId: envelope.id,
      targetUser: target?.userId,
      totalConnections: this.connections.size
    });
  }

  async broadcastStatus(
    update: StatusUpdate,
    target?: NotificationTarget
  ): Promise<void> {
    const event = {
      type: 'message:status',
      data: update,
      timestamp: new Date().toISOString()
    };

    if (target?.userId) {
      await this.broadcastToUser(target.userId, event);
    } else {
      await this.broadcastToAll(event);
    }

    logger.debug('🔄 WebSocketNotification: Status broadcasted', {
      messageId: update.messageId,
      status: update.status,
      targetUser: target?.userId
    });
  }

  async sendTypingIndicator(
    indicator: TypingIndicator,
    target?: NotificationTarget
  ): Promise<void> {
    const event = {
      type: 'typing:indicator',
      data: indicator,
      timestamp: new Date().toISOString()
    };

    if (target?.userId) {
      await this.broadcastToUser(target.userId, event);
    } else {
      await this.broadcastToAll(event);
    }

    logger.debug('✍️  WebSocketNotification: Typing indicator sent', {
      userId: indicator.userId,
      isTyping: indicator.isTyping,
      targetUser: target?.userId
    });
  }

  async broadcastConversationRead(
    event: ConversationReadEvent,
    target?: NotificationTarget
  ): Promise<void> {
    const payload = {
      type: 'conversation:read',
      data: event,
      timestamp: new Date().toISOString()
    };

    if (target?.userId) {
      await this.broadcastToUser(target.userId, payload);
    } else {
      await this.broadcastToAll(payload);
    }

    logger.debug('👁️  WebSocketNotification: Conversation read event sent', {
      conversationId: event.conversationId,
      userId: event.userId,
      unreadCount: event.unreadCount
    });
  }

  async broadcastConversationUpdated(
    event: ConversationUpdatedEvent,
    target?: NotificationTarget
  ): Promise<void> {
    const payload = {
      type: 'conversation:updated',
      data: event,
      timestamp: new Date().toISOString()
    };

    if (target?.userId) {
      await this.broadcastToUser(target.userId, payload);
    } else {
      await this.broadcastToAll(payload);
    }

    logger.debug('🔄 WebSocketNotification: Conversation updated event sent', {
      conversationId: event.conversationId,
      updates: Object.keys(event.updates)
    });
  }

  async broadcastEnrichments(
    event: EnrichmentBatchEvent,
    target?: NotificationTarget
  ): Promise<void> {
    const payload = {
      type: 'enrichment:batch',
      data: event,
      timestamp: new Date().toISOString()
    };

    if (target?.userId) {
      await this.broadcastToUser(target.userId, payload);
    } else {
      await this.broadcastToAll(payload);
    }

    logger.debug('🧩 WebSocketNotification: Enrichments broadcasted', {
      messageId: event.messageId,
      enrichmentCount: event.enrichments.length,
      processingTimeMs: event.processingTimeMs
    });
  }

  registerConnection(
    userId: string,
    connectionId: string,
    metadata?: Record<string, unknown>
  ): void {
    const connection: Connection = {
      userId,
      connectionId,
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      metadata
    };

    this.connections.set(connectionId, connection);

    // Agregar a índice por usuario
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    logger.debug('🔌 WebSocketNotification: Connection registered', {
      userId,
      connectionId,
      totalConnections: this.connections.size,
      userConnections: this.userConnections.get(userId)!.size
    });
  }

  unregisterConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);

    if (connection) {
      const userId = connection.userId;

      // Remover de conexiones
      this.connections.delete(connectionId);

      // Remover de índice por usuario
      const userConns = this.userConnections.get(userId);
      if (userConns) {
        userConns.delete(connectionId);
        if (userConns.size === 0) {
          this.userConnections.delete(userId);
        }
      }

      logger.debug('🔌 WebSocketNotification: Connection unregistered', {
        userId,
        connectionId,
        totalConnections: this.connections.size
      });
    }
  }

  getActiveConnections(userId: string): string[] {
    const connections = this.userConnections.get(userId);
    return connections ? Array.from(connections) : [];
  }

  isUserOnline(userId: string): boolean {
    const connections = this.userConnections.get(userId);
    return connections !== undefined && connections.size > 0;
  }

  getStats(): {
    totalConnections: number;
    uniqueUsers: number;
    connectionsByUser: Record<string, number>;
  } {
    const connectionsByUser: Record<string, number> = {};

    for (const [userId, connections] of this.userConnections.entries()) {
      connectionsByUser[userId] = connections.size;
    }

    return {
      totalConnections: this.connections.size,
      uniqueUsers: this.userConnections.size,
      connectionsByUser
    };
  }

  /**
   * Inyecta el WebSocket en una conexión
   * (Llamado desde el route de WebSocket)
   */
  attachWebSocket(connectionId: string, ws: any): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.ws = ws;
      logger.debug('🔌 WebSocket attached to connection', { connectionId });
    }
  }

  /**
   * Actualiza actividad de una conexión
   */
  updateActivity(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = new Date().toISOString();
    }
  }

  /**
   * Broadcast a un usuario específico (todas sus conexiones)
   */
  private async broadcastToUser(userId: string, event: any): Promise<void> {
    const connectionIds = this.userConnections.get(userId);

    if (!connectionIds || connectionIds.size === 0) {
      logger.debug('⚠️  User has no active connections', { userId });
      return;
    }

    for (const connId of connectionIds) {
      const connection = this.connections.get(connId);
      if (connection?.ws) {
        try {
          connection.ws.send(JSON.stringify(event));
          this.updateActivity(connId);
        } catch (error) {
          logger.error('❌ Error sending to connection', {
            connectionId: connId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
  }

  /**
   * Broadcast a todas las conexiones
   */
  private async broadcastToAll(event: any): Promise<void> {
    const message = JSON.stringify(event);

    for (const [connId, connection] of this.connections.entries()) {
      if (connection.ws) {
        try {
          connection.ws.send(message);
          this.updateActivity(connId);
        } catch (error) {
          logger.error('❌ Error broadcasting to connection', {
            connectionId: connId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    logger.debug('📢 Broadcasted to all connections', {
      total: this.connections.size
    });
  }
}
