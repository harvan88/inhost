/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "apps/api-gateway/src/services/index.ts"
 *   type: "service"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Agregador de servicios singleton: inicializa y exporta adapterManager, rateLimiter, messageCore, notifications, y otros servicios core"
 *
 * DEPENDENCIES:
 *   internal: ["@inhost/shared", "../adapters/manager", "../implementations/v1", "../implementations/v2", "../core/MessageCore", "../middleware/logger", "../config/redis"]
 *   external: []
 *   infrastructure: ["redis"]
 *
 * CONTRACTS:
 *   exports: ["adapterManager", "rateLimiter", "messageQueue", "validator", "persistence", "notifications", "planResolver", "ownerChecker", "messageCore", "extensionHost", "initializeServices", "shutdownServices"]
 *   inputs: []
 *   outputs: ["ServiceSingletons"]
 *   errors: []
 *
 * INTEGRATION:
 *   data_flow: "[App startup] → [initializeServices] → [Service singletons] → [Route handlers + WebSocket]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["src/index.ts", "routes/*", "routes/websocket.ts"]
 *   uses: ["adapters", "implementations", "core/MessageCore", "config"]
 *   critical: true
 *
 * === DOC_END :: index.ts ===
 */

import { MessageChannel } from '@inhost/shared';
/**
 * Services - Servicios centralizados del sistema
 *
 * Este módulo inicializa y exporta todos los servicios core del sistema.
 * Usa el patrón Singleton para garantizar una única instancia de cada servicio.
 *
 * Cambiar de V1 a V2 = cambiar las importaciones aquí (1 línea por servicio)
 *
 * @module services
 */

import { AdapterManager } from '../adapters/manager';
import {
  SimulatedWhatsAppAdapter,
  SimulatedTelegramAdapter,
  SimulatedSMSAdapter
} from '../adapters/simulators';
import {
  MemoryRateLimiter,
  MemoryQueue,
  SimpleValidator,
  MemoryPersistence,
  WebSocketNotification,
  SimplePlanResolver,
  ConnectionOwnerChecker
} from '../implementations/v1';
import { RedisRateLimiter, DatabasePersistence } from '../implementations/v2';
import { MessageCore } from '../core/MessageCore';
import { logger } from '../middleware/logger';
import { shouldUseRedis, checkRedisConnection } from '../config/redis';
import { startAuthRateLimitCleanup } from '../middleware/auth-rate-limit';
import {
  ExtensionHost,
  SentimentExtension,
  KeywordExtension,
} from '../extensions';

/**
 * Adapter Manager - Gestión centralizada de adaptadores
 */
export const adapterManager = new AdapterManager();

/**
 * Rate Limiter - Control de tasa
 * V1 (memory) o V2 (Redis) según RATE_LIMIT_BACKEND env var
 */
export const rateLimiter = shouldUseRedis()
  ? new RedisRateLimiter()
  : new MemoryRateLimiter();

/**
 * Message Queue V1 - Cola en memoria
 */
export const messageQueue = new MemoryQueue();

/**
 * Validator V1 - Validación simple
 */
export const validator = new SimpleValidator();

/**
 * Persistence V2 - Almacenamiento en PostgreSQL
 * CRÍTICO: DatabasePersistence persiste mensajes en PostgreSQL (producción)
 * Para desarrollo/testing, usar MemoryPersistence si es necesario
 */
export const persistence = new DatabasePersistence();

/**
 * Notification V1 - WebSocket broadcast
 */
export const notifications = new WebSocketNotification();

/**
 * Plan Resolver V1 - Planes estáticos
 */
export const planResolver = new SimplePlanResolver();

/**
 * Owner Checker V1 - Verificación de presencia
 */
export const ownerChecker = new ConnectionOwnerChecker();

/**
 * MESSAGE CORE - Núcleo de mensajería (orquestador ligero)
 */
export const messageCore = new MessageCore(
  persistence,
  notifications,
  planResolver,
  ownerChecker,
  adapterManager
);

/**
 * Extension Host - Orquestador de extensiones
 * Gestiona el ciclo de vida y ejecución de extensiones de enriquecimiento
 */
export const extensionHost = new ExtensionHost();

/**
 * Inicializar todos los servicios
 */
export async function initializeServices(): Promise<void> {
  logger.info('🔧 Initializing services...');

  // 0. Verificar Redis si está configurado
  const usingRedis = shouldUseRedis();
  if (usingRedis) {
    logger.info('🔴 Redis backend configured - checking connection...');
    const redisOk = await checkRedisConnection();
    if (!redisOk) {
      logger.error('❌ Redis connection failed - rate limiter will fallback to allow mode');
    } else {
      logger.info('✅ Redis connection successful');
    }
  }

  // 1. Registrar adaptadores simulados
  const whatsapp = new SimulatedWhatsAppAdapter();
  const telegram = new SimulatedTelegramAdapter();
  const sms = new SimulatedSMSAdapter();

  adapterManager.register(whatsapp);
  adapterManager.register(telegram);
  adapterManager.register(sms);

  // 2. Inicializar adaptadores
  await adapterManager.initializeAll();

  // 3. Iniciar rate limiter cleanup
  rateLimiter.startCleanup();

  // 4. Iniciar auth rate limit cleanup
  startAuthRateLimitCleanup();

  // 5. Iniciar owner checker cleanup
  ownerChecker.startAutoCleanup(5);

  // 6. Iniciar adaptadores
  await adapterManager.startAll();

  // 7. Configurar queue auto-reset
  messageQueue.startAutoReset();

  // 8. Inicializar Extension Host con extensiones builtin
  extensionHost.register(new SentimentExtension());
  extensionHost.register(new KeywordExtension());

  // 9. Conectar Extension Host al Message Core
  messageCore.setExtensionHost(extensionHost);

  logger.info('✅ Services initialized successfully', {
    adapters: ['whatsapp', 'telegram', 'sms'],
    rateLimiter: usingRedis ? 'RedisRateLimiter (V2)' : 'MemoryRateLimiter (V1)',
    queue: 'MemoryQueue (V1)',
    validator: 'SimpleValidator (V1)',
    persistence: 'DatabasePersistence (V2) - PostgreSQL',
    notifications: 'WebSocketNotification (V1)',
    planResolver: 'SimplePlanResolver (V1)',
    ownerChecker: 'ConnectionOwnerChecker (V1)',
    messageCore: 'MessageCore (initialized)',
    extensionHost: `ExtensionHost (${extensionHost.getStats().totalExtensions} extensions)`
  });

  // Health check inicial
  const health = await adapterManager.healthCheckAll();
  logger.info('🏥 Adapters health check', {
    whatsapp: health.get(MessageChannel.WHATSAPP),
    telegram: health.get(MessageChannel.TELEGRAM),
    sms: health.get(MessageChannel.SMS)
  });

  // Stats de MessageCore
  const coreStats = await messageCore.getStats();
  logger.info('📊 MessageCore stats', coreStats);

  // Stats de ExtensionHost
  const extStats = extensionHost.getStats();
  logger.info('🧩 ExtensionHost stats', { ...extStats });

  // Health check de extensiones
  const extHealth = await extensionHost.healthCheck();
  logger.info('🏥 Extensions health check', Object.fromEntries(extHealth));
}

/**
 * Detener todos los servicios (útil para shutdown graceful)
 */
export async function shutdownServices(): Promise<void> {
  logger.info('🛑 Shutting down services...');

  await adapterManager.stopAll();
  await messageQueue.clear();

  logger.info('✅ Services shut down successfully');
}
