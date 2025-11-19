import { Elysia } from 'elysia';
import { messagesRoutes } from './messages';
import { healthRoutes } from './health';
import { websocketRoutes } from './websocket';
import { simulationRoutes } from './simulation';
import { adminAuthRoutes } from './admin/auth';
import { adminTenantRoutes } from './admin/tenant';
import { adminConversationsRoutes } from './admin/conversations';
import { adminMessagesRoutes } from './admin/messages';
import { adminEndUsersRoutes } from './admin/end-users';
import { adminTeamRoutes } from './admin/team';

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
 * - POST /admin/auth/*  → Admin authentication (signup, login, me)
 * - GET  /admin/tenant  → Tenant management
 * - GET  /admin/conversations → Conversations management
 * - GET  /admin/end-users → End users management
 * - GET  /admin/team → Team management
 */
export const routes = new Elysia()
  .use(healthRoutes)
  .use(messagesRoutes)
  .use(websocketRoutes)
  .use(simulationRoutes)
  .use(adminAuthRoutes)
  .use(adminTenantRoutes)
  .use(adminConversationsRoutes)
  .use(adminMessagesRoutes)
  .use(adminEndUsersRoutes)
  .use(adminTeamRoutes);
