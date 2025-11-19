/**
 * Extension Registry - Ejemplo Práctico
 *
 * Demuestra cómo ServiceGate y ExtensionRegistry trabajan juntos
 * para controlar acceso a extensiones por usuario.
 */

import type {
  IExtensionRegistry,
  IServiceGate,
  ExtensionContext,
  MessageEnvelopeV2
} from '../apps/api-gateway/src/core/interfaces';
import { AIAssistantExtension } from '../apps/api-gateway/src/extensions/AIAssistantExtension';
import { AnalyticsExtension } from '../apps/api-gateway/src/extensions/AnalyticsExtension';

// ============================================================================
// ESCENARIO 1: Sistema de Mensajería con AI Opcional
// ============================================================================

/**
 * MessageProcessor maneja mensajes entrantes y decide
 * qué extensiones ejecutar basándose en capabilities del usuario
 */
class MessageProcessor {
  constructor(
    private serviceGate: IServiceGate,
    private extensionRegistry: IExtensionRegistry
  ) {}

  /**
   * Procesar mensaje entrante con extensiones opcionales
   */
  async processIncomingMessage(
    message: MessageEnvelopeV2,
    userId: string
  ): Promise<ProcessResult> {
    console.log(`\n📨 Processing message from user: ${userId}`);

    const context: ExtensionContext = {
      userId,
      message,
      metadata: {},
      timestamp: new Date()
    };

    // 1️⃣ VERIFICAR: ¿Usuario puede usar AI Assistant?
    const canUseAI = await this.serviceGate.canUseService(userId, 'ai-assistant');

    if (canUseAI.allowed) {
      console.log('✅ User has AI Assistant enabled');

      // 2️⃣ VERIFICAR QUOTA: ¿Tiene llamadas disponibles?
      const usageResult = await this.serviceGate.recordServiceUsage(
        userId,
        'ai-assistant',
        1 // Incrementar contador
      );

      if (usageResult.allowed) {
        console.log(`✅ Quota OK (${usageResult.remaining} remaining)`);

        // 3️⃣ EJECUTAR: Procesar con AI
        try {
          const aiResult = await this.extensionRegistry.execute(
            'ai-assistant',
            context,
            message
          );

          if (aiResult.success) {
            console.log('🤖 AI processing successful');
            return {
              message: aiResult.data,
              aiProcessed: true,
              extensionsUsed: ['ai-assistant']
            };
          }
        } catch (error) {
          console.error('❌ AI processing failed:', error);
        }
      } else {
        console.warn(`⚠️  Quota exceeded (resets at ${usageResult.resetAt})`);
        return {
          message,
          aiProcessed: false,
          error: 'QUOTA_EXCEEDED',
          resetAt: usageResult.resetAt
        };
      }
    } else {
      console.log('❌ AI Assistant not available for this user');
      console.log(`   Reason: ${canUseAI.reason}`);
    }

    // Sin AI - mensaje pasa sin procesar
    return {
      message,
      aiProcessed: false,
      extensionsUsed: []
    };
  }

  /**
   * Procesar con múltiples extensiones en pipeline
   */
  async processWithPipeline(
    message: MessageEnvelopeV2,
    userId: string
  ): Promise<PipelineResult> {
    console.log(`\n🔄 Pipeline processing for user: ${userId}`);

    const context: ExtensionContext = {
      userId,
      message,
      metadata: {},
      timestamp: new Date()
    };

    const results: ExtensionResult[] = [];
    let processedMessage = message;

    // Pipeline de extensiones
    const pipeline = [
      { id: 'ai-assistant', name: 'AI Assistant' },
      { id: 'translation', name: 'Translation' },
      { id: 'analytics', name: 'Analytics' }
    ];

    for (const ext of pipeline) {
      // Verificar acceso a extensión
      const canUse = await this.serviceGate.canUseService(userId, ext.id);

      if (canUse.allowed) {
        console.log(`✅ Executing: ${ext.name}`);

        try {
          // Ejecutar extensión
          const result = await this.extensionRegistry.execute(
            ext.id,
            { ...context, message: processedMessage },
            processedMessage
          );

          if (result.success && result.data) {
            processedMessage = result.data; // Pasar resultado a siguiente extensión
            results.push({ extension: ext.id, success: true });

            // Registrar uso
            await this.serviceGate.recordServiceUsage(userId, ext.id);
          }
        } catch (error) {
          console.error(`❌ ${ext.name} failed:`, error);
          results.push({ extension: ext.id, success: false, error });
        }
      } else {
        console.log(`⏭️  Skipping ${ext.name}: ${canUse.reason}`);
        results.push({ extension: ext.id, success: false, skipped: true });
      }
    }

    return {
      originalMessage: message,
      processedMessage,
      extensionResults: results
    };
  }
}

// ============================================================================
// ESCENARIO 2: Marketplace de Extensiones
// ============================================================================

/**
 * ExtensionMarketplace - UI/API para mostrar extensiones disponibles
 */
class ExtensionMarketplace {
  constructor(
    private serviceGate: IServiceGate,
    private extensionRegistry: IExtensionRegistry
  ) {}

  /**
   * Obtener catálogo de extensiones disponibles para usuario
   */
  async getAvailableExtensions(userId: string): Promise<MarketplaceExtension[]> {
    console.log(`\n🏪 Marketplace for user: ${userId}`);

    // 1. Listar todas las extensiones registradas
    const allExtensions = this.extensionRegistry.list();

    // 2. Verificar acceso de usuario a cada extensión
    const marketplace = await Promise.all(
      allExtensions.map(async (registered) => {
        const ext = registered.extension.metadata;
        const canUse = await this.serviceGate.canUseService(userId, ext.id);

        return {
          id: ext.id,
          name: ext.name,
          description: ext.description,
          type: ext.type,
          version: ext.version,

          // Estado de acceso
          hasAccess: canUse.allowed,
          status: canUse.allowed ? 'active' : 'locked',
          reason: canUse.reason,

          // Estadísticas
          executionCount: registered.executionCount,
          errorCount: registered.errorCount,
          lastUsed: registered.lastExecutedAt,

          // Pricing (mock)
          pricing: this.getPricing(ext.id, canUse.allowed)
        };
      })
    );

    // Ordenar: extensiones con acceso primero
    marketplace.sort((a, b) => {
      if (a.hasAccess && !b.hasAccess) return -1;
      if (!a.hasAccess && b.hasAccess) return 1;
      return 0;
    });

    return marketplace;
  }

  /**
   * Habilitar extensión para usuario (requiere permiso/pago)
   */
  async enableExtension(userId: string, extensionId: string): Promise<EnableResult> {
    console.log(`\n🔓 Enabling ${extensionId} for user ${userId}`);

    // 1. Verificar que extensión existe
    const extension = this.extensionRegistry.get(extensionId);
    if (!extension) {
      return { success: false, error: 'Extension not found' };
    }

    // 2. Verificar si usuario ya tiene acceso
    const currentAccess = await this.serviceGate.canUseService(userId, extensionId);
    if (currentAccess.allowed) {
      return { success: false, error: 'Already enabled' };
    }

    // 3. Simular verificación de pago/upgrade
    const hasPayment = await this.verifyPayment(userId, extensionId);
    if (!hasPayment) {
      return { success: false, error: 'Payment required' };
    }

    // 4. Habilitar extensión en ServiceGate (DB)
    try {
      // Esto actualizaría user_capabilities en PostgreSQL
      await this.serviceGate.setServiceEnabled(userId, extensionId, true);

      console.log(`✅ Extension ${extensionId} enabled for user ${userId}`);

      return {
        success: true,
        message: `${extension.extension.metadata.name} is now active!`
      };
    } catch (error) {
      console.error('❌ Failed to enable extension:', error);
      return { success: false, error: 'Database error' };
    }
  }

  private getPricing(extensionId: string, hasAccess: boolean): ExtensionPricing {
    if (hasAccess) {
      return { type: 'included', price: 0 };
    }

    // Mock pricing
    const pricing: Record<string, ExtensionPricing> = {
      'ai-assistant': { type: 'plan', plan: 'Professional', price: 29 },
      'analytics': { type: 'plan', plan: 'Professional', price: 29 },
      'translation': { type: 'addon', price: 9 },
      'workflow': { type: 'plan', plan: 'Enterprise', price: 99 }
    };

    return pricing[extensionId] || { type: 'addon', price: 9 };
  }

  private async verifyPayment(userId: string, extensionId: string): Promise<boolean> {
    // Mock - en producción: verificar Stripe, plan activo, etc.
    return true;
  }
}

// ============================================================================
// ESCENARIO 3: Feature Rollout Gradual
// ============================================================================

/**
 * FeatureRolloutManager - Habilitar extensiones gradualmente
 */
class FeatureRolloutManager {
  constructor(private serviceGate: IServiceGate) {}

  /**
   * Rollout gradual de nueva extensión
   * Ejemplo: Habilitar para 10% → 50% → 100% de usuarios
   */
  async rolloutExtension(
    extensionId: string,
    percentage: number // 0-100
  ): Promise<RolloutResult> {
    console.log(`\n🚀 Rolling out ${extensionId} to ${percentage}% of users`);

    // 1. Obtener todos los usuarios (mock)
    const allUsers = await this.getAllUsers();

    // 2. Determinar usuarios en rollout
    const usersInRollout = allUsers.filter((userId) => {
      const hash = this.hashUserId(userId);
      return (hash % 100) < percentage;
    });

    console.log(`   Selected ${usersInRollout.length} of ${allUsers.length} users`);

    // 3. Habilitar extensión para usuarios seleccionados
    const results = await Promise.all(
      usersInRollout.map(async (userId) => {
        try {
          await this.serviceGate.setServiceEnabled(userId, extensionId, true);
          return { userId, success: true };
        } catch (error) {
          return { userId, success: false, error };
        }
      })
    );

    const successful = results.filter(r => r.success).length;

    console.log(`✅ Rollout complete: ${successful}/${usersInRollout.length} enabled`);

    return {
      targetPercentage: percentage,
      totalUsers: allUsers.length,
      targetUsers: usersInRollout.length,
      successfulEnables: successful
    };
  }

  /**
   * A/B Testing: Grupo A (control) vs Grupo B (con nueva feature)
   */
  async setupABTest(
    extensionId: string,
    testName: string
  ): Promise<ABTestSetup> {
    console.log(`\n🧪 Setting up A/B test: ${testName}`);

    const allUsers = await this.getAllUsers();

    // Split 50/50
    const groupA: string[] = [];
    const groupB: string[] = [];

    allUsers.forEach((userId) => {
      const hash = this.hashUserId(userId);
      if (hash % 2 === 0) {
        groupA.push(userId);
      } else {
        groupB.push(userId);
      }
    });

    // Grupo A: Sin extensión (control)
    for (const userId of groupA) {
      await this.serviceGate.setServiceEnabled(userId, extensionId, false);
    }

    // Grupo B: Con extensión (experimental)
    for (const userId of groupB) {
      await this.serviceGate.setServiceEnabled(userId, extensionId, true);
    }

    console.log(`✅ A/B test setup complete`);
    console.log(`   Group A (control): ${groupA.length} users - feature OFF`);
    console.log(`   Group B (experimental): ${groupB.length} users - feature ON`);

    return {
      testName,
      extensionId,
      groupA: { userIds: groupA, featureEnabled: false },
      groupB: { userIds: groupB, featureEnabled: true },
      startedAt: new Date()
    };
  }

  private async getAllUsers(): Promise<string[]> {
    // Mock - en producción: query a PostgreSQL
    return [
      'user-001', 'user-002', 'user-003', 'user-004', 'user-005',
      'user-006', 'user-007', 'user-008', 'user-009', 'user-010'
    ];
  }

  private hashUserId(userId: string): number {
    // Simple hash para distribución consistente
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// ============================================================================
// ESCENARIO 4: Trial Temporal de Extensión
// ============================================================================

/**
 * TrialManager - Gestionar trials temporales de extensiones
 */
class TrialManager {
  constructor(private serviceGate: IServiceGate) {}

  /**
   * Dar trial de extensión por tiempo limitado
   */
  async startTrial(
    userId: string,
    extensionId: string,
    durationDays: number
  ): Promise<TrialResult> {
    console.log(`\n🎁 Starting ${durationDays}-day trial of ${extensionId} for ${userId}`);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    try {
      // Habilitar con expiración
      await this.serviceGate.updateServiceConfig(userId, extensionId, {
        enabled: true,
        limits: { quota: 100 }, // Límite de trial
        metadata: {
          trial: true,
          expiresAt: expiresAt.toISOString()
        }
      });

      console.log(`✅ Trial started - expires ${expiresAt.toISOString()}`);

      return {
        success: true,
        expiresAt,
        quota: 100,
        message: `${extensionId} trial active for ${durationDays} days`
      };
    } catch (error) {
      console.error('❌ Trial start failed:', error);
      return { success: false, error: 'Failed to start trial' };
    }
  }

  /**
   * Verificar y expirar trials vencidos
   * (Ejecutar como cron job diario)
   */
  async checkExpiredTrials(): Promise<ExpirationResult> {
    console.log(`\n⏰ Checking for expired trials...`);

    // En producción: query PostgreSQL
    // SELECT user_id, service_id FROM user_capabilities
    // WHERE expires_at < NOW() AND enabled = true

    const expiredTrials = await this.getExpiredTrials();

    console.log(`   Found ${expiredTrials.length} expired trials`);

    const results = await Promise.all(
      expiredTrials.map(async ({ userId, serviceId }) => {
        try {
          // Deshabilitar extensión
          await this.serviceGate.setServiceEnabled(userId, serviceId, false);

          // Notificar usuario
          await this.notifyTrialExpired(userId, serviceId);

          console.log(`   ✅ Disabled ${serviceId} for ${userId}`);
          return { userId, serviceId, success: true };
        } catch (error) {
          console.error(`   ❌ Failed to expire ${serviceId} for ${userId}:`, error);
          return { userId, serviceId, success: false, error };
        }
      })
    );

    const successful = results.filter(r => r.success).length;

    console.log(`✅ Expiration check complete: ${successful}/${expiredTrials.length} disabled`);

    return {
      totalExpired: expiredTrials.length,
      successfulDisables: successful,
      failed: expiredTrials.length - successful
    };
  }

  private async getExpiredTrials(): Promise<Array<{ userId: string; serviceId: string }>> {
    // Mock - en producción: PostgreSQL query
    return [
      { userId: 'user-001', serviceId: 'ai-assistant' },
      { userId: 'user-003', serviceId: 'analytics' }
    ];
  }

  private async notifyTrialExpired(userId: string, serviceId: string): Promise<void> {
    // Mock - enviar email/notificación
    console.log(`   📧 Notified ${userId} about ${serviceId} trial expiration`);
  }
}

// ============================================================================
// TIPOS
// ============================================================================

interface ProcessResult {
  message: MessageEnvelopeV2;
  aiProcessed: boolean;
  error?: string;
  resetAt?: Date;
  extensionsUsed?: string[];
}

interface ExtensionResult {
  extension: string;
  success: boolean;
  skipped?: boolean;
  error?: unknown;
}

interface PipelineResult {
  originalMessage: MessageEnvelopeV2;
  processedMessage: MessageEnvelopeV2;
  extensionResults: ExtensionResult[];
}

interface MarketplaceExtension {
  id: string;
  name: string;
  description: string;
  type: string;
  version: string;
  hasAccess: boolean;
  status: 'active' | 'locked';
  reason?: string;
  executionCount: number;
  errorCount: number;
  lastUsed?: Date;
  pricing: ExtensionPricing;
}

interface ExtensionPricing {
  type: 'included' | 'plan' | 'addon';
  plan?: string;
  price: number;
}

interface EnableResult {
  success: boolean;
  error?: string;
  message?: string;
}

interface RolloutResult {
  targetPercentage: number;
  totalUsers: number;
  targetUsers: number;
  successfulEnables: number;
}

interface ABTestSetup {
  testName: string;
  extensionId: string;
  groupA: { userIds: string[]; featureEnabled: boolean };
  groupB: { userIds: string[]; featureEnabled: boolean };
  startedAt: Date;
}

interface TrialResult {
  success: boolean;
  expiresAt?: Date;
  quota?: number;
  message?: string;
  error?: string;
}

interface ExpirationResult {
  totalExpired: number;
  successfulDisables: number;
  failed: number;
}

// ============================================================================
// DEMO EXECUTION
// ============================================================================

/**
 * Demo completo del sistema
 */
async function demo() {
  // Mock instances (en producción: usar implementaciones reales)
  const serviceGate: IServiceGate = {} as any;
  const extensionRegistry: IExtensionRegistry = {} as any;

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  EXTENSION REGISTRY SYSTEM - Demo                        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  // Escenario 1: Procesar mensajes
  const processor = new MessageProcessor(serviceGate, extensionRegistry);
  // await processor.processIncomingMessage(mockMessage, 'user-premium');

  // Escenario 2: Marketplace
  const marketplace = new ExtensionMarketplace(serviceGate, extensionRegistry);
  // await marketplace.getAvailableExtensions('user-starter');

  // Escenario 3: Feature rollout
  const rollout = new FeatureRolloutManager(serviceGate);
  // await rollout.rolloutExtension('new-ai-feature', 10); // 10% rollout

  // Escenario 4: Trials
  const trials = new TrialManager(serviceGate);
  // await trials.startTrial('user-001', 'ai-assistant', 7);

  console.log('\n✅ Demo complete!');
}

// Ejecutar demo si es invocado directamente
if (import.meta.main) {
  demo().catch(console.error);
}
