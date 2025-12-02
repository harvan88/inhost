/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\implementations\v1\index.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Barrel export for v1 module"
 *
 * DEPENDENCIES:
 *   internal: []
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["ConnectionOwnerChecker","MemoryPersistence","MemoryQueue","MemoryRateLimiter","SimplePlanResolver","SimpleValidator","WebSocketNotification"]
 *   inputs: "None"
 *   outputs: "void"
 *   errors: "None"
 *
 * INTEGRATION:
 *   data_flow: "WebSocket → Handler → Store → UI"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: []
 *   critical: true
 *
 * === DOC_END :: index.ts ===
 */

/**
 * Implementaciones V1
 *
 * Implementaciones simples que funcionan AHORA sin dependencias externas.
 * Perfectas para desarrollo, testing y MVP.
 *
 * Características V1:
 * - Todo en memoria (no Redis, no DB externa)
 * - Simple y fácil de entender
 * - Funcional y probado
 * - Lista para usar HOY
 *
 * Limitaciones V1:
 * - No persistente (se pierde al reiniciar)
 * - No distribuido (solo un proceso)
 * - Sin características avanzadas
 *
 * Próximos pasos:
 * - V2: Redis para persistencia y distribución
 * - V3: Características empresariales completas
 *
 * @module implementations/v1
 */

export { MemoryRateLimiter } from './MemoryRateLimiter';
export { MemoryQueue } from './MemoryQueue';
export { SimpleValidator } from './SimpleValidator';

// New services (Sprint 1.5)
export { MemoryPersistence } from './MemoryPersistence';
export { WebSocketNotification } from './WebSocketNotification';
export { SimplePlanResolver } from './SimplePlanResolver';
export { ConnectionOwnerChecker } from './ConnectionOwnerChecker';
