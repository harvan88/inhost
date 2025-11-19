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

// Capability-based system (replaces hardcoded plans)
export { CapabilityBasedServiceGate } from './CapabilityBasedServiceGate';
export { PlanToCapabilityAdapter } from './PlanToCapabilityAdapter';
