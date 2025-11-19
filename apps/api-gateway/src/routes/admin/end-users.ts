/**
 * Admin End Users Management Routes
 *
 * Endpoints:
 * - GET /admin/end-users - List end users
 * - GET /admin/end-users/:id - Get end user details
 * - PATCH /admin/end-users/:id - Update end user
 * - POST /admin/end-users/:id/block - Block end user
 * - POST /admin/end-users/:id/unblock - Unblock end user
 */

import { Elysia, t } from 'elysia';
import { eq, and, desc, like, or, sql } from 'drizzle-orm';
import { db, endUsers, conversations } from '@inhost/shared';
import { createSuccessResponse, createErrorResponse } from '../../types/api';
import { requireAuth } from '../../middleware/auth';
import { httpLogger } from '../../middleware/logger';

/**
 * End Users Management Routes
 */
export const adminEndUsersRoutes = new Elysia({ prefix: '/admin/end-users' })
  .use(httpLogger)
  .use(requireAuth())

  // GET /admin/end-users - List end users
  .get(
    '/',
    async ({ user, query, error }) => {
      const { channel, search, isBlocked, limit = 50, offset = 0 } = query;

      try {
        // Build where conditions
        const conditions = [eq(endUsers.tenantId, user.tenantId)];

        if (channel) {
          conditions.push(eq(endUsers.channel, channel as any));
        }

        if (isBlocked !== undefined) {
          conditions.push(eq(endUsers.isBlocked, isBlocked === 'true'));
        }

        // Add search condition
        let searchCondition = undefined;
        if (search) {
          searchCondition = or(
            like(endUsers.name, `%${search}%`),
            like(endUsers.email, `%${search}%`),
            like(endUsers.phone, `%${search}%`)
          );
        }

        // Combine all conditions
        const whereCondition = searchCondition ? and(...conditions, searchCondition) : and(...conditions);

        // Fetch end users
        const usersList = await db.query.endUsers.findMany({
          where: whereCondition,
          orderBy: desc(endUsers.createdAt),
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        });

        // Get conversation counts for each end user
        const usersWithCounts = await Promise.all(
          usersList.map(async (endUser) => {
            const [convCount] = await db
              .select({ count: sql<number>`count(*)` })
              .from(conversations)
              .where(eq(conversations.endUserId, endUser.id));

            return {
              id: endUser.id,
              externalId: endUser.externalId,
              channel: endUser.channel,
              name: endUser.name,
              email: endUser.email,
              phone: endUser.phone,
              avatarUrl: endUser.avatarUrl,
              tags: endUser.tags,
              isBlocked: endUser.isBlocked,
              createdAt: endUser.createdAt,
              conversationCount: convCount.count,
            };
          })
        );

        return createSuccessResponse({
          endUsers: usersWithCounts,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            total: usersWithCounts.length,
          },
        });
      } catch (err: any) {
        console.error('List end users error:', err);
        return error(500, createErrorResponse('FETCH_FAILED', 'Failed to fetch end users'));
      }
    },
    {
      query: t.Object({
        channel: t.Optional(t.String()),
        search: t.Optional(t.String()),
        isBlocked: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        summary: 'List End Users',
        description: 'Get list of end users with filters and search',
        tags: ['Admin End Users'],
      },
    }
  )

  // POST /admin/end-users - Create new end user (contact)
  .post(
    '/',
    async ({ user, body, error }) => {
      const { externalId, channel, name, email, phone, avatarUrl, metadata } = body;

      try {
        // Check if end user already exists with this externalId and channel
        const existing = await db.query.endUsers.findFirst({
          where: and(
            eq(endUsers.tenantId, user.tenantId),
            eq(endUsers.externalId, externalId),
            eq(endUsers.channel, channel)
          ),
        });

        if (existing) {
          return error(409, createErrorResponse(
            'END_USER_EXISTS',
            'An end user with this external ID and channel already exists'
          ));
        }

        // Create end user
        const [newEndUser] = await db
          .insert(endUsers)
          .values({
            tenantId: user.tenantId,
            externalId,
            channel,
            name: name || null,
            email: email || null,
            phone: phone || null,
            avatarUrl: avatarUrl || null,
            metadata: metadata || {},
            tags: [],
            isBlocked: false,
          })
          .returning();

        return createSuccessResponse({
          endUser: {
            id: newEndUser.id,
            externalId: newEndUser.externalId,
            channel: newEndUser.channel,
            name: newEndUser.name,
            email: newEndUser.email,
            phone: newEndUser.phone,
            avatarUrl: newEndUser.avatarUrl,
            metadata: newEndUser.metadata,
            createdAt: newEndUser.createdAt,
          },
        });
      } catch (err: any) {
        console.error('Create end user error:', err);
        return error(500, createErrorResponse('CREATE_FAILED', 'Failed to create end user'));
      }
    },
    {
      body: t.Object({
        externalId: t.String({ minLength: 1, maxLength: 255 }),
        channel: t.Union([
          t.Literal('whatsapp'),
          t.Literal('telegram'),
          t.Literal('web'),
          t.Literal('sms'),
          t.Literal('instagram'),
        ]),
        name: t.Optional(t.String({ maxLength: 255 })),
        email: t.Optional(t.String({ format: 'email' })),
        phone: t.Optional(t.String({ maxLength: 50 })),
        avatarUrl: t.Optional(t.String({ maxLength: 500 })),
        metadata: t.Optional(t.Any()),
      }),
      detail: {
        summary: 'Create End User',
        description: 'Create a new end user (customer contact)',
        tags: ['Admin End Users'],
      },
    }
  )

  // GET /admin/end-users/:id - Get end user details
  .get(
    '/:id',
    async ({ user, params, error }) => {
      const { id } = params;

      try {
        const endUser = await db.query.endUsers.findFirst({
          where: and(eq(endUsers.id, id), eq(endUsers.tenantId, user.tenantId)),
          with: {
            conversations: {
              orderBy: desc(conversations.updatedAt),
              limit: 10, // Last 10 conversations
              with: {
                assignedTo: {
                  columns: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

        if (!endUser) {
          return error(404, createErrorResponse('END_USER_NOT_FOUND', 'End user not found'));
        }

        return createSuccessResponse({
          id: endUser.id,
          externalId: endUser.externalId,
          channel: endUser.channel,
          name: endUser.name,
          email: endUser.email,
          phone: endUser.phone,
          avatarUrl: endUser.avatarUrl,
          metadata: endUser.metadata,
          tags: endUser.tags,
          isBlocked: endUser.isBlocked,
          createdAt: endUser.createdAt,
          updatedAt: endUser.updatedAt,
          conversations: endUser.conversations.map((conv) => ({
            id: conv.id,
            status: conv.status,
            channel: conv.channel,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            assignedTo: conv.assignedTo
              ? {
                  id: conv.assignedTo.id,
                  name: conv.assignedTo.name,
                }
              : null,
          })),
        });
      } catch (err: any) {
        console.error('Get end user error:', err);
        return error(500, createErrorResponse('FETCH_FAILED', 'Failed to fetch end user'));
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: 'Get End User',
        description: 'Get end user details with recent conversations',
        tags: ['Admin End Users'],
      },
    }
  )

  // PATCH /admin/end-users/:id - Update end user
  .patch(
    '/:id',
    async ({ user, params, body, error }) => {
      const { id } = params;
      const { name, email, phone, tags, metadata, isBlocked } = body;

      try {
        // Verify end user belongs to tenant
        const existing = await db.query.endUsers.findFirst({
          where: and(eq(endUsers.id, id), eq(endUsers.tenantId, user.tenantId)),
        });

        if (!existing) {
          return error(404, createErrorResponse('END_USER_NOT_FOUND', 'End user not found'));
        }

        // Build update data
        const updateData: any = { updatedAt: new Date() };
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (tags !== undefined) updateData.tags = tags;
        if (metadata !== undefined) updateData.metadata = metadata;
        if (isBlocked !== undefined) updateData.isBlocked = isBlocked;

        const [updated] = await db.update(endUsers).set(updateData).where(eq(endUsers.id, id)).returning();

        return createSuccessResponse({
          id: updated.id,
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
          tags: updated.tags,
          metadata: updated.metadata,
          isBlocked: updated.isBlocked,
          updatedAt: updated.updatedAt,
        });
      } catch (err: any) {
        console.error('Update end user error:', err);
        return error(500, createErrorResponse('UPDATE_FAILED', 'Failed to update end user'));
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.Union([t.String(), t.Null()])),
        email: t.Optional(t.Union([t.String({ format: 'email' }), t.Null()])),
        phone: t.Optional(t.Union([t.String(), t.Null()])),
        tags: t.Optional(t.Array(t.String())),
        metadata: t.Optional(t.Any()),
        isBlocked: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: 'Update End User',
        description: 'Update end user information, tags, or block status',
        tags: ['Admin End Users'],
      },
    }
  );
