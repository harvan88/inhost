/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\core\interfaces\INotificationService.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Handles i notification operations"
 *
 * DEPENDENCIES:
 *   internal: []
 *   external: ["@inhost/shared"]
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["ConversationReadEvent","ConversationUpdatedEvent","INotificationService","NotificationTarget","StatusUpdate","TypingIndicator"]
 *   inputs: "None"
 *   outputs: "void"
 *   errors: "None"
 *
 * INTEGRATION:
 *   data_flow: "WebSocket → Handler → Store → UI"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: ["@inhost/shared"]
 *   critical: true
 *
 * === DOC_END :: INotificationService.ts ===
 */

/**
 * INotificationService
 *
 * Contrato para servicios de notificación en tiempo real.
 * Maneja broadcast de mensajes y estados a clientes conectados.
 *
 * Implementaciones:
 * - V1: WebSocket simple (broadcast a todos)
 * - V2: WebSocket con rooms/canales
 * - V3: Redis PubSub + WebSocket clustering
 */

import type { MessageEnvelopeV2 as MessageEnvelope } from '@inhost/shared';
import { MessageStatus } from '@inhost/shared';

export interface NotificationTarget {
  userId?: string;
  conversationId?: string;
  deviceId?: string;
  channel?: string;
}

export interface StatusUpdate {
  messageId: string;
  status: MessageStatus;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface TypingIndicator {
  userId: string;
  conversationId: string;
  isTyping: boolean;
  timestamp: string;
}

export interface ConversationReadEvent {
  conversationId: string;
  userId: string;
  unreadCount: number;
  lastReadAt: string;
  timestamp: string;
}

export interface ConversationUpdatedEvent {
  conversationId: string;
  updates: {
    lastMessage?: {
      id: string;
      text: string;
      type: string;
      timestamp: string;
    };
    unreadCount?: number;
    status?: string;
    assignedToId?: string;
  };
  timestamp: string;
}

export interface INotificationService {
  /**
   * Broadcast de mensaje a destinatarios
   */
  broadcast(envelope: MessageEnvelope, target?: NotificationTarget): Promise<void>;

  /**
   * Broadcast de actualización de estado
   */
  broadcastStatus(update: StatusUpdate, target?: NotificationTarget): Promise<void>;

  /**
   * Envía indicador de escritura
   */
  sendTypingIndicator(indicator: TypingIndicator, target?: NotificationTarget): Promise<void>;

  /**
   * Broadcast de conversación marcada como leída
   */
  broadcastConversationRead(event: ConversationReadEvent, target?: NotificationTarget): Promise<void>;

  /**
   * Broadcast de actualización de conversación (lastMessage, unreadCount, etc.)
   */
  broadcastConversationUpdated(event: ConversationUpdatedEvent, target?: NotificationTarget): Promise<void>;

  /**
   * Registra una conexión de cliente
   */
  registerConnection(userId: string, connectionId: string, metadata?: Record<string, unknown>): void;

  /**
   * Desregistra una conexión
   */
  unregisterConnection(connectionId: string): void;

  /**
   * Obtiene conexiones activas de un usuario
   */
  getActiveConnections(userId: string): string[];

  /**
   * Verifica si un usuario está online
   */
  isUserOnline(userId: string): boolean;

  /**
   * Obtiene estadísticas de conexiones
   */
  getStats(): {
    totalConnections: number;
    uniqueUsers: number;
    connectionsByUser: Record<string, number>;
  };
}
