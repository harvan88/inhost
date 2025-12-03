/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/extensions/builtin/index.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "extensions"
 *   purpose: "Barrel export para extensiones builtin del sistema"
 *
 * DEPENDENCIES:
 *   internal: ["./SentimentExtension", "./KeywordExtension"]
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["SentimentExtension", "KeywordExtension"]
 *   inputs: []
 *   outputs: []
 *   errors: []
 *
 * INTEGRATION:
 *   data_flow: "Re-export de extensiones builtin"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["extensions/index.ts", "services/index.ts"]
 *   uses: ["./SentimentExtension", "./KeywordExtension"]
 *   critical: false
 *
 * === DOC_END :: index.ts ===
 */

export { SentimentExtension } from './SentimentExtension';
export { KeywordExtension } from './KeywordExtension';
export { FluxCoreExtension } from './FluxCoreExtension';
