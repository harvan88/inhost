# 📚 INHOST - System Overview (Multi-Tenancy V2)

**Última actualización:** 2025-11-19
**Estado:** ✅ Backend implementado - Listo para testing
**Branch:** `claude/remove-hardcoded-plans-01Q7hVprGPtpH2kGc2h6vGsj`

---

## 🎯 Arquitectura Multi-Tenancy

### Separación de Usuarios

```
TENANTS (Organizaciones)
  └── TENANT_USERS (Admins/Agentes)
        └── Usan: Admin Dashboard (inhost-admin-dashboard)
        └── API: /admin/* (JWT auth)

  └── END_USERS (Clientes finales)
        └── Vienen de: WhatsApp, Instagram, UIs externas
        └── API: /chat/* (Header auth)
        └── NO usan inhost-frontend
```

### Base de Datos

**Tablas Multi-Tenancy:**
- `tenants` - Organizaciones (ej: "Tienda XYZ")
- `tenant_users` - Empleados/admins de organizaciones
- `end_users` - Clientes finales (WhatsApp, Instagram)
- `tenant_capabilities` - Capabilities a nivel organización ✅
- `tenant_usage` - Usage tracking por organización ✅

**Tablas Compartidas:**
- `messages` - Mensajes
- `conversations` - Conversaciones (ahora con `tenant_id` y `end_user_id`)
- `capability_templates` - Templates de capabilities

---

## 🔐 Autenticación

### JWT para Tenant Users (/admin/*)

**1. Signup - Crear tenant + owner**
```bash
POST /admin/auth/signup
Content-Type: application/json

{
  "email": "admin@company.com",
  "password": "password123",
  "name": "Admin User",
  "tenantName": "My Company",
  "plan": "professional"  # starter | professional | enterprise
}

# Response:
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "user": {
      "id": "uuid",
      "email": "admin@company.com",
      "name": "Admin User",
      "role": "owner",
      "tenant": {
        "id": "uuid",
        "name": "My Company",
        "slug": "my-company",
        "plan": "professional"
      }
    }
  }
}
```

**2. Login - Autenticar tenant user**
```bash
POST /admin/auth/login
Content-Type: application/json

{
  "email": "admin@company.com",
  "password": "password123"
}

# Response: (mismo que signup)
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "user": { ... }
  }
}
```

**3. JWT Payload**
```json
{
  "sub": "tenant_user_id",
  "email": "admin@company.com",
  "tenant_id": "tenant_uuid",
  "role": "owner",
  "iat": 1234567890,
  "exp": 1234654290
}
```

**4. Usar JWT en requests**
```bash
GET /admin/tenant
Authorization: Bearer eyJhbGc...
```

---

## 📡 API Contracts

### Admin API (/admin/* - Tenant Users)

**Auth:** JWT (Bearer token)
**Para:** Admins, agentes, owners

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/admin/auth/login` | POST | ✅ Implementado | Login |
| `/admin/auth/signup` | POST | ✅ Implementado | Signup |
| `/admin/tenant` | GET | 📋 TODO | Info de organización |
| `/admin/tenant` | PATCH | 📋 TODO | Actualizar organización |
| `/admin/conversations` | GET | 📋 TODO | Listar conversaciones |
| `/admin/conversations/:id/messages` | GET | 📋 TODO | Mensajes de conversación |
| `/admin/end-users` | GET | 📋 TODO | Listar end users |
| `/admin/end-users/:id` | GET | 📋 TODO | Detalle end user |
| `/admin/team` | GET | 📋 TODO | Listar equipo |
| `/admin/team` | POST | 📋 TODO | Agregar miembro |
| `/admin/capabilities` | GET | 📋 TODO | Listar capabilities |
| `/admin/capabilities/:id` | PATCH | 📋 TODO | Toggle capability |
| `/admin/analytics/dashboard` | GET | 📋 TODO | Métricas |

### Chat API (/chat/* - External Services)

**Auth:** Headers (X-Tenant-Id + X-End-User-Phone/Id)
**Para:** WhatsApp, Instagram, UIs externas

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/chat/webhook/whatsapp` | POST | 📋 TODO | Webhook WhatsApp |
| `/chat/webhook/instagram` | POST | 📋 TODO | Webhook Instagram |
| `/chat/messages/send` | POST | 📋 TODO | Enviar mensaje |
| `/chat/messages/history` | GET | 📋 TODO | Historial mensajes |

---

## 🚀 Estado Actual

### ✅ Completado

1. **Database Schema**
   - `scripts/create-multi-tenancy-tables.sql` - Crea todas las tablas
   - `scripts/reset-database.sql` - Resetea DB completamente
   - PostgreSQL functions: `apply_template_to_tenant()`, `increment_tenant_usage()`, etc.

2. **Backend Authentication**
   - `apps/api-gateway/src/middleware/jwt-auth.ts` - JWT middleware ✅
   - `apps/api-gateway/src/routes/admin/auth.ts` - Login/Signup ✅
   - `apps/api-gateway/src/routes/admin/index.ts` - Admin router ✅

3. **ServiceGate V2 (Multi-Tenancy)**
   - `apps/api-gateway/src/implementations/v2/DatabaseServiceGate.ts` ✅
   - Ahora usa `tenant_capabilities` y `tenant_usage` ✅
   - Capabilities a nivel TENANT (no usuario individual) ✅

4. **Dependencias**
   - `jsonwebtoken` - JWT ✅
   - `bcrypt` - Password hashing ✅

### 📋 Pendiente

1. **Backend Endpoints**
   - `/admin/tenant` - GET/PATCH tenant info
   - `/admin/conversations` - Listar conversaciones
   - `/admin/end-users` - Listar end users
   - `/admin/team` - Gestión de equipo
   - `/admin/capabilities` - Ver/toggle capabilities
   - `/admin/analytics` - Métricas
   - `/chat/*` - Todos los endpoints externos

2. **Frontend**
   - `inhost-admin-dashboard` - Crear desde cero (Next.js)
   - Login/Signup UI
   - Dashboard principal
   - Inbox (conversaciones)
   - End Users list
   - Settings

3. **Testing**
   - Tests E2E authentication
   - Tests de endpoints protegidos
   - Tests multi-tenancy (aislamiento de datos)

---

## 🗂️ Estructura de Archivos

```
inhost/
├── scripts/
│   ├── create-multi-tenancy-tables.sql  ✅ DB schema
│   ├── reset-database.sql               ✅ Reset completo
│   └── migrate-to-multi-tenancy.sql     ⚠️ No usado (clean slate)
│
├── packages/shared/src/database/
│   ├── config.ts                        ✅ Pool PostgreSQL
│   ├── multi-tenancy-schema.ts          ✅ Drizzle schema
│   └── capabilities-schema.ts           ⚠️ Legacy (usar multi-tenancy)
│
├── apps/api-gateway/src/
│   ├── middleware/
│   │   └── jwt-auth.ts                  ✅ JWT middleware
│   ├── routes/
│   │   ├── admin/
│   │   │   ├── index.ts                 ✅ Admin router
│   │   │   └── auth.ts                  ✅ Login/Signup
│   │   ├── index.ts                     ✅ Main router
│   │   ├── messages.ts                  ⚠️ LEGACY
│   │   └── capabilities.ts              ⚠️ LEGACY
│   ├── implementations/v2/
│   │   └── DatabaseServiceGate.ts       ✅ Multi-tenancy
│   └── index.ts                         ✅ Main app
│
├── docs/
│   ├── database/
│   │   └── multi-tenancy-model.md       📖 Modelo completo
│   ├── migration/
│   │   └── clean-migration-strategy.md  📖 Estrategia
│   └── frontend-integration/
│       ├── multi-tenancy-frontend-guide.md
│       └── frontend-restructure-plan.md
│
├── api-contract-admin.json              📋 Contrato Admin API
├── api-contract-chat.json               📋 Contrato Chat API
├── DATABASE-MIGRATION-GUIDE.md          📖 Guía migración
├── SESSION-SUMMARY.md                   📖 Resumen sesión
└── SYSTEM-OVERVIEW.md                   📖 Este archivo
```

---

## 🔧 Configuración

### Variables de Entorno

```bash
# apps/api-gateway/.env
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# JWT Secret (cambiar en producción)
JWT_SECRET=inhost-dev-secret-change-in-production

# PostgreSQL
DATABASE_URL=postgresql://inhost_user:inhost_password@localhost:5432/inhost

# Rate Limiting
RATE_LIMIT_BACKEND=memory

# Redis (futuro)
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Iniciar Sistema

```bash
# 1. PostgreSQL
docker-compose up -d postgres
# O: bun run dev:db (requiere Docker)

# 2. Reset DB (primera vez)
psql -h localhost -U inhost_user -d inhost -f scripts/reset-database.sql

# 3. API Gateway
bun --cwd apps/api-gateway dev

# 4. Testing Dashboard (futuro)
cd testing && bun server.js
```

---

## 📊 Flujos Principales

### 1. Signup + Login

```
1. Usuario hace signup → POST /admin/auth/signup
   ↓
2. Backend crea:
   - Tenant (organización)
   - Tenant User (owner)
   - Capabilities default (según plan)
   ↓
3. Backend retorna JWT token
   ↓
4. Frontend guarda token en localStorage
   ↓
5. Frontend redirige a dashboard
```

### 2. Request Protegido

```
1. Frontend hace request → GET /admin/tenant
   Headers: Authorization: Bearer <token>
   ↓
2. Middleware jwt-auth verifica token
   ↓
3. Extrae: tenantId, tenantUserId, role
   ↓
4. Handler usa tenantId para queries
   ↓
5. Retorna datos del tenant
```

### 3. Capability Check

```
1. End user envía mensaje
   ↓
2. ServiceGate.canUseService(tenantId, 'ai-assistant')
   ↓
3. Query: SELECT * FROM tenant_capabilities WHERE tenant_id = ? AND service_id = 'ai-assistant'
   ↓
4. Verifica: enabled = true, no expirado, no límites excedidos
   ↓
5. Si permitido → Procesa con AI
   Si bloqueado → Retorna error
```

---

## 🎯 Próximos Pasos

### Fase 1: Testing Backend (HOY)
1. Resetear DB con multi-tenancy
2. Test signup endpoint
3. Test login endpoint
4. Test JWT token

### Fase 2: Implementar Endpoints Restantes (1-2 días)
1. `/admin/tenant` (GET/PATCH)
2. `/admin/conversations` (GET)
3. `/admin/end-users` (GET)
4. `/admin/capabilities` (GET/PATCH)

### Fase 3: Frontend (1 semana)
1. Setup Next.js + Tailwind
2. Login/Signup UI
3. Dashboard layout
4. Inbox (conversaciones)
5. Settings

### Fase 4: External Services (1 semana)
1. `/chat/webhook/whatsapp`
2. `/chat/messages/send`
3. Auto-create end_users

---

## 📞 Soporte

**Documentos clave:**
- `DATABASE-MIGRATION-GUIDE.md` - Paso a paso migración DB
- `docs/migration/clean-migration-strategy.md` - Estrategia completa
- `api-contract-admin.json` - Contrato completo Admin API
- `FRONTEND-INTEGRATION-GUIDE.md` - Mandatos para frontend (próximo)

**Comandos útiles:**
```bash
# Ver tablas
psql -h localhost -U inhost_user -d inhost -c "\dt"

# Ver tenants
psql -h localhost -U inhost_user -d inhost -c "SELECT id, name, slug, plan FROM tenants;"

# Ver capabilities de un tenant
psql -h localhost -U inhost_user -d inhost -c "
  SELECT service_id, enabled
  FROM tenant_capabilities
  WHERE tenant_id = 'UUID_AQUI';
"

# Logs backend
bun --cwd apps/api-gateway dev
```

---

**🚀 Sistema listo para testing y desarrollo de frontend!**
