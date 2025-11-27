/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/routes/admin/sync.ts"
 *   type: "controller"
 *   layer: "backend"
 *   domain: "sync"
 *   purpose: "Endpoint crítico de sincronización inicial GET /admin/sync/initial. Retorna conversaciones (last 50), mensajes recientes y end users para hidratación del frontend después del login. ⚠️ ISSUE: Posible race condition con WebSocket mencionada en AUDIT-REPORT.md"
 *
 * DEPENDENCIES:
 *   internal: ["../../middleware/auth","../../middleware/logger","../../types/api"]
 *   external: ["@inhost/shared","elysia"]
 *   infrastructure: ["PostgreSQL"]
 *
 * CONTRACTS:
 *   exports: ["adminSyncRoutes"]
 *   inputs: ["user from JWT (tenantId, userId)"]
 *   outputs: ["SyncInitialData { conversations, messages, endUsers }"]
 *   errors: ["UNAUTHORIZED", "DATABASE_ERROR"]
 *
 * INTEGRATION:
 *   data_flow: "[JWT auth] → [query PostgreSQL filtered by tenantId] → [map with denormalized lastMessage] → [JSON response to frontend]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["routes/index.ts"]
 *   uses: ["../../middleware/auth","../../middleware/logger","../../types/api","@inhost/shared","elysia"]
 *   critical: true
 *
 * === DOC_END :: sync.ts ===
 */

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
  .get('/initial', async ({ user }) => {
    console.log('🔍 [SYNC] /admin/sync/initial called', { user });

    if (!user) {
      console.error('❌ [SYNC] User is undefined - auth middleware failed!');
      return createErrorResponse('UNAUTHORIZED', 'User not authenticated');
    }

    try {
      // 1. Fetch conversations (last 50)
      console.log('🔍 [SYNC] Fetching conversations for tenant:', user.tenantId);
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
