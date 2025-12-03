/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\adapters\simulators\SimulatedWhatsAppAdapter.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Handles simulated whats app adapter functionality"
 *
 * DEPENDENCIES:
 *   internal: ["../../utils/observability-logger"]
 *   external: ["@inhost/shared"]
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["SimulatedWhatsAppAdapter"]
 *   inputs: "None"
 *   outputs: "Promise<void>"
 *   errors: "Error"
 *
 * INTEGRATION:
 *   data_flow: "Input → Processing → Output"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: ["../../utils/observability-logger","@inhost/shared"]
 *   critical: false
 *
 * === DOC_END :: SimulatedWhatsAppAdapter.ts ===
 */

import type { MessageEnvelopeV2 as MessageEnvelope } from '@inhost/shared';
import { MessageChannel, MessageType, MessageStatus } from '@inhost/shared';
import type { IAdapter, SendResult, AdapterConfig } from '../../core/interfaces';
import { observeLog } from '../../utils/observability-logger';

/**
 * Simulador de WhatsApp Adapter
 *
 * Implementación simple (V1) que simula mensajes de WhatsApp
 * sin conectarse a la API real.
 *
 * Características:
 * - Latencia simulada (~100ms)
 * - Estado conectado/desconectado
 * - Generación de mensajes de prueba
 *
 * @version 1.0.0 (Simulador)
 */
export class SimulatedWhatsAppAdapter implements IAdapter {
  // Identificación
  readonly id = 'whatsapp-simulator';
  readonly name = 'WhatsApp Simulator';
  readonly version = '1.0.0';
  readonly channel: MessageChannel = MessageChannel.WHATSAPP;

  // Estado
  private isConnected = false;
  private isInitialized = false;
  private config: AdapterConfig = {
    behavior: {
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 5000
    }
  };

  // Metadata del simulador
  private readonly metadata = {
    phone: '+52 1234 5678',
    businessId: 'test-business-123'
  };

  /**
   * Inicializar el adapter
   */
  async initialize(): Promise<void> {
    // Simular inicialización
    await this.delay(50);
    this.isInitialized = true;
  }

  /**
   * Iniciar el adapter
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Adapter not initialized');
    }

    await this.delay(30);
    this.isConnected = true;
  }

  /**
   * Detener el adapter
   */
  async stop(): Promise<void> {
    await this.delay(20);
    this.isConnected = false;
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    return this.isInitialized && this.isConnected;
  }

  /**
   * Enviar mensaje (simular envío a WhatsApp)
   */
  async sendMessage(envelope: MessageEnvelope): Promise<SendResult> {
    if (!this.isConnected) {
      return {
        success: false,
        messageId: envelope.id,
        status: 'failed',
        error: {
          code: 'ADAPTER_DISCONNECTED',
          message: 'WhatsApp adapter is not connected',
          retryable: true
        },
        timestamp: new Date().toISOString()
      };
    }

    // Simular latencia de red
    await this.delay(80 + Math.random() * 40); // 80-120ms

    // Simular 5% de fallos aleatorios (para testing)
    if (Math.random() < 0.05) {
      return {
        success: false,
        messageId: envelope.id,
        status: 'failed',
        error: {
          code: 'SIMULATED_NETWORK_ERROR',
          message: 'Simulated network error',
          retryable: true
        },
        timestamp: new Date().toISOString()
      };
    }

    // Éxito
    return {
      success: true,
      messageId: envelope.id,
      platformMessageId: `wamid.sim_${crypto.randomUUID()}`,
      status: 'sent',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Recibir mensaje (convertir desde formato WhatsApp a MessageEnvelope)
   *
   * En el simulador, esta función no se usa mucho porque generamos
   * mensajes directamente. Pero está aquí para compatibilidad con IAdapter.
   */
  async receiveMessage(platformMessage: unknown): Promise<MessageEnvelope> {
    // En un adapter real, aquí parsearíamos el webhook de WhatsApp
    // Por ahora, solo validamos que el mensaje tenga el formato esperado
    const msg = platformMessage as { text?: string; from?: string };

    if (!msg.text) {
      throw new Error('Invalid message: text is required');
    }

    return this.createIncomingMessage(
      msg.text,
      msg.from || this.metadata.phone
    );
  }

  /**
   * Configurar el adapter
   */
  async configure(config: AdapterConfig): Promise<void> {
    this.config = { ...this.config, ...config };
  }

  /**
   * Obtener configuración actual
   */
  getConfig(): AdapterConfig {
    return this.config;
  }

  /**
   * MÉTODOS ESPECIALES PARA SIMULACIÓN
   * Estos métodos NO están en IAdapter, son específicos del simulador
   */

  /**
   * Crear mensaje entrante simulado
   * (Este método es útil para los endpoints de simulación)
   */
  createIncomingMessage(text: string, from?: string): MessageEnvelope {
    const sender = from || this.metadata.phone;
    
    observeLog.adapter('Mensaje recibido del chat simulado (WhatsApp)', {
      from: sender,
      text: text.substring(0, 100) // Limitar para no llenar logs
    });

    observeLog.adapterDebug('Traduciendo a MessageEnvelope...');

    // Generar conversationId consistente basado en el remitente
    // Esto asegura que mensajes del mismo usuario vayan a la misma conversación
    const conversationId = this.generateConsistentUuid(sender, 'conversation');

    const envelope: MessageEnvelope = {
      id: crypto.randomUUID(),
      type: MessageType.INCOMING,
      channel: this.channel,
      content: {
        text
      },
      metadata: {
        from: sender,
        to: 'inhost',
        timestamp: new Date().toISOString(),
        conversationId, // Necesario para asociar a conversación en BD
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
        sessionId: `whatsapp-${sender}`,
        deviceId: 'whatsapp-simulator',
        userAgent: 'WhatsApp Simulator',
        ipAddress: '127.0.0.1',
      }
    };

    observeLog.adapter('Mensaje traducido a MessageEnvelope', {
      id: envelope.id,
      type: envelope.type,
      channel: envelope.channel,
      conversationId,
      status: envelope.statusChain[0].status
    });

    return envelope;
  }

  /**
   * Genera un UUID v4 consistente a partir de un string y un prefijo
   * Formato: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (36 caracteres)
   * El mismo input siempre genera el mismo UUID
   */
  private generateConsistentUuid(input: string, prefix: string): string {
    // Generar dos hashes de 32 bits para tener 64 bits totales
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
    
    // Convertir a hex y combinar para obtener 32 caracteres hex
    const hex1 = Math.abs(hash1).toString(16).padStart(8, '0');
    const hex2 = Math.abs(hash2).toString(16).padStart(8, '0');
    const hex3 = Math.abs(hash1 ^ hash2).toString(16).padStart(8, '0');
    const hex4 = Math.abs(hash1 + hash2).toString(16).padStart(8, '0');
    
    // Formato UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    // donde 4 indica versión 4 y y es 8, 9, a, o b
    return `${hex1}-${hex2.substring(0, 4)}-4${hex3.substring(1, 4)}-a${hex4.substring(1, 4)}-${hex2.substring(4)}${hex3}`.substring(0, 36);
  }

  /**
   * Toggle conexión (solo para simulador)
   */
  toggleConnection(): boolean {
    this.isConnected = !this.isConnected;
    return this.isConnected;
  }

  /**
   * Obtener estado (solo para simulador)
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      channel: this.channel,
      connected: this.isConnected,
      initialized: this.isInitialized,
      metadata: this.metadata
    };
  }

  /**
   * Helper para simular latencia
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
