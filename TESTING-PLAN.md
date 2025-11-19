# 🧪 Plan de Testing Completo - Multi-Tenancy V2

**Fecha:** 2025-11-19
**Branch:** `claude/remove-hardcoded-plans-01Q7hVprGPtpH2kGc2h6vGsj`
**Estado:** Listo para ejecutar

---

## 🎯 Objetivos

1. ✅ Verificar que la base de datos multi-tenancy funciona
2. ✅ Verificar autenticación JWT (signup, login)
3. ✅ Verificar ServiceGate usa tenant_capabilities
4. ✅ Verificar aislamiento de datos entre tenants
5. ✅ Verificar integración frontend-backend

---

## 📋 Fase 1: Setup y Database (15 min)

### 1.1 Iniciar PostgreSQL

```bash
# Verificar si está corriendo
pg_isready -h localhost -p 5432 -U inhost_user

# Si no está corriendo, iniciar
docker-compose up -d postgres

# Esperar a que esté listo
sleep 5
pg_isready -h localhost -p 5432 -U inhost_user
# Esperado: "localhost:5432 - accepting connections"
```

**✅ Criterio de éxito:** PostgreSQL responde en port 5432

### 1.2 Resetear Database (Clean Slate)

```bash
# Ejecutar reset completo
psql -h localhost -U inhost_user -d inhost -f scripts/reset-database.sql

# Verificar tablas creadas
psql -h localhost -U inhost_user -d inhost -c "\dt"
```

**✅ Criterio de éxito:** Deben aparecer las siguientes tablas:
- `tenants`
- `tenant_users`
- `end_users`
- `tenant_capabilities`
- `tenant_usage`
- `capability_templates`

### 1.3 Verificar Datos Demo

```bash
# Ver tenants demo
psql -h localhost -U inhost_user -d inhost -c "
  SELECT id, name, slug, plan, subscription_status
  FROM tenants;
"

# Ver capabilities templates
psql -h localhost -U inhost_user -d inhost -c "
  SELECT name, description, is_active
  FROM capability_templates;
"
```

**✅ Criterio de éxito:** Aparecen 2 tenants demo y 3 templates (starter, professional, enterprise)

---

## 📋 Fase 2: Backend API - Authentication (30 min)

### 2.1 Iniciar API Server

```bash
# Terminal 1: API Server
bun --cwd apps/api-gateway dev

# Verificar que inició correctamente
# Esperado en logs:
# ✅ "🦊 INHOST API Gateway is running"
# ✅ "🚪 DatabaseServiceGate (V2 Multi-Tenancy) initialized"
```

**✅ Criterio de éxito:** Server corriendo en port 3000

### 2.2 Health Check

```bash
curl http://localhost:3000/health
```

**✅ Esperado:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-19T...",
  "database": "connected"
}
```

### 2.3 Test Signup - Crear Tenant + Owner

```bash
curl -X POST http://localhost:3000/admin/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@testcompany.com",
    "password": "test123456",
    "name": "Test Admin",
    "tenantName": "Test Company",
    "plan": "professional"
  }'
```

**✅ Esperado:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "user": {
      "id": "uuid-here",
      "email": "admin@testcompany.com",
      "name": "Test Admin",
      "role": "owner",
      "tenant": {
        "id": "uuid-here",
        "name": "Test Company",
        "slug": "test-company",
        "plan": "professional"
      }
    }
  }
}
```

**🔍 Verificar en DB:**
```bash
# Verificar tenant creado
psql -h localhost -U inhost_user -d inhost -c "
  SELECT id, name, slug, plan
  FROM tenants
  WHERE slug = 'test-company';
"

# Verificar owner creado
psql -h localhost -U inhost_user -d inhost -c "
  SELECT email, role
  FROM tenant_users
  WHERE email = 'admin@testcompany.com';
"

# Verificar capabilities aplicadas
psql -h localhost -U inhost_user -d inhost -c "
  SELECT t.name, tc.service_id, tc.enabled
  FROM tenant_capabilities tc
  JOIN tenants t ON t.id = tc.tenant_id
  WHERE t.slug = 'test-company';
"
```

**✅ Criterio de éxito:**
- Tenant creado con slug "test-company"
- Tenant user con role "owner"
- Capabilities del plan "professional" aplicadas

### 2.4 Test Login

```bash
curl -X POST http://localhost:3000/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@testcompany.com",
    "password": "test123456"
  }'
```

**✅ Esperado:** Mismo response que signup (token + user)

### 2.5 Test Login - Credenciales Inválidas

```bash
curl -X POST http://localhost:3000/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@testcompany.com",
    "password": "wrong-password"
  }'
```

**✅ Esperado:**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```
**HTTP Status:** 401

### 2.6 Test Signup - Email Duplicado

```bash
curl -X POST http://localhost:3000/admin/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@testcompany.com",
    "password": "test123456",
    "name": "Another User",
    "tenantName": "Another Company",
    "plan": "starter"
  }'
```

**✅ Esperado:**
```json
{
  "success": false,
  "error": "Email already registered"
}
```
**HTTP Status:** 409

---

## 📋 Fase 3: Multi-Tenancy - Aislamiento de Datos (20 min)

### 3.1 Crear Segundo Tenant

```bash
curl -X POST http://localhost:3000/admin/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@othercompany.com",
    "password": "test123456",
    "name": "Other Admin",
    "tenantName": "Other Company",
    "plan": "starter"
  }'
```

**Guardar token retornado como:** `TOKEN_TENANT_2`

### 3.2 Verificar Tenants Separados

```bash
# Listar todos los tenants
psql -h localhost -U inhost_user -d inhost -c "
  SELECT name, slug, plan
  FROM tenants
  ORDER BY created_at DESC;
"
```

**✅ Esperado:** 4 tenants total (2 demo + 2 nuevos)

### 3.3 Verificar Capabilities por Plan

```bash
# Capabilities de tenant professional
psql -h localhost -U inhost_user -d inhost -c "
  SELECT t.plan, COUNT(tc.id) as capabilities_count
  FROM tenants t
  LEFT JOIN tenant_capabilities tc ON tc.tenant_id = t.id
  WHERE t.slug = 'test-company'
  GROUP BY t.plan;
"

# Capabilities de tenant starter
psql -h localhost -U inhost_user -d inhost -c "
  SELECT t.plan, COUNT(tc.id) as capabilities_count
  FROM tenants t
  LEFT JOIN tenant_capabilities tc ON tc.tenant_id = t.id
  WHERE t.slug = 'other-company'
  GROUP BY t.plan;
"
```

**✅ Esperado:**
- Professional: Más capabilities que Starter
- Cada tenant tiene capabilities separadas

---

## 📋 Fase 4: ServiceGate V2 - Tenant Capabilities (15 min)

### 4.1 Verificar Función PostgreSQL

```bash
# Test función tenant_can_use_service
psql -h localhost -U inhost_user -d inhost -c "
  SELECT tenant_can_use_service(
    (SELECT id FROM tenants WHERE slug = 'test-company'),
    'ai-assistant'
  );
"
```

**✅ Esperado:**
```json
{
  "allowed": true,
  "config": { "enabled": true, ... }
}
```

### 4.2 Incrementar Usage

```bash
# Test función increment_tenant_usage
psql -h localhost -U inhost_user -d inhost -c "
  SELECT increment_tenant_usage(
    (SELECT id FROM tenants WHERE slug = 'test-company'),
    'ai-assistant',
    5
  ) as count;
"
```

**✅ Esperado:** Retorna count = 5

### 4.3 Verificar Usage Tracking

```bash
# Ver usage
psql -h localhost -U inhost_user -d inhost -c "
  SELECT
    t.name,
    tu.service_id,
    tu.count,
    tu.reset_at
  FROM tenant_usage tu
  JOIN tenants t ON t.id = tu.tenant_id
  WHERE t.slug = 'test-company';
"
```

**✅ Esperado:** 1 registro con count = 5

---

## 📋 Fase 5: Frontend Integration (30 min)

**Prerequisito:** Frontend implementado según `FRONTEND-INTEGRATION-GUIDE.md`

### 5.1 Iniciar Frontend

```bash
# Terminal 2: Frontend
cd inhost-admin-dashboard
npm run dev

# Abrir en navegador
# http://localhost:3000 (o el puerto que asigne Next.js)
```

### 5.2 Test Signup Flow (Manual)

1. Abrir http://localhost:3000/signup
2. Llenar formulario:
   - Company: "Frontend Test Co"
   - Name: "Frontend User"
   - Email: "frontend@test.com"
   - Password: "test123456"
   - Plan: "Professional"
3. Click "Create account"

**✅ Esperado:**
- Redirect a `/` (dashboard)
- Muestra nombre de usuario
- Muestra nombre de tenant
- Token guardado en localStorage

### 5.3 Test Login Flow (Manual)

1. Hacer logout
2. Abrir http://localhost:3000/login
3. Ingresar:
   - Email: "frontend@test.com"
   - Password: "test123456"
4. Click "Sign in"

**✅ Esperado:**
- Redirect a `/` (dashboard)
- Usuario autenticado

### 5.4 Test Protected Routes (Manual)

1. Hacer logout
2. Intentar acceder a http://localhost:3000/ (sin estar autenticado)

**✅ Esperado:**
- Redirect a `/login`

### 5.5 Test Logout (Manual)

1. Estar autenticado
2. Click en "Logout"

**✅ Esperado:**
- Redirect a `/login`
- localStorage.token eliminado

---

## 📋 Fase 6: Carga y Concurrencia (15 min)

### 6.1 Test Múltiples Signups Concurrentes

```bash
# Crear 5 tenants en paralelo
for i in {1..5}; do
  curl -X POST http://localhost:3000/admin/auth/signup \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"user$i@loadtest.com\",
      \"password\": \"test123456\",
      \"name\": \"Load Test User $i\",
      \"tenantName\": \"Load Test Company $i\",
      \"plan\": \"starter\"
    }" &
done

wait
```

**✅ Criterio de éxito:** 5 tenants creados sin errores

### 6.2 Verificar Tenants Creados

```bash
psql -h localhost -U inhost_user -d inhost -c "
  SELECT COUNT(*) as total_tenants
  FROM tenants;
"
```

**✅ Esperado:** Al menos 9 tenants (2 demo + 7 nuevos)

---

## 📋 Fase 7: Edge Cases y Validación (15 min)

### 7.1 Password Muy Corto

```bash
curl -X POST http://localhost:3000/admin/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "short@test.com",
    "password": "123",
    "name": "Test",
    "tenantName": "Test",
    "plan": "starter"
  }'
```

**✅ Esperado:** Error de validación (HTTP 400 o 422)

### 7.2 Email Inválido

```bash
curl -X POST http://localhost:3000/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "not-an-email",
    "password": "test123456"
  }'
```

**✅ Esperado:** Error de validación

### 7.3 Tenant Name Vacío

```bash
curl -X POST http://localhost:3000/admin/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@empty.com",
    "password": "test123456",
    "name": "Test",
    "tenantName": "",
    "plan": "starter"
  }'
```

**✅ Esperado:** Error de validación

---

## ✅ Checklist Final

### Database
- [ ] PostgreSQL corriendo
- [ ] Tablas multi-tenancy creadas
- [ ] Templates de capabilities presentes
- [ ] Funciones PostgreSQL funcionan

### Backend API
- [ ] Server corriendo en port 3000
- [ ] Health check responde OK
- [ ] POST /admin/auth/signup funciona
- [ ] POST /admin/auth/login funciona
- [ ] JWT tokens generados correctamente
- [ ] Passwords hasheados con bcrypt
- [ ] Validación de inputs funciona

### Multi-Tenancy
- [ ] Tenants creados correctamente
- [ ] Tenant users vinculados a tenants
- [ ] Capabilities aplicadas por plan
- [ ] Aislamiento de datos entre tenants
- [ ] ServiceGate usa tenant_capabilities
- [ ] Usage tracking por tenant

### Frontend (si implementado)
- [ ] Signup flow completo
- [ ] Login flow completo
- [ ] Protected routes funcionan
- [ ] Logout funciona
- [ ] Token guardado en localStorage

### Edge Cases
- [ ] Email duplicado rechazado
- [ ] Password corto rechazado
- [ ] Credenciales inválidas rechazadas
- [ ] Validación de inputs

---

## 📊 Métricas de Éxito

Al finalizar, debes tener:

- ✅ **4+ tenants** creados (2 demo + 2+ nuevos)
- ✅ **4+ tenant users** (owners)
- ✅ **Capabilities aplicadas** a todos los tenants
- ✅ **100% tests pasando** (signup, login, validación)
- ✅ **0 errores** en logs del backend
- ✅ **Frontend funcionando** (si implementado)

---

## 🐛 Troubleshooting

### PostgreSQL no conecta
```bash
# Verificar si está corriendo
docker ps | grep postgres

# Ver logs
docker-compose logs postgres

# Reiniciar
docker-compose restart postgres
```

### Backend falla al iniciar
```bash
# Verificar dependencias
bun install

# Ver logs detallados
LOG_LEVEL=debug bun --cwd apps/api-gateway dev
```

### Signup falla
```bash
# Verificar tablas
psql -h localhost -U inhost_user -d inhost -c "\dt"

# Ver últimos logs backend
tail -f apps/api-gateway/logs/...
```

---

## 📞 Siguiente Paso

Después de completar este testing plan:

1. ✅ Documentar resultados
2. ✅ Crear issues para bugs encontrados
3. ✅ Implementar endpoints restantes:
   - GET /admin/tenant
   - GET /admin/conversations
   - GET /admin/end-users
   - etc.

---

**⏰ Tiempo estimado total: 2-3 horas**
**🚀 ¡Listo para empezar testing!**
