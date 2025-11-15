import { Elysia } from 'elysia';
import { logger } from '../middleware/logger';
import type { WebSocketDTO } from '../types/api';
import { setBroadcastFunction } from './simulation';

/**
 * Rutas de WebSocket
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

// Almacenamiento temporal de clientes conectados
// TODO: Migrar a Redis para soporte multi-instancia
const connectedClients = new Set<any>();

/**
 * Broadcast a todos los clientes conectados
 */
export function broadcastToAll(data: unknown) {
  const message = JSON.stringify(data);
  let successCount = 0;
  let errorCount = 0;

  connectedClients.forEach((client) => {
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
    totalClients: connectedClients.size,
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
      logger.debug('WebSocket message received', { message });

      try {
        // Si el mensaje ya es un objeto, usarlo directamente
        const data = typeof message === 'string' ? JSON.parse(message) : message;

        // Echo del mensaje al cliente que lo envió
        const echoMessage: WebSocketDTO.EchoMessage = {
          type: 'echo',
          data: message,
          timestamp: new Date().toISOString()
        };
        ws.send(JSON.stringify(echoMessage));

        // Broadcast a todos los demás clientes (excepto el que envió)
        if (data.type === 'typing' || data.type === 'new_message') {
          logger.info('Broadcasting message to other clients', {
            type: data.type,
            totalClients: connectedClients.size
          });

          connectedClients.forEach((client) => {
            // No enviar al mismo cliente que lo originó
            if (client !== ws && client.readyState === 1) { // 1 = OPEN
              try {
                client.send(JSON.stringify(data));
                logger.debug('Message broadcasted to client');
              } catch (error) {
                logger.error('Error broadcasting to client', {
                  error: error instanceof Error ? error.message : 'Unknown error'
                });
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
      const clientId = crypto.randomUUID();

      // Agregar cliente a la lista de conectados
      connectedClients.add(ws);

      logger.info('WebSocket client connected', {
        clientId,
        totalClients: connectedClients.size
      });

      // Mensaje de bienvenida
      const connectionMessage: WebSocketDTO.ConnectionMessage = {
        type: 'connection',
        status: 'connected',
        timestamp: new Date().toISOString(),
        clientId
      };

      ws.send(JSON.stringify(connectionMessage));

      // Notificar a otros clientes que alguien se conectó
      connectedClients.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          try {
            client.send(JSON.stringify({
              type: 'user_joined',
              clientId,
              timestamp: new Date().toISOString()
            }));
          } catch (error) {
            logger.error('Error notifying client of new connection');
          }
        }
      });
    },

    close(ws) {
      // Remover cliente de la lista
      connectedClients.delete(ws);

      logger.info('WebSocket client disconnected', {
        remainingClients: connectedClients.size
      });

      // Notificar a otros clientes que alguien se desconectó
      connectedClients.forEach((client) => {
        if (client.readyState === 1) {
          try {
            client.send(JSON.stringify({
              type: 'user_left',
              timestamp: new Date().toISOString()
            }));
          } catch (error) {
            logger.error('Error notifying client of disconnection');
          }
        }
      });
    }
  });
