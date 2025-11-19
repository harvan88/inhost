# Base de Datos - INHOST

Guía completa sobre cómo funciona la base de datos en INHOST.

## 🎯 Stack de Base de Datos

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **PostgreSQL** | 15 | Base de datos relacional |
| **Drizzle ORM** | 0.44.7 | ORM TypeScript-first |
| **pg** | 8.16.3 | Cliente PostgreSQL para Node.js |
| **Redis** | 7-alpine | Cache y rate limiting (opcional) |

## 📋 Esquema de Base de Datos

### Tablas Actuales

#### 1. **conversations** - Conversaciones entre usuarios

```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id VARCHAR(255) NOT NULL,
    participant VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('whatsapp', 'telegram', 'web', 'sms')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_conversations_owner_id ON conversations(owner_id);
CREATE INDEX idx_conversations_participant ON conversations(participant);
```

**Campos:**
- `id` - UUID único de la conversación
- `owner_id` - ID del usuario propietario (el que usa INHOST)
- `participant` - Teléfono o ID del participante (cliente externo)
- `channel` - Canal de comunicación (whatsapp, telegram, web, sms)
- `created_at`, `updated_at` - Timestamps automáticos

#### 2. **messages** - Mensajes de las conversaciones

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('incoming', 'outgoing', 'system', 'status')),
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('whatsapp', 'telegram', 'web', 'sms')),
    content JSONB NOT NULL,
    metadata JSONB NOT NULL,
    status_chain JSONB DEFAULT '[]',
    context JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

**Campos:**
- `id` - UUID único del mensaje
- `conversation_id` - Relación con conversations
- `type` - Tipo de mensaje (incoming/outgoing/system/status)
- `channel` - Canal del mensaje
- `content` - JSONB con contenido del mensaje (texto, media, etc.)
- `metadata` - JSONB con metadatos (from, to, timestamp, etc.)
- `status_chain` - JSONB array con historial de estados
- `context` - JSONB con contexto (plan, features, etc.)

#### 3. **users** - Usuarios del sistema

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    plan VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Campos:**
- `id` - UUID único del usuario
- `email` - Email único del usuario
- `name` - Nombre del usuario (opcional)
- `plan` - Plan actual (free/premium) - **LEGACY, usar capabilities**
- `created_at`, `updated_at` - Timestamps automáticos

### Tablas Pendientes (Sistema de Capacidades)

#### 4. **user_capabilities** - Capacidades por usuario (NUEVO)

```sql
-- Tabla para sistema de capacidades (reemplaza planes hardcodeados)
CREATE TABLE user_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB NOT NULL DEFAULT '{}',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, service_id)
);

CREATE INDEX idx_user_capabilities_user_id ON user_capabilities(user_id);
CREATE INDEX idx_user_capabilities_service_id ON user_capabilities(service_id);
CREATE INDEX idx_user_capabilities_expires_at ON user_capabilities(expires_at);
```

**Ejemplo de datos:**

```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "service_id": "ai-assistant",
  "enabled": true,
  "config": {
    "limits": {
      "quota": 1000
    },
    "features": {
      "model": "gpt-4"
    }
  },
  "expires_at": "2025-12-31T23:59:59Z"
}
```

#### 5. **service_usage** - Tracking de uso (NUEVO)

```sql
-- Tabla para tracking de uso de servicios
CREATE TABLE service_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id VARCHAR(100) NOT NULL,
    count INTEGER DEFAULT 0,
    reset_at TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, service_id)
);

CREATE INDEX idx_service_usage_user_id ON service_usage(user_id);
CREATE INDEX idx_service_usage_reset_at ON service_usage(reset_at);
```

## 🔧 Configuración

### 1. Docker Compose (Desarrollo)

```bash
# Iniciar PostgreSQL + Redis
bun run dev:db

# Detener
bun run dev:db:stop
```

**docker-compose.yml:**
```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: inhost
      POSTGRES_USER: inhost_user
      POSTGRES_PASSWORD: inhost_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
```

### 2. Variables de Entorno

```bash
# .env (crear desde .env.example)
DATABASE_URL=postgresql://inhost_user:inhost_password@localhost:5432/inhost
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Conexión (Drizzle ORM)

**Archivo:** `packages/shared/src/database/config.ts`

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'inhost_user',
  password: 'inhost_password',
  database: 'inhost',
});

export const db = drizzle(pool);
```

### 4. Esquema (Drizzle)

**Archivo:** `packages/shared/src/database/schema.ts`

```typescript
import { pgTable, uuid, text, timestamp, jsonb, varchar } from 'drizzle-orm/pg-core';

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  type: varchar('type', { enum: ['incoming', 'outgoing', 'system', 'status'] }).notNull(),
  channel: varchar('channel', { enum: ['whatsapp', 'telegram', 'web', 'sms'] }).notNull(),
  content: jsonb('content').notNull(),
  metadata: jsonb('metadata').notNull(),
  statusChain: jsonb('status_chain').default([]),
  context: jsonb('context').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Inferir tipos TypeScript
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
```

## 🚀 Migraciones

### Setup Inicial

```bash
# 1. Iniciar base de datos
bun run dev:db

# 2. Crear tablas manualmente (primera vez)
psql -h localhost -U inhost_user -d inhost -f scripts/create-tables.sql

# O usar script de migración
bun run migrate
```

### Crear Nueva Migración (futuro)

```bash
# Generar migración desde schema
bunx drizzle-kit generate:pg

# Aplicar migraciones
bunx drizzle-kit push:pg
```

## 💻 Uso en Código

### 1. Insertar Mensaje

```typescript
import { db } from '@inhost/shared';
import { messages } from '@inhost/shared';

// Insertar
await db.insert(messages).values({
  type: 'incoming',
  channel: 'whatsapp',
  content: { text: 'Hola' },
  metadata: {
    from: '+1234567890',
    to: '+0987654321',
    timestamp: new Date().toISOString()
  },
  context: { plan: 'free' }
});
```

### 2. Consultar Mensajes

```typescript
import { db } from '@inhost/shared';
import { messages, conversations } from '@inhost/shared';
import { eq, desc } from 'drizzle-orm';

// Obtener últimos 10 mensajes
const recentMessages = await db
  .select()
  .from(messages)
  .orderBy(desc(messages.createdAt))
  .limit(10);

// Mensajes de una conversación
const conversationMessages = await db
  .select()
  .from(messages)
  .where(eq(messages.conversationId, conversationId))
  .orderBy(messages.createdAt);
```

### 3. Join con Conversations

```typescript
import { db } from '@inhost/shared';
import { messages, conversations } from '@inhost/shared';

// Join para obtener mensajes con datos de conversación
const messagesWithConversation = await db
  .select()
  .from(messages)
  .leftJoin(conversations, eq(messages.conversationId, conversations.id))
  .where(eq(conversations.ownerId, userId));
```

## 🔄 Estado Actual vs Futuro

### Actualmente (V1 - In Memory)

```typescript
// Persistencia en memoria (se pierde al reiniciar)
export const persistence = new MemoryPersistence();

// Mensajes se guardan en Map
private messages: Map<string, MessageEnvelope> = new Map();
```

### Futuro (V2 - PostgreSQL)

```typescript
// Persistencia en PostgreSQL (permanente)
export class DatabasePersistence implements IPersistenceService {
  async save(envelope: MessageEnvelope): Promise<PersistenceResult> {
    await db.insert(messages).values({
      id: envelope.id,
      type: envelope.type,
      channel: envelope.channel,
      content: envelope.content,
      metadata: envelope.metadata,
      statusChain: envelope.statusChain,
      context: envelope.context
    });

    return { success: true, messageId: envelope.id };
  }

  async query(query: MessageQuery): Promise<MessageEnvelope[]> {
    return await db
      .select()
      .from(messages)
      .orderBy(desc(messages.createdAt))
      .limit(query.limit || 10);
  }
}
```

## 📊 Integración con Sistema de Capacidades

### Migrar de Planes Hardcodeados a DB

**Actualmente:**
```typescript
// SimplePlanResolver - hardcoded en memoria
private userPlans: Map<string, Plan> = new Map();
```

**Futuro (V2):**
```typescript
// DatabaseServiceGate - persiste en PostgreSQL
export class DatabaseServiceGate implements IServiceGate {
  async getUserCapabilities(userId: string): Promise<UserCapabilities> {
    // Obtener de DB
    const capabilities = await db
      .select()
      .from(user_capabilities)
      .where(eq(user_capabilities.userId, userId));

    // Convertir a Map
    const services = new Map();
    for (const cap of capabilities) {
      services.set(cap.serviceId, {
        enabled: cap.enabled,
        limits: cap.config.limits,
        features: cap.config.features
      });
    }

    return { userId, services };
  }

  async recordServiceUsage(userId: string, service: ServiceId, amount = 1) {
    // Upsert en service_usage
    await db
      .insert(service_usage)
      .values({
        userId,
        serviceId: service,
        count: amount,
        resetAt: new Date(Date.now() + 60000)
      })
      .onConflictDoUpdate({
        target: [service_usage.userId, service_usage.serviceId],
        set: { count: sql`${service_usage.count} + ${amount}` }
      });
  }
}
```

## 🧪 Testing

### Verificar Conexión

```bash
# Ping a PostgreSQL
psql -h localhost -U inhost_user -d inhost -c "SELECT version();"

# Listar tablas
psql -h localhost -U inhost_user -d inhost -c "\dt"

# Ver datos
psql -h localhost -U inhost_user -d inhost -c "SELECT * FROM messages LIMIT 5;"
```

### Health Check desde API

```bash
curl http://localhost:3000/health
# → Verifica conexión a PostgreSQL
```

## 📋 Scripts Útiles

```bash
# Backup base de datos
pg_dump -h localhost -U inhost_user inhost > backup.sql

# Restaurar backup
psql -h localhost -U inhost_user -d inhost < backup.sql

# Limpiar todas las tablas
psql -h localhost -U inhost_user -d inhost -c "TRUNCATE messages, conversations, users CASCADE;"

# Contar mensajes
psql -h localhost -U inhost_user -d inhost -c "SELECT COUNT(*) FROM messages;"
```

## 🔐 Seguridad

**Producción:**
- ✅ Usar variables de entorno para credenciales
- ✅ Conexiones SSL/TLS a PostgreSQL
- ✅ Roles de DB con permisos mínimos
- ✅ Connection pooling (pg Pool)
- ✅ Prepared statements (Drizzle lo hace automático)
- ✅ Índices en campos de búsqueda frecuente

## 🚧 Roadmap

### V1 (Actual) ✅
- [x] PostgreSQL configurado via Docker
- [x] Drizzle ORM setup
- [x] Tablas básicas (messages, conversations, users)
- [x] Persistencia en memoria (MemoryPersistence)

### V2 (Próximo)
- [ ] Migrar a DatabasePersistence (PostgreSQL)
- [ ] Tabla user_capabilities
- [ ] Tabla service_usage
- [ ] DatabaseServiceGate implementation
- [ ] Migraciones con Drizzle Kit

### V3 (Futuro)
- [ ] Replicación PostgreSQL
- [ ] Particionado de tablas grandes
- [ ] Full-text search en mensajes
- [ ] Analytics y reporting
- [ ] Backup automatizado

## 📚 Recursos

- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)
- [PostgreSQL 15 Docs](https://www.postgresql.org/docs/15/)
- [node-postgres (pg)](https://node-postgres.com/)
- [Esquema actual](../../packages/shared/src/database/schema.ts)
- [SQL de creación](../../scripts/create-tables.sql)
