# INHOST - Multi-Tenancy Messaging Platform

Multi-channel messaging API Gateway with multi-tenancy support for WhatsApp, Instagram, and custom integrations.

**Version:** 2.0.0 (Multi-Tenancy)
**Status:** ✅ Backend Implemented - Ready for Testing
**Branch:** `claude/remove-hardcoded-plans-01Q7hVprGPtpH2kGc2h6vGsj`

---

## ⚡ Quick Start (10 minutos)

```bash
# 1. Iniciar PostgreSQL
docker-compose up -d postgres

# 2. Resetear DB (multi-tenancy)
psql -h localhost -U inhost_user -d inhost -f scripts/reset-database.sql

# 3. Iniciar API
bun --cwd apps/api-gateway dev

# 4. Test signup
curl -X POST http://localhost:3000/admin/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mycompany.com",
    "password": "test123456",
    "name": "Admin User",
    "tenantName": "My Company",
    "plan": "professional"
  }'
```

**Guía completa:** [QUICK-START-TESTING.md](QUICK-START-TESTING.md)

---

## 🎯 ¿Qué es INHOST?

Sistema de mensajería multi-canal con **multi-tenancy** que separa:

- **TENANTS** (Organizaciones) → Empresas que compran el servicio
- **TENANT USERS** (Admins/Agentes) → Empleados de las organizaciones
- **END USERS** (Clientes finales) → Personas que chatean (vía WhatsApp, Instagram, etc.)

### Arquitectura

```
┌─────────────────────────────────────────┐
│         END USERS (Clientes)            │
│  (WhatsApp, Instagram, UIs externas)    │
└──────────────┬──────────────────────────┘
               │ /chat/* API
               ↓
┌─────────────────────────────────────────┐
│      BACKEND (Multi-Tenancy V2)         │
│                                         │
│  /admin/* → Tenant Users (JWT)          │
│  /chat/*  → External Services (Headers) │
│                                         │
│  Database: PostgreSQL                   │
│  - tenants                              │
│  - tenant_users                         │
│  - end_users                            │
│  - tenant_capabilities                  │
│  - tenant_usage                         │
└──────────────┬──────────────────────────┘
               │ JWT Auth
               ↓
┌─────────────────────────────────────────┐
│   FRONTEND: inhost-admin-dashboard      │
│   (Solo para Tenant Users)              │
│                                         │
│  - Login/Signup                         │
│  - Inbox (conversaciones)               │
│  - End Users (clientes)                 │
│  - Team (equipo)                        │
│  - Settings                             │
└─────────────────────────────────────────┘
```

---

## 📋 Estado Actual

### ✅ Completado

**Database (Multi-Tenancy):**
- ✅ Tablas: `tenants`, `tenant_users`, `end_users`, `tenant_capabilities`, `tenant_usage`
- ✅ PostgreSQL functions: `apply_template_to_tenant()`, `increment_tenant_usage()`
- ✅ Scripts de reset y migración

**Backend Authentication:**
- ✅ JWT middleware (`apps/api-gateway/src/middleware/jwt-auth.ts`)
- ✅ POST `/admin/auth/login` - Autenticar tenant user
- ✅ POST `/admin/auth/signup` - Crear tenant + owner
- ✅ ServiceGate V2 (usa `tenant_capabilities` en lugar de `user_capabilities`)

**Dependencias:**
- ✅ `jsonwebtoken` - JWT tokens
- ✅ `bcrypt` - Password hashing

### 📋 Pendiente

**Backend Endpoints:**
- [ ] GET `/admin/tenant` - Info de organización
- [ ] GET `/admin/conversations` - Listar conversaciones
- [ ] GET `/admin/end-users` - Listar end users
- [ ] GET `/admin/capabilities` - Ver/toggle capabilities
- [ ] POST `/chat/webhook/whatsapp` - Webhook WhatsApp
- [ ] POST `/chat/messages/send` - Enviar mensaje

**Frontend:**
- [ ] `inhost-admin-dashboard` (Next.js)
- [ ] Login/Signup UI
- [ ] Dashboard
- [ ] Inbox

---

## 📚 Documentación

### 🚀 Para Empezar

| Documento | Descripción | Tiempo |
|-----------|-------------|--------|
| [QUICK-START-TESTING.md](QUICK-START-TESTING.md) | Testing rápido del sistema | 10 min |
| [SYSTEM-OVERVIEW.md](SYSTEM-OVERVIEW.md) | Vista general completa | 15 min |
| [TESTING-PLAN.md](TESTING-PLAN.md) | Plan de testing completo | 2-3 hrs |

### 👨‍💻 Para Frontend

| Documento | Descripción |
|-----------|-------------|
| [FRONTEND-INTEGRATION-GUIDE.md](FRONTEND-INTEGRATION-GUIDE.md) | **Mandatos para frontend** - Setup Next.js |
| [api-contract-admin.json](api-contract-admin.json) | Contrato API completo |

### 🗄️ Para Backend/DevOps

| Documento | Descripción |
|-----------|-------------|
| [DATABASE-MIGRATION-GUIDE.md](DATABASE-MIGRATION-GUIDE.md) | Guía paso a paso migración DB |
| [docs/migration/clean-migration-strategy.md](docs/migration/clean-migration-strategy.md) | Estrategia de migración |
| [docs/database/multi-tenancy-model.md](docs/database/multi-tenancy-model.md) | Modelo completo DB |

### 📖 Sesiones Anteriores

| Documento | Descripción |
|-----------|-------------|
| [SESSION-SUMMARY.md](SESSION-SUMMARY.md) | Resumen sesión multi-tenancy |
| [CLAUDE.md](CLAUDE.md) | Guía desarrollo (sistema antiguo) |

---

## 🏗️ Estructura del Proyecto

```
inhost/
├── apps/api-gateway/
│   └── src/
│       ├── middleware/
│       │   └── jwt-auth.ts              ✅ JWT authentication
│       ├── routes/
│       │   ├── admin/
│       │   │   ├── index.ts             ✅ Admin router
│       │   │   └── auth.ts              ✅ Login/Signup
│       │   ├── index.ts                 ✅ Main router
│       │   ├── messages.ts              ⚠️ LEGACY
│       │   └── capabilities.ts          ⚠️ LEGACY
│       └── implementations/v2/
│           └── DatabaseServiceGate.ts   ✅ Multi-tenancy
│
├── packages/shared/src/database/
│   ├── config.ts                        ✅ PostgreSQL pool
│   └── multi-tenancy-schema.ts          ✅ Drizzle schema
│
├── scripts/
│   ├── create-multi-tenancy-tables.sql  ✅ DB schema
│   ├── reset-database.sql               ✅ Reset completo
│   └── migrate-to-multi-tenancy.sql     ⚠️ No usado (clean slate)
│
├── docs/
│   ├── database/
│   │   └── multi-tenancy-model.md
│   ├── migration/
│   │   └── clean-migration-strategy.md
│   └── frontend-integration/
│       ├── multi-tenancy-frontend-guide.md
│       └── frontend-restructure-plan.md
│
├── SYSTEM-OVERVIEW.md                   📖 Vista general
├── FRONTEND-INTEGRATION-GUIDE.md        📖 Mandatos frontend
├── TESTING-PLAN.md                      📖 Plan testing completo
├── QUICK-START-TESTING.md               📖 Testing rápido (10 min)
├── DATABASE-MIGRATION-GUIDE.md          📖 Guía migración DB
├── SESSION-SUMMARY.md                   📖 Resumen sesión
└── api-contract-admin.json              📋 Contrato API
```

---

## 🔐 API Endpoints

### Admin API (/admin/* - Tenant Users)

**Auth:** JWT (Bearer token)

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/admin/auth/login` | POST | ✅ | Login tenant user |
| `/admin/auth/signup` | POST | ✅ | Crear tenant + owner |
| `/admin/tenant` | GET | 📋 TODO | Info organización |
| `/admin/conversations` | GET | 📋 TODO | Listar conversaciones |
| `/admin/end-users` | GET | 📋 TODO | Listar end users |
| `/admin/capabilities` | GET | 📋 TODO | Ver capabilities |

### Chat API (/chat/* - External Services)

**Auth:** Headers (X-Tenant-Id + X-End-User-*)

| Endpoint | Método | Estado | Descripción |
|----------|--------|--------|-------------|
| `/chat/webhook/whatsapp` | POST | 📋 TODO | Webhook WhatsApp |
| `/chat/messages/send` | POST | 📋 TODO | Enviar mensaje |

**Contrato completo:** [api-contract-admin.json](api-contract-admin.json), [api-contract-chat.json](api-contract-chat.json)

---

## 🧪 Testing

### Quick Test (10 min)

```bash
# Ver: QUICK-START-TESTING.md
```

### Full Test Suite (2-3 hrs)

```bash
# Ver: TESTING-PLAN.md
```

### Manual Testing

```bash
# 1. Health check
curl http://localhost:3000/health

# 2. Signup
curl -X POST http://localhost:3000/admin/auth/signup \
  -H "Content-Type: application/json" \
  -d '{ "email": "...", "password": "...", ... }'

# 3. Login
curl -X POST http://localhost:3000/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "...", "password": "..." }'
```

---

## 🛠️ Tech Stack

**Backend:**
- Runtime: Bun
- Framework: Elysia.js
- Database: PostgreSQL + Drizzle ORM
- Auth: JWT (jsonwebtoken + bcrypt)
- Validation: TypeBox

**Frontend (próximo):**
- Framework: Next.js 14
- Styling: Tailwind CSS
- State: Zustand
- Data fetching: TanStack Query
- HTTP: Axios

---

## 🚀 Próximos Pasos

### Para Backend Developers

1. **Testing** (HOY)
   - Ejecutar `QUICK-START-TESTING.md`
   - Verificar signup/login
   - Verificar multi-tenancy

2. **Implementar Endpoints** (1-2 días)
   - `/admin/tenant` (GET/PATCH)
   - `/admin/conversations` (GET)
   - `/admin/end-users` (GET)

3. **External Services** (1 semana)
   - `/chat/webhook/whatsapp`
   - `/chat/messages/send`

### Para Frontend Developers

1. **Setup** (1 hora)
   - Leer `FRONTEND-INTEGRATION-GUIDE.md`
   - Crear proyecto Next.js
   - Implementar API Client

2. **Auth** (2-3 horas)
   - Login page
   - Signup page
   - JWT storage

3. **Dashboard** (1 semana)
   - Layout con sidebar
   - Dashboard home
   - Inbox (conversaciones)
   - Settings

---

## 🐛 Troubleshooting

### PostgreSQL no conecta

```bash
docker ps | grep postgres
docker-compose logs postgres
docker-compose restart postgres
```

### API no inicia

```bash
bun install
LOG_LEVEL=debug bun --cwd apps/api-gateway dev
```

### Signup falla

```bash
# Verificar tablas
psql -h localhost -U inhost_user -d inhost -c "\dt"

# Ver logs backend
# Terminal donde corre el server
```

---

## 📞 Contacto y Soporte

**Documentación clave:**
- Sistema: `SYSTEM-OVERVIEW.md`
- Testing: `TESTING-PLAN.md`
- Frontend: `FRONTEND-INTEGRATION-GUIDE.md`
- Database: `DATABASE-MIGRATION-GUIDE.md`

**Comandos útiles:**

```bash
# Ver tenants
psql -h localhost -U inhost_user -d inhost -c "SELECT * FROM tenants;"

# Ver capabilities de un tenant
psql -h localhost -U inhost_user -d inhost -c "
  SELECT t.name, tc.service_id, tc.enabled
  FROM tenant_capabilities tc
  JOIN tenants t ON t.id = tc.tenant_id;
"

# Logs detallados
LOG_LEVEL=debug bun --cwd apps/api-gateway dev
```

---

## 📅 Historial de Versiones

- **v2.0.0** (2025-11-19) - Multi-Tenancy V2
  - ✅ Database multi-tenancy
  - ✅ JWT authentication
  - ✅ ServiceGate V2 (tenant_capabilities)
  - 📋 Endpoints básicos implementados

- **v1.x** (2025-11-16) - Sistema Legacy
  - WebSocket real-time
  - Protection & Security
  - MessageCore

---

**🚀 Sistema listo para testing y desarrollo de frontend!**

**Last Updated:** 2025-11-19
