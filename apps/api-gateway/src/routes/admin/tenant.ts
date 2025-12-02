/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\routes\admin\tenant.ts"
 *   type: "controller"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Handles tenant API routes"
 *
 * DEPENDENCIES:
 *   internal: ["../../middleware/auth","../../middleware/logger","../../types/api"]
 *   external: ["@inhost/shared","elysia"]
 *   infrastructure: ["PostgreSQL"]
 *
 * CONTRACTS:
 *   exports: ["adminTenantRoutes"]
 *   inputs: "None"
 *   outputs: "void"
 *   errors: "None"
 *
 * INTEGRATION:
 *   data_flow: "Component → API → Backend"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: ["../../middleware/auth","../../middleware/logger","../../types/api","@inhost/shared","elysia"]
 *   critical: false
 *
 * === DOC_END :: tenant.ts ===
 */

/**
 * Admin Tenant Management Routes
 *
 * Endpoints:
 * - GET /admin/tenant - Get current tenant information
 * - PATCH /admin/tenant - Update tenant settings
 * - GET /admin/tenant/stats - Get tenant statistics
 */

import { Elysia, t } from 'elysia';
import { eq, and, count } from 'drizzle-orm';
import { db, tenants, conversations, endUsers, adminUsers } from '@inhost/shared';
import { createSuccessResponse, createErrorResponse } from '../../types/api';
import { requireAuth, requireRole } from '../../middleware/auth';
import { httpLogger } from '../../middleware/logger';

/**
 * Tenant Management Routes
 */
export const adminTenantRoutes = new Elysia({ prefix: '/admin/tenant' })
  .use(httpLogger)
  .use(requireAuth())

  // GET /admin/tenant - Get current tenant information
  .get(
    '/',
    async ({ user, error }) => {
      try {
        const tenant = await db.query.tenants.findFirst({
          where: eq(tenants.id, user.tenantId),
        });

        if (!tenant) {
          return error(404, createErrorResponse('TENANT_NOT_FOUND', 'Tenant not found'));
        }

        return createSuccessResponse({
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan,
          settings: tenant.settings,
          subscriptionStatus: tenant.subscriptionStatus,
          trialEndsAt: tenant.trialEndsAt,
          createdAt: tenant.createdAt,
        });
      } catch (err: any) {
        console.error('Get tenant error:', err);
        return error(500, createErrorResponse('FETCH_FAILED', 'Failed to fetch tenant data'));
      }
    },
    {
      detail: {
        summary: 'Get Tenant',
        description: 'Get current tenant information',
        tags: ['Admin Tenant'],
      },
    }
  )

  // PATCH /admin/tenant - Update tenant settings (owner/admin only)
  .use(requireRole(['owner', 'admin']))
  .patch(
    '/',
    async ({ user, body, error }) => {
      const { name, settings } = body;

      try {
        const updateData: any = {};
        if (name) updateData.name = name;
        if (settings) updateData.settings = settings;

        const [updatedTenant] = await db
          .update(tenants)
          .set({ ...updateData, updatedAt: new Date() })
          .where(eq(tenants.id, user.tenantId))
          .returning();

        if (!updatedTenant) {
          return error(404, createErrorResponse('TENANT_NOT_FOUND', 'Tenant not found'));
        }

        return createSuccessResponse({
          id: updatedTenant.id,
          name: updatedTenant.name,
          slug: updatedTenant.slug,
          plan: updatedTenant.plan,
          settings: updatedTenant.settings,
          subscriptionStatus: updatedTenant.subscriptionStatus,
          trialEndsAt: updatedTenant.trialEndsAt,
          updatedAt: updatedTenant.updatedAt,
        });
      } catch (err: any) {
        console.error('Update tenant error:', err);
        return error(500, createErrorResponse('UPDATE_FAILED', 'Failed to update tenant'));
      }
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 2, maxLength: 255 })),
        settings: t.Optional(t.Any()),
      }),
      detail: {
        summary: 'Update Tenant',
        description: 'Update tenant name and settings (owner/admin only)',
        tags: ['Admin Tenant'],
      },
    }
  )

  // GET /admin/tenant/stats - Get tenant statistics
  .get(
    '/stats',
    async ({ user, error }) => {
      try {
        // Count active conversations
        const [activeConversations] = await db
          .select({ count: count() })
          .from(conversations)
          .where(and(eq(conversations.tenantId, user.tenantId), eq(conversations.status, 'active')));

        // Count total conversations
        const [totalConversations] = await db
          .select({ count: count() })
          .from(conversations)
          .where(eq(conversations.tenantId, user.tenantId));

        // Count end users
        const [totalEndUsers] = await db
          .select({ count: count() })
          .from(endUsers)
          .where(eq(endUsers.tenantId, user.tenantId));

        // Count team members
        const [totalTeamMembers] = await db
          .select({ count: count() })
          .from(adminUsers)
          .where(and(eq(adminUsers.tenantId, user.tenantId), eq(adminUsers.isActive, true)));

        return createSuccessResponse({
          conversations: {
            active: activeConversations.count,
            total: totalConversations.count,
          },
          endUsers: {
            total: totalEndUsers.count,
          },
          team: {
            active: totalTeamMembers.count,
          },
        });
      } catch (err: any) {
        console.error('Get stats error:', err);
        return error(500, createErrorResponse('FETCH_FAILED', 'Failed to fetch statistics'));
      }
    },
    {
      detail: {
        summary: 'Get Tenant Statistics',
        description: 'Get statistics about conversations, users, and team',
        tags: ['Admin Tenant'],
      },
    }
  );
