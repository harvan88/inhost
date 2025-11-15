import type { MessageEnvelopeV2 as MessageEnvelope } from '@inhost/shared';
import { MessageChannel, MessageType, MessageStatus } from '@inhost/shared';
import type { IAdapter, SendResult, AdapterConfig } from '../../core/interfaces';

/**
 * Simulador de SMS Adapter
 *
 * @version 1.0.0 (Simulador)
 */
export class SimulatedSMSAdapter implements IAdapter {
  readonly id = 'sms-simulator';
  readonly name = 'SMS Simulator';
  readonly version = '1.0.0';
  readonly channel: MessageChannel = MessageChannel.SMS;

  private isConnected = false;
  private isInitialized = false;
  private config: AdapterConfig = {
    behavior: {
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 5000
    },
    limits: {
      maxTextLength: 160 // SMS estándar
    }
  };

  private readonly metadata = {
    phone: '+52 8765 4321',
    carrier: 'Telcel'
  };

  async initialize(): Promise<void> {
    await this.delay(50);
    this.isInitialized = true;
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Adapter not initialized');
    }
    await this.delay(30);
    this.isConnected = true;
  }

  async stop(): Promise<void> {
    await this.delay(20);
    this.isConnected = false;
  }

  async isHealthy(): Promise<boolean> {
    return this.isInitialized && this.isConnected;
  }

  async sendMessage(envelope: MessageEnvelope): Promise<SendResult> {
    if (!this.isConnected) {
      return {
        success: false,
        messageId: envelope.id,
        status: 'failed',
        error: {
          code: 'ADAPTER_DISCONNECTED',
          message: 'SMS adapter is not connected',
          retryable: true
        },
        timestamp: new Date().toISOString()
      };
    }

    // Validar longitud de SMS
    if (envelope.content.text && envelope.content.text.length > 160) {
      return {
        success: false,
        messageId: envelope.id,
        status: 'failed',
        error: {
          code: 'TEXT_TOO_LONG',
          message: 'SMS text exceeds 160 characters',
          retryable: false
        },
        timestamp: new Date().toISOString()
      };
    }

    await this.delay(100 + Math.random() * 50); // 100-150ms

    if (Math.random() < 0.05) {
      return {
        success: false,
        messageId: envelope.id,
        status: 'failed',
        error: {
          code: 'SIMULATED_CARRIER_ERROR',
          message: 'Simulated carrier error',
          retryable: true
        },
        timestamp: new Date().toISOString()
      };
    }

    return {
      success: true,
      messageId: envelope.id,
      platformMessageId: `sms_${Date.now()}`,
      status: 'sent',
      timestamp: new Date().toISOString()
    };
  }

  async receiveMessage(platformMessage: unknown): Promise<MessageEnvelope> {
    const msg = platformMessage as { text?: string; from?: string };

    if (!msg.text) {
      throw new Error('Invalid message: text is required');
    }

    return this.createIncomingMessage(
      msg.text,
      msg.from || this.metadata.phone
    );
  }

  async configure(config: AdapterConfig): Promise<void> {
    this.config = { ...this.config, ...config };
  }

  getConfig(): AdapterConfig {
    return this.config;
  }

  createIncomingMessage(text: string, from?: string): MessageEnvelope {
    return {
      id: crypto.randomUUID(),
      type: MessageType.INCOMING,
      channel: this.channel,
      content: {
        text: text.substring(0, 160) // Truncar a 160 caracteres
      },
      metadata: {
        from: from || this.metadata.phone,
        to: 'inhost',
        timestamp: new Date().toISOString()
      },
      statusChain: [
        {
          status: MessageStatus.RECEIVED,
          timestamp: new Date().toISOString(),
          messageId: crypto.randomUUID()
        }
      ],
      context: {
        plan: 'free'
      }
    };
  }

  toggleConnection(): boolean {
    this.isConnected = !this.isConnected;
    return this.isConnected;
  }

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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
