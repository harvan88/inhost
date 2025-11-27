/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/implementations/v1/MemoryPersistence.ts"
 *   type: "service"
 *   layer: "backend"
 *   domain: "database"
 *   purpose: "Implementación V1 de IPersistenceService usando almacenamiento en memoria (Map) para desarrollo y testing, simula IndexedDB con pérdida de datos al reiniciar"
 *
 * DEPENDENCIES:
 *   internal: ["@inhost/shared", "../../core/interfaces", "../../middleware/logger"]
 *   external: []
 *   infrastructure: ["memory"]
 *
 * CONTRACTS:
 *   exports: ["MemoryPersistence"]
 *   inputs: ["MessageEnvelope", "MessageQuery", "string:messageId", "MessageStatus"]
 *   outputs: ["Promise<PersistenceResult>", "Promise<void>", "Promise<MessageEnvelope | null>", "Promise<MessageEnvelope[]>"]
 *   errors: ["SAVE_ERROR"]
 *
 * INTEGRATION:
 *   data_flow: "[MessageCore] → [save/updateStatus/query/delete methods] → [in-memory Map<string, MessageEnvelope>] → [results]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["MessageCore", "services/index.ts"]
 *   uses: ["IPersistenceService", "middleware/logger"]
 *   critical: true
 *
 * === DOC_END :: MemoryPersistence.ts ===
 */

/**
 * MemoryPersistence (V1)
 *
 * Implementación simple de persistencia en memoria.
 * Simula IndexedDB del navegador.
 *
 * Características V1:
 * - Almacenamiento en memoria (Map)
 * - Pérdida de datos al reiniciar
 * - Ideal para desarrollo y testing
 *
 * V2 usará PostgreSQL real
 * V3 agregará replicación multi-región
 */

import type { MessageEnvelopeV2 as MessageEnvelope } from '@inhost/shared';
import { MessageStatus } from '@inhost/shared';
import type {
  IPersistenceService,
  PersistenceResult,
  MessageQuery
} from '../../core/interfaces';
import { logger } from '../../middleware/logger';

export class MemoryPersistence implements IPersistenceService {
  private messages: Map<string, MessageEnvelope> = new Map();
  private stats = {
    totalSaved: 0,
    totalUpdated: 0,
    totalDeleted: 0
  };

  async save(envelope: MessageEnvelope): Promise<PersistenceResult> {
    try {
      this.messages.set(envelope.id, {
        ...envelope,
        // Asegurar que tiene statusChain
        statusChain: envelope.statusChain || [{
          status: MessageStatus.RECEIVED,
          timestamp: new Date().toISOString(),
          messageId: envelope.id
        }]
      });

      this.stats.totalSaved++;

      logger.debug('💾 MemoryPersistence: Message saved', {
        id: envelope.id,
        total: this.messages.size
      });

      return {
        success: true,
        messageId: envelope.id,
        savedAt: new Date().toISOString(),
        storage: 'memory'
      };
    } catch (error) {
      logger.error('❌ MemoryPersistence: Error saving message', {
        id: envelope.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        messageId: envelope.id,
        savedAt: new Date().toISOString(),
        storage: 'memory',
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
    const message = this.messages.get(messageId);

    if (!message) {
      logger.warn('⚠️  MemoryPersistence: Message not found for status update', {
        messageId
      });
      return;
    }

    // Agregar estado al statusChain
    const statusEntry = {
      status,
      timestamp: timestamp || new Date().toISOString(),
      messageId
    };

    message.statusChain = message.statusChain || [];
    message.statusChain.push(statusEntry);

    this.messages.set(messageId, message);
    this.stats.totalUpdated++;

    logger.debug('🔄 MemoryPersistence: Status updated', {
      messageId,
      status
    });
  }

  async get(messageId: string): Promise<MessageEnvelope | null> {
    const message = this.messages.get(messageId);
    return message || null;
  }

  async query(criteria: MessageQuery): Promise<MessageEnvelope[]> {
    let results = Array.from(this.messages.values());

    // Filtrar por criterios
    if (criteria.userId) {
      results = results.filter(m => m.metadata?.ownerId === criteria.userId);
    }

    if (criteria.channel) {
      results = results.filter(m => m.channel === criteria.channel);
    }

    if (criteria.status) {
      results = results.filter(m => {
        const lastStatus = m.statusChain?.[m.statusChain.length - 1];
        return lastStatus?.status === criteria.status;
      });
    }

    if (criteria.startDate) {
      results = results.filter(m => {
        const timestamp = m.metadata?.timestamp;
        if (!timestamp) return false;
        return new Date(timestamp) >= criteria.startDate!;
      });
    }

    if (criteria.endDate) {
      results = results.filter(m => {
        const timestamp = m.metadata?.timestamp;
        if (!timestamp) return false;
        return new Date(timestamp) <= criteria.endDate!;
      });
    }

    // Ordenar por timestamp descendente (más reciente primero)
    results.sort((a, b) => {
      const aTime = a.metadata?.timestamp || '';
      const bTime = b.metadata?.timestamp || '';
      return bTime.localeCompare(aTime);
    });

    // Aplicar paginación
    const offset = criteria.offset || 0;
    const limit = criteria.limit || 100;
    results = results.slice(offset, offset + limit);

    return results;
  }

  async delete(messageId: string): Promise<void> {
    const message = this.messages.get(messageId);

    if (message) {
      // Soft delete - marcar como eliminado
      await this.updateStatus(messageId, MessageStatus.FAILED); // Usar FAILED como "deleted"
      this.stats.totalDeleted++;

      logger.debug('🗑️  MemoryPersistence: Message deleted (soft)', {
        messageId
      });
    }
  }

  async syncToRemote(messageIds: string[]): Promise<void> {
    // V1: No hace nada (no hay remoto)
    // V2: Sincronizará con PostgreSQL
    logger.debug('🔄 MemoryPersistence: Sync to remote (V1 - noop)', {
      count: messageIds.length
    });
  }

  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    storage: string;
  }> {
    const byStatus: Record<string, number> = {};

    for (const message of this.messages.values()) {
      const lastStatus = message.statusChain?.[message.statusChain.length - 1];
      const status = lastStatus?.status || 'unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;
    }

    return {
      total: this.messages.size,
      byStatus,
      storage: 'memory'
    };
  }

  /**
   * Limpia todos los mensajes (útil para testing)
   */
  clear(): void {
    this.messages.clear();
    logger.info('🧹 MemoryPersistence: All messages cleared');
  }
}
