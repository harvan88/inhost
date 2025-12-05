/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/routes/websocket.ts"
 *   type: "controller"
 *   layer: "backend"
 *   domain: "sync"
 *   purpose: "Rutas de WebSocket para comunicación en tiempo real con rate limiting, validación y broadcast a todos los clientes conectados"
 *
 * DEPENDENCIES:
 *   internal: ["../middleware/logger", "../types/api", "./simulation", "../services", "../middleware/websocketValidation"]
 *   external: ["elysia"]
 *   infrastructure: ["websocket"]
 *
 * CONTRACTS:
 *   exports: ["websocketRoutes", "broadcastToAll"]
 *   inputs: ["WebSocketDTO", "any:message"]
 *   outputs: ["void", "WebSocketResponse"]
 *   errors: ["MESSAGE_TOO_LARGE", "VALIDATION_ERROR", "RATE_LIMIT_EXCEEDED"]
 *
 * INTEGRATION:
 *   data_flow: "[WebSocket Client] → [/realtime] → [validation] → [rate limit] → [business logic] → [broadcast/response]"
 *   events_emitted: ["connection", "echo", "typing", "new_message", "status_update", "message_received", "message_processing", "extension_response"]
 *   events_consumed: ["WebSocket messages from clients"]
 *
 * IMPACT:
 *   used_by: ["routes/index.ts", "frontend WebSocketProvider", "simulation routes"]
 *   uses: ["services/notifications", "services/rateLimiter", "middleware/websocketValidation"]
 *   critical: true
 *
 * === DOC_END :: websocket.ts ===
 */

import { Elysia } from 'elysia';
import { logger } from '../middleware/logger';
import type { WebSocketDTO } from '../types/api';
import { notifications, ownerChecker, messageCore, rateLimiter, planResolver } from '../services';
import { validateWebSocketMessage, validateMessageSize } from '../middleware/websocketValidation';

/**
 * Rutas de WebSocket (Sprint 3 - Real-time con Protección)
 *
 * Endpoints:
 * - WS /realtime - Comunicación en tiempo real
 *
 * Protecciones (Sprint 3):
 * - ✅ Rate Limiting: Mismo límite que HTTP (12 free, 30 premium)
 * - ✅ Validation: TypeBox schemas para mensajes
 * - 🔄 Authentication: TODO (userId temporal)
 *
 * Tipos de mensajes soportados:
 * - connection: Notificación de conexión/desconexión
 * - echo: Echo de mensajes (desarrollo)
 * - typing: Indicadores de escritura
 * - new_message: Notificación de nuevos mensajes
 * - status_update: Actualización de estados de mensaje
 * - message_received: Mensaje recibido de cliente
 * - message_processing: Mensaje siendo procesado
 * - extension_response: Respuesta de extensión
 */

// Mapeo de WebSocket a metadata
const wsMetadata = new Map<any, {
  connectionId: string;
  userId: string;
  deviceId: string;
}>();

/**
 * Broadcast a todos los clientes conectados
 * (Mantener para compatibilidad con simulation.ts)
 */
export function broadcastToAll(data: unknown) {
  const message = JSON.stringify(data);
  let successCount = 0;
  let errorCount = 0;

  wsMetadata.forEach((metadata, client) => {
    if (client.readyState === 1) { // 1 = OPEN
      try {
        client.send(message);
        successCount++;
      } catch (error) {
        errorCount++;
        logger.error('Error broadcasting to client', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  logger.debug('Broadcast completed', {
    totalClients: wsMetadata.size,
    successCount,
    errorCount
  });
}

export const websocketRoutes = new Elysia()
  // WebSocket /realtime - Comunicación en tiempo real
  .ws('/realtime', {
    async message(ws, message: any) {
      const meta = wsMetadata.get(ws);

      logger.debug('WebSocket message received', {
        userId: meta?.userId,
        message
      });

      try {
        // ============================================
        // VALIDACIÓN DE TAMAÑO (Sprint 3)
        // ============================================
        const sizeCheck = validateMessageSize(message, 1024 * 1024); // 1MB max
        if (!sizeCheck.valid) {
          const errorMessage = {
            type: 'error',
            code: 'MESSAGE_TOO_LARGE',
            message: sizeCheck.error,
            size: sizeCheck.size,
            timestamp: new Date().toISOString()
          };

          ws.send(JSON.stringify(errorMessage));

          logger.warn('WebSocket message too large', {
            userId: meta?.userId,
            size: sizeCheck.size,
            error: sizeCheck.error
          });

          return;
        }

        // ============================================
        // VALIDACIÓN DE ESTRUCTURA (Sprint 3)
        // ============================================
        const validation = validateWebSocketMessage(message);
        if (!validation.valid) {
          const errorMessage = {
            type: 'error',
            code: 'INVALID_MESSAGE',
            message: 'Message validation failed',
            errors: validation.errors,
            timestamp: new Date().toISOString()
          };

          ws.send(JSON.stringify(errorMessage));

          logger.warn('WebSocket message validation failed', {
            userId: meta?.userId,
            errors: validation.errors
          });

          return;
        }

        const data = validation.data;

        // Actualizar actividad del owner
        if (meta) {
          ownerChecker.updateActivity(meta.userId, meta.deviceId);
          notifications.updateActivity(meta.connectionId);
        }

        // ============================================
        // RATE LIMITING (Sprint 3)
        // ============================================
        if (meta) {
          const plan = await planResolver.getPlan(meta.userId);
          const rateLimitResult = await rateLimiter.checkLimit(meta.userId, plan);

          if (!rateLimitResult.allowed) {
            // Rate limit excedido - enviar error al cliente
            const errorMessage = {
              type: 'error',
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Rate limit exceeded. Please slow down.',
              retryAfter: rateLimitResult.retryAfter,
              limit: rateLimitResult.limit,
              resetAt: rateLimitResult.resetAt.toISOString(),
              timestamp: new Date().toISOString()
            };

            ws.send(JSON.stringify(errorMessage));

            logger.warn('WebSocket rate limit exceeded', {
              userId: meta.userId,
              plan,
              limit: rateLimitResult.limit,
              retryAfter: rateLimitResult.retryAfter
            });

            return; // No procesar el mensaje
          }

          // Registrar el mensaje en el rate limiter
          await rateLimiter.recordRequest(meta.userId, plan);

          logger.debug('WebSocket rate limit check passed', {
            userId: meta.userId,
            plan,
            remaining: rateLimitResult.remaining
          });
        }

        // Echo del mensaje al cliente que lo envió (desarrollo)
        const echoMessage: WebSocketDTO.EchoMessage = {
          type: 'echo',
          data: message,
          timestamp: new Date().toISOString()
        };
        ws.send(JSON.stringify(echoMessage));

        // Procesar según tipo
        if (data.type === 'typing') {
          // Indicador de escritura - broadcast a otros
          notifications.sendTypingIndicator({
            userId: meta?.userId || 'unknown',
            conversationId: data.conversationId || 'default',
            isTyping: data.isTyping,
            timestamp: new Date().toISOString()
          }).catch(err => {
            logger.error('Error sending typing indicator', { error: err.message });
          });
        } else if (data.type === 'new_message' || data.type === 'message_received') {
          // Nuevo mensaje - procesar con MessageCore
          logger.info('New message received via WebSocket', {
            userId: meta?.userId,
            type: data.type
          });

          // Por ahora, solo broadcast a otros clientes (no usar notifications.broadcast que espera MessageEnvelope)
          wsMetadata.forEach((otherMeta, otherClient) => {
            if (otherClient !== ws && otherClient.readyState === 1) {
              try {
                otherClient.send(JSON.stringify(data));
              } catch (err) {
                logger.error('Error broadcasting to client', { error: err });
              }
            }
          });
        }
      } catch (error) {
        logger.error('Error processing WebSocket message', {
          error: error instanceof Error ? error.message : 'Unknown error',
          message
        });
      }
    },

    open(ws) {
      const connectionId = crypto.randomUUID();
      const deviceId = crypto.randomUUID();
      // TODO: Obtener userId real desde autenticación
      const userId = 'user-' + crypto.randomUUID().substring(0, 8);

      // Guardar metadata
      wsMetadata.set(ws, { connectionId, userId, deviceId });

      // Registrar conexión en notifications
      notifications.registerConnection(userId, connectionId, {
        deviceId,
        connectedAt: new Date().toISOString()
      });

      // Inyectar WebSocket en notification service
      if ('attachWebSocket' in notifications) {
        (notifications as any).attachWebSocket(connectionId, ws);
      }

      // Marcar owner como online
      ownerChecker.markOnline(userId, {
        deviceId,
        type: 'web',
        platform: 'browser',
        connectedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      });

      logger.debug('WebSocket client connected', {
        connectionId,
        userId,
        deviceId,
        totalClients: wsMetadata.size
      });

      // Mensaje de bienvenida
      const connectionMessage: WebSocketDTO.ConnectionMessage = {
        type: 'connection',
        status: 'connected',
        timestamp: new Date().toISOString(),
        clientId: connectionId
      };

      ws.send(JSON.stringify(connectionMessage));
    },

    close(ws) {
      const meta = wsMetadata.get(ws);

      if (meta) {
        // Desregistrar conexión
        notifications.unregisterConnection(meta.connectionId);

        // Marcar owner como offline (si no tiene otras conexiones)
        const activeConnections = notifications.getActiveConnections(meta.userId);
        if (activeConnections.length === 0) {
          ownerChecker.markOffline(meta.userId, meta.deviceId);
        }

        logger.info('WebSocket client disconnected', {
          userId: meta.userId,
          connectionId: meta.connectionId,
          remainingClients: wsMetadata.size - 1
        });
      }

      // Remover metadata
      wsMetadata.delete(ws);
    }
  });
