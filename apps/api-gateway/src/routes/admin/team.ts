/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\routes\admin\team.ts"
 *   type: "controller"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Handles team API routes"
 *
 * DEPENDENCIES:
 *   internal: ["../../middleware/auth","../../middleware/logger","../../types/api"]
 *   external: ["@inhost/shared","elysia"]
 *   infrastructure: ["PostgreSQL"]
 *
 * CONTRACTS:
 *   exports: ["adminTeamInvitesRoutes","adminTeamRoutes"]
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
 * === DOC_END :: team.ts ===
 */

/**
 * Admin Team Management Routes
 *
 * Endpoints:
 * - GET /admin/team - List team members
 * - POST /admin/team - Invite new team member
 * - PATCH /admin/team/:id - Update team member
 * - DELETE /admin/team/:id - Remove team member
 */

import { Elysia, t } from 'elysia';
import { eq, and, ne } from 'drizzle-orm';
import { db, adminUsers, hashPassword, validatePasswordStrength } from '@inhost/shared';
import { createSuccessResponse, createErrorResponse } from '../../types/api';
import { requireAuth, requireRole } from '../../middleware/auth';
import { httpLogger } from '../../middleware/logger';

/**
 * Team Management Routes
 */
export const adminTeamRoutes = new Elysia({ prefix: '/admin/team' })
  .use(httpLogger)
  .use(requireAuth())

  // GET /admin/team - List team members
  .get(
    '/',
    async ({ user, query, error }) => {
      const { includeInactive = 'false' } = query;

      try {
        const conditions = [eq(adminUsers.tenantId, user.tenantId)];

        // Filter by active status if not including inactive
        if (includeInactive !== 'true') {
          conditions.push(eq(adminUsers.isActive, true));
        }

        const teamMembers = await db.query.adminUsers.findMany({
          where: and(...conditions),
          columns: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        });

        return createSuccessResponse({
          team: teamMembers,
        });
      } catch (err: any) {
        console.error('List team members error:', err);
        return error(500, createErrorResponse('FETCH_FAILED', 'Failed to fetch team members'));
      }
    },
    {
      query: t.Object({
        includeInactive: t.Optional(t.String()),
      }),
      detail: {
        summary: 'List Team Members',
        description: 'Get list of team members in the tenant',
        tags: ['Admin Team'],
      },
    }
  )

  // POST /admin/team - Invite new team member (owner/admin only)
  .use(requireRole(['owner', 'admin']))
  .post(
    '/',
    async ({ user, body, error }) => {
      const { name, email, password, role } = body;

      try {
        // Validate password strength
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.valid) {
          return error(422, createErrorResponse('VALIDATION_ERROR', passwordValidation.errors.join(', ')));
        }

        // Check if email already exists
        const existingUser = await db.query.adminUsers.findFirst({
          where: eq(adminUsers.email, email),
        });

        if (existingUser) {
          return error(409, createErrorResponse('EMAIL_EXISTS', 'A user with this email already exists'));
        }

        // Validate role - only owner can create owner, and cannot downgrade themselves
        if (role === 'owner' && user.role !== 'owner') {
          return error(403, createErrorResponse('FORBIDDEN', 'Only owners can create owner accounts'));
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create new team member
        const [newMember] = await db
          .insert(adminUsers)
          .values({
            tenantId: user.tenantId,
            email,
            passwordHash,
            name,
            role,
            isActive: true,
          })
          .returning({
            id: adminUsers.id,
            email: adminUsers.email,
            name: adminUsers.name,
            role: adminUsers.role,
            isActive: adminUsers.isActive,
            createdAt: adminUsers.createdAt,
          });

        return createSuccessResponse(newMember);
      } catch (err: any) {
        console.error('Create team member error:', err);
        return error(500, createErrorResponse('CREATE_FAILED', 'Failed to create team member'));
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2, maxLength: 255 }),
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 8 }),
        role: t.Union([t.Literal('owner'), t.Literal('admin'), t.Literal('agent'), t.Literal('viewer')]),
      }),
      detail: {
        summary: 'Add Team Member',
        description: 'Invite a new team member (owner/admin only)',
        tags: ['Admin Team'],
      },
    }
  )

  // PATCH /admin/team/:id - Update team member (owner/admin only)
  .patch(
    '/:id',
    async ({ user, params, body, error }) => {
      const { id } = params;
      const { role, isActive } = body;

      try {
        // Verify team member belongs to same tenant
        const existing = await db.query.adminUsers.findFirst({
          where: and(eq(adminUsers.id, id), eq(adminUsers.tenantId, user.tenantId)),
        });

        if (!existing) {
          return error(404, createErrorResponse('USER_NOT_FOUND', 'Team member not found'));
        }

        // Prevent users from modifying themselves
        if (id === user.userId) {
          return error(403, createErrorResponse('FORBIDDEN', 'Cannot modify your own account'));
        }

        // Validate role changes
        if (role) {
          // Only owners can change roles to/from owner
          if ((role === 'owner' || existing.role === 'owner') && user.role !== 'owner') {
            return error(403, createErrorResponse('FORBIDDEN', 'Only owners can modify owner roles'));
          }

          // Admins cannot promote to admin or above unless they're owner
          if (user.role === 'admin' && (role === 'owner' || role === 'admin')) {
            return error(403, createErrorResponse('FORBIDDEN', 'Admins cannot create other admins or owners'));
          }
        }

        // Build update data
        const updateData: any = { updatedAt: new Date() };
        if (role !== undefined) updateData.role = role;
        if (isActive !== undefined) updateData.isActive = isActive;

        const [updated] = await db
          .update(adminUsers)
          .set(updateData)
          .where(eq(adminUsers.id, id))
          .returning({
            id: adminUsers.id,
            email: adminUsers.email,
            name: adminUsers.name,
            role: adminUsers.role,
            isActive: adminUsers.isActive,
            updatedAt: adminUsers.updatedAt,
          });

        return createSuccessResponse(updated);
      } catch (err: any) {
        console.error('Update team member error:', err);
        return error(500, createErrorResponse('UPDATE_FAILED', 'Failed to update team member'));
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        role: t.Optional(t.Union([t.Literal('owner'), t.Literal('admin'), t.Literal('agent'), t.Literal('viewer')])),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: 'Update Team Member',
        description: 'Update team member role or active status (owner/admin only)',
        tags: ['Admin Team'],
      },
    }
  )

  // DELETE /admin/team/:id - Remove team member (owner only)
  .use(requireRole(['owner']))
  .delete(
    '/:id',
    async ({ user, params, error }) => {
      const { id } = params;

      try {
        // Verify team member belongs to same tenant
        const existing = await db.query.adminUsers.findFirst({
          where: and(eq(adminUsers.id, id), eq(adminUsers.tenantId, user.tenantId)),
        });

        if (!existing) {
          return error(404, createErrorResponse('USER_NOT_FOUND', 'Team member not found'));
        }

        // Prevent users from deleting themselves
        if (id === user.userId) {
          return error(403, createErrorResponse('FORBIDDEN', 'Cannot delete your own account'));
        }

        // Soft delete by deactivating instead of hard delete
        await db.update(adminUsers).set({ isActive: false, updatedAt: new Date() }).where(eq(adminUsers.id, id));

        return createSuccessResponse({
          message: 'Team member removed successfully',
          id,
        });
      } catch (err: any) {
        console.error('Delete team member error:', err);
        return error(500, createErrorResponse('DELETE_FAILED', 'Failed to remove team member'));
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: 'Remove Team Member',
        description: 'Remove a team member from the tenant (owner only)',
        tags: ['Admin Team'],
      },
    }
  );

// Team Invites Routes (separate Elysia instance for /invites subpath)
export const adminTeamInvitesRoutes = new Elysia({ prefix: '/admin/team/invites' })
  .use(httpLogger)
  .use(requireAuth())
  .use(requireRole(['owner', 'admin']))

  // POST /admin/team/invites - Create team invitation
  .post(
    '/',
    async ({ user, body, error }) => {
      const { name, email, password, role } = body;

      try {
        // Validate password strength
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.valid) {
          return error(422, createErrorResponse('VALIDATION_ERROR', passwordValidation.errors.join(', ')));
        }

        // Check if email already exists
        const existingUser = await db.query.adminUsers.findFirst({
          where: eq(adminUsers.email, email),
        });

        if (existingUser) {
          return error(409, createErrorResponse('EMAIL_EXISTS', 'A user with this email already exists'));
        }

        // Validate role - only owner can create owner
        if (role === 'owner' && user.role !== 'owner') {
          return error(403, createErrorResponse('FORBIDDEN', 'Only owners can create owner accounts'));
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create new team member (invitation = immediate creation in MVP)
        const [newMember] = await db
          .insert(adminUsers)
          .values({
            tenantId: user.tenantId,
            email,
            passwordHash,
            name,
            role,
            isActive: true,
          })
          .returning({
            id: adminUsers.id,
            email: adminUsers.email,
            name: adminUsers.name,
            role: adminUsers.role,
            isActive: adminUsers.isActive,
            createdAt: adminUsers.createdAt,
          });

        return createSuccessResponse({
          invite: newMember,
          message: 'Team member invited successfully',
        });
      } catch (err: any) {
        console.error('Create team invite error:', err);
        return error(500, createErrorResponse('CREATE_FAILED', 'Failed to create team invitation'));
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2, maxLength: 255 }),
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 8 }),
        role: t.Union([t.Literal('owner'), t.Literal('admin'), t.Literal('agent'), t.Literal('viewer')]),
      }),
      detail: {
        summary: 'Create Team Invitation',
        description: 'Invite a new team member (owner/admin only)',
        tags: ['Admin Team Invites'],
      },
    }
  );
