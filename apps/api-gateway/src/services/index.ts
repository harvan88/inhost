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
import { MessageCore } from '../core/MessageCore';
import { logger } from '../middleware/logger';

/**
 * Adapter Manager - Gestión centralizada de adaptadores
 */
export const adapterManager = new AdapterManager();

/**
 * Rate Limiter V1 - Control de tasa en memoria
 */
export const rateLimiter = new MemoryRateLimiter();

/**
 * Message Queue V1 - Cola en memoria
 */
export const messageQueue = new MemoryQueue();

/**
 * Validator V1 - Validación simple
 */
export const validator = new SimpleValidator();

/**
 * Persistence V1 - Almacenamiento en memoria
 */
export const persistence = new MemoryPersistence();

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
 * Inicializar todos los servicios
 */
export async function initializeServices(): Promise<void> {
  logger.info('🔧 Initializing services...');

  // 1. Registrar adaptadores simulados
  const whatsapp = new SimulatedWhatsAppAdapter();
  const telegram = new SimulatedTelegramAdapter();
  const sms = new SimulatedSMSAdapter();

  adapterManager.register(whatsapp);
  adapterManager.register(telegram);
  adapterManager.register(sms);

  // 2. Inicializar adaptadores
  await adapterManager.initializeAll();

  // 3. Iniciar adaptadores
  await adapterManager.startAll();

  // 4. Configurar rate limiter
  rateLimiter.startCleanup();

  // 5. Configurar queue
  messageQueue.startAutoReset();

  // 6. Configurar owner checker
  ownerChecker.startAutoCleanup(5); // Limpieza cada 5 minutos

  logger.info('✅ Services initialized successfully', {
    adapters: ['whatsapp', 'telegram', 'sms'],
    rateLimiter: 'MemoryRateLimiter (V1)',
    queue: 'MemoryQueue (V1)',
    validator: 'SimpleValidator (V1)',
    persistence: 'MemoryPersistence (V1)',
    notifications: 'WebSocketNotification (V1)',
    planResolver: 'SimplePlanResolver (V1)',
    ownerChecker: 'ConnectionOwnerChecker (V1)',
    messageCore: 'MessageCore (initialized)'
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
