import type { MessageEnvelope } from '@inhost/shared';
import { MessageType } from '@inhost/shared';

/**
 * Simuladores de Extensiones
 *
 * Simula el procesamiento de mensajes por extensiones externas
 */

export interface SimulatedExtension {
  id: string;
  name: string;
  icon: string;
  active: boolean;
  latency: number; // ms
  subscriptions: MessageType[];
  processMessage: (envelope: MessageEnvelope) => Promise<MessageEnvelope>;
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Echo Bot - Devuelve el mensaje recibido
 */
const echoBot: SimulatedExtension = {
  id: 'echo',
  name: 'Echo Bot',
  icon: '📢',
  active: false,
  latency: 45,
  subscriptions: ['incoming'],
  async processMessage(envelope: MessageEnvelope): Promise<MessageEnvelope> {
    await delay(echoBot.latency);

    const responseText = `Echo: ${envelope.content.text}`;

    return {
      id: crypto.randomUUID(),
      conversationId: envelope.conversationId,
      type: 'outgoing' as MessageType,
      channel: envelope.channel,
      content: {
        text: responseText,
        contentType: 'text'
      },
      metadata: {
        from: 'echo-bot',
        to: envelope.metadata.from as string,
        timestamp: new Date().toISOString(),
        extensionId: 'echo',
        originalMessageId: envelope.id
      },
      statusChain: [
        {
          status: 'processing',
          timestamp: new Date().toISOString(),
          messageId: crypto.randomUUID()
        }
      ],
      context: {
        plan: 'free',
        timestamp: new Date().toISOString(),
        extension: {
          id: 'echo',
          name: 'Echo Bot',
          latency: echoBot.latency
        }
      }
    };
  }
};

/**
 * AI Assistant - Respuesta inteligente simulada
 */
const aiBot: SimulatedExtension = {
  id: 'ai',
  name: 'AI Assistant',
  icon: '🧠',
  active: false,
  latency: 120,
  subscriptions: ['incoming'],
  async processMessage(envelope: MessageEnvelope): Promise<MessageEnvelope> {
    await delay(aiBot.latency);

    // Respuestas simuladas básicas
    const text = envelope.content.text?.toLowerCase() || '';
    let responseText = '¡Hola! ¿En qué puedo ayudarte hoy?';

    if (text.includes('hola') || text.includes('hi')) {
      responseText = '¡Hola! 👋 Soy un asistente de IA. ¿En qué puedo ayudarte?';
    } else if (text.includes('ayuda') || text.includes('help')) {
      responseText = 'Puedo ayudarte con: información, consultas, y conversación general. ¿Qué necesitas?';
    } else if (text.includes('gracias') || text.includes('thanks')) {
      responseText = '¡De nada! Estoy aquí para ayudarte cuando lo necesites. 😊';
    } else if (text.includes('?')) {
      responseText = `Interesante pregunta. Basándome en "${envelope.content.text}", te recomendaría investigar más al respecto.`;
    } else {
      responseText = `Recibí tu mensaje: "${envelope.content.text}". ¿Hay algo específico en lo que pueda ayudarte?`;
    }

    return {
      id: crypto.randomUUID(),
      conversationId: envelope.conversationId,
      type: 'outgoing' as MessageType,
      channel: envelope.channel,
      content: {
        text: responseText,
        contentType: 'text'
      },
      metadata: {
        from: 'ai-bot',
        to: envelope.metadata.from as string,
        timestamp: new Date().toISOString(),
        extensionId: 'ai',
        model: 'simulated-gpt-4',
        originalMessageId: envelope.id
      },
      statusChain: [
        {
          status: 'processing',
          timestamp: new Date().toISOString(),
          messageId: crypto.randomUUID()
        }
      ],
      context: {
        plan: 'free',
        timestamp: new Date().toISOString(),
        extension: {
          id: 'ai',
          name: 'AI Assistant',
          latency: aiBot.latency,
          model: 'simulated-gpt-4'
        }
      }
    };
  }
};

/**
 * CRM Sync - Registra en CRM simulado
 */
const crmBot: SimulatedExtension = {
  id: 'crm',
  name: 'CRM Sync',
  icon: '📊',
  active: false,
  latency: 200,
  subscriptions: ['incoming'],
  async processMessage(envelope: MessageEnvelope): Promise<MessageEnvelope> {
    await delay(crmBot.latency);

    const contact = envelope.metadata.from as string;
    const responseText = `[CRM] Contacto "${contact}" registrado. Mensaje guardado en el sistema.`;

    return {
      id: crypto.randomUUID(),
      conversationId: envelope.conversationId,
      type: 'outgoing' as MessageType,
      channel: envelope.channel,
      content: {
        text: responseText,
        contentType: 'text'
      },
      metadata: {
        from: 'crm-bot',
        to: envelope.metadata.from as string,
        timestamp: new Date().toISOString(),
        extensionId: 'crm',
        crmId: crypto.randomUUID(),
        contactSaved: true,
        originalMessageId: envelope.id
      },
      statusChain: [
        {
          status: 'processing',
          timestamp: new Date().toISOString(),
          messageId: crypto.randomUUID()
        }
      ],
      context: {
        plan: 'free',
        timestamp: new Date().toISOString(),
        extension: {
          id: 'crm',
          name: 'CRM Sync',
          latency: crmBot.latency,
          crmSystem: 'InhostCRM'
        }
      }
    };
  }
};

/**
 * Registro de extensiones disponibles
 */
export const simulatedExtensions: Record<string, SimulatedExtension> = {
  echo: echoBot,
  ai: aiBot,
  crm: crmBot
};

/**
 * Procesa un mensaje a través de las extensiones activas
 */
export async function processMessageThroughExtensions(
  envelope: MessageEnvelope
): Promise<MessageEnvelope[]> {
  const activeExtensions = Object.values(simulatedExtensions).filter(
    ext => ext.active && ext.subscriptions.includes(envelope.type)
  );

  if (activeExtensions.length === 0) {
    return [];
  }

  // Procesar en paralelo
  const responses = await Promise.allSettled(
    activeExtensions.map(ext => ext.processMessage(envelope))
  );

  // Filtrar solo las exitosas
  return responses
    .filter((result): result is PromiseFulfilledResult<MessageEnvelope> =>
      result.status === 'fulfilled'
    )
    .map(result => result.value);
}

/**
 * Activa/desactiva una extensión
 */
export function toggleExtension(extensionId: string): boolean {
  const extension = simulatedExtensions[extensionId];

  if (!extension) {
    throw new Error(`Extensión no encontrada: ${extensionId}`);
  }

  extension.active = !extension.active;
  return extension.active;
}

/**
 * Obtiene el estado de todas las extensiones
 */
export function getExtensionsStatus() {
  return Object.entries(simulatedExtensions).map(([id, ext]) => ({
    id,
    name: ext.name,
    icon: ext.icon,
    active: ext.active,
    latency: ext.latency,
    subscriptions: ext.subscriptions
  }));
}

/**
 * Actualiza la latencia de una extensión (para testing)
 */
export function setExtensionLatency(extensionId: string, latency: number): void {
  const extension = simulatedExtensions[extensionId];

  if (!extension) {
    throw new Error(`Extensión no encontrada: ${extensionId}`);
  }

  extension.latency = latency;
}
