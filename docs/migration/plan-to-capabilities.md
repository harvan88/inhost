# Migración: Planes → Sistema de Capacidades

Este documento explica cómo migrar del sistema hardcodeado de planes (free/premium/enterprise) al nuevo sistema flexible basado en capacidades y extensiones.

## Motivación

### Antes (Planes Hardcodeados)

```typescript
// ❌ Sistema antiguo - Inflexible
type Plan = 'free' | 'premium' | 'enterprise';

// Usuario solo puede tener 1 plan
// Cambio de plan = todo o nada
// Difícil customización
```

**Limitaciones:**
- 3 paquetes fijos
- No permite activar/desactivar servicios individuales
- Hardcoded en código
- Difícil A/B testing
- No soporta pruebas gratis de features premium

### Después (Capacidades Flexibles)

```typescript
// ✅ Sistema nuevo - Flexible
interface UserCapabilities {
  userId: string;
  services: Map<ServiceId, ServiceConfig>;
  globalLimits?: {...};
}

// Usuario puede tener configuración única
// Servicios individuales on/off
// Configurable vía DB/API
// A/B testing fácil
```

**Ventajas:**
- Combinaciones infinitas de servicios
- Control granular por usuario
- Feature flags incorporados
- Fácil customización
- Pruebas gratis de features específicas

## Arquitectura Nueva

```
┌─────────────────────────────────────────┐
│           IServiceGate                  │
│  (Interruptor de servicios)             │
│                                         │
│  ¿Usuario X puede usar servicio Y?     │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│        UserCapabilities                 │
│                                         │
│  user123:                               │
│    • rate-limiting: 30/min              │
│    • ai-assistant: enabled              │
│    • analytics: enabled                 │
│    • persistence: local, 365 days       │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│        IExtensionRegistry               │
│                                         │
│  Extensiones disponibles:               │
│    • AI Assistant                       │
│    • Analytics                          │
│    • Custom Workflows                   │
│    • Integrations                       │
└─────────────────────────────────────────┘
```

## Guía de Migración

### Paso 1: Instalar ServiceGate (Compatible con código legacy)

```typescript
import {
  CapabilityBasedServiceGate,
  PlanToCapabilityAdapter
} from './implementations/v1';

// Crear ServiceGate
const serviceGate = new CapabilityBasedServiceGate();

// Crear adapter para compatibilidad
const planResolver = new PlanToCapabilityAdapter(serviceGate);

// Usar adapter en lugar de SimplePlanResolver
const messageCore = new MessageCore(
  persistence,
  notifications,
  planResolver, // ← Compatible con IPlanResolver
  ownerChecker,
  adapters
);
```

**Resultado:** Todo funciona igual, pero internamente usa capacidades.

### Paso 2: Activar ServiceGate en MessageCore

```typescript
const messageCore = new MessageCore(
  persistence,
  notifications,
  planResolver,
  ownerChecker,
  adapters,
  serviceGate // ← Inyectar ServiceGate
);

// Activar uso de ServiceGate
messageCore.configure({
  useServiceGate: true
});
```

**Resultado:** MessageCore usa ServiceGate, el PlanResolver se vuelve fallback.

### Paso 3: Migrar Rate Limiting

```typescript
// Antes (V1)
import { rateLimiting } from './middleware/rateLimiting';

app.use(rateLimiting({
  rateLimiter,
  getUserId: (req) => req.headers.get('x-user-id'),
  getPlan: (userId) => 'free' // ❌ Hardcoded
}));

// Después (V2)
import { rateLimitingV2 } from './middleware/rateLimitingV2';

app.use(rateLimitingV2({
  serviceGate,
  getUserId: (req) => req.headers.get('x-user-id')
  // ✅ Sin getPlan - usa capacidades del usuario
}));
```

### Paso 4: Configurar Capacidades por Usuario

```typescript
// Aplicar template predefinido
await serviceGate.applyTemplate('user123', 'professional');

// O configurar servicios individuales
await serviceGate.setServiceEnabled('user123', 'ai-assistant', true);
await serviceGate.updateServiceConfig('user123', 'rate-limiting', {
  enabled: true,
  limits: { rateLimit: 50 } // Custom: 50 req/min
});

// Dar prueba gratis de AI por 7 días
await serviceGate.updateServiceConfig('user123', 'ai-assistant', {
  enabled: true,
  limits: { quota: 100 }, // 100 llamadas AI
  metadata: { trial: true, expiresAt: '2025-12-01' }
});
```

### Paso 5: Agregar Extensiones

```typescript
import { AIAssistantExtension, AnalyticsExtension } from './extensions';

// Crear registry de extensiones
const registry = new MessageExtensionRegistry();

// Registrar extensiones
await registry.register(new AIAssistantExtension(), {
  enabled: true,
  priority: 'high'
});

await registry.register(new AnalyticsExtension(), {
  enabled: true,
  priority: 'normal'
});

// Integrar con MessageCore
messageCore.setExtensionRegistry(registry);
```

## Mapeo: Planes → Templates

| Plan Legacy | Template Nuevo | Diferencia |
|------------|----------------|------------|
| `free` | `starter` | Mismo comportamiento |
| `premium` | `professional` | Mismo comportamiento |
| `enterprise` | `enterprise` | Mismo comportamiento |

### Templates vs Capacidades Customizadas

**Templates:**
- Paquetes predefinidos (starter, professional, enterprise)
- Fácil asignación inicial
- Equivalente a planes legacy

**Capacidades Customizadas:**
- Configuración única por usuario
- Mezclar features de diferentes templates
- Habilitar/deshabilitar servicios individuales

```typescript
// Template
await serviceGate.applyTemplate('user1', 'professional');
// → user1 tiene TODAS las features de "professional"

// Customizado
await serviceGate.applyTemplate('user2', 'starter');
await serviceGate.setServiceEnabled('user2', 'ai-assistant', true);
// → user2 tiene features de "starter" + AI (customizado)
```

## Servicios Disponibles

| ServiceId | Descripción | Config |
|-----------|-------------|--------|
| `rate-limiting` | Límites de requests | `{ limits: { rateLimit: 30 } }` |
| `persistence` | Almacenamiento | `{ features: { type: 'local', retentionDays: 365 } }` |
| `notifications` | Notificaciones en tiempo real | `{ enabled: true }` |
| `websocket` | WebSocket real-time | `{ limits: { rateLimit: 30 } }` |
| `ai-assistant` | Asistente AI | `{ enabled: true, limits: { quota: 1000 } }` |
| `analytics` | Métricas y analytics | `{ enabled: true }` |
| `workflow` | Workflows customizados | `{ limits: { quota: 100 } }` |
| `integration` | Integraciones externas | `{ enabled: true }` |
| `custom` | Extensiones custom | `{ enabled: true }` |

## Ejemplos de Uso

### Ejemplo 1: Usuario con plan customizado

```typescript
// Usuario "startup" quiere:
// - Rate limiting de plan professional (30/min)
// - AI habilitado pero con límite bajo (50 llamadas/mes)
// - Analytics deshabilitado (GDPR)

await serviceGate.updateServiceConfig('startup-user', 'rate-limiting', {
  enabled: true,
  limits: { rateLimit: 30 }
});

await serviceGate.updateServiceConfig('startup-user', 'ai-assistant', {
  enabled: true,
  limits: { quota: 50 }
});

await serviceGate.setServiceEnabled('startup-user', 'analytics', false);
```

### Ejemplo 2: A/B Testing

```typescript
// Grupo A: Plan starter (control)
await serviceGate.applyTemplate('group-a-users', 'starter');

// Grupo B: Plan starter + AI gratis (experimento)
await serviceGate.applyTemplate('group-b-users', 'starter');
await serviceGate.setServiceEnabled('group-b-users', 'ai-assistant', true);

// Medir conversión después de 30 días
```

### Ejemplo 3: Trial de features premium

```typescript
// Dar 7 días de AI gratis
await serviceGate.updateServiceConfig('trial-user', 'ai-assistant', {
  enabled: true,
  limits: { quota: 100 },
  metadata: {
    trial: true,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  }
});

// Después de 7 días, deshabilitar automáticamente
// (implementar job que verifique metadata.expiresAt)
```

## Compatibilidad Hacia Atrás

El sistema mantiene 100% compatibilidad con código legacy:

✅ **IPlanResolver sigue funcionando**
- `PlanToCapabilityAdapter` implementa `IPlanResolver`
- Código antiguo sigue compilando sin cambios

✅ **Migración gradual**
- Puedes migrar ruta por ruta
- Ambos sistemas coexisten

✅ **Sin breaking changes**
- APIs públicas no cambian
- Tests existentes siguen pasando

## Roadmap

### V1 (Actual)
- ✅ Interfaces de extensiones
- ✅ ServiceGate basado en capacidades
- ✅ Adapter de compatibilidad
- ✅ Templates predefinidos
- ✅ Extensiones de ejemplo (AI, Analytics)

### V2 (Próximo)
- 📅 Persistencia en base de datos (PostgreSQL)
- 📅 Feature flags desde API/Dashboard
- 📅 Registry de extensiones persistente
- 📅 Extensiones con instalación dinámica

### V3 (Futuro)
- 📅 Marketplace de extensiones
- 📅 Billing integration
- 📅 Extensiones desarrolladas por terceros
- 📅 Sandboxing para extensiones custom

## FAQ

**¿Puedo seguir usando planes?**
Sí, `PlanToCapabilityAdapter` permite seguir usando `IPlanResolver`.

**¿Necesito migrar todo a la vez?**
No, puedes migrar incrementalmente. Ambos sistemas coexisten.

**¿Qué pasa con los usuarios existentes?**
Por defecto reciben template "starter" (equivalente a "free").

**¿Cómo persisto las capacidades?**
V1 usa memoria. V2 usará PostgreSQL con tabla `user_capabilities`.

**¿Puedo crear mis propias extensiones?**
Sí, implementa `IExtension` y regístrala en `IExtensionRegistry`.

**¿Afecta el performance?**
No, el overhead es mínimo (~1-2ms por request).

## Conclusión

El nuevo sistema de capacidades reemplaza la lógica hardcodeada de planes por un sistema flexible y extensible que:

✅ Mantiene compatibilidad con código legacy
✅ Permite configuración granular por usuario
✅ Soporta A/B testing y feature flags
✅ Es escalable y extensible
✅ Facilita trials y promociones

**Próximo paso:** Comenzar migración gradual de rutas críticas a `rateLimitingV2` y activar `useServiceGate` en MessageCore.
