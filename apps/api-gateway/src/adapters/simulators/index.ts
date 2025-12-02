/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\adapters\simulators\index.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Barrel export for simulators module"
 *
 * DEPENDENCIES:
 *   internal: []
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["SimulatedSMSAdapter","SimulatedTelegramAdapter","SimulatedWhatsAppAdapter"]
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
 * Simulated Adapters
 *
 * Implementaciones V1 de adapters que simulan conexiones reales
 * sin necesidad de APIs externas.
 *
 * Útil para:
 * - Desarrollo local sin credenciales
 * - Testing de flujos
 * - Demostración del sistema
 *
 * @module adapters/simulators
 */

export { SimulatedWhatsAppAdapter } from './SimulatedWhatsAppAdapter';
export { SimulatedTelegramAdapter } from './SimulatedTelegramAdapter';
export { SimulatedSMSAdapter } from './SimulatedSMSAdapter';
