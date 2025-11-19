/**
 * Admin Message Feedback Routes
 *
 * Endpoints:
 * - POST /admin/messages/:id/feedback - Create or update feedback for a message
 * - GET /admin/messages/:id/feedback - Get feedback for a message
 * - GET /admin/feedback/analytics - Get feedback analytics (by extension, rating, etc.)
 * - GET /admin/feedback - List all feedback (with filters)
 */

import { Elysia, t } from 'elysia';
import { eq, desc, and, sql, isNull, isNotNull } from 'drizzle-orm';
import {
  db,
  messageFeedback,
  messages,
  conversations,
  type MessageFeedback,
} from '@inhost/shared';
import { createSuccessResponse, createErrorResponse } from '../../types/api';
import { requireAuth } from '../../middleware/auth';
import { httpLogger } from '../../middleware/logger';

export const adminFeedbackRoutes = new Elysia()
  .use(httpLogger)
  .use(requireAuth())

  // POST /admin/messages/:messageId/feedback - Create or update feedback
  .post(
    '/messages/:messageId/feedback',
    async ({ user, params, body, error }) => {
      const { messageId } = params;
      const { rating, comment, suggestedCorrection } = body;

      try {
        // Verify message exists and belongs to tenant
        const message = await db.query.messages.findFirst({
          where: eq(messages.id, messageId),
          with: {
            conversation: {
              columns: {
                tenantId: true,
              },
            },
          },
        });

        if (!message || message.conversation?.tenantId !== user.tenantId) {
          return error(404, createErrorResponse('MESSAGE_NOT_FOUND', 'Message not found'));
        }

        // Extract extensionId from message metadata
        const extensionId = (message.metadata as any)?.extensionId || null;

        // Check if feedback already exists
        const existing = await db.query.messageFeedback.findFirst({
          where: and(
            eq(messageFeedback.messageId, messageId),
            eq(messageFeedback.givenByUserId, user.id)
          ),
        });

        let result: MessageFeedback;

        if (existing) {
          // Update existing feedback
          const [updated] = await db
            .update(messageFeedback)
            .set({
              rating,
              comment,
              suggestedCorrection,
              extensionId,
              updatedAt: new Date(),
            })
            .where(eq(messageFeedback.id, existing.id))
            .returning();

          result = updated;
        } else {
          // Create new feedback
          const [created] = await db
            .insert(messageFeedback)
            .values({
              tenantId: user.tenantId,
              messageId,
              givenByUserId: user.id,
              rating,
              comment,
              suggestedCorrection,
              extensionId,
            })
            .returning();

          result = created;
        }

        return createSuccessResponse({
          feedback: {
            id: result.id,
            messageId: result.messageId,
            rating: result.rating,
            comment: result.comment,
            suggestedCorrection: result.suggestedCorrection,
            extensionId: result.extensionId,
            createdAt: result.createdAt?.toISOString(),
            updatedAt: result.updatedAt?.toISOString(),
          },
          message: existing ? 'Feedback updated' : 'Feedback created',
        });
      } catch (err: any) {
        console.error('Create/update feedback error:', err);
        return error(500, createErrorResponse('FEEDBACK_FAILED', 'Failed to save feedback'));
      }
    },
    {
      body: t.Object({
        rating: t.Optional(t.Union([t.Literal('positive'), t.Literal('negative'), t.Null()])),
        comment: t.Optional(t.String()),
        suggestedCorrection: t.Optional(t.String()),
      }),
    }
  )

  // GET /admin/messages/:messageId/feedback - Get feedback for a message
  .get('/messages/:messageId/feedback', async ({ user, params, error }) => {
    const { messageId } = params;

    try {
      // Verify message exists and belongs to tenant
      const message = await db.query.messages.findFirst({
        where: eq(messages.id, messageId),
        with: {
          conversation: {
            columns: {
              tenantId: true,
            },
          },
        },
      });

      if (!message || message.conversation?.tenantId !== user.tenantId) {
        return error(404, createErrorResponse('MESSAGE_NOT_FOUND', 'Message not found'));
      }

      // Fetch all feedback for this message
      const feedbackList = await db.query.messageFeedback.findMany({
        where: and(
          eq(messageFeedback.messageId, messageId),
          eq(messageFeedback.tenantId, user.tenantId)
        ),
        with: {
          givenByUser: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: desc(messageFeedback.createdAt),
      });

      return createSuccessResponse({
        feedback: feedbackList.map((fb) => ({
          id: fb.id,
          messageId: fb.messageId,
          rating: fb.rating,
          comment: fb.comment,
          suggestedCorrection: fb.suggestedCorrection,
          extensionId: fb.extensionId,
          givenBy: {
            id: fb.givenByUser.id,
            name: fb.givenByUser.name,
            email: fb.givenByUser.email,
          },
          createdAt: fb.createdAt?.toISOString(),
          updatedAt: fb.updatedAt?.toISOString(),
        })),
      });
    } catch (err: any) {
      console.error('Get feedback error:', err);
      return error(500, createErrorResponse('FETCH_FAILED', 'Failed to fetch feedback'));
    }
  })

  // GET /admin/feedback - List all feedback with filters
  .get(
    '/feedback',
    async ({ user, query, error }) => {
      try {
        const { extensionId, rating, limit = 50, offset = 0 } = query;

        // Build where conditions
        const conditions = [eq(messageFeedback.tenantId, user.tenantId)];

        if (extensionId) {
          conditions.push(eq(messageFeedback.extensionId, extensionId));
        }

        if (rating === 'positive' || rating === 'negative') {
          conditions.push(eq(messageFeedback.rating, rating));
        } else if (rating === 'none') {
          conditions.push(isNull(messageFeedback.rating));
        }

        // Fetch feedback with relations
        const feedbackList = await db.query.messageFeedback.findMany({
          where: and(...conditions),
          with: {
            message: {
              columns: {
                id: true,
                type: true,
                content: true,
                createdAt: true,
              },
              with: {
                conversation: {
                  columns: {
                    id: true,
                  },
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
            },
            givenByUser: {
              columns: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: desc(messageFeedback.createdAt),
          limit: Number(limit),
          offset: Number(offset),
        });

        return createSuccessResponse({
          feedback: feedbackList.map((fb) => ({
            id: fb.id,
            messageId: fb.messageId,
            rating: fb.rating,
            comment: fb.comment,
            suggestedCorrection: fb.suggestedCorrection,
            extensionId: fb.extensionId,
            message: {
              id: fb.message.id,
              type: fb.message.type,
              text: (fb.message.content as any)?.text || '',
              conversationId: fb.message.conversation?.id,
              endUser: fb.message.conversation?.endUser,
              createdAt: fb.message.createdAt?.toISOString(),
            },
            givenBy: {
              id: fb.givenByUser.id,
              name: fb.givenByUser.name,
              email: fb.givenByUser.email,
            },
            createdAt: fb.createdAt?.toISOString(),
            updatedAt: fb.updatedAt?.toISOString(),
          })),
          pagination: {
            limit: Number(limit),
            offset: Number(offset),
          },
        });
      } catch (err: any) {
        console.error('List feedback error:', err);
        return error(500, createErrorResponse('FETCH_FAILED', 'Failed to fetch feedback'));
      }
    },
    {
      query: t.Object({
        extensionId: t.Optional(t.String()),
        rating: t.Optional(
          t.Union([
            t.Literal('positive'),
            t.Literal('negative'),
            t.Literal('none'),
            t.Literal('all'),
          ])
        ),
        limit: t.Optional(t.Numeric()),
        offset: t.Optional(t.Numeric()),
      }),
    }
  )

  // GET /admin/feedback/analytics - Get feedback analytics
  .get('/feedback/analytics', async ({ user, query, error }) => {
    try {
      const { extensionId, days = 30 } = query;

      // Build where conditions
      const conditions = [eq(messageFeedback.tenantId, user.tenantId)];

      if (extensionId) {
        conditions.push(eq(messageFeedback.extensionId, extensionId));
      }

      // Add date filter
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - Number(days));

      // Get rating counts
      const ratingStats = await db
        .select({
          rating: messageFeedback.rating,
          extensionId: messageFeedback.extensionId,
          count: sql<number>`count(*)`,
        })
        .from(messageFeedback)
        .where(and(...conditions))
        .groupBy(messageFeedback.rating, messageFeedback.extensionId);

      // Get feedback with comments count
      const withCommentsCount = await db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(messageFeedback)
        .where(and(...conditions, isNotNull(messageFeedback.comment)));

      // Get feedback with corrections count
      const withCorrectionsCount = await db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(messageFeedback)
        .where(and(...conditions, isNotNull(messageFeedback.suggestedCorrection)));

      // Calculate totals and breakdown by extension
      const byExtension: Record<
        string,
        { positive: number; negative: number; total: number }
      > = {};
      let totalPositive = 0;
      let totalNegative = 0;

      for (const stat of ratingStats) {
        const ext = stat.extensionId || 'unknown';
        const count = Number(stat.count);

        if (!byExtension[ext]) {
          byExtension[ext] = { positive: 0, negative: 0, total: 0 };
        }

        if (stat.rating === 'positive') {
          byExtension[ext].positive += count;
          totalPositive += count;
        } else if (stat.rating === 'negative') {
          byExtension[ext].negative += count;
          totalNegative += count;
        }

        byExtension[ext].total += count;
      }

      const total = totalPositive + totalNegative;

      return createSuccessResponse({
        period: {
          days: Number(days),
          from: dateThreshold.toISOString(),
          to: new Date().toISOString(),
        },
        overall: {
          total,
          positive: totalPositive,
          negative: totalNegative,
          positivePercentage: total > 0 ? Math.round((totalPositive / total) * 100) : 0,
          negativePercentage: total > 0 ? Math.round((totalNegative / total) * 100) : 0,
          withComments: Number(withCommentsCount[0]?.count || 0),
          withCorrections: Number(withCorrectionsCount[0]?.count || 0),
        },
        byExtension: Object.entries(byExtension).map(([extensionId, stats]) => ({
          extensionId,
          ...stats,
          positivePercentage:
            stats.total > 0 ? Math.round((stats.positive / stats.total) * 100) : 0,
          negativePercentage:
            stats.total > 0 ? Math.round((stats.negative / stats.total) * 100) : 0,
        })),
      });
    } catch (err: any) {
      console.error('Feedback analytics error:', err);
      return error(500, createErrorResponse('ANALYTICS_FAILED', 'Failed to get analytics'));
    }
  }, {
    query: t.Object({
      extensionId: t.Optional(t.String()),
      days: t.Optional(t.Numeric()),
    }),
  });
