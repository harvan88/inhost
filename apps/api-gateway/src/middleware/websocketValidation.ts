/**
 * WebSocket Message Validation (Sprint 3)
 *
 * Validación de mensajes WebSocket usando TypeBox.
 * Similar a la validación HTTP pero para mensajes en tiempo real.
 *
 * Tipos de mensajes validados:
 * - typing: Indicadores de escritura
 * - new_message: Nuevos mensajes
 * - message_received: Mensajes recibidos
 */

import { Type, Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { logger } from './logger';

/**
 * Schema para typing indicator
 */
export const TypingMessageSchema = Type.Object({
  type: Type.Literal('typing'),
  conversationId: Type.Optional(Type.String()),
  isTyping: Type.Boolean(),
  timestamp: Type.Optional(Type.String())
});

/**
 * Schema para nuevo mensaje
 */
export const NewMessageSchema = Type.Object({
  type: Type.Union([
    Type.Literal('new_message'),
    Type.Literal('message_received')
  ]),
  conversationId: Type.Optional(Type.String()),
  text: Type.Optional(Type.String({ maxLength: 16384 })),
  data: Type.Optional(Type.Any()),
  timestamp: Type.Optional(Type.String())
});

/**
 * Schema para cualquier mensaje WebSocket entrante
 */
export const WebSocketMessageSchema = Type.Union([
  TypingMessageSchema,
  NewMessageSchema,
  Type.Object({
    type: Type.String(),
    [Type.Symbol()]: Type.Any() // Permitir otros campos
  })
]);

export type TypingMessage = Static<typeof TypingMessageSchema>;
export type NewMessage = Static<typeof NewMessageSchema>;
export type WebSocketMessage = Static<typeof WebSocketMessageSchema>;

/**
 * Valida un mensaje WebSocket
 * @returns true si es válido, false si no
 */
export function validateWebSocketMessage(message: unknown): {
  valid: boolean;
  data?: any;
  errors?: string[];
} {
  try {
    // Intentar parsear si es string
    const data = typeof message === 'string' ? JSON.parse(message) : message;

    // Validar contra schema
    const valid = Value.Check(WebSocketMessageSchema, data);

    if (!valid) {
      const errors = [...Value.Errors(WebSocketMessageSchema, data)]
        .map(e => `${e.path}: ${e.message}`);

      logger.warn('WebSocket message validation failed', {
        errors,
        messageType: typeof data,
        messageKeys: data && typeof data === 'object' ? Object.keys(data) : [],
        messagePreview: JSON.stringify(data).substring(0, 200)
      });

      return { valid: false, errors };
    }

    // Validaciones adicionales
    if (data.type === 'new_message' || data.type === 'message_received') {
      if (!data.text && !data.data) {
        return {
          valid: false,
          errors: ['Message must have either text or data']
        };
      }
    }

    return { valid: true, data };
  } catch (error) {
    logger.error('WebSocket message validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      message
    });

    return {
      valid: false,
      errors: ['Invalid JSON or malformed message']
    };
  }
}

/**
 * Valida el tamaño del mensaje
 * @param message Mensaje a validar
 * @param maxSize Tamaño máximo en bytes (default: 1MB)
 */
export function validateMessageSize(message: unknown, maxSize: number = 1024 * 1024): {
  valid: boolean;
  size: number;
  error?: string;
} {
  try {
    const json = typeof message === 'string' ? message : JSON.stringify(message);
    const size = Buffer.byteLength(json, 'utf8');

    if (size > maxSize) {
      return {
        valid: false,
        size,
        error: `Message size (${size} bytes) exceeds maximum (${maxSize} bytes)`
      };
    }

    return { valid: true, size };
  } catch (error) {
    return {
      valid: false,
      size: 0,
      error: 'Failed to calculate message size'
    };
  }
}
