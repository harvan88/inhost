# ⚡ Quick Start - Testing en 10 Minutos

**Para:** Testing rápido del sistema multi-tenancy
**Prerequisito:** PostgreSQL disponible

---

## 🚀 Paso 1: Iniciar PostgreSQL (1 min)

```bash
# Opción A: Docker (si está disponible)
docker-compose up -d postgres

# Opción B: PostgreSQL local (si ya está instalado)
# Ya debe estar corriendo

# Verificar
pg_isready -h localhost -p 5432 -U inhost_user
# Esperado: "localhost:5432 - accepting connections"
```

---

## 🗄️ Paso 2: Resetear Database (2 min)

```bash
# Ejecutar script de reset (drops todo y crea multi-tenancy)
psql -h localhost -U inhost_user -d inhost -f scripts/reset-database.sql

# Verificar tablas creadas
psql -h localhost -U inhost_user -d inhost -c "\dt"

# Esperado: tenants, tenant_users, end_users, tenant_capabilities, tenant_usage, etc.
```

---

## 🦊 Paso 3: Iniciar API Server (1 min)

```bash
# Terminal 1: API Server
bun --cwd apps/api-gateway dev

# Esperado en logs:
# ✅ "🦊 INHOST API Gateway is running"
# ✅ "🚪 DatabaseServiceGate (V2 Multi-Tenancy) initialized"
# ✅ "POST /admin/auth/login → Login (Multi-Tenancy V2)"
```

---

## ✅ Paso 4: Health Check (30 seg)

```bash
# Terminal 2: Testing
curl http://localhost:3000/health

# Esperado:
# {
#   "status": "ok",
#   "timestamp": "...",
#   "database": "connected"
# }
```

---

## 🔐 Paso 5: Test Signup (1 min)

```bash
curl -X POST http://localhost:3000/admin/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mycompany.com",
    "password": "test123456",
    "name": "Admin User",
    "tenantName": "My Company",
    "plan": "professional"
  }' | jq

# Esperado:
# {
#   "success": true,
#   "data": {
#     "token": "eyJhbGc...",
#     "user": { "email": "admin@mycompany.com", ... }
#   }
# }

# IMPORTANTE: Copiar el token retornado
```

---

## 🔑 Paso 6: Test Login (1 min)

```bash
curl -X POST http://localhost:3000/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mycompany.com",
    "password": "test123456"
  }' | jq

# Esperado: Mismo response que signup (con token)
```

---

## 🔍 Paso 7: Verificar DB (2 min)

```bash
# Ver tenant creado
psql -h localhost -U inhost_user -d inhost -c "
  SELECT name, slug, plan FROM tenants WHERE slug = 'my-company';
"

# Ver tenant user (owner)
psql -h localhost -U inhost_user -d inhost -c "
  SELECT email, role FROM tenant_users WHERE email = 'admin@mycompany.com';
"

# Ver capabilities aplicadas
psql -h localhost -U inhost_user -d inhost -c "
  SELECT t.name, tc.service_id, tc.enabled
  FROM tenant_capabilities tc
  JOIN tenants t ON t.id = tc.tenant_id
  WHERE t.slug = 'my-company';
"
```

---

## 🧪 Paso 8: Test Multi-Tenancy (2 min)

```bash
# Crear segundo tenant
curl -X POST http://localhost:3000/admin/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@othercompany.com",
    "password": "test123456",
    "name": "Other Admin",
    "tenantName": "Other Company",
    "plan": "starter"
  }' | jq

# Verificar 2 tenants separados
psql -h localhost -U inhost_user -d inhost -c "
  SELECT name, slug, plan FROM tenants ORDER BY created_at DESC LIMIT 5;
"
```

---

## ✅ Resultado Esperado

Después de estos 10 minutos:

- ✅ PostgreSQL corriendo
- ✅ Base de datos multi-tenancy creada
- ✅ API Server respondiendo
- ✅ 2+ tenants creados
- ✅ Authentication funcionando
- ✅ Capabilities aplicadas por plan

---

## 🎯 Si Todo Funciona

**¡Éxito! Sistema multi-tenancy operativo.**

### Siguiente paso:
- Implementar frontend (ver `FRONTEND-INTEGRATION-GUIDE.md`)
- O continuar con testing completo (ver `TESTING-PLAN.md`)

---

## ❌ Si Algo Falla

### PostgreSQL no conecta
```bash
# Verificar status
docker ps | grep postgres

# Ver logs
docker-compose logs postgres

# Reiniciar
docker-compose restart postgres
```

### API no inicia
```bash
# Reinstalar dependencias
bun install

# Verificar .env
cat apps/api-gateway/.env.example
```

### Signup falla
```bash
# Ver logs del server
# Buscar errores en Terminal 1

# Verificar tablas
psql -h localhost -U inhost_user -d inhost -c "\dt"
```

---

## 📚 Documentación Completa

- `SYSTEM-OVERVIEW.md` - Vista general del sistema
- `FRONTEND-INTEGRATION-GUIDE.md` - Mandatos para frontend
- `TESTING-PLAN.md` - Plan de testing completo (2-3 horas)
- `DATABASE-MIGRATION-GUIDE.md` - Guía de migración DB

---

**⏰ Tiempo total: 10 minutos**
**🚀 ¡Listo para producción!**
