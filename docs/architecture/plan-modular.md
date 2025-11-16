# Plan Modular e Incremental - Inhost

## 🎯 Filosofía: Módulos Independientes con Contratos Claros

**Principio fundamental:** Cada módulo tiene una **interface clara** (entrada/salida) que NO cambia, pero la **implementación interna** puede mejorar con el tiempo.

---

## 📊 Análisis de la Situación Actual

### ✅ Lo que YA tienes funcionando (80% del MVP)

1. **API Gateway** con Elysia ✅
2. **WebSocket** con broadcast ✅
3. **MessageEnvelope** como tipo base ✅
4. **Simuladores de clientes** (clients.ts) ✅
5. **Simuladores de extensiones** (extensions.ts) ✅
6. **Interface visual** (test-chat-flow.html) ✅
7. **PostgreSQL + Redis** configurados ✅

### ⚠️ Lo que falta (problemas de arquitectura)

1. **No hay contratos formales** - Los simuladores son funciones sueltas
2. **No hay protección** - Sin rate limiting ni validación
3. **No hay persistencia** - Todo en memoria
4. **No hay resiliencia** - Si algo falla, se pierde

---

## 🏗️ Arquitectura Modular Propuesta

### **Módulo 1: Adapter System**
```typescript
// Contrato (NUNCA cambia)
interface IAdapter {
  sendMessage(envelope: MessageEnvelope): Promise<SendResult>;
  receiveMessage(data: unknown): Promise<MessageEnvelope>;
}

// Implementación V1 (simple - HOY)
class SimulatedWhatsAppAdapter implements IAdapter {
  async sendMessage(envelope) {
    await sleep(100);
    return { success: true, messageId: envelope.id };
  }
}

// Implementación V2 (mejorada - FUTURO)
class RealWhatsAppAdapter implements IAdapter {
  async sendMessage(envelope) {
    // Llamada real a WhatsApp API
    const response = await whatsappApi.send(envelope);
    return { success: true, messageId: response.id };
  }
}

// Implementación V3 (con circuit breaker - MÁS FUTURO)
class ResilientWhatsAppAdapter implements IAdapter {
  async sendMessage(envelope) {
    return await this.circuitBreaker.execute(() =>
      this.whatsappApi.send(envelope)
    );
  }
}
```

**Ventaja:** Puedes usar V1 ahora, cambiar a V2 cuando estés listo, mejorar a V3 cuando necesites, **sin tocar el resto del sistema**.

---

### **Módulo 2: Rate Limiter**
```typescript
// Contrato (NUNCA cambia)
interface IRateLimiter {
  checkLimit(userId: string, plan: Plan): Promise<boolean>;
}

// Implementación V1 (simple contador en memoria - HOY)
class MemoryRateLimiter implements IRateLimiter {
  private counts = new Map<string, number>();

  async checkLimit(userId: string, plan: Plan): Promise<boolean> {
    const count = this.counts.get(userId) || 0;
    return count < this.getLimitForPlan(plan);
  }
}

// Implementación V2 (Redis con ventana deslizante - FUTURO)
class RedisRateLimiter implements IRateLimiter {
  async checkLimit(userId: string, plan: Plan): Promise<boolean> {
    const key = `rate:${userId}:minute`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    return count <= this.getLimitForPlan(plan);
  }
}

// Implementación V3 (con burst allowance - MÁS FUTURO)
class SmartRateLimiter implements IRateLimiter {
  async checkLimit(userId: string, plan: Plan): Promise<boolean> {
    // Lógica compleja con burst, ventanas múltiples, etc.
  }
}
```

**Ventaja:** Empiezas con V1 (5 minutos de código), mejoras a V2 cuando tengas clientes reales, V3 cuando lo necesites.

---

### **Módulo 3: Message Queue**
```typescript
// Contrato (NUNCA cambia)
interface IMessageQueue {
  enqueue(message: MessageEnvelope): Promise<void>;
  process(): Promise<void>;
}

// Implementación V1 (array en memoria - HOY)
class MemoryQueue implements IMessageQueue {
  private queue: MessageEnvelope[] = [];

  async enqueue(message: MessageEnvelope): Promise<void> {
    this.queue.push(message);
  }

  async process(): Promise<void> {
    while (this.queue.length > 0) {
      const message = this.queue.shift();
      await this.processMessage(message);
    }
  }
}

// Implementación V2 (Redis - FUTURO)
class RedisQueue implements IMessageQueue {
  async enqueue(message: MessageEnvelope): Promise<void> {
    await redis.lpush('queue', JSON.stringify(message));
  }

  async process(): Promise<void> {
    const msg = await redis.brpop('queue', 0);
    await this.processMessage(JSON.parse(msg));
  }
}

// Implementación V3 (Redis + PostgreSQL persistente - MÁS FUTURO)
class PersistentQueue implements IMessageQueue {
  async enqueue(message: MessageEnvelope): Promise<void> {
    // Guardar en DB primero
    await db.messages.create(message);
    // Luego encolar
    await redis.lpush('queue', message.id);
  }
}
```

**Ventaja:** V1 funciona ahora mismo, V2 cuando necesites persistencia, V3 cuando necesites garantías.

---

## 🎯 Plan de Implementación Modular

### **SPRINT 1: Formalizar lo que existe (1-2 días)**

**Objetivo:** Convertir código existente en módulos con contratos claros

#### Paso 1.1: Crear Interfaces (2 horas)
```
apps/api-gateway/src/core/
├── interfaces/
│   ├── IAdapter.ts
│   ├── IRateLimiter.ts
│   ├── IMessageQueue.ts
│   └── IValidator.ts
```

**Resultado:** Contratos definidos, nada más.

#### Paso 1.2: Migrar Simuladores a Adapters (3 horas)
```
apps/api-gateway/src/adapters/
├── simulators/
│   ├── SimulatedWhatsAppAdapter.ts  (implementa IAdapter)
│   ├── SimulatedTelegramAdapter.ts  (implementa IAdapter)
│   └── SimulatedSMSAdapter.ts       (implementa IAdapter)
└── manager/
    └── AdapterManager.ts
```

**Resultado:** Mismo comportamiento, mejor arquitectura.

#### Paso 1.3: Crear Implementaciones V1 Simples (2 horas)
```typescript
// MemoryRateLimiter (V1)
// MemoryQueue (V1)
// SimpleValidator (V1)
```

**Resultado:** Módulos básicos funcionando.

#### Paso 1.4: Integrar con Sistema Actual (2 horas)
```typescript
// Modificar routes/simulation.ts para usar los módulos
const adapterManager = new AdapterManager();
const rateLimiter = new MemoryRateLimiter();
const queue = new MemoryQueue();

adapterManager.register(new SimulatedWhatsAppAdapter());
```

**Resultado:** Sistema funcionando igual que antes, pero modular.

**TOTAL SPRINT 1:** 9 horas
**ENTREGABLE:** Sistema modular funcionando, mismo comportamiento actual

---

### **SPRINT 2: Protección Básica (1 día)**

**Objetivo:** Agregar protección mínima sin complicaciones

#### Paso 2.1: Rate Limiting Simple (2 horas)
```typescript
// Usar MemoryRateLimiter (ya creado en Sprint 1)
// Agregar middleware en API Gateway

app.use(async (context, next) => {
  const canProceed = await rateLimiter.checkLimit(
    context.userId,
    context.plan
  );

  if (!canProceed) {
    throw new AppError('Rate limit exceeded', 429);
  }

  await next();
});
```

#### Paso 2.2: Validación de Tamaño (2 horas)
```typescript
class SimpleValidator implements IValidator {
  validate(envelope: MessageEnvelope): void {
    if (envelope.content.text?.length > 16384) {
      throw new AppError('Text too long', 400);
    }

    const size = JSON.stringify(envelope).length;
    if (size > 1024 * 1024) {
      throw new AppError('Message too large', 413);
    }
  }
}
```

#### Paso 2.3: Timeouts (1 hora)
```typescript
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    )
  ]);
}

// Aplicar en extensiones
const result = await withTimeout(
  extension.processMessage(envelope),
  5000
);
```

#### Paso 2.4: Testing (3 horas)
- Probar rate limiting con test-chat-flow.html
- Intentar enviar mensajes muy largos
- Verificar timeouts

**TOTAL SPRINT 2:** 8 horas
**ENTREGABLE:** Sistema protegido, listo para clientes reales

---

### **SPRINT 3: Persistencia Básica (1-2 días)**

**Objetivo:** No perder mensajes

#### Paso 3.1: Upgrade Queue a Redis (3 horas)
```typescript
// Crear RedisQueue (V2)
// Cambiar una línea en index.ts:
const queue = new RedisQueue(); // En vez de MemoryQueue
```

#### Paso 3.2: Guardar en DB antes de procesar (2 horas)
```typescript
class PersistentQueue implements IMessageQueue {
  async enqueue(message: MessageEnvelope): Promise<void> {
    // 1. DB primero
    await db.messages.create(message);

    // 2. Redis después
    await redis.lpush('queue', message.id);
  }
}
```

#### Paso 3.3: Retry Logic Simple (2 horas)
```typescript
async function processWithRetry(message: MessageEnvelope): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await processMessage(message);
      return; // Éxito
    } catch (error) {
      if (attempt === 3) throw error; // Último intento
      await sleep(1000 * attempt); // Backoff simple
    }
  }
}
```

#### Paso 3.4: Testing (2 horas)
- Reiniciar servidor mientras procesa mensajes
- Verificar que no se pierden

**TOTAL SPRINT 3:** 9 horas
**ENTREGABLE:** Sistema que no pierde mensajes

---

### **FUTURO: Mejoras Incrementales (cuando sea necesario)**

#### Sprint 4: Rate Limiting Inteligente
- Upgrade a RedisRateLimiter
- Agregar burst allowance
- Detección de bots básica

#### Sprint 5: Circuit Breakers
- Agregar circuit breakers a adapters
- Manejo de fallos de APIs externas

#### Sprint 6: Métricas y Monitoreo
- Métricas básicas
- Dashboard simple
- Alertas por email

#### Sprint 7: Adapters Reales
- WhatsAppAdapter real
- TelegramAdapter real

---

## 📋 Estructura de Carpetas Modular

```
apps/api-gateway/src/
├── core/                           # Contratos (NUNCA cambian)
│   └── interfaces/
│       ├── IAdapter.ts
│       ├── IRateLimiter.ts
│       ├── IMessageQueue.ts
│       └── IValidator.ts
│
├── adapters/                       # Implementaciones de adapters
│   ├── base/
│   │   └── IAdapter.ts → symlink a core/interfaces/IAdapter.ts
│   ├── simulators/
│   │   ├── SimulatedWhatsAppAdapter.ts    # V1 (HOY)
│   │   ├── SimulatedTelegramAdapter.ts
│   │   └── SimulatedSMSAdapter.ts
│   ├── real/                               # V2 (FUTURO)
│   │   ├── WhatsAppAdapter.ts
│   │   └── TelegramAdapter.ts
│   ├── resilient/                          # V3 (MÁS FUTURO)
│   │   ├── ResilientWhatsAppAdapter.ts
│   │   └── ResilientTelegramAdapter.ts
│   └── manager/
│       └── AdapterManager.ts               # Usa IAdapter (no le importa la versión)
│
├── rate-limiting/                  # Implementaciones de rate limiter
│   ├── MemoryRateLimiter.ts       # V1 (HOY)
│   ├── RedisRateLimiter.ts        # V2 (FUTURO)
│   └── SmartRateLimiter.ts        # V3 (MÁS FUTURO)
│
├── queue/                          # Implementaciones de queue
│   ├── MemoryQueue.ts             # V1 (HOY)
│   ├── RedisQueue.ts              # V2 (FUTURO)
│   └── PersistentQueue.ts         # V3 (MÁS FUTURO)
│
├── validation/                     # Implementaciones de validator
│   ├── SimpleValidator.ts         # V1 (HOY)
│   └── AdvancedValidator.ts       # V2 (FUTURO)
│
└── config/
    └── dependencies.ts             # Configuración de qué versión usar
```

---

## 🔧 Archivo de Configuración Central

```typescript
// apps/api-gateway/src/config/dependencies.ts

/**
 * Configuración central de implementaciones
 *
 * Cambiar aquí para usar diferentes versiones de módulos
 * SIN modificar el resto del código
 */

// Adapters
export const ADAPTERS = {
  whatsapp: SimulatedWhatsAppAdapter,  // Cambiar a WhatsAppAdapter cuando esté listo
  telegram: SimulatedTelegramAdapter,
  sms: SimulatedSMSAdapter
};

// Rate Limiter
export const RATE_LIMITER = MemoryRateLimiter; // Cambiar a RedisRateLimiter cuando esté listo

// Message Queue
export const MESSAGE_QUEUE = MemoryQueue; // Cambiar a PersistentQueue cuando esté listo

// Validator
export const VALIDATOR = SimpleValidator;
```

**Ventaja:** Cambiar de V1 a V2 = cambiar UNA línea en UN archivo.

---

## 🎯 Recomendación: Empezar con Sprint 1

### **¿Por qué Sprint 1?**

1. **No rompe nada** - Mismo comportamiento actual
2. **Mejora arquitectura** - Código más limpio y modular
3. **Base sólida** - Prepara para mejoras futuras
4. **9 horas totales** - 1-2 días de trabajo
5. **Valor inmediato** - Código profesional, más fácil de mantener

### **Resultado después de Sprint 1:**

```typescript
// Antes (código actual)
export function createClientMessage(clientId: string, text: string) {
  // Código suelto...
}

// Después (modular)
class SimulatedWhatsAppAdapter implements IAdapter {
  async sendMessage(envelope: MessageEnvelope): Promise<SendResult> {
    // Mismo comportamiento, mejor estructura
  }
}

// Uso
const adapter = adapterManager.getAdapter('whatsapp');
const result = await adapter.sendMessage(envelope);
```

**Funciona exactamente igual, pero ahora puedes:**
- ✅ Cambiar implementación sin tocar el resto
- ✅ Agregar nuevos adapters fácilmente
- ✅ Testear cada módulo independientemente
- ✅ Mejorar progresivamente

---

## 📊 Matriz de Decisión: ¿Qué Hacer Primero?

| Sprint | Esfuerzo | Valor Inmediato | Riesgo | ¿Listo para Producción? |
|--------|----------|-----------------|--------|-------------------------|
| **Sprint 1: Modularizar** | 9h | Medio | Bajo | ❌ No (falta protección) |
| **Sprint 2: Protección** | 8h | Alto | Bajo | ⚠️ Casi (falta persistencia) |
| **Sprint 3: Persistencia** | 9h | Medio | Bajo | ✅ Sí (MVP funcional) |
| Sprint 4: Rate Limiting++ | 6h | Bajo | Bajo | ✅ Sí (mejor) |
| Sprint 5: Circuit Breakers | 8h | Medio | Medio | ✅ Sí (robusto) |
| Sprint 6: Métricas | 6h | Bajo | Bajo | ✅ Sí (observable) |

**Conclusión:** Necesitas **Sprint 1 + Sprint 2 + Sprint 3 = 26 horas (~3-4 días)** para estar listo para producción.

---

## 🚀 Mi Recomendación Final

### **Opción A: Rápido y Funcional (17 horas - 2 días)**
```
Sprint 1 (9h) + Sprint 2 (8h) = 17 horas
```
**Resultado:** Sistema modular y protegido, funcionando con clientes reales en modo MVP.

**Limitación:** Mensajes en memoria (si reinicia servidor, se pierden los que estaban en cola).

---

### **Opción B: Producción-Ready (26 horas - 3-4 días)** ⭐ RECOMENDADA
```
Sprint 1 (9h) + Sprint 2 (8h) + Sprint 3 (9h) = 26 horas
```
**Resultado:** Sistema modular, protegido y persistente. Listo para clientes reales.

**Sin limitaciones críticas.**

---

### **Opción C: Solo Modularizar Ahora (9 horas - 1 día)**
```
Sprint 1 (9h)
```
**Resultado:** Arquitectura mejorada, pero sin protección ni persistencia.

**Usar solo para:** Preparar el terreno, seguir desarrollando otros módulos después.

---

## ✅ Siguiente Paso Propuesto

Empezar con **Sprint 1** (9 horas) HOY:

1. **Crear interfaces** (2h)
2. **Migrar simuladores** (3h)
3. **Crear V1 simples** (2h)
4. **Integrar** (2h)

**Al finalizar hoy/mañana:**
- ✅ Código modular y profesional
- ✅ Mismo comportamiento actual
- ✅ Base para crecer sin límites
- ✅ Fácil de testear y mantener

**¿Empezamos con Sprint 1?**
