/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/extensions/host/ExtensionHost.ts"
 *   type: "service"
 *   layer: "backend"
 *   domain: "extensions"
 *   purpose: "Implementación del Host de Extensiones que orquesta el registro, ejecución paralela con timeout, aislamiento de fallos y agregación de resultados de extensiones"
 *
 * DEPENDENCIES:
 *   internal: ["../types", "../interfaces/IExtension", "../interfaces/IExtensionHost", "../../middleware/logger"]
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["ExtensionHost"]
 *   inputs: ["IExtension", "ExtensionContext"]
 *   outputs: ["ProcessingResult", "ExtensionHostStats"]
 *   errors: ["TIMEOUT", "EXECUTION_ERROR"]
 *
 * INTEGRATION:
 *   data_flow: "[MessageCore.receive] → [ExtensionHost.processMessage] → [Enrichments] → [Persistence/WebSocket]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["services/index.ts"]
 *   uses: ["../interfaces/IExtension", "../types", "../../middleware/logger"]
 *   critical: true
 *
 * === DOC_END :: ExtensionHost.ts ===
 */

import { randomUUID } from 'crypto';
import type { IExtension } from '../interfaces/IExtension';
import type {
  IExtensionHost,
  ProcessingResult,
  ExtensionHostStats,
} from '../interfaces/IExtensionHost';
import type { ExtensionContext, Enrichment, ExtensionResult } from '../types';
import { logger } from '../../middleware/logger';

/**
 * Implementación del Host de Extensiones
 *
 * Responsabilidades:
 * - Registrar/desregistrar extensiones
 * - Ejecutar extensiones en paralelo con timeout
 * - Aislar fallos por extensión
 * - Agregar resultados
 * - Mantener estadísticas
 */
export class ExtensionHost implements IExtensionHost {
  /** Extensiones registradas (id → extension) */
  private extensions: Map<string, IExtension> = new Map();

  /** Estadísticas internas */
  private stats = {
    totalProcessed: 0,
    totalErrors: 0,
    processingTimes: [] as number[],
  };

  /** Máximo de tiempos a mantener para el promedio */
  private readonly MAX_PROCESSING_TIMES = 100;

  /**
   * Registra una extensión en el host
   */
  register(extension: IExtension): void {
    const { id, name, version } = extension.meta;

    if (this.extensions.has(id)) {
      logger.warn(`⚠️ Extension ${id} already registered, replacing`, {
        oldVersion: this.extensions.get(id)?.meta.version,
        newVersion: version,
      });
    }

    this.extensions.set(id, extension);

    logger.info(`✅ Extension registered: ${name} (${id}) v${version}`, {
      category: extension.meta.category,
      timeout: extension.timeout,
    });
  }

  /**
   * Desregistra una extensión del host
   */
  unregister(extensionId: string): void {
    const extension = this.extensions.get(extensionId);

    if (extension) {
      this.extensions.delete(extensionId);
      logger.info(`🗑️ Extension unregistered: ${extension.meta.name} (${extensionId})`);
    }
  }

  /**
   * Obtiene extensiones habilitadas para un tenant
   * MVP: retorna todas las extensiones registradas
   * TODO: Filtrar por configuración de tenant desde DB
   */
  async getEnabledExtensions(tenantId: string): Promise<IExtension[]> {
    // MVP: todas las extensiones están habilitadas para todos los tenants
    // Futuro: consultar tenant_extensions en DB
    logger.debug(`Getting enabled extensions for tenant ${tenantId}`, {
      totalAvailable: this.extensions.size,
    });

    return Array.from(this.extensions.values());
  }

  /**
   * Procesa un mensaje con todas las extensiones habilitadas
   */
  async processMessage(context: ExtensionContext): Promise<ProcessingResult> {
    const startTime = Date.now();
    const enrichments: Enrichment[] = [];
    const errors: ProcessingResult['errors'] = [];

    logger.info(`🔧 ExtensionHost: Processing message`, {
      messageId: context.messageId,
      tenantId: context.tenantId,
      textLength: context.text.length,
    });

    // 1. Obtener extensiones habilitadas para este tenant
    const enabledExtensions = await this.getEnabledExtensions(context.tenantId);

    if (enabledExtensions.length === 0) {
      logger.debug('No extensions enabled for tenant', {
        tenantId: context.tenantId,
      });

      return {
        messageId: context.messageId,
        enrichments: [],
        errors: [],
        totalTimeMs: Date.now() - startTime,
      };
    }

    // 2. Ejecutar todas las extensiones en PARALELO con timeout
    const results = await Promise.allSettled(
      enabledExtensions.map((extension) =>
        this.executeWithTimeout(extension, context)
      )
    );

    // 3. Agregar resultados
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const extension = enabledExtensions[i];

      if (result.status === 'fulfilled') {
        const { value } = result;

        if ('enrichment' in value) {
          enrichments.push(value.enrichment);
        } else if ('error' in value) {
          errors.push({
            extensionId: value.extensionId,
            error: value.error.message,
            recoverable: value.error.recoverable,
          });
          this.stats.totalErrors++;
        }
      } else {
        // Promise rejected (no debería ocurrir con nuestro try/catch)
        logger.error('Extension promise rejected unexpectedly', {
          extensionId: extension.meta.id,
          reason: result.reason,
        });

        errors.push({
          extensionId: extension.meta.id,
          error: result.reason?.message || 'Unknown error',
          recoverable: true,
        });
        this.stats.totalErrors++;
      }
    }

    // 4. Actualizar estadísticas
    const totalTimeMs = Date.now() - startTime;
    this.stats.totalProcessed++;
    this.stats.processingTimes.push(totalTimeMs);

    // Mantener solo los últimos N tiempos para el promedio
    if (this.stats.processingTimes.length > this.MAX_PROCESSING_TIMES) {
      this.stats.processingTimes.shift();
    }

    logger.info(`✅ ExtensionHost: Processing complete`, {
      messageId: context.messageId,
      enrichmentsCount: enrichments.length,
      errorsCount: errors.length,
      totalTimeMs,
    });

    return {
      messageId: context.messageId,
      enrichments,
      errors,
      totalTimeMs,
    };
  }

  /**
   * Ejecuta una extensión con timeout
   * Retorna resultado o error, nunca lanza excepción
   */
  private async executeWithTimeout(
    extension: IExtension,
    context: ExtensionContext
  ): Promise<
    | { enrichment: Enrichment }
    | { extensionId: string; error: { message: string; recoverable: boolean } }
  > {
    const { id: extensionId, name } = extension.meta;
    const extStartTime = Date.now();

    try {
      // Crear promesa con timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('TIMEOUT'));
        }, extension.timeout);
      });

      // Race entre ejecución y timeout
      const result = (await Promise.race([
        extension.process(context),
        timeoutPromise,
      ])) as ExtensionResult;

      const processingTimeMs = Date.now() - extStartTime;

      if (result.ok) {
        // Construir enrichment completo con ID y timestamp
        const enrichment: Enrichment = {
          ...result.enrichment,
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          processingTimeMs,
        };

        logger.debug(`Extension ${name} produced enrichment`, {
          extensionId,
          type: enrichment.type,
          processingTimeMs,
        });

        return { enrichment };
      } else {
        // La extensión retornó error explícito
        logger.warn(`Extension ${name} returned error`, {
          extensionId,
          error: result.error,
          processingTimeMs,
        });

        return {
          extensionId,
          error: {
            message: result.error.message,
            recoverable: result.error.recoverable,
          },
        };
      }
    } catch (error) {
      // Error de timeout o excepción no manejada
      const isTimeout = error instanceof Error && error.message === 'TIMEOUT';
      const processingTimeMs = Date.now() - extStartTime;

      logger.error(`Extension ${name} ${isTimeout ? 'timed out' : 'threw exception'}`, {
        extensionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs,
        timeout: extension.timeout,
      });

      return {
        extensionId,
        error: {
          message: isTimeout
            ? `Extension timed out after ${extension.timeout}ms`
            : error instanceof Error
              ? error.message
              : 'Unknown error',
          recoverable: true,
        },
      };
    }
  }

  /**
   * Obtiene estadísticas del host
   */
  getStats(): ExtensionHostStats {
    const avgTime =
      this.stats.processingTimes.length > 0
        ? this.stats.processingTimes.reduce((a, b) => a + b, 0) /
          this.stats.processingTimes.length
        : 0;

    return {
      totalExtensions: this.extensions.size,
      activeExtensions: this.extensions.size, // MVP: todas activas
      totalProcessed: this.stats.totalProcessed,
      totalErrors: this.stats.totalErrors,
      averageProcessingTimeMs: Math.round(avgTime),
    };
  }

  /**
   * Ejecuta health check de todas las extensiones
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    const checks = Array.from(this.extensions.entries()).map(
      async ([id, extension]) => {
        try {
          const healthy = await Promise.race([
            extension.healthCheck(),
            new Promise<boolean>((_, reject) =>
              setTimeout(() => reject(new Error('Health check timeout')), 1000)
            ),
          ]);
          results.set(id, healthy);
        } catch {
          results.set(id, false);
        }
      }
    );

    await Promise.allSettled(checks);

    return results;
  }

  /**
   * Lista todas las extensiones registradas (para debugging/admin)
   */
  listExtensions(): Array<{
    id: string;
    name: string;
    version: string;
    category: string;
  }> {
    return Array.from(this.extensions.values()).map((ext) => ({
      id: ext.meta.id,
      name: ext.meta.name,
      version: ext.meta.version,
      category: ext.meta.category,
    }));
  }
}
