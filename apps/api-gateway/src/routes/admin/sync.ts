/**
 * Admin Sync Routes
 *
 * Endpoints:
 * - GET /admin/sync/initial - Initial hydration after login
 */

import { Elysia } from 'elysia';
import { eq, desc, and } from 'drizzle-orm';
import { db, conversations, messages, endUsers, adminUsers, tenants } from '@inhost/shared';
import { createSuccessResponse, createErrorResponse } from '../../types/api';
import { requireAuth } from '../../middleware/auth';
import { httpLogger } from '../../middleware/logger';

/**
 * Sync Routes - Critical for frontend hydration
 */
export const adminSyncRoutes = new Elysia({ prefix: '/admin/sync' })
  .use(httpLogger)
  .use(requireAuth())

  // GET /admin/sync/initial - Initial data hydration after login
  .get('/initial', async ({ user, error }) => {
    try {
      // 1. Fetch conversations (last 50)
      const conversationsList = await db.query.conversations.findMany({
        where: eq(conversations.tenantId, user.tenantId),
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
        limit: 50,
      });

      // Get lastMessage for each conversation
      const conversationsWithDetails = await Promise.all(
        conversationsList.map(async (conv) => {
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
            endUserId: conv.endUserId,
            status: conv.status,
            channel: conv.channel,
            isPinned: conv.isPinned || false,
            unreadCount: conv.unreadCount || 0,
            lastMessage: lastMsg
              ? {
                  id: lastMsg.id,
                  text: (lastMsg.content as any)?.text || '',
                  type: lastMsg.type,
                  timestamp: lastMsg.createdAt?.toISOString() || '',
                }
              : undefined,
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

      // 2. Fetch contacts (all end users)
      const contactsList = await db.query.endUsers.findMany({
        where: eq(endUsers.tenantId, user.tenantId),
        orderBy: desc(endUsers.createdAt),
      });

      const contacts = contactsList.map((contact) => ({
        id: contact.id,
        externalId: contact.externalId,
        channel: contact.channel,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        avatarUrl: contact.avatarUrl,
        metadata: contact.metadata,
        tags: contact.tags,
        isBlocked: contact.isBlocked,
        createdAt: contact.createdAt?.toISOString() || '',
      }));

      // 3. Fetch team members
      const teamMembersList = await db.query.adminUsers.findMany({
        where: and(
          eq(adminUsers.tenantId, user.tenantId),
          eq(adminUsers.isActive, true)
        ),
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

      const team = teamMembersList.map((member) => ({
        id: member.id,
        email: member.email,
        name: member.name,
        role: member.role,
        isActive: member.isActive,
        lastLoginAt: member.lastLoginAt?.toISOString() || null,
        createdAt: member.createdAt?.toISOString() || '',
      }));

      // 4. Fetch integrations (MVP: return empty array for now)
      // TODO: When integrations table is created, fetch from DB
      const integrations: any[] = [];

      return createSuccessResponse({
        conversations: conversationsWithDetails,
        contacts,
        team,
        integrations,
      });
    } catch (err: any) {
      console.error('Initial sync error:', err);
      return error(500, createErrorResponse('SYNC_FAILED', 'Failed to fetch initial data'));
    }
  });
