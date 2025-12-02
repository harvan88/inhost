/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "index.ts"
 *   type: "type"
 *   layer: "frontend"
 *   domain: "api"
 *   purpose: "Barrel export for src module"
 *
 * DEPENDENCIES:
 *   internal: ["./config","./middleware/errorHandler","./middleware/logger","./routes","./services"]
 *   external: ["@elysiajs/cors","elysia"]
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["App"]
 *   inputs: "None"
 *   outputs: "void"
 *   errors: "None"
 *
 * INTEGRATION:
 *   data_flow: "WebSocket → Handler → Store → UI"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: ["./config","./middleware/errorHandler","./middleware/logger","./routes","./services","@elysiajs/cors","elysia"]
 *   critical: true
 *
 * === DOC_END :: index.ts ===
 */

import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { routes } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { httpLogger, logger } from './middleware/logger';
import { config } from './config';
import { initializeServices, shutdownServices } from './services';

/**
 * Inhost API Gateway
 *
 * Punto único de entrada para todas las peticiones del sistema.
 * Implementa una arquitectura modular basada en servicios.
 */
const app = new Elysia()
  // CORS - Permitir peticiones desde el navegador
  .use(cors({
    origin: config.app.env === 'development' ? true : /^https?:\/\/(.*\.)?inhost\.com$/,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    exposeHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After'
    ]
  }))

  // Middleware global
  .use(errorHandler)
  .use(httpLogger)

  // Rutas de la aplicación
  .use(routes)

  // Iniciar servidor
  .listen(config.app.port);

// Inicializar servicios modularizados
await initializeServices();

// Log de inicio
logger.info(`🦊 ${config.app.name} is running`, {
  port: config.app.port,
  env: config.app.env,
  version: config.app.version
});

logger.info('🗄️  Database configuration', {
  host: config.database.host,
  port: config.database.port,
  database: config.database.database
});

logger.info('📍 Available routes', {
  routes: [
    'GET  /              → API Information',
    'GET  /health        → Health check with DB',
    'POST /messages      → Create message',
    'GET  /messages      → List messages',
    'WS   /realtime      → WebSocket real-time'
  ]
});

export type App = typeof app;