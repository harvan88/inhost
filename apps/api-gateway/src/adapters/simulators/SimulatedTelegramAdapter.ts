/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\adapters\simulators\SimulatedTelegramAdapter.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Handles simulated telegram adapter functionality"
 *
 * DEPENDENCIES:
 *   internal: []
 *   external: ["@inhost/shared"]
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["SimulatedTelegramAdapter"]
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
 *   uses: ["@inhost/shared"]
 *   critical: false
 *
 * === DOC_END :: SimulatedTelegramAdapter.ts ===
 */

import type { MessageEnvelopeV2 as MessageEnvelope } from '@inhost/shared';
import { MessageChannel, MessageType, MessageStatus } from '@inhost/shared';
import type { IAdapter, SendResult, AdapterConfig } from '../../core/interfaces';

/**
 * Simulador de Telegram Adapter
 *
 * @version 1.0.0 (Simulador)
 */
export class SimulatedTelegramAdapter implements IAdapter {
  readonly id = 'telegram-simulator';
  readonly name = 'Telegram Simulator';
  readonly version = '1.0.0';
  readonly channel: MessageChannel = MessageChannel.TELEGRAM;

  private isConnected = false;
  private isInitialized = false;
  private config: AdapterConfig = {
    behavior: {
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 5000
    }
  };

  private readonly metadata = {
    username: '@usuario_test',
    chatId: '123456789'
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
          message: 'Telegram adapter is not connected',
          retryable: true
        },
        timestamp: new Date().toISOString()
      };
    }

    await this.delay(60 + Math.random() * 40); // 60-100ms

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

    return {
      success: true,
      messageId: envelope.id,
      platformMessageId: `tg_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`,
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
      msg.from || this.metadata.username
    );
  }

  async configure(config: AdapterConfig): Promise<void> {
    this.config = { ...this.config, ...config };
  }

  getConfig(): AdapterConfig {
    return this.config;
  }

  createIncomingMessage(text: string, from?: string): MessageEnvelope {
    const sender = from || this.metadata.username;
    const conversationId = this.generateConsistentUuid(sender, 'conversation');
    
    return {
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
        conversationId,
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
        sessionId: `telegram-${sender}`,
        deviceId: 'telegram-simulator',
        userAgent: 'Telegram Simulator',
        ipAddress: '127.0.0.1',
      }
    };
  }

  private generateConsistentUuid(input: string, prefix: string): string {
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
