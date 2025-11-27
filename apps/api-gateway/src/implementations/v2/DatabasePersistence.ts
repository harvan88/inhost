/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/implementations/v2/DatabasePersistence.ts"
 *   type: "service"
 *   layer: "backend"
 *   domain: "database"
 *   purpose: "Implementación V2 de IPersistenceService usando PostgreSQL con Drizzle ORM para persistencia permanente de mensajes"
 *
 * DEPENDENCIES:
 *   internal: ["@inhost/shared", "../../core/interfaces", "../../middleware/logger"]
 *   external: ["drizzle-orm"]
 *   infrastructure: ["postgresql"]
 *
 * CONTRACTS:
 *   exports: ["DatabasePersistence"]
 *   inputs: ["MessageEnvelope", "MessageQuery", "string:messageId", "MessageStatus"]
 *   outputs: ["Promise<PersistenceResult>", "Promise<void>", "Promise<MessageEnvelope | null>", "Promise<MessageEnvelope[]>"]
 *   errors: ["SAVE_ERROR", "UPDATE_ERROR", "QUERY_ERROR"]
 *
 * INTEGRATION:
 *   data_flow: "[MessageCore] → [save/updateStatus/query/delete methods] → [PostgreSQL via Drizzle ORM] → [results]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["MessageCore", "services/index.ts"]
 *   uses: ["IPersistenceService", "middleware/logger", "@inhost/shared/database"]
 *   critical: true
 *
 * === DOC_END :: DatabasePersistence.ts ===
 */

/**
 * DatabasePersistence (V2)
 *
 * Implementación de persistencia usando PostgreSQL.
 * Los datos persisten entre reinicios del servidor.
 *
 * Características V2:
 * - Almacenamiento en PostgreSQL
 * - Persistencia permanente
 * - Soporte para queries complejas
 * - Ideal para producción
 *
 * V1 usaba memoria (MemoryPersistence)
 * V3 agregará replicación multi-región
 */

import type { MessageEnvelopeV2 as MessageEnvelope } from '@inhost/shared';
import { MessageStatus, db, messages } from '@inhost/shared';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import type {
  IPersistenceService,
  PersistenceResult,
  MessageQuery
} from '../../core/interfaces';
import { logger } from '../../middleware/logger';

export class DatabasePersistence implements IPersistenceService {
  private stats = {
    totalSaved: 0,
    totalUpdated: 0,
    totalDeleted: 0
  };

  async save(envelope: MessageEnvelope): Promise<PersistenceResult> {
    try {
      // Asegurar que tiene statusChain
      const statusChain = envelope.statusChain || [{
        status: MessageStatus.RECEIVED,
        timestamp: new Date().toISOString(),
        messageId: envelope.id
      }];

      // Insertar o actualizar mensaje en PostgreSQL
      await db.insert(messages).values({
        id: envelope.id,
        conversationId: envelope.metadata?.conversationId || envelope.id, // Fallback si no existe conversationId
        type: envelope.type,
        channel: envelope.channel,
        content: envelope.content,
        metadata: envelope.metadata,
        statusChain: statusChain,
        context: envelope.context,
        sentByAdminUserId: envelope.metadata?.ownerId || null,
        createdAt: new Date(envelope.metadata?.timestamp || new Date().toISOString()),
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: messages.id,
        set: {
          content: envelope.content,
          metadata: envelope.metadata,
          statusChain: statusChain,
          context: envelope.context,
          updatedAt: new Date(),
        }
      });

      this.stats.totalSaved++;

      logger.debug('💾 DatabasePersistence: Message saved', {
        id: envelope.id,
        conversationId: envelope.metadata?.conversationId
      });

      return {
        success: true,
        messageId: envelope.id,
        savedAt: new Date().toISOString(),
        storage: 'postgresql'
      };
    } catch (error) {
      logger.error('❌ DatabasePersistence: Error saving message', {
        id: envelope.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        messageId: envelope.id,
        savedAt: new Date().toISOString(),
        storage: 'postgresql',
        error: {
          code: 'SAVE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  async updateStatus(
    messageId: string,
    status: MessageStatus,
    timestamp?: string
  ): Promise<void> {
    try {
      // Obtener mensaje actual
      const result = await db
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (result.length === 0) {
        logger.warn('⚠️  DatabasePersistence: Message not found for status update', {
          messageId
        });
        return;
      }

      const message = result[0];

      // Agregar estado al statusChain (append-only)
      const statusEntry = {
        status,
        timestamp: timestamp || new Date().toISOString(),
        messageId
      };

      const currentStatusChain = Array.isArray(message.statusChain)
        ? message.statusChain as any[]
        : [];

      const updatedStatusChain = [...currentStatusChain, statusEntry];

      // Actualizar mensaje con nuevo statusChain
      await db
        .update(messages)
        .set({
          statusChain: updatedStatusChain,
          updatedAt: new Date()
        })
        .where(eq(messages.id, messageId));

      this.stats.totalUpdated++;

      logger.debug('🔄 DatabasePersistence: Status updated', {
        messageId,
        status
      });
    } catch (error) {
      logger.error('❌ DatabasePersistence: Error updating status', {
        messageId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async get(messageId: string): Promise<MessageEnvelope | null> {
    try {
      const result = await db
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.dbMessageToEnvelope(result[0]);
    } catch (error) {
      logger.error('❌ DatabasePersistence: Error getting message', {
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async query(criteria: MessageQuery): Promise<MessageEnvelope[]> {
    try {
      let query = db.select().from(messages);

      // Construir condiciones
      const conditions: any[] = [];

      if (criteria.conversationId) {
        conditions.push(eq(messages.conversationId, criteria.conversationId));
      }

      if (criteria.channel) {
        conditions.push(eq(messages.channel, criteria.channel as any));
      }

      if (criteria.startDate) {
        conditions.push(gte(messages.createdAt, criteria.startDate));
      }

      if (criteria.endDate) {
        conditions.push(lte(messages.createdAt, criteria.endDate));
      }

      // Aplicar condiciones
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      // Ordenar por timestamp descendente (más reciente primero)
      query = query.orderBy(desc(messages.createdAt)) as any;

      // Aplicar paginación
      const offset = criteria.offset || 0;
      const limit = criteria.limit || 100;
      query = query.limit(limit).offset(offset) as any;

      const results = await query;

      // Convertir mensajes de DB a MessageEnvelope
      return results.map((msg: any) => this.dbMessageToEnvelope(msg));
    } catch (error) {
      logger.error('❌ DatabasePersistence: Error querying messages', {
        criteria,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  async delete(messageId: string): Promise<void> {
    try {
      // Soft delete - actualizar statusChain con FAILED
      await this.updateStatus(messageId, MessageStatus.FAILED);
      this.stats.totalDeleted++;

      logger.debug('🗑️  DatabasePersistence: Message deleted (soft)', {
        messageId
      });
    } catch (error) {
      logger.error('❌ DatabasePersistence: Error deleting message', {
        messageId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async syncToRemote(messageIds: string[]): Promise<void> {
    // V2: Ya estamos en PostgreSQL (remoto)
    // V3: Sincronizará con otras regiones
    logger.debug('🔄 DatabasePersistence: Sync to remote (V2 - already in PostgreSQL)', {
      count: messageIds.length
    });
  }

  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    storage: string;
  }> {
    try {
      // Contar mensajes totales
      const allMessages = await db.select().from(messages);

      const byStatus: Record<string, number> = {};

      for (const message of allMessages) {
        const statusChain = Array.isArray(message.statusChain)
          ? message.statusChain as any[]
          : [];

        const lastStatus = statusChain[statusChain.length - 1];
        const status = lastStatus?.status || 'unknown';
        byStatus[status] = (byStatus[status] || 0) + 1;
      }

      return {
        total: allMessages.length,
        byStatus,
        storage: 'postgresql'
      };
    } catch (error) {
      logger.error('❌ DatabasePersistence: Error getting stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        total: 0,
        byStatus: {},
        storage: 'postgresql'
      };
    }
  }

  /**
   * Convierte un mensaje de DB a MessageEnvelope
   */
  private dbMessageToEnvelope(dbMessage: any): MessageEnvelope {
    return {
      id: dbMessage.id,
      type: dbMessage.type,
      channel: dbMessage.channel,
      content: dbMessage.content,
      metadata: {
        ...dbMessage.metadata,
        conversationId: dbMessage.conversationId,
        ownerId: dbMessage.sentByAdminUserId,
        timestamp: dbMessage.createdAt?.toISOString() || new Date().toISOString(),
      },
      statusChain: Array.isArray(dbMessage.statusChain)
        ? dbMessage.statusChain
        : [],
      context: dbMessage.context,
    };
  }
}
