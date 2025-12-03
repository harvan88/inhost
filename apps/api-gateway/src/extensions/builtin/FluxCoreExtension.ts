/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/extensions/builtin/FluxCoreExtension.ts"
 *   type: "service"
 *   layer: "backend"
 *   domain: "extensions"
 *   purpose: "Extensión builtin que genera respuestas automáticas usando IA, verificando permisos, límites de uso y modo de operación (auto/pre-aprobación)"
 *
 * DEPENDENCIES:
 *   internal: ["../interfaces/IExtension", "../types", "../../middleware/logger"]
 *   external: []
 *   infrastructure: ["OPENAI_API_KEY env variable"]
 *
 * CONTRACTS:
 *   exports: ["FluxCoreExtension", "FluxCoreConfig"]
 *   inputs: ["ExtensionContext", "FluxCoreConfig"]
 *   outputs: ["ExtensionResult with AIResponsePayload"]
 *   errors: ["FLUXCORE_ERROR"]
 *
 * INTEGRATION:
 *   data_flow: "[ExtensionHost] → [FluxCoreExtension.process] → [AI API] → [AIResponsePayload with response/draft]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["services/index.ts", "extensions/builtin/index.ts"]
 *   uses: ["../interfaces/IExtension", "../types", "../../middleware/logger"]
 *   critical: true
 *
 * === DOC_END :: FluxCoreExtension.ts ===
 */

/**
 * FluxCore AI Extension
 *
 * Genera respuestas automáticas usando IA.
 *
 * Flujo:
 * 1. Recibe mensaje con metadata
 * 2. Verifica permisos del usuario
 * 3. Verifica límite disponible
 * 4. Si autorizado: genera respuesta automática
 * 5. Si pre-aprobación: genera draft para editar/aprobar
 */

import type { IExtension } from '../interfaces/IExtension';
import type { ExtensionMeta, ExtensionContext, ExtensionResult, AIResponsePayload } from '../types';
import { logger } from '../../middleware/logger';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface FluxCoreConfig {
  /** Límite de mensajes por usuario/día */
  dailyLimit: number;
  /** Si requiere pre-aprobación por defecto */
  requirePreApproval: boolean;
  /** Modelo de IA a usar */
  model: string;
  /** API Key (desde env) */
  apiKey?: string;
  /** System prompt base */
  systemPrompt: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXTENSION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class FluxCoreExtension implements IExtension {
  readonly meta: ExtensionMeta = {
    id: 'builtin:fluxcore',
    name: 'FluxCore AI Assistant',
    version: '1.0.0',
    description: 'Genera respuestas automáticas con IA, verificando permisos y límites',
    category: 'ai',
  };

  readonly timeout = 10000; // 10s para llamadas a IA

  private config: FluxCoreConfig;
  
  // Cache simple de uso por usuario (en producción: Redis/DB)
  private usageCache = new Map<string, { count: number; date: string }>();

  constructor(config?: Partial<FluxCoreConfig>) {
    this.config = {
      dailyLimit: config?.dailyLimit ?? 50,
      requirePreApproval: config?.requirePreApproval ?? false,
      model: config?.model ?? 'gpt-3.5-turbo',
      apiKey: config?.apiKey ?? process.env.OPENAI_API_KEY,
      systemPrompt: config?.systemPrompt ?? 
        'Eres un asistente útil y profesional. Responde de forma concisa y clara.',
    };
  }

  async process(context: ExtensionContext): Promise<ExtensionResult> {
    const startTime = Date.now();
    
    try {
      // Solo procesar mensajes entrantes
      if (context.type !== 'incoming') {
        return this.createBlockedResult(startTime, 'Solo se procesan mensajes entrantes');
      }

      // 1. Verificar permisos
      const permissionCheck = await this.checkPermissions(context);
      if (!permissionCheck.allowed) {
        return this.createBlockedResult(startTime, permissionCheck.reason);
      }

      // 2. Verificar límites
      const limitCheck = this.checkLimits(context);
      if (!limitCheck.allowed) {
        return this.createBlockedResult(startTime, limitCheck.reason, 0);
      }

      // 3. Determinar modo (auto vs pre-approval)
      const mode = this.determineMode(context);

      // 4. Generar respuesta con IA
      const aiResponse = await this.generateResponse(context);
      
      // 5. Actualizar uso
      this.updateUsage(context);

      return this.createSuccessResult(startTime, {
        mode,
        response: aiResponse.text,
        remainingLimit: limitCheck.remaining - 1,
        model: this.config.model,
        tokensUsed: aiResponse.tokensUsed,
      });

    } catch (error) {
      logger.error('❌ FluxCoreExtension error', {
        error: error instanceof Error ? error.message : 'Unknown',
        messageId: context.messageId,
      });

      return {
        ok: false,
        error: {
          code: 'FLUXCORE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true,
        },
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    // TODO: Verificar conexión con API de IA
    return true;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HELPERS PRIVADOS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private async checkPermissions(context: ExtensionContext): Promise<{ allowed: boolean; reason?: string }> {
    // TODO: Implementar verificación real de permisos
    // Por ahora: permitir todos
    
    // Ejemplo de lógica futura:
    // const user = await getUserById(context.from);
    // if (!user.hasAIAccess) return { allowed: false, reason: 'Usuario sin acceso a IA' };
    
    return { allowed: true };
  }

  private checkLimits(context: ExtensionContext): { allowed: boolean; remaining: number; reason?: string } {
    const userId = context.from; // Usar 'from' como identificador de usuario
    const today = new Date().toISOString().split('T')[0];
    
    const usage = this.usageCache.get(userId);
    
    // Reset si es nuevo día
    if (!usage || usage.date !== today) {
      return { allowed: true, remaining: this.config.dailyLimit };
    }

    const remaining = this.config.dailyLimit - usage.count;
    
    if (remaining <= 0) {
      return { 
        allowed: false, 
        remaining: 0,
        reason: `Límite diario alcanzado (${this.config.dailyLimit} mensajes)`,
      };
    }

    return { allowed: true, remaining };
  }

  private determineMode(context: ExtensionContext): 'auto' | 'pre-approval' {
    // Por config global
    if (this.config.requirePreApproval) {
      return 'pre-approval';
    }

    // Por defecto: automático
    return 'auto';
  }

  private async generateResponse(context: ExtensionContext): Promise<{ text: string; tokensUsed: number }> {
    // TODO: Integrar con OpenAI/Claude real
    // Por ahora: respuesta simulada
    
    const userMessage = context.text || '';
    
    // Simulación (reemplazar con llamada real a API)
    const simulatedResponse = this.simulateAIResponse(userMessage);
    
    return {
      text: simulatedResponse,
      tokensUsed: Math.floor(userMessage.length * 1.5),
    };
  }

  private simulateAIResponse(message: string): string {
    // Respuestas simuladas para desarrollo
    const responses = [
      'Gracias por tu mensaje. ¿En qué más puedo ayudarte?',
      'Entiendo tu consulta. Déjame verificar eso para ti.',
      'Claro, estaré encantado de asistirte con eso.',
      'He recibido tu mensaje. Procesando tu solicitud...',
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private updateUsage(context: ExtensionContext): void {
    const userId = context.from;
    const today = new Date().toISOString().split('T')[0];
    
    const usage = this.usageCache.get(userId);
    
    if (!usage || usage.date !== today) {
      this.usageCache.set(userId, { count: 1, date: today });
    } else {
      usage.count++;
    }
  }

  private createSuccessResult(startTime: number, payload: AIResponsePayload): ExtensionResult {
    return {
      ok: true,
      enrichment: {
        messageId: '', // Será llenado por el host
        extensionId: this.meta.id,
        tenantId: '', // Será llenado por el host
        type: 'ai_response',
        payload,
        confidence: 1.0,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  private createBlockedResult(startTime: number, reason?: string, remainingLimit?: number): ExtensionResult {
    const payload: AIResponsePayload = {
      mode: 'blocked',
      reason,
      remainingLimit,
    };

    return {
      ok: true,
      enrichment: {
        messageId: '',
        extensionId: this.meta.id,
        tenantId: '',
        type: 'ai_response',
        payload,
        confidence: 1.0,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }
}
