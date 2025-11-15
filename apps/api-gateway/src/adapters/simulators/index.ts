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
