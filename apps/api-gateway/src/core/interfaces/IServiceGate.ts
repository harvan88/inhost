/**
 * IServiceGate
 *
 * Contrato para el "interruptor" de servicios.
 * Determina qué servicios/extensiones puede usar cada usuario.
 *
 * Reemplaza la lógica hardcodeada de planes (free/premium/enterprise)
 * por un sistema flexible basado en capacidades.
 *
 * Ejemplos:
 * - ¿Usuario X puede usar AI Assistant?
 * - ¿Usuario Y puede enviar 30 mensajes/minuto?
 * - ¿Usuario Z puede usar analytics?
 *
 * @module core/interfaces
 */

import type { ExtensionType } from './IExtension';

/**
 * Identificadores de servicios del sistema
 */
export type ServiceId =
  | 'rate-limiting'
  | 'persistence'
  | 'notifications'
  | 'websocket'
  | ExtensionType; // Extensiones también son servicios

/**
 * Configuración de un servicio
 */
export interface ServiceConfig {
  enabled: boolean;
  limits?: {
    rateLimit?: number; // requests per minute
    quota?: number; // daily/monthly quota
    maxSize?: number; // bytes
    maxDuration?: number; // seconds
  };
  features?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Capacidades de un usuario
 */
export interface UserCapabilities {
  userId: string;
  services: Map<ServiceId, ServiceConfig>;
  globalLimits?: {
    maxConcurrentRequests?: number;
    maxStorageBytes?: number;
    maxTeamMembers?: number;
  };
  expiresAt?: Date;
}

/**
 * Resultado de verificación de servicio
 */
export interface ServiceCheckResult {
  allowed: boolean;
  service: ServiceId;
  config?: ServiceConfig;
  reason?: string;
  metadata?: {
    currentUsage?: number;
    limit?: number;
    remaining?: number;
    resetAt?: Date;
  };
}

/**
 * Resultado de uso de servicio
 */
export interface ServiceUsageResult {
  success: boolean;
  service: ServiceId;
  consumed: number;
  remaining?: number;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Contrato del Service Gate
 */
export interface IServiceGate {
  /**
   * Verificar si un usuario puede usar un servicio
   */
  canUseService(userId: string, service: ServiceId): Promise<ServiceCheckResult>;

  /**
   * Obtener configuración de un servicio para un usuario
   */
  getServiceConfig(userId: string, service: ServiceId): Promise<ServiceConfig | undefined>;

  /**
   * Obtener todas las capacidades de un usuario
   */
  getUserCapabilities(userId: string): Promise<UserCapabilities>;

  /**
   * Actualizar capacidades de un usuario
   */
  updateUserCapabilities(userId: string, capabilities: Partial<UserCapabilities>): Promise<void>;

  /**
   * Habilitar/deshabilitar servicio para un usuario
   */
  setServiceEnabled(userId: string, service: ServiceId, enabled: boolean): Promise<void>;

  /**
   * Actualizar configuración de un servicio para un usuario
   */
  updateServiceConfig(userId: string, service: ServiceId, config: Partial<ServiceConfig>): Promise<void>;

  /**
   * Registrar uso de un servicio
   */
  recordServiceUsage(userId: string, service: ServiceId, amount?: number): Promise<ServiceUsageResult>;

  /**
   * Obtener uso actual de un servicio
   */
  getServiceUsage(userId: string, service: ServiceId): Promise<{
    current: number;
    limit?: number;
    resetAt?: Date;
  }>;

  /**
   * Resetear uso de servicios (por tiempo, ej: mensual)
   */
  resetUsage(userId: string, service?: ServiceId): Promise<void>;

  /**
   * Verificar límites globales del usuario
   */
  checkGlobalLimits(userId: string): Promise<boolean>;

  /**
   * Obtener estadísticas de uso
   */
  getUsageStats(userId: string): Promise<{
    services: Map<ServiceId, { used: number; limit?: number }>;
    globalUsage: {
      concurrentRequests: number;
      storageBytes: number;
      teamMembers: number;
    };
  }>;
}
