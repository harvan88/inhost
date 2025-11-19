import { Elysia } from 'elysia';
import { messagesRoutes } from './messages';
import { healthRoutes } from './health';
import { websocketRoutes } from './websocket';
import { simulationRoutes } from './simulation';
import { capabilitiesRoutes, adminCapabilitiesRoutes } from './capabilities';

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
 * - GET  /me/*          → Capacidades y uso del usuario
 * - POST /admin/*       → Administración de capacidades (futuro: auth)
 */
export const routes = new Elysia()
  .use(healthRoutes)
  .use(messagesRoutes)
  .use(websocketRoutes)
  .use(simulationRoutes)
  .use(capabilitiesRoutes)
  .use(adminCapabilitiesRoutes);
