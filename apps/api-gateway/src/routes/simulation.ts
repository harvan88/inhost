import { Elysia, t } from 'elysia';
import { logger } from '../middleware/logger';
import { createSuccessResponse } from '../types/api';
import {
  createClientMessage,
  toggleClientConnection,
  getClientsStatus
} from '../simulators/clients';
import {
  processMessageThroughExtensions,
  toggleExtension,
  getExtensionsStatus,
  setExtensionLatency
} from '../simulators/extensions';

/**
 * Rutas de Simulación
 *
 * Endpoints para simular el flujo completo de mensajería:
 * - Mensajes entrantes de clientes
 * - Procesamiento por extensiones
 * - Respuestas simuladas
 */

// Variable para almacenar el WebSocket broadcast function (se inyectará desde websocket.ts)
let broadcastToAll: ((data: unknown) => void) | null = null;

export function setBroadcastFunction(fn: (data: unknown) => void) {
  broadcastToAll = fn;
}

export const simulationRoutes = new Elysia({ prefix: '/simulate' })
  // POST /simulate/client-message - Simular mensaje de cliente
  .post(
    '/client-message',
    async ({ body }) => {
      logger.info('Simulating client message', {
        clientId: body.clientId,
        text: body.text
      });

      try {
        // 1. Crear mensaje del cliente
        const clientMessage = createClientMessage(body.clientId, body.text);

        // Broadcast: mensaje recibido
        broadcastToAll?.({
          type: 'message_received',
          data: clientMessage,
          timestamp: new Date().toISOString()
        });

        logger.debug('Client message created', { messageId: clientMessage.id });

        // 2. Procesar a través de extensiones
        const extensionResponses = await processMessageThroughExtensions(clientMessage);

        // Broadcast: procesamiento completado
        broadcastToAll?.({
          type: 'message_processing',
          extensionCount: extensionResponses.length,
          timestamp: new Date().toISOString()
        });

        logger.debug('Extensions processed', {
          count: extensionResponses.length
        });

        // 3. Broadcast de cada respuesta de extensión
        for (const response of extensionResponses) {
          broadcastToAll?.({
            type: 'extension_response',
            data: response,
            timestamp: new Date().toISOString()
          });

          logger.debug('Extension response broadcasted', {
            extensionId: response.metadata.extensionId
          });
        }

        return createSuccessResponse({
          clientMessage,
          extensionResponses,
          processedCount: extensionResponses.length
        });
      } catch (error) {
        logger.error('Error simulating client message', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },
    {
      body: t.Object({
        clientId: t.String(),
        text: t.String()
      }),
      detail: {
        summary: 'Simulate client message',
        description: 'Simula un mensaje entrante desde un cliente externo',
        tags: ['Simulation']
      }
    }
  )

  // POST /simulate/extension-toggle - Activar/desactivar extensión
  .post(
    '/extension-toggle',
    async ({ body }) => {
      logger.info('Toggling extension', { extensionId: body.extensionId });

      try {
        const isActive = toggleExtension(body.extensionId);

        // Broadcast cambio de estado
        broadcastToAll?.({
          type: 'extension_toggle',
          extensionId: body.extensionId,
          active: isActive,
          timestamp: new Date().toISOString()
        });

        return createSuccessResponse({
          extensionId: body.extensionId,
          active: isActive
        });
      } catch (error) {
        logger.error('Error toggling extension', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },
    {
      body: t.Object({
        extensionId: t.String()
      }),
      detail: {
        summary: 'Toggle extension',
        description: 'Activa o desactiva una extensión simulada',
        tags: ['Simulation']
      }
    }
  )

  // POST /simulate/client-toggle - Conectar/desconectar cliente
  .post(
    '/client-toggle',
    async ({ body }) => {
      logger.info('Toggling client', { clientId: body.clientId });

      try {
        const isConnected = toggleClientConnection(body.clientId);

        // Broadcast cambio de estado
        broadcastToAll?.({
          type: 'client_toggle',
          clientId: body.clientId,
          connected: isConnected,
          timestamp: new Date().toISOString()
        });

        return createSuccessResponse({
          clientId: body.clientId,
          connected: isConnected
        });
      } catch (error) {
        logger.error('Error toggling client', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },
    {
      body: t.Object({
        clientId: t.String()
      }),
      detail: {
        summary: 'Toggle client connection',
        description: 'Conecta o desconecta un cliente simulado',
        tags: ['Simulation']
      }
    }
  )

  // GET /simulate/status - Estado del sistema de simulación
  .get(
    '/status',
    async () => {
      logger.debug('Getting simulation status');

      const clients = getClientsStatus();
      const extensions = getExtensionsStatus();

      const activeExtensions = extensions.filter(e => e.active).length;
      const connectedClients = clients.filter(c => c.connected).length;

      return createSuccessResponse({
        clients,
        extensions,
        stats: {
          activeExtensions,
          connectedClients,
          totalClients: clients.length,
          totalExtensions: extensions.length
        }
      });
    },
    {
      detail: {
        summary: 'Get simulation status',
        description: 'Obtiene el estado de todos los simuladores',
        tags: ['Simulation']
      }
    }
  )

  // PATCH /simulate/extension-latency - Actualizar latencia de extensión
  .patch(
    '/extension-latency',
    async ({ body }) => {
      logger.info('Updating extension latency', {
        extensionId: body.extensionId,
        latency: body.latency
      });

      try {
        setExtensionLatency(body.extensionId, body.latency);

        return createSuccessResponse({
          extensionId: body.extensionId,
          latency: body.latency
        });
      } catch (error) {
        logger.error('Error updating extension latency', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    },
    {
      body: t.Object({
        extensionId: t.String(),
        latency: t.Number({ minimum: 0, maximum: 5000 })
      }),
      detail: {
        summary: 'Update extension latency',
        description: 'Actualiza la latencia simulada de una extensión',
        tags: ['Simulation']
      }
    }
  );
