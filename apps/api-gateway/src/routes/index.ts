import { Elysia } from 'elysia';
import { messagesRoutes } from './messages';
import { healthRoutes } from './health';
import { websocketRoutes } from './websocket';
import { simulationRoutes } from './simulation';
<<<<<<< HEAD
import { capabilitiesRoutes, adminCapabilitiesRoutes } from './capabilities';
import { adminRoutes } from './admin';
=======
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
>>>>>>> claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe

/**
 * Configuración centralizada de todas las rutas del API Gateway
 *
 * Estructura de rutas V2 (Multi-Tenancy):
 * - GET  /              → Health check básico
 * - GET  /health        → Health check detallado con DB
<<<<<<< HEAD
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
=======
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
>>>>>>> claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
