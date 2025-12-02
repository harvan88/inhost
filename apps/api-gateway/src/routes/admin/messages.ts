/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\routes\admin\messages.ts"
 *   type: "controller"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Handles messages API routes"
 *
 * DEPENDENCIES:
 *   internal: ["../../middleware/auth","../../middleware/logger","../../types/api"]
 *   external: ["@inhost/shared","elysia"]
 *   infrastructure: ["PostgreSQL"]
 *
 * CONTRACTS:
 *   exports: ["adminMessagesRoutes"]
 *   inputs: "None"
 *   outputs: "void"
 *   errors: "None"
 *
 * INTEGRATION:
 *   data_flow: "Request → Middleware → Handler → Response"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: ["../../middleware/auth","../../middleware/logger","../../types/api","@inhost/shared","elysia"]
 *   critical: false
 *
 * === DOC_END :: messages.ts ===
 */

/**
 * Admin Messages Management Routes
 *
 * Endpoints:
 * - PATCH /admin/messages/:id/status - Update message status
 */

import { Elysia, t } from 'elysia';
import { eq, and } from 'drizzle-orm';
import { db, messages, conversations } from '@inhost/shared';
import { createSuccessResponse, createErrorResponse } from '../../types/api';
import { requireAuth } from '../../middleware/auth';
import { httpLogger } from '../../middleware/logger';

/**
 * Messages Management Routes
 */
export const adminMessagesRoutes = new Elysia({ prefix: '/admin/messages' })
  .use(httpLogger)
  .use(requireAuth())

  // PATCH /admin/messages/:id/status - Update message status
  .patch(
    '/:id/status',
    async ({ user, params, body, error }) => {
      const { id } = params;
      const { status } = body;

      try {
        // Find message and verify it belongs to user's tenant
        const message = await db.query.messages.findFirst({
          where: eq(messages.id, id),
          with: {
            conversation: true,
          },
        });

        if (!message) {
          return error(404, createErrorResponse('MESSAGE_NOT_FOUND', 'Message not found'));
        }

        // Verify conversation belongs to tenant
        if (message.conversation.tenantId !== user.tenantId) {
          return error(403, createErrorResponse(
            'FORBIDDEN',
            'You do not have access to this message'
          ));
        }

        // Add new status to status chain
        const newStatusEntry = {
          status,
          timestamp: new Date().toISOString(),
          messageId: id,
        };

        const updatedStatusChain = [
          ...(message.statusChain || []),
          newStatusEntry,
        ];

        // Update message
        const [updatedMessage] = await db
          .update(messages)
          .set({
            statusChain: updatedStatusChain,
            updatedAt: new Date(),
          })
          .where(eq(messages.id, id))
          .returning();

        return createSuccessResponse({
          message: {
            id: updatedMessage.id,
            statusChain: updatedMessage.statusChain,
            updatedAt: updatedMessage.updatedAt,
          },
        });
      } catch (err: any) {
        console.error('Update message status error:', err);
        return error(500, createErrorResponse('UPDATE_FAILED', 'Failed to update message status'));
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        status: t.Union([
          t.Literal('sent'),
          t.Literal('delivered'),
          t.Literal('read'),
          t.Literal('failed'),
        ]),
      }),
      detail: {
        summary: 'Update Message Status',
        description: 'Update the delivery status of a message',
        tags: ['Admin Messages'],
      },
    }
  );
