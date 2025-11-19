# Migración: V1 (Memory) → V2 (Database)

Guía para migrar de implementaciones en memoria a implementaciones persistentes con PostgreSQL.

## 🎯 Objetivo

Migrar el sistema de:
- **V1 (MemoryServiceGate)** - Capacidades en memoria, se pierden al reiniciar
- **V2 (DatabaseServiceGate)** - Capacidades en PostgreSQL, persistentes

## 📋 Checklist de Migración

### Paso 1: Preparar Base de Datos

```bash
# 1. Iniciar PostgreSQL (si no está corriendo)
bun run dev:db

# 2. Crear tablas de capacidades
psql -h localhost -U inhost_user -d inhost -f scripts/create-capabilities-tables.sql

# 3. Verificar tablas creadas
psql -h localhost -U inhost_user -d inhost -c "\dt"

# Deberías ver:
# - user_capabilities
# - service_usage
# - capability_templates
```

### Paso 2: Actualizar Schema de Drizzle

El schema ya está creado en `packages/shared/src/database/capabilities-schema.ts`.

Importarlo donde sea necesario:

```typescript
// En tu código
import {
  userCapabilities,
  serviceUsage,
  capabilityTemplates
} from '@inhost/shared';
```

### Paso 3: Cambiar de V1 a V2 en services/index.ts

**Antes (V1):**
```typescript
import { CapabilityBasedServiceGate } from '../implementations/v1';

export const serviceGate = new CapabilityBasedServiceGate();
```

**Después (V2):**
```typescript
import { DatabaseServiceGate } from '../implementations/v2';

export const serviceGate = new DatabaseServiceGate();
```

### Paso 4: Migrar Datos Existentes (Opcional)

Si ya tienes usuarios con capacidades en V1, puedes migrarlos:

```typescript
// Script de migración (one-time)
import { CapabilityBasedServiceGate } from './implementations/v1';
import { DatabaseServiceGate } from './implementations/v2';

async function migrateCapabilities() {
  const v1Gate = new CapabilityBasedServiceGate();
  const v2Gate = new DatabaseServiceGate();

  // Obtener usuarios de V1 (si tienes lista)
  const userIds = ['user1', 'user2', 'user3'];

  for (const userId of userIds) {
    // Obtener capacidades de V1
    const v1Caps = await v1Gate.getUserCapabilities(userId);

    // Migrar a V2
    await v2Gate.updateUserCapabilities(userId, {
      services: v1Caps.services,
      globalLimits: v1Caps.globalLimits
    });

    console.log(`✅ Migrated ${userId}`);
  }
}
```

### Paso 5: Verificar Funcionamiento

```bash
# 1. Reiniciar servidor
bun --cwd apps/api-gateway dev

# 2. Verificar que usa DatabaseServiceGate
# Deberías ver en los logs:
# "🚪 DatabaseServiceGate (V2) initialized - PostgreSQL backend"

# 3. Probar endpoints
curl -H "X-User-Id: test-user" http://localhost:3000/me/capabilities

# 4. Verificar en DB
psql -h localhost -U inhost_user -d inhost -c "SELECT * FROM user_capabilities LIMIT 5;"
```

## 🔄 Comparación V1 vs V2

| Aspecto | V1 (Memory) | V2 (Database) |
|---------|-------------|---------------|
| **Persistencia** | ❌ Se pierde al reiniciar | ✅ Persiste en PostgreSQL |
| **Escalabilidad** | ❌ Solo 1 instancia | ✅ Múltiples instancias (horizontal scaling) |
| **Trials/Expiración** | ⚠️  Manual | ✅ Automático via `expires_at` |
| **Templates** | ⚠️  Hardcoded en código | ✅ Configurables en DB |
| **Tracking de uso** | ⚠️  En memoria | ✅ Persistente con SQL |
| **Performance** | ⭐⭐⭐⭐⭐ Muy rápido | ⭐⭐⭐⭐ Rápido (con índices) |
| **Setup** | ✅ Sin dependencias | ⚠️  Requiere PostgreSQL |

## 📊 Esquema de Base de Datos

### Tabla: user_capabilities

```sql
CREATE TABLE user_capabilities (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    service_id VARCHAR(100),  -- 'ai-assistant', 'rate-limiting', etc.
    enabled BOOLEAN,
    config JSONB,             -- Configuración del servicio
    expires_at TIMESTAMP,     -- Para trials/promos
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

**Ejemplo de row:**

```json
{
  "user_id": "123-456-789",
  "service_id": "ai-assistant",
  "enabled": true,
  "config": {
    "limits": { "quota": 1000 },
    "features": { "model": "gpt-4" }
  },
  "expires_at": "2025-12-31T23:59:59Z"
}
```

### Tabla: service_usage

```sql
CREATE TABLE service_usage (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    service_id VARCHAR(100),
    count INTEGER,            -- Uso actual
    reset_at TIMESTAMP,       -- Cuándo se resetea
    last_used_at TIMESTAMP
);
```

### Tabla: capability_templates

```sql
CREATE TABLE capability_templates (
    id UUID PRIMARY KEY,
    name VARCHAR(100),        -- 'starter', 'professional', 'enterprise'
    description TEXT,
    services JSONB,           -- Configuración de servicios
    global_limits JSONB,
    is_active BOOLEAN
);
```

## 🛠️ Operaciones Comunes

### Aplicar Template a Usuario

```typescript
// V2 - Desde base de datos
await serviceGate.applyTemplate('user123', 'professional');

// Esto ejecuta SQL:
// 1. DELETE FROM user_capabilities WHERE user_id = 'user123'
// 2. SELECT services FROM capability_templates WHERE name = 'professional'
// 3. INSERT INTO user_capabilities (user_id, service_id, enabled, config) VALUES ...
```

### Habilitar Servicio Individual

```typescript
// V2
await serviceGate.setServiceEnabled('user123', 'ai-assistant', true);

// SQL:
// UPDATE user_capabilities
// SET enabled = true
// WHERE user_id = 'user123' AND service_id = 'ai-assistant'
```

### Actualizar Límites

```typescript
// V2
await serviceGate.updateServiceConfig('user123', 'rate-limiting', {
  limits: { rateLimit: 50 }
});

// SQL (upsert):
// INSERT INTO user_capabilities (user_id, service_id, config)
// VALUES ('user123', 'rate-limiting', '{"limits": {"rateLimit": 50}}')
// ON CONFLICT (user_id, service_id)
// DO UPDATE SET config = config || '{"limits": {"rateLimit": 50}}'::jsonb
```

### Tracking de Uso

```typescript
// Incrementar uso
await serviceGate.recordServiceUsage('user123', 'ai-assistant', 1);

// SQL:
// INSERT INTO service_usage (user_id, service_id, count, reset_at)
// VALUES ('user123', 'ai-assistant', 1, NOW() + INTERVAL '1 minute')
// ON CONFLICT (user_id, service_id)
// DO UPDATE SET
//   count = CASE WHEN service_usage.reset_at < NOW() THEN 1 ELSE service_usage.count + 1 END,
//   reset_at = CASE WHEN service_usage.reset_at < NOW() THEN NOW() + INTERVAL '1 minute' ELSE service_usage.reset_at END
```

## 🧪 Testing

### Test 1: Verificar Persistencia

```bash
# 1. Aplicar template
curl -X POST http://localhost:3000/admin/users/test-user/template/professional

# 2. Verificar en DB
psql -h localhost -U inhost_user -d inhost -c \
  "SELECT service_id, enabled FROM user_capabilities WHERE user_id = 'test-user';"

# 3. Reiniciar servidor
bun restart

# 4. Verificar que capacidades siguen ahí
curl http://localhost:3000/me/capabilities -H "X-User-Id: test-user"
```

### Test 2: Trials con Expiración

```bash
# 1. Dar trial de AI por 7 días
psql -h localhost -U inhost_user -d inhost <<SQL
INSERT INTO user_capabilities (user_id, service_id, enabled, config, expires_at)
VALUES (
  'trial-user',
  'ai-assistant',
  true,
  '{"limits": {"quota": 100}}',
  NOW() + INTERVAL '7 days'
);
SQL

# 2. Verificar que está habilitado
curl http://localhost:3000/me/services/ai-assistant -H "X-User-Id: trial-user"
# → allowed: true

# 3. Simular expiración (cambiar expires_at a pasado)
psql -h localhost -U inhost_user -d inhost <<SQL
UPDATE user_capabilities
SET expires_at = NOW() - INTERVAL '1 day'
WHERE user_id = 'trial-user' AND service_id = 'ai-assistant';
SQL

# 4. Verificar que ahora está bloqueado
curl http://localhost:3000/me/services/ai-assistant -H "X-User-Id: trial-user"
# → allowed: false, reason: "Service expired"
```

## 🚨 Rollback a V1 (si necesario)

Si encuentras problemas con V2, puedes volver a V1 temporalmente:

```typescript
// services/index.ts
import { CapabilityBasedServiceGate } from '../implementations/v1';

export const serviceGate = new CapabilityBasedServiceGate();
```

**Nota:** Los datos en PostgreSQL se mantendrán, solo volverás a usar memoria temporalmente.

## 📈 Performance

### Optimizaciones Aplicadas

1. **Índices en columnas críticas:**
   ```sql
   CREATE INDEX idx_user_capabilities_user_id ON user_capabilities(user_id);
   CREATE INDEX idx_service_usage_user_id ON service_usage(user_id);
   ```

2. **UPSERT para evitar race conditions:**
   ```sql
   INSERT ... ON CONFLICT DO UPDATE
   ```

3. **Connection pooling:**
   ```typescript
   const pool = new Pool({ max: 20 });
   ```

### Benchmarks Esperados

| Operación | V1 (Memory) | V2 (Database) |
|-----------|-------------|---------------|
| `canUseService()` | ~0.1ms | ~2ms |
| `recordServiceUsage()` | ~0.2ms | ~5ms |
| `getUserCapabilities()` | ~0.3ms | ~10ms |

**Nota:** V2 es ~20-50x más lento que V1, pero sigue siendo muy rápido (< 10ms).

## ✅ Verificación Final

Después de migrar, verifica:

- [ ] Servidor inicia sin errores
- [ ] Logs muestran "DatabaseServiceGate (V2) initialized"
- [ ] Endpoints `/me/capabilities` funcionan
- [ ] Datos persisten después de reiniciar servidor
- [ ] Templates se pueden aplicar desde DB
- [ ] Uso de servicios se trackea correctamente
- [ ] Expiración de trials funciona

## 🎯 Próximos Pasos

Una vez V2 funcionando:

1. Agregar más templates en DB
2. Implementar job de limpieza de usage expirado
3. Agregar auditoría de cambios de capacidades
4. Dashboard admin para gestionar capacidades
5. Métricas de uso agregadas

## 📚 Recursos

- [Schema de Drizzle](../../packages/shared/src/database/capabilities-schema.ts)
- [DatabaseServiceGate V2](../../apps/api-gateway/src/implementations/v2/DatabaseServiceGate.ts)
- [SQL de creación](../../scripts/create-capabilities-tables.sql)
- [Documentación de DB](./README.md)
