import { Elysia } from 'elysia';
import { messageService } from '../services/messageService';
import { config } from '../config';
import { createSuccessResponse } from '../types/api';
import type { HealthDTO } from '../types/api';
import { httpLogger } from '../middleware/logger';

/**
 * Rutas de Health Check
 *
 * Endpoints:
 * - GET / - Información básica del API
 * - GET /health - Health check con verificación de servicios
 */
export const healthRoutes = new Elysia()
  .use(httpLogger)

  // GET / - Root endpoint
  .get('/', () => {
    const response: HealthDTO.DetailedResponse = {
      name: config.app.name,
      version: config.app.version,
      status: 'running',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: 'up' // Se verifica en /health
        }
      }
    };

    return createSuccessResponse(response);
  }, {
    detail: {
      summary: 'API Information',
      description: 'Returns basic information about the API',
      tags: ['Health']
    }
  })

  // GET /health - Health check con verificación de base de datos
  .get('/health', async () => {
    const healthCheck = await messageService.checkHealth();

    const response: HealthDTO.Response = {
      status: healthCheck.status as 'healthy' | 'unhealthy',
      database: healthCheck.database as 'postgresql' | 'disconnected',
      timestamp: new Date().toISOString(),
      version: config.app.version,
      ...(healthCheck.error && { error: healthCheck.error })
    };

    return createSuccessResponse(response);
  }, {
    detail: {
      summary: 'Health Check',
      description: 'Checks the health of the API and its dependencies',
      tags: ['Health']
    }
  });
