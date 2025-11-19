# 🎯 Estrategia de Migración Limpia (Clean Slate)

## Decisión: Hard Migration - Sin Backward Compatibility

**Razón:** Están en fase de reestructuración, no hay necesidad de mantener compatibilidad con sistema legacy.

**Ventajas:**
- ✅ Código limpio desde día 1
- ✅ Sin complejidad de versionado
- ✅ Sin mantenimiento de código legacy
- ✅ Arquitectura correcta desde el inicio
- ✅ Más fácil de entender y documentar

**Desventajas:**
- ❌ Requiere migrar todo de una vez
- ❌ No hay rollback fácil

**Veredicto:** Adelante con clean migration (las ventajas superan las desventajas en fase de reestructuración)

---

## 📊 Comparación de Escenarios

### Escenario 1: Backward Compatibility ❌
```
Mantener:
├── /v1/messages (legacy)
├── /v1/me/capabilities (legacy)
├── /admin/* (nuevo)
└── /chat/* (nuevo)

Complejidad: ████████ 8/10
Mantenimiento: ████████ 8/10
Tiempo dev: 6-8 semanas
```

**Rechazo:** Demasiada complejidad innecesaria

### Escenario 2: Hard Migration (Clean Slate) ✅ **SELECCIONADO**
```
Eliminar todo legacy, implementar solo:
├── /admin/* (tenant users)
├── /chat/* (external services)
└── /health (público)

Complejidad: ████ 4/10
Mantenimiento: ██ 2/10
Tiempo dev: 3-4 semanas
```

**Seleccionado:** Más robusto y sencillo

### Escenario 3: Feature Flags ❌
```
Usar flags para activar/desactivar V2
Complejidad: ██████ 6/10
Mantenimiento: ██████ 6/10
```

**Rechazo:** Complejidad innecesaria

### Escenario 4: Dual API (Puertos Diferentes) ❌
```
V1: localhost:3000
V2: localhost:4000

Complejidad: ████ 4/10
Mantenimiento: ████ 4/10
```

**Rechazo:** No aporta valor real

---

## 🏗️ Plan de Migración Limpia

### FASE 1: Preparación DB (1 día)

**1.1 Backup DB actual**
```bash
pg_dump -h localhost -U inhost_user inhost > backup_pre_migration.sql
```

**1.2 Ejecutar migración**
```bash
# 1. Crear tablas multi-tenancy
psql -h localhost -U inhost_user -d inhost -f scripts/create-multi-tenancy-tables.sql

# 2. Migrar datos existentes (si hay)
psql -h localhost -U inhost_user -d inhost -f scripts/migrate-data-to-multi-tenancy.sql
```

**Resultado:**
- ✅ Tablas: `tenants`, `tenant_users`, `end_users`, `tenant_capabilities`, `tenant_usage`
- ✅ Datos migrados a estructura multi-tenancy

---

### FASE 2: Backend Limpio (2 semanas)

**2.1 Eliminar código legacy**
```bash
# Eliminar rutas viejas
rm -rf apps/api-gateway/src/routes/simulation.ts
rm -rf apps/api-gateway/src/routes/capabilities.ts  # (legacy)

# Mantener solo:
apps/api-gateway/src/routes/
├── health.ts           # Público
├── admin/              # NUEVO
│   ├── index.ts
│   ├── auth.ts
│   ├── tenant.ts
│   ├── conversations.ts
│   ├── end-users.ts
│   ├── team.ts
│   ├── capabilities.ts
│   └── analytics.ts
└── chat/               # NUEVO
    ├── index.ts
    ├── webhook.ts
    └── messages.ts
```

**2.2 Implementar `/admin/*` (1 semana)**

```typescript
// apps/api-gateway/src/routes/admin/index.ts
import { Elysia } from 'elysia';
import { jwtAuth } from '../../middleware/jwt-auth';
import { authRoutes } from './auth';
import { tenantRoutes } from './tenant';
import { conversationsRoutes } from './conversations';
import { endUsersRoutes } from './end-users';
import { teamRoutes } from './team';
import { capabilitiesRoutes } from './capabilities';
import { analyticsRoutes } from './analytics';

export const adminRoutes = new Elysia({ prefix: '/admin' })
  .use(authRoutes)  // Público (login/signup)
  .use(jwtAuth())   // ← Middleware: Todo lo demás requiere JWT
  .use(tenantRoutes)
  .use(conversationsRoutes)
  .use(endUsersRoutes)
  .use(teamRoutes)
  .use(capabilitiesRoutes)
  .use(analyticsRoutes);
```

**2.3 Implementar `/chat/*` (1 semana)**

```typescript
// apps/api-gateway/src/routes/chat/index.ts
import { Elysia } from 'elysia';
import { webhookRoutes } from './webhook';
import { messagesRoutes } from './messages';
import { chatAuth } from '../../middleware/chat-auth';

export const chatRoutes = new Elysia({ prefix: '/chat' })
  .use(chatAuth())  // Middleware: Verifica X-Tenant-Id + X-End-User-*
  .use(webhookRoutes)
  .use(messagesRoutes);
```

**2.4 Main Router (apps/api-gateway/src/index.ts)**
```typescript
import { Elysia } from 'elysia';
import { healthRoutes } from './routes/health';
import { adminRoutes } from './routes/admin';
import { chatRoutes } from './routes/chat';
import { adminWebSocket } from './routes/admin/websocket';
import { chatWebSocket } from './routes/chat/websocket';

const app = new Elysia()
  .use(healthRoutes)   // GET /health (público)
  .use(adminRoutes)    // /admin/* (tenant users)
  .use(chatRoutes)     // /chat/* (external services)
  .ws('/admin/realtime', adminWebSocket)  // WS admin
  .ws('/chat/realtime', chatWebSocket)    // WS chat
  .listen(3000);

console.log('🚀 INHOST API V2 (Multi-Tenancy) running on port 3000');
```

**Resultado:**
- ✅ Solo endpoints V2
- ✅ Sin código legacy
- ✅ Arquitectura limpia

---

### FASE 3: Frontend Nuevo (2 semanas)

**3.1 Crear inhost-admin-dashboard**
```bash
npx create-next-app@latest inhost-admin-dashboard --typescript --tailwind --app

cd inhost-admin-dashboard
npm install @tanstack/react-query axios zustand
npm install -D @types/node
```

**3.2 Estructura**
```
inhost-admin-dashboard/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   └── (dashboard)/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       ├── inbox/page.tsx
│   │       ├── end-users/page.tsx
│   │       ├── team/page.tsx
│   │       ├── settings/page.tsx
│   │       └── analytics/page.tsx
│   ├── lib/
│   │   ├── api/
│   │   │   └── admin-client.ts  # Usar api-contract-admin.json
│   │   └── auth/
│   │       └── jwt.ts
│   └── components/
│       └── dashboard/
│           ├── ConversationList.tsx
│           ├── MessageThread.tsx
│           └── EndUserCard.tsx
├── api-contract-admin.json  # Copiar desde backend
└── package.json
```

**3.3 API Client**
```typescript
// src/lib/api/admin-client.ts
import { API_BASE_URL } from '../config';

class AdminAPIClient {
  private baseURL = API_BASE_URL + '/admin';

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const token = localStorage.getItem('token');

    const res = await fetch(this.baseURL + endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options?.headers
      }
    });

    if (!res.ok) {
      throw new Error(`API Error: ${res.statusText}`);
    }

    return res.json();
  }

  // Auth
  async login(email: string, password: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  // Conversations
  async getConversations(params?: { limit?: number; offset?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/conversations?${query}`);
  }

  // End Users
  async getEndUsers(params?: { limit?: number; search?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/end-users?${query}`);
  }

  // ... más métodos
}

export const adminAPI = new AdminAPIClient();
```

**Resultado:**
- ✅ Frontend moderno
- ✅ Solo usa API V2
- ✅ Sin código legacy

---

### FASE 4: Deprecar Frontend Antiguo

**4.1 Archivar inhostfrontend**
```bash
git mv inhostfrontend inhostfrontend-legacy
# O simplemente eliminar
rm -rf inhostfrontend
```

**4.2 Actualizar README**
```markdown
# INHOST

## Frontends

- ✅ **inhost-admin-dashboard** - Admin Dashboard (Tenant Users)
  - URL: https://app.inhost.com
  - Tech: Next.js 14, TypeScript, Tailwind
  - API: /admin/* (api-contract-admin.json)

- ❌ **inhostfrontend-legacy** (DEPRECATED)
  - Eliminado en migración V2
```

---

## 📋 Estructura Final (Clean)

### Backend
```
apps/api-gateway/
├── src/
│   ├── routes/
│   │   ├── health.ts           # GET /health
│   │   ├── admin/              # /admin/* (tenant users)
│   │   │   ├── index.ts
│   │   │   ├── auth.ts
│   │   │   ├── tenant.ts
│   │   │   ├── conversations.ts
│   │   │   ├── end-users.ts
│   │   │   ├── team.ts
│   │   │   ├── capabilities.ts
│   │   │   └── analytics.ts
│   │   └── chat/               # /chat/* (external services)
│   │       ├── index.ts
│   │       ├── webhook.ts
│   │       └── messages.ts
│   ├── middleware/
│   │   ├── jwt-auth.ts         # JWT para /admin/*
│   │   └── chat-auth.ts        # Headers para /chat/*
│   └── index.ts
├── api-contract-admin.json
└── api-contract-chat.json
```

### Frontend
```
inhost-admin-dashboard/
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   └── (dashboard)/
│   │       ├── inbox/
│   │       ├── end-users/
│   │       ├── team/
│   │       └── settings/
│   └── lib/api/
│       └── admin-client.ts
└── api-contract-admin.json
```

### Database
```sql
-- Solo tablas multi-tenancy
tenants
tenant_users
end_users
tenant_capabilities
tenant_usage
conversations  (actualizada con tenant_id, end_user_id)
messages       (sin cambios)
```

---

## ✅ Checklist de Migración Limpia

### Preparación
- [ ] Backup DB actual
- [ ] Ejecutar `create-multi-tenancy-tables.sql`
- [ ] Migrar datos existentes (si hay)

### Backend
- [ ] Eliminar código legacy
  - [ ] Borrar `/simulate/*` routes
  - [ ] Borrar `/me/capabilities` viejo
- [ ] Implementar `/admin/*`
  - [ ] `/admin/auth/*` (login, signup)
  - [ ] `/admin/tenant`
  - [ ] `/admin/conversations`
  - [ ] `/admin/end-users`
  - [ ] `/admin/team`
  - [ ] `/admin/capabilities`
  - [ ] `/admin/analytics`
- [ ] Implementar `/chat/*`
  - [ ] `/chat/webhook/whatsapp`
  - [ ] `/chat/webhook/instagram`
  - [ ] `/chat/messages/send`
  - [ ] `/chat/messages/history`
- [ ] WebSocket
  - [ ] `/admin/realtime` (JWT auth)
  - [ ] `/chat/realtime` (header auth)

### Frontend
- [ ] Crear `inhost-admin-dashboard`
- [ ] Implementar login/auth
- [ ] Inbox (conversaciones)
- [ ] End users list
- [ ] Settings
- [ ] Deploy
- [ ] Deprecar/eliminar `inhostfrontend`

### Testing
- [ ] E2E tests `/admin/*`
- [ ] E2E tests `/chat/*`
- [ ] Integration tests
- [ ] Security audit

### Deploy
- [ ] Deploy backend V2
- [ ] Deploy frontend nuevo
- [ ] Update DNS
- [ ] Monitoring

---

## 📅 Timeline (4 semanas)

```
Week 1: Backend /admin/* + JWT auth
├── Day 1-2: Setup routes, JWT middleware
├── Day 3-4: Auth endpoints (login, signup)
└── Day 5: Tenant, conversations endpoints

Week 2: Backend /chat/* + Frontend setup
├── Day 1-2: Chat webhooks, messages
├── Day 3-4: Setup Next.js dashboard
└── Day 5: Login page, auth flow

Week 3: Frontend features
├── Day 1-2: Inbox (conversations)
├── Day 3-4: End users, team
└── Day 5: Settings, capabilities

Week 4: Testing + Deploy
├── Day 1-2: E2E tests
├── Day 3-4: Deploy staging
└── Day 5: Deploy production
```

---

## 🚀 Empezar AHORA

### Paso 1: Ejecutar migration SQL
```bash
cd /home/user/inhost
psql -h localhost -U inhost_user -d inhost -f scripts/create-multi-tenancy-tables.sql
```

### Paso 2: Crear estructura backend
```bash
mkdir -p apps/api-gateway/src/routes/admin
mkdir -p apps/api-gateway/src/routes/chat
mkdir -p apps/api-gateway/src/middleware

touch apps/api-gateway/src/routes/admin/{index,auth,tenant,conversations,end-users,team,capabilities,analytics}.ts
touch apps/api-gateway/src/routes/chat/{index,webhook,messages}.ts
touch apps/api-gateway/src/middleware/{jwt-auth,chat-auth}.ts
```

### Paso 3: Implementar primer endpoint
```typescript
// apps/api-gateway/src/routes/admin/auth.ts
import { Elysia, t } from 'elysia';

export const authRoutes = new Elysia({ prefix: '/auth' })
  .post('/login', async ({ body }) => {
    // TODO: Implement JWT login
    return {
      success: true,
      data: {
        token: 'jwt_token_here',
        user: { ... }
      }
    };
  }, {
    body: t.Object({
      email: t.String(),
      password: t.String()
    })
  });
```

---

## 🎯 Resultado Final

**Arquitectura:**
- ✅ Clean slate - sin legacy code
- ✅ Multi-tenancy desde día 1
- ✅ Separación clara admin/chat
- ✅ JWT auth robusto
- ✅ Frontend moderno
- ✅ Escalable y mantenible

**No hay:**
- ❌ Versionado V1/V2
- ❌ Backward compatibility
- ❌ Código legacy
- ❌ Complejidad innecesaria

**Tiempo total:** 4 semanas
**Complejidad:** Baja-Media
**Mantenibilidad:** Excelente

¿Empezamos con la implementación de `/admin/auth` endpoints?
