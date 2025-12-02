/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/extensions/builtin/SentimentExtension.ts"
 *   type: "service"
 *   layer: "backend"
 *   domain: "extensions"
 *   purpose: "Extensión builtin que analiza el sentimiento de mensajes usando reglas simples basadas en keywords (MVP)"
 *
 * DEPENDENCIES:
 *   internal: ["../interfaces/IExtension", "../types"]
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["SentimentExtension"]
 *   inputs: ["ExtensionContext"]
 *   outputs: ["ExtensionResult with SentimentPayload"]
 *   errors: []
 *
 * INTEGRATION:
 *   data_flow: "[ExtensionHost] → [SentimentExtension.process] → [SentimentPayload]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["services/index.ts"]
 *   uses: ["../interfaces/IExtension", "../types"]
 *   critical: false
 *
 * === DOC_END :: SentimentExtension.ts ===
 */

import type { IExtension } from '../interfaces/IExtension';
import type {
  ExtensionMeta,
  ExtensionContext,
  ExtensionResult,
  SentimentPayload,
} from '../types';

/**
 * Extensión de análisis de sentimiento (MVP)
 *
 * Usa reglas simples basadas en keywords para detectar sentimiento.
 * En producción, se reemplazaría por un modelo ML real.
 *
 * @example
 * Input: "Excelente servicio, muchas gracias!"
 * Output: { score: 0.8, label: 'positive' }
 *
 * @example
 * Input: "Este producto es terrible, estoy muy molesto"
 * Output: { score: -0.7, label: 'negative' }
 */
export class SentimentExtension implements IExtension {
  readonly meta: ExtensionMeta = {
    id: 'builtin-sentiment',
    name: 'Sentiment Analyzer',
    version: '1.0.0',
    description: 'Analyzes message sentiment using keyword-based rules',
    icon: '😊',
    category: 'analytics',
  };

  readonly timeout = 1000; // 1 segundo

  // ─── Diccionarios de palabras ───

  private readonly positiveWords = new Set([
    // Español
    'gracias', 'excelente', 'genial', 'perfecto', 'bueno', 'buena',
    'feliz', 'encanta', 'bien', 'super', 'increíble', 'maravilloso',
    'fantástico', 'amor', 'amo', 'agradezco', 'contento', 'contenta',
    'satisfecho', 'satisfecha', 'recomiendo', 'mejor', 'útil',
    // English
    'thanks', 'thank', 'excellent', 'great', 'perfect', 'good',
    'happy', 'love', 'amazing', 'wonderful', 'fantastic', 'awesome',
    'satisfied', 'recommend', 'best', 'helpful',
  ]);

  private readonly negativeWords = new Set([
    // Español
    'malo', 'mala', 'terrible', 'horrible', 'problema', 'problemas',
    'error', 'errores', 'falla', 'fallas', 'queja', 'quejas',
    'enojado', 'enojada', 'molesto', 'molesta', 'frustrado', 'frustrada',
    'nunca', 'peor', 'odio', 'decepcionado', 'decepcionada', 'inútil',
    'lento', 'lenta', 'difícil', 'imposible', 'mal',
    // English
    'bad', 'terrible', 'horrible', 'problem', 'problems', 'error',
    'errors', 'fail', 'complaint', 'angry', 'upset', 'frustrated',
    'never', 'worst', 'hate', 'disappointed', 'useless', 'slow',
    'difficult', 'impossible', 'wrong',
  ]);

  private readonly intensifiers = new Set([
    'muy', 'mucho', 'mucha', 'demasiado', 'extremadamente', 'totalmente',
    'completamente', 'absolutamente', 'really', 'very', 'extremely',
    'totally', 'completely', 'absolutely', 'so',
  ]);

  /**
   * Procesa un mensaje y produce un enriquecimiento de sentimiento
   */
  async process(context: ExtensionContext): Promise<ExtensionResult> {
    const text = context.text.toLowerCase();
    const words = this.tokenize(text);

    let positiveCount = 0;
    let negativeCount = 0;
    let hasIntensifier = false;

    // Detectar intensificadores
    for (const word of words) {
      if (this.intensifiers.has(word)) {
        hasIntensifier = true;
        break;
      }
    }

    // Contar palabras positivas y negativas
    for (const word of words) {
      if (this.positiveWords.has(word)) positiveCount++;
      if (this.negativeWords.has(word)) negativeCount++;
    }

    // Calcular score (-1 a 1)
    const total = positiveCount + negativeCount;
    let score = 0;
    let label: SentimentPayload['label'] = 'neutral';

    if (total > 0) {
      score = (positiveCount - negativeCount) / total;

      // Aplicar intensificador
      if (hasIntensifier) {
        score = score * 1.3;
        score = Math.max(-1, Math.min(1, score)); // Clamp
      }

      // Determinar label
      if (score > 0.2) label = 'positive';
      else if (score < -0.2) label = 'negative';
    }

    // Calcular confianza basada en evidencia
    const confidence = this.calculateConfidence(total, words.length);

    const payload: SentimentPayload = {
      score: Math.round(score * 100) / 100, // 2 decimales
      label,
    };

    return {
      ok: true,
      enrichment: {
        messageId: context.messageId,
        extensionId: this.meta.id,
        tenantId: context.tenantId,
        type: 'sentiment',
        payload,
        confidence,
        processingTimeMs: 0, // Se calcula en el host
      },
    };
  }

  /**
   * Tokeniza texto en palabras
   */
  private tokenize(text: string): string[] {
    return text
      .replace(/[^\wáéíóúñü\s]/gi, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 1);
  }

  /**
   * Calcula confianza basada en cantidad de evidencia
   */
  private calculateConfidence(matchCount: number, totalWords: number): number {
    if (totalWords === 0) return 0.3;
    if (matchCount === 0) return 0.4;

    // Más matches y más palabras = más confianza
    const ratio = matchCount / Math.min(totalWords, 20);
    return Math.min(0.5 + ratio * 0.4, 0.9);
  }

  /**
   * Health check - siempre healthy (no dependencias externas)
   */
  async healthCheck(): Promise<boolean> {
    return true;
  }
}
