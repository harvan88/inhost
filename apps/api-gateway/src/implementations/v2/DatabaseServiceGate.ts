/**
 * DatabaseServiceGate (V2)
 *
 * Implementación de IServiceGate que persiste en PostgreSQL.
 * Reemplaza CapabilityBasedServiceGate (V1) que usa memoria.
 *
 * Ventajas sobre V1:
 * - Capacidades persisten entre reinicios
 * - Soporta múltiples instancias (horizontal scaling)
 * - Tracking de uso persistente
 * - Soporte para trials con expiración
 * - Templates desde base de datos
 *
 * @module implementations/v2
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
import { db } from '@inhost/shared';
import { userCapabilities, serviceUsage, capabilityTemplates } from '@inhost/shared';
import { eq, and, sql } from 'drizzle-orm';

export class DatabaseServiceGate implements IServiceGate {
  constructor() {
    logger.info('🚪 DatabaseServiceGate (V2) initialized - PostgreSQL backend');
  }

  async canUseService(userId: string, service: ServiceId): Promise<ServiceCheckResult> {
    try {
      // 1. Obtener configuración del servicio
      const capability = await db
        .select()
        .from(userCapabilities)
        .where(
          and(
            eq(userCapabilities.userId, userId),
            eq(userCapabilities.serviceId, service)
          )
        )
        .limit(1);

      if (capability.length === 0) {
        return {
          allowed: false,
          service,
          reason: 'Service not configured for user'
        };
      }

      const config = capability[0];

      // 2. Verificar si está habilitado
      if (!config.enabled) {
        return {
          allowed: false,
          service,
          config: config.config as ServiceConfig,
          reason: 'Service disabled for user'
        };
      }

      // 3. Verificar expiración (trials/promos)
      if (config.expiresAt && new Date() > new Date(config.expiresAt)) {
        return {
          allowed: false,
          service,
          config: config.config as ServiceConfig,
          reason: 'Service expired'
        };
      }

      // 4. Verificar límites de rate/cuota
      const serviceConfig = config.config as ServiceConfig;

      if (serviceConfig.limits?.rateLimit || serviceConfig.limits?.quota) {
        const usage = await this.getServiceUsage(userId, service);
        const limit = serviceConfig.limits.rateLimit || serviceConfig.limits.quota;

        if (limit && limit !== -1 && usage.current >= limit) {
          return {
            allowed: false,
            service,
            config: serviceConfig,
            reason: serviceConfig.limits.rateLimit ? 'Rate limit exceeded' : 'Quota exceeded',
            metadata: {
              currentUsage: usage.current,
              limit,
              remaining: 0,
              resetAt: usage.resetAt
            }
          };
        }

        return {
          allowed: true,
          service,
          config: serviceConfig,
          metadata: {
            currentUsage: usage.current,
            limit,
            remaining: limit ? limit - usage.current : undefined,
            resetAt: usage.resetAt
          }
        };
      }

      return {
        allowed: true,
        service,
        config: serviceConfig
      };

    } catch (error) {
      logger.error('Failed to check service', {
        userId,
        service,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        allowed: false,
        service,
        reason: 'Internal error checking service'
      };
    }
  }

  async getServiceConfig(userId: string, service: ServiceId): Promise<ServiceConfig | undefined> {
    try {
      const capability = await db
        .select()
        .from(userCapabilities)
        .where(
          and(
            eq(userCapabilities.userId, userId),
            eq(userCapabilities.serviceId, service)
          )
        )
        .limit(1);

      if (capability.length === 0) return undefined;

      return capability[0].config as ServiceConfig;
    } catch (error) {
      logger.error('Failed to get service config', {
        userId,
        service,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return undefined;
    }
  }

  async getUserCapabilities(userId: string): Promise<UserCapabilities> {
    try {
      const capabilities = await db
        .select()
        .from(userCapabilities)
        .where(eq(userCapabilities.userId, userId));

      const services = new Map<ServiceId, ServiceConfig>();

      for (const cap of capabilities) {
        services.set(cap.serviceId as ServiceId, cap.config as ServiceConfig);
      }

      return {
        userId,
        services,
        globalLimits: {
          maxConcurrentRequests: 20,
          maxStorageBytes: 100 * 1024 * 1024,
          maxTeamMembers: 10
        }
      };
    } catch (error) {
      logger.error('Failed to get user capabilities', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Retornar vacío en caso de error
      return {
        userId,
        services: new Map()
      };
    }
  }

  async updateUserCapabilities(userId: string, capabilities: Partial<UserCapabilities>): Promise<void> {
    try {
      if (!capabilities.services) return;

      // Eliminar capacidades existentes
      await db
        .delete(userCapabilities)
        .where(eq(userCapabilities.userId, userId));

      // Insertar nuevas capacidades
      const values = [];
      for (const [serviceId, config] of capabilities.services) {
        values.push({
          userId,
          serviceId,
          enabled: config.enabled,
          config: config as unknown as Record<string, unknown>
        });
      }

      if (values.length > 0) {
        await db.insert(userCapabilities).values(values);
      }

      logger.info('User capabilities updated', { userId, services: values.length });
    } catch (error) {
      logger.error('Failed to update user capabilities', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async setServiceEnabled(userId: string, service: ServiceId, enabled: boolean): Promise<void> {
    try {
      await db
        .update(userCapabilities)
        .set({ enabled, updatedAt: new Date() })
        .where(
          and(
            eq(userCapabilities.userId, userId),
            eq(userCapabilities.serviceId, service)
          )
        );

      logger.info('Service toggled', { userId, service, enabled });
    } catch (error) {
      logger.error('Failed to toggle service', {
        userId,
        service,
        enabled,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async updateServiceConfig(userId: string, service: ServiceId, config: Partial<ServiceConfig>): Promise<void> {
    try {
      // Upsert: insertar si no existe, actualizar si existe
      await db
        .insert(userCapabilities)
        .values({
          userId,
          serviceId: service,
          enabled: true,
          config: config as unknown as Record<string, unknown>
        })
        .onConflictDoUpdate({
          target: [userCapabilities.userId, userCapabilities.serviceId],
          set: {
            config: sql`${userCapabilities.config} || ${JSON.stringify(config)}::jsonb`,
            updatedAt: new Date()
          }
        });

      logger.info('Service config updated', { userId, service });
    } catch (error) {
      logger.error('Failed to update service config', {
        userId,
        service,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async recordServiceUsage(userId: string, service: ServiceId, amount: number = 1): Promise<ServiceUsageResult> {
    try {
      const now = new Date();
      const resetAt = new Date(now.getTime() + 60000); // +1 minuto

      // Upsert: incrementar contador o crear nuevo
      const result = await db
        .insert(serviceUsage)
        .values({
          userId,
          serviceId: service,
          count: amount,
          resetAt,
          lastUsedAt: now
        })
        .onConflictDoUpdate({
          target: [serviceUsage.userId, serviceUsage.serviceId],
          set: {
            count: sql`CASE
              WHEN ${serviceUsage.resetAt} < NOW() THEN ${amount}
              ELSE ${serviceUsage.count} + ${amount}
            END`,
            resetAt: sql`CASE
              WHEN ${serviceUsage.resetAt} < NOW() THEN ${resetAt}
              ELSE ${serviceUsage.resetAt}
            END`,
            lastUsedAt: now
          }
        })
        .returning({ count: serviceUsage.count });

      const newCount = result[0]?.count || amount;
      const config = await this.getServiceConfig(userId, service);
      const limit = config?.limits?.rateLimit || config?.limits?.quota;
      const remaining = limit ? Math.max(0, limit - newCount) : undefined;

      logger.debug('Service usage recorded (DB)', {
        userId,
        service,
        amount,
        count: newCount,
        remaining
      });

      return {
        success: true,
        service,
        consumed: amount,
        remaining
      };
    } catch (error) {
      logger.error('Failed to record service usage', {
        userId,
        service,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        service,
        consumed: 0,
        error: {
          code: 'USAGE_RECORD_FAILED',
          message: 'Failed to record usage'
        }
      };
    }
  }

  async getServiceUsage(userId: string, service: ServiceId): Promise<{
    current: number;
    limit?: number;
    resetAt?: Date;
  }> {
    try {
      const usage = await db
        .select()
        .from(serviceUsage)
        .where(
          and(
            eq(serviceUsage.userId, userId),
            eq(serviceUsage.serviceId, service)
          )
        )
        .limit(1);

      if (usage.length === 0) {
        return { current: 0 };
      }

      const record = usage[0];
      const now = new Date();

      // Si expiró, retornar 0
      if (record.resetAt && now > new Date(record.resetAt)) {
        return { current: 0, resetAt: record.resetAt };
      }

      const config = await this.getServiceConfig(userId, service);
      const limit = config?.limits?.rateLimit || config?.limits?.quota;

      return {
        current: record.count || 0,
        limit,
        resetAt: record.resetAt
      };
    } catch (error) {
      logger.error('Failed to get service usage', {
        userId,
        service,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return { current: 0 };
    }
  }

  async resetUsage(userId: string, service?: ServiceId): Promise<void> {
    try {
      if (service) {
        await db
          .delete(serviceUsage)
          .where(
            and(
              eq(serviceUsage.userId, userId),
              eq(serviceUsage.serviceId, service)
            )
          );
        logger.info('Service usage reset (DB)', { userId, service });
      } else {
        await db
          .delete(serviceUsage)
          .where(eq(serviceUsage.userId, userId));
        logger.info('All usage reset (DB)', { userId });
      }
    } catch (error) {
      logger.error('Failed to reset usage', {
        userId,
        service,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async checkGlobalLimits(userId: string): Promise<boolean> {
    // TODO: Implementar checks de límites globales
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
    try {
      const usageRecords = await db
        .select()
        .from(serviceUsage)
        .where(eq(serviceUsage.userId, userId));

      const services = new Map<ServiceId, { used: number; limit?: number }>();

      for (const record of usageRecords) {
        const config = await this.getServiceConfig(userId, record.serviceId as ServiceId);
        const limit = config?.limits?.rateLimit || config?.limits?.quota;

        services.set(record.serviceId as ServiceId, {
          used: record.count || 0,
          limit
        });
      }

      return {
        services,
        globalUsage: {
          concurrentRequests: 0,
          storageBytes: 0,
          teamMembers: 1
        }
      };
    } catch (error) {
      logger.error('Failed to get usage stats', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        services: new Map(),
        globalUsage: {
          concurrentRequests: 0,
          storageBytes: 0,
          teamMembers: 1
        }
      };
    }
  }

  /**
   * Aplicar template a usuario (desde DB)
   */
  async applyTemplate(userId: string, templateName: string): Promise<void> {
    try {
      const template = await db
        .select()
        .from(capabilityTemplates)
        .where(
          and(
            eq(capabilityTemplates.name, templateName),
            eq(capabilityTemplates.isActive, true)
          )
        )
        .limit(1);

      if (template.length === 0) {
        throw new Error(`Template not found: ${templateName}`);
      }

      const services = template[0].services as Record<string, ServiceConfig>;

      // Eliminar capacidades existentes
      await db
        .delete(userCapabilities)
        .where(eq(userCapabilities.userId, userId));

      // Insertar servicios del template
      const values = [];
      for (const [serviceId, config] of Object.entries(services)) {
        values.push({
          userId,
          serviceId,
          enabled: config.enabled,
          config: config as unknown as Record<string, unknown>
        });
      }

      if (values.length > 0) {
        await db.insert(userCapabilities).values(values);
      }

      logger.info('Template applied to user (DB)', { userId, template: templateName, services: values.length });
    } catch (error) {
      logger.error('Failed to apply template', {
        userId,
        templateName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
