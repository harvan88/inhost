/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\routes\admin\account.ts"
 *   type: "controller"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Handles account API routes"
 *
 * DEPENDENCIES:
 *   internal: ["../../middleware/auth","../../middleware/logger","../../types/api"]
 *   external: ["@inhost/shared","elysia"]
 *   infrastructure: ["PostgreSQL"]
 *
 * CONTRACTS:
 *   exports: ["adminAccountRoutes"]
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
 * === DOC_END :: account.ts ===
 */

/**
 * Admin Account Settings Routes
 *
 * Endpoints:
 * - GET /admin/account - Get account settings
 * - PATCH /admin/account - Update account settings
 */

import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { db, adminUsers, tenants, hashPassword, validatePasswordStrength } from '@inhost/shared';
import { createSuccessResponse, createErrorResponse } from '../../types/api';
import { requireAuth } from '../../middleware/auth';
import { httpLogger } from '../../middleware/logger';

/**
 * Account Settings Routes
 */
export const adminAccountRoutes = new Elysia({ prefix: '/admin/account' })
  .use(httpLogger)
  .use(requireAuth())

  // GET /admin/account - Get account settings
  .get(
    '/',
    async ({ user, error }) => {
      try {
        // Get user details
        const adminUser = await db.query.adminUsers.findFirst({
          where: eq(adminUsers.id, user.userId),
          with: {
            tenant: true,
          },
        });

        if (!adminUser) {
          return error(404, createErrorResponse('USER_NOT_FOUND', 'User not found'));
        }

        return createSuccessResponse({
          user: {
            id: adminUser.id,
            email: adminUser.email,
            name: adminUser.name,
            role: adminUser.role,
            isActive: adminUser.isActive,
            lastLoginAt: adminUser.lastLoginAt,
            createdAt: adminUser.createdAt,
          },
          tenant: {
            id: adminUser.tenant.id,
            name: adminUser.tenant.name,
            slug: adminUser.tenant.slug,
            plan: adminUser.tenant.plan,
            subscriptionStatus: adminUser.tenant.subscriptionStatus,
            settings: adminUser.tenant.settings,
            trialEndsAt: adminUser.tenant.trialEndsAt,
          },
          preferences: {
            // Future: user-specific preferences can be stored in a separate table or in admin_users.settings
            notifications: true,
            language: 'en',
            timezone: 'UTC',
          },
        });
      } catch (err: any) {
        console.error('Get account settings error:', err);
        return error(500, createErrorResponse('FETCH_FAILED', 'Failed to fetch account settings'));
      }
    },
    {
      detail: {
        summary: 'Get Account Settings',
        description: 'Get current user account settings and preferences',
        tags: ['Admin Account'],
      },
    }
  )

  // PATCH /admin/account - Update account settings
  .patch(
    '/',
    async ({ user, body, error }) => {
      const { name, email, currentPassword, newPassword, preferences } = body;

      try {
        // Get current user
        const adminUser = await db.query.adminUsers.findFirst({
          where: eq(adminUsers.id, user.userId),
        });

        if (!adminUser) {
          return error(404, createErrorResponse('USER_NOT_FOUND', 'User not found'));
        }

        // Build update data
        const updateData: any = { updatedAt: new Date() };

        // Update name if provided
        if (name !== undefined) {
          updateData.name = name;
        }

        // Update email if provided (check for uniqueness)
        if (email !== undefined && email !== adminUser.email) {
          const existingUser = await db.query.adminUsers.findFirst({
            where: eq(adminUsers.email, email),
          });

          if (existingUser) {
            return error(409, createErrorResponse('EMAIL_EXISTS', 'Email already in use'));
          }

          updateData.email = email;
        }

        // Update password if provided
        if (currentPassword && newPassword) {
          // Verify current password
          const bcrypt = await import('bcryptjs');
          const isValidPassword = await bcrypt.compare(currentPassword, adminUser.passwordHash);

          if (!isValidPassword) {
            return error(401, createErrorResponse('INVALID_PASSWORD', 'Current password is incorrect'));
          }

          // Validate new password strength
          const passwordValidation = validatePasswordStrength(newPassword);
          if (!passwordValidation.valid) {
            return error(422, createErrorResponse('VALIDATION_ERROR', passwordValidation.errors.join(', ')));
          }

          // Hash new password
          updateData.passwordHash = await hashPassword(newPassword);
        }

        // Update user
        const [updated] = await db
          .update(adminUsers)
          .set(updateData)
          .where(eq(adminUsers.id, user.userId))
          .returning({
            id: adminUsers.id,
            email: adminUsers.email,
            name: adminUsers.name,
            role: adminUsers.role,
            updatedAt: adminUsers.updatedAt,
          });

        return createSuccessResponse({
          user: updated,
          message: 'Account settings updated successfully',
          // Note: preferences update can be added when we have a preferences table
          preferences: preferences || {
            notifications: true,
            language: 'en',
            timezone: 'UTC',
          },
        });
      } catch (err: any) {
        console.error('Update account settings error:', err);
        return error(500, createErrorResponse('UPDATE_FAILED', 'Failed to update account settings'));
      }
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 2, maxLength: 255 })),
        email: t.Optional(t.String({ format: 'email' })),
        currentPassword: t.Optional(t.String()),
        newPassword: t.Optional(t.String({ minLength: 8 })),
        preferences: t.Optional(
          t.Object({
            notifications: t.Optional(t.Boolean()),
            language: t.Optional(t.String()),
            timezone: t.Optional(t.String()),
          })
        ),
      }),
      detail: {
        summary: 'Update Account Settings',
        description: 'Update current user account settings, password, and preferences',
        tags: ['Admin Account'],
      },
    }
  );
