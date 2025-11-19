/**
 * Admin Conversations Management Routes
 *
 * Endpoints:
 * - GET /admin/conversations - List conversations with filters
 * - GET /admin/conversations/:id - Get conversation details
 * - PATCH /admin/conversations/:id - Update conversation
 * - POST /admin/conversations/:id/assign - Assign conversation to agent
 * - POST /admin/conversations/:id/close - Close conversation
 */

import { Elysia, t } from 'elysia';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, conversations, messages, endUsers, adminUsers } from '@inhost/shared';
import { createSuccessResponse, createErrorResponse } from '../../types/api';
import { requireAuth } from '../../middleware/auth';
import { httpLogger } from '../../middleware/logger';

/**
 * Conversations Management Routes
 */
export const adminConversationsRoutes = new Elysia({ prefix: '/admin/conversations' })
  .use(httpLogger)
  .use(requireAuth())

  // GET /admin/conversations - List conversations
  .get(
    '/',
    async ({ user, query, error }) => {
      const { status = 'active', channel, assignedTo, limit = 50, offset = 0 } = query;

      try {
        // Build where conditions
        const conditions = [eq(conversations.tenantId, user.tenantId)];

        if (status) {
          conditions.push(eq(conversations.status, status as any));
        }

        if (channel) {
          conditions.push(eq(conversations.channel, channel as any));
        }

        if (assignedTo) {
          conditions.push(eq(conversations.assignedToId, assignedTo));
        }

        // Fetch conversations with related data
        const conversationsList = await db.query.conversations.findMany({
          where: and(...conditions),
          with: {
            endUser: true,
            assignedTo: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: desc(conversations.updatedAt),
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        });

        // Get message counts for each conversation
        const conversationsWithCounts = await Promise.all(
          conversationsList.map(async (conv) => {
            const [messageCount] = await db
              .select({ count: sql<number>`count(*)` })
              .from(messages)
              .where(eq(messages.conversationId, conv.id));

            return {
              id: conv.id,
              status: conv.status,
              channel: conv.channel,
              createdAt: conv.createdAt,
              updatedAt: conv.updatedAt,
              closedAt: conv.closedAt,
              metadata: conv.metadata,
              endUser: {
                id: conv.endUser.id,
                name: conv.endUser.name,
                email: conv.endUser.email,
                phone: conv.endUser.phone,
                avatarUrl: conv.endUser.avatarUrl,
              },
              assignedTo: conv.assignedTo
                ? {
                    id: conv.assignedTo.id,
                    name: conv.assignedTo.name,
                    email: conv.assignedTo.email,
                  }
                : null,
              messageCount: messageCount.count,
            };
          })
        );

        return createSuccessResponse({
          conversations: conversationsWithCounts,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            total: conversationsWithCounts.length,
          },
        });
      } catch (err: any) {
        console.error('List conversations error:', err);
        return error(500, createErrorResponse('FETCH_FAILED', 'Failed to fetch conversations'));
      }
    },
    {
      query: t.Object({
        status: t.Optional(t.String()),
        channel: t.Optional(t.String()),
        assignedTo: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        summary: 'List Conversations',
        description: 'Get list of conversations with filters',
        tags: ['Admin Conversations'],
      },
    }
  )

  // GET /admin/conversations/:id - Get conversation details
  .get(
    '/:id',
    async ({ user, params, error }) => {
      const { id } = params;

      try {
        const conversation = await db.query.conversations.findFirst({
          where: and(eq(conversations.id, id), eq(conversations.tenantId, user.tenantId)),
          with: {
            endUser: true,
            assignedTo: {
              columns: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
            messages: {
              orderBy: desc(messages.createdAt),
              limit: 100, // Last 100 messages
              with: {
                sentByAdminUser: {
                  columns: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        });

        if (!conversation) {
          return error(404, createErrorResponse('CONVERSATION_NOT_FOUND', 'Conversation not found'));
        }

        return createSuccessResponse({
          id: conversation.id,
          status: conversation.status,
          channel: conversation.channel,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          closedAt: conversation.closedAt,
          metadata: conversation.metadata,
          endUser: {
            id: conversation.endUser.id,
            externalId: conversation.endUser.externalId,
            name: conversation.endUser.name,
            email: conversation.endUser.email,
            phone: conversation.endUser.phone,
            avatarUrl: conversation.endUser.avatarUrl,
            metadata: conversation.endUser.metadata,
          },
          assignedTo: conversation.assignedTo
            ? {
                id: conversation.assignedTo.id,
                name: conversation.assignedTo.name,
                email: conversation.assignedTo.email,
                role: conversation.assignedTo.role,
              }
            : null,
          messages: conversation.messages.map((msg) => ({
            id: msg.id,
            type: msg.type,
            channel: msg.channel,
            content: msg.content,
            metadata: msg.metadata,
            statusChain: msg.statusChain,
            context: msg.context,
            createdAt: msg.createdAt,
            sentByAdminUser: msg.sentByAdminUser
              ? {
                  id: msg.sentByAdminUser.id,
                  name: msg.sentByAdminUser.name,
                  email: msg.sentByAdminUser.email,
                }
              : null,
          })),
        });
      } catch (err: any) {
        console.error('Get conversation error:', err);
        return error(500, createErrorResponse('FETCH_FAILED', 'Failed to fetch conversation'));
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: 'Get Conversation',
        description: 'Get conversation details with messages',
        tags: ['Admin Conversations'],
      },
    }
  )

  // PATCH /admin/conversations/:id - Update conversation
  .patch(
    '/:id',
    async ({ user, params, body, error }) => {
      const { id } = params;
      const { status, assignedToId, metadata } = body;

      try {
        // Verify conversation belongs to tenant
        const existing = await db.query.conversations.findFirst({
          where: and(eq(conversations.id, id), eq(conversations.tenantId, user.tenantId)),
        });

        if (!existing) {
          return error(404, createErrorResponse('CONVERSATION_NOT_FOUND', 'Conversation not found'));
        }

        // If assigning to someone, verify they're in the same tenant
        if (assignedToId) {
          const agent = await db.query.adminUsers.findFirst({
            where: and(eq(adminUsers.id, assignedToId), eq(adminUsers.tenantId, user.tenantId)),
          });

          if (!agent) {
            return error(400, createErrorResponse('INVALID_AGENT', 'Agent not found or not in your tenant'));
          }
        }

        // Build update data
        const updateData: any = { updatedAt: new Date() };
        if (status) updateData.status = status;
        if (assignedToId !== undefined) updateData.assignedToId = assignedToId;
        if (metadata) updateData.metadata = metadata;
        if (status === 'closed') updateData.closedAt = new Date();

        const [updated] = await db
          .update(conversations)
          .set(updateData)
          .where(eq(conversations.id, id))
          .returning();

        return createSuccessResponse({
          id: updated.id,
          status: updated.status,
          assignedToId: updated.assignedToId,
          metadata: updated.metadata,
          updatedAt: updated.updatedAt,
          closedAt: updated.closedAt,
        });
      } catch (err: any) {
        console.error('Update conversation error:', err);
        return error(500, createErrorResponse('UPDATE_FAILED', 'Failed to update conversation'));
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        status: t.Optional(t.Union([t.Literal('active'), t.Literal('closed'), t.Literal('archived')])),
        assignedToId: t.Optional(t.Union([t.String(), t.Null()])),
        metadata: t.Optional(t.Any()),
      }),
      detail: {
        summary: 'Update Conversation',
        description: 'Update conversation status, assignment, or metadata',
        tags: ['Admin Conversations'],
      },
    }
  );
