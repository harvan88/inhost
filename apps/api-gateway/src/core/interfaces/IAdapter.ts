/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\core\interfaces\IAdapter.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Handles i adapter functionality"
 *
 * DEPENDENCIES:
 *   internal: []
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["AdapterConfig","IAdapter","SendResult"]
 *   inputs: "None"
 *   outputs: "Promise<SendResult>"
 *   errors: "None"
 *
 * INTEGRATION:
 *   data_flow: "Input → Processing → Output"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: []
 *   critical: false
 *
 * === DOC_END :: IAdapter.ts ===
 */

import type { MessageEnvelopeV2 as MessageEnvelope, MessageChannel } from '@inhost/shared';

/**
 * Resultado del envío de un mensaje
 */
export interface SendResult {
  success: boolean;
  messageId: string;              // ID del mensaje en Inhost
  platformMessageId?: string;     // ID del mensaje en la plataforma externa (WhatsApp, Telegram, etc.)
  status: 'sent' | 'failed' | 'pending';
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  timestamp: string;              // ISO 8601
}

/**
 * Configuración de un adapter
 */
export interface AdapterConfig {
  // Credenciales (deben estar encriptadas en DB)
  credentials?: {
    apiKey?: string;
    apiSecret?: string;
    webhookSecret?: string;
    phoneNumberId?: string;      // WhatsApp Business
    botToken?: string;            // Telegram
    [key: string]: unknown;
  };

  // Configuración de comportamiento
  behavior?: {
    retryAttempts?: number;       // Reintentos en caso de fallo
    retryDelay?: number;          // Delay entre reintentos (ms)
    timeout?: number;             // Timeout para operaciones (ms)
  };

  // Límites específicos del adapter
  limits?: {
    maxTextLength?: number;
    maxMediaSize?: number;
    rateLimit?: number;
  };
}

/**
 * Interface base que TODOS los adapters deben implementar
 *
 * Esta interface define el contrato que nunca cambia.
 * Las implementaciones pueden ser simples (V1), reales (V2), o robustas (V3),
 * pero todas deben respetar este contrato.
 *
 * @example
 * ```typescript
 * // V1: Simulador simple
 * class SimulatedWhatsAppAdapter implements IAdapter {
 *   async sendMessage(envelope: MessageEnvelope): Promise<SendResult> {
 *     await sleep(100);
 *     return { success: true, messageId: envelope.id, status: 'sent' };
 *   }
 * }
 *
 * // V2: Adapter real
 * class WhatsAppAdapter implements IAdapter {
 *   async sendMessage(envelope: MessageEnvelope): Promise<SendResult> {
 *     const response = await whatsappApi.sendMessage(envelope);
 *     return { success: true, messageId: envelope.id, status: 'sent' };
 *   }
 * }
 * ```
 */
export interface IAdapter {
  /**
   * Identificación del adapter
   */
  readonly id: string;              // 'whatsapp', 'telegram', etc.
  readonly name: string;            // 'WhatsApp Adapter', 'Telegram Adapter'
  readonly version: string;         // '1.0.0' (semantic versioning)
  readonly channel: MessageChannel; // Canal que maneja

  /**
   * Inicializar el adapter (configurar webhooks, validar credenciales, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Iniciar el adapter (comenzar a escuchar mensajes)
   */
  start(): Promise<void>;

  /**
   * Detener el adapter gracefully
   */
  stop(): Promise<void>;

  /**
   * Health check - verificar si el adapter está funcionando correctamente
   */
  isHealthy(): Promise<boolean>;

  /**
   * Enviar mensaje a la plataforma externa
   *
   * @param envelope - Mensaje normalizado en formato Inhost
   * @returns Resultado del envío
   */
  sendMessage(envelope: MessageEnvelope): Promise<SendResult>;

  /**
   * Recibir mensaje desde la plataforma externa y convertirlo a formato Inhost
   *
   * @param platformMessage - Mensaje en formato de la plataforma externa
   * @returns Mensaje normalizado en formato Inhost
   */
  receiveMessage(platformMessage: unknown): Promise<MessageEnvelope>;

  /**
   * Configurar el adapter
   *
   * @param config - Configuración del adapter
   */
  configure(config: AdapterConfig): Promise<void>;

  /**
   * Obtener la configuración actual
   */
  getConfig(): AdapterConfig;
}
