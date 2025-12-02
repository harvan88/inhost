/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "routes/health.ts"
 *   type: "controller"
 *   layer: "frontend"
 *   domain: "api"
 *   purpose: "Handles health API routes"
 *
 * DEPENDENCIES:
 *   internal: ["../config","../config/redis","../middleware/logger","../services/messageService","../types/api"]
 *   external: ["elysia"]
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["healthRoutes"]
 *   inputs: "None"
 *   outputs: "void"
 *   errors: "None"
 *
 * INTEGRATION:
 *   data_flow: "Request → Middleware → Handler → Response"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: ["../config","../config/redis","../middleware/logger","../services/messageService","../types/api","elysia"]
 *   critical: false
 *
 * === DOC_END :: health.ts ===
 */

import { Elysia } from 'elysia';
import { messageService } from '../services/messageService';
import { config } from '../config';
import { createSuccessResponse } from '../types/api';
import type { HealthDTO } from '../types/api';
import { httpLogger } from '../middleware/logger';
import { shouldUseRedis, checkRedisConnection } from '../config/redis';

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

    // Verificar Redis si está configurado
    let redisInfo = undefined;
    if (shouldUseRedis()) {
      const redisConnected = await checkRedisConnection();
      redisInfo = {
        status: redisConnected ? 'connected' : 'disconnected',
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
      };
    }

    const response: HealthDTO.Response = {
      status: healthCheck.status as 'healthy' | 'unhealthy',
      database: healthCheck.database as 'postgresql' | 'disconnected',
      timestamp: new Date().toISOString(),
      version: config.app.version,
      ...(redisInfo && { redis: redisInfo }),
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
