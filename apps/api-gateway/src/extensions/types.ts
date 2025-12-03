/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/extensions/types.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "extensions"
 *   purpose: "Define tipos fundamentales del sistema de extensiones: ExtensionMeta, ExtensionContext, Enrichment, y payloads específicos por tipo de enriquecimiento"
 *
 * DEPENDENCIES:
 *   internal: []
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["ExtensionMeta", "ExtensionCategory", "ExtensionContext", "Enrichment", "EnrichmentType", "EnrichmentPayload", "SentimentPayload", "KeywordsPayload", "IntentPayload", "AISuggestionPayload", "CustomPayload", "ExtensionResult", "ExtensionError", "TenantExtensionConfig"]
 *   inputs: []
 *   outputs: []
 *   errors: []
 *
 * INTEGRATION:
 *   data_flow: "[Extension] → [types] → [ExtensionHost] → [Persistence/WebSocket]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["extensions/interfaces/IExtension", "extensions/interfaces/IExtensionHost", "extensions/host/ExtensionHost", "extensions/builtin/*"]
 *   uses: []
 *   critical: true
 *
 * === DOC_END :: types.ts ===
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXTENSION IDENTITY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Categorías de extensiones disponibles
 */
export type ExtensionCategory =
  | 'ai'           // AI/ML processing
  | 'analytics'    // Data analysis
  | 'integration'  // External services
  | 'utility';     // General utilities

/**
 * Metadata que identifica una extensión
 */
export interface ExtensionMeta {
  /** Identificador único de la extensión (e.g., "sentiment-analyzer") */
  id: string;
  /** Nombre legible (e.g., "Sentiment Analyzer") */
  name: string;
  /** Versión semántica (e.g., "1.0.0") */
  version: string;
  /** Descripción breve de la funcionalidad */
  description?: string;
  /** Icono (emoji o URL) */
  icon?: string;
  /** Categoría de la extensión */
  category: ExtensionCategory;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXTENSION CONTEXT (Input)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Contexto proporcionado a una extensión para procesar un mensaje
 * Este contexto es READ-ONLY - las extensiones no pueden modificarlo
 */
export interface ExtensionContext {
  // ─── Identificadores ───
  /** ID del tenant (organización) */
  tenantId: string;
  /** ID del mensaje siendo procesado */
  messageId: string;
  /** ID de la conversación */
  conversationId: string;

  // ─── Contenido del mensaje ───
  /** Texto del mensaje */
  text: string;
  /** Tipo de contenido (e.g., "text/plain", "image/png") */
  contentType: string;
  /** Canal de origen (e.g., "whatsapp", "telegram") */
  channel: string;
  /** Dirección del mensaje */
  type: 'incoming' | 'outgoing';

  // ─── Metadata ───
  /** Remitente del mensaje */
  from: string;
  /** Destinatario del mensaje */
  to: string;
  /** Timestamp ISO del mensaje */
  timestamp: string;

  // ─── Contexto adicional (opcional) ───
  /** Historial reciente de la conversación */
  history?: Array<{
    id: string;
    text: string;
    type: 'incoming' | 'outgoing';
    timestamp: string;
  }>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ENRICHMENT (Output)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Tipos de enriquecimiento que una extensión puede producir
 */
export type EnrichmentType =
  | 'sentiment'
  | 'keywords'
  | 'intent'
  | 'ai_suggestion'
  | 'ai_response'
  | 'entity_extraction'
  | 'language_detection'
  | 'priority_score'
  | 'custom';

/**
 * Un enriquecimiento producido por una extensión
 * Se almacena separado del mensaje core (inmutable)
 */
export interface Enrichment {
  /** ID único del enriquecimiento */
  id: string;
  /** ID del mensaje enriquecido */
  messageId: string;
  /** ID de la extensión que lo produjo */
  extensionId: string;
  /** ID del tenant */
  tenantId: string;

  // ─── Datos del enriquecimiento ───
  /** Tipo de enriquecimiento */
  type: EnrichmentType;
  /** Datos específicos según el tipo */
  payload: EnrichmentPayload;

  // ─── Metadata ───
  /** Nivel de confianza (0-1) */
  confidence?: number;
  /** Tiempo de procesamiento en ms */
  processingTimeMs: number;
  /** Timestamp de creación */
  createdAt: string;
  /** TTL opcional para expiración */
  expiresAt?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ENRICHMENT PAYLOADS (Específicos por tipo)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Union de todos los tipos de payload posibles
 */
export type EnrichmentPayload =
  | SentimentPayload
  | KeywordsPayload
  | IntentPayload
  | AISuggestionPayload
  | AIResponsePayload
  | EntityExtractionPayload
  | LanguageDetectionPayload
  | PriorityScorePayload
  | CustomPayload;

/**
 * Payload para análisis de sentimiento
 */
export interface SentimentPayload {
  /** Score de sentimiento (-1 a 1) */
  score: number;
  /** Etiqueta legible */
  label: 'positive' | 'neutral' | 'negative';
  /** Emociones detectadas (opcional) */
  emotions?: string[];
}

/**
 * Payload para extracción de keywords
 */
export interface KeywordsPayload {
  /** Lista de keywords extraídas */
  keywords: string[];
  /** Relevancia por keyword (opcional) */
  relevance?: Record<string, number>;
}

/**
 * Payload para clasificación de intención
 */
export interface IntentPayload {
  /** Intención principal detectada */
  intent: string;
  /** Confianza en la clasificación */
  confidence: number;
  /** Intenciones alternativas */
  alternatives?: Array<{ intent: string; confidence: number }>;
}

/**
 * Payload para sugerencias de AI
 */
export interface AISuggestionPayload {
  /** Sugerencia principal */
  suggestion: string;
  /** Sugerencias alternativas */
  alternatives?: string[];
  /** Contexto usado para generar */
  context?: string;
}

/**
 * Payload para respuestas de AI (FluxCore)
 */
export interface AIResponsePayload {
  /** Modo de respuesta */
  mode: 'auto' | 'pre-approval' | 'blocked';
  /** Respuesta generada */
  response?: string;
  /** Razón si está bloqueado */
  reason?: string;
  /** Límite restante del usuario */
  remainingLimit?: number;
  /** Modelo usado */
  model?: string;
  /** Tokens usados */
  tokensUsed?: number;
}

/**
 * Payload para extracción de entidades
 */
export interface EntityExtractionPayload {
  /** Entidades extraídas */
  entities: Array<{
    type: string;    // "person", "location", "organization", "date", etc.
    value: string;
    start: number;   // posición en el texto
    end: number;
  }>;
}

/**
 * Payload para detección de idioma
 */
export interface LanguageDetectionPayload {
  /** Código de idioma (ISO 639-1) */
  language: string;
  /** Confianza */
  confidence: number;
  /** Idiomas alternativos */
  alternatives?: Array<{ language: string; confidence: number }>;
}

/**
 * Payload para score de prioridad
 */
export interface PriorityScorePayload {
  /** Score de prioridad (0-100) */
  score: number;
  /** Nivel de prioridad */
  level: 'low' | 'medium' | 'high' | 'urgent';
  /** Factores que contribuyeron al score */
  factors?: string[];
}

/**
 * Payload genérico para extensiones custom
 */
export interface CustomPayload {
  [key: string]: unknown;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXTENSION RESULT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Resultado de procesar un mensaje con una extensión
 * Usa patrón Result para manejo explícito de errores
 */
export type ExtensionResult =
  | { ok: true; enrichment: Omit<Enrichment, 'id' | 'createdAt'> }
  | { ok: false; error: ExtensionError };

/**
 * Error producido por una extensión
 */
export interface ExtensionError {
  /** Código de error */
  code: string;
  /** Mensaje descriptivo */
  message: string;
  /** Indica si se puede reintentar */
  recoverable: boolean;
  /** Detalles adicionales */
  details?: unknown;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TENANT EXTENSION CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Configuración de una extensión para un tenant específico
 */
export interface TenantExtensionConfig {
  /** ID de la extensión */
  extensionId: string;
  /** ID del tenant */
  tenantId: string;
  /** Si está habilitada */
  enabled: boolean;
  /** Configuración específica de la extensión */
  config?: Record<string, unknown>;
  /** Prioridad de ejecución (menor = primero) */
  priority?: number;
  /** Timestamp de creación */
  createdAt: string;
  /** Timestamp de última actualización */
  updatedAt: string;
}
