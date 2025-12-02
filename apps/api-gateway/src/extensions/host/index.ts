/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/extensions/host/index.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "extensions"
 *   purpose: "Barrel export para el módulo host de extensiones"
 *
 * DEPENDENCIES:
 *   internal: ["./ExtensionHost"]
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["ExtensionHost"]
 *   inputs: []
 *   outputs: []
 *   errors: []
 *
 * INTEGRATION:
 *   data_flow: "Re-export de ExtensionHost"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["extensions/index.ts", "services/index.ts"]
 *   uses: ["./ExtensionHost"]
 *   critical: false
 *
 * === DOC_END :: index.ts ===
 */

export { ExtensionHost } from './ExtensionHost';
