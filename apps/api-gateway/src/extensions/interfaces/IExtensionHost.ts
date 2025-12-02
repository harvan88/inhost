/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/extensions/interfaces/IExtensionHost.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "extensions"
 *   purpose: "Define el contrato del Host de Extensiones que orquesta el ciclo de vida, ejecución y agregación de extensiones"
 *
 * DEPENDENCIES:
 *   internal: ["../types", "./IExtension"]
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["IExtensionHost", "ExtensionHostStats", "ProcessingResult"]
 *   inputs: ["IExtension", "ExtensionContext"]
 *   outputs: ["ProcessingResult", "ExtensionHostStats"]
 *   errors: []
 *
 * INTEGRATION:
 *   data_flow: "[MessageCore] → [IExtensionHost.processMessage] → [Enrichments] → [Persistence/WebSocket]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["services/index.ts", "routes/simulation.ts"]
 *   uses: ["extensions/types", "extensions/interfaces/IExtension"]
 *   critical: true
 *
 * === DOC_END :: IExtensionHost.ts ===
 */

import type { ExtensionContext, Enrichment } from '../types';
import type { IExtension } from './IExtension';

/**
 * Estadísticas del Host de Extensiones
 */
export interface ExtensionHostStats {
  /** Total de extensiones registradas */
  totalExtensions: number;
  /** Extensiones actualmente activas */
  activeExtensions: number;
  /** Total de mensajes procesados */
  totalProcessed: number;
  /** Total de errores acumulados */
  totalErrors: number;
  /** Tiempo promedio de procesamiento (ms) */
  averageProcessingTimeMs: number;
}

/**
 * Resultado del procesamiento de un mensaje por todas las extensiones
 */
export interface ProcessingResult {
  /** ID del mensaje procesado */
  messageId: string;
  /** Enriquecimientos producidos por las extensiones */
  enrichments: Enrichment[];
  /** Errores ocurridos durante el procesamiento */
  errors: Array<{
    extensionId: string;
    error: string;
    recoverable: boolean;
  }>;
  /** Tiempo total de procesamiento (ms) */
  totalTimeMs: number;
}

/**
 * Contrato del Host de Extensiones
 *
 * El Host es el orquestador central que:
 * 1. Registra y gestiona extensiones
 * 2. Ejecuta extensiones en paralelo con timeout
 * 3. Aísla fallos por extensión (una falla no afecta otras)
 * 4. Agrega resultados de todas las extensiones
 *
 * @example
 * ```typescript
 * // En services/index.ts
 * const host = new ExtensionHost();
 * host.register(new SentimentExtension());
 * host.register(new KeywordExtension());
 *
 * // En el flujo de mensajes
 * const result = await host.processMessage(context);
 * // result.enrichments contiene los enriquecimientos
 * ```
 */
export interface IExtensionHost {
  /**
   * Registra una extensión en el host
   *
   * @param extension - Extensión a registrar
   *
   * @remarks
   * - Si ya existe una extensión con el mismo ID, será reemplazada
   * - La extensión estará disponible inmediatamente para procesar mensajes
   */
  register(extension: IExtension): void;

  /**
   * Desregistra una extensión del host
   *
   * @param extensionId - ID de la extensión a remover
   *
   * @remarks
   * - Si la extensión no existe, no hace nada (idempotente)
   * - Los mensajes en procesamiento con esta extensión continuarán
   */
  unregister(extensionId: string): void;

  /**
   * Obtiene las extensiones habilitadas para un tenant
   *
   * @param tenantId - ID del tenant
   * @returns Lista de extensiones habilitadas
   *
   * @remarks
   * - MVP: retorna todas las extensiones registradas
   * - Futuro: filtra por configuración de tenant en DB
   */
  getEnabledExtensions(tenantId: string): Promise<IExtension[]>;

  /**
   * Procesa un mensaje con todas las extensiones habilitadas del tenant
   *
   * @param context - Contexto del mensaje (read-only)
   * @returns Resultado con enriquecimientos y errores
   *
   * @remarks
   * - Ejecuta extensiones en PARALELO para minimizar latencia
   * - Cada extensión tiene su propio timeout
   * - Fallos son aislados: una extensión que falla no afecta otras
   * - Siempre retorna un resultado, nunca lanza excepciones
   */
  processMessage(context: ExtensionContext): Promise<ProcessingResult>;

  /**
   * Obtiene estadísticas del host
   *
   * @returns Estadísticas actuales
   */
  getStats(): ExtensionHostStats;

  /**
   * Ejecuta health check de todas las extensiones
   *
   * @returns Mapa de extensionId → healthy
   */
  healthCheck(): Promise<Map<string, boolean>>;
}
