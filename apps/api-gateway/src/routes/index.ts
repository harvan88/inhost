import { Elysia } from 'elysia';
import { messagesRoutes } from './messages';
import { healthRoutes } from './health';
import { websocketRoutes } from './websocket';
import { simulationRoutes } from './simulation';

/**
 * Configuración centralizada de todas las rutas del API Gateway
 *
 * Estructura de rutas:
 * - GET  /              → Health check básico
 * - GET  /health        → Health check detallado con DB
 * - POST /messages      → Crear mensaje
 * - GET  /messages      → Listar mensajes
 * - WS   /realtime      → WebSocket en tiempo real
 * - POST /simulate/*    → Endpoints de simulación
 */
export const routes = new Elysia()
  .use(healthRoutes)
  .use(messagesRoutes)
  .use(websocketRoutes)
  .use(simulationRoutes);
