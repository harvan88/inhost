# 🔄 Plan de Migración de Contratos (V1 → V2 Multi-Tenancy)

## 📊 Estado Actual

### Contrato V1 (api-contract.json)
**Version:** 1.0.0
**Uso:** Frontend actual (inhostfrontend)
**Headers:** `X-User-Id` (ambiguo - no distingue tenant user vs end user)

**Endpoints Implementados:**
```
✅ GET  /health
✅ POST /messages
✅ GET  /messages
✅ POST /simulate/client-message
✅ POST /simulate/extension-toggle
✅ GET  /simulate/status
✅ GET  /me/capabilities
✅ GET  /me/usage
✅ GET  /me/services/:serviceId
✅ WS   /realtime
```

### Nuevos Contratos V2 (Multi-Tenancy)
**Version:** 2.0.0-multi-tenancy

**1. api-contract-admin.json**
- Para: Tenant Users (admins, agentes)
- Auth: JWT (Bearer token)
- Endpoints: `/admin/*`

**2. api-contract-chat.json**
- Para: External Services (WhatsApp, Instagram, UIs externas)
- Auth: Headers (X-Tenant-Id + X-End-User-Phone/Id)
- Endpoints: `/chat/*`

---

## 🎯 Estrategia de Migración

### Opción Recomendada: **Versionado con Backward Compatibility**

```
Fase 1: Mantener V1 (deprecated) + Implementar V2
├── /v1/* → Endpoints legacy (usar api-contract.json)
├── /admin/* → Nuevos endpoints para tenant users
└── /chat/* → Nuevos endpoints para external services

Fase 2: Dual Support (6 meses)
├── /v1/* → DEPRECATED (avisar en headers)
├── /admin/* → Producción
└── /chat/* → Producción

Fase 3: Sunset V1
└── Eliminar /v1/* completamente
```

---

## 📋 Mapeo de Endpoints

### Endpoints que se MANTIENEN (legacy /v1/*)

| Endpoint V1 | Nuevo V2 | Estado | Nota |
|-------------|----------|--------|------|
| `GET /health` | `GET /health` | ✅ Mantener | Sin cambios, público |
| `POST /simulate/*` | `POST /simulate/*` | ✅ Mantener | Solo desarrollo |
| `WS /realtime` | `WS /admin/realtime` + `WS /chat/realtime` | ⚠️ Migrar | Separar en 2 canales |

### Endpoints que se MIGRAN a /admin/*

| Endpoint V1 | Nuevo V2 Admin | Cambio |
|-------------|----------------|--------|
| `GET /me/capabilities` | `GET /admin/capabilities` | JWT auth |
| `GET /me/usage` | `GET /admin/analytics/usage` | JWT auth, más detalles |
| `GET /me/services/:serviceId` | `GET /admin/capabilities/:serviceId` | JWT auth |
| `GET /messages` | `GET /admin/conversations` | JWT auth, multi-canal |
| `POST /messages` | `POST /admin/conversations/:id/messages` | JWT auth, contexto |

### Endpoints NUEVOS (solo en V2)

**Admin (/admin/*):**
- `POST /admin/auth/login` - Login JWT
- `POST /admin/auth/signup` - Signup nuevo tenant
- `GET /admin/tenant` - Info de organización
- `GET /admin/end-users` - Listar clientes finales
- `GET /admin/team` - Gestión de equipo
- `GET /admin/analytics/dashboard` - Métricas

**Chat (/chat/*):**
- `POST /chat/webhook/whatsapp` - Webhook WhatsApp
- `POST /chat/webhook/instagram` - Webhook Instagram
- `POST /chat/messages/send` - Enviar desde UI externa
- `GET /chat/messages/history` - Historial end-user

---

## 🔧 Implementación por Fases

### ✅ FASE 0: Preparación (YA HECHO)

- [x] Crear `api-contract-admin.json`
- [x] Crear `api-contract-chat.json`
- [x] Crear multi-tenancy database schema
- [x] Documentación de migración

### 📝 FASE 1: Implementar V2 Endpoints (2-3 semanas)

#### Week 1: Admin Auth + Core
```bash
apps/api-gateway/src/routes/admin/
├── auth.ts          # Login, signup, me, logout
├── tenant.ts        # GET/PATCH tenant info
└── index.ts         # Admin routes aggregator
```

**Tareas:**
- [ ] Implementar JWT middleware
- [ ] Crear `/admin/auth/*` endpoints
- [ ] Crear `/admin/tenant` endpoints
- [ ] Setup JWT secret en .env
- [ ] Tests de autenticación

#### Week 2: Admin Dashboard Data
```bash
apps/api-gateway/src/routes/admin/
├── conversations.ts # Listar conversaciones
├── end-users.ts     # Listar end-users
├── team.ts          # Gestionar team
└── capabilities.ts  # Ver/toggle capabilities
```

**Tareas:**
- [ ] Implementar `/admin/conversations`
- [ ] Implementar `/admin/end-users`
- [ ] Implementar `/admin/team`
- [ ] Migrar capabilities a `/admin/capabilities`
- [ ] Tests E2E

#### Week 3: Chat API (External Services)
```bash
apps/api-gateway/src/routes/chat/
├── webhook.ts       # WhatsApp/Instagram webhooks
├── messages.ts      # Send/history para UIs externas
└── index.ts         # Chat routes aggregator
```

**Tareas:**
- [ ] Implementar `/chat/webhook/*`
- [ ] Implementar `/chat/messages/*`
- [ ] Auto-create end-users on first message
- [ ] Tests con mock WhatsApp/Instagram payloads

### 📝 FASE 2: Backward Compatibility (1 semana)

#### Crear namespace /v1 con endpoints legacy

```typescript
// apps/api-gateway/src/routes/v1/index.ts
import { Elysia } from 'elysia';

export const v1Routes = new Elysia({ prefix: '/v1' })
  .use(messagesRoutes)      // Legacy /v1/messages
  .use(capabilitiesRoutes)  // Legacy /v1/me/capabilities
  .onRequest(({ set }) => {
    // Avisar que V1 está deprecated
    set.headers['X-API-Version'] = '1.0.0-deprecated';
    set.headers['X-API-Deprecation-Warning'] = 'This API version is deprecated. Please migrate to /admin or /chat endpoints. See docs: https://docs.inhost.com/migration';
  });
```

**Mapeo automático V1 → V2:**
```typescript
// Middleware de compatibilidad
export function v1CompatibilityMiddleware() {
  return new Elysia()
    .onRequest(({ request }) => {
      // Convertir X-User-Id → tenant context
      const userId = request.headers.get('x-user-id');

      // Por defecto, asumir que X-User-Id es tenant-user-id
      // (para compatibilidad con frontend actual)
      request.headers.set('x-tenant-user-id', userId);
    });
}
```

### 📝 FASE 3: Migrar Frontend (2-3 semanas)

**inhostfrontend (actual):**
- Actualizar a usar `/admin/*` endpoints
- Implementar JWT auth
- Cambiar `X-User-Id` por `Authorization: Bearer <token>`

**O crear nuevo:**
- `inhost-admin-dashboard` (Next.js)
- Usar `api-contract-admin.json` desde día 1

### 📝 FASE 4: Sunset V1 (6 meses después)

- [ ] Anunciar deprecación oficial
- [ ] Monitorear uso de `/v1/*` endpoints
- [ ] Migrar últimos usuarios
- [ ] Eliminar código legacy

---

## 🗺️ Estructura de Rutas Final

```
apps/api-gateway/src/routes/
├── index.ts                    # Main router
├── health.ts                   # GET /health (público)
├── simulate/                   # POST /simulate/* (desarrollo)
│   └── index.ts
├── v1/                         # DEPRECATED
│   ├── index.ts                # Legacy routes con warnings
│   ├── messages.ts
│   └── capabilities.ts
├── admin/                      # Tenant Users (JWT auth)
│   ├── index.ts
│   ├── auth.ts                 # POST /admin/auth/login, signup
│   ├── tenant.ts               # GET /admin/tenant
│   ├── conversations.ts        # GET /admin/conversations
│   ├── end-users.ts            # GET /admin/end-users
│   ├── team.ts                 # GET /admin/team
│   ├── capabilities.ts         # GET /admin/capabilities
│   └── analytics.ts            # GET /admin/analytics/dashboard
└── chat/                       # External Services (Header auth)
    ├── index.ts
    ├── webhook.ts              # POST /chat/webhook/whatsapp
    └── messages.ts             # POST /chat/messages/send
```

---

## 🔐 Autenticación Migrada

### V1 (Legacy)
```http
GET /me/capabilities
Headers:
  X-User-Id: test-user
```

**Problema:** No distingue tenant user vs end user

### V2 Admin
```http
GET /admin/capabilities
Headers:
  Authorization: Bearer eyJhbGc...
```

**JWT Payload:**
```json
{
  "sub": "tenant_user_id",
  "tenant_id": "tenant_uuid",
  "role": "owner",
  "email": "admin@tenant.com"
}
```

### V2 Chat
```http
POST /chat/messages/send
Headers:
  X-Tenant-Id: tenant_uuid
  X-End-User-Phone: +5215512345678
  X-Channel: whatsapp
```

---

## 📡 WebSocket Migration

### V1 (Legacy)
```javascript
ws://localhost:3000/realtime
// Un solo canal para todo
```

### V2 (Multi-Tenancy)
```javascript
// Canal Admin (Tenant Users)
wss://api.inhost.com/admin/realtime?token=<jwt>

// Canal Chat (External UIs)
wss://api.inhost.com/chat/realtime
Headers: {
  'X-Tenant-Id': 'uuid',
  'X-End-User-Phone': '+52...'
}
```

---

## 🔄 Plan de Compatibilidad Detallado

### Ejemplo: Migrar `/me/capabilities` → `/admin/capabilities`

**Paso 1: Crear nuevo endpoint `/admin/capabilities`**
```typescript
// apps/api-gateway/src/routes/admin/capabilities.ts
import { jwtAuth } from '../../middleware/jwt-auth';

export const adminCapabilitiesRoutes = new Elysia({ prefix: '/admin' })
  .use(jwtAuth()) // ← Requiere JWT
  .get('/capabilities', async ({ request }) => {
    // Extraer tenant_id del JWT
    const tenantId = request.tenantId; // Del JWT payload

    // Obtener capabilities del TENANT (no user individual)
    const capabilities = await db.query(`
      SELECT * FROM tenant_capabilities
      WHERE tenant_id = $1
    `, [tenantId]);

    return { success: true, data: capabilities };
  });
```

**Paso 2: Mantener legacy `/me/capabilities` (deprecated)**
```typescript
// apps/api-gateway/src/routes/v1/capabilities.ts
export const v1CapabilitiesRoutes = new Elysia({ prefix: '/v1/me' })
  .get('/capabilities', async ({ request, set }) => {
    // Avisar deprecación
    set.headers['X-API-Deprecated'] = 'true';
    set.headers['X-Migrate-To'] = '/admin/capabilities';

    const userId = request.headers.get('x-user-id') || 'anonymous';

    // LEGACY: Asumir que X-User-Id es tenant-user
    // Buscar tenant_id del usuario
    const user = await db.query(`
      SELECT tenant_id FROM tenant_users WHERE id = $1
    `, [userId]);

    if (!user.rows[0]) {
      return { success: false, error: 'User not found' };
    }

    const tenantId = user.rows[0].tenant_id;

    // Misma lógica que /admin/capabilities
    const capabilities = await db.query(`
      SELECT * FROM tenant_capabilities
      WHERE tenant_id = $1
    `, [tenantId]);

    return { success: true, data: capabilities };
  });
```

**Paso 3: Frontend gradual migration**
```typescript
// Frontend: detectar si hay JWT disponible
const token = localStorage.getItem('token');

let capabilities;
if (token) {
  // Usar V2 (nuevo)
  capabilities = await fetch('/admin/capabilities', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
} else {
  // Fallback a V1 (legacy)
  capabilities = await fetch('/v1/me/capabilities', {
    headers: { 'X-User-Id': userId }
  });
}
```

---

## ✅ Checklist de Migración

### Backend

- [ ] **Fase 1: V2 Endpoints**
  - [ ] `/admin/auth/*` - JWT auth
  - [ ] `/admin/tenant` - Tenant info
  - [ ] `/admin/conversations` - Conversaciones
  - [ ] `/admin/end-users` - End users
  - [ ] `/admin/team` - Team management
  - [ ] `/admin/capabilities` - Capabilities
  - [ ] `/admin/analytics` - Analytics
  - [ ] `/chat/webhook/*` - External webhooks
  - [ ] `/chat/messages/*` - External messaging

- [ ] **Fase 2: Backward Compatibility**
  - [ ] Crear namespace `/v1/*`
  - [ ] Mapear endpoints legacy
  - [ ] Agregar deprecation headers
  - [ ] Logging de uso V1 vs V2

- [ ] **Fase 3: Database**
  - [ ] Ejecutar `create-multi-tenancy-tables.sql`
  - [ ] Migrar usuarios a tenants/tenant_users
  - [ ] Migrar capabilities a tenant_capabilities

### Frontend

- [ ] **Opción A: Actualizar inhostfrontend**
  - [ ] Implementar JWT auth
  - [ ] Cambiar a `/admin/*` endpoints
  - [ ] Actualizar WebSocket

- [ ] **Opción B: Nuevo inhost-admin-dashboard**
  - [ ] Setup Next.js
  - [ ] Implementar desde cero con V2
  - [ ] Deploy

### Testing

- [ ] Tests E2E V2 endpoints
- [ ] Tests de compatibilidad V1 → V2
- [ ] Load testing
- [ ] Security audit

### Docs

- [ ] Guía de migración para clientes
- [ ] Changelog detallado
- [ ] Deprecation notices

---

## 📅 Timeline Estimado

```
Week 1-2:   Implementar /admin/* endpoints
Week 3:     Implementar /chat/* endpoints
Week 4:     Backward compatibility /v1/*
Week 5-6:   Migrar frontend
Week 7:     Testing + Deploy
Week 8-9:   Monitoreo + Ajustes
Month 6:    Sunset V1 (deprecated completamente)
```

---

## 🚀 Próximos Pasos Inmediatos

1. **Ejecutar migration SQL**
   ```bash
   psql -h localhost -U inhost_user -d inhost -f scripts/create-multi-tenancy-tables.sql
   ```

2. **Crear estructura de rutas `/admin`**
   ```bash
   mkdir -p apps/api-gateway/src/routes/admin
   touch apps/api-gateway/src/routes/admin/{index,auth,tenant,conversations,end-users}.ts
   ```

3. **Implementar JWT middleware**
   ```bash
   touch apps/api-gateway/src/middleware/jwt-auth.ts
   ```

4. **Crear primer endpoint: `/admin/auth/login`**
   - JWT generation
   - User lookup
   - Tenant context

¿Empezamos con la implementación de `/admin/auth/*` endpoints?
