import { Elysia, t } from 'elysia';
import { MessageType, MessageChannel } from '@inhost/shared';
import { messageService } from '../services/messageService';
import { createSuccessResponse } from '../types/api';
import type { MessageDTO } from '../types/api';
import { httpLogger, logger } from '../middleware/logger';
import { AppError, ErrorCodes } from '../middleware/errorHandler';

/**
 * Rutas de Mensajes
 *
 * Endpoints:
 * - POST /messages - Crear un nuevo mensaje
 * - GET /messages - Listar mensajes recientes
 */
export const messagesRoutes = new Elysia({ prefix: '/messages' })
  .use(httpLogger)
  // POST /messages - Crear un nuevo mensaje
  .post(
    '/',
    async ({ body, set }) => {
      try {
        logger.info('Creating new message', {
          type: body.type,
          channel: body.channel
        });

        const result = await messageService.createMessage(body);

        const response: MessageDTO.CreateResponse = {
          status: 'received',
          messageId: result.messageId,
          timestamp: new Date().toISOString(),
          storage: 'postgresql'
        };

        return createSuccessResponse(response);
      } catch (error) {
        // Si es AppError, devolver su formato JSON
        if (error instanceof AppError) {
          set.status = error.statusCode;
          set.headers['Content-Type'] = 'application/json';
          return error.toJSON();
        }

        // Error genérico
        set.status = 500;
        set.headers['Content-Type'] = 'application/json';
        return {
          success: false,
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          }
        };
      }
    },
    {
      body: t.Object({
        type: t.Enum(MessageType),
        channel: t.Enum(MessageChannel),
        content: t.Object({
          text: t.String()
        }),
        metadata: t.Object({
          from: t.String(),
          to: t.String(),
          timestamp: t.String()
        }),
        conversationId: t.Optional(t.String())
      }),
      detail: {
        summary: 'Create a new message',
        description: 'Creates a new message in the system',
        tags: ['Messages']
      }
    }
  )

  // GET /messages - Obtener últimos mensajes
  .get(
    '/',
    async ({ query, set }) => {
      try {
        const limit = query.limit ? parseInt(query.limit) : 10;

        logger.info('Fetching messages', { limit });

        const result = await messageService.listMessages(limit);

        const response: MessageDTO.ListResponse = {
          count: result.count,
          messages: result.data.map((msg) => ({
            id: msg.id,
            type: msg.type,
            channel: msg.channel,
            content: msg.content,
            metadata: msg.metadata,
            createdAt: msg.createdAt!
          })),
          storage: 'postgresql'
        };

        return createSuccessResponse(response);
      } catch (error) {
        // Si es AppError, devolver su formato JSON
        if (error instanceof AppError) {
          set.status = error.statusCode;
          set.headers['Content-Type'] = 'application/json';
          return error.toJSON();
        }

        // Error genérico
        set.status = 500;
        set.headers['Content-Type'] = 'application/json';
        return {
          success: false,
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          }
        };
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String())
      }),
      detail: {
        summary: 'List messages',
        description: 'Retrieves the most recent messages',
        tags: ['Messages']
      }
    }
  );
