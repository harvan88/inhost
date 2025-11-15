/**
 * IPlanResolver
 *
 * Contrato para resolver planes de usuario y capacidades.
 * Determina qué acciones puede realizar cada usuario según su plan.
 *
 * Implementaciones:
 * - V1: Configuración simple (free/premium/enterprise)
 * - V2: Base de datos de planes
 * - V3: Sistema de features flags + billing
 */

export type Plan = 'free' | 'premium' | 'enterprise';

export interface PlanCapabilities {
  plan: Plan;
  features: {
    // Persistencia
    persistenceType: 'memory' | 'local' | 'remote';
    persistenceDuration: number; // horas, -1 = infinito

    // Mensajería
    maxMessagesPerDay: number;
    maxConversations: number;

    // Rate limiting
    messagesPerMinute: number;

    // Extensiones
    allowAI: boolean;
    allowCustomExtensions: boolean;
    maxActiveExtensions: number;

    // Soporte
    prioritySupport: boolean;
    sla: string;
  };
  limits: {
    messageRetention: number; // días
    maxAttachmentSize: number; // bytes
    maxTeamMembers: number;
  };
}

export interface PlanInfo {
  userId: string;
  plan: Plan;
  capabilities: PlanCapabilities;
  validUntil?: Date;
  usage: {
    messagesThisMonth: number;
    storageUsed: number;
    activeConversations: number;
  };
}

export interface IPlanResolver {
  /**
   * Obtiene el plan de un usuario
   */
  getPlan(userId: string): Promise<Plan>;

  /**
   * Obtiene información completa del plan
   */
  getPlanInfo(userId: string): Promise<PlanInfo>;

  /**
   * Obtiene capacidades del plan
   */
  getCapabilities(plan: Plan): PlanCapabilities;

  /**
   * Verifica si una acción está permitida
   */
  canPerformAction(userId: string, action: string): Promise<boolean>;

  /**
   * Actualiza el plan de un usuario
   */
  updatePlan(userId: string, newPlan: Plan): Promise<void>;

  /**
   * Registra uso de una funcionalidad
   */
  recordUsage(userId: string, action: string, amount?: number): Promise<void>;
}
