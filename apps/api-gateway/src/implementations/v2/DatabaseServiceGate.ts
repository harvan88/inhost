/**
 * DatabaseServiceGate (V2 - Multi-Tenancy)
 *
 * Implementación de IServiceGate usando multi-tenancy.
 * Capabilities son a nivel TENANT (organización), no usuario individual.
 *
 * IMPORTANTE:
 * - El parámetro "userId" ahora representa "tenantId"
 * - Capabilities son compartidas por todos los usuarios de un tenant
 * - Usage tracking es por tenant (no por usuario individual)
 *
 * Cambios desde V1:
 * - user_capabilities → tenant_capabilities
 * - service_usage → tenant_usage
 * - userId → tenantId (en queries internos)
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
import { pool } from '@inhost/shared';

export class DatabaseServiceGate implements IServiceGate {
  constructor() {
    logger.info('🚪 DatabaseServiceGate (V2 Multi-Tenancy) initialized');
  }

  /**
   * Verificar si un tenant puede usar un servicio
   *
   * NOTA: userId aquí representa tenantId en el contexto multi-tenancy
   */
  async canUseService(userId: string, service: ServiceId): Promise<ServiceCheckResult> {
    const tenantId = userId; // En multi-tenancy, capabilities son por tenant

    try {
      // 1. Obtener configuración del servicio desde tenant_capabilities
      const result = await pool.query(
        `
        SELECT enabled, config, expires_at
        FROM tenant_capabilities
        WHERE tenant_id = $1 AND service_id = $2
        LIMIT 1
        `,
        [tenantId, service]
      );

      if (result.rows.length === 0) {
        return {
          allowed: false,
          service,
          reason: 'Service not configured for tenant'
        };
      }

      const capability = result.rows[0];

      // 2. Verificar si está habilitado
      if (!capability.enabled) {
        return {
          allowed: false,
          service,
          config: capability.config as ServiceConfig,
          reason: 'Service disabled for tenant'
        };
      }

      // 3. Verificar expiración (trials/promos)
      if (capability.expires_at && new Date() > new Date(capability.expires_at)) {
        return {
          allowed: false,
          service,
          config: capability.config as ServiceConfig,
          reason: 'Service expired'
        };
      }

      // 4. Verificar límites de rate/cuota
      const serviceConfig = capability.config as ServiceConfig;

      if (serviceConfig.limits?.rateLimit || serviceConfig.limits?.quota) {
        const usage = await this.getServiceUsage(tenantId, service);
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
        tenantId,
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
    const tenantId = userId;

    try {
      const result = await pool.query(
        `
        SELECT config
        FROM tenant_capabilities
        WHERE tenant_id = $1 AND service_id = $2
        LIMIT 1
        `,
        [tenantId, service]
      );

      if (result.rows.length === 0) return undefined;

      return result.rows[0].config as ServiceConfig;
    } catch (error) {
      logger.error('Failed to get service config', {
        tenantId,
        service,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return undefined;
    }
  }

  async getUserCapabilities(userId: string): Promise<UserCapabilities> {
    const tenantId = userId;

    try {
      const result = await pool.query(
        `
        SELECT service_id, config
        FROM tenant_capabilities
        WHERE tenant_id = $1
        `,
        [tenantId]
      );

      const services = new Map<ServiceId, ServiceConfig>();

      for (const row of result.rows) {
        services.set(row.service_id as ServiceId, row.config as ServiceConfig);
      }

      return {
        userId: tenantId,
        services,
        globalLimits: {
          maxConcurrentRequests: 20,
          maxStorageBytes: 100 * 1024 * 1024,
          maxTeamMembers: 10
        }
      };
    } catch (error) {
      logger.error('Failed to get tenant capabilities', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        userId: tenantId,
        services: new Map()
      };
    }
  }

  async updateUserCapabilities(userId: string, capabilities: Partial<UserCapabilities>): Promise<void> {
    const tenantId = userId;

    try {
      if (!capabilities.services) return;

      // Usar PostgreSQL function para actualizar capabilities
      for (const [serviceId, config] of capabilities.services) {
        await pool.query(
          `
          INSERT INTO tenant_capabilities (tenant_id, service_id, enabled, config)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (tenant_id, service_id)
          DO UPDATE SET
            enabled = $3,
            config = $4,
            updated_at = NOW()
          `,
          [tenantId, serviceId, config.enabled, JSON.stringify(config)]
        );
      }

      logger.info('Tenant capabilities updated', {
        tenantId,
        services: capabilities.services.size
      });
    } catch (error) {
      logger.error('Failed to update tenant capabilities', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async setServiceEnabled(userId: string, service: ServiceId, enabled: boolean): Promise<void> {
    const tenantId = userId;

    try {
      await pool.query(
        `
        UPDATE tenant_capabilities
        SET enabled = $1, updated_at = NOW()
        WHERE tenant_id = $2 AND service_id = $3
        `,
        [enabled, tenantId, service]
      );

      logger.info('Service toggled', { tenantId, service, enabled });
    } catch (error) {
      logger.error('Failed to toggle service', {
        tenantId,
        service,
        enabled,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async updateServiceConfig(userId: string, service: ServiceId, config: Partial<ServiceConfig>): Promise<void> {
    const tenantId = userId;

    try {
      await pool.query(
        `
        INSERT INTO tenant_capabilities (tenant_id, service_id, enabled, config)
        VALUES ($1, $2, true, $3)
        ON CONFLICT (tenant_id, service_id)
        DO UPDATE SET
          config = tenant_capabilities.config || $3::jsonb,
          updated_at = NOW()
        `,
        [tenantId, service, JSON.stringify(config)]
      );

      logger.info('Service config updated', { tenantId, service });
    } catch (error) {
      logger.error('Failed to update service config', {
        tenantId,
        service,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async recordServiceUsage(userId: string, service: ServiceId, amount: number = 1): Promise<ServiceUsageResult> {
    const tenantId = userId;

    try {
      // Usar PostgreSQL function increment_tenant_usage
      const result = await pool.query(
        `SELECT increment_tenant_usage($1, $2, $3) as count`,
        [tenantId, service, amount]
      );

      const newCount = result.rows[0]?.count || amount;
      const config = await this.getServiceConfig(tenantId, service);
      const limit = config?.limits?.rateLimit || config?.limits?.quota;
      const remaining = limit ? Math.max(0, limit - newCount) : undefined;

      logger.debug('Service usage recorded (tenant)', {
        tenantId,
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
        tenantId,
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
    const tenantId = userId;

    try {
      const result = await pool.query(
        `
        SELECT count, reset_at
        FROM tenant_usage
        WHERE tenant_id = $1 AND service_id = $2
        LIMIT 1
        `,
        [tenantId, service]
      );

      if (result.rows.length === 0) {
        return { current: 0 };
      }

      const record = result.rows[0];
      const now = new Date();

      // Si expiró, retornar 0
      if (record.reset_at && now > new Date(record.reset_at)) {
        return { current: 0, resetAt: record.reset_at };
      }

      const config = await this.getServiceConfig(tenantId, service);
      const limit = config?.limits?.rateLimit || config?.limits?.quota;

      return {
        current: record.count || 0,
        limit,
        resetAt: record.reset_at
      };
    } catch (error) {
      logger.error('Failed to get service usage', {
        tenantId,
        service,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return { current: 0 };
    }
  }

  async resetUsage(userId: string, service?: ServiceId): Promise<void> {
    const tenantId = userId;

    try {
      if (service) {
        await pool.query(
          `DELETE FROM tenant_usage WHERE tenant_id = $1 AND service_id = $2`,
          [tenantId, service]
        );
        logger.info('Service usage reset (tenant)', { tenantId, service });
      } else {
        await pool.query(
          `DELETE FROM tenant_usage WHERE tenant_id = $1`,
          [tenantId]
        );
        logger.info('All usage reset (tenant)', { tenantId });
      }
    } catch (error) {
      logger.error('Failed to reset usage', {
        tenantId,
        service,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async checkGlobalLimits(userId: string): Promise<boolean> {
    // TODO: Implementar checks de límites globales a nivel tenant
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
    const tenantId = userId;

    try {
      const result = await pool.query(
        `
        SELECT service_id, count
        FROM tenant_usage
        WHERE tenant_id = $1
        `,
        [tenantId]
      );

      const services = new Map<ServiceId, { used: number; limit?: number }>();

      for (const record of result.rows) {
        const config = await this.getServiceConfig(tenantId, record.service_id as ServiceId);
        const limit = config?.limits?.rateLimit || config?.limits?.quota;

        services.set(record.service_id as ServiceId, {
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
        tenantId,
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
   * Aplicar template a tenant (usando PostgreSQL function)
   */
  async applyTemplate(userId: string, templateName: string): Promise<void> {
    const tenantId = userId;

    try {
      await pool.query(
        `SELECT apply_template_to_tenant($1, $2)`,
        [tenantId, templateName]
      );

      logger.info('Template applied to tenant', { tenantId, template: templateName });
    } catch (error) {
      logger.error('Failed to apply template', {
        tenantId,
        templateName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
