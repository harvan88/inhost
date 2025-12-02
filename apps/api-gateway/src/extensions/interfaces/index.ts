/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/extensions/interfaces/index.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "extensions"
 *   purpose: "Barrel export para interfaces del sistema de extensiones"
 *
 * DEPENDENCIES:
 *   internal: ["./IExtension", "./IExtensionHost"]
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["IExtension", "IExtensionHost", "ExtensionHostStats", "ProcessingResult"]
 *   inputs: []
 *   outputs: []
 *   errors: []
 *
 * INTEGRATION:
 *   data_flow: "Re-export de interfaces"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["extensions/index.ts", "extensions/host/*", "extensions/builtin/*"]
 *   uses: ["./IExtension", "./IExtensionHost"]
 *   critical: false
 *
 * === DOC_END :: index.ts ===
 */

export type { IExtension } from './IExtension';
export type {
  IExtensionHost,
  ExtensionHostStats,
  ProcessingResult,
} from './IExtensionHost';
