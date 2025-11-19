/**
 * IExtensionRegistry
 *
 * Contrato para el registro de extensiones.
 * Gestiona el ciclo de vida de extensiones:
 * - Registro/desregistro
 * - Activación/desactivación
 * - Ejecución ordenada por prioridad
 *
 * @module core/interfaces
 */

import type {
  IExtension,
  IMessageExtension,
  ExtensionType,
  ExtensionConfig,
  ExtensionContext,
  ExtensionResult,
  ExtensionMetadata
} from './IExtension';

/**
 * Información de una extensión registrada
 */
export interface RegisteredExtension {
  extension: IExtension;
  config: ExtensionConfig;
  registeredAt: Date;
  lastExecutedAt?: Date;
  executionCount: number;
  errorCount: number;
}

/**
 * Filtros para buscar extensiones
 */
export interface ExtensionFilter {
  type?: ExtensionType;
  enabled?: boolean;
  userId?: string;
}

/**
 * Estadísticas del registro
 */
export interface RegistryStats {
  totalExtensions: number;
  enabledExtensions: number;
  byType: Record<ExtensionType, number>;
  totalExecutions: number;
  totalErrors: number;
}

/**
 * Contrato del registro de extensiones
 */
export interface IExtensionRegistry {
  /**
   * Registrar una extensión
   */
  register(extension: IExtension, config: ExtensionConfig): Promise<void>;

  /**
   * Desregistrar una extensión
   */
  unregister(extensionId: string): Promise<void>;

  /**
   * Obtener una extensión por ID
   */
  get(extensionId: string): RegisteredExtension | undefined;

  /**
   * Listar extensiones (con filtros opcionales)
   */
  list(filter?: ExtensionFilter): RegisteredExtension[];

  /**
   * Ejecutar extensión específica
   */
  execute<TInput, TOutput>(
    extensionId: string,
    context: ExtensionContext,
    input: TInput
  ): Promise<ExtensionResult<TOutput>>;

  /**
   * Ejecutar todas las extensiones de un tipo
   * Se ejecutan en orden de prioridad (critical → high → normal → low)
   */
  executeAll<TInput, TOutput>(
    type: ExtensionType,
    context: ExtensionContext,
    input: TInput
  ): Promise<ExtensionResult<TOutput>[]>;

  /**
   * Habilitar/deshabilitar extensión
   */
  setEnabled(extensionId: string, enabled: boolean): Promise<void>;

  /**
   * Actualizar configuración de extensión
   */
  updateConfig(extensionId: string, config: Partial<ExtensionConfig>): Promise<void>;

  /**
   * Obtener estadísticas
   */
  getStats(): RegistryStats;

  /**
   * Verificar salud de todas las extensiones
   */
  healthCheck(): Promise<Map<string, boolean>>;

  /**
   * Shutdown de todas las extensiones
   */
  shutdown(): Promise<void>;
}

/**
 * Registry específico para extensiones de mensajes
 */
export interface IMessageExtensionRegistry extends IExtensionRegistry {
  /**
   * Registrar extensión de mensajes
   */
  registerMessageExtension(extension: IMessageExtension, config: ExtensionConfig): Promise<void>;

  /**
   * Ejecutar hooks de mensaje entrante
   */
  executeIncomingHooks(
    message: import('@inhost/shared/types').MessageEnvelopeV2,
    context: ExtensionContext
  ): Promise<import('@inhost/shared/types').MessageEnvelopeV2>;

  /**
   * Ejecutar hooks de mensaje saliente
   */
  executeOutgoingHooks(
    message: import('@inhost/shared/types').MessageEnvelopeV2,
    context: ExtensionContext
  ): Promise<import('@inhost/shared/types').MessageEnvelopeV2>;

  /**
   * Ejecutar hooks post-envío
   */
  executeAfterSendHooks(
    message: import('@inhost/shared/types').MessageEnvelopeV2,
    context: ExtensionContext
  ): Promise<void>;
}
