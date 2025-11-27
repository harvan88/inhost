# ARQUITECTURA DEL SISTEMA - INHOST

**Proyecto:** INHOST - Plataforma de Mensajería Multicanal Multi-Tenant
**Versión:** 2.0.0
**Última actualización:** 2025-11-20
**Autor:** Claude (Senior Software Architect)

---

## TABLA DE CONTENIDOS

1. [Visión General](#1-visión-general)
2. [Principios Arquitectónicos](#2-principios-arquitectónicos)
3. [Arquitectura en Capas](#3-arquitectura-en-capas)
4. [Componentes Principales](#4-componentes-principales)
5. [Flujos de Datos](#5-flujos-de-datos)
6. [Patrones de Diseño](#6-patrones-de-diseño)
7. [Decisiones Arquitectónicas](#7-decisiones-arquitectónicas)
8. [Escalabilidad](#8-escalabilidad)
9. [Seguridad](#9-seguridad)
10. [Diagramas](#10-diagramas)

---

## 1. VISIÓN GENERAL

### 1.1 Descripción del Sistema

INHOST es una **plataforma SaaS de mensajería multicanal** que permite a organizaciones (tenants) gestionar conversaciones con sus clientes finales a través de múltiples canales de comunicación (WhatsApp, Instagram, Telegram, SMS, Web) desde un dashboard centralizado.

### 1.2 Características Principales

- ✅ **Multi-Tenancy:** Múltiples organizaciones aisladas en la misma infraestructura
- ✅ **Multi-Canal:** Soporte para WhatsApp, Telegram, Instagram, SMS, Web
- ✅ **Tiempo Real:** WebSockets para actualizaciones en vivo
- ✅ **Extensible:** Sistema de extensiones pluggable (AI, Analytics)
- ✅ **Escalable:** Arquitectura preparada para millones de mensajes
- ✅ **Seguro:** Multi-tenancy con aislamiento estricto de datos

### 1.3 Stack Tecnológico

```
┌─────────────────────────────────────────────────┐
│              STACK TECNOLÓGICO                  │
├─────────────────────────────────────────────────┤
│ Runtime:          Bun 1.x                       │
│ Framework:        Elysia.js 1.2                 │
│ Lenguaje:         TypeScript 5.x (strict)       │
│ Base de Datos:    PostgreSQL 15                 │
│ ORM:              Drizzle ORM 0.44              │
│ Cache/Queue:      Redis 7 (opcional)            │
│ Autenticación:    JWT (jose/jsonwebtoken)       │
│ Validación:       TypeBox                       │
│ Testing:          Bun Test (pendiente)          │
└─────────────────────────────────────────────────┘
```

### 1.4 Estructura del Monorepo

```
inhost/
├── apps/
│   └── api-gateway/          # API Gateway principal (Elysia.js)
│       ├── src/
│       │   ├── adapters/     # Adaptadores de canales
│       │   ├── core/         # Núcleo del sistema
│       │   ├── implementations/ # Implementaciones V1/V2
│       │   ├── extensions/   # Extensiones opcionales
│       │   ├── middleware/   # Middlewares HTTP
│       │   ├── routes/       # Rutas REST + WebSocket
│       │   ├── services/     # Servicios centralizados
│       │   └── index.ts      # Entry point
│       └── package.json
│
├── packages/
│   └── shared/               # Paquete compartido
│       └── src/
│           ├── auth/         # Autenticación (JWT, password)
│           ├── database/     # Schemas y conexión DB
│           └── types/        # Tipos compartidos
│
├── scripts/                  # Scripts de DB y testing
├── drizzle/                  # Migraciones de DB
├── docs/                     # Documentación
├── testing/                  # Tests manuales HTML
└── package.json              # Workspace root
```

---

## 2. PRINCIPIOS ARQUITECTÓNICOS

### 2.1 Clean Architecture

El sistema sigue los principios de **Clean Architecture** (Robert C. Martin):

```
┌──────────────────────────────────────────────┐
│         CLEAN ARCHITECTURE LAYERS            │
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────┐     │
│  │   PRESENTATION LAYER               │     │
│  │   (Routes, Middleware)             │     │
│  └───────────────┬────────────────────┘     │
│                  │                           │
│  ┌───────────────▼────────────────────┐     │
│  │   APPLICATION LAYER                │     │
│  │   (Services, MessageCore)          │     │
│  └───────────────┬────────────────────┘     │
│                  │                           │
│  ┌───────────────▼────────────────────┐     │
│  │   DOMAIN LAYER                     │     │
│  │   (Interfaces, Extensions)         │     │
│  └───────────────┬────────────────────┘     │
│                  │                           │
│  ┌───────────────▼────────────────────┐     │
│  │   INFRASTRUCTURE LAYER             │     │
│  │   (Implementations, Database)      │     │
│  └────────────────────────────────────┘     │
│                                              │
└──────────────────────────────────────────────┘

Dependencias fluyen SIEMPRE hacia dentro:
Presentation → Application → Domain ← Infrastructure
```

**Beneficios:**
- ✅ **Testeable:** Lógica de negocio sin dependencias externas
- ✅ **Flexible:** Fácil cambiar implementaciones (V1 → V2)
- ✅ **Mantenible:** Responsabilidades claramente separadas
- ✅ **Escalable:** Componentes desacoplados

### 2.2 Dependency Inversion Principle (DIP)

Todas las dependencias apuntan a **abstracciones (interfaces)**, no a implementaciones concretas:

```typescript
// ✅ CORRECTO - Depende de interfaz
class MessageCore {
  constructor(
    private persistence: IPersistenceService,  // Interfaz
    private notifications: INotificationService, // Interfaz
    // ...
  ) {}
}

// Las implementaciones se inyectan desde fuera
const core = new MessageCore(
  new MemoryPersistence(),      // V1
  new WebSocketNotification(),  // V1
  // ...
);

// Cambiar a V2 es trivial:
const core = new MessageCore(
  new DatabasePersistence(),    // V2 - solo cambiar aquí
  new WebSocketNotification(),  // V1 - mantener
  // ...
);
```

### 2.3 Interface Segregation Principle (ISP)

Las interfaces son pequeñas y específicas:

```typescript
// ✅ Interfaces segregadas
interface IPersistenceService {
  save(envelope: MessageEnvelope): Promise<PersistenceResult>;
  updateStatus(id: string, status: MessageStatus): Promise<void>;
  get(id: string): Promise<MessageEnvelope | null>;
  query(criteria: MessageQuery): Promise<MessageEnvelope[]>;
}

interface INotificationService {
  broadcast(envelope: MessageEnvelope): Promise<void>;
  broadcastStatus(update: StatusUpdate): Promise<void>;
  getStats(): any;
}

// ❌ MALO - Interfaz monolítica
interface IMessagingService {
  save(): void;
  notify(): void;
  send(): void;
  receive(): void;
  updateStatus(): void;
  // ... 20 métodos más
}
```

### 2.4 Separation of Concerns (SoC)

Cada componente tiene **una responsabilidad bien definida**:

| Componente | Responsabilidad | NO hace |
|------------|-----------------|---------|
| **MessageCore** | Orquestar flujo de mensajes | ❌ No hace queries directos |
| **Persistence** | Guardar/recuperar datos | ❌ No valida negocio |
| **Adapters** | Comunicación con canales | ❌ No persiste datos |
| **Routes** | Recibir HTTP requests | ❌ No hace lógica de negocio |
| **Services** | Lógica de negocio | ❌ No hace queries directos |

### 2.5 Don't Repeat Yourself (DRY)

- ✅ Interfaces compartidas en `/core/interfaces/`
- ✅ Tipos compartidos en `@inhost/shared`
- ✅ Utilidades reutilizables
- ✅ Middleware componible

---

## 3. ARQUITECTURA EN CAPAS

### 3.1 Capa de Presentación (Presentation Layer)

**Responsabilidad:** Manejar HTTP requests/responses y WebSocket connections.

**Componentes:**
```
apps/api-gateway/src/
├── routes/                    # 🌐 Definición de endpoints
│   ├── health.ts             # Health checks
│   ├── messages.ts           # LEGACY - Mensajes
│   ├── websocket.ts          # WebSocket real-time
│   ├── simulation.ts         # Simulación (dev)
│   └── admin/                # 🔐 Rutas protegidas
│       ├── auth.ts           # Autenticación
│       ├── conversations.ts  # Conversaciones
│       ├── messages.ts       # Mensajes
│       ├── end-users.ts      # End users
│       ├── team.ts           # Team management
│       ├── tenant.ts         # Tenant management
│       ├── account.ts        # Account settings
│       ├── integrations.ts   # Integraciones
│       ├── mentions.ts       # Sistema de menciones
│       └── feedback.ts       # Feedback de mensajes
│
└── middleware/                # 🛡️ Middlewares HTTP
    ├── errorHandler.ts       # Manejo global de errores
    ├── logger.ts             # Logging HTTP
    ├── auth.ts               # Autenticación básica
    ├── jwt-auth.ts           # JWT authentication
    ├── validation.ts         # Validación de inputs
    ├── rateLimiting.ts       # Rate limiting V1
    ├── rateLimitingV2.ts     # Rate limiting V2
    ├── timeout.ts            # Request timeout
    └── websocketValidation.ts # Validación WebSocket
```

**Flujo de un request:**
```
1. Request → CORS middleware
2. → Logger middleware
3. → Rate limiter middleware
4. → JWT auth middleware (si es /admin/*)
5. → Validation middleware
6. → Route handler
7. → Error handler (si hay error)
8. ← Response
```

**Ejemplo de ruta:**
```typescript
// routes/admin/conversations.ts
export const adminConversationsRoutes = new Elysia({ prefix: '/admin/conversations' })
  .use(jwtAuth())  // Middleware de autenticación

  .get('/', async ({ query, store }) => {
    const auth = store.auth as AuthenticatedRequest;

    // ✅ Solo llama al servicio (no lógica de negocio aquí)
    const conversations = await conversationService.getAll(
      auth.tenantId,
      query
    );

    return createSuccessResponse(conversations);
  }, {
    query: ConversationFiltersSchema  // Validación automática
  })

  .post('/', async ({ body, store }) => {
    const auth = store.auth as AuthenticatedRequest;

    // ✅ Solo llama al servicio
    const conversation = await conversationService.create(
      auth.tenantId,
      body
    );

    return createSuccessResponse(conversation);
  });
```

### 3.2 Capa de Aplicación (Application Layer)

**Responsabilidad:** Orquestar la lógica de negocio y coordinar entre componentes.

**Componentes:**
```
apps/api-gateway/src/
├── core/
│   └── MessageCore.ts         # 🎯 Orquestador principal
│
└── services/
    ├── index.ts               # 🏭 Factory de servicios
    ├── messageService.ts      # Servicio de mensajes
    └── serviceGateFactory.ts  # Factory de service gate
```

**MessageCore - El Orquestador:**
```typescript
/**
 * MessageCore es el CORAZÓN del sistema.
 *
 * Responsabilidades:
 * 1. Recibir mensajes entrantes
 * 2. Enviar mensajes salientes
 * 3. Actualizar estados
 * 4. Coordinar entre servicios
 *
 * NO hace:
 * - Queries directos a DB
 * - Transformaciones de datos
 * - Validaciones de negocio complejas
 */
export class MessageCore {
  constructor(
    private persistence: IPersistenceService,
    private notifications: INotificationService,
    private planResolver: IPlanResolver,
    private ownerChecker: IOwnerChecker,
    private adapters: AdapterManager,
    private serviceGate?: IServiceGate
  ) {}

  async receive(envelope: MessageEnvelope): Promise<void> {
    // 1. Persistir
    await this.persistence.save(envelope);

    // 2. Notificar
    await this.notifications.broadcast(envelope);

    // 3. Actualizar estado
    if (envelope.type === MessageType.INCOMING) {
      await this.updateStatus(envelope.id, MessageStatus.RECEIVED);
    }
  }

  async send(envelope: MessageEnvelope): Promise<SendResult> {
    // 1. Verificar capacidades
    const canSend = await this.checkCapabilities(envelope);
    if (!canSend) {
      return { success: false, error: 'LIMIT_EXCEEDED' };
    }

    // 2. Persistir
    await this.persistence.save(envelope);

    // 3. Actualizar estado
    await this.updateStatus(envelope.id, MessageStatus.SENDING);

    // 4. Enviar a través del adapter
    const result = await this.adapters.sendMessage(envelope);

    // 5. Actualizar estado final
    const finalStatus = result.success
      ? MessageStatus.SENT
      : MessageStatus.FAILED;
    await this.updateStatus(envelope.id, finalStatus);

    // 6. Registrar uso
    await this.recordUsage(envelope);

    return result;
  }
}
```

**Inicialización de Servicios:**
```typescript
// services/index.ts

// Singleton pattern - una sola instancia
export const adapterManager = new AdapterManager();
export const rateLimiter = shouldUseRedis()
  ? new RedisRateLimiter()
  : new MemoryRateLimiter();
export const persistence = new MemoryPersistence(); // ⚠️ TODO: DatabasePersistence
export const notifications = new WebSocketNotification();
export const serviceGate = new DatabaseServiceGate();

// MessageCore orquesta todo
export const messageCore = new MessageCore(
  persistence,
  notifications,
  planResolver,
  ownerChecker,
  adapterManager,
  serviceGate
);

export async function initializeServices(): Promise<void> {
  // 1. Registrar adaptadores
  adapterManager.register(new SimulatedWhatsAppAdapter());
  adapterManager.register(new SimulatedTelegramAdapter());
  adapterManager.register(new SimulatedSMSAdapter());

  // 2. Inicializar adaptadores
  await adapterManager.initializeAll();

  // 3. Iniciar servicios background
  rateLimiter.startCleanup();
  ownerChecker.startAutoCleanup(5);
  messageQueue.startAutoReset();

  // 4. Iniciar adaptadores
  await adapterManager.startAll();

  logger.info('✅ Services initialized');
}
```

### 3.3 Capa de Dominio (Domain Layer)

**Responsabilidad:** Definir contratos (interfaces) y lógica de negocio pura.

**Componentes:**
```
apps/api-gateway/src/
├── core/
│   └── interfaces/             # 📜 Contratos del sistema
│       ├── IAdapter.ts         # Contrato para adaptadores
│       ├── IRateLimiter.ts     # Contrato para rate limiting
│       ├── IMessageQueue.ts    # Contrato para colas
│       ├── IValidator.ts       # Contrato para validación
│       ├── IPersistenceService.ts  # Contrato para persistencia
│       ├── INotificationService.ts # Contrato para notificaciones
│       ├── IPlanResolver.ts    # Contrato para planes
│       ├── IOwnerChecker.ts    # Contrato para presencia
│       ├── IExtension.ts       # Contrato para extensiones
│       ├── IExtensionRegistry.ts # Contrato para registro
│       ├── IServiceGate.ts     # Contrato para capabilities
│       └── index.ts            # Re-export todo
│
└── extensions/                 # 🧩 Extensiones opcionales
    ├── AIAssistantExtension.ts # Asistente AI
    ├── AnalyticsExtension.ts   # Analytics
    └── index.ts
```

**Ejemplo de Interfaz (Contrato Estable):**
```typescript
/**
 * IPersistenceService
 *
 * Contrato para persistencia de mensajes.
 * Las implementaciones pueden cambiar (V1 → V2 → V3),
 * pero este contrato NUNCA cambia.
 */
export interface IPersistenceService {
  /**
   * Guarda un mensaje
   */
  save(envelope: MessageEnvelope): Promise<PersistenceResult>;

  /**
   * Actualiza el estado de un mensaje
   */
  updateStatus(
    messageId: string,
    status: MessageStatus,
    timestamp?: string
  ): Promise<void>;

  /**
   * Obtiene un mensaje por ID
   */
  get(messageId: string): Promise<MessageEnvelope | null>;

  /**
   * Busca mensajes por criterios
   */
  query(criteria: MessageQuery): Promise<MessageEnvelope[]>;

  /**
   * Elimina un mensaje (soft delete)
   */
  delete(messageId: string): Promise<void>;

  /**
   * Sincroniza mensajes con almacenamiento remoto
   */
  syncToRemote(messageIds: string[]): Promise<void>;

  /**
   * Obtiene estadísticas de persistencia
   */
  getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    storage: string;
  }>;
}
```

**Sistema de Extensiones:**
```typescript
/**
 * IExtension
 *
 * Contrato para extensiones pluggables.
 * Permite agregar funcionalidad sin modificar el core.
 */
export interface IExtension {
  id: string;
  name: string;
  version: string;
  priority: ExtensionPriority;

  initialize(config?: ExtensionConfig): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

/**
 * IMessageExtension
 *
 * Extensión que procesa mensajes.
 */
export interface IMessageExtension extends IExtension {
  /**
   * Procesa un mensaje antes de enviarlo
   */
  beforeSend?(
    envelope: MessageEnvelope,
    context: ExtensionContext
  ): Promise<ExtensionResult>;

  /**
   * Procesa un mensaje después de recibirlo
   */
  afterReceive?(
    envelope: MessageEnvelope,
    context: ExtensionContext
  ): Promise<ExtensionResult>;
}

// Ejemplo de uso:
class AIAssistantExtension implements IMessageExtension {
  id = 'ai-assistant';
  name = 'AI Assistant';

  async afterReceive(envelope: MessageEnvelope) {
    if (envelope.content.type === 'text') {
      const aiResponse = await this.generateResponse(envelope.content.text);
      return {
        success: true,
        data: { suggestedReply: aiResponse }
      };
    }
    return { success: true };
  }
}
```

### 3.4 Capa de Infraestructura (Infrastructure Layer)

**Responsabilidad:** Implementaciones concretas de interfaces y acceso a recursos externos.

**Componentes:**
```
apps/api-gateway/src/
├── implementations/
│   ├── v1/                     # 📦 Versión 1 (En Memoria)
│   │   ├── MemoryRateLimiter.ts
│   │   ├── MemoryQueue.ts
│   │   ├── MemoryPersistence.ts
│   │   ├── SimpleValidator.ts
│   │   ├── SimplePlanResolver.ts
│   │   ├── ConnectionOwnerChecker.ts
│   │   ├── WebSocketNotification.ts
│   │   └── CapabilityBasedServiceGate.ts
│   │
│   └── v2/                     # 💾 Versión 2 (Persistente)
│       ├── RedisRateLimiter.ts
│       ├── DatabaseServiceGate.ts
│       └── (DatabasePersistence.ts - TODO)
│
├── adapters/                   # 📡 Adaptadores de canales
│   ├── manager/
│   │   └── AdapterManager.ts  # Gestión de adaptadores
│   └── simulators/
│       ├── SimulatedWhatsAppAdapter.ts
│       ├── SimulatedTelegramAdapter.ts
│       └── SimulatedSMSAdapter.ts
│
└── config/                     # ⚙️ Configuración
    ├── index.ts               # Config centralizada
    └── redis.ts               # Config de Redis
```

**Packages Shared:**
```
packages/shared/src/
├── database/                   # 🗄️ Base de datos
│   ├── schema.ts              # Schema principal
│   ├── multi-tenancy-schema.ts # Schema multi-tenancy
│   ├── capabilities-schema.ts  # Schema capabilities
│   ├── config.ts              # Pool de conexiones
│   └── db.ts                  # Instancia de Drizzle
│
└── auth/                       # 🔐 Autenticación
    ├── jwt.ts                 # Funciones JWT
    └── password.ts            # Hash de passwords
```

**Ejemplo de Implementación V1 vs V2:**

```typescript
// V1 - En Memoria (desarrollo)
export class MemoryPersistence implements IPersistenceService {
  private messages = new Map<string, MessageEnvelope>();

  async save(envelope: MessageEnvelope): Promise<PersistenceResult> {
    this.messages.set(envelope.id, envelope);
    return { success: true, messageId: envelope.id, storage: 'memory' };
  }

  async get(messageId: string): Promise<MessageEnvelope | null> {
    return this.messages.get(messageId) || null;
  }

  // ⚠️ Problema: Los datos se pierden al reiniciar
}

// V2 - Base de Datos (producción)
export class DatabasePersistence implements IPersistenceService {
  async save(envelope: MessageEnvelope): Promise<PersistenceResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO messages (id, conversation_id, type, content, ...)
         VALUES ($1, $2, $3, $4, ...)`,
        [envelope.id, envelope.conversationId, ...]
      );

      await client.query('COMMIT');
      return { success: true, messageId: envelope.id, storage: 'postgresql' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async get(messageId: string): Promise<MessageEnvelope | null> {
    const result = await pool.query(
      'SELECT * FROM messages WHERE id = $1',
      [messageId]
    );
    return result.rows[0] ? this.mapToEnvelope(result.rows[0]) : null;
  }

  // ✅ Persistencia real en PostgreSQL
}
```

**Cambiar de V1 a V2:**
```typescript
// services/index.ts

// Antes (V1):
export const persistence = new MemoryPersistence();

// Después (V2):
export const persistence = new DatabasePersistence();

// ¡Eso es todo! El resto del código no cambia.
```

---

## 4. COMPONENTES PRINCIPALES

### 4.1 MessageCore (Orquestador)

**Ubicación:** `apps/api-gateway/src/core/MessageCore.ts`

**Propósito:** Orquestador central del flujo de mensajes.

**Responsabilidades:**
1. ✅ Recibir mensajes entrantes
2. ✅ Enviar mensajes salientes
3. ✅ Actualizar estados de mensajes
4. ✅ Coordinar persistencia, notificaciones y adaptadores
5. ✅ Verificar capacidades y límites

**Dependencias:**
- `IPersistenceService` - Para guardar mensajes
- `INotificationService` - Para notificar cambios
- `IPlanResolver` - Para verificar planes
- `IOwnerChecker` - Para verificar presencia
- `AdapterManager` - Para enviar mensajes
- `IServiceGate` (opcional) - Para verificar capacidades

**Métricas:**
- Líneas de código: 300
- Complejidad ciclomática: 15 (ALTA)
- Acoplamiento: BAJO (usa interfaces)

**Diagrama de flujo:**
```
┌─────────────────────────────────────────┐
│          MessageCore.receive()          │
├─────────────────────────────────────────┤
│                                         │
│  1. Persistence.save(envelope)          │
│         ↓                               │
│  2. Notifications.broadcast(envelope)   │
│         ↓                               │
│  3. updateStatus(id, RECEIVED)          │
│         ↓                               │
│  ✅ Done                                │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           MessageCore.send()            │
├─────────────────────────────────────────┤
│                                         │
│  1. checkCapabilities(envelope)         │
│         ↓                               │
│  2. Persistence.save(envelope)          │
│         ↓                               │
│  3. updateStatus(id, SENDING)           │
│         ↓                               │
│  4. Adapters.sendMessage(envelope)      │
│         ↓                               │
│  5. updateStatus(id, SENT/FAILED)       │
│         ↓                               │
│  6. recordUsage(envelope)               │
│         ↓                               │
│  ✅ Return SendResult                   │
└─────────────────────────────────────────┘
```

### 4.2 AdapterManager (Gestión de Canales)

**Ubicación:** `apps/api-gateway/src/adapters/manager/AdapterManager.ts`

**Propósito:** Gestionar adaptadores de canales de comunicación.

**Responsabilidades:**
1. ✅ Registrar adaptadores (WhatsApp, Telegram, SMS)
2. ✅ Inicializar adaptadores
3. ✅ Enrutar mensajes al adapter correcto
4. ✅ Health checks de adaptadores
5. ✅ Iniciar/detener adaptadores

**Ejemplo de uso:**
```typescript
// Registrar adaptadores
const manager = new AdapterManager();
manager.register(new SimulatedWhatsAppAdapter());
manager.register(new SimulatedTelegramAdapter());
manager.register(new SimulatedSMSAdapter());

// Inicializar todos
await manager.initializeAll();

// Enviar mensaje (enruta automáticamente al adapter correcto)
const result = await manager.sendMessage({
  id: '123',
  channel: MessageChannel.WHATSAPP,  // <- Auto-enrutado a WhatsAppAdapter
  // ...
});

// Health check
const health = await manager.healthCheckAll();
// { whatsapp: true, telegram: true, sms: true }
```

### 4.3 DatabaseServiceGate (Control de Capacidades)

**Ubicación:** `apps/api-gateway/src/implementations/v2/DatabaseServiceGate.ts`

**Propósito:** Controlar acceso a servicios basado en capacidades del tenant.

**Características:**
- ✅ Verificar si un tenant puede usar un servicio
- ✅ Verificar límites de rate/cuota
- ✅ Registrar uso de servicios
- ✅ Obtener configuración de servicios
- ✅ Aplicar templates de capabilities

**Modelo de datos:**
```sql
-- tenant_capabilities: Qué servicios tiene habilitados cada tenant
CREATE TABLE tenant_capabilities (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  service_id VARCHAR(100),  -- 'rate-limiting', 'ai-assistant', 'analytics'
  enabled BOOLEAN DEFAULT TRUE,
  config JSONB,  -- { limits: { rateLimit: 100, quota: 1000 } }
  expires_at TIMESTAMP,
  UNIQUE(tenant_id, service_id)
);

-- tenant_usage: Tracking de uso por tenant
CREATE TABLE tenant_usage (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  service_id VARCHAR(100),
  count INTEGER DEFAULT 0,
  reset_at TIMESTAMP,
  last_used_at TIMESTAMP,
  UNIQUE(tenant_id, service_id)
);
```

**Flujo de verificación:**
```typescript
// 1. Verificar si puede usar servicio
const result = await serviceGate.canUseService(tenantId, 'rate-limiting');

if (!result.allowed) {
  // No puede usar el servicio
  console.log(result.reason); // 'Rate limit exceeded'
  return;
}

// 2. Usar el servicio
await doSomething();

// 3. Registrar uso
await serviceGate.recordServiceUsage(tenantId, 'rate-limiting', 1);
```

### 4.4 WebSocketNotification (Tiempo Real)

**Ubicación:** `apps/api-gateway/src/implementations/v1/WebSocketNotification.ts`

**Propósito:** Enviar actualizaciones en tiempo real a clientes conectados.

**Eventos soportados:**
- `message:new` - Nuevo mensaje recibido
- `message:status` - Cambio de estado de mensaje
- `conversation:updated` - Conversación actualizada
- `conversation:read` - Conversación marcada como leída
- `mention:new` - Nueva mención
- `typing:start` - Usuario escribiendo
- `typing:stop` - Usuario dejó de escribir

**Ejemplo:**
```typescript
// Servidor
await notifications.broadcast({
  id: '123',
  type: MessageType.INCOMING,
  channel: MessageChannel.WHATSAPP,
  // ...
});

// Cliente (browser)
const ws = new WebSocket('ws://localhost:3000/realtime');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.event === 'message:new') {
    console.log('Nuevo mensaje:', data.envelope);
    // Actualizar UI
  }
};
```

---

## 5. FLUJOS DE DATOS

### 5.1 Flujo de Mensaje Entrante (Incoming Message)

```
┌─────────────────────────────────────────────────────────────┐
│                 FLUJO DE MENSAJE ENTRANTE                   │
└─────────────────────────────────────────────────────────────┘

1. CLIENTE EXTERNO (WhatsApp/Telegram/etc)
   │
   │ Mensaje: "Hola, necesito ayuda"
   │
   ▼
2. ADAPTER (SimulatedWhatsAppAdapter)
   │
   │ Convierte a MessageEnvelope:
   │ {
   │   id: "msg-123",
   │   type: "incoming",
   │   channel: "whatsapp",
   │   content: { type: "text", text: "Hola, necesito ayuda" }
   │ }
   │
   ▼
3. MESSAGE CORE (receive)
   │
   ├─▶ Persistence.save(envelope)
   │   └─▶ Guarda en memoria/DB
   │
   ├─▶ Notifications.broadcast(envelope)
   │   └─▶ Envía por WebSocket a dashboard
   │
   └─▶ updateStatus(id, RECEIVED)
       └─▶ Actualiza status chain
   │
   ▼
4. DASHBOARD (Frontend)
   │
   │ WebSocket recibe evento "message:new"
   │ UI muestra mensaje nuevo
   │ Notificación sonora/visual
   │
   ✅ DONE
```

**Código simplificado:**
```typescript
// 1. Adapter recibe mensaje del canal
class SimulatedWhatsAppAdapter implements IAdapter {
  async onMessage(rawMessage: any) {
    const envelope: MessageEnvelope = {
      id: generateId(),
      type: MessageType.INCOMING,
      channel: MessageChannel.WHATSAPP,
      content: {
        type: 'text',
        text: rawMessage.body
      },
      metadata: {
        from: rawMessage.from,
        timestamp: new Date().toISOString()
      }
    };

    // 2. Envía a MessageCore
    await messageCore.receive(envelope);
  }
}

// 3. MessageCore procesa
class MessageCore {
  async receive(envelope: MessageEnvelope): Promise<void> {
    // Persistir
    await this.persistence.save(envelope);

    // Notificar
    await this.notifications.broadcast(envelope);

    // Actualizar estado
    await this.updateStatus(envelope.id, MessageStatus.RECEIVED);
  }
}

// 4. Dashboard recibe por WebSocket
ws.onmessage = (event) => {
  const { event: eventType, envelope } = JSON.parse(event.data);

  if (eventType === 'message:new') {
    addMessageToUI(envelope);
    playNotificationSound();
  }
};
```

### 5.2 Flujo de Mensaje Saliente (Outgoing Message)

```
┌─────────────────────────────────────────────────────────────┐
│                 FLUJO DE MENSAJE SALIENTE                   │
└─────────────────────────────────────────────────────────────┘

1. DASHBOARD (Frontend)
   │
   │ Agente escribe: "¿En qué puedo ayudarte?"
   │ POST /admin/conversations/:id/messages
   │
   ▼
2. ROUTE HANDLER (adminMessagesRoutes)
   │
   │ Valida JWT
   │ Valida input
   │ Crea MessageEnvelope
   │
   ▼
3. MESSAGE CORE (send)
   │
   ├─▶ ServiceGate.canUseService(tenantId, 'rate-limiting')
   │   └─▶ Verifica límites del tenant
   │       ├─▶ Si excedió: RETURN error
   │       └─▶ Si OK: continuar
   │
   ├─▶ Persistence.save(envelope)
   │   └─▶ Guarda en memoria/DB
   │
   ├─▶ updateStatus(id, SENDING)
   │   └─▶ Actualiza status a "sending"
   │
   ├─▶ AdapterManager.sendMessage(envelope)
   │   └─▶ Enruta al adapter correcto (WhatsApp)
   │       └─▶ Adapter envía a API de WhatsApp
   │           ├─▶ Si OK: status = SENT
   │           └─▶ Si error: status = FAILED
   │
   ├─▶ updateStatus(id, SENT/FAILED)
   │   └─▶ Actualiza status final
   │
   └─▶ ServiceGate.recordServiceUsage(tenantId, 'rate-limiting')
       └─▶ Registra uso (count++)
   │
   ▼
4. CLIENTE EXTERNO (WhatsApp/Telegram/etc)
   │
   │ Recibe mensaje en su app
   │
   ✅ DONE
```

**Código simplificado:**
```typescript
// 1. Route handler
.post('/conversations/:id/messages', async ({ body, params, store }) => {
  const auth = store.auth as AuthenticatedRequest;

  const envelope: MessageEnvelope = {
    id: generateId(),
    type: MessageType.OUTGOING,
    channel: body.channel,
    conversationId: params.id,
    content: body.content,
    metadata: {
      tenantId: auth.tenantId,
      sentByAdminUserId: auth.tenantUserId,
      timestamp: new Date().toISOString()
    }
  };

  // 2. Envía a MessageCore
  const result = await messageCore.send(envelope);

  if (!result.success) {
    return createErrorResponse(result.error);
  }

  return createSuccessResponse(result);
});

// 3. MessageCore procesa
class MessageCore {
  async send(envelope: MessageEnvelope): Promise<SendResult> {
    // Verificar capacidades
    const canSend = await this.serviceGate.canUseService(
      envelope.metadata.tenantId,
      'rate-limiting'
    );

    if (!canSend.allowed) {
      return { success: false, error: 'LIMIT_EXCEEDED' };
    }

    // Persistir
    await this.persistence.save(envelope);

    // Enviar
    await this.updateStatus(envelope.id, MessageStatus.SENDING);
    const result = await this.adapters.sendMessage(envelope);

    // Actualizar estado final
    const finalStatus = result.success
      ? MessageStatus.SENT
      : MessageStatus.FAILED;
    await this.updateStatus(envelope.id, finalStatus);

    // Registrar uso
    await this.serviceGate.recordServiceUsage(
      envelope.metadata.tenantId,
      'rate-limiting'
    );

    return result;
  }
}
```

### 5.3 Flujo de Autenticación y Autorización

```
┌─────────────────────────────────────────────────────────────┐
│           FLUJO DE AUTENTICACIÓN (Multi-Tenancy)            │
└─────────────────────────────────────────────────────────────┘

1. USUARIO (admin@company.com)
   │
   │ POST /admin/auth/login
   │ { email: "admin@company.com", password: "..." }
   │
   ▼
2. AUTH ROUTE HANDLER
   │
   ├─▶ Query DB: SELECT * FROM tenant_users WHERE email = ?
   │   └─▶ Obtiene usuario + tenant
   │
   ├─▶ bcrypt.compare(password, passwordHash)
   │   └─▶ Verifica password
   │       ├─▶ Si incorrecto: RETURN 401
   │       └─▶ Si correcto: continuar
   │
   └─▶ jwt.sign({ sub: userId, tenant_id: tenantId, role: "admin" })
       └─▶ Genera JWT token
   │
   ▼
3. RESPONSE
   │
   │ {
   │   "token": "eyJhbGc...",
   │   "user": { "id": "...", "email": "...", "role": "admin" },
   │   "tenant": { "id": "...", "name": "Company", "plan": "professional" }
   │ }
   │
   ▼
4. CLIENTE GUARDA TOKEN
   │
   │ localStorage.setItem('token', response.token)
   │
   ▼
5. REQUESTS SUBSECUENTES
   │
   │ GET /admin/conversations
   │ Authorization: Bearer eyJhbGc...
   │
   ▼
6. JWT AUTH MIDDLEWARE
   │
   ├─▶ Extrae token del header "Authorization"
   │
   ├─▶ jwt.verify(token, JWT_SECRET)
   │   └─▶ Verifica firma y expiración
   │       ├─▶ Si inválido: RETURN 401
   │       └─▶ Si válido: continuar
   │
   └─▶ Agrega auth context a store
       └─▶ store.auth = { tenantUserId, tenantId, email, role }
   │
   ▼
7. ROUTE HANDLER
   │
   │ const auth = store.auth;
   │ // Puede acceder a tenantId, userId, role
   │ // Todas las queries filtran por tenantId (multi-tenancy)
   │
   ✅ AUTHORIZED
```

---

## 6. PATRONES DE DISEÑO

### 6.1 Dependency Injection (DI)

**Definición:** Inyectar dependencias desde fuera en lugar de crearlas internamente.

**Implementación:**
```typescript
// ❌ MALO - Sin DI
class MessageCore {
  private persistence = new MemoryPersistence();  // Hard-coded!

  async save(msg: Message) {
    await this.persistence.save(msg);
  }
}

// ✅ BUENO - Con DI
class MessageCore {
  constructor(private persistence: IPersistenceService) {}  // Inyectado!

  async save(msg: Message) {
    await this.persistence.save(msg);
  }
}

// Uso:
const core1 = new MessageCore(new MemoryPersistence());      // V1
const core2 = new MessageCore(new DatabasePersistence());    // V2
```

**Beneficios:**
- ✅ Testeable (puedes inyectar mocks)
- ✅ Flexible (fácil cambiar implementaciones)
- ✅ Desacoplado (no depende de implementaciones concretas)

### 6.2 Factory Pattern

**Definición:** Crear objetos sin especificar la clase exacta.

**Implementación:**
```typescript
// services/serviceGateFactory.ts
export function createServiceGate(type: 'memory' | 'database'): IServiceGate {
  switch (type) {
    case 'memory':
      return new CapabilityBasedServiceGate();
    case 'database':
      return new DatabaseServiceGate();
    default:
      throw new Error(`Unknown service gate type: ${type}`);
  }
}

// Uso:
const serviceGate = createServiceGate('database');
```

### 6.3 Strategy Pattern

**Definición:** Encapsular algoritmos intercambiables.

**Implementación:**
```typescript
// Diferentes estrategias de rate limiting
interface IRateLimiter {
  checkLimit(userId: string): Promise<RateLimitResult>;
}

class MemoryRateLimiter implements IRateLimiter {
  // Estrategia en memoria
}

class RedisRateLimiter implements IRateLimiter {
  // Estrategia con Redis
}

// Selector de estrategia
export const rateLimiter = shouldUseRedis()
  ? new RedisRateLimiter()   // Estrategia 1
  : new MemoryRateLimiter();  // Estrategia 2
```

### 6.4 Observer Pattern (Pub/Sub)

**Definición:** Notificar a múltiples observadores cuando cambia el estado.

**Implementación:**
```typescript
// Publisher
class MessageCore {
  async receive(envelope: MessageEnvelope) {
    // ...
    // Notificar a todos los observadores
    await this.notifications.broadcast(envelope);  // Publish
  }
}

// Subscriber (WebSocket)
class WebSocketNotification implements INotificationService {
  private connections = new Set<WebSocket>();

  subscribe(ws: WebSocket) {
    this.connections.add(ws);  // Agregar observador
  }

  async broadcast(envelope: MessageEnvelope) {
    // Notificar a todos los observadores
    for (const ws of this.connections) {
      ws.send(JSON.stringify({ event: 'message:new', envelope }));
    }
  }
}
```

### 6.5 Adapter Pattern

**Definición:** Convertir la interfaz de una clase en otra que los clientes esperan.

**Implementación:**
```typescript
// Interfaz esperada
interface IAdapter {
  send(envelope: MessageEnvelope): Promise<SendResult>;
  receive(callback: (msg: any) => void): void;
}

// Adaptador para WhatsApp API
class SimulatedWhatsAppAdapter implements IAdapter {
  async send(envelope: MessageEnvelope): Promise<SendResult> {
    // Convierte MessageEnvelope al formato de WhatsApp API
    const whatsappMessage = {
      to: envelope.metadata.to,
      body: envelope.content.text,
      // ...
    };

    // Envía a WhatsApp API
    await this.whatsappClient.send(whatsappMessage);

    return { success: true, messageId: envelope.id };
  }

  receive(callback: (msg: any) => void) {
    // Convierte mensajes de WhatsApp API a MessageEnvelope
    this.whatsappClient.on('message', (rawMsg) => {
      const envelope: MessageEnvelope = {
        id: generateId(),
        type: MessageType.INCOMING,
        channel: MessageChannel.WHATSAPP,
        content: {
          type: 'text',
          text: rawMsg.body
        },
        // ...
      };
      callback(envelope);
    });
  }
}
```

### 6.6 Singleton Pattern

**Definición:** Garantizar que una clase tenga una sola instancia.

**Implementación:**
```typescript
// services/index.ts

// Una sola instancia de cada servicio
export const adapterManager = new AdapterManager();      // Singleton
export const messageCore = new MessageCore(/* ... */);   // Singleton
export const rateLimiter = new MemoryRateLimiter();     // Singleton

// Todos importan la misma instancia
import { messageCore } from './services';
await messageCore.receive(envelope);
```

---

## 7. DECISIONES ARQUITECTÓNICAS

### 7.1 ¿Por qué Bun en lugar de Node.js?

**Decisión:** Usar Bun como runtime.

**Razones:**
- ⚡ **Performance:** 3x más rápido que Node.js
- 📦 **Bundle size:** Más pequeño
- 🧪 **Testing integrado:** Bun Test nativo
- 🔧 **Herramientas integradas:** Package manager, bundler, test runner

**Trade-offs:**
- ❌ Ecosistema más pequeño (menos librerías)
- ❌ Menos maduro (puede tener bugs)
- ✅ Compatible con Node.js (fácil migrar si es necesario)

### 7.2 ¿Por qué Elysia.js en lugar de Express?

**Decisión:** Usar Elysia.js como framework web.

**Razones:**
- ⚡ **Performance:** 10x más rápido que Express
- 🔒 **Type-safe:** TypeScript first-class
- ✅ **Validación integrada:** TypeBox built-in
- 🧩 **Composable:** Plugins modulares
- 🦊 **Optimizado para Bun:** Aprovecha al máximo Bun

**Trade-offs:**
- ❌ Comunidad más pequeña
- ❌ Menos recursos/tutoriales
- ✅ Sintaxis similar a Express (fácil aprender)

### 7.3 ¿Por qué Drizzle ORM en lugar de Prisma?

**Decisión:** Usar Drizzle ORM.

**Razones:**
- 🚀 **Performance:** Overhead casi cero
- 🔍 **Type-safe:** Inferencia de tipos excelente
- 📝 **SQL-like:** Queries parecidas a SQL
- 📦 **Lightweight:** Bundle pequeño
- 🔧 **Flexible:** Control total sobre queries

**Trade-offs:**
- ❌ Menos maduro que Prisma
- ❌ Menos herramientas visuales
- ✅ Más cercano a SQL (mejor control)

### 7.4 ¿Por qué Multi-Tenancy a nivel de aplicación?

**Decisión:** Multi-tenancy con datos compartidos (shared database, shared schema).

**Alternativas consideradas:**

| Enfoque | Pros | Contras | Elegido |
|---------|------|---------|---------|
| **Database per tenant** | Aislamiento total | Muy costoso, difícil escalar | ❌ |
| **Schema per tenant** | Buen aislamiento | Costoso, migraciones complejas | ❌ |
| **Row-level (shared)** | Escalable, económico | Requiere cuidado en queries | ✅ |

**Implementación:**
```typescript
// TODAS las queries filtran por tenant_id
const conversations = await db.query.conversations.findMany({
  where: and(
    eq(conversations.tenantId, auth.tenantId),  // ✅ SIEMPRE filtrar por tenant
    eq(conversations.status, 'active')
  )
});
```

**Medidas de seguridad:**
- ✅ JWT incluye `tenant_id`
- ✅ Middleware agrega `tenant_id` al contexto
- ✅ TODAS las queries filtran por `tenant_id`
- ✅ Row Level Security (RLS) en PostgreSQL (opcional)

### 7.5 ¿Por qué Interfaces en lugar de Clases Abstractas?

**Decisión:** Usar interfaces (contratos) en lugar de clases abstractas.

**Razones:**
- 🔗 **Desacoplamiento:** Dependencias solo a contratos
- 🧪 **Testeable:** Fácil crear mocks
- 🔄 **Flexible:** Múltiples implementaciones
- 📖 **Documentación clara:** Contratos explícitos

**Ejemplo:**
```typescript
// ✅ Interface (contrato)
interface IPersistenceService {
  save(msg: Message): Promise<void>;
}

// Implementación 1
class MemoryPersistence implements IPersistenceService {
  async save(msg: Message) { /* ... */ }
}

// Implementación 2
class DatabasePersistence implements IPersistenceService {
  async save(msg: Message) { /* ... */ }
}

// MessageCore solo conoce la interfaz
class MessageCore {
  constructor(private persistence: IPersistenceService) {}
}
```

---

## 8. ESCALABILIDAD

### 8.1 Estrategias de Escalabilidad

**Escalabilidad Horizontal (Scale Out):**
```
┌─────────────────────────────────────────────────┐
│            LOAD BALANCER (Nginx)                │
└────────────────┬────────────────────────────────┘
                 │
       ┌─────────┼─────────┐
       │         │         │
   ┌───▼───┐ ┌──▼────┐ ┌──▼────┐
   │ API 1 │ │ API 2 │ │ API 3 │  (Stateless)
   └───┬───┘ └───┬───┘ └───┬───┘
       │         │         │
       └─────────┼─────────┘
                 │
       ┌─────────▼─────────┐
       │   PostgreSQL      │  (Shared State)
       └───────────────────┘
```

**Características Stateless:**
- ✅ **No sesiones en memoria:** Todo en JWT
- ✅ **No cache local:** Todo en Redis (compartido)
- ✅ **No conexiones WebSocket persistentes:** Usar Redis Pub/Sub

**Escalabilidad Vertical (Scale Up):**
```
PostgreSQL:
- Aumentar RAM (para cache de queries)
- Aumentar CPU (para queries concurrentes)
- SSD rápidos (para I/O)

Redis:
- Aumentar RAM (para más cache)
```

### 8.2 Puntos de Escalabilidad

| Componente | Estrategia | Límite |
|------------|-----------|--------|
| **API Gateway** | Horizontal | ∞ (stateless) |
| **PostgreSQL** | Vertical + Read Replicas | ~10,000 req/s |
| **Redis** | Cluster | ~100,000 req/s |
| **WebSocket** | Horizontal con Redis Pub/Sub | ~1M connections |

### 8.3 Optimizaciones de Performance

**1. Connection Pooling:**
```typescript
const pool = new Pool({
  max: 20,                    // 20 conexiones máximo
  min: 2,                     // 2 conexiones mínimo
  idleTimeoutMillis: 30000,   // Cerrar idle después de 30s
});
```

**2. Query Optimization:**
```typescript
// ❌ MALO - N+1 queries
const conversations = await db.query.conversations.findMany();
for (const convo of conversations) {
  const endUser = await db.query.endUsers.findFirst({ /* ... */ });  // N queries!
}

// ✅ BUENO - 1 query con JOIN
const conversations = await db.query.conversations.findMany({
  with: {
    endUser: true,      // JOIN automático
    assignedTo: true,   // JOIN automático
  }
});
```

**3. Caching:**
```typescript
// Cache de capabilities (cambian poco)
const capabilities = await cached(
  `tenant:${tenantId}:capabilities`,
  3600,  // 1 hora
  () => serviceGate.getUserCapabilities(tenantId)
);
```

**4. Índices de Base de Datos:**
```sql
-- Índices compuestos para queries frecuentes
CREATE INDEX conversations_tenant_status_idx
  ON conversations(tenant_id, status);

CREATE INDEX conversations_tenant_last_message_idx
  ON conversations(tenant_id, last_message_at DESC);
```

**5. Paginación:**
```typescript
// Siempre paginar listados
.get('/conversations', async ({ query }) => {
  const { page = 1, limit = 20 } = query;
  const offset = (page - 1) * limit;

  const conversations = await db.query.conversations.findMany({
    where: eq(conversations.tenantId, tenantId),
    limit,
    offset,
    orderBy: (conversations, { desc }) => [desc(conversations.lastMessageAt)]
  });

  return createPaginatedResponse(conversations, total, page, limit);
});
```

### 8.4 Métricas y Monitoreo

**Métricas clave:**
```typescript
// Latencia de endpoints
histogram('http_request_duration_seconds', {
  path: '/admin/conversations',
  method: 'GET',
  status: 200
});

// Throughput
counter('http_requests_total', {
  path: '/admin/conversations',
  method: 'GET'
});

// Conexiones de DB
gauge('db_connections_active', pool.totalCount);

// Mensajes procesados
counter('messages_processed_total', {
  channel: 'whatsapp',
  type: 'incoming'
});
```

**Alertas:**
- 🚨 Latencia > 1s en endpoints críticos
- 🚨 Error rate > 5%
- 🚨 CPU > 80%
- 🚨 Memory > 90%
- 🚨 DB connections > 90% del pool

---

## 9. SEGURIDAD

### 9.1 Autenticación y Autorización

**JWT Token Structure:**
```json
{
  "sub": "user-id",           // Subject (tenant user ID)
  "email": "admin@company.com",
  "tenant_id": "tenant-123",  // Tenant ID (aislamiento)
  "role": "admin",            // Role (RBAC)
  "iat": 1234567890,          // Issued at
  "exp": 1234654290           // Expires at (24h)
}
```

**Roles y Permisos:**
```typescript
enum Role {
  OWNER = 'owner',           // Acceso total
  ADMIN = 'admin',           // Casi todo
  AGENT = 'agent',           // Conversaciones asignadas
  VIEWER = 'viewer'          // Solo lectura
}

// Middleware de autorización
function requireRole(minRole: Role) {
  return (ctx: Context) => {
    const auth = ctx.store.auth as AuthenticatedRequest;

    if (!hasPermission(auth.role, minRole)) {
      throw new Error('Forbidden');
    }
  };
}

// Uso
.delete('/team/:id', async ({ params }) => {
  // ...
}, {
  beforeHandle: [jwtAuth(), requireRole(Role.ADMIN)]  // Solo admins+
});
```

### 9.2 Aislamiento Multi-Tenancy

**Principios:**
1. ✅ **Filtrar SIEMPRE por `tenant_id`** en TODAS las queries
2. ✅ **JWT incluye `tenant_id`** (no confiar en el cliente)
3. ✅ **Validar `tenant_id`** en middleware
4. ✅ **No permitir cross-tenant access**

**Implementación:**
```typescript
// Middleware que valida tenant_id
export function ensureTenantAccess() {
  return async ({ params, store }: Context) => {
    const auth = store.auth as AuthenticatedRequest;

    // Si el recurso pertenece a un tenant específico
    if (params.tenantId && params.tenantId !== auth.tenantId) {
      throw new Error('Forbidden: Access to other tenant data');
    }
  };
}

// Helpers de query seguros
export async function findConversationByIdSecure(
  conversationId: string,
  tenantId: string
): Promise<Conversation | null> {
  return db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, conversationId),
      eq(conversations.tenantId, tenantId)  // ✅ SIEMPRE filtrar
    )
  });
}
```

### 9.3 Prevención de Vulnerabilidades

**SQL Injection:**
```typescript
// ❌ VULNERABLE
const result = await pool.query(`
  SELECT * FROM users WHERE email = '${email}'
`);

// ✅ SEGURO - Consultas parametrizadas
const result = await pool.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);
```

**XSS (Cross-Site Scripting):**
```typescript
// Frontend debe sanitizar HTML
import DOMPurify from 'dompurify';

function renderMessage(msg: string) {
  const clean = DOMPurify.sanitize(msg);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

**CSRF (Cross-Site Request Forgery):**
```typescript
// JWT en Authorization header (no en cookies)
// + CORS restrictivo
.use(cors({
  origin: /^https?:\/\/(.*\.)?inhost\.com$/,
  credentials: true
}))
```

**Rate Limiting:**
```typescript
// Prevenir brute force en login
.post('/admin/auth/login', async ({ body }) => {
  // ...
}, {
  beforeHandle: [
    rateLimiting({
      max: 5,                // 5 intentos
      windowMs: 15 * 60 * 1000  // 15 minutos
    })
  ]
});
```

### 9.4 Secrets Management

**❌ NUNCA hacer:**
```typescript
const JWT_SECRET = 'hardcoded-secret';  // ❌ MAL
const DB_PASSWORD = 'password123';      // ❌ MAL
```

**✅ SIEMPRE hacer:**
```typescript
// Usar variables de entorno
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters');
}

// Rotar secretos regularmente
// Usar servicios de secrets management (AWS Secrets Manager, Vault)
```

---

## 10. DIAGRAMAS

### 10.1 Diagrama de Componentes

```
┌────────────────────────────────────────────────────────────┐
│                      API GATEWAY                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │               PRESENTATION LAYER                 │    │
│  │                                                  │    │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────────┐   │    │
│  │  │ Routes  │  │Middleware│  │ WebSocket    │   │    │
│  │  │ (REST)  │  │          │  │              │   │    │
│  │  └────┬────┘  └────┬─────┘  └──────┬───────┘   │    │
│  └───────┼────────────┼────────────────┼───────────┘    │
│          │            │                │                │
│  ┌───────▼────────────▼────────────────▼───────────┐    │
│  │            APPLICATION LAYER                    │    │
│  │                                                  │    │
│  │  ┌─────────────┐  ┌──────────────────────────┐ │    │
│  │  │ MessageCore │◄─┤      Services            │ │    │
│  │  │             │  │  - Message Service       │ │    │
│  │  │             │  │  - Conversation Service  │ │    │
│  │  └──────┬──────┘  └──────────────────────────┘ │    │
│  └─────────┼─────────────────────────────────────┘    │
│            │                                           │
│  ┌─────────▼─────────────────────────────────────┐    │
│  │              DOMAIN LAYER                     │    │
│  │                                               │    │
│  │  ┌──────────────┐  ┌──────────────────────┐  │    │
│  │  │  Interfaces  │  │    Extensions        │  │    │
│  │  │  (Contracts) │  │  - AI Assistant      │  │    │
│  │  │              │  │  - Analytics         │  │    │
│  │  └──────────────┘  └──────────────────────┘  │    │
│  └───────────────────────────────────────────────┘    │
│            │                                           │
│  ┌─────────▼─────────────────────────────────────┐    │
│  │         INFRASTRUCTURE LAYER                  │    │
│  │                                               │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────┐  │    │
│  │  │Implementa- │  │  Adapters  │  │ Config │  │    │
│  │  │tions V1/V2 │  │  Manager   │  │        │  │    │
│  │  └──────┬─────┘  └─────┬──────┘  └────────┘  │    │
│  └─────────┼──────────────┼─────────────────────┘    │
└────────────┼──────────────┼────────────────────────────┘
             │              │
     ┌───────▼──────┐  ┌───▼────────────┐
     │  PostgreSQL  │  │  External APIs │
     │   + Redis    │  │  (WhatsApp,    │
     │              │  │   Telegram)    │
     └──────────────┘  └────────────────┘
```

### 10.2 Diagrama de Flujo de Autenticación

```
┌─────────┐
│ Cliente │
└────┬────┘
     │
     │ POST /admin/auth/login
     │ { email, password }
     │
     ▼
┌────────────────┐
│  Auth Route    │
└────┬───────────┘
     │
     ├─▶ Query DB: Buscar user por email
     │   └─▶ Si no existe: 401 Unauthorized
     │
     ├─▶ bcrypt.compare(password, hash)
     │   └─▶ Si incorrecto: 401 Unauthorized
     │
     ├─▶ Verificar tenant status
     │   └─▶ Si suspendido: 403 Forbidden
     │
     ├─▶ jwt.sign({ sub, email, tenant_id, role })
     │   └─▶ Genera JWT token
     │
     ▼
┌────────────────┐
│   Response     │
│ { token, user }│
└────┬───────────┘
     │
     ▼
┌─────────┐
│ Cliente │ Guarda token
└────┬────┘
     │
     │ GET /admin/conversations
     │ Authorization: Bearer <token>
     │
     ▼
┌────────────────┐
│ JWT Middleware │
└────┬───────────┘
     │
     ├─▶ Extrae token del header
     │
     ├─▶ jwt.verify(token, secret)
     │   ├─▶ Si expirado: 401 Token Expired
     │   └─▶ Si inválido: 401 Invalid Token
     │
     ├─▶ Agrega auth context:
     │   store.auth = { tenantUserId, tenantId, role }
     │
     ▼
┌────────────────┐
│ Route Handler  │ Acceso autorizado
└────────────────┘
```

### 10.3 Diagrama de Base de Datos (Multi-Tenancy)

```
┌──────────────────────────────────────────────────┐
│               MULTI-TENANCY MODEL                │
└──────────────────────────────────────────────────┘

     ┌─────────────┐
     │   tenants   │ (Organizaciones)
     ├─────────────┤
     │ id (PK)     │
     │ name        │
     │ slug        │
     │ plan        │
     │ ...         │
     └──────┬──────┘
            │
            │ 1:N
            │
     ┌──────▼─────────────┬──────────────────────┐
     │                    │                      │
┌────▼─────────┐  ┌──────▼──────┐  ┌───────────▼──────┐
│ admin_users  │  │  end_users  │  │  conversations   │
├──────────────┤  ├─────────────┤  ├──────────────────┤
│ id (PK)      │  │ id (PK)     │  │ id (PK)          │
│ tenant_id FK │  │ tenant_id FK│  │ tenant_id FK     │
│ email        │  │ external_id │  │ end_user_id FK   │
│ password_hash│  │ channel     │  │ assigned_to_id FK│
│ role         │  │ name        │  │ status           │
│ ...          │  │ ...         │  │ last_message_at  │
└──────┬───────┘  └──────┬──────┘  └─────────┬────────┘
       │                 │                   │
       │ 1:N             │ 1:N               │ 1:N
       │                 │                   │
       │                 └────────┬──────────┘
       │                          │
       │                  ┌───────▼──────┐
       │                  │   messages   │
       │                  ├──────────────┤
       │                  │ id (PK)      │
       │                  │conversation FK│
       │                  │ type         │
       │                  │ channel      │
       │                  │ content JSONB│
       │                  │ sent_by FK   │
       │                  │ ...          │
       │                  └───────┬──────┘
       │                          │
       └──────────────────────────┘

AISLAMIENTO: Todas las queries filtran por tenant_id
```

---

## CONCLUSIÓN

La arquitectura de INHOST sigue principios sólidos de **Clean Architecture** con separación clara de responsabilidades entre capas. El sistema es **modular, extensible y escalable**, preparado para crecer desde un MVP hasta una plataforma empresarial.

**Fortalezas:**
- ✅ Arquitectura limpia y modular
- ✅ Separación de responsabilidades clara
- ✅ Interfaces bien definidas
- ✅ Multi-tenancy robusto
- ✅ Sistema de extensiones pluggable

**Áreas de mejora:**
- ⚠️ Implementar DatabasePersistence (V2)
- ⚠️ Agregar suite de tests
- ⚠️ Optimizar queries (N+1)
- ⚠️ Implementar caching
- ⚠️ Agregar monitoreo y métricas

---

**Autor:** Claude (Senior Software Architect)
**Fecha:** 2025-11-20
**Versión:** 1.0
