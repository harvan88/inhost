/**
 * IExtension
 *
 * Contrato base para todas las extensiones del sistema.
 * Las extensiones son módulos opcionales que agregan funcionalidad.
 *
 * Ejemplos de extensiones:
 * - AI Assistant (GPT, Claude)
 * - Analytics & Reporting
 * - Custom Workflows
 * - Advanced Routing
 * - Integrations (Zapier, webhooks)
 * - Content Moderation
 * - Translation Services
 *
 * @module core/interfaces
 */

import type { MessageEnvelopeV2 } from '@inhost/shared/types';

/**
 * Tipos de extensiones soportadas
 */
export type ExtensionType =
  | 'ai-assistant'
  | 'analytics'
  | 'workflow'
  | 'routing'
  | 'integration'
  | 'moderation'
  | 'translation'
  | 'custom';

/**
 * Prioridad de ejecución de extensiones
 */
export type ExtensionPriority = 'critical' | 'high' | 'normal' | 'low';

/**
 * Contexto de ejecución de una extensión
 */
export interface ExtensionContext {
  userId: string;
  message?: MessageEnvelopeV2;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Resultado de ejecución de una extensión
 */
export interface ExtensionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Configuración de una extensión
 */
export interface ExtensionConfig {
  enabled: boolean;
  priority: ExtensionPriority;
  timeout?: number; // ms
  retries?: number;
  settings?: Record<string, unknown>;
}

/**
 * Metadatos de una extensión
 */
export interface ExtensionMetadata {
  id: string;
  name: string;
  version: string;
  type: ExtensionType;
  description: string;
  author?: string;
  dependencies?: string[];
}

/**
 * Contrato base para extensiones
 */
export interface IExtension<TInput = unknown, TOutput = unknown> {
  /**
   * Metadatos de la extensión
   */
  readonly metadata: ExtensionMetadata;

  /**
   * Inicializar la extensión
   */
  initialize(config: ExtensionConfig): Promise<void>;

  /**
   * Ejecutar la extensión
   */
  execute(context: ExtensionContext, input: TInput): Promise<ExtensionResult<TOutput>>;

  /**
   * Verificar si la extensión puede ejecutarse
   */
  canExecute(context: ExtensionContext): Promise<boolean>;

  /**
   * Cleanup al desactivar la extensión
   */
  shutdown(): Promise<void>;

  /**
   * Health check de la extensión
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Hook para interceptar mensajes
 */
export interface IMessageExtension extends IExtension<MessageEnvelopeV2, MessageEnvelopeV2> {
  /**
   * Procesar mensaje entrante (antes de persistir)
   */
  onIncoming?(message: MessageEnvelopeV2, context: ExtensionContext): Promise<ExtensionResult<MessageEnvelopeV2>>;

  /**
   * Procesar mensaje saliente (antes de enviar)
   */
  onOutgoing?(message: MessageEnvelopeV2, context: ExtensionContext): Promise<ExtensionResult<MessageEnvelopeV2>>;

  /**
   * Post-procesamiento (después de enviar)
   */
  afterSend?(message: MessageEnvelopeV2, context: ExtensionContext): Promise<ExtensionResult<void>>;
}
