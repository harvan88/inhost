# CLAUDE.md - INHOST Backend

**INHOST** es una plataforma SaaS multi-tenant de mensajería omnicanal que permite a organizaciones gestionar conversaciones de clientes desde WhatsApp, Telegram, SMS y Web en una interfaz unificada.

---

## ¿Qué es INHOST?

**INHOST Backend** es el motor de mensajería que:

1. **Recibe mensajes** de múltiples canales (WhatsApp, Telegram, Web, SMS)
2. **Procesa mensajes** a través de un sistema extensible de plugins (AI Assistant, Sentiment Analysis, CRM Integration)
3. **Persiste datos** en PostgreSQL con aislamiento por tenant
4. **Distribuye en tiempo real** vía WebSocket a dashboards web
5. **Controla acceso** mediante JWT con roles (owner, admin, agent, viewer)

**Casos de uso:**
- Equipos de soporte con bandeja unificada para todos los canales
- Automatización con respuestas AI + clasificación de intenciones
- Analytics de sentimiento y calidad de respuestas
- Enrutamiento inteligente según carga de trabajo y especialización

---

## Arquitectura de Extensiones por Tenant

**Modelo de Enriquecimiento Conversacional Extensible** (v3.0)

### Concepto Fundamental

El sistema separa el **núcleo conversacional** (inmutable) de las **capas de enriquecimiento** (extensiones):

```
MessageEnvelopeCore (Núcleo Puro)
    ↓ lee (read-only)
MessageEnrichments (Capas de Extensiones por Tenant)
    - AI Assistant → suggestions (tenant A habilitado, tenant B no)
    - Sentiment Analyzer → emotions (todos los tenants)
    - CRM Integration → customer data (solo tenant premium)
```

**Beneficios:**
- ✅ Cada tenant elige qué extensiones activar
- ✅ Extensiones de terceros pueden agregarse sin modificar el núcleo
- ✅ Datos de extensiones aislados del núcleo (no contamina MessageEnvelope)
- ✅ Versionado independiente por extensión

### Sistema de Extensiones

**IMessageExtension Interface:**

```typescript
interface IMessageExtension extends IExtension {
  /**
   * ID único de la extensión (para registro en marketplace)
   */
  id: string;  // "ai-assistant", "sentiment-analyzer", "crm-integration"

  /**
   * Procesa un mensaje y devuelve enriquecimiento (no modifica el mensaje)
   */
  enrich(
    message: MessageEnvelopeCore,
    context: ExtensionContext
  ): Promise<EnrichmentResult>;

  /**
   * Define el esquema de datos que la extensión produce (para validación)
   */
  getEnrichmentSchema(): EnrichmentSchema;
}
```

**Persistencia Separada:**

```sql
-- Núcleo (inmutable)
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  content JSONB NOT NULL,
  -- ... solo datos esenciales
);

-- Enriquecimientos (extensiones)
CREATE TABLE message_enrichments (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id),
  extension_id VARCHAR(100) NOT NULL,  -- "ai-assistant"
  extension_version VARCHAR(20),        -- "1.2.0"
  data JSONB NOT NULL,                  -- Datos de la extensión
  tenant_id UUID NOT NULL,              -- ← Aislamiento por tenant
  ttl INTEGER,                          -- Time-to-live (segundos)
  persistent BOOLEAN DEFAULT TRUE,

  UNIQUE(message_id, extension_id, tenant_id)
);

-- Extensiones habilitadas por tenant
CREATE TABLE tenant_extensions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  extension_id VARCHAR(100) NOT NULL,   -- "ai-assistant"
  enabled BOOLEAN DEFAULT TRUE,
  config JSONB,                         -- Configuración específica del tenant
  expires_at TIMESTAMP,                 -- Para trials o suscripciones

  UNIQUE(tenant_id, extension_id)
);
```

### Extensiones de Terceros

**Modelo de Desarrollo:**

1. **Registro en Marketplace:**
   ```typescript
   // Extensión desarrollada por tercero
   class CustomCRMExtension implements IMessageExtension {
     id = 'custom-crm-connector';
     name = 'Custom CRM Connector';
     version = '1.0.0';
     publisher = 'ThirdPartyCompany';

     getEnrichmentSchema(): EnrichmentSchema {
       return {
         extensionId: this.id,
         version: this.version,
         dataSchema: {
           type: 'object',
           properties: {
             customerId: { type: 'string' },
             tier: { type: 'string', enum: ['free', 'premium', 'enterprise'] },
             // ...
           },
           required: ['customerId']
         }
       };
     }

     async enrich(message: MessageEnvelopeCore, context: ExtensionContext) {
       // Llamada a CRM externo
       const customerData = await this.crmClient.lookup(message.metadata.from);

       return {
         success: true,
         data: {
           customerId: customerData.id,
           tier: customerData.tier,
           // ...
         },
         metadata: {
           persistent: true  // guardar para histórico
         }
       };
     }
   }
   ```

2. **Sandbox de Seguridad:**
   - Extensiones ejecutan en Workers aislados (Bun WorkerPool)
   - Timeout configurable (default 5s)
   - Rate limiting por extensión
   - Auditoría de accesos

3. **Permisos Granulares:**
   ```typescript
   interface ExtensionPermissions {
     readMessages: boolean;           // Leer mensajes del chat
     readConversationHistory: boolean; // Acceder al historial completo
     writeEnrichments: boolean;       // Escribir enriquecimientos
     callExternalAPIs: string[];      // Whitelist de dominios
     accessTenantConfig: boolean;     // Acceder a config del tenant
   }
   ```

4. **Validación de Schemas:**
   - JSONSchema para validar datos de salida
   - Validación automática antes de persistir
   - Errores de schema no bloquean el flujo

### Gestión por Tenant

**Habilitar/Deshabilitar Extensiones:**

```typescript
// Tenant Admin UI → Backend API
POST /admin/extensions/:extensionId/enable
{
  "config": {
    "aiModel": "gpt-4",
    "maxSuggestions": 3,
    "languages": ["es", "en"]
  }
}

// Backend verifica:
// 1. ¿El plan del tenant incluye esta extensión?
// 2. ¿La extensión está aprobada en marketplace?
// 3. ¿Hay créditos disponibles (si es de pago)?

// Crea registro en tenant_extensions
INSERT INTO tenant_extensions (tenant_id, extension_id, enabled, config)
VALUES ($1, 'ai-assistant', true, $2);
```

**MessageCore Modificado:**

```typescript
class MessageCore {
  async receive(envelope: MessageEnvelopeCore): Promise<void> {
    // 1. Persistir núcleo
    await this.persistence.save(envelope);

    // 2. Obtener extensiones habilitadas para este tenant
    const tenantExtensions = await this.extensionRegistry.getEnabledExtensions(
      envelope.metadata.tenantId
    );

    // 3. Ejecutar extensiones en paralelo (con timeout)
    const enrichmentResults = await Promise.allSettled(
      tenantExtensions.map(ext =>
        this.executeExtension(ext, envelope)
      )
    );

    // 4. Guardar enriquecimientos exitosos
    for (const result of enrichmentResults) {
      if (result.status === 'fulfilled' && result.value.success) {
        await this.enrichmentStore.save({
          messageId: envelope.id,
          tenantId: envelope.metadata.tenantId,
          extensionId: result.value.extensionId,
          data: result.value.data,
          // ...
        });
      }
    }

    // 5. Broadcast (núcleo + enrichments)
    await this.notifications.broadcast({
      message: envelope,
      enrichments: await this.enrichmentStore.getByMessageId(
        envelope.id,
        envelope.metadata.tenantId  // ← Solo enrichments de este tenant
      )
    });
  }
}
```

---

## Stack Tecnológico

**Source:** `docs/ARCHITECTURE.md`

- **Runtime:** Bun 1.x
- **Framework:** Elysia.js 1.2
- **Language:** TypeScript 5.x (strict mode)
- **Database:** PostgreSQL 15 + Drizzle ORM 0.44
- **Cache:** Redis 7 (optional)
- **Authentication:** JWT (jose + @elysiajs/jwt OR bcrypt + jsonwebtoken - **⚠️ CONFLICT**)

---

## Comandos de Desarrollo

```bash
# Desarrollo
bun run dev                  # Start API gateway con watch
bun run dev:db               # Start PostgreSQL + Redis (Docker)
bun run dev:db:stop          # Stop database services

# Build
bun run build                # Build all packages
bun run type-check           # TypeScript checking

# Database
bun run db:generate          # Generate migration from schema
bun run db:push              # Push schema (DEV ONLY - peligroso!)
bun run db:migrate           # Run migrations (PRODUCTION)
bun run db:studio            # Drizzle Studio (visual DB editor)

# Testing
bun run test:whatsapp        # Test WhatsApp simulation
bun run test:messaging       # Test end-to-end messaging
```

---

## Arquitectura: Clean Architecture con Capas

**From ARCHITECTURE.md Section 3:**

### Layer 1: Presentation (Routes + Middleware)

**Location:** `apps/api-gateway/src/routes/`, `middleware/`

**Routes:**
- `health.ts`: Health checks
- `messages.ts`: LEGACY message endpoints
- `simulation.ts`: Development simulation
- `websocket.ts`: WebSocket real-time
- `admin/*`: Protected multi-tenant routes (auth, conversations, messages, team, etc.)

**Middleware:**
- `auth.ts`: Basic auth
- `jwt-auth.ts`: JWT authentication
- `errorHandler.ts`: Global error handling
- `logger.ts`: HTTP logging
- `rateLimiting.ts`: Rate limiting V1 (memory)
- `rateLimitingV2.ts`: Rate limiting V2 (Redis)
- `validation.ts`: Input validation
- `websocketValidation.ts`: WebSocket message validation
- `timeout.ts`: Request timeout

### Layer 2: Application (Services + MessageCore)

**Location:** `apps/api-gateway/src/core/`, `services/`

**MessageCore** (`core/MessageCore.ts`):
- **EL CORAZÓN DEL SISTEMA**
- Orquesta TODAS las operaciones de mensajes
- Dependencies: IPersistenceService, INotificationService, IPlanResolver, IOwnerChecker, AdapterManager, IServiceGate, IEnrichmentStore

**Métodos:**
- `receive(envelope)`: Persist → Execute extensions → Broadcast → Update status
- `send(envelope)`: Check capabilities → Persist → Send via adapter → Update status
- `updateStatus()`: Append to statusChain (never mutate existing)

**⚠️ REGLA:** Todas las operaciones de mensajes DEBEN pasar por MessageCore.

### Layer 3: Domain (Interfaces + Extensions)

**Location:** `apps/api-gateway/src/core/interfaces/`, `extensions/`

**Interfaces (Contratos):**
- `IAdapter.ts`: Channel adapters (WhatsApp, Telegram, etc.)
- `IPersistenceService.ts`: Message storage
- `IEnrichmentStore.ts`: Extension enrichments storage
- `INotificationService.ts`: WebSocket broadcasts
- `IRateLimiter.ts`: Rate limiting
- `IMessageQueue.ts`: Message queue
- `IValidator.ts`: Message validation
- `IPlanResolver.ts`: Plan/quota resolution
- `IOwnerChecker.ts`: Presence checking
- `IServiceGate.ts`: Capability checking
- `IExtension.ts`: Pluggable extensions
- `IExtensionRegistry.ts`: Extension management

### Layer 4: Infrastructure (Implementations + Adapters)

**Location:** `implementations/v1/`, `implementations/v2/`, `adapters/`

**V1 Implementations (Memory - for dev):**
- `MemoryPersistence.ts` - **⚠️ CRITICAL ISSUE (see below)**
- `MemoryRateLimiter.ts`
- `MemoryQueue.ts`
- `SimpleValidator.ts`
- `SimplePlanResolver.ts`
- `ConnectionOwnerChecker.ts`
- `WebSocketNotification.ts`

**V2 Implementations (Persistent - for prod):**
- `RedisRateLimiter.ts` ✅
- `DatabaseServiceGate.ts` ✅
- `DatabasePersistence.ts` - ❌ **NOT IMPLEMENTED YET**
- `DatabaseEnrichmentStore.ts` - ❌ **PENDING (for v3.0)**

**Adapters:**
- `SimulatedWhatsAppAdapter.ts`
- `SimulatedTelegramAdapter.ts`
- `SimulatedSMSAdapter.ts`
- `AdapterManager.ts`: Gestiona todos los adapters

---

## MessageEnvelope Contract (v3.0 - Núcleo Puro)

**Location:** `packages/shared/src/types/message-envelope.ts`

**Cambio arquitectónico:** Separar núcleo de extensiones

```typescript
/**
 * MessageEnvelopeCore - Núcleo Conversacional Puro (v3.0)
 * Solo contiene datos esenciales del mensaje
 */
interface MessageEnvelopeCore {
  // Identidad
  id: string;
  conversationId: string;
  type: MessageType;  // incoming | outgoing | system | status
  channel: MessageChannel;  // whatsapp | telegram | web | sms

  // Contenido
  content: {
    text?: string;
    contentType: string;
    media?: { url, type, caption };
    location?: { latitude, longitude, name };
    buttons?: Array<{ id, text, type }>;
  };

  // Metadata básica (solo datos operacionales)
  metadata: {
    from: string;
    to: string;
    timestamp: string;  // ISO 8601
    platformMessageId?: string;
    tenantId?: string;  // ← Crítico para multi-tenancy
    ownerId?: string;
  };

  // Status (operacional)
  statusChain: Array<{  // APPEND-ONLY
    status: MessageStatus;
    timestamp: string;
    messageId: string;
    details?: string;
  }>;

  // Context (solo datos del sistema)
  context: {
    plan: 'free' | 'premium';
    timestamp: string;
    // ❌ NO más campos extensibles aquí (movidos a enrichments)
  };
}

/**
 * MessageEnrichment - Datos aportados por extensiones (v3.0)
 * Se persisten SEPARADOS del núcleo
 */
interface MessageEnrichment {
  messageId: string;          // FK a MessageEnvelopeCore
  tenantId: string;           // ← Aislamiento por tenant
  extensionId: string;        // "ai-assistant", "sentiment-analyzer"
  extensionVersion: string;   // "1.2.0"

  data: Record<string, unknown>;  // Datos específicos de la extensión

  metadata: {
    createdAt: string;
    updatedAt: string;
    ttl?: number;             // Time-to-live (para datos efímeros)
    persistent: boolean;      // false = borrar al cerrar conversación
  };
}
```

**⚠️ REGLAS:**
- Nunca mutar statusChain entries, solo append
- Siempre preservar todos los campos
- Extensiones NO modifican MessageEnvelopeCore
- Enrichments se guardan en tabla separada

---

## Multi-Tenancy

**From ARCHITECTURE.md Section 7.4:**

**Database Schema:**
- `tenants`: Organizations con planes (starter, professional, enterprise)
- `adminUsers`: Dashboard users con roles (owner, admin, agent, viewer)
- `endUsers`: External customers (WhatsApp contacts)
- `conversations`, `messages`: Scoped to `tenantId`
- `tenant_extensions`: Extensiones habilitadas por tenant
- `message_enrichments`: Enriquecimientos con aislamiento por tenant

**⚠️ CRITICAL RULE:** ALL queries MUST filter by `tenantId` from JWT.

**Example:**
```typescript
const conversations = await db.query.conversations.findMany({
  where: and(
    eq(conversations.tenantId, auth.tenantId),  // SIEMPRE
    eq(conversations.status, 'active')
  )
});
```

---

## Authentication

**From ARCHITECTURE.md Section 9.1:**

**JWT Structure:**
```json
{
  "sub": "user-id",
  "email": "admin@company.com",
  "tenant_id": "tenant-123",
  "role": "admin",
  "iat": 1234567890,
  "exp": 1234654290  // 24h default
}
```

**Roles:**
- `owner`: Full access
- `admin`: Team + conversations management
- `agent`: Conversations only
- `viewer`: Read-only

**Middleware:** `jwt-auth.ts` extracts JWT → validates → adds to `store.auth`

---

## CRITICAL ISSUES from AUDIT-REPORT.md

### P0 - BLOQUEANTES (fix before production)

**1. Merge Conflicts (Section 1.1):**
- Files: `routes/index.ts` (lines 6-83), `routes/admin/auth.ts` (lines 1-683)
- **Impact:** Code does not compile
- **Action:** Resolve conflicts immediately

**2. Duplicate Auth Dependencies (Section 1.2):**
- `bcrypt + jsonwebtoken` vs `jose + @elysiajs/jwt`
- **Impact:** Inconsistency, security risk
- **Action:** Choose ONE (recommend `jose + @elysiajs/jwt` for Elysia)

**3. MemoryPersistence in Production (Section 1.3):**
```typescript
// services/index.ts:59
export const persistence = new MemoryPersistence();  // ⚠️ DATA LOSS ON RESTART
```
- **Impact:** ALL messages lost on server restart
- **Action:** Implement `DatabasePersistence` using PostgreSQL

**4. JWT_SECRET Hardcoded Fallback (Section 1.4):**
```typescript
jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production'  // ⚠️ SECURITY RISK
```
- **Impact:** Anyone can forge tokens if env var missing
- **Action:** Make JWT_SECRET required, throw error if missing

**5. SQL Injection Risk (Section 1.6):**
- **Issue:** Some endpoints may use string interpolation in queries
- **Action:** ALWAYS use parameterized queries ($1, $2, ...) or Drizzle ORM

**6. No Automated Tests (Section 1.5):**
- **Coverage:** 0%
- **Impact:** No regression detection, unsafe refactoring
- **Action:** Implement Bun Test framework, start with MessageCore

**7. Passwords in Logs (Section 1.8):**
- **Risk:** Logging request body without sanitization
- **Action:** Implement `sanitizeForLogging()` function

### P1 - URGENT (fix this sprint)

**From AUDIT-REPORT.md Section 2:**
- Implement rate limiting on auth endpoints (Section 3.2)
- Create services/repositories layer (Section 2.2)
- Optimize N+1 queries (Section 4.1)
- Add input validation to all endpoints (Section 2.3)

---

## Database Management

**Schema:** `packages/shared/src/database/schema.ts` (Drizzle ORM)

**Migrations:**
```bash
# 1. Edit schema.ts
# 2. Generate migration
bun run db:generate

# 3. Review migration in drizzle/migrations/
# 4. Apply (PRODUCTION - safe)
bun run db:migrate

# OR push directly (DEV ONLY - dangerous)
bun run db:push
```

**Connection:** `packages/shared/src/database/config.ts`

---

## WebSocket Events

**Endpoint:** `ws://localhost:3000/realtime`

**Emitted to clients:**
- `connection`: Connection established
- `message:new`: New message + enrichments
- `message:status`: Status updated
- `typing:indicator`: User typing
- `conversation:updated`: Conversation changed
- `enrichment:new`: Nueva capa de enriquecimiento disponible
- `client_toggle`, `extension_toggle`: Simulation events

**Received from clients:**
- `typing`: Typing indicator
- `message_received`: Message acknowledgment

---

## Contract Changes (Extensiones)

When creating a new extension:

1. **Define schema** con `getEnrichmentSchema()`
2. **Register in marketplace** (futuro: public registry)
3. **Test isolation** - No debe afectar otras extensiones
4. **Document permissions** - Qué datos accede
5. **Provide tenant config UI** - Para que admins configuren

When modifying types in `packages/shared/src/types/`:

1. Update backend type definition
2. **Notify frontend team** (they must mirror manually)
3. Document changes in commit message
4. Test both sides together
5. Consider backward compatibility

---

## Security Rules (from ARCHITECTURE.md Section 9)

**Multi-Tenancy Isolation:**
1. ✅ Filter ALL queries by `tenantId`
2. ✅ JWT includes `tenant_id`
3. ✅ Validate tenant access in middleware
4. ✅ Extensiones solo leen datos de su tenant
5. ❌ Never allow cross-tenant access

**Extension Sandbox:**
1. ✅ Execute extensions in Workers (isolated)
2. ✅ Timeout per extension (default 5s)
3. ✅ Rate limiting per extension
4. ✅ Validate enrichment schemas
5. ❌ Never trust extension output without validation

**SQL Injection Prevention:**
```typescript
// ❌ VULNERABLE
await pool.query(`SELECT * FROM users WHERE email = '${email}'`);

// ✅ SAFE
await pool.query('SELECT * FROM users WHERE email = $1', [email]);
```

**Secrets Management:**
- ❌ Never hardcode secrets
- ✅ Always use environment variables
- ✅ Validate secrets exist on startup
- ✅ Rotate secrets regularly

---

## Extension Development Guide (Third-Party)

**Prerequisites:**
- TypeScript knowledge
- Understanding of INHOST MessageEnvelope contract
- Access to Extension SDK (`@inhost/extension-sdk`)

**Steps:**

1. **Install SDK:**
   ```bash
   npm install @inhost/extension-sdk
   ```

2. **Implement IMessageExtension:**
   ```typescript
   import { IMessageExtension, ExtensionContext } from '@inhost/extension-sdk';

   export class MyCustomExtension implements IMessageExtension {
     id = 'my-custom-extension';
     name = 'My Custom Extension';
     version = '1.0.0';
     publisher = 'YourCompany';

     getEnrichmentSchema() {
       return {
         extensionId: this.id,
         version: this.version,
         dataSchema: {
           type: 'object',
           properties: {
             customField: { type: 'string' }
           }
         }
       };
     }

     async enrich(message, context) {
       // Your logic here
       return {
         success: true,
         data: { customField: 'value' }
       };
     }
   }
   ```

3. **Test Locally:**
   ```bash
   npm run test:extension
   ```

4. **Submit to Marketplace:**
   - Package extension: `npm run build:extension`
   - Submit via INHOST Developer Portal
   - Aguardar aprobación (security review)

5. **Tenant Installation:**
   - Tenant admin enables extension from marketplace
   - Configure permissions and settings
   - Extension runs automatically on new messages

---

## Critical Rules Summary

1. ✅ All message operations through MessageCore
2. ✅ Always filter by `tenantId`
3. ✅ Only append to statusChain
4. ✅ Use parameterized queries
5. ✅ Validate JWT_SECRET on startup
6. ✅ Implement DatabasePersistence before production
7. ✅ Extensions enrich, never modify MessageEnvelopeCore
8. ✅ Validate extension schemas before persisting
9. ❌ Never use MemoryPersistence in production
10. ❌ Never return data from other tenants
11. ❌ Never skip auth on /admin/* routes
12. ❌ Never use `db:push` in production
13. ❌ Never trust extension output without validation

**For cross-stack issues:** Coordinate with frontend team. Changes to MessageEnvelope, API contracts, or WebSocket events require synchronized updates.

---

## Deployment Checklist

**Before deploying to production:**
- [ ] Resolve merge conflicts
- [ ] Implement DatabasePersistence
- [ ] Implement DatabaseEnrichmentStore (v3.0)
- [ ] Choose ONE auth library
- [ ] Configure JWT_SECRET (required)
- [ ] Fix SQL injection vulnerabilities
- [ ] Implement sanitizeForLogging
- [ ] Run migrations: `bun run db:migrate`
- [ ] Configure environment variables
- [ ] Set up monitoring
- [ ] Configure extension sandbox (Workers)
- [ ] Enable extension marketplace (if applicable)

---

## Documentation

- **Architecture:** `docs/ARCHITECTURE.md` (1960 lines)
- **Audit Report:** `docs/AUDIT-REPORT.md` (1748 lines)
- **API Documentation:** `docs/API-DOCUMENTATION.md`
- **Extension Guide:** `docs/EXTENSION-DEVELOPMENT.md` (pending)
- **Enrichment Architecture:** `../ENRICHMENT-ANALYSIS.md` (detailed design)

---

**This is the BACKEND monorepo.** Frontend lives at `../inhost-frontend/` as a completely separate monorepo.
