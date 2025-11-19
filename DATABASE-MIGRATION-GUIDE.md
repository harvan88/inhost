# 🗄️ Guía Completa de Migración de Base de Datos

## 📍 Estado Actual de la Base de Datos

### ✅ Ya Configurado (Sesiones Anteriores)
- PostgreSQL está instalado y configurado
- Tablas básicas creadas: `messages`, `conversations`, `users`
- Tablas de Capabilities V2: `user_capabilities`, `service_usage`, `capability_templates`

### 🆕 Nuevo (Esta Sesión)
- Tablas multi-tenancy diseñadas pero NO ejecutadas aún
- Script de migración de datos creado

---

## 📊 Scripts SQL Disponibles

```bash
scripts/
├── create-tables.sql                    # ✅ YA EJECUTADO
│   └── Crea: messages, conversations, users
│
├── create-capabilities-tables.sql       # ✅ YA EJECUTADO
│   └── Crea: user_capabilities, service_usage, capability_templates
│
├── create-multi-tenancy-tables.sql      # 🆕 NUEVO (no ejecutado)
│   └── Crea: tenants, tenant_users, end_users, tenant_capabilities, tenant_usage
│
└── migrate-to-multi-tenancy.sql         # 🆕 NUEVO (no ejecutado)
    └── Migra datos de user_capabilities → tenant_capabilities
```

---

## 🚀 Pasos de Migración (Ejecutar en Orden)

### Paso 1: Iniciar PostgreSQL

```bash
# Opción A: Con Docker
docker-compose up -d postgres

# Opción B: Con Bun
bun run dev:db

# Verificar que está corriendo
pg_isready -h localhost -p 5432 -U inhost_user
# Esperado: "localhost:5432 - accepting connections"
```

---

### Paso 2: Verificar Tablas Existentes

```bash
# Listar tablas actuales
psql -h localhost -U inhost_user -d inhost -c "\dt"
```

**Deberías ver:**
```
 Schema |        Name          | Type  |   Owner
--------+----------------------+-------+-------------
 public | capability_templates | table | inhost_user
 public | conversations        | table | inhost_user
 public | messages             | table | inhost_user
 public | service_usage        | table | inhost_user
 public | user_capabilities    | table | inhost_user
 public | users                | table | inhost_user
```

---

### Paso 3: Crear Tablas Multi-Tenancy

```bash
psql -h localhost -U inhost_user -d inhost -f scripts/create-multi-tenancy-tables.sql
```

**Esto creará:**
- `tenants` - Organizaciones
- `tenant_users` - Admins/agentes de organizaciones
- `end_users` - Clientes finales (WhatsApp, Instagram, etc.)
- `tenant_capabilities` - Capabilities por organización
- `tenant_usage` - Usage por organización

**También incluye:**
- Funciones helper: `apply_template_to_tenant()`, `increment_tenant_usage()`, etc.
- Triggers: Auto-update de `updated_at`
- Datos de ejemplo (2 tenants demo)

---

### Paso 4: Migrar Datos Existentes

```bash
psql -h localhost -U inhost_user -d inhost -f scripts/migrate-to-multi-tenancy.sql
```

**Esto hará:**
1. ✅ Convierte cada `user` → `tenant` (organización individual)
2. ✅ Crea `tenant_user` (owner) para cada tenant
3. ✅ Migra `user_capabilities` → `tenant_capabilities`
4. ✅ Migra `service_usage` → `tenant_usage`
5. ✅ Marca tablas viejas como DEPRECATED

**Resultado:**
```
✅ Migrated 5 users to tenants
✅ Created 5 tenant_users (owners)
✅ Migrated 15 capabilities to tenant_capabilities
✅ Migrated 8 usage records to tenant_usage
```

---

### Paso 5: Verificar Migración

```bash
# Ver tenants creados
psql -h localhost -U inhost_user -d inhost -c "SELECT id, name, slug, plan FROM tenants;"

# Ver tenant_users
psql -h localhost -U inhost_user -d inhost -c "SELECT email, role, tenant_id FROM tenant_users;"

# Ver capabilities migradas
psql -h localhost -U inhost_user -d inhost -c "
  SELECT
    t.name AS tenant_name,
    tc.service_id,
    tc.enabled
  FROM tenant_capabilities tc
  JOIN tenants t ON t.id = tc.tenant_id
  ORDER BY t.name, tc.service_id;
"
```

---

## 📋 Estructura de Tablas Final

### Tablas Multi-Tenancy (NUEVAS - Usar estas)
```sql
tenants              → Organizaciones que compran el servicio
tenant_users         → Empleados/admins de organizaciones
end_users            → Clientes finales (WhatsApp, Instagram, etc.)
tenant_capabilities  → Capabilities a nivel organización ✅ USAR
tenant_usage         → Usage tracking por organización ✅ USAR
```

### Tablas Legacy (DEPRECATED - No usar más)
```sql
users                → DEPRECATED (migrado a tenants + tenant_users)
user_capabilities    → DEPRECATED (migrado a tenant_capabilities)
service_usage        → DEPRECATED (migrado a tenant_usage)
```

### Tablas Compartidas (Sin cambios)
```sql
messages             → Sin cambios
conversations        → Ahora con tenant_id y end_user_id
capability_templates → Sin cambios
```

---

## 🔄 Ejemplo de Migración

### Antes (Legacy)
```sql
-- Tabla: users
id   | email                | plan
-----|----------------------|------------
001  | admin@tiendaxyz.com  | premium

-- Tabla: user_capabilities
user_id | service_id     | enabled
--------|----------------|--------
001     | ai-assistant   | true
001     | analytics      | true
```

### Después (Multi-Tenancy)
```sql
-- Tabla: tenants
id   | name        | slug        | plan
-----|-------------|-------------|-------------
001  | Tienda XYZ  | tienda-xyz  | professional

-- Tabla: tenant_users
email                | role  | tenant_id
---------------------|-------|----------
admin@tiendaxyz.com  | owner | 001

-- Tabla: tenant_capabilities
tenant_id | service_id     | enabled
----------|----------------|--------
001       | ai-assistant   | true
001       | analytics      | true

-- Tabla: end_users (creados cuando llegan mensajes)
id   | tenant_id | phone          | name
-----|-----------|----------------|------------
101  | 001       | +5215512345678 | Juan Pérez
102  | 001       | +5215522222222 | María López
```

---

## ⚠️ Importante: Qué Cambiar en el Código

### Backend - Actualizar Queries

**ANTES (usar user_capabilities):**
```typescript
const capabilities = await db.query(`
  SELECT * FROM user_capabilities
  WHERE user_id = $1
`, [userId]);
```

**DESPUÉS (usar tenant_capabilities):**
```typescript
// Extraer tenant_id del JWT
const tenantId = request.tenantId; // Del JWT payload

const capabilities = await db.query(`
  SELECT * FROM tenant_capabilities
  WHERE tenant_id = $1
`, [tenantId]);
```

### ServiceGate V2 - Actualizar

```typescript
// apps/api-gateway/src/implementations/v2/DatabaseServiceGate.ts

// CAMBIAR:
// FROM user_capabilities WHERE user_id = ?

// A:
// FROM tenant_capabilities WHERE tenant_id = ?
```

---

## 🧪 Testing Después de Migración

### Test 1: Verificar Tenants
```bash
psql -h localhost -U inhost_user -d inhost -c "
  SELECT COUNT(*) AS total_tenants FROM tenants;
"
# Esperado: Al menos 2 (los tenants demo)
```

### Test 2: Verificar Capabilities por Tenant
```bash
psql -h localhost -U inhost_user -d inhost -c "
  SELECT
    t.name,
    COUNT(tc.id) AS capabilities_count
  FROM tenants t
  LEFT JOIN tenant_capabilities tc ON tc.tenant_id = t.id
  GROUP BY t.id, t.name;
"
```

### Test 3: Verificar Función Helper
```bash
psql -h localhost -U inhost_user -d inhost -c "
  SELECT tenant_can_use_service(
    '00000000-0000-0000-0000-000000000001'::uuid,
    'ai-assistant'
  );
"
# Esperado: {"allowed": true, "config": {...}}
```

---

## 🗑️ Limpieza (Opcional - Solo si todo funciona)

### Opción A: Renombrar Tablas Legacy (Recomendado)
```sql
ALTER TABLE user_capabilities RENAME TO user_capabilities_legacy;
ALTER TABLE service_usage RENAME TO service_usage_legacy;
-- users se mantiene porque puede tener otros usos
```

### Opción B: Eliminar Tablas Legacy (Solo si estás 100% seguro)
```sql
DROP TABLE user_capabilities;
DROP TABLE service_usage;
-- NO eliminar "users" aún (puede tener referencias)
```

**Recomendación:** Esperar 1-2 semanas antes de eliminar para asegurarse de que todo funciona.

---

## ✅ Checklist de Migración

- [ ] PostgreSQL está corriendo
- [ ] Backup de DB actual creado
  ```bash
  pg_dump -h localhost -U inhost_user inhost > backup_pre_migration_$(date +%Y%m%d).sql
  ```
- [ ] `create-multi-tenancy-tables.sql` ejecutado
- [ ] `migrate-to-multi-tenancy.sql` ejecutado
- [ ] Verificación: Tenants creados
- [ ] Verificación: Tenant_users creados
- [ ] Verificación: Capabilities migradas
- [ ] Backend actualizado para usar `tenant_capabilities`
- [ ] Testing de endpoints con nuevas tablas
- [ ] Todo funciona correctamente
- [ ] (Opcional) Renombrar/eliminar tablas legacy

---

## 🚨 Troubleshooting

### Error: "Table already exists"
```
Ya ejecutaste create-multi-tenancy-tables.sql antes.
Solución: Omitir y ejecutar migrate-to-multi-tenancy.sql
```

### Error: "Tenant not found"
```
No se crearon tenants en la migración.
Solución: Verificar que hay datos en tabla "users" antes de migrar
```

### Error: "Column tenant_id does not exist"
```
No se ejecutó create-multi-tenancy-tables.sql
Solución: Ejecutar ese script primero
```

---

## 📞 Siguiente Paso

Después de ejecutar la migración:

1. ✅ Implementar `/admin/auth/login` endpoint
2. ✅ Actualizar `DatabaseServiceGate` para usar `tenant_capabilities`
3. ✅ Implementar resto de endpoints `/admin/*`
4. ✅ Crear frontend `inhost-admin-dashboard`

---

## 📚 Documentación Relacionada

- `docs/database/multi-tenancy-model.md` - Modelo completo
- `docs/migration/clean-migration-strategy.md` - Estrategia de migración
- `SESSION-SUMMARY.md` - Resumen de esta sesión
