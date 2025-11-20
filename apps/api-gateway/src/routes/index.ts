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
import { adminTeamRoutes, adminTeamInvitesRoutes } from './admin/team';
import { adminAccountRoutes } from './admin/account';
import { adminIntegrationsRoutes } from './admin/integrations';
import { adminSyncRoutes } from './admin/sync';
import { adminMentionsRoutes } from './admin/mentions';
import { adminFeedbackRoutes } from './admin/feedback';

/**
 * Configuración centralizada de todas las rutas del API Gateway
 *
 * Estructura de rutas V2 (Multi-Tenancy):
 * - GET  /              → Health check básico
 * - GET  /health        → Health check detallado con DB
 * - POST /messages      → Crear mensaje
 * - GET  /messages      → Listar mensajes
 * - WS   /realtime      → WebSocket en tiempo real
 * - POST /simulate/*    → Endpoints de simulación
 * - POST /admin/auth/*  → Admin authentication (signup, login, me)
 * - GET  /admin/tenant  → Tenant management
 * - GET  /admin/conversations → Conversations management
 * - GET  /admin/messages → Messages management
 * - GET  /admin/end-users → End users management
 * - GET  /admin/team → Team management
 * - POST /admin/team/invites → Team invitations
 * - GET  /admin/account → Account settings
 * - GET  /admin/integrations → Integrations management
 * - GET  /admin/mentions → Mentions management (@username)
 * - POST /admin/messages/:id/feedback → Message feedback (rating + comments)
 * - GET  /admin/feedback/analytics → Feedback analytics by extension
 */
export const routes = new Elysia()
  .use(healthRoutes)
  .use(messagesRoutes)
  .use(websocketRoutes)
  .use(simulationRoutes)
  .use(adminAuthRoutes)
  .use(adminTenantRoutes)
  .use(adminSyncRoutes)
  .use(adminConversationsRoutes)
  .use(adminMessagesRoutes)
  .use(adminEndUsersRoutes)
  .use(adminTeamRoutes)
  .use(adminTeamInvitesRoutes)
  .use(adminAccountRoutes)
  .use(adminIntegrationsRoutes)
  .use(adminMentionsRoutes)
  .use(adminFeedbackRoutes);
