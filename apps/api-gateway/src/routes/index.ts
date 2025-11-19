import { Elysia } from 'elysia';
import { messagesRoutes } from './messages';
import { healthRoutes } from './health';
import { websocketRoutes } from './websocket';
import { simulationRoutes } from './simulation';
import { capabilitiesRoutes, adminCapabilitiesRoutes } from './capabilities';
import { adminRoutes } from './admin';

/**
 * Configuración centralizada de todas las rutas del API Gateway
 *
 * Estructura de rutas V2 (Multi-Tenancy):
 * - GET  /              → Health check básico
 * - GET  /health        → Health check detallado con DB
 * - POST /messages      → Crear mensaje (LEGACY - migrar a /chat/*)
 * - GET  /messages      → Listar mensajes (LEGACY - migrar a /admin/conversations)
 * - WS   /realtime      → WebSocket en tiempo real (LEGACY - migrar a /admin/realtime + /chat/realtime)
 * - POST /simulate/*    → Endpoints de simulación (desarrollo)
 * - GET  /me/*          → Capacidades y uso (LEGACY - migrar a /admin/capabilities)
 * - POST /admin/*       → Multi-tenancy V2 (NEW - tenant users, JWT auth)
 *   - POST /admin/auth/login  → Login (public)
 *   - POST /admin/auth/signup → Signup (public)
 *   - GET  /admin/* → Protected routes (require JWT)
 */
export const routes = new Elysia()
  .use(healthRoutes)
  .use(adminRoutes)              // NEW: Multi-tenancy V2 admin routes
  .use(messagesRoutes)           // LEGACY: Will be migrated to /chat/*
  .use(websocketRoutes)          // LEGACY: Will be split into /admin/realtime + /chat/realtime
  .use(simulationRoutes)         // Development only
  .use(capabilitiesRoutes)       // LEGACY: Will be migrated to /admin/capabilities
  .use(adminCapabilitiesRoutes); // LEGACY: Will be removed
