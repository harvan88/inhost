import {
  db,
  messages,
  type NewMessage,
  type MessageContext,
  MessageType,
  MessageChannel
} from '@inhost/shared';
import { desc } from 'drizzle-orm';
import { createError } from '../middleware/errorHandler';

/**
 * Servicio de Mensajes
 *
 * Responsabilidades:
 * - Gestión de mensajes (crear, listar, actualizar estados)
 * - Aplicación de lógica de negocio
 * - Validaciones de dominio
 * - Interacción con la base de datos
 */
export class MessageService {
  /**
   * Crea un nuevo mensaje en el sistema
   *
   * @param data - Datos del mensaje a crear
   * @returns Mensaje creado con ID generado
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
    const newMessage: NewMessage = {
      conversationId: data.conversationId || null,
      type: data.type,
      channel: data.channel,
      content: data.content,
      metadata: data.metadata,
      statusChain: [{
        status: 'received',
        timestamp: new Date().toISOString(),
        messageId: crypto.randomUUID()
      }],
      context: {
        plan: 'free', // TODO: Obtener del usuario autenticado
        timestamp: new Date().toISOString()
      } as MessageContext
    };

    try {
      const [insertedMessage] = await db
        .insert(messages)
        .values(newMessage)
        .returning();

      console.log('💾 Message saved to PostgreSQL:', insertedMessage.id);

      return {
        success: true,
        data: insertedMessage,
        messageId: insertedMessage.id
      };
    } catch (error) {
      console.error('❌ Database error:', error);

      throw createError.database(
        'Failed to create message',
        error instanceof Error ? error.message : 'Unknown database error'
      );
    }
  }

  /**
   * Lista los mensajes más recientes
   *
   * @param limit - Número máximo de mensajes a retornar
   * @param conversationId - ID de conversación para filtrar (opcional)
   * @returns Lista de mensajes ordenados por fecha
   */
  async listMessages(limit: number = 10, conversationId?: string) {
    try {
      let query = db
        .select()
        .from(messages)
        .orderBy(desc(messages.createdAt))
        .limit(limit);

      // TODO: Agregar filtro por conversationId cuando se implemente
      // if (conversationId) {
      //   query = query.where(eq(messages.conversationId, conversationId));
      // }

      const allMessages = await query;

      return {
        success: true,
        data: allMessages,
        count: allMessages.length
      };
    } catch (error) {
      console.error('❌ Error fetching messages:', error);

      throw createError.database(
        'Failed to fetch messages',
        error instanceof Error ? error.message : 'Unknown database error'
      );
    }
  }

  /**
   * Actualiza el estado de un mensaje
   *
   * @param messageId - ID del mensaje
   * @param status - Nuevo estado del mensaje
   * @returns Mensaje actualizado
   */
  async updateMessageStatus(
    messageId: string,
    status: 'received' | 'processing' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  ) {
    try {
      // TODO: Implementar actualización de estado en statusChain
      console.log(`🔄 Updating message ${messageId} to status: ${status}`);

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
   * Verifica el estado de salud de la conexión a base de datos
   *
   * @returns Estado de la conexión
   */
  async checkHealth() {
    try {
      await db.select().from(messages).limit(1);

      return {
        success: true,
        status: 'healthy',
        database: 'postgresql'
      };
    } catch (error) {
      return {
        success: false,
        status: 'unhealthy',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Exportar instancia singleton
export const messageService = new MessageService();
