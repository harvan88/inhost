/**
 * Capabilities Routes
 *
 * Endpoints para que el frontend consulte y gestione capacidades de usuario.
 * Permite ver servicios disponibles, límites, uso actual, etc.
 *
 * @module routes/capabilities
 */

import { Elysia, t } from 'elysia';
import type { IServiceGate, ServiceId } from '../core/interfaces';
import { logger } from '../middleware/logger';

interface CapabilitiesRoutesConfig {
  serviceGate: IServiceGate;
}

/**
 * Crear rutas de capacidades
 */
export function createCapabilitiesRoutes(config: CapabilitiesRoutesConfig) {
  const { serviceGate } = config;

  return new Elysia({ prefix: '/me' })
    /**
     * GET /me/capabilities
     * Obtener todas las capacidades del usuario actual
     */
    .get('/capabilities', async ({ request }) => {
      const userId = request.headers.get('x-user-id') || 'anonymous';

      try {
        const capabilities = await serviceGate.getUserCapabilities(userId);

        // Convertir Map a Object para JSON
        const servicesObject: Record<string, any> = {};
        for (const [serviceId, config] of capabilities.services) {
          servicesObject[serviceId] = config;
        }

        return {
          success: true,
          data: {
            userId: capabilities.userId,
            services: servicesObject,
            globalLimits: capabilities.globalLimits,
            expiresAt: capabilities.expiresAt?.toISOString()
          }
        };
      } catch (error) {
        logger.error('Failed to get user capabilities', {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        return {
          success: false,
          error: {
            code: 'CAPABILITIES_ERROR',
            message: 'Failed to retrieve user capabilities',
            timestamp: new Date().toISOString()
          }
        };
      }
    })

    /**
     * GET /me/usage
     * Obtener estadísticas de uso del usuario actual
     */
    .get('/usage', async ({ request }) => {
      const userId = request.headers.get('x-user-id') || 'anonymous';

      try {
        const stats = await serviceGate.getUsageStats(userId);

        // Convertir Map a Object
        const servicesObject: Record<string, any> = {};
        for (const [serviceId, usage] of stats.services) {
          servicesObject[serviceId] = usage;
        }

        return {
          success: true,
          data: {
            userId,
            services: servicesObject,
            globalUsage: stats.globalUsage
          }
        };
      } catch (error) {
        logger.error('Failed to get usage stats', {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        return {
          success: false,
          error: {
            code: 'USAGE_ERROR',
            message: 'Failed to retrieve usage statistics',
            timestamp: new Date().toISOString()
          }
        };
      }
    })

    /**
     * GET /me/services/:serviceId
     * Verificar si el usuario puede usar un servicio específico
     */
    .get('/services/:serviceId', async ({ request, params }) => {
      const userId = request.headers.get('x-user-id') || 'anonymous';
      const { serviceId } = params;

      try {
        const result = await serviceGate.canUseService(userId, serviceId as ServiceId);
        const usage = await serviceGate.getServiceUsage(userId, serviceId as ServiceId);

        return {
          success: true,
          data: {
            service: serviceId,
            allowed: result.allowed,
            reason: result.reason,
            config: result.config,
            usage: {
              current: usage.current,
              limit: usage.limit,
              remaining: usage.limit ? usage.limit - usage.current : undefined,
              resetAt: usage.resetAt?.toISOString()
            },
            metadata: result.metadata
          }
        };
      } catch (error) {
        logger.error('Failed to check service', {
          userId,
          serviceId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        return {
          success: false,
          error: {
            code: 'SERVICE_CHECK_ERROR',
            message: 'Failed to check service availability',
            timestamp: new Date().toISOString()
          }
        };
      }
    })

    /**
     * GET /me/services/:serviceId/config
     * Obtener configuración de un servicio específico
     */
    .get('/services/:serviceId/config', async ({ request, params }) => {
      const userId = request.headers.get('x-user-id') || 'anonymous';
      const { serviceId } = params;

      try {
        const config = await serviceGate.getServiceConfig(userId, serviceId as ServiceId);

        if (!config) {
          return {
            success: false,
            error: {
              code: 'SERVICE_NOT_FOUND',
              message: `Service ${serviceId} not configured for user`,
              timestamp: new Date().toISOString()
            }
          };
        }

        return {
          success: true,
          data: {
            service: serviceId,
            config
          }
        };
      } catch (error) {
        logger.error('Failed to get service config', {
          userId,
          serviceId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        return {
          success: false,
          error: {
            code: 'CONFIG_ERROR',
            message: 'Failed to retrieve service configuration',
            timestamp: new Date().toISOString()
          }
        };
      }
    });
}

/**
 * Rutas administrativas (requieren permisos de admin)
 */
export function createAdminCapabilitiesRoutes(config: CapabilitiesRoutesConfig) {
  const { serviceGate } = config;

  return new Elysia({ prefix: '/admin' })
    /**
     * GET /admin/templates
     * Listar templates disponibles
     */
    .get('/templates', async () => {
      // Si CapabilityBasedServiceGate tiene método getTemplates
      const templates = [
        {
          id: 'starter',
          name: 'Starter',
          description: 'Basic features for getting started',
          features: {
            rateLimit: 12,
            ai: false,
            analytics: false
          }
        },
        {
          id: 'professional',
          name: 'Professional',
          description: 'Advanced features for power users',
          features: {
            rateLimit: 30,
            ai: true,
            analytics: true
          }
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          description: 'Unlimited features for large teams',
          features: {
            rateLimit: 100,
            ai: true,
            analytics: true,
            custom: true
          }
        }
      ];

      return {
        success: true,
        data: { templates }
      };
    })

    /**
     * POST /admin/users/:userId/capabilities
     * Actualizar capacidades de un usuario (solo admin)
     */
    .post('/users/:userId/capabilities', async ({ params, body }) => {
      const { userId } = params;
      const updates = body as any;

      try {
        await serviceGate.updateUserCapabilities(userId, updates);

        return {
          success: true,
          data: {
            userId,
            message: 'Capabilities updated successfully'
          }
        };
      } catch (error) {
        logger.error('Failed to update capabilities', {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        return {
          success: false,
          error: {
            code: 'UPDATE_ERROR',
            message: 'Failed to update user capabilities',
            timestamp: new Date().toISOString()
          }
        };
      }
    })

    /**
     * POST /admin/users/:userId/services/:serviceId/enable
     * Habilitar/deshabilitar servicio para un usuario
     */
    .post('/users/:userId/services/:serviceId/enable', async ({ params, body }) => {
      const { userId, serviceId } = params;
      const { enabled } = body as { enabled: boolean };

      try {
        await serviceGate.setServiceEnabled(userId, serviceId as ServiceId, enabled);

        return {
          success: true,
          data: {
            userId,
            service: serviceId,
            enabled,
            message: `Service ${enabled ? 'enabled' : 'disabled'} successfully`
          }
        };
      } catch (error) {
        logger.error('Failed to toggle service', {
          userId,
          serviceId,
          enabled,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        return {
          success: false,
          error: {
            code: 'TOGGLE_ERROR',
            message: 'Failed to toggle service',
            timestamp: new Date().toISOString()
          }
        };
      }
    })

    /**
     * PATCH /admin/users/:userId/services/:serviceId/config
     * Actualizar configuración de un servicio
     */
    .patch('/users/:userId/services/:serviceId/config', async ({ params, body }) => {
      const { userId, serviceId } = params;
      const configUpdates = body as any;

      try {
        await serviceGate.updateServiceConfig(userId, serviceId as ServiceId, configUpdates);

        return {
          success: true,
          data: {
            userId,
            service: serviceId,
            message: 'Service configuration updated successfully'
          }
        };
      } catch (error) {
        logger.error('Failed to update service config', {
          userId,
          serviceId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        return {
          success: false,
          error: {
            code: 'CONFIG_UPDATE_ERROR',
            message: 'Failed to update service configuration',
            timestamp: new Date().toISOString()
          }
        };
      }
    })

    /**
     * POST /admin/users/:userId/template/:templateName
     * Aplicar un template a un usuario
     */
    .post('/users/:userId/template/:templateName', async ({ params }) => {
      const { userId, templateName } = params;

      try {
        // Verificar si serviceGate tiene método applyTemplate
        if ('applyTemplate' in serviceGate) {
          await (serviceGate as any).applyTemplate(userId, templateName);

          return {
            success: true,
            data: {
              userId,
              template: templateName,
              message: 'Template applied successfully'
            }
          };
        } else {
          return {
            success: false,
            error: {
              code: 'NOT_SUPPORTED',
              message: 'Template application not supported by current ServiceGate implementation',
              timestamp: new Date().toISOString()
            }
          };
        }
      } catch (error) {
        logger.error('Failed to apply template', {
          userId,
          templateName,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        return {
          success: false,
          error: {
            code: 'TEMPLATE_ERROR',
            message: 'Failed to apply template',
            timestamp: new Date().toISOString()
          }
        };
      }
    });
}
