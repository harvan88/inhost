/**
 * Simple Validator V1
 *
 * Implementación simple de validación de mensajes.
 * Valida tamaños básicos y campos requeridos.
 *
 * Limitaciones V1:
 * - No sanitiza HTML ni URLs
 * - No valida formato de números de teléfono
 * - No detecta spam o contenido malicioso
 *
 * V2 mejorará:
 * - Sanitización HTML con DOMPurify
 * - Validación de URLs peligrosas
 * - Detección de patrones de spam
 * - Validación específica por canal
 *
 * @module implementations/v1
 */

import type {
  IValidator,
  ValidationResult,
  ValidationError,
  ValidationRules
} from '../../core/interfaces';
import type { MessageEnvelopeV2 as MessageEnvelope } from '@inhost/shared';
import { logger } from '../../middleware/logger';

export class SimpleValidator implements IValidator {
  private rules: ValidationRules = {
    maxTextLength: 16384,           // 16 KB
    maxMessageSize: 1048576,        // 1 MB
    maxMetadataFields: 50,
    allowedContentTypes: ['text', 'image', 'document', 'audio', 'video'],
    requireFields: ['id', 'channel', 'direction', 'content']
  };

  /**
   * Validar un mensaje
   */
  validate(envelope: MessageEnvelope): ValidationResult {
    const errors: ValidationError[] = [];

    // 1. Validar campos requeridos
    this.validateRequiredFields(envelope, errors);

    // 2. Validar tamaño del texto
    this.validateTextLength(envelope, errors);

    // 3. Validar tamaño total del mensaje
    this.validateMessageSize(envelope, errors);

    // 4. Validar metadata
    this.validateMetadata(envelope, errors);

    // 5. Validar tipo de contenido
    this.validateContentType(envelope, errors);

    // 6. Validar estructura básica
    this.validateStructure(envelope, errors);

    const valid = errors.length === 0;

    if (!valid) {
      logger.warn('Message validation failed', {
        messageId: envelope.id,
        errorCount: errors.length,
        errors: errors.map(e => e.code)
      });
    }

    return { valid, errors };
  }

  /**
   * Validar y lanzar error si falla
   */
  validateOrThrow(envelope: MessageEnvelope): void {
    const result = this.validate(envelope);

    if (!result.valid) {
      const errorMessages = result.errors.map(e => `${e.field}: ${e.message}`).join(', ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }
  }

  /**
   * Sanitizar un mensaje (V1: solo copia, V2 hará sanitización real)
   */
  sanitize(envelope: MessageEnvelope): MessageEnvelope {
    // V1: Por ahora solo retorna una copia del mensaje
    // V2: Limpiará HTML, URLs peligrosas, etc.
    const sanitized = { ...envelope };

    // Trim text si existe
    if (sanitized.content.text) {
      sanitized.content.text = sanitized.content.text.trim();
    }

    return sanitized;
  }

  /**
   * Configurar reglas de validación
   */
  configure(rules: ValidationRules): void {
    this.rules = { ...this.rules, ...rules };

    logger.info('Validator configured', {
      maxTextLength: this.rules.maxTextLength,
      maxMessageSize: this.rules.maxMessageSize,
      maxMetadataFields: this.rules.maxMetadataFields
    });
  }

  /**
   * Obtener reglas actuales
   */
  getRules(): ValidationRules {
    return { ...this.rules };
  }

  // ==================== Métodos de validación internos ====================

  private validateRequiredFields(envelope: any, errors: ValidationError[]): void {
    if (!this.rules.requireFields) return;

    for (const field of this.rules.requireFields) {
      const value = this.getNestedValue(envelope, field);

      if (value === undefined || value === null || value === '') {
        errors.push({
          field,
          code: 'REQUIRED_FIELD_MISSING',
          message: `Required field '${field}' is missing or empty`,
          value
        });
      }
    }
  }

  private validateTextLength(envelope: MessageEnvelope, errors: ValidationError[]): void {
    if (!envelope.content.text) return;
    if (!this.rules.maxTextLength) return;

    const textLength = envelope.content.text.length;

    if (textLength > this.rules.maxTextLength) {
      errors.push({
        field: 'content.text',
        code: 'TEXT_TOO_LONG',
        message: `Text exceeds maximum length of ${this.rules.maxTextLength} characters`,
        value: textLength
      });
    }
  }

  private validateMessageSize(envelope: MessageEnvelope, errors: ValidationError[]): void {
    if (!this.rules.maxMessageSize) return;

    const messageSize = JSON.stringify(envelope).length;

    if (messageSize > this.rules.maxMessageSize) {
      errors.push({
        field: 'message',
        code: 'MESSAGE_TOO_LARGE',
        message: `Message exceeds maximum size of ${this.rules.maxMessageSize} bytes`,
        value: messageSize
      });
    }
  }

  private validateMetadata(envelope: MessageEnvelope, errors: ValidationError[]): void {
    if (!envelope.metadata) return;
    if (!this.rules.maxMetadataFields) return;

    const metadataFieldCount = Object.keys(envelope.metadata).length;

    if (metadataFieldCount > this.rules.maxMetadataFields) {
      errors.push({
        field: 'metadata',
        code: 'TOO_MANY_METADATA_FIELDS',
        message: `Metadata has too many fields (max: ${this.rules.maxMetadataFields})`,
        value: metadataFieldCount
      });
    }
  }

  private validateContentType(envelope: MessageEnvelope, errors: ValidationError[]): void {
    // V1: Validación básica - solo verificar que haya contenido
    const hasText = !!envelope.content.text;
    const hasMedia = !!envelope.content.media;

    if (!hasText && !hasMedia) {
      errors.push({
        field: 'content',
        code: 'EMPTY_CONTENT',
        message: 'Message must have either text or media',
        value: envelope.content
      });
    }
  }

  private validateStructure(envelope: MessageEnvelope, errors: ValidationError[]): void {
    // Validar que type sea válido
    const validTypes = ['incoming', 'outgoing', 'system', 'status'];
    if (!validTypes.includes(envelope.type)) {
      errors.push({
        field: 'type',
        code: 'INVALID_TYPE',
        message: `Type must be one of: ${validTypes.join(', ')}`,
        value: envelope.type
      });
    }

    // Validar que channel sea válido
    const validChannels = ['whatsapp', 'telegram', 'sms', 'web'];
    if (!validChannels.includes(envelope.channel)) {
      errors.push({
        field: 'channel',
        code: 'INVALID_CHANNEL',
        message: `Channel must be one of: ${validChannels.join(', ')}`,
        value: envelope.channel
      });
    }

    // Validar formato de timestamp en metadata
    if (envelope.metadata?.timestamp && isNaN(Date.parse(envelope.metadata.timestamp))) {
      errors.push({
        field: 'metadata.timestamp',
        code: 'INVALID_TIMESTAMP',
        message: 'Timestamp must be a valid ISO 8601 date string',
        value: envelope.metadata.timestamp
      });
    }
  }

  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) break;
    }

    return value;
  }
}
