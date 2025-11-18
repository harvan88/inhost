import { MessageChannel, MessageType } from '@inhost/shared';
import type { MessageEnvelope } from '@inhost/shared';

/**
 * Simuladores de Clientes
 *
 * Simula la entrada de mensajes desde diferentes canales externos
 */

export interface SimulatedClient {
  id: string;
  name: string;
  icon: string;
  channel: MessageChannel;
  connected: boolean;
  metadata: {
    phone?: string;
    username?: string;
    [key: string]: unknown;
  };
}

export const simulatedClients: Record<string, SimulatedClient> = {
  whatsapp: {
    id: 'whatsapp-sim',
    name: 'WhatsApp',
    icon: '📱',
    channel: MessageChannel.WHATSAPP,
    connected: false,
    metadata: {
      phone: '+52 1234 5678',
      businessId: 'test-business-123'
    }
  },
  telegram: {
    id: 'telegram-sim',
    name: 'Telegram',
    icon: '✈️',
    channel: MessageChannel.TELEGRAM,
    connected: false,
    metadata: {
      username: '@usuario_test',
      chatId: '123456789'
    }
  },
  web: {
    id: 'web-sim',
    name: 'Web Chat',
    icon: '🌐',
    channel: MessageChannel.WEB,
    connected: true,
    metadata: {
      sessionId: 'web-session-' + crypto.randomUUID()
    }
  },
  sms: {
    id: 'sms-sim',
    name: 'SMS',
    icon: '📨',
    channel: MessageChannel.SMS,
    connected: false,
    metadata: {
      phone: '+52 8765 4321',
      carrier: 'Telcel'
    }
  }
};

/**
 * Crea un MessageEnvelope desde un cliente simulado
 *
 * @param clientId - ID del cliente simulado
 * @param text - Texto del mensaje
 * @param conversationId - (Opcional) ID de conversación. Si no se provee, se genera basado en from+to
 */
export function createClientMessage(
  clientId: string,
  text: string,
  conversationId?: string
): MessageEnvelope {
  const client = simulatedClients[clientId];

  if (!client) {
    throw new Error(`Cliente no encontrado: ${clientId}`);
  }

  if (!client.connected && clientId !== 'web') {
    throw new Error(`Cliente no conectado: ${clientId}`);
  }

  // Generar conversationId basado en participantes (from + to)
  // Esto agrupa todos los mensajes entre los mismos participantes
  const from = client.metadata.phone || client.metadata.username || 'unknown';
  const to = 'inhost';
  const defaultConversationId = `conv-${client.channel}-${from.replace(/\s+/g, '')}-${to}`;

  const envelope: MessageEnvelope = {
    id: crypto.randomUUID(),
    conversationId: conversationId || defaultConversationId,
    type: MessageType.INCOMING as MessageType,
    channel: client.channel,
    content: {
      text,
      contentType: 'text'
    },
    metadata: {
      from,
      to,
      timestamp: new Date().toISOString(),
      clientId: client.id,
      ...client.metadata
    },
    statusChain: [
      {
        status: 'received',
        timestamp: new Date().toISOString(),
        messageId: crypto.randomUUID()
      }
    ],
    context: {
      plan: 'free',
      timestamp: new Date().toISOString(),
      source: 'simulator'
    }
  };

  return envelope;
}

/**
 * Conecta/desconecta un cliente simulado
 */
export function toggleClientConnection(clientId: string): boolean {
  const client = simulatedClients[clientId];

  if (!client) {
    throw new Error(`Cliente no encontrado: ${clientId}`);
  }

  if (clientId === 'web') {
    // Web siempre está conectado
    return true;
  }

  client.connected = !client.connected;
  return client.connected;
}

/**
 * Obtiene el estado de todos los clientes
 */
export function getClientsStatus() {
  return Object.entries(simulatedClients).map(([id, client]) => ({
    id,
    name: client.name,
    icon: client.icon,
    channel: client.channel,
    connected: client.connected,
    metadata: client.metadata
  }));
}
