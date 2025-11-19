/**
 * Ejemplo de uso del sistema ServiceGate + Extensiones
 *
 * Este archivo demuestra cómo usar el nuevo sistema de capacidades
 * y extensiones en lugar de planes hardcodeados.
 */

import { Elysia } from 'elysia';
import {
  CapabilityBasedServiceGate,
  PlanToCapabilityAdapter,
  MemoryPersistence,
  WebSocketNotification,
  ConnectionOwnerChecker
} from '../apps/api-gateway/src/implementations/v1';
import { MessageCore } from '../apps/api-gateway/src/core/MessageCore';
import { AdapterManager } from '../apps/api-gateway/src/adapters/manager';
import { rateLimitingV2 } from '../apps/api-gateway/src/middleware/rateLimitingV2';
import { AIAssistantExtension, AnalyticsExtension } from '../apps/api-gateway/src/extensions';

// ============================================================================
// 1. CREAR SERVICE GATE
// ============================================================================

const serviceGate = new CapabilityBasedServiceGate();

// Configurar templates personalizados (opcional)
// Por defecto ya tiene: starter, professional, enterprise

// ============================================================================
// 2. CONFIGURAR USUARIOS CON CAPACIDADES
// ============================================================================

async function setupUsers() {
  // Usuario 1: Template básico
  await serviceGate.applyTemplate('user-basic', 'starter');

  // Usuario 2: Template profesional
  await serviceGate.applyTemplate('user-pro', 'professional');

  // Usuario 3: Configuración customizada
  await serviceGate.applyTemplate('user-custom', 'starter');
  await serviceGate.setServiceEnabled('user-custom', 'ai-assistant', true);
  await serviceGate.updateServiceConfig('user-custom', 'rate-limiting', {
    enabled: true,
    limits: { rateLimit: 50 } // Custom: 50 req/min
  });

  // Usuario 4: Trial de AI (7 días)
  await serviceGate.applyTemplate('user-trial', 'starter');
  await serviceGate.updateServiceConfig('user-trial', 'ai-assistant', {
    enabled: true,
    limits: { quota: 100 },
    metadata: {
      trial: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  console.log('✅ Users configured with capabilities');
}

// ============================================================================
// 3. CONFIGURAR EXTENSIONES
// ============================================================================

async function setupExtensions() {
  // Crear extensiones
  const aiExtension = new AIAssistantExtension();
  const analyticsExtension = new AnalyticsExtension();

  // Inicializar
  await aiExtension.initialize({
    enabled: true,
    priority: 'high',
    settings: {
      model: 'gpt-4',
      temperature: 0.7
    }
  });

  await analyticsExtension.initialize({
    enabled: true,
    priority: 'normal'
  });

  console.log('✅ Extensions initialized');

  return { aiExtension, analyticsExtension };
}

// ============================================================================
// 4. CREAR MESSAGE CORE CON SERVICE GATE
// ============================================================================

async function createMessageCore() {
  const persistence = new MemoryPersistence();
  const notifications = new WebSocketNotification();
  const ownerChecker = new ConnectionOwnerChecker();
  const adapters = new AdapterManager();

  // Crear adapter de compatibilidad (para código legacy)
  const planResolver = new PlanToCapabilityAdapter(serviceGate);

  // Crear MessageCore con ServiceGate
  const messageCore = new MessageCore(
    persistence,
    notifications,
    planResolver,
    ownerChecker,
    adapters,
    serviceGate // ← Inyectar ServiceGate
  );

  // Activar uso de ServiceGate
  messageCore.configure({
    useServiceGate: true
  });

  console.log('✅ MessageCore created with ServiceGate');

  return messageCore;
}

// ============================================================================
// 5. CREAR SERVIDOR CON RATE LIMITING V2
// ============================================================================

function createServer() {
  const app = new Elysia()
    // Rate limiting basado en capacidades (V2)
    .use(rateLimitingV2({
      serviceGate,
      getUserId: (req) => req.headers.get('x-user-id') || 'anonymous'
    }))

    // Ruta de prueba
    .post('/messages', async ({ request }) => {
      const userId = request.headers.get('x-user-id') || 'anonymous';

      // Verificar si puede usar AI
      const aiCheck = await serviceGate.canUseService(userId, 'ai-assistant');

      return {
        success: true,
        message: 'Message received',
        capabilities: {
          aiAvailable: aiCheck.allowed,
          aiReason: aiCheck.reason
        }
      };
    })

    // Endpoint de capacidades
    .get('/me/capabilities', async ({ request }) => {
      const userId = request.headers.get('x-user-id') || 'anonymous';
      const capabilities = await serviceGate.getUserCapabilities(userId);

      return {
        userId: capabilities.userId,
        services: Object.fromEntries(capabilities.services)
      };
    })

    // Endpoint de uso
    .get('/me/usage', async ({ request }) => {
      const userId = request.headers.get('x-user-id') || 'anonymous';
      const stats = await serviceGate.getUsageStats(userId);

      return {
        userId,
        services: Object.fromEntries(stats.services),
        globalUsage: stats.globalUsage
      };
    });

  console.log('✅ Server created with capability-based routing');

  return app;
}

// ============================================================================
// 6. EJEMPLOS DE USO PROGRAMÁTICO
// ============================================================================

async function examples() {
  console.log('\n📚 EJEMPLOS DE USO:\n');

  // Ejemplo 1: Verificar si usuario puede usar un servicio
  const canUseAI = await serviceGate.canUseService('user-custom', 'ai-assistant');
  console.log('1️⃣  ¿user-custom puede usar AI?', canUseAI.allowed);

  // Ejemplo 2: Obtener configuración de un servicio
  const rateLimitConfig = await serviceGate.getServiceConfig('user-custom', 'rate-limiting');
  console.log('2️⃣  Rate limit de user-custom:', rateLimitConfig?.limits?.rateLimit);

  // Ejemplo 3: Registrar uso
  await serviceGate.recordServiceUsage('user-custom', 'ai-assistant', 1);
  console.log('3️⃣  Uso de AI registrado');

  // Ejemplo 4: Obtener estadísticas de uso
  const usage = await serviceGate.getServiceUsage('user-custom', 'ai-assistant');
  console.log('4️⃣  Uso actual de AI:', usage.current, '/', usage.limit);

  // Ejemplo 5: Habilitar servicio temporalmente
  await serviceGate.setServiceEnabled('user-basic', 'analytics', true);
  console.log('5️⃣  Analytics habilitado para user-basic');

  // Ejemplo 6: Actualizar límite dinámicamente
  await serviceGate.updateServiceConfig('user-pro', 'rate-limiting', {
    enabled: true,
    limits: { rateLimit: 100 } // Aumentar a 100/min
  });
  console.log('6️⃣  Rate limit de user-pro actualizado a 100/min');

  // Ejemplo 7: Migrar usuario de plan legacy
  const adapter = new PlanToCapabilityAdapter(serviceGate);
  await adapter.updatePlan('legacy-user', 'premium');
  console.log('7️⃣  Usuario legacy migrado a "premium" (→ professional template)');
}

// ============================================================================
// MAIN: INICIAR TODO
// ============================================================================

async function main() {
  console.log('🚀 Iniciando sistema ServiceGate + Extensiones\n');

  // Setup
  await setupUsers();
  const extensions = await setupExtensions();
  const messageCore = await createMessageCore();
  const server = createServer();

  // Ejemplos
  await examples();

  // Iniciar servidor
  console.log('\n🎯 Sistema listo. Servidor escuchando en puerto 3000');
  console.log('\nPruébalo:');
  console.log('  curl -H "x-user-id: user-custom" http://localhost:3000/me/capabilities');
  console.log('  curl -H "x-user-id: user-custom" http://localhost:3000/me/usage');
  console.log('  curl -X POST -H "x-user-id: user-custom" http://localhost:3000/messages\n');

  // server.listen(3000);
}

// Ejecutar si es el archivo principal
if (import.meta.main) {
  main().catch(console.error);
}

export { serviceGate, setupUsers, setupExtensions, createMessageCore, createServer };
