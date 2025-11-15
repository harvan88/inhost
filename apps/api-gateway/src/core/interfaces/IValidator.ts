import type { MessageEnvelopeV2 as MessageEnvelope } from '@inhost/shared';

/**
 * Resultado de validación
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Error de validación
 */
export interface ValidationError {
  field: string;                 // Campo que falló
  code: string;                  // Código de error
  message: string;               // Mensaje descriptivo
  value?: unknown;               // Valor que causó el error
}

/**
 * Reglas de validación
 */
export interface ValidationRules {
  maxTextLength?: number;        // Longitud máxima de texto
  maxMessageSize?: number;       // Tamaño máximo total del mensaje (bytes)
  maxMetadataFields?: number;    // Máximo de campos en metadata
  allowedContentTypes?: string[]; // Tipos de contenido permitidos
  requireFields?: string[];      // Campos requeridos
}

/**
 * Interface para Validador de Mensajes
 *
 * Esta interface define el contrato para validar mensajes antes de procesarlos.
 * Las implementaciones pueden variar:
 * - V1: Validación simple de tamaños
 * - V2: Validación completa con sanitización
 * - V3: Validación con reglas personalizables por canal
 *
 * @example
 * ```typescript
 * // V1: Validación simple
 * class SimpleValidator implements IValidator {
 *   validate(envelope: MessageEnvelope): ValidationResult {
 *     const errors: ValidationError[] = [];
 *
 *     if (envelope.content.text && envelope.content.text.length > 16384) {
 *       errors.push({
 *         field: 'content.text',
 *         code: 'TEXT_TOO_LONG',
 *         message: 'Text exceeds maximum length of 16384 characters'
 *       });
 *     }
 *
 *     return {
 *       valid: errors.length === 0,
 *       errors
 *     };
 *   }
 * }
 *
 * // V2: Con sanitización
 * class AdvancedValidator implements IValidator {
 *   validate(envelope: MessageEnvelope): ValidationResult {
 *     // Validar + sanitizar HTML, URLs, etc.
 *   }
 * }
 * ```
 */
export interface IValidator {
  /**
   * Validar un mensaje
   *
   * @param envelope - Mensaje a validar
   * @returns Resultado de validación
   */
  validate(envelope: MessageEnvelope): ValidationResult;

  /**
   * Validar y lanzar error si falla
   *
   * @param envelope - Mensaje a validar
   * @throws Error si la validación falla
   */
  validateOrThrow(envelope: MessageEnvelope): void;

  /**
   * Sanitizar un mensaje (limpiar HTML, URLs peligrosas, etc.)
   *
   * @param envelope - Mensaje a sanitizar
   * @returns Mensaje sanitizado
   */
  sanitize(envelope: MessageEnvelope): MessageEnvelope;

  /**
   * Configurar reglas de validación
   *
   * @param rules - Reglas de validación
   */
  configure(rules: ValidationRules): void;

  /**
   * Obtener reglas actuales
   *
   * @returns Reglas configuradas
   */
  getRules(): ValidationRules;
}
