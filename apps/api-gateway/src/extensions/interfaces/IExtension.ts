/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/extensions/interfaces/IExtension.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "extensions"
 *   purpose: "Define el contrato que toda extensión debe implementar para integrarse con el Host de Extensiones"
 *
 * DEPENDENCIES:
 *   internal: ["../types"]
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["IExtension"]
 *   inputs: ["ExtensionContext"]
 *   outputs: ["Promise<ExtensionResult>", "Promise<boolean>"]
 *   errors: ["ExtensionError"]
 *
 * INTEGRATION:
 *   data_flow: "[ExtensionHost] → [IExtension.process] → [ExtensionResult]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["extensions/host/ExtensionHost", "extensions/builtin/*"]
 *   uses: ["extensions/types"]
 *   critical: true
 *
 * === DOC_END :: IExtension.ts ===
 */

import type { ExtensionMeta, ExtensionContext, ExtensionResult } from '../types';

/**
 * Contrato que toda extensión debe implementar
 *
 * Las extensiones son unidades de procesamiento que:
 * 1. Reciben contexto de mensaje (read-only)
 * 2. Producen enriquecimientos (metadata adicional)
 * 3. NO modifican el mensaje original (núcleo inmutable)
 *
 * @example
 * ```typescript
 * class SentimentExtension implements IExtension {
 *   readonly meta = { id: 'sentiment', name: 'Sentiment', version: '1.0.0', category: 'analytics' };
 *   readonly timeout = 2000;
 *
 *   async process(ctx: ExtensionContext): Promise<ExtensionResult> {
 *     const sentiment = analyzeSentiment(ctx.text);
 *     return { ok: true, enrichment: { ... } };
 *   }
 *
 *   async healthCheck() { return true; }
 * }
 * ```
 */
export interface IExtension {
  /**
   * Metadata de la extensión (inmutable)
   * Contiene id, nombre, versión, descripción, icono y categoría
   */
  readonly meta: ExtensionMeta;

  /**
   * Timeout máximo de ejecución en milisegundos
   * Si la extensión excede este tiempo, será cancelada
   * Recomendado: 1000-5000ms para extensiones síncronas
   */
  readonly timeout: number;

  /**
   * Procesa un mensaje y produce un enriquecimiento
   *
   * @param context - Contexto del mensaje (read-only, no modificar)
   * @returns ExtensionResult con enrichment o error
   *
   * @remarks
   * - Esta función DEBE ser idempotente
   * - NO debe tener efectos secundarios observables
   * - Debe completar antes del timeout
   * - Debe manejar sus propios errores y retornar ExtensionResult.error
   */
  process(context: ExtensionContext): Promise<ExtensionResult>;

  /**
   * Verifica si la extensión está operativa
   *
   * @returns true si la extensión puede procesar mensajes
   *
   * @remarks
   * - Llamado periódicamente por el host
   * - Debe ser rápido (<100ms)
   * - Útil para verificar conexiones a servicios externos
   */
  healthCheck(): Promise<boolean>;
}
