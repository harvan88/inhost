/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\simulators\clients.ts"
 *   type: "utility"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Handles clients functionality"
 *
 * DEPENDENCIES:
 *   internal: []
 *   external: ["@inhost/shared"]
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["SimulatedClient","createClientMessage","getClientsStatus","simulatedClients","toggleClientConnection"]
 *   inputs: "string, string"
 *   outputs: "MessageEnvelope"
 *   errors: "Error"
 *
 * INTEGRATION:
 *   data_flow: "Request → Middleware → Handler → Response"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: ["@inhost/shared"]
 *   critical: false
 *
 * === DOC_END :: clients.ts ===
 */

import { MessageChannel, MessageType, MessageStatus } from '@inhost/shared';
import type { MessageEnvelopeV2 as MessageEnvelope } from '@inhost/shared';

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
 * Parsea un clientId dinámico con formato "channel:userId" o usa uno predefinido
 */
function parseClientId(clientId: string): { channel: MessageChannel; userId: string; phone: string } {
  // Formato dinámico: "whatsapp:sim-user-001" o "telegram:user123"
  if (clientId.includes(':')) {
    const [channelStr, userId] = clientId.split(':');
    const channelMap: Record<string, MessageChannel> = {
      whatsapp: MessageChannel.WHATSAPP,
      telegram: MessageChannel.TELEGRAM,
      web: MessageChannel.WEB,
      sms: MessageChannel.SMS,
    };
    const channel = channelMap[channelStr] || MessageChannel.WEB;
    return {
      channel,
      userId,
      phone: `+1${userId.replace(/\D/g, '').slice(0, 10).padEnd(10, '0')}`,
    };
  }
  
  // Formato legacy: "whatsapp", "telegram", etc.
  const client = simulatedClients[clientId];
  if (client) {
    return {
      channel: client.channel,
      userId: client.id,
      phone: client.metadata.phone || client.metadata.username || 'unknown',
    };
  }
  
  // Default: web
  return {
    channel: MessageChannel.WEB,
    userId: clientId,
    phone: clientId,
  };
}

/**
 * Crea un MessageEnvelope desde un cliente simulado (dinámico o predefinido)
 */
export function createClientMessage(
  clientId: string,
  text: string
): MessageEnvelope {
  const { channel, userId, phone } = parseClientId(clientId);
  
  // Para simulación: generar UUIDs consistentes pero válidos para la BD
  // Usar hash del userId para generar siempre el mismo UUID para el mismo usuario
  const tenantId = 'default-tenant'; // Tenant fijo para simulación
  const endUserId = generateConsistentUuid(userId, 'enduser');
  const conversationId = generateConsistentUuid(userId, 'conversation');

  const envelope: MessageEnvelope = {
    id: crypto.randomUUID(),
    type: MessageType.INCOMING as MessageType,
    channel,
    content: {
      text
    },
    metadata: {
      from: phone,
      to: 'inhost',
      timestamp: new Date().toISOString(),
      conversationId, // Aquí va el conversationId según MessageEnvelopeV2
    },
    statusChain: [
      {
        status: MessageStatus.RECEIVED,
        timestamp: new Date().toISOString(),
        messageId: crypto.randomUUID()
      }
    ],
    context: {
      plan: 'free',
      sessionId: `sim-${userId}`,
      deviceId: 'simulator',
      userAgent: 'FluxCore Simulator',
      ipAddress: '127.0.0.1',
    }
  };

  return envelope;
}

/**
 * Genera un UUID v4 consistente a partir de un string y un prefijo
 * Formato: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (36 caracteres)
 */
function generateConsistentUuid(input: string, prefix: string): string {
  const str = `${prefix}-${input}`;
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash1 = ((hash1 << 5) - hash1) + char;
    hash1 = hash1 & hash1;
    hash2 = ((hash2 << 3) + hash2) ^ char;
    hash2 = hash2 & hash2;
  }
  const hex1 = Math.abs(hash1).toString(16).padStart(8, '0');
  const hex2 = Math.abs(hash2).toString(16).padStart(8, '0');
  const hex3 = Math.abs(hash1 ^ hash2).toString(16).padStart(8, '0');
  const hex4 = Math.abs(hash1 + hash2).toString(16).padStart(8, '0');
  return `${hex1}-${hex2.substring(0, 4)}-4${hex3.substring(1, 4)}-a${hex4.substring(1, 4)}-${hex2.substring(4)}${hex3}`.substring(0, 36);
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
