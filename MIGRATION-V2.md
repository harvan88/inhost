# ✅ Migración a V2 (PostgreSQL) Completada

El sistema de capacidades **ya está migrado** de V1 (memoria) a V2 (PostgreSQL).

## 🎯 Cambios Realizados

### Código Migrado

✅ **services/index.ts** - Ahora usa `DatabaseServiceGate` (V2)
✅ **shared/index.ts** - Exporta `capabilities-schema`
✅ **implementations/v2/DatabaseServiceGate.ts** - Implementación completa
✅ **scripts/setup-database.ts** - Script de setup automático

### Estado Actual

- **ServiceGate:** DatabaseServiceGate (V2) - PostgreSQL backend
- **Fallback:** Si PostgreSQL no está disponible, el sistema mostrará warning pero seguirá funcionando
- **Persistencia:** Las capacidades ahora se guardan en PostgreSQL permanentemente

## 🚀 Cómo Iniciar

### Opción 1: Con PostgreSQL (Recomendado)

```bash
# 1. Iniciar PostgreSQL (requiere Docker)
docker-compose up -d postgres

# O si tienes bun:
bun run dev:db

# 2. Crear tablas (solo primera vez)
psql -h localhost -U inhost_user -d inhost -f scripts/create-tables.sql
psql -h localhost -U inhost_user -d inhost -f scripts/create-capabilities-tables.sql

# O usar script automático:
AUTO_CREATE_TABLES=true bun run scripts/setup-database.ts

# 3. Iniciar servidor
bun --cwd apps/api-gateway dev
```

### Opción 2: Sin PostgreSQL (Solo desarrollo/testing)

```bash
# El servidor iniciará con warning pero funcionará
bun --cwd apps/api-gateway dev

# Verás en los logs:
# ⚠️  PostgreSQL not available - sistema funcionará pero capacidades no persistirán
```

## 📊 Verificar que Funciona

### 1. Verificar Conexión a PostgreSQL

```bash
# Verificar que PostgreSQL está corriendo
pg_isready -h localhost -p 5432 -U inhost_user

# Esperado: "localhost:5432 - accepting connections"
```

### 2. Verificar Tablas Creadas

```bash
# Listar tablas
psql -h localhost -U inhost_user -d inhost -c "\dt"

# Deberías ver:
# - user_capabilities
# - service_usage
# - capability_templates
# - messages
# - conversations
# - users
```

### 3. Probar Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Ver capacidades (crea usuario con template 'starter' por defecto)
curl -H "X-User-Id: test-user" http://localhost:3000/me/capabilities

# Verificar en base de datos
psql -h localhost -U inhost_user -d inhost -c \
  "SELECT user_id, service_id, enabled FROM user_capabilities LIMIT 5;"
```

### 4. Verificar Persistencia

```bash
# 1. Aplicar template a usuario
curl -X POST http://localhost:3000/admin/users/test-user/template/professional

# 2. Verificar en DB
psql -h localhost -U inhost_user -d inhost -c \
  "SELECT service_id, enabled FROM user_capabilities WHERE user_id = 'test-user';"

# 3. Reiniciar servidor
# Ctrl+C y luego: bun --cwd apps/api-gateway dev

# 4. Verificar que capacidades siguen ahí
curl -H "X-User-Id: test-user" http://localhost:3000/me/capabilities
```

## 🔍 Verificar que V2 está Activo

Al iniciar el servidor, deberías ver en los logs:

```
✅ Services initialized successfully
{
  ...
  serviceGate: 'DatabaseServiceGate (V2) - PostgreSQL backend',
  messageCore: 'MessageCore (initialized with ServiceGate V2)'
}
```

Si ves esto, V2 está funcionando correctamente. ✅

## 📋 Estructura de Base de Datos

### Tabla: user_capabilities

```sql
user_id | service_id     | enabled | config                          | expires_at
--------|----------------|---------|--------------------------------|------------
user-1  | ai-assistant   | true    | {"limits": {"quota": 1000}}    | NULL
user-1  | rate-limiting  | true    | {"limits": {"rateLimit": 30}}  | NULL
user-2  | ai-assistant   | true    | {"limits": {"quota": 100}}     | 2025-12-31
```

### Tabla: service_usage

```sql
user_id | service_id     | count | reset_at            | last_used_at
--------|----------------|-------|---------------------|-------------
user-1  | rate-limiting  | 5     | 2025-11-19 10:15:00 | 2025-11-19 10:14:30
user-1  | ai-assistant   | 23    | 2025-11-20 00:00:00 | 2025-11-19 10:14:45
```

### Tabla: capability_templates

```sql
name          | description                        | is_active
--------------|------------------------------------|-----------
starter       | Basic features for getting started | true
professional  | Advanced features for power users  | true
enterprise    | Unlimited features for large teams | true
```

## 🛠️ Comandos Útiles

```bash
# Ver templates disponibles
psql -h localhost -U inhost_user -d inhost -c \
  "SELECT name, description FROM capability_templates;"

# Aplicar template 'professional' a usuario
psql -h localhost -U inhost_user -d inhost -c \
  "SELECT apply_template_to_user('user-123'::uuid, 'professional');"

# Ver uso de servicios
psql -h localhost -U inhost_user -d inhost -c \
  "SELECT user_id, service_id, count, reset_at FROM service_usage;"

# Resetear uso de un usuario
DELETE FROM service_usage WHERE user_id = 'test-user';

# Ver capacidades de un usuario
SELECT service_id, enabled, config
FROM user_capabilities
WHERE user_id = 'test-user'
ORDER BY service_id;
```

## 🔄 Rollback a V1 (si necesario)

Si encuentras problemas con V2:

```typescript
// apps/api-gateway/src/services/index.ts

// Cambiar de:
import { DatabaseServiceGate } from '../implementations/v2';
export const serviceGate = new DatabaseServiceGate();

// A:
import { CapabilityBasedServiceGate } from '../implementations/v1';
export const serviceGate = new CapabilityBasedServiceGate();
```

Reinicia el servidor y volverás a V1 (memoria).

## 📚 Documentación Completa

- **[Database README](docs/database/README.md)** - Guía completa de base de datos
- **[Migration Guide](docs/database/migration-v1-to-v2.md)** - Guía detallada de migración
- **[Capabilities API](docs/frontend-integration/capabilities-api.md)** - Integración con frontend
- **[Migration Docs](docs/migration/plan-to-capabilities.md)** - De planes a capacidades

## ❓ Troubleshooting

### "PostgreSQL not available"

```bash
# Verificar si PostgreSQL está corriendo
pg_isready -h localhost -p 5432 -U inhost_user

# Si no: iniciar PostgreSQL
docker-compose up -d postgres
# O
bun run dev:db
```

### "Table does not exist"

```bash
# Crear tablas
psql -h localhost -U inhost_user -d inhost -f scripts/create-tables.sql
psql -h localhost -U inhost_user -d inhost -f scripts/create-capabilities-tables.sql
```

### "Connection refused"

Verifica que PostgreSQL esté escuchando en puerto 5432:

```bash
netstat -an | grep 5432
# O
lsof -i :5432
```

## ✅ Checklist de Verificación

- [ ] PostgreSQL está corriendo
- [ ] Tablas de capacidades creadas
- [ ] Servidor inicia sin errores
- [ ] Logs muestran "DatabaseServiceGate (V2)"
- [ ] Endpoint `/me/capabilities` funciona
- [ ] Datos persisten después de reiniciar
- [ ] Templates se pueden aplicar
- [ ] Uso se trackea correctamente

## 🎉 Siguiente Paso

El sistema está listo para usar V2 con PostgreSQL. Ahora puedes:

1. ✅ Usar capacidades persistentes
2. ✅ Configurar trials con expiración
3. ✅ Escalar horizontalmente (múltiples instancias)
4. ✅ Modificar templates sin cambiar código
5. ✅ Tener auditoría completa de cambios

**¡La migración está completa! 🚀**
