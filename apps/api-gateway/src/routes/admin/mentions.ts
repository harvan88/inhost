/**
 * Admin Mentions Routes
 *
 * Endpoints:
 * - GET /admin/mentions - List mentions for current user (inbox)
 * - GET /admin/mentions/:id - Get mention details
 * - POST /admin/mentions/:id/mark-as-read - Mark mention as read
 * - POST /admin/mentions/mark-all-read - Mark all mentions as read
 * - GET /admin/mentions/unread-count - Get unread mentions count
 */

import { Elysia, t } from 'elysia';
import { eq, desc, and, sql } from 'drizzle-orm';
import {
  db,
  mentions,
  adminUsers,
  messages,
  conversations,
  type Mention,
} from '@inhost/shared';
import { createSuccessResponse, createErrorResponse } from '../../types/api';
import { requireAuth } from '../../middleware/auth';
import { httpLogger } from '../../middleware/logger';

export const adminMentionsRoutes = new Elysia({ prefix: '/admin/mentions' })
  .use(httpLogger)
  .use(requireAuth())

  // GET /admin/mentions - List mentions for current user
  .get(
    '/',
    async ({ user, query, error }) => {
      try {
        const { status = 'unread', limit = 50, offset = 0 } = query;

        // Build where conditions
        const conditions = [
          eq(mentions.tenantId, user.tenantId),
          eq(mentions.mentionedUserId, user.id),
        ];

        // Filter by read status
        if (status === 'unread') {
          conditions.push(eq(mentions.isRead, false));
        } else if (status === 'read') {
          conditions.push(eq(mentions.isRead, true));
        }
        // 'all' = no filter

        // Fetch mentions with relations
        const mentionsList = await db.query.mentions.findMany({
          where: and(...conditions),
          with: {
            mentionedByUser: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: desc(mentions.createdAt),
          limit: Number(limit),
          offset: Number(offset),
        });

        // Fetch entity details for each mention
        const mentionsWithDetails = await Promise.all(
          mentionsList.map(async (mention) => {
            let entityDetails: any = null;

            // Fetch entity based on type
            if (mention.entityType === 'message') {
              const message = await db.query.messages.findFirst({
                where: eq(messages.id, mention.entityId),
                with: {
                  conversation: {
                    with: {
                      endUser: {
                        columns: {
                          id: true,
                          name: true,
                          externalId: true,
                        },
                      },
                    },
                  },
                },
                columns: {
                  id: true,
                  type: true,
                  content: true,
                  createdAt: true,
                },
              });

              if (message) {
                entityDetails = {
                  id: message.id,
                  type: message.type,
                  text: (message.content as any)?.text || '',
                  conversationId: message.conversation?.id,
                  endUser: message.conversation?.endUser,
                  createdAt: message.createdAt?.toISOString(),
                };
              }
            } else if (mention.entityType === 'conversation') {
              const conversation = await db.query.conversations.findFirst({
                where: eq(conversations.id, mention.entityId),
                with: {
                  endUser: {
                    columns: {
                      id: true,
                      name: true,
                      externalId: true,
                    },
                  },
                },
                columns: {
                  id: true,
                  status: true,
                  channel: true,
                  createdAt: true,
                },
              });

              if (conversation) {
                entityDetails = {
                  id: conversation.id,
                  status: conversation.status,
                  channel: conversation.channel,
                  endUser: conversation.endUser,
                  createdAt: conversation.createdAt?.toISOString(),
                };
              }
            }
            // TODO: Add support for feedback, note, assignment entity types

            return {
              id: mention.id,
              entityType: mention.entityType,
              entityId: mention.entityId,
              entityDetails,
              mentionType: mention.mentionType,
              context: mention.context,
              isRead: mention.isRead,
              mentionedBy: {
                id: mention.mentionedByUser.id,
                name: mention.mentionedByUser.name,
                email: mention.mentionedByUser.email,
              },
              createdAt: mention.createdAt?.toISOString() || '',
            };
          })
        );

        return createSuccessResponse({
          mentions: mentionsWithDetails,
          pagination: {
            limit: Number(limit),
            offset: Number(offset),
            total: mentionsWithDetails.length,
          },
        });
      } catch (err: any) {
        console.error('List mentions error:', err);
        return error(500, createErrorResponse('FETCH_FAILED', 'Failed to fetch mentions'));
      }
    },
    {
      query: t.Object({
        status: t.Optional(t.Union([t.Literal('all'), t.Literal('read'), t.Literal('unread')])),
        limit: t.Optional(t.Numeric()),
        offset: t.Optional(t.Numeric()),
      }),
    }
  )

  // GET /admin/mentions/unread-count - Get unread mentions count
  .get('/unread-count', async ({ user, error }) => {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(mentions)
        .where(
          and(
            eq(mentions.tenantId, user.tenantId),
            eq(mentions.mentionedUserId, user.id),
            eq(mentions.isRead, false)
          )
        );

      const count = result[0]?.count || 0;

      return createSuccessResponse({ unreadCount: Number(count) });
    } catch (err: any) {
      console.error('Unread count error:', err);
      return error(500, createErrorResponse('COUNT_FAILED', 'Failed to count unread mentions'));
    }
  })

  // GET /admin/mentions/:id - Get mention details
  .get('/:id', async ({ user, params, error }) => {
    const { id } = params;

    try {
      const mention = await db.query.mentions.findFirst({
        where: and(
          eq(mentions.id, id),
          eq(mentions.tenantId, user.tenantId),
          eq(mentions.mentionedUserId, user.id)
        ),
        with: {
          mentionedByUser: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!mention) {
        return error(404, createErrorResponse('MENTION_NOT_FOUND', 'Mention not found'));
      }

      // Fetch entity details
      let entityDetails: any = null;

      if (mention.entityType === 'message') {
        const message = await db.query.messages.findFirst({
          where: eq(messages.id, mention.entityId),
          with: {
            conversation: {
              with: {
                endUser: true,
              },
            },
          },
        });

        entityDetails = message;
      } else if (mention.entityType === 'conversation') {
        const conversation = await db.query.conversations.findFirst({
          where: eq(conversations.id, mention.entityId),
          with: {
            endUser: true,
          },
        });

        entityDetails = conversation;
      }

      return createSuccessResponse({
        id: mention.id,
        entityType: mention.entityType,
        entityId: mention.entityId,
        entityDetails,
        mentionType: mention.mentionType,
        context: mention.context,
        isRead: mention.isRead,
        mentionedBy: {
          id: mention.mentionedByUser.id,
          name: mention.mentionedByUser.name,
          email: mention.mentionedByUser.email,
        },
        createdAt: mention.createdAt?.toISOString() || '',
      });
    } catch (err: any) {
      console.error('Get mention error:', err);
      return error(500, createErrorResponse('FETCH_FAILED', 'Failed to fetch mention'));
    }
  })

  // POST /admin/mentions/:id/mark-as-read - Mark mention as read
  .post('/:id/mark-as-read', async ({ user, params, error }) => {
    const { id } = params;

    try {
      // Verify mention belongs to user
      const mention = await db.query.mentions.findFirst({
        where: and(
          eq(mentions.id, id),
          eq(mentions.tenantId, user.tenantId),
          eq(mentions.mentionedUserId, user.id)
        ),
      });

      if (!mention) {
        return error(404, createErrorResponse('MENTION_NOT_FOUND', 'Mention not found'));
      }

      // Mark as read
      const [updated] = await db
        .update(mentions)
        .set({ isRead: true })
        .where(eq(mentions.id, id))
        .returning();

      return createSuccessResponse({
        id: updated.id,
        isRead: updated.isRead,
        message: 'Mention marked as read',
      });
    } catch (err: any) {
      console.error('Mark as read error:', err);
      return error(500, createErrorResponse('UPDATE_FAILED', 'Failed to mark mention as read'));
    }
  })

  // POST /admin/mentions/mark-all-read - Mark all mentions as read
  .post('/mark-all-read', async ({ user, error }) => {
    try {
      const result = await db
        .update(mentions)
        .set({ isRead: true })
        .where(
          and(
            eq(mentions.tenantId, user.tenantId),
            eq(mentions.mentionedUserId, user.id),
            eq(mentions.isRead, false)
          )
        )
        .returning({ id: mentions.id });

      return createSuccessResponse({
        markedCount: result.length,
        message: `${result.length} mentions marked as read`,
      });
    } catch (err: any) {
      console.error('Mark all read error:', err);
      return error(500, createErrorResponse('UPDATE_FAILED', 'Failed to mark all mentions as read'));
    }
  });
