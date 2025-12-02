/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\implementations\v1\SimplePlanResolver.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Handles simple plan resolver functionality"
 *
 * DEPENDENCIES:
 *   internal: ["../../middleware/logger"]
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["SimplePlanResolver"]
 *   inputs: "None"
 *   outputs: "Promise<Plan>"
 *   errors: "None"
 *
 * INTEGRATION:
 *   data_flow: "Request → Middleware → Handler → Response"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: ["../../middleware/logger"]
 *   critical: false
 *
 * === DOC_END :: SimplePlanResolver.ts ===
 */

/**
 * SimplePlanResolver (V1)
 *
 * Implementación simple de resolución de planes.
 * Configuración estática free/premium/enterprise.
 *
 * Características V1:
 * - Planes hardcoded en memoria
 * - Sin persistencia
 * - Tracking básico de uso
 *
 * V2 usará base de datos para planes
 * V3 agregará billing integration y feature flags
 */

import type {
  IPlanResolver,
  Plan,
  PlanCapabilities,
  PlanInfo
} from '../../core/interfaces';
import { logger } from '../../middleware/logger';

export class SimplePlanResolver implements IPlanResolver {
  // Asignación de usuarios a planes (en memoria)
  private userPlans: Map<string, Plan> = new Map();

  // Tracking de uso
  private usage: Map<string, {
    messagesThisMonth: number;
    storageUsed: number;
    activeConversations: number;
  }> = new Map();

  // Capacidades por plan (configuración estática)
  private capabilities: Record<Plan, PlanCapabilities> = {
    free: {
      plan: 'free',
      features: {
        persistenceType: 'memory',
        persistenceDuration: 24, // 24 horas

        maxMessagesPerDay: 100,
        maxConversations: 5,

        messagesPerMinute: 12,

        allowAI: false,
        allowCustomExtensions: false,
        maxActiveExtensions: 0,

        prioritySupport: false,
        sla: 'best-effort'
      },
      limits: {
        messageRetention: 1, // 1 día
        maxAttachmentSize: 1024 * 1024, // 1 MB
        maxTeamMembers: 1
      }
    },

    premium: {
      plan: 'premium',
      features: {
        persistenceType: 'local',
        persistenceDuration: -1, // infinito

        maxMessagesPerDay: 10000,
        maxConversations: 100,

        messagesPerMinute: 30,

        allowAI: true,
        allowCustomExtensions: false,
        maxActiveExtensions: 3,

        prioritySupport: true,
        sla: '24h-response'
      },
      limits: {
        messageRetention: 365, // 1 año
        maxAttachmentSize: 10 * 1024 * 1024, // 10 MB
        maxTeamMembers: 10
      }
    },

    enterprise: {
      plan: 'enterprise',
      features: {
        persistenceType: 'remote',
        persistenceDuration: -1, // infinito

        maxMessagesPerDay: -1, // ilimitado
        maxConversations: -1, // ilimitado

        messagesPerMinute: 100,

        allowAI: true,
        allowCustomExtensions: true,
        maxActiveExtensions: -1, // ilimitado

        prioritySupport: true,
        sla: '1h-response'
      },
      limits: {
        messageRetention: -1, // infinito
        maxAttachmentSize: 100 * 1024 * 1024, // 100 MB
        maxTeamMembers: -1 // ilimitado
      }
    }
  };

  constructor() {
    // Plan por defecto: free
    logger.info('📋 SimplePlanResolver initialized with static configuration');
  }

  async getPlan(userId: string): Promise<Plan> {
    const plan = this.userPlans.get(userId) || 'free';

    logger.debug('🔍 Plan resolved', { userId, plan });

    return plan;
  }

  async getPlanInfo(userId: string): Promise<PlanInfo> {
    const plan = await this.getPlan(userId);
    const capabilities = this.getCapabilities(plan);
    const userUsage = this.usage.get(userId) || {
      messagesThisMonth: 0,
      storageUsed: 0,
      activeConversations: 0
    };

    return {
      userId,
      plan,
      capabilities,
      usage: userUsage
    };
  }

  getCapabilities(plan: Plan): PlanCapabilities {
    return this.capabilities[plan];
  }

  async canPerformAction(userId: string, action: string): Promise<boolean> {
    const plan = await this.getPlan(userId);
    const capabilities = this.getCapabilities(plan);
    const userUsage = this.usage.get(userId) || {
      messagesThisMonth: 0,
      storageUsed: 0,
      activeConversations: 0
    };

    switch (action) {
      case 'send_message': {
        const maxPerDay = capabilities.features.maxMessagesPerDay;
        if (maxPerDay === -1) return true; // ilimitado

        // Simplificado: asumimos que messagesThisMonth ~ messagesThisDay
        // V2 tendrá tracking diario real
        return userUsage.messagesThisMonth < maxPerDay;
      }

      case 'use_ai': {
        return capabilities.features.allowAI;
      }

      case 'use_custom_extension': {
        return capabilities.features.allowCustomExtensions;
      }

      case 'create_conversation': {
        const maxConversations = capabilities.features.maxConversations;
        if (maxConversations === -1) return true;

        return userUsage.activeConversations < maxConversations;
      }

      default:
        logger.warn('⚠️  Unknown action for plan check', { action });
        return true; // Por defecto permitir
    }
  }

  async updatePlan(userId: string, newPlan: Plan): Promise<void> {
    const oldPlan = this.userPlans.get(userId) || 'free';

    this.userPlans.set(userId, newPlan);

    logger.info('📋 Plan updated', {
      userId,
      oldPlan,
      newPlan
    });
  }

  async recordUsage(userId: string, action: string, amount: number = 1): Promise<void> {
    let userUsage = this.usage.get(userId);

    if (!userUsage) {
      userUsage = {
        messagesThisMonth: 0,
        storageUsed: 0,
        activeConversations: 0
      };
      this.usage.set(userId, userUsage);
    }

    switch (action) {
      case 'send_message':
        userUsage.messagesThisMonth += amount;
        break;

      case 'storage':
        userUsage.storageUsed += amount;
        break;

      case 'conversation_created':
        userUsage.activeConversations += amount;
        break;

      case 'conversation_closed':
        userUsage.activeConversations = Math.max(0, userUsage.activeConversations - amount);
        break;
    }

    logger.debug('📊 Usage recorded', {
      userId,
      action,
      amount,
      newUsage: userUsage
    });
  }

  /**
   * Resetea el uso mensual (llamar al inicio de cada mes)
   */
  resetMonthlyUsage(): void {
    for (const [userId, usage] of this.usage.entries()) {
      usage.messagesThisMonth = 0;
    }

    logger.info('🔄 Monthly usage reset for all users');
  }

  /**
   * Obtiene estadísticas generales
   */
  getStats(): {
    totalUsers: number;
    byPlan: Record<Plan, number>;
  } {
    const byPlan: Record<Plan, number> = {
      free: 0,
      premium: 0,
      enterprise: 0
    };

    for (const plan of this.userPlans.values()) {
      byPlan[plan]++;
    }

    return {
      totalUsers: this.userPlans.size,
      byPlan
    };
  }
}
