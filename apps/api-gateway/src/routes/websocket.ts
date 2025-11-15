import { Elysia } from 'elysia';
import { logger } from '../middleware/logger';
import type { WebSocketDTO } from '../types/api';
import { setBroadcastFunction } from './simulation';
import { notifications, ownerChecker, messageCore } from '../services';

/**
 * Rutas de WebSocket (Sprint 1.5 - Integrado con MessageCore)
 *
 * Endpoints:
 * - WS /realtime - Comunicación en tiempo real
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

// Inyectar función de broadcast en el módulo de simulación
setBroadcastFunction(broadcastToAll);

export const websocketRoutes = new Elysia()
  // WebSocket /realtime - Comunicación en tiempo real
  .ws('/realtime', {
    message(ws, message: any) {
      const meta = wsMetadata.get(ws);

      logger.debug('WebSocket message received', {
        userId: meta?.userId,
        message
      });

      try {
        const data = typeof message === 'string' ? JSON.parse(message) : message;

        // Actualizar actividad del owner
        if (meta) {
          ownerChecker.updateActivity(meta.userId, meta.deviceId);
          notifications.updateActivity(meta.connectionId);
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

      logger.info('WebSocket client connected', {
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
