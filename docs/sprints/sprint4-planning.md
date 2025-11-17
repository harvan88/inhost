# 📋 Sprint 4 - Planning: Persistencia y Escalabilidad

**Estado:** 🔜 PENDIENTE
**Objetivo:** Persistencia real (no perder mensajes) y preparar para escalabilidad
**Prioridad:** Alta - Requisito para producción

---

## 🎯 Objetivos del Sprint

### Objetivo Principal
Reemplazar implementaciones V1 en memoria por implementaciones persistentes (Redis + PostgreSQL), garantizando que el sistema no pierda mensajes al reiniciar y esté listo para escalar horizontalmente.

### Objetivos Secundarios
1. Resolver race conditions del MemoryRateLimiter
2. Preparar arquitectura para clustering
3. Mantener contratos de interfaces intactos (zero breaking changes)

---

## 📊 Estado Actual (Post-Sprint 3)

**Implementaciones V1 (En Memoria):**
- ✅ MemoryRateLimiter - Funcional pero con race conditions
- ✅ MemoryQueue - Funcional pero mensajes se pierden al reiniciar
- ✅ MemoryPersistence - Funcional pero datos volátiles
- ✅ WebSocketNotification - Funcional pero solo single-server

**Limitaciones V1:**
- No persistencia real (reiniciar = pérdida de datos)
- Race conditions en rate limiting
- No clustering (single server only)
- No garantías de entrega

---

## 🔄 Implementaciones a Crear (V2)

### 1. RedisRateLimiter (V2)
**Prioridad:** Alta
**Esfuerzo:** 3-4 horas

**Beneficios:**
- ✅ Operaciones atómicas (no race conditions)
- ✅ Compartido entre múltiples instancias
- ✅ TTL automático (limpieza sin cron jobs)

**Implementación:**
```typescript
export class RedisRateLimiter implements IRateLimiter {
  async checkLimit(userId: string, plan: Plan): Promise<RateLimitResult> {
    const key = `rate:${userId}:minute`;
    const limit = this.getLimitForPlan(plan);

    // INCR es atómico - no race conditions
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, 60); // TTL 60 segundos
    }

    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    // ...
  }
}
```

**Archivo:** `apps/api-gateway/src/implementations/v2/RedisRateLimiter.ts`

---

### 2. RedisQueue (V2)
**Prioridad:** Alta
**Esfuerzo:** 4-5 horas

**Beneficios:**
- ✅ Cola persistente (no se pierde al reiniciar)
- ✅ Múltiples workers pueden consumir
- ✅ Retry automático con dead letter queue

**Implementación:**
```typescript
export class RedisQueue implements IMessageQueue {
  async enqueue(message: MessageEnvelope): Promise<void> {
    await redis.lpush('queue:messages', JSON.stringify(message));
  }

  async process(): Promise<void> {
    while (true) {
      const msg = await redis.brpop('queue:messages', 5);
      if (msg) {
        await this.processMessage(JSON.parse(msg[1]));
      }
    }
  }
}
```

**Archivo:** `apps/api-gateway/src/implementations/v2/RedisQueue.ts`

---

### 3. PostgresPersistence (V2)
**Prioridad:** Alta
**Esfuerzo:** 5-6 horas

**Beneficios:**
- ✅ Persistencia durable (no se pierde nada)
- ✅ Queries complejas (búsqueda, filtrado, estadísticas)
- ✅ Transacciones ACID

**Implementación:**
```typescript
export class PostgresPersistence implements IPersistenceService {
  async save(envelope: MessageEnvelope): Promise<void> {
    await prisma.message.create({
      data: {
        id: envelope.id,
        type: envelope.type,
        channel: envelope.channel,
        content: envelope.content,
        metadata: envelope.metadata,
        status: envelope.status,
        timestamp: new Date(envelope.metadata.timestamp)
      }
    });
  }

  async retrieve(id: string): Promise<MessageEnvelope | null> {
    const msg = await prisma.message.findUnique({ where: { id } });
    return msg ? this.toEnvelope(msg) : null;
  }
}
```

**Archivo:** `apps/api-gateway/src/implementations/v2/PostgresPersistence.ts`

---

### 4. RedisPubSubNotification (V2) - Opcional
**Prioridad:** Media
**Esfuerzo:** 4-5 horas

**Beneficios:**
- ✅ Broadcasting entre múltiples servidores
- ✅ WebSocket clustering sin sticky sessions

**Implementación:**
```typescript
export class RedisPubSubNotification implements INotificationService {
  async broadcast(envelope: MessageEnvelope, target?: NotificationTarget): Promise<void> {
    const channel = target?.userId ? `user:${target.userId}` : 'broadcast';
    await redis.publish(channel, JSON.stringify(envelope));
  }

  // Suscribirse en startup
  async subscribe() {
    redis.subscribe('broadcast');
    redis.on('message', (channel, message) => {
      // Enviar a WebSockets locales
      this.broadcastToLocalConnections(JSON.parse(message));
    });
  }
}
```

**Archivo:** `apps/api-gateway/src/implementations/v2/RedisPubSubNotification.ts`

---

## 📋 Tareas del Sprint 4

### Fase 1: Setup Infrastructure (2 horas)
- [ ] Configurar Redis connection
- [ ] Configurar Prisma schema para PostgreSQL
- [ ] Crear migraciones de base de datos
- [ ] Agregar Redis y PostgreSQL a docker-compose (si aplica)
- [ ] Verificar conexiones en startup

### Fase 2: RedisRateLimiter (3-4 horas)
- [ ] Crear `RedisRateLimiter.ts` implementando `IRateLimiter`
- [ ] Implementar operaciones atómicas con INCR
- [ ] Agregar TTL automático
- [ ] Testing: verificar no race conditions
- [ ] Actualizar `services/index.ts` para usar V2

### Fase 3: PostgresPersistence (5-6 horas)
- [ ] Crear Prisma schema para mensajes
- [ ] Generar migraciones
- [ ] Crear `PostgresPersistence.ts` implementando `IPersistenceService`
- [ ] Implementar save, retrieve, query methods
- [ ] Testing: verificar persistencia después de reiniciar
- [ ] Actualizar `services/index.ts` para usar V2

### Fase 4: RedisQueue (4-5 horas)
- [ ] Crear `RedisQueue.ts` implementando `IMessageQueue`
- [ ] Implementar enqueue con LPUSH
- [ ] Implementar process con BRPOP
- [ ] Agregar retry logic con exponential backoff
- [ ] Implementar dead letter queue para mensajes fallidos
- [ ] Testing: verificar mensajes no se pierden
- [ ] Actualizar `services/index.ts` para usar V2

### Fase 5: Testing & Verification (3-4 horas)
- [ ] Crear script de testing Sprint 4
- [ ] Test: Enviar mensajes → Reiniciar servidor → Verificar recuperación
- [ ] Test: Rate limiting concurrente (sin race conditions)
- [ ] Test: Cola persistente (mensajes sobreviven reinicio)
- [ ] Load testing básico (múltiples requests simultáneos)

### Fase 6: Documentación (2-3 horas)
- [ ] Sprint 4 report
- [ ] Actualizar CLAUDE.md con Redis/PostgreSQL setup
- [ ] Actualizar README.md
- [ ] Documentar configuración de ambiente (env vars)

---

## 🔧 Configuración Requerida

### Variables de Entorno
```bash
# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/inhost

# Rate Limiting
RATE_LIMIT_BACKEND=redis  # "memory" o "redis"

# Queue
QUEUE_BACKEND=redis  # "memory" o "redis"

# Persistence
PERSISTENCE_BACKEND=postgres  # "memory" o "postgres"
```

### Docker Compose (Opcional)
```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: inhost
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
```

---

## 📊 Estimación de Esfuerzo

| Fase | Esfuerzo | Complejidad |
|------|----------|-------------|
| Setup Infrastructure | 2h | Baja |
| RedisRateLimiter | 3-4h | Media |
| PostgresPersistence | 5-6h | Alta |
| RedisQueue | 4-5h | Alta |
| Testing & Verification | 3-4h | Media |
| Documentación | 2-3h | Baja |
| **TOTAL** | **19-24 horas** | **~3-4 días** |

---

## ✅ Criterios de Éxito Sprint 4

1. **Persistencia Verificada**
   - Enviar mensajes → Reiniciar servidor → Mensajes recuperados
   - Base de datos contiene todos los mensajes

2. **Rate Limiting sin Race Conditions**
   - 100 requests concurrentes → solo N permitidos (según plan)
   - No más "acepta más de lo esperado"

3. **Cola Persistente**
   - Mensajes en cola sobreviven reinicio
   - Workers pueden consumir de la cola

4. **Configuración Flexible**
   - Puede alternar entre V1 (memory) y V2 (redis/postgres) con env vars
   - Sin breaking changes en interfaces

5. **Tests Automatizados**
   - Script de testing Sprint 4 con 5+ tests
   - Todos los tests pasan

---

## 🚧 Riesgos y Mitigaciones

### Riesgo 1: Complejidad de Prisma Migrations
**Probabilidad:** Media
**Impacto:** Alto
**Mitigación:** Empezar con schema simple, agregar complejidad después

### Riesgo 2: Redis Connection Issues
**Probabilidad:** Baja
**Impacto:** Alto
**Mitigación:** Agregar retry logic y fallback a memory backend

### Riesgo 3: Performance Degradation
**Probabilidad:** Media
**Impacto:** Medio
**Mitigación:** Agregar indexes en PostgreSQL, usar Redis caching

---

## 🔄 Rollback Plan

Si Sprint 4 falla:
1. Revertir `services/index.ts` a usar V1 implementations
2. Sistema funciona exactamente como antes (Sprint 3)
3. Interfaces no cambiaron - zero breaking changes

**Ventaja de arquitectura modular:** Rollback = cambiar 3 líneas de código

---

## 📚 Referencias

**Documentación:**
- [Redis Commands](https://redis.io/commands/)
- [Prisma Quickstart](https://www.prisma.io/docs/getting-started/quickstart)
- [Bun Redis Client](https://bun.sh/guides/ecosystem/redis)

**Arquitectura:**
- [docs/architecture/plan-modular.md](../architecture/plan-modular.md)
- [Sprint 3 Report](sprint3-report.md)

---

**Preparado:** 2025-11-16
**Para ejecutar:** Siguiente sesión (cuando regresen créditos)
**Prioridad:** Alta - Requisito para producción
