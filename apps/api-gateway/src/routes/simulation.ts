/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "routes/simulation.ts"
 *   type: "controller"
 *   layer: "frontend"
 *   domain: "api"
 *   purpose: "Handles simulation API routes"
 *
 * DEPENDENCIES:
 *   internal: ["../middleware/logger","../services","../simulators/clients","../simulators/extensions","../types/api"]
 *   external: ["elysia"]
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["setBroadcastFunction","simulationRoutes"]
 *   inputs: "(data:"
 *   outputs: "void"
 *   errors: "None"
 *
 * INTEGRATION:
 *   data_flow: "WebSocket → Handler → Store → UI"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: ["../middleware/logger","../services","../simulators/clients","../simulators/extensions","../types/api","elysia"]
 *   critical: true
 *
 * === DOC_END :: simulation.ts ===
 */

import { Elysia, t } from 'elysia';
import { MessageChannel } from '@inhost/shared';
import { logger } from '../middleware/logger';
import { createSuccessResponse } from '../types/api';
import {
  toggleClientConnection,
  getClientsStatus
} from '../simulators/clients';

// NOTA: Extensiones simuladas ELIMINADAS
// Las extensiones reales se ejecutan vía ExtensionHost en MessageCore.receive()
// import { processMessageThroughExtensions, ... } from '../simulators/extensions';
import { messageCore, adapterManager, extensionHost } from '../services';

/**
 * Rutas de Simulación (Production-Ready)
 *
 * Endpoints para simular el flujo completo de mensajería con persistencia REAL:
 * 
 * FLUJO CORRECTO:
 * 1. POST /simulate/client-message → Adapter crea MessageEnvelope
 * 2. messageCore.receive() ejecuta:
 *    - Persiste en PostgreSQL (VERIFICADO, retorna resultado real)
 *    - Broadcast vía WebSocket (message:new)
 *    - Procesa extensiones REALES (ExtensionHost → enrichments)
 *    - Actualiza estado
 * 3. Retorna resultado REAL de persistencia (no hardcodeado)
 *
 * ARQUITECTURA:
 * - Adapters: Traducen mensajes de plataforma a MessageEnvelope
 * - MessageCore: Orquestador "tonto" que persiste y notifica
 * - ExtensionHost: Ejecuta extensiones reales (FluxCore, Sentiment, Keywords)
 * - PostgreSQL: Persistencia permanente (source of truth)
 * - WebSocket: Notificaciones en tiempo real
 * - Frontend IndexedDB: Reflejo local (cache)
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
      logger.info('🎬 Simulating client message', {
        clientId: body.clientId,
        text: body.text
      });

      try {
        // 1. Determinar canal a partir del clientId simulado
        // Formato esperado: "whatsapp:sim-user-001", "telegram:user123", etc.
        const [channelPrefix] = body.clientId.split(':');
        const channelMap: Record<string, MessageChannel> = {
          whatsapp: MessageChannel.WHATSAPP,
          telegram: MessageChannel.TELEGRAM,
          web: MessageChannel.WEB,
          sms: MessageChannel.SMS,
        };

        const channel = channelMap[channelPrefix] ?? MessageChannel.WHATSAPP;

        // 2. Obtener el adapter correspondiente (simulado en este entorno)
        const adapter = adapterManager.getAdapter(channel);
        if (!adapter) {
          logger.error('No adapter registered for simulated channel', {
            channel,
            clientId: body.clientId,
          });
          throw new Error(`No adapter registered for channel: ${channel}`);
        }

        // 3. Usar receiveMessage del adapter para traducir desde el mensaje de plataforma
        //    En este caso, el "platformMessage" es un objeto mínimo con text/from,
        //    similar a un webhook real de WhatsApp/Telegram/SMS.
        const platformMessage = {
          text: body.text,
          from: body.clientId,
        };

        const clientMessage = await adapter.receiveMessage(platformMessage);
        logger.debug('Client message created via adapter', {
          messageId: clientMessage.id,
          channel: clientMessage.channel,
        });

        // 4. Recibir mensaje a través de MessageCore
        // Esto automáticamente:
        // - Persiste en PostgreSQL (VERIFICADO)
        // - Broadcast vía WebSocketNotification (message:new)
        // - Procesa extensiones REALES (ExtensionHost)
        // - Actualiza estado a 'received'
        const receiveResult = await messageCore.receive(clientMessage);
        
        logger.info('📊 MessageCore.receive result', {
          messageId: clientMessage.id,
          channel: clientMessage.channel,
          persisted: receiveResult.persisted,
          error: receiveResult.error
        });

        // Broadcast evento de procesamiento completado
        broadcastToAll?.({
          type: 'message_received',
          messageId: clientMessage.id,
          persisted: receiveResult.persisted,
          error: receiveResult.error,
          timestamp: new Date().toISOString()
        });

        // Retornar resultado REAL (no hardcodeado)
        return createSuccessResponse({
          message: {
            id: clientMessage.id,
            type: clientMessage.type,
            channel: clientMessage.channel,
            text: clientMessage.content.text,
            conversationId: clientMessage.metadata?.conversationId
          },
          persistence: {
            success: receiveResult.persisted,
            error: receiveResult.error,
            storage: 'postgresql'
          },
          // Nota: Las extensiones REALES (FluxCore, Sentiment, Keywords) 
          // se procesan dentro de messageCore.receive() y generan enrichments
          // que se persisten automáticamente
        });
      } catch (error) {
        logger.error('❌ Error simulating client message', {
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

  // NOTA: /extension-toggle ELIMINADO
  // Las extensiones reales se gestionan vía ExtensionHost, no simuladores

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

      // Clientes simulados (adapters)
      const clients = getClientsStatus();
      const connectedClients = clients.filter((c: { connected: boolean }) => c.connected).length;

      // Extensiones REALES del ExtensionHost
      const realExtensions = extensionHost.listExtensions();
      const extStats = extensionHost.getStats();

      return createSuccessResponse({
        clients,
        extensions: {
          registered: realExtensions,
          stats: extStats
        },
        stats: {
          connectedClients,
          totalClients: clients.length,
          totalExtensions: extStats.totalExtensions,
          extensionsProcessed: extStats.totalProcessed,
          extensionErrors: extStats.totalErrors
        }
      });
    },
    {
      detail: {
        summary: 'Get simulation status',
        description: 'Obtiene el estado de clientes simulados y extensiones reales',
        tags: ['Simulation']
      }
    }
  );

  // NOTA: /extension-latency ELIMINADO
  // Las extensiones reales no tienen latencia simulada configurable
