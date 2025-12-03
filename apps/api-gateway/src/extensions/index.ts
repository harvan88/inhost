/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/extensions/index.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "extensions"
 *   purpose: "Barrel export principal del módulo de extensiones: tipos, interfaces, host e implementaciones builtin"
 *
 * DEPENDENCIES:
 *   internal: ["./types", "./interfaces", "./host", "./builtin"]
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["ExtensionHost", "SentimentExtension", "KeywordExtension", "IExtension", "IExtensionHost", "ExtensionHostStats", "ProcessingResult", "ExtensionMeta", "ExtensionCategory", "ExtensionContext", "Enrichment", "EnrichmentType", "EnrichmentPayload", "SentimentPayload", "KeywordsPayload", "IntentPayload", "AISuggestionPayload", "CustomPayload", "ExtensionResult", "ExtensionError", "TenantExtensionConfig"]
 *   inputs: []
 *   outputs: []
 *   errors: []
 *
 * INTEGRATION:
 *   data_flow: "Punto de entrada único para el módulo de extensiones"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["services/index.ts", "routes/*"]
 *   uses: ["./types", "./interfaces", "./host", "./builtin"]
 *   critical: true
 *
 * === DOC_END :: index.ts ===
 */

// ─── Types ───
export type {
  ExtensionMeta,
  ExtensionCategory,
  ExtensionContext,
  Enrichment,
  EnrichmentType,
  EnrichmentPayload,
  SentimentPayload,
  KeywordsPayload,
  IntentPayload,
  AISuggestionPayload,
  AIResponsePayload,
  EntityExtractionPayload,
  LanguageDetectionPayload,
  PriorityScorePayload,
  CustomPayload,
  ExtensionResult,
  ExtensionError,
  TenantExtensionConfig,
} from './types';

// ─── Interfaces ───
export type {
  IExtension,
  IExtensionHost,
  ExtensionHostStats,
  ProcessingResult,
} from './interfaces';

// ─── Host ───
export { ExtensionHost } from './host';

// ─── Builtin Extensions ───
export { SentimentExtension, KeywordExtension, FluxCoreExtension } from './builtin';
