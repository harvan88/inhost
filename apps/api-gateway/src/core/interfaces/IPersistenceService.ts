/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/core/interfaces/IPersistenceService.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "database"
 *   purpose: "Interface contract que define el contrato para servicios de persistencia de mensajes con garantías locales y sincronización remota"
 *
 * DEPENDENCIES:
 *   internal: ["@inhost/shared"]
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["IPersistenceService", "PersistenceResult", "MessageQuery"]
 *   inputs: ["MessageEnvelope", "MessageQuery", "string:messageId", "MessageStatus"]
 *   outputs: ["Promise<PersistenceResult>", "Promise<void>", "Promise<MessageEnvelope | null>", "Promise<MessageEnvelope[]>"]
 *   errors: ["PersistenceResult.error"]
 *
 * INTEGRATION:
 *   data_flow: "[Persistence implementations] → [interface contract] ← [MessageCore consumers]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["MessageCore", "implementations/v1/MemoryPersistence"]
 *   uses: ["@inhost/shared"]
 *   critical: true
 *
 * === DOC_END :: IPersistenceService.ts ===
 */

/**
 * IPersistenceService
 *
 * Contrato para servicios de persistencia de mensajes.
 * Garantiza guardado local y remoto según el plan.
 *
 * Implementaciones:
 * - V1: Memoria + IndexedDB simulado
 * - V2: PostgreSQL + Redis
 * - V3: Multi-región con replicación
 */

import type { MessageEnvelopeV2 as MessageEnvelope } from '@inhost/shared';
import { MessageStatus } from '@inhost/shared';

export interface PersistenceResult {
  success: boolean;
  messageId: string;
  savedAt: string;
  storage: 'memory' | 'indexeddb' | 'postgresql' | 'redis';
  error?: {
    code: string;
    message: string;
  };
}

export interface MessageQuery {
  userId?: string;
  conversationId?: string;
  channel?: string;
  status?: MessageStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface IPersistenceService {
  /**
   * Guarda un mensaje con garantías locales
   */
  save(envelope: MessageEnvelope): Promise<PersistenceResult>;

  /**
   * Actualiza el estado de un mensaje
   */
  updateStatus(messageId: string, status: MessageStatus, timestamp?: string): Promise<void>;

  /**
   * Obtiene un mensaje por ID
   */
  get(messageId: string): Promise<MessageEnvelope | null>;

  /**
   * Busca mensajes según criterios
   */
  query(criteria: MessageQuery): Promise<MessageEnvelope[]>;

  /**
   * Elimina un mensaje (soft delete)
   */
  delete(messageId: string): Promise<void>;

  /**
   * Sincroniza mensajes locales con remoto
   */
  syncToRemote(messageIds: string[]): Promise<void>;

  /**
   * Obtiene estadísticas de almacenamiento
   */
  getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    storage: string;
  }>;
}
