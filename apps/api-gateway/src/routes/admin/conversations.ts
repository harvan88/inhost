/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/routes/admin/conversations.ts"
 *   type: "controller"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "CRUD completo de conversaciones multi-tenant con aislamiento por tenantId. Endpoints: GET/POST conversations, PATCH/:id, assign agent, close, mark as read. Emite eventos WebSocket para sincronización real-time"
 *
 * DEPENDENCIES:
 *   internal: ["../../middleware/auth","../../middleware/logger","../../services","../../types/api"]
 *   external: ["@inhost/shared","elysia"]
 *   infrastructure: ["PostgreSQL", "WebSocket"]
 *
 * CONTRACTS:
 *   exports: ["adminConversationsRoutes"]
 *   inputs: ["JWT user", "ConversationFilters", "UpdateConversationDTO", "AssignAgentDTO"]
 *   outputs: ["Conversation[]", "Conversation", "{ success: boolean }"]
 *   errors: ["UNAUTHORIZED", "END_USER_NOT_FOUND", "CONVERSATION_NOT_FOUND", "FORBIDDEN"]
 *
 * INTEGRATION:
 *   data_flow: "[HTTP request] → [requireAuth] → [validate tenantId] → [PostgreSQL CRUD] → [notifications.broadcast WebSocket event] → [JSON response]"
 *   events_emitted: ["conversation:updated (WebSocket)", "conversation:assigned (WebSocket)", "conversation:closed (WebSocket)"]
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["routes/index.ts"]
 *   uses: ["../../middleware/auth","../../middleware/logger","../../services","../../types/api","@inhost/shared","elysia"]
 *   critical: true
 *
 * === DOC_END :: conversations.ts ===
 */

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
import { eq, and, desc, sql, notExists } from 'drizzle-orm';
import { db, conversations, messages, endUsers, adminUsers, messageReads } from '@inhost/shared';
import { createSuccessResponse, createErrorResponse } from '../../types/api';
import { requireAuth } from '../../middleware/auth';
import { httpLogger } from '../../middleware/logger';
import { notifications } from '../../services';

/**
 * Conversations Management Routes
 */
export const adminConversationsRoutes = new Elysia({ prefix: '/admin/conversations' })
  .use(httpLogger)
  .use(requireAuth())

  // POST /admin/conversations - Create new conversation
  .post(
    '/',
    async ({ user, body, error }) => {
      const { endUserId, channel, initialMessage } = body;

      try {
        // Verify end user exists and belongs to tenant
        const endUser = await db.query.endUsers.findFirst({
          where: and(
            eq(endUsers.id, endUserId),
            eq(endUsers.tenantId, user.tenantId)
          ),
        });

        if (!endUser) {
          return error(404, createErrorResponse(
            'END_USER_NOT_FOUND',
            'End user not found or does not belong to your tenant'
          ));
        }

        // Create conversation
        const [newConversation] = await db
          .insert(conversations)
          .values({
            tenantId: user.tenantId,
            endUserId,
            channel,
            status: 'active',
            assignedToId: user.userId, // Assign to creator by default
            metadata: {},
          })
          .returning();

        // If initial message provided, create it
        if (initialMessage?.text) {
          await db.insert(messages).values({
            conversationId: newConversation.id,
            type: 'outgoing',
            channel,
            content: { text: initialMessage.text },
            metadata: {
              from: 'admin',
              to: endUser.externalId,
              timestamp: new Date().toISOString(),
            },
            statusChain: [],
            context: {},
            sentByAdminUserId: user.userId,
          });
        }

        return createSuccessResponse({
          conversation: {
            id: newConversation.id,
            status: newConversation.status,
            channel: newConversation.channel,
            createdAt: newConversation.createdAt,
            endUser: {
              id: endUser.id,
              name: endUser.name,
              email: endUser.email,
              phone: endUser.phone,
            },
            assignedTo: {
              id: user.userId,
              name: user.name || user.email,
            },
          },
        });
      } catch (err: any) {
        console.error('Create conversation error:', err);
        return error(500, createErrorResponse('CREATE_FAILED', 'Failed to create conversation'));
      }
    },
    {
      body: t.Object({
        endUserId: t.String({ format: 'uuid' }),
        channel: t.Union([
          t.Literal('whatsapp'),
          t.Literal('telegram'),
          t.Literal('web'),
          t.Literal('sms'),
          t.Literal('instagram'),
        ]),
        initialMessage: t.Optional(t.Object({
          text: t.String(),
        })),
      }),
      detail: {
        summary: 'Create Conversation',
        description: 'Create a new conversation with an end user',
        tags: ['Admin Conversations'],
      },
    }
  )

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

        // Get lastMessage and message counts for each conversation
        const conversationsWithDetails = await Promise.all(
          conversationsList.map(async (conv) => {
            // Get last message
            const lastMsg = await db.query.messages.findFirst({
              where: eq(messages.conversationId, conv.id),
              orderBy: desc(messages.createdAt),
              columns: {
                id: true,
                type: true,
                content: true,
                createdAt: true,
              },
            });

            return {
              id: conv.id,
              endUserId: conv.endUserId, // ✅ Frontend mandato
              status: conv.status,
              channel: conv.channel,
              isPinned: conv.isPinned || false, // ✅ Nuevo campo
              unreadCount: conv.unreadCount || 0, // ✅ Nuevo campo
              lastMessage: lastMsg
                ? {
                    id: lastMsg.id,
                    text: (lastMsg.content as any)?.text || '',
                    type: lastMsg.type,
                    timestamp: lastMsg.createdAt?.toISOString() || '',
                  }
                : undefined, // ✅ Nuevo campo como objeto
              assignedTo: conv.assignedTo
                ? {
                    id: conv.assignedTo.id,
                    name: conv.assignedTo.name,
                  }
                : null,
              createdAt: conv.createdAt?.toISOString() || '',
              updatedAt: conv.updatedAt?.toISOString() || '',
            };
          })
        );

        return createSuccessResponse({
          conversations: conversationsWithDetails,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            total: conversationsWithDetails.length,
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
            conversationId: msg.conversationId, // ✅ FIX: Include conversationId
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

  // GET /admin/conversations/:id/messages - List messages in conversation
  .get(
    '/:id/messages',
    async ({ user, params, query, error }) => {
      const { id } = params;
      const { limit = 50, offset = 0 } = query;

      try {
        // Verify conversation belongs to tenant
        const conversation = await db.query.conversations.findFirst({
          where: and(eq(conversations.id, id), eq(conversations.tenantId, user.tenantId)),
        });

        if (!conversation) {
          return error(404, createErrorResponse('CONVERSATION_NOT_FOUND', 'Conversation not found'));
        }

        // Fetch messages
        const messagesList = await db.query.messages.findMany({
          where: eq(messages.conversationId, id),
          with: {
            sentByAdminUser: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: desc(messages.createdAt),
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        });

        return createSuccessResponse({
          conversationId: id,
          messages: messagesList.map((msg) => ({
            id: msg.id,
            conversationId: msg.conversationId, // ✅ FIX: Include conversationId
            type: msg.type,
            channel: msg.channel,
            content: msg.content,
            metadata: msg.metadata,
            statusChain: msg.statusChain,
            context: msg.context, // ✅ FIX: Include context
            createdAt: msg.createdAt,
            sentByAdminUser: msg.sentByAdminUser
              ? {
                  id: msg.sentByAdminUser.id,
                  name: msg.sentByAdminUser.name,
                  email: msg.sentByAdminUser.email,
                }
              : null,
          })),
          count: messagesList.length,
        });
      } catch (err: any) {
        console.error('List messages error:', err);
        return error(500, createErrorResponse('FETCH_FAILED', 'Failed to fetch messages'));
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        summary: 'List Messages',
        description: 'List messages in a conversation',
        tags: ['Admin Conversations'],
      },
    }
  )

  // POST /admin/conversations/:id/messages - Create message in conversation
  .post(
    '/:id/messages',
    async ({ user, params, body, error }) => {
      const { id } = params;
      const { type = 'outgoing', content } = body;

      // Extract text from content for mentions parsing
      const text = content.text || '';

      try {
        // Verify conversation belongs to tenant
        const conversation = await db.query.conversations.findFirst({
          where: and(eq(conversations.id, id), eq(conversations.tenantId, user.tenantId)),
          with: {
            endUser: true,
          },
        });

        if (!conversation) {
          return error(404, createErrorResponse('CONVERSATION_NOT_FOUND', 'Conversation not found'));
        }

        // Create message with full MessageEnvelope content format
        const [newMessage] = await db
          .insert(messages)
          .values({
            conversationId: id,
            type,
            channel: conversation.channel,
            content: content, // Store full content object
            metadata: {
              from: type === 'outgoing' ? 'admin' : conversation.endUser.externalId,
              to: type === 'outgoing' ? conversation.endUser.externalId : 'admin',
              timestamp: new Date().toISOString(),
            },
            statusChain: [],
            context: {},
            sentByAdminUserId: type === 'outgoing' ? user.userId : null,
          })
          .returning();

        // Update conversation's updatedAt and increment unreadCount if incoming
        const updateData: any = { updatedAt: new Date() };
        if (type === 'incoming') {
          // Increment unreadCount for incoming messages
          updateData.unreadCount = sql`${conversations.unreadCount} + 1`;
        }

        await db
          .update(conversations)
          .set(updateData)
          .where(eq(conversations.id, id));

        // Auto-detect mentions in text and create mention records
        try {
          const { createMentionsFromText } = await import('../../utils/mentions-parser');
          const createdMentions = await createMentionsFromText(
            text,
            'message',
            newMessage.id,
            user.tenantId,
            user.id
          );

          // TODO: Send WebSocket notification to mentioned users
          // Format: { type: 'mention:new', mentionId, userId, entityType, entityId }
          // Frontend can then fetch /admin/mentions/unread-count to update badge
          if (createdMentions.length > 0) {
            console.log(`✉️  Created ${createdMentions.length} mentions for message ${newMessage.id}`);
          }
        } catch (mentionError) {
          // Log mention error but don't fail the request
          console.error('Failed to create mentions:', mentionError);
        }

        // Broadcast conversation:updated event (lastMessage was updated by trigger)
        await notifications.broadcastConversationUpdated({
          conversationId: id,
          updates: {
            lastMessage: {
              id: newMessage.id,
              text,
              type: newMessage.type,
              timestamp: newMessage.createdAt?.toISOString() || new Date().toISOString(),
            },
            // If incoming, unreadCount was incremented
            ...(type === 'incoming' && {
              unreadCount: (conversation.unreadCount || 0) + 1,
            }),
          },
          timestamp: new Date().toISOString(),
        }).catch(err => {
          console.error('Failed to broadcast conversation:updated event:', err);
        });

        return createSuccessResponse({
          message: {
            id: newMessage.id,
            conversationId: newMessage.conversationId, // ✅ FIX: Include conversationId
            type: newMessage.type,
            channel: newMessage.channel,
            content: newMessage.content,
            metadata: newMessage.metadata,
            statusChain: newMessage.statusChain, // ✅ FIX: Include statusChain
            context: newMessage.context, // ✅ FIX: Include context
            createdAt: newMessage.createdAt,
          },
        });
      } catch (err: any) {
        console.error('Create message error:', err);
        return error(500, createErrorResponse('CREATE_FAILED', 'Failed to create message'));
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        type: t.Optional(t.Union([t.Literal('incoming'), t.Literal('outgoing')])),
        content: t.Object({
          text: t.String(),
          contentType: t.String(),
        }),
      }),
      detail: {
        summary: 'Create Message',
        description: 'Create a new message in a conversation',
        tags: ['Admin Conversations'],
      },
    }
  )

  // PATCH /admin/conversations/:id - Update conversation
  .patch(
    '/:id',
    async ({ user, params, body, error }) => {
      const { id } = params;
      const { status, assignedToId, metadata, isPinned } = body;

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
        if (isPinned !== undefined) updateData.isPinned = isPinned; // ✅ Nuevo campo
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
          isPinned: updated.isPinned, // ✅ Retornar isPinned
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
        isPinned: t.Optional(t.Boolean()), // ✅ Nuevo campo
        metadata: t.Optional(t.Any()),
      }),
      detail: {
        summary: 'Update Conversation',
        description: 'Update conversation status, assignment, isPinned, or metadata',
        tags: ['Admin Conversations'],
      },
    }
  )

  // DELETE /admin/conversations/:id - Archive conversation
  .delete(
    '/:id',
    async ({ user, params, error }) => {
      const { id } = params;

      try {
        // Verify conversation exists and belongs to tenant
        const conversation = await db.query.conversations.findFirst({
          where: and(
            eq(conversations.id, id),
            eq(conversations.tenantId, user.tenantId)
          ),
        });

        if (!conversation) {
          return error(404, createErrorResponse(
            'CONVERSATION_NOT_FOUND',
            'Conversation not found'
          ));
        }

        // Archive conversation (soft delete)
        const [archivedConversation] = await db
          .update(conversations)
          .set({
            status: 'archived',
            closedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(conversations.id, id))
          .returning();

        return createSuccessResponse({
          conversation: {
            id: archivedConversation.id,
            status: archivedConversation.status,
            closedAt: archivedConversation.closedAt,
          },
        });
      } catch (err: any) {
        console.error('Archive conversation error:', err);
        return error(500, createErrorResponse('ARCHIVE_FAILED', 'Failed to archive conversation'));
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: 'Archive Conversation',
        description: 'Archive a conversation (soft delete)',
        tags: ['Admin Conversations'],
      },
    }
  )

  // POST /admin/conversations/:id/mark-as-read - Mark conversation as read
  .post(
    '/:id/mark-as-read',
    async ({ user, params, error }) => {
      const { id } = params;

      try {
        // Verify conversation belongs to tenant
        const conversation = await db.query.conversations.findFirst({
          where: and(eq(conversations.id, id), eq(conversations.tenantId, user.tenantId)),
        });

        if (!conversation) {
          return error(404, createErrorResponse('CONVERSATION_NOT_FOUND', 'Conversation not found'));
        }

        // 1. Find all incoming messages in this conversation that haven't been read by this user
        const unreadMessages = await db
          .select({ id: messages.id })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, id),
              eq(messages.type, 'incoming'),
              notExists(
                db
                  .select()
                  .from(messageReads)
                  .where(
                    and(
                      eq(messageReads.messageId, messages.id),
                      eq(messageReads.userId, user.id)
                    )
                  )
              )
            )
          );

        // 2. Create message_reads records for unread messages (bulk insert)
        if (unreadMessages.length > 0) {
          await db.insert(messageReads).values(
            unreadMessages.map((msg) => ({
              messageId: msg.id,
              userId: user.id,
              readAt: new Date(),
            }))
          );
        }

        // 3. Calculate new unread count using database function (per-user)
        const result = await db.execute(
          sql`SELECT calculate_unread_count(${id}, ${user.id}) as unread_count`
        );
        const newUnreadCount = (result.rows[0] as any)?.unread_count || 0;

        // 4. Update conversation lastReadAt and unreadCount
        const now = new Date();
        const [updated] = await db
          .update(conversations)
          .set({
            lastReadAt: now,
            unreadCount: newUnreadCount,
            updatedAt: now,
          })
          .where(eq(conversations.id, id))
          .returning();

        // 5. Broadcast conversation:read event to all clients in this tenant
        await notifications.broadcastConversationRead({
          conversationId: updated.id,
          userId: user.id,
          unreadCount: updated.unreadCount || 0,
          lastReadAt: updated.lastReadAt?.toISOString() || now.toISOString(),
          timestamp: now.toISOString(),
        }).catch(err => {
          console.error('Failed to broadcast conversation:read event:', err);
        });

        return createSuccessResponse({
          conversation: {
            id: updated.id,
            unreadCount: updated.unreadCount,
            lastReadAt: updated.lastReadAt,
          },
          markedAsRead: unreadMessages.length,
          message: `Marked ${unreadMessages.length} messages as read`,
        });
      } catch (err: any) {
        console.error('Mark as read error:', err);
        return error(500, createErrorResponse('UPDATE_FAILED', 'Failed to mark conversation as read'));
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: 'Mark Conversation as Read',
        description: 'Mark all messages in a conversation as read',
        tags: ['Admin Conversations'],
      },
    }
  );
