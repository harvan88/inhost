/**
 * CapabilityBasedServiceGate (V1)
 *
 * Implementación basada en capacidades del Service Gate.
 * Reemplaza la lógica hardcodeada de planes por un sistema flexible.
 *
 * Características V1:
 * - Capacidades almacenadas en memoria
 * - Configuración por usuario/servicio
 * - Tracking de uso en memoria
 * - Templates de capacidades (presets)
 *
 * V2 mejorará:
 * - Persistencia en base de datos
 * - Feature flags desde configuración remota
 * - A/B testing integrado
 * - Analytics de uso
 *
 * @module implementations/v1
 */

import type {
  IServiceGate,
  ServiceId,
  ServiceConfig,
  UserCapabilities,
  ServiceCheckResult,
  ServiceUsageResult
} from '../../core/interfaces';
import { logger } from '../../middleware/logger';

/**
 * Template de capacidades predefinido
 */
export interface CapabilityTemplate {
  name: string;
  description: string;
  services: Map<ServiceId, ServiceConfig>;
  globalLimits?: UserCapabilities['globalLimits'];
}

/**
 * Uso de un servicio
 */
interface ServiceUsage {
  count: number;
  resetAt: Date;
  lastUsedAt: Date;
}

export class CapabilityBasedServiceGate implements IServiceGate {
  // Capacidades por usuario
  private capabilities: Map<string, UserCapabilities> = new Map();

  // Tracking de uso por usuario/servicio
  private usage: Map<string, Map<ServiceId, ServiceUsage>> = new Map();

  // Templates predefinidos (ej: "starter", "professional", "enterprise")
  private templates: Map<string, CapabilityTemplate> = new Map();

  // Template por defecto para nuevos usuarios
  private defaultTemplate: string = 'starter';

  constructor() {
    this.initializeTemplates();
    logger.info('🚪 CapabilityBasedServiceGate initialized');
  }

  /**
   * Inicializar templates predefinidos
   */
  private initializeTemplates(): void {
    // Template "starter" (equivalente a "free")
    this.templates.set('starter', {
      name: 'Starter',
      description: 'Basic features for getting started',
      services: new Map<ServiceId, ServiceConfig>([
        ['rate-limiting', {
          enabled: true,
          limits: { rateLimit: 12 }
        }],
        ['persistence', {
          enabled: true,
          features: { type: 'memory', retentionDays: 1 }
        }],
        ['notifications', {
          enabled: true
        }],
        ['websocket', {
          enabled: true,
          limits: { rateLimit: 12 }
        }],
        ['ai-assistant', {
          enabled: false
        }],
        ['analytics', {
          enabled: false
        }],
        ['custom', {
          enabled: false
        }]
      ]),
      globalLimits: {
        maxConcurrentRequests: 5,
        maxStorageBytes: 10 * 1024 * 1024, // 10 MB
        maxTeamMembers: 1
      }
    });

    // Template "professional" (equivalente a "premium")
    this.templates.set('professional', {
      name: 'Professional',
      description: 'Advanced features for power users',
      services: new Map<ServiceId, ServiceConfig>([
        ['rate-limiting', {
          enabled: true,
          limits: { rateLimit: 30 }
        }],
        ['persistence', {
          enabled: true,
          features: { type: 'local', retentionDays: 365 }
        }],
        ['notifications', {
          enabled: true
        }],
        ['websocket', {
          enabled: true,
          limits: { rateLimit: 30 }
        }],
        ['ai-assistant', {
          enabled: true,
          limits: { quota: 1000 } // 1000 AI calls per month
        }],
        ['analytics', {
          enabled: true
        }],
        ['workflow', {
          enabled: true,
          limits: { quota: 100 } // 100 workflows per month
        }],
        ['custom', {
          enabled: false
        }]
      ]),
      globalLimits: {
        maxConcurrentRequests: 20,
        maxStorageBytes: 100 * 1024 * 1024, // 100 MB
        maxTeamMembers: 10
      }
    });

    // Template "enterprise"
    this.templates.set('enterprise', {
      name: 'Enterprise',
      description: 'Unlimited features for large teams',
      services: new Map<ServiceId, ServiceConfig>([
        ['rate-limiting', {
          enabled: true,
          limits: { rateLimit: 100 }
        }],
        ['persistence', {
          enabled: true,
          features: { type: 'remote', retentionDays: -1 }
        }],
        ['notifications', {
          enabled: true
        }],
        ['websocket', {
          enabled: true,
          limits: { rateLimit: 100 }
        }],
        ['ai-assistant', {
          enabled: true,
          limits: { quota: -1 } // unlimited
        }],
        ['analytics', {
          enabled: true
        }],
        ['workflow', {
          enabled: true,
          limits: { quota: -1 }
        }],
        ['integration', {
          enabled: true
        }],
        ['custom', {
          enabled: true,
          limits: { quota: -1 }
        }]
      ]),
      globalLimits: {
        maxConcurrentRequests: -1,
        maxStorageBytes: -1,
        maxTeamMembers: -1
      }
    });

    logger.info('📋 Capability templates initialized', {
      templates: Array.from(this.templates.keys())
    });
  }

  /**
   * Obtener o crear capacidades para un usuario
   */
  private getOrCreateCapabilities(userId: string): UserCapabilities {
    let caps = this.capabilities.get(userId);

    if (!caps) {
      // Crear capacidades desde template por defecto
      const template = this.templates.get(this.defaultTemplate);
      if (!template) {
        throw new Error(`Template not found: ${this.defaultTemplate}`);
      }

      caps = {
        userId,
        services: new Map(template.services),
        globalLimits: { ...template.globalLimits }
      };

      this.capabilities.set(userId, caps);

      logger.debug('👤 User capabilities created from template', {
        userId,
        template: this.defaultTemplate
      });
    }

    return caps;
  }

  /**
   * Obtener o crear tracking de uso
   */
  private getOrCreateUsage(userId: string, service: ServiceId): ServiceUsage {
    let userUsage = this.usage.get(userId);

    if (!userUsage) {
      userUsage = new Map();
      this.usage.set(userId, userUsage);
    }

    let serviceUsage = userUsage.get(service);

    if (!serviceUsage) {
      const now = new Date();
      serviceUsage = {
        count: 0,
        resetAt: new Date(now.getTime() + 60000), // +1 minuto
        lastUsedAt: now
      };
      userUsage.set(service, serviceUsage);
    }

    return serviceUsage;
  }

  async canUseService(userId: string, service: ServiceId): Promise<ServiceCheckResult> {
    const caps = this.getOrCreateCapabilities(userId);
    const config = caps.services.get(service);

    // Si el servicio no está configurado, denegar
    if (!config) {
      return {
        allowed: false,
        service,
        reason: 'Service not configured for user'
      };
    }

    // Si está deshabilitado, denegar
    if (!config.enabled) {
      return {
        allowed: false,
        service,
        config,
        reason: 'Service disabled for user'
      };
    }

    // Verificar límites de rate
    if (config.limits?.rateLimit) {
      const usage = this.getOrCreateUsage(userId, service);
      const now = new Date();

      // Resetear si expiró
      if (now >= usage.resetAt) {
        usage.count = 0;
        usage.resetAt = new Date(now.getTime() + 60000);
      }

      const remaining = config.limits.rateLimit - usage.count;

      if (remaining <= 0) {
        return {
          allowed: false,
          service,
          config,
          reason: 'Rate limit exceeded',
          metadata: {
            currentUsage: usage.count,
            limit: config.limits.rateLimit,
            remaining: 0,
            resetAt: usage.resetAt
          }
        };
      }

      return {
        allowed: true,
        service,
        config,
        metadata: {
          currentUsage: usage.count,
          limit: config.limits.rateLimit,
          remaining,
          resetAt: usage.resetAt
        }
      };
    }

    // Verificar cuota (quota)
    if (config.limits?.quota !== undefined && config.limits.quota !== -1) {
      const usage = this.getOrCreateUsage(userId, service);
      const remaining = config.limits.quota - usage.count;

      if (remaining <= 0) {
        return {
          allowed: false,
          service,
          config,
          reason: 'Quota exceeded',
          metadata: {
            currentUsage: usage.count,
            limit: config.limits.quota,
            remaining: 0
          }
        };
      }
    }

    return {
      allowed: true,
      service,
      config
    };
  }

  async getServiceConfig(userId: string, service: ServiceId): Promise<ServiceConfig | undefined> {
    const caps = this.getOrCreateCapabilities(userId);
    return caps.services.get(service);
  }

  async getUserCapabilities(userId: string): Promise<UserCapabilities> {
    return this.getOrCreateCapabilities(userId);
  }

  async updateUserCapabilities(userId: string, capabilities: Partial<UserCapabilities>): Promise<void> {
    const current = this.getOrCreateCapabilities(userId);

    if (capabilities.services) {
      current.services = new Map(capabilities.services);
    }

    if (capabilities.globalLimits) {
      current.globalLimits = { ...capabilities.globalLimits };
    }

    if (capabilities.expiresAt) {
      current.expiresAt = capabilities.expiresAt;
    }

    logger.info('🔄 User capabilities updated', { userId });
  }

  async setServiceEnabled(userId: string, service: ServiceId, enabled: boolean): Promise<void> {
    const caps = this.getOrCreateCapabilities(userId);
    const config = caps.services.get(service);

    if (!config) {
      // Crear config básica si no existe
      caps.services.set(service, { enabled });
    } else {
      config.enabled = enabled;
    }

    logger.info('🔧 Service toggled', { userId, service, enabled });
  }

  async updateServiceConfig(userId: string, service: ServiceId, config: Partial<ServiceConfig>): Promise<void> {
    const caps = this.getOrCreateCapabilities(userId);
    const current = caps.services.get(service);

    if (!current) {
      caps.services.set(service, { enabled: true, ...config });
    } else {
      Object.assign(current, config);
    }

    logger.info('⚙️  Service config updated', { userId, service });
  }

  async recordServiceUsage(userId: string, service: ServiceId, amount: number = 1): Promise<ServiceUsageResult> {
    const usage = this.getOrCreateUsage(userId, service);
    const config = await this.getServiceConfig(userId, service);
    const now = new Date();

    // Resetear si expiró
    if (now >= usage.resetAt) {
      usage.count = 0;
      usage.resetAt = new Date(now.getTime() + 60000);
    }

    usage.count += amount;
    usage.lastUsedAt = now;

    const limit = config?.limits?.rateLimit || config?.limits?.quota;
    const remaining = limit ? Math.max(0, limit - usage.count) : undefined;

    logger.debug('📊 Service usage recorded', {
      userId,
      service,
      amount,
      count: usage.count,
      remaining
    });

    return {
      success: true,
      service,
      consumed: amount,
      remaining
    };
  }

  async getServiceUsage(userId: string, service: ServiceId): Promise<{
    current: number;
    limit?: number;
    resetAt?: Date;
  }> {
    const usage = this.getOrCreateUsage(userId, service);
    const config = await this.getServiceConfig(userId, service);

    return {
      current: usage.count,
      limit: config?.limits?.rateLimit || config?.limits?.quota,
      resetAt: usage.resetAt
    };
  }

  async resetUsage(userId: string, service?: ServiceId): Promise<void> {
    const userUsage = this.usage.get(userId);

    if (!userUsage) return;

    if (service) {
      userUsage.delete(service);
      logger.info('🔄 Service usage reset', { userId, service });
    } else {
      userUsage.clear();
      logger.info('🔄 All usage reset', { userId });
    }
  }

  async checkGlobalLimits(userId: string): Promise<boolean> {
    const caps = this.getOrCreateCapabilities(userId);

    if (!caps.globalLimits) return true;

    // TODO: Implementar checks de límites globales
    // - maxConcurrentRequests
    // - maxStorageBytes
    // - maxTeamMembers

    return true;
  }

  async getUsageStats(userId: string): Promise<{
    services: Map<ServiceId, { used: number; limit?: number }>;
    globalUsage: {
      concurrentRequests: number;
      storageBytes: number;
      teamMembers: number;
    };
  }> {
    const userUsage = this.usage.get(userId);
    const caps = this.getOrCreateCapabilities(userId);

    const services = new Map<ServiceId, { used: number; limit?: number }>();

    if (userUsage) {
      for (const [service, usage] of userUsage.entries()) {
        const config = caps.services.get(service);
        services.set(service, {
          used: usage.count,
          limit: config?.limits?.rateLimit || config?.limits?.quota
        });
      }
    }

    return {
      services,
      globalUsage: {
        concurrentRequests: 0, // TODO: Implementar
        storageBytes: 0, // TODO: Implementar
        teamMembers: 1 // TODO: Implementar
      }
    };
  }

  /**
   * Aplicar un template a un usuario
   */
  async applyTemplate(userId: string, templateName: string): Promise<void> {
    const template = this.templates.get(templateName);

    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    await this.updateUserCapabilities(userId, {
      services: new Map(template.services),
      globalLimits: { ...template.globalLimits }
    });

    logger.info('📋 Template applied to user', { userId, template: templateName });
  }

  /**
   * Configurar template por defecto
   */
  setDefaultTemplate(templateName: string): void {
    if (!this.templates.has(templateName)) {
      throw new Error(`Template not found: ${templateName}`);
    }

    this.defaultTemplate = templateName;
    logger.info('✨ Default template changed', { template: templateName });
  }

  /**
   * Obtener estadísticas generales
   */
  getStats(): {
    totalUsers: number;
    byTemplate: Map<string, number>;
    totalUsage: number;
  } {
    const byTemplate = new Map<string, number>();
    let totalUsage = 0;

    // Contar usuarios por template (simplificado)
    for (const template of this.templates.keys()) {
      byTemplate.set(template, 0);
    }

    // Contar uso total
    for (const userUsage of this.usage.values()) {
      for (const usage of userUsage.values()) {
        totalUsage += usage.count;
      }
    }

    return {
      totalUsers: this.capabilities.size,
      byTemplate,
      totalUsage
    };
  }
}
