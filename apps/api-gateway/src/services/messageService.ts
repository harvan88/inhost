/**
 * Message Service (Facade)
 *
 * Servicio de alto nivel que delega a MessageCore.
 * Proporciona una interfaz simple para las rutas.
 *
 * Sprint 1.5: Ahora usa MessageCore como backend
 */

import type { MessageEnvelopeV2 as MessageEnvelope } from '@inhost/shared';
import { MessageType, MessageChannel, MessageStatus } from '@inhost/shared';
import { messageCore, persistence } from './index';
import { createError } from '../middleware/errorHandler';

/**
 * Servicio de Mensajes
 *
 * Responsabilidades:
 * - Adaptar requests HTTP a MessageEnvelope
 * - Delegar a MessageCore
 * - Formatear respuestas para las rutas
 */
export class MessageService {
  /**
   * Crea un nuevo mensaje en el sistema
   */
  async createMessage(data: {
    type: MessageType;
    channel: MessageChannel;
    content: { text: string };
    metadata: {
      from: string;
      to: string;
      timestamp: string;
    };
    conversationId?: string;
  }) {
    // Crear MessageEnvelope
    const envelope: MessageEnvelope = {
      id: crypto.randomUUID(),
      type: data.type,
      channel: data.channel,
      content: data.content,
      metadata: data.metadata,
      statusChain: [{
        status: MessageStatus.RECEIVED,
        timestamp: new Date().toISOString(),
        messageId: crypto.randomUUID()
      }],
      context: {
        plan: 'free', // TODO: Obtener del usuario autenticado
        // timestamp added by MessageCore
      }
    };

    try {
      // Delegar a MessageCore según tipo
      if (data.type === MessageType.INCOMING) {
        // Mensaje entrante - receive
        await messageCore.receive(envelope);
      } else if (data.type === MessageType.OUTGOING) {
        // Mensaje saliente - send
        await messageCore.send(envelope);
      } else {
        // Otros tipos - solo receive
        await messageCore.receive(envelope);
      }

      return {
        success: true,
        data: envelope,
        messageId: envelope.id
      };
    } catch (error) {
      console.error('❌ Error creating message:', error);

      throw createError.database(
        'Failed to create message',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Lista los mensajes más recientes
   */
  async listMessages(limit: number = 10, conversationId?: string) {
    try {
      // Usar persistence para query
      const allMessages = await persistence.query({
        limit,
        // conversationId // TODO: cuando se implemente en MessageEnvelope
      });

      return {
        success: true,
        data: allMessages,
        count: allMessages.length
      };
    } catch (error) {
      console.error('❌ Error fetching messages:', error);

      throw createError.database(
        'Failed to fetch messages',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Actualiza el estado de un mensaje
   */
  async updateMessageStatus(
    messageId: string,
    status: MessageStatus
  ) {
    try {
      await messageCore.updateStatus(messageId, status);

      return {
        success: true,
        messageId,
        status
      };
    } catch (error) {
      console.error('❌ Error updating message status:', error);

      throw createError.database(
        'Failed to update message status',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Verifica el estado de salud del sistema
   */
  async checkHealth() {
    try {
      const stats = await messageCore.getStats();

      return {
        success: true,
        status: 'healthy',
        stats
      };
    } catch (error) {
      return {
        success: false,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Exportar instancia singleton
export const messageService = new MessageService();
