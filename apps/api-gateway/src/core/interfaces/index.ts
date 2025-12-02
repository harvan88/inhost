/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\core\interfaces\index.ts"
 *   type: "type"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Barrel export for interfaces module"
 *
 * DEPENDENCIES:
 *   internal: []
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: []
 *   inputs: "None"
 *   outputs: "void"
 *   errors: "ValidationError"
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
 * Core Interfaces - Contratos que NUNCA cambian
 *
 * Estas interfaces definen los contratos fundamentales del sistema.
 * Las implementaciones pueden evolucionar (V1 → V2 → V3), pero los contratos permanecen estables.
 *
 * @module core/interfaces
 */

// Adapter
export type {
  IAdapter,
  SendResult,
  AdapterConfig
} from './IAdapter';

// Rate Limiter
export type {
  IRateLimiter,
  Plan,
  RateLimitResult,
  RateLimiterConfig
} from './IRateLimiter';

// Message Queue
export type {
  IMessageQueue,
  QueueStats,
  MessageQueueConfig
} from './IMessageQueue';

// Validator
export type {
  IValidator,
  ValidationResult,
  ValidationError,
  ValidationRules
} from './IValidator';

// Persistence Service
export type {
  IPersistenceService,
  PersistenceResult,
  MessageQuery
} from './IPersistenceService';

// Notification Service
export type {
  INotificationService,
  NotificationTarget,
  StatusUpdate,
  TypingIndicator
} from './INotificationService';

// Plan Resolver
export type {
  IPlanResolver,
  PlanCapabilities,
  PlanInfo
} from './IPlanResolver';

// Owner Checker
export type {
  IOwnerChecker,
  DeviceInfo,
  OwnerPresence
} from './IOwnerChecker';
