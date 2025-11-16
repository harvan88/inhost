/**
 * Validation Middleware
 *
 * Middleware de Elysia que valida mensajes antes de procesarlos.
 * Usa IValidator para verificar estructura y tamaños.
 *
 * Errores retornados (HTTP 400):
 * - REQUIRED_FIELD_MISSING: Campo requerido faltante
 * - TEXT_TOO_LONG: Texto excede longitud máxima
 * - MESSAGE_TOO_LARGE: Mensaje excede tamaño máximo
 * - INVALID_CHANNEL: Canal no válido
 * - INVALID_TYPE: Tipo de mensaje no válido
 * - EMPTY_CONTENT: Mensaje sin contenido
 *
 * @module middleware/validation
 */

import { Elysia } from 'elysia';
import type { IValidator } from '../core/interfaces';
import type { MessageEnvelopeV2 as MessageEnvelope } from '@inhost/shared';
import { logger } from './logger';

export interface ValidationConfig {
  validator: IValidator;
  sanitize?: boolean;  // Si true, sanitiza mensajes automáticamente
}

/**
 * Crear middleware de validación para mensajes
 *
 * @example
 * ```typescript
 * const validator = new SimpleValidator();
 *
 * const app = new Elysia()
 *   .use(messageValidation({ validator, sanitize: true }))
 *   .post('/messages', async ({ body }) => {
 *     // body.message ya está validado y sanitizado
 *   });
 * ```
 */
export function messageValidation(config: ValidationConfig) {
  return new Elysia()
    .derive(async ({ body, set }: any) => {
      // Extraer mensaje del body
      const message = body?.message || body;

      if (!message) {
        set.status = 400;
        return {
          error: 'Message is required',
          code: 'MESSAGE_REQUIRED'
        };
      }

      // Validar el mensaje
      const result = config.validator.validate(message as MessageEnvelope);

      if (!result.valid) {
        logger.warn('Message validation failed', {
          messageId: message.id,
          errors: result.errors
        });

        set.status = 400;
        return {
          error: 'Validation failed',
          code: 'VALIDATION_FAILED',
          details: result.errors.map(e => ({
            field: e.field,
            code: e.code,
            message: e.message
          }))
        };
      }

      // Sanitizar si está habilitado
      const validatedMessage = config.sanitize
        ? config.validator.sanitize(message as MessageEnvelope)
        : message;

      logger.debug('Message validated successfully', {
        messageId: validatedMessage.id,
        sanitized: config.sanitize || false
      });

      return {
        validatedMessage: validatedMessage as MessageEnvelope
      };
    });
}

/**
 * Middleware simple para validar parámetros de query/path
 *
 * @example
 * ```typescript
 * const app = new Elysia()
 *   .use(validateParams({
 *     messageId: (value) => {
 *       if (!value || typeof value !== 'string') {
 *         return { valid: false, error: 'messageId must be a string' };
 *       }
 *       if (value.length < 10) {
 *         return { valid: false, error: 'messageId too short' };
 *       }
 *       return { valid: true };
 *     }
 *   }))
 *   .get('/messages/:messageId', async ({ params }) => {
 *     // params.messageId ya está validado
 *   });
 * ```
 */
export function validateParams(validators: Record<string, (value: any) => { valid: boolean; error?: string }>) {
  return new Elysia()
    .derive(({ params, query, set }: any) => {
      const allParams = { ...params, ...query };

      for (const [key, validator] of Object.entries(validators)) {
        const value = allParams[key];
        const result = validator(value);

        if (!result.valid) {
          logger.warn('Parameter validation failed', {
            param: key,
            value,
            error: result.error
          });

          set.status = 400;
          return {
            error: 'Invalid parameter',
            code: 'INVALID_PARAMETER',
            param: key,
            message: result.error
          };
        }
      }

      return {
        validatedParams: allParams
      };
    });
}

/**
 * Validar formato de body JSON
 */
export function validateJSON() {
  return new Elysia()
    .onError(({ error, set }) => {
      // Verificar si es error de parseo JSON
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        logger.warn('Invalid JSON in request body', {
          error: error.message
        });

        set.status = 400;
        return {
          error: 'Invalid JSON',
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON'
        };
      }
    });
}

/**
 * Validar Content-Type header
 */
export function validateContentType(allowedTypes: string[] = ['application/json']) {
  return new Elysia()
    .derive(({ request, set }) => {
      const contentType = request.headers.get('content-type');

      if (!contentType) {
        set.status = 400;
        return {
          error: 'Content-Type header is required',
          code: 'CONTENT_TYPE_REQUIRED',
          allowed: allowedTypes
        };
      }

      // Verificar si el content type es permitido
      const isAllowed = allowedTypes.some(type =>
        contentType.toLowerCase().includes(type.toLowerCase())
      );

      if (!isAllowed) {
        logger.warn('Invalid Content-Type', {
          contentType,
          allowed: allowedTypes
        });

        set.status = 400;
        return {
          error: 'Invalid Content-Type',
          code: 'INVALID_CONTENT_TYPE',
          received: contentType,
          allowed: allowedTypes
        };
      }

      return {
        contentType
      };
    });
}
