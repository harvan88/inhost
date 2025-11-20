<<<<<<< HEAD
import { Elysia, t } from 'elysia';
import { pool } from '@inhost/shared/database/config';
import { createSuccessResponse, createErrorResponse } from '../../types/api';
import { logger } from '../../middleware/logger';

/**
 * Admin Sync Routes
 *
 * Endpoints para sincronizar datos entre backend y frontend
 */

export const syncRoutes = new Elysia({ prefix: '/sync' })
  /**
   * GET /admin/sync/initial
   *
   * Sincronización inicial - devuelve todos los datos necesarios para cargar el dashboard
   *
   * Headers:
   * - Authorization: Bearer <token>
   *
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "tenant": { ... },
   *     "conversations": [ ... ],
   *     "endUsers": [ ... ],
   *     "capabilities": [ ... ],
   *     "recentMessages": [ ... ],
   *     "stats": { ... }
   *   }
   * }
   */
  .get(
    '/initial',
    async ({ store, set }) => {
      try {
        // Get auth context from JWT middleware (stored in store.auth)
        const auth = (store as any).auth;

        if (!auth || !auth.tenantId) {
          logger.error('❌ /admin/sync/initial - No auth context', { store });
          set.status = 401;
          return createErrorResponse('Authentication required');
        }

        const { tenantId, tenantUserId } = auth;

        logger.info('🔄 /admin/sync/initial', {
          tenantId,
          tenantUserId
        });

        // 1. Get tenant info
        const tenantResult = await pool.query(
          `
          SELECT
            id,
            name,
            slug,
            email,
            plan,
            subscription_status,
            settings,
            created_at
          FROM tenants
          WHERE id = $1 AND deleted_at IS NULL
        `,
          [tenantId]
        );

        if (tenantResult.rows.length === 0) {
          set.status = 404;
          return createErrorResponse('Tenant not found');
        }

        const tenant = tenantResult.rows[0];

        // 2. Get conversations with end_user info
        const conversationsResult = await pool.query(
          `
          SELECT
            c.id,
            c.owner_id,
            c.participant,
            c.channel,
            c.created_at,
            c.updated_at,
            c.end_user_id,
            eu.name as end_user_name,
            eu.phone as end_user_phone,
            eu.email as end_user_email,
            (
              SELECT COUNT(*)
              FROM messages m
              WHERE m.conversation_id = c.id
            ) as message_count,
            (
              SELECT m.content
              FROM messages m
              WHERE m.conversation_id = c.id
              ORDER BY m.created_at DESC
              LIMIT 1
            ) as last_message_content,
            (
              SELECT m.created_at
              FROM messages m
              WHERE m.conversation_id = c.id
              ORDER BY m.created_at DESC
              LIMIT 1
            ) as last_message_at
          FROM conversations c
          LEFT JOIN end_users eu ON eu.id = c.end_user_id
          WHERE c.tenant_id = $1
          ORDER BY c.updated_at DESC
          LIMIT 100
        `,
          [tenantId]
        );

        // 3. Get end users
        const endUsersResult = await pool.query(
          `
          SELECT
            id,
            phone,
            email,
            name,
            primary_channel,
            custom_fields,
            tags,
            is_active,
            last_interaction_at,
            created_at
          FROM end_users
          WHERE tenant_id = $1 AND deleted_at IS NULL
          ORDER BY last_interaction_at DESC NULLS LAST
          LIMIT 100
        `,
          [tenantId]
        );

        // 4. Get tenant capabilities
        const capabilitiesResult = await pool.query(
          `
          SELECT
            id,
            service_id,
            enabled,
            config,
            limits,
            expires_at,
            created_at,
            updated_at
          FROM tenant_capabilities
          WHERE tenant_id = $1
          ORDER BY service_id
        `,
          [tenantId]
        );

        // 5. Get recent messages (last 50)
        const messagesResult = await pool.query(
          `
          SELECT
            m.id,
            m.conversation_id,
            m.type,
            m.channel,
            m.content,
            m.metadata,
            m.status_chain,
            m.context,
            m.created_at,
            c.participant
          FROM messages m
          JOIN conversations c ON c.id = m.conversation_id
          WHERE c.tenant_id = $1
          ORDER BY m.created_at DESC
          LIMIT 50
        `,
          [tenantId]
        );

        // 6. Calculate stats
        const statsResult = await pool.query(
          `
          SELECT
            (SELECT COUNT(*) FROM conversations WHERE tenant_id = $1) as total_conversations,
            (SELECT COUNT(*) FROM end_users WHERE tenant_id = $1 AND deleted_at IS NULL) as total_end_users,
            (SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.tenant_id = $1) as total_messages,
            (SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.tenant_id = $1 AND m.created_at > NOW() - INTERVAL '24 hours') as messages_last_24h,
            (SELECT COUNT(DISTINCT c.id) FROM conversations c JOIN messages m ON m.conversation_id = c.id WHERE c.tenant_id = $1 AND m.created_at > NOW() - INTERVAL '24 hours') as active_conversations_24h
        `,
          [tenantId]
        );

        const stats = statsResult.rows[0];

        // Build response
        const responseData = {
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            email: tenant.email,
            plan: tenant.plan,
            subscriptionStatus: tenant.subscription_status,
            settings: tenant.settings,
            createdAt: tenant.created_at
          },
          conversations: conversationsResult.rows.map((c) => ({
            id: c.id,
            ownerId: c.owner_id,
            participant: c.participant,
            channel: c.channel,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
            endUserId: c.end_user_id,
            endUserName: c.end_user_name,
            endUserPhone: c.end_user_phone,
            endUserEmail: c.end_user_email,
            messageCount: parseInt(c.message_count, 10),
            lastMessageContent: c.last_message_content,
            lastMessageAt: c.last_message_at
          })),
          endUsers: endUsersResult.rows.map((u) => ({
            id: u.id,
            phone: u.phone,
            email: u.email,
            name: u.name,
            primaryChannel: u.primary_channel,
            customFields: u.custom_fields,
            tags: u.tags,
            isActive: u.is_active,
            lastInteractionAt: u.last_interaction_at,
            createdAt: u.created_at
          })),
          capabilities: capabilitiesResult.rows.map((cap) => ({
            id: cap.id,
            serviceId: cap.service_id,
            enabled: cap.enabled,
            config: cap.config,
            limits: cap.limits,
            expiresAt: cap.expires_at,
            createdAt: cap.created_at,
            updatedAt: cap.updated_at
          })),
          recentMessages: messagesResult.rows.map((m) => ({
            id: m.id,
            conversationId: m.conversation_id,
            type: m.type,
            channel: m.channel,
            content: m.content,
            metadata: m.metadata,
            statusChain: m.status_chain,
            context: m.context,
            createdAt: m.created_at,
            participant: m.participant
          })),
          stats: {
            totalConversations: parseInt(stats.total_conversations, 10),
            totalEndUsers: parseInt(stats.total_end_users, 10),
            totalMessages: parseInt(stats.total_messages, 10),
            messagesLast24h: parseInt(stats.messages_last_24h, 10),
            activeConversations24h: parseInt(stats.active_conversations_24h, 10)
          }
        };

        logger.info('✅ /admin/sync/initial success', {
          tenantId,
          conversationsCount: responseData.conversations.length,
          endUsersCount: responseData.endUsers.length,
          capabilitiesCount: responseData.capabilities.length,
          messagesCount: responseData.recentMessages.length
        });

        return createSuccessResponse(responseData);
      } catch (error) {
        logger.error('❌ /admin/sync/initial error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        set.status = 500;
        return createErrorResponse('Failed to sync data');
      }
    },
    {
      detail: {
        summary: 'Initial Sync',
        description:
          'Get all initial data for dashboard (tenant, conversations, end users, capabilities, messages, stats)',
        tags: ['Admin', 'Sync']
      }
    }
  );
=======
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
>>>>>>> claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
