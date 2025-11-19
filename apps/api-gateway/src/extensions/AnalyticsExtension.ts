/**
 * AnalyticsExtension
 *
 * Extensión de ejemplo para recopilación de métricas y analytics.
 * Rastrea eventos, uso, y genera insights.
 *
 * V2 integrará con servicios reales (Mixpanel, Amplitude, etc.)
 *
 * @module extensions
 */

import type {
  IMessageExtension,
  ExtensionContext,
  ExtensionResult,
  ExtensionConfig,
  ExtensionMetadata
} from '../core/interfaces';
import type { MessageEnvelopeV2 } from '@inhost/shared';
import { logger } from '../middleware/logger';

interface AnalyticsEvent {
  event: string;
  userId: string;
  timestamp: Date;
  properties: Record<string, unknown>;
}

export class AnalyticsExtension implements IMessageExtension {
  readonly metadata: ExtensionMetadata = {
    id: 'analytics',
    name: 'Analytics & Metrics',
    version: '1.0.0',
    type: 'analytics',
    description: 'Message analytics and usage tracking',
    author: 'INHOST'
  };

  private config?: ExtensionConfig;
  private enabled = false;
  private events: AnalyticsEvent[] = [];

  async initialize(config: ExtensionConfig): Promise<void> {
    this.config = config;
    this.enabled = config.enabled;

    logger.info('📊 Analytics Extension initialized', {
      enabled: this.enabled,
      settings: config.settings
    });
  }

  async execute(
    context: ExtensionContext,
    input: MessageEnvelopeV2
  ): Promise<ExtensionResult<MessageEnvelopeV2>> {
    if (!this.enabled) {
      return {
        success: false,
        error: {
          code: 'EXTENSION_DISABLED',
          message: 'Analytics extension is disabled'
        }
      };
    }

    try {
      // Rastrear evento
      await this.trackEvent('message_processed', context.userId, {
        messageId: input.id,
        channel: input.channel,
        type: input.type
      });

      return {
        success: true,
        data: input
      };
    } catch (error) {
      logger.error('❌ Analytics tracking failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: {
          code: 'ANALYTICS_FAILED',
          message: 'Analytics tracking failed',
          details: error
        }
      };
    }
  }

  async canExecute(context: ExtensionContext): Promise<boolean> {
    return this.enabled;
  }

  async shutdown(): Promise<void> {
    // Flush events pendientes
    logger.info('📊 Analytics Extension shutdown', {
      pendingEvents: this.events.length
    });

    this.events = [];
    this.enabled = false;
  }

  async healthCheck(): Promise<boolean> {
    return this.enabled;
  }

  /**
   * Hook: Rastrear mensaje entrante
   */
  async onIncoming(
    message: MessageEnvelopeV2,
    context: ExtensionContext
  ): Promise<ExtensionResult<MessageEnvelopeV2>> {
    await this.trackEvent('message_received', context.userId, {
      messageId: message.id,
      channel: message.channel,
      from: message.metadata?.from,
      hasMedia: !!message.content.media
    });

    logger.debug('📊 Incoming message tracked', { messageId: message.id });

    return {
      success: true,
      data: message
    };
  }

  /**
   * Hook: Rastrear mensaje saliente
   */
  async onOutgoing(
    message: MessageEnvelopeV2,
    context: ExtensionContext
  ): Promise<ExtensionResult<MessageEnvelopeV2>> {
    await this.trackEvent('message_sent', context.userId, {
      messageId: message.id,
      channel: message.channel,
      to: message.metadata?.to
    });

    logger.debug('📊 Outgoing message tracked', { messageId: message.id });

    return {
      success: true,
      data: message
    };
  }

  /**
   * Hook: Post-envío
   */
  async afterSend(
    message: MessageEnvelopeV2,
    context: ExtensionContext
  ): Promise<ExtensionResult<void>> {
    await this.trackEvent('message_delivered', context.userId, {
      messageId: message.id,
      status: message.status
    });

    return { success: true };
  }

  /**
   * Rastrear evento
   */
  private async trackEvent(
    event: string,
    userId: string,
    properties: Record<string, unknown>
  ): Promise<void> {
    const analyticsEvent: AnalyticsEvent = {
      event,
      userId,
      timestamp: new Date(),
      properties
    };

    this.events.push(analyticsEvent);

    // En producción: enviar a servicio de analytics
    logger.debug('📊 Event tracked', {
      event,
      userId,
      properties
    });

    // Limitar memoria (mantener últimos 1000 eventos)
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }

  /**
   * Obtener estadísticas
   */
  getStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    uniqueUsers: number;
  } {
    const eventsByType: Record<string, number> = {};
    const uniqueUsers = new Set<string>();

    for (const event of this.events) {
      eventsByType[event.event] = (eventsByType[event.event] || 0) + 1;
      uniqueUsers.add(event.userId);
    }

    return {
      totalEvents: this.events.length,
      eventsByType,
      uniqueUsers: uniqueUsers.size
    };
  }

  /**
   * Obtener eventos de un usuario
   */
  getUserEvents(userId: string): AnalyticsEvent[] {
    return this.events.filter(e => e.userId === userId);
  }
}
