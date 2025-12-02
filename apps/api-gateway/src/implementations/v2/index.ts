/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\implementations\v2\index.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Barrel export for v2 module"
 *
 * DEPENDENCIES:
 *   internal: []
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["DatabasePersistence","RedisRateLimiter"]
 *   inputs: "None"
 *   outputs: "void"
 *   errors: "None"
 *
 * INTEGRATION:
 *   data_flow: "Input → Processing → Output"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: []
 *   critical: false
 *
 * === DOC_END :: index.ts ===
 */

/**
 * V2 Implementations (Sprint 4)
 *
 * Implementaciones persistentes con Redis/PostgreSQL.
 * Resuelven limitaciones de V1 (race conditions, pérdida de datos).
 */

export { RedisRateLimiter } from './RedisRateLimiter';
export { DatabasePersistence } from './DatabasePersistence';
