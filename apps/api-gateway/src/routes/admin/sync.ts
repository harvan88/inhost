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

  // GET /admin/sync/test - TEMPORARY: Test endpoint without middleware
  .get('/test', async ({ request, error }) => {
    // Manual token extraction for testing
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return error(401, createErrorResponse('UNAUTHORIZED', 'Missing token'));
    }

    try {
      // Manually verify token
      const { verifyToken } = await import('@inhost/shared');
      const user = await verifyToken(token);

      // Fetch conversations (last 50)
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

      return createSuccessResponse({
        message: 'TEST ENDPOINT - Middleware bypass successful',
        user: {
          userId: user.userId,
          tenantId: user.tenantId,
          email: user.email,
          role: user.role
        },
        conversationsCount: conversationsList.length,
        conversations: conversationsList.map(conv => ({
          id: conv.id,
          channel: conv.channel,
          status: conv.status,
          endUser: conv.endUser?.name || 'Unknown'
        }))
      });
    } catch (err: any) {
      console.error('Test endpoint error:', err);
      return createErrorResponse('TEST_FAILED', err.message);
    }
  })

  // GET /admin/sync/initial - Initial data hydration after login
  .get('/initial', async ({ request, error }) => {
    // TEMPORARY FIX: Manual token extraction until middleware is fixed
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return error(401, createErrorResponse('UNAUTHORIZED', 'Missing authorization token'));
    }

    let user;
    try {
      const { verifyToken } = await import('@inhost/shared');
      user = await verifyToken(token);
    } catch (err) {
      return error(401, createErrorResponse('INVALID_TOKEN', 'Invalid or expired token'));
    }

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

      // Map conversations using denormalized lastMessage fields (performance optimized)
      const conversationsWithDetails = conversationsList.map((conv) => {
        return {
          id: conv.id,
          endUserId: conv.endUserId,
          status: conv.status,
          channel: conv.channel,
          isPinned: conv.isPinned || false,
          unreadCount: conv.unreadCount || 0,
          // Use denormalized lastMessage fields (updated by trigger)
          lastMessage: conv.lastMessageId
            ? {
                id: conv.lastMessageId,
                text: conv.lastMessageText || '',
                type: conv.lastMessageType || '',
                timestamp: conv.lastMessageAt?.toISOString() || '',
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
      });

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
      return createErrorResponse('SYNC_FAILED', 'Failed to fetch initial data');
    }
  }, {
    detail: {
      summary: 'Initial Sync',
      description: 'Get initial data after login (conversations, contacts, team, integrations)',
      tags: ['Admin Sync'],
    }
  });
