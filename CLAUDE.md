# CLAUDE.md - INHOST Backend

This file provides guidance to Claude Code when working with the **INHOST backend monorepo**.

**Source:** This file is based EXCLUSIVELY on `docs/ARCHITECTURE.md` and `docs/AUDIT-REPORT.md`.

## Project Identity

**This is the BACKEND monorepo only.** The frontend lives at `../inhost-frontend/` as a completely separate monorepo.

## Stack (from ARCHITECTURE.md)

- **Runtime:** Bun 1.x
- **Framework:** Elysia.js 1.2
- **Language:** TypeScript 5.x (strict mode)
- **Database:** PostgreSQL 15 + Drizzle ORM 0.44
- **Cache:** Redis 7 (optional)
- **Authentication:** JWT (jose + @elysiajs/jwt OR bcrypt + jsonwebtoken - **⚠️ CONFLICT**)

## Development Commands

```bash
# Development
bun run dev                  # Start API gateway with watch
bun run dev:db               # Start PostgreSQL + Redis (Docker)
bun run dev:db:stop          # Stop database services

# Build
bun run build                # Build all packages
bun run type-check           # TypeScript checking

# Database
bun run db:generate          # Generate migration from schema
bun run db:push              # Push schema (DEV ONLY - dangerous!)
bun run db:migrate           # Run migrations (PRODUCTION)
bun run db:studio            # Drizzle Studio (visual DB editor)

# Testing
bun run test:whatsapp        # Test WhatsApp simulation
bun run test:messaging       # Test end-to-end messaging
```

## Architecture: Clean Architecture with Layers

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
- **THE HEART OF THE SYSTEM**
- Orchestrates ALL message operations
- Dependencies: IPersistenceService, INotificationService, IPlanResolver, IOwnerChecker, AdapterManager, IServiceGate

**Methods:**
- `receive(envelope)`: Persist → Broadcast → Update status
- `send(envelope)`: Check capabilities → Persist → Send via adapter → Update status
- `updateStatus()`: Append to statusChain (never mutate existing)

**⚠️ RULE:** All message operations MUST go through MessageCore.

### Layer 3: Domain (Interfaces + Extensions)

**Location:** `apps/api-gateway/src/core/interfaces/`, `extensions/`

**Interfaces (Contracts):**
- `IAdapter.ts`: Channel adapters (WhatsApp, Telegram, etc.)
- `IPersistenceService.ts`: Message storage
- `INotificationService.ts`: WebSocket broadcasts
- `IRateLimiter.ts`: Rate limiting
- `IMessageQueue.ts`: Message queue
- `IValidator.ts`: Message validation
- `IPlanResolver.ts`: Plan/quota resolution
- `IOwnerChecker.ts`: Presence checking
- `IServiceGate.ts`: Capability checking
- `IExtension.ts`: Pluggable extensions

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

**Adapters:**
- `SimulatedWhatsAppAdapter.ts`
- `SimulatedTelegramAdapter.ts`
- `SimulatedSMSAdapter.ts`
- `AdapterManager.ts`: Manages all adapters

## MessageEnvelope Contract

**Location:** `packages/shared/src/types/message-envelope.ts`

**From ARCHITECTURE.md Section 1.2:**

```typescript
interface MessageEnvelopeV2 {
  id: string;
  type: MessageType;  // incoming | outgoing | system | status
  channel: MessageChannel;  // whatsapp | telegram | web | sms
  content: {
    text?: string;
    contentType: string;
    media?: { url, type, caption };
    location?: { latitude, longitude, name };
    buttons?: Array<{ id, text, type }>;
  };
  metadata: {
    from: string;
    to: string;
    timestamp: string;  // ISO 8601
    messageId?: string;
    conversationId?: string;
    ownerId?: string;
    platformMessageId?: string;
    tenantId?: string;
  };
  statusChain: Array<{  // APPEND-ONLY
    status: MessageStatus;
    timestamp: string;
    messageId: string;
    details?: string;
  }>;
  context: {
    plan: 'free' | 'premium';
    timestamp: string;
    source?: string;
    extension?: { id, name, latency };
    [key: string]: unknown;
  };
}
```

**⚠️ RULES:**
- Never mutate statusChain entries, only append
- Always preserve all fields
- Validate structure before sending to MessageCore

## Multi-Tenancy

**From ARCHITECTURE.md Section 7.4:**

**Database Schema:**
- `tenants`: Organizations with plans (starter, professional, enterprise)
- `adminUsers`: Dashboard users with roles (owner, admin, agent, viewer)
- `endUsers`: External customers (WhatsApp contacts)
- `conversations`, `messages`: Scoped to `tenantId`

**⚠️ CRITICAL RULE:** ALL queries MUST filter by `tenantId` from JWT.

**Example:**
```typescript
const conversations = await db.query.conversations.findMany({
  where: and(
    eq(conversations.tenantId, auth.tenantId),  // ALWAYS
    eq(conversations.status, 'active')
  )
});
```

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

## WebSocket Events

**Endpoint:** `ws://localhost:3000/realtime`

**Emitted to clients:**
- `connection`: Connection established
- `message:new`: New message
- `message:status`: Status updated
- `typing:indicator`: User typing
- `conversation:updated`: Conversation changed
- `client_toggle`, `extension_toggle`: Simulation events

**Received from clients:**
- `typing`: Typing indicator
- `message_received`: Message acknowledgment

## Adding a New Route

**From ARCHITECTURE.md Section 3.1:**

```typescript
// routes/admin/my-feature.ts
import { Elysia } from 'elysia';
import { jwtAuth } from '../../middleware/jwt-auth';

export const myFeatureRoutes = new Elysia({ prefix: '/admin' })
  .use(jwtAuth())  // Require auth
  .get('/my-feature', async ({ store }) => {
    const auth = store.auth as AuthenticatedRequest;
    // auth.tenantId, auth.tenantUserId, auth.role available
    return { data: 'something' };
  });
```

Then register in `routes/index.ts`.

## Error Handling

**From ARCHITECTURE.md Section 3.1:**

```typescript
import { createError } from '../middleware/errorHandler';

throw createError.validation('Invalid message format');
throw createError.unauthorized('Token expired');
throw createError.notFound('Conversation not found');
throw createError.rateLimit('Too many requests');
```

## Performance Optimizations (from ARCHITECTURE.md Section 8.3)

**Connection Pooling:**
```typescript
const pool = new Pool({
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
});
```

**Avoid N+1 Queries:**
```typescript
// ✅ GOOD - Use Drizzle WITH for JOINs
const conversations = await db.query.conversations.findMany({
  with: {
    endUser: true,      // JOIN
    assignedTo: true,   // JOIN
  }
});
```

**Add Indexes:**
```typescript
// schema.ts
export const conversations = pgTable('conversations', {
  // ...
}, (table) => ({
  tenantStatusIdx: index().on(table.tenantId, table.status),
}));
```

## Configuration

**Location:** `apps/api-gateway/src/config/index.ts`

**Loads from environment:**
- Database credentials
- Redis connection
- JWT secret and expiration
- Rate limit settings
- Feature flags

## Security Rules (from ARCHITECTURE.md Section 9)

**Multi-Tenancy Isolation:**
1. ✅ Filter ALL queries by `tenantId`
2. ✅ JWT includes `tenant_id`
3. ✅ Validate tenant access in middleware
4. ❌ Never allow cross-tenant access

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

## Logging (from ARCHITECTURE.md Section 8.4)

**Structured logs with emoji prefixes:**
- 🔄 Processing
- ✅ Success
- ❌ Error
- 📢 Broadcast
- 💾 Persistence
- 📥 Incoming
- 📤 Outgoing

**Use:** `utils/observability-logger.ts` for detailed tracing

## Common Patterns

### Creating a Message

```typescript
import { v4 as uuidv4 } from 'uuid';

const envelope: MessageEnvelopeV2 = {
  id: uuidv4(),
  type: 'outgoing',
  channel: 'whatsapp',
  content: {
    text: 'Hello!',
    contentType: 'text/plain',
  },
  metadata: {
    from: 'agent-123',
    to: 'customer-456',
    timestamp: new Date().toISOString(),
    conversationId: 'conv-789',
    tenantId: user.tenantId,
    ownerId: user.userId,
  },
  statusChain: [{
    status: 'pending',
    timestamp: new Date().toISOString(),
    messageId: envelope.id,
  }],
  context: {
    plan: 'premium',
    timestamp: new Date().toISOString(),
  },
};

await messageCore.send(envelope);
```

### Querying with Tenant Isolation

```typescript
import { db } from '@inhost/shared/database';
import { eq, and } from 'drizzle-orm';

const results = await db
  .select()
  .from(conversations)
  .where(
    and(
      eq(conversations.tenantId, auth.tenantId),  // ALWAYS
      eq(conversations.id, conversationId)
    )
  );
```

## Contract Changes

When modifying types in `packages/shared/src/types/`:

1. Update backend type definition
2. **Notify frontend team** (they must mirror manually)
3. Document changes in commit message
4. Test both sides together
5. Consider backward compatibility

## Documentation

- **Architecture:** `docs/ARCHITECTURE.md` (1960 lines)
- **Audit Report:** `docs/AUDIT-REPORT.md` (1748 lines)
- **API Documentation:** `docs/API-DOCUMENTATION.md`
- **Executive Summary:** `docs/EXECUTIVE-SUMMARY.md`

## Deployment Checklist

**Before deploying to production:**
- [ ] Resolve merge conflicts
- [ ] Implement DatabasePersistence
- [ ] Choose ONE auth library
- [ ] Configure JWT_SECRET (required)
- [ ] Fix SQL injection vulnerabilities
- [ ] Implement sanitizeForLogging
- [ ] Run migrations: `bun run db:migrate`
- [ ] Configure environment variables
- [ ] Set up monitoring

## Critical Rules Summary

1. ✅ All message operations through MessageCore
2. ✅ Always filter by `tenantId`
3. ✅ Only append to statusChain
4. ✅ Use parameterized queries
5. ✅ Validate JWT_SECRET on startup
6. ✅ Implement DatabasePersistence before production
7. ❌ Never use MemoryPersistence in production
8. ❌ Never return data from other tenants
9. ❌ Never skip auth on /admin/* routes
10. ❌ Never use `db:push` in production

**For cross-stack issues:** Coordinate with frontend team. Changes to MessageEnvelope, API contracts, or WebSocket events require synchronized updates.
