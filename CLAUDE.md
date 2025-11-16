# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**INHOST** is a multi-channel messaging API Gateway built on Bun + Elysia.js, designed with interface-based modular architecture for incremental development. Currently in **Sprint 2 (Protection & Security)** testing phase.

## Development Commands

### Starting the System (Required: 2 Terminals)

```bash
# Terminal 1: API Server (Port 3000)
start-server.bat                    # Recommended - checks for conflicts
# OR
bun --cwd apps/api-gateway dev      # Manual

# Terminal 2: Testing Dashboard Server (Port 5500)
start-testing.bat                   # Serves testing/ directory via HTTP
# OR
cd testing && bun server.js         # Manual

# Browser: http://localhost:5500 (NOT file://)
```

### Health Checks

```bash
# Verify server status
curl http://localhost:3000/health

# Check process count (MUST be exactly 3 lines)
tasklist | findstr bun.exe

# Test message endpoint
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -H "X-User-Id: test" \
  -d '{"type":"incoming","channel":"whatsapp","content":{"text":"Test"},"metadata":{"from":"+1","to":"+2","timestamp":"2025-11-16T10:00:00Z"}}'
```

### Testing

**Manual Testing:**
1. Open `http://localhost:5500` in browser
2. Select test suite from sidebar (e.g., "Sprint 2 Protection")
3. Run tests via dashboard

**Automated Testing:**
```bash
# Rate limiting test (15 rapid requests)
for i in {1..15}; do
  curl -X POST http://localhost:3000/messages \
    -H "Content-Type: application/json" \
    -H "X-User-Id: test-user" \
    -d '{"type":"incoming","channel":"whatsapp","content":{"text":"Test"},"metadata":{"from":"+1","to":"+2","timestamp":"2025-11-16T10:00:00Z"}}'
done
```

## Architecture

### Interface-Based Modular Design

The codebase follows a **strict interface-contract pattern** allowing incremental evolution:

```
apps/api-gateway/src/
├── core/
│   ├── MessageCore.ts              # Orchestrator - receives/sends messages
│   └── interfaces/                 # Contracts (NEVER change)
│       ├── IAdapter.ts             # sendMessage(), receiveMessage()
│       ├── IRateLimiter.ts         # checkLimit()
│       ├── IPersistenceService.ts  # save(), retrieve()
│       ├── INotificationService.ts # broadcast()
│       └── ...
├── implementations/v1/             # Current implementations (can evolve)
│   ├── MemoryRateLimiter.ts       # In-memory rate limiting
│   ├── MemoryPersistence.ts       # In-memory storage
│   └── ...
├── middleware/                     # Elysia middleware
│   ├── rateLimiting.ts            # Rate limit enforcement
│   ├── validation.ts              # TypeBox validation
│   ├── timeout.ts                 # Request timeout protection
│   └── logger.ts                  # HTTP logging
├── routes/                         # API endpoints
│   ├── messages.ts                # POST/GET /messages
│   ├── health.ts                  # GET /health
│   └── websocket.ts               # WS /realtime
└── adapters/                       # Channel adapters
    └── simulators/                # Simulated adapters (Sprint 1)
```

### MessageCore - The Orchestrator

`MessageCore` is the central orchestrator that:
1. Receives messages from any source (adapter, UI, extension)
2. Persists immediately via `IPersistenceService`
3. Broadcasts to interested parties via `INotificationService`
4. Delivers outgoing messages via adapters

**Key principle:** MessageCore is **lightweight** - it delegates to specialized services via interfaces.

### Dependency Injection Pattern

Services are injected into `MessageCore`:
```typescript
new MessageCore(
  persistence: IPersistenceService,    // How to store
  notifications: INotificationService, // How to notify
  planResolver: IPlanResolver,         // Which plan?
  ownerChecker: IOwnerChecker,         // Who owns?
  adapters: AdapterManager             // How to send?
)
```

This allows swapping implementations without changing core logic.

## Critical Gotchas

### 1. Bun Process Architecture

**Bun creates 3 processes per instance - THIS IS NORMAL:**
```bash
tasklist | findstr bun.exe
# Expected output (1 instance):
bun.exe    XXXXX    Console    6    ~44 KB    ✅
bun.exe    XXXXX    Console    6    ~23 KB    ✅
bun.exe    XXXXX    Console    6   ~170 KB    ✅

# PROBLEM (2+ instances):
bun.exe    ... (6+ lines = multiple instances)
```

**Fix multiple instances:**
```bash
cmd //c "taskkill /F /IM bun.exe"  # Kill all
timeout /t 2                        # Wait
bun --cwd apps/api-gateway dev      # Start one
```

### 2. CORS File Protocol Issue

**The testing dashboard MUST be served via HTTP, NOT opened directly:**

❌ **WRONG:** `file:///C:/Users/.../testing/index.html`
- Browser blocks all fetch() requests to localhost (CORS policy)
- Causes "Failed to fetch" on ALL tests

✅ **CORRECT:** `http://localhost:5500`
- Testing server serves files via HTTP
- CORS works correctly

**Solution:** Always use `start-testing.bat` (starts HTTP server on port 5500)

### 3. Two Terminals Required

The system requires **TWO separate processes:**
- **Terminal 1:** API server (port 3000) - `start-server.bat`
- **Terminal 2:** Testing dashboard server (port 5500) - `start-testing.bat`

### 4. Elysia Middleware Lifecycle Hooks (CRITICAL)

**In Elysia 1.2.0, when applying middleware with `.use()` to scoped instances:**

❌ **DON'T USE:** `.derive()` or `.onBeforeHandle()`
- These hooks **do NOT execute** when middleware is applied via `.use()` to a sub-route (e.g., `messagesRoutes`)
- Will cause silent failures - middleware appears registered but never runs

✅ **USE:** `.onRequest()`
- Executes correctly even when middleware is applied via `.use()` to scoped Elysia instances
- Runs before all other processing

**Example:**
```typescript
// ❌ WRONG - This never executes:
export function rateLimiting(config) {
  return new Elysia()
    .derive(async ({ request, set }) => {
      set.headers['X-RateLimit-Limit'] = '30';  // Never runs!
    });
}

// ✅ CORRECT - This works:
export function rateLimiting(config) {
  return new Elysia()
    .onRequest(async ({ request, set }) => {
      set.headers['X-RateLimit-Limit'] = '30';  // Runs correctly
    });
}
```

**File:** [apps/api-gateway/src/middleware/rateLimiting.ts](apps/api-gateway/src/middleware/rateLimiting.ts)

## Sprint-Based Development

The project follows incremental sprint-based development:

- ✅ **Sprint 1:** MessageCore + Basic Routes
- ✅ **Sprint 1.5:** Support Services (Logger, Storage, RateLimiter interfaces)
- 🔄 **Sprint 2:** Protection & Security (Rate Limiting, Validation, Timeout) - **TESTING PHASE**
- 📅 **Sprint 3:** WebSocket Real-time (Planned)

## Current State & Session Startup

**ALWAYS read at start of each session:**
- [PENDIENTES-SPRINT2.md](PENDIENTES-SPRINT2.md) - Current pending tasks, known issues, investigation needed

**Sprint 2 Status:**
- ✅ Validation: Working (HTTP 422 on invalid payloads)
- ⚠️ Rate Limiting: Implemented but needs verification (headers not visible in tests)
- ⚠️ Timeout: Implemented but needs testing with slow requests

## Documentation Structure

```
inhost/
├── README.md                   # Project overview
├── QUICK-START.md             # 4-step startup guide
├── PENDIENTES-SPRINT2.md      # Current session state (READ FIRST)
└── docs/
    ├── architecture/          # System design
    │   ├── plan-modular.md   # Interface-based architecture explanation
    │   └── frontend-strategy.md
    ├── guides/               # Testing guides
    │   ├── sprint1-testing.md
    │   └── sprint2-testing.md
    └── troubleshooting/      # Common issues
        ├── failed-to-fetch.md      # CORS & multiple instances
        └── multiple-instances.md   # Bun process management
```

## Common Patterns

### Adding a New Interface

1. Define interface in `core/interfaces/`:
```typescript
export interface IMyService {
  doSomething(input: string): Promise<Result>;
}
```

2. Create V1 implementation in `implementations/v1/`:
```typescript
export class SimpleMyService implements IMyService {
  async doSomething(input: string): Promise<Result> {
    // Simple implementation
  }
}
```

3. Inject into `MessageCore` or middleware
4. Later: Create V2 implementation **without changing interface**

### Adding Middleware to Routes

Middleware is applied via Elysia's `.use()`:
```typescript
// routes/messages.ts
export const messagesRoutes = new Elysia()
  .use(httpLogger)              // HTTP logging
  .use(validateJSON())          // Validation
  .use(rateLimiting({...}))     // Rate limiting
  .use(timeout(30000))          // Timeout protection
  .post('/messages', handler)   // Route handler
```

## Tech Stack

- **Runtime:** Bun
- **Framework:** Elysia.js (Bun-optimized Express alternative)
- **Validation:** TypeBox (Type-safe schemas)
- **Database:** PostgreSQL via Prisma
- **Testing:** Custom HTML/JS dashboard + curl
- **WebSocket:** Built into Elysia

## Troubleshooting Quick Reference

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| "Failed to fetch" (all tests) | Dashboard opened from `file://` | Use `start-testing.bat` → `http://localhost:5500` |
| "Failed to fetch" (intermittent) | Multiple server instances | Kill all bun processes, restart one instance |
| 6+ bun.exe processes | 2+ server instances running | `taskkill /F /IM bun.exe` → restart |
| Server won't start | Previous instance not killed | `taskkill /F /IM bun.exe` |
| Tests work in curl, fail in dashboard | Dashboard not served via HTTP | Must use `http://localhost:5500` not `file://` |

## Message Format

All messages follow `MessageEnvelopeV2` schema:
```typescript
{
  id: string;
  type: 'incoming' | 'outgoing' | 'system' | 'status';
  channel: 'whatsapp' | 'telegram' | 'web' | 'sms';
  content: {
    text: string;
    // ... optional media, buttons, etc.
  };
  metadata: {
    from: string;
    to: string;
    timestamp: string;
  };
  status?: MessageStatus;
}
```
