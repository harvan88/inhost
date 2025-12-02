/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/extensions/builtin/KeywordExtension.ts"
 *   type: "service"
 *   layer: "backend"
 *   domain: "extensions"
 *   purpose: "Extensión builtin que extrae keywords relevantes de mensajes filtrando stopwords y calculando relevancia por frecuencia (MVP)"
 *
 * DEPENDENCIES:
 *   internal: ["../interfaces/IExtension", "../types"]
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["KeywordExtension"]
 *   inputs: ["ExtensionContext"]
 *   outputs: ["ExtensionResult with KeywordsPayload"]
 *   errors: []
 *
 * INTEGRATION:
 *   data_flow: "[ExtensionHost] → [KeywordExtension.process] → [KeywordsPayload]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["services/index.ts"]
 *   uses: ["../interfaces/IExtension", "../types"]
 *   critical: false
 *
 * === DOC_END :: KeywordExtension.ts ===
 */

import type { IExtension } from '../interfaces/IExtension';
import type {
  ExtensionMeta,
  ExtensionContext,
  ExtensionResult,
  KeywordsPayload,
} from '../types';

/**
 * Extensión de extracción de keywords (MVP)
 *
 * Extrae palabras clave filtrando stopwords y calculando relevancia
 * por frecuencia de aparición.
 *
 * @example
 * Input: "Necesito ayuda con mi pedido #12345, el producto llegó dañado"
 * Output: { keywords: ['pedido', '12345', 'producto', 'dañado', 'ayuda'], relevance: {...} }
 */
export class KeywordExtension implements IExtension {
  readonly meta: ExtensionMeta = {
    id: 'builtin-keywords',
    name: 'Keyword Extractor',
    version: '1.0.0',
    description: 'Extracts relevant keywords from messages',
    icon: '🏷️',
    category: 'analytics',
  };

  readonly timeout = 1000; // 1 segundo

  /** Número máximo de keywords a retornar */
  private readonly MAX_KEYWORDS = 5;

  /** Longitud mínima de palabra para considerar */
  private readonly MIN_WORD_LENGTH = 3;

  // ─── Stopwords (palabras a ignorar) ───

  private readonly stopwords = new Set([
    // Español - Artículos
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
    // Español - Preposiciones
    'de', 'del', 'al', 'a', 'en', 'con', 'por', 'para', 'sin', 'sobre',
    'entre', 'hasta', 'desde', 'hacia', 'según',
    // Español - Conjunciones
    'y', 'o', 'pero', 'sino', 'aunque', 'porque', 'pues', 'que', 'si',
    // Español - Pronombres
    'yo', 'tu', 'él', 'ella', 'nosotros', 'ellos', 'ellas', 'usted', 'ustedes',
    'mi', 'tu', 'su', 'me', 'te', 'se', 'le', 'lo', 'nos', 'les', 'esto',
    'eso', 'este', 'ese', 'esta', 'esa', 'estos', 'esos',
    // Español - Verbos comunes
    'es', 'son', 'está', 'están', 'ser', 'estar', 'hay', 'fue', 'era',
    'tiene', 'tienen', 'tengo', 'hacer', 'hago', 'hace', 'poder', 'puedo',
    'puede', 'quiero', 'quiere', 'saber', 'sé', 'sabe',
    // Español - Adverbios y otros
    'muy', 'más', 'menos', 'también', 'solo', 'ya', 'aún', 'bien', 'mal',
    'como', 'cuando', 'donde', 'qué', 'cómo', 'cuál', 'quién', 'cuándo',
    'no', 'sí', 'aquí', 'ahí', 'allí', 'así', 'tan',
    // Español - Saludos y cortesía
    'hola', 'buenos', 'buenas', 'días', 'tardes', 'noches', 'gracias',
    'por', 'favor', 'disculpa', 'disculpe', 'perdón',
    // English - Articles
    'the', 'a', 'an',
    // English - Prepositions
    'of', 'to', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    // English - Conjunctions
    'and', 'or', 'but', 'if', 'because', 'that', 'which', 'who',
    // English - Pronouns
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his',
    'her', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
    // English - Common verbs
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
    'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'can', 'may', 'might', 'must', 'get', 'got',
    // English - Adverbs and others
    'not', 'no', 'yes', 'very', 'just', 'also', 'only', 'here', 'there',
    'when', 'where', 'how', 'what', 'why', 'all', 'each', 'some', 'any',
  ]);

  /**
   * Procesa un mensaje y extrae keywords
   */
  async process(context: ExtensionContext): Promise<ExtensionResult> {
    const text = context.text.toLowerCase();
    const words = this.tokenize(text);

    // Filtrar stopwords y palabras cortas
    const meaningfulWords = words.filter(
      (word) =>
        word.length >= this.MIN_WORD_LENGTH &&
        !this.stopwords.has(word) &&
        !/^\d+$/.test(word) // Excluir números puros (pero mantener alfanuméricos)
    );

    // Contar frecuencias
    const freq = new Map<string, number>();
    for (const word of meaningfulWords) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }

    // Ordenar por frecuencia y tomar top N
    const sortedWords = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.MAX_KEYWORDS);

    const keywords = sortedWords.map(([word]) => word);

    // Calcular relevancia normalizada (0-1)
    const maxFreq = sortedWords.length > 0 ? sortedWords[0][1] : 1;
    const relevance: Record<string, number> = {};
    for (const [word, count] of sortedWords) {
      relevance[word] = Math.round((count / maxFreq) * 100) / 100;
    }

    const payload: KeywordsPayload = {
      keywords,
      relevance,
    };

    // Calcular confianza
    const confidence = this.calculateConfidence(keywords.length, words.length);

    return {
      ok: true,
      enrichment: {
        messageId: context.messageId,
        extensionId: this.meta.id,
        tenantId: context.tenantId,
        type: 'keywords',
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
    // Preservar números con # (como #12345)
    return text
      .replace(/#(\w+)/g, '$1') // Remover # pero mantener el contenido
      .replace(/[^\wáéíóúñü\s]/gi, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 0);
  }

  /**
   * Calcula confianza basada en cantidad de keywords extraídas
   */
  private calculateConfidence(keywordCount: number, totalWords: number): number {
    if (totalWords === 0) return 0.3;
    if (keywordCount === 0) return 0.4;

    // Más keywords extraídas = más confianza (hasta cierto punto)
    const ratio = keywordCount / this.MAX_KEYWORDS;
    return Math.min(0.5 + ratio * 0.4, 0.9);
  }

  /**
   * Health check - siempre healthy (no dependencias externas)
   */
  async healthCheck(): Promise<boolean> {
    return true;
  }
}
