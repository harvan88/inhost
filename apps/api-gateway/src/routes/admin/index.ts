import { Elysia } from 'elysia';
import { jwtAuth } from '../../middleware/jwt-auth';
import { authRoutes } from './auth';

/**
 * Admin Routes - Multi-Tenancy V2
 *
 * All routes under /admin/* are for tenant users (admins, agents, owners)
 *
 * Routes:
 * - /admin/auth/* - Public (login, signup)
 * - /admin/* - Protected by JWT (tenant, conversations, end-users, etc.)
 *
 * Architecture:
 * 1. authRoutes are mounted first (public - no JWT required)
 * 2. jwtAuth() middleware is applied
 * 3. All subsequent routes require valid JWT token
 *
 * Future Routes (to be implemented):
 * - /admin/tenant - Get/update tenant info
 * - /admin/conversations - List conversations
 * - /admin/end-users - List end users
 * - /admin/team - Manage team members
 * - /admin/capabilities - View/toggle capabilities
 * - /admin/analytics - Analytics dashboard
 */

export const adminRoutes = new Elysia({ prefix: '/admin' })
  // Public routes (no JWT required)
  .use(authRoutes) // POST /admin/auth/login, /admin/auth/signup

  // Apply JWT middleware - all routes below require authentication
  // .use(jwtAuth())

  // Protected routes (TODO - implement these)
  // .use(tenantRoutes)        // GET /admin/tenant, PATCH /admin/tenant
  // .use(conversationsRoutes) // GET /admin/conversations
  // .use(endUsersRoutes)      // GET /admin/end-users
  // .use(teamRoutes)          // GET /admin/team, POST /admin/team
  // .use(capabilitiesRoutes)  // GET /admin/capabilities
  // .use(analyticsRoutes)     // GET /admin/analytics/dashboard

  .get(
    '/',
    () => ({
      message: 'INHOST Admin API V2 - Multi-Tenancy',
      version: '2.0.0',
      endpoints: {
        auth: {
          login: 'POST /admin/auth/login',
          signup: 'POST /admin/auth/signup'
        },
        protected: {
          note: 'Require JWT token in Authorization: Bearer <token>',
          tenant: 'GET /admin/tenant (TODO)',
          conversations: 'GET /admin/conversations (TODO)',
          endUsers: 'GET /admin/end-users (TODO)',
          team: 'GET /admin/team (TODO)',
          capabilities: 'GET /admin/capabilities (TODO)',
          analytics: 'GET /admin/analytics (TODO)'
        }
      }
    }),
    {
      detail: {
        summary: 'Admin API Info',
        description: 'Get information about available admin endpoints',
        tags: ['Admin']
      }
    }
  );
