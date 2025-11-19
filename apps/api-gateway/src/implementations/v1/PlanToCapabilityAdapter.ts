/**
 * PlanToCapabilityAdapter
 *
 * Adaptador para migración de planes hardcodeados a sistema de capacidades.
 * Permite mantener compatibilidad con código legacy que usa IPlanResolver.
 *
 * Mapeo:
 * - free → starter template
 * - premium → professional template
 * - enterprise → enterprise template
 *
 * Este adaptador se puede eliminar en V2 cuando todo el código
 * use directamente IServiceGate.
 *
 * @module implementations/v1
 */

import type {
  IPlanResolver,
  Plan,
  PlanCapabilities,
  PlanInfo
} from '../../core/interfaces';
import type { IServiceGate } from '../../core/interfaces';
import { logger } from '../../middleware/logger';

/**
 * Mapeo de planes a templates
 */
const PLAN_TO_TEMPLATE: Record<Plan, string> = {
  free: 'starter',
  premium: 'professional',
  enterprise: 'enterprise'
};

/**
 * Mapeo inverso: template a plan
 */
const TEMPLATE_TO_PLAN: Record<string, Plan> = {
  starter: 'free',
  professional: 'premium',
  enterprise: 'enterprise'
};

/**
 * Adaptador que implementa IPlanResolver usando IServiceGate internamente
 */
export class PlanToCapabilityAdapter implements IPlanResolver {
  // Mapeo temporal de usuarios a planes (para compatibilidad)
  private userPlans: Map<string, Plan> = new Map();

  constructor(private serviceGate: IServiceGate) {
    logger.info('🔄 PlanToCapabilityAdapter initialized (legacy compatibility)');
  }

  async getPlan(userId: string): Promise<Plan> {
    const plan = this.userPlans.get(userId) || 'free';

    logger.debug('🔍 Plan resolved (legacy)', { userId, plan });

    return plan;
  }

  async getPlanInfo(userId: string): Promise<PlanInfo> {
    const plan = await this.getPlan(userId);
    const capabilities = this.getCapabilities(plan);

    // Obtener estadísticas de uso desde ServiceGate
    const stats = await this.serviceGate.getUsageStats(userId);

    let messagesThisMonth = 0;
    const rateLimitUsage = stats.services.get('rate-limiting');
    if (rateLimitUsage) {
      messagesThisMonth = rateLimitUsage.used;
    }

    return {
      userId,
      plan,
      capabilities,
      usage: {
        messagesThisMonth,
        storageUsed: stats.globalUsage.storageBytes,
        activeConversations: 0 // TODO: Implementar
      }
    };
  }

  getCapabilities(plan: Plan): PlanCapabilities {
    // Estas son las capacidades legacy hardcodeadas
    // En V2 se eliminarán completamente
    const capabilities: Record<Plan, PlanCapabilities> = {
      free: {
        plan: 'free',
        features: {
          persistenceType: 'memory',
          persistenceDuration: 24,
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
          messageRetention: 1,
          maxAttachmentSize: 1024 * 1024,
          maxTeamMembers: 1
        }
      },
      premium: {
        plan: 'premium',
        features: {
          persistenceType: 'local',
          persistenceDuration: -1,
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
          messageRetention: 365,
          maxAttachmentSize: 10 * 1024 * 1024,
          maxTeamMembers: 10
        }
      },
      enterprise: {
        plan: 'enterprise',
        features: {
          persistenceType: 'remote',
          persistenceDuration: -1,
          maxMessagesPerDay: -1,
          maxConversations: -1,
          messagesPerMinute: 100,
          allowAI: true,
          allowCustomExtensions: true,
          maxActiveExtensions: -1,
          prioritySupport: true,
          sla: '1h-response'
        },
        limits: {
          messageRetention: -1,
          maxAttachmentSize: 100 * 1024 * 1024,
          maxTeamMembers: -1
        }
      }
    };

    return capabilities[plan];
  }

  async canPerformAction(userId: string, action: string): Promise<boolean> {
    // Mapear acciones legacy a servicios nuevos
    const actionToService: Record<string, { service: any; feature?: string }> = {
      send_message: { service: 'rate-limiting' },
      use_ai: { service: 'ai-assistant' },
      use_custom_extension: { service: 'custom' },
      create_conversation: { service: 'persistence' }
    };

    const mapping = actionToService[action];

    if (!mapping) {
      logger.warn('⚠️  Unknown action for capability check', { action });
      return true;
    }

    // Usar ServiceGate para verificar
    const result = await this.serviceGate.canUseService(userId, mapping.service);

    return result.allowed;
  }

  async updatePlan(userId: string, newPlan: Plan): Promise<void> {
    const oldPlan = this.userPlans.get(userId) || 'free';
    this.userPlans.set(userId, newPlan);

    // Aplicar template correspondiente en ServiceGate
    const templateName = PLAN_TO_TEMPLATE[newPlan];

    if ('applyTemplate' in this.serviceGate) {
      await (this.serviceGate as any).applyTemplate(userId, templateName);
    }

    logger.info('📋 Plan updated (migrated to capabilities)', {
      userId,
      oldPlan,
      newPlan,
      template: templateName
    });
  }

  async recordUsage(userId: string, action: string, amount: number = 1): Promise<void> {
    // Mapear acciones a servicios
    const actionToService: Record<string, any> = {
      send_message: 'rate-limiting',
      storage: 'persistence',
      conversation_created: 'persistence',
      conversation_closed: 'persistence',
      ai_call: 'ai-assistant'
    };

    const service = actionToService[action];

    if (service) {
      await this.serviceGate.recordServiceUsage(userId, service, amount);
    }

    logger.debug('📊 Usage recorded (via adapter)', {
      userId,
      action,
      amount,
      service
    });
  }

  /**
   * Resetear uso mensual
   */
  resetMonthlyUsage(): void {
    // Delegar al ServiceGate
    logger.info('🔄 Monthly usage reset (adapter - no-op, handled by ServiceGate)');
  }

  /**
   * Obtener estadísticas
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

  /**
   * Migrar usuario de plan legacy a capacidades
   */
  async migrateUserToCapabilities(userId: string): Promise<void> {
    const plan = await this.getPlan(userId);
    const templateName = PLAN_TO_TEMPLATE[plan];

    if ('applyTemplate' in this.serviceGate) {
      await (this.serviceGate as any).applyTemplate(userId, templateName);

      logger.info('✅ User migrated to capability system', {
        userId,
        fromPlan: plan,
        toTemplate: templateName
      });
    }
  }

  /**
   * Migrar todos los usuarios
   */
  async migrateAllUsers(): Promise<void> {
    const userIds = Array.from(this.userPlans.keys());

    for (const userId of userIds) {
      await this.migrateUserToCapabilities(userId);
    }

    logger.info('✅ All users migrated to capability system', {
      totalMigrated: userIds.length
    });
  }
}
