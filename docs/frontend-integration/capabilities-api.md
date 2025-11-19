# Frontend Integration: Capabilities API

Esta guía muestra cómo el **frontend** consume el nuevo sistema de capacidades para mostrar features disponibles, límites, uso, etc.

## 🎯 Endpoints Disponibles

### Usuario (endpoints públicos)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/me/capabilities` | GET | Ver todos los servicios habilitados |
| `/me/usage` | GET | Ver uso actual de servicios |
| `/me/services/:serviceId` | GET | Verificar servicio específico |
| `/me/services/:serviceId/config` | GET | Obtener config de servicio |

### Admin (requiere permisos)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/admin/templates` | GET | Listar templates disponibles |
| `/admin/users/:userId/capabilities` | POST | Actualizar capacidades |
| `/admin/users/:userId/template/:name` | POST | Aplicar template |
| `/admin/users/:userId/services/:serviceId/enable` | POST | Habilitar/deshabilitar |

## 📖 Guías por Framework

### React / Next.js

```typescript
// hooks/useCapabilities.ts
import { useState, useEffect } from 'react';

interface UserCapabilities {
  userId: string;
  services: Record<string, ServiceConfig>;
  globalLimits: {
    maxConcurrentRequests: number;
    maxStorageBytes: number;
    maxTeamMembers: number;
  };
}

export function useCapabilities() {
  const [capabilities, setCapabilities] = useState<UserCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCapabilities() {
      try {
        const userId = localStorage.getItem('userId') || 'anonymous';

        const response = await fetch('http://localhost:3000/me/capabilities', {
          headers: {
            'X-User-Id': userId
          }
        });

        const data = await response.json();

        if (data.success) {
          setCapabilities(data.data);
        } else {
          setError(data.error.message);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchCapabilities();
  }, []);

  return { capabilities, loading, error };
}

// Componente que usa el hook
export function CapabilitiesWidget() {
  const { capabilities, loading, error } = useCapabilities();

  if (loading) return <div>Loading capabilities...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!capabilities) return null;

  const hasAI = capabilities.services['ai-assistant']?.enabled;
  const hasAnalytics = capabilities.services['analytics']?.enabled;
  const rateLimit = capabilities.services['rate-limiting']?.limits?.rateLimit || 0;

  return (
    <div className="capabilities-widget">
      <h3>Your Plan</h3>

      <div className="feature">
        <span>AI Assistant:</span>
        <span className={hasAI ? 'enabled' : 'disabled'}>
          {hasAI ? '✓ Enabled' : '✗ Disabled'}
        </span>
      </div>

      <div className="feature">
        <span>Analytics:</span>
        <span className={hasAnalytics ? 'enabled' : 'disabled'}>
          {hasAnalytics ? '✓ Enabled' : '✗ Disabled'}
        </span>
      </div>

      <div className="feature">
        <span>Rate Limit:</span>
        <span>{rateLimit} messages/min</span>
      </div>

      {!hasAI && (
        <button onClick={() => window.location.href = '/upgrade'}>
          Upgrade to unlock AI
        </button>
      )}
    </div>
  );
}
```

### Hook para verificar servicio específico

```typescript
// hooks/useServiceCheck.ts
import { useState, useEffect } from 'react';

export function useServiceCheck(serviceId: string) {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState<string | undefined>();

  useEffect(() => {
    async function checkService() {
      try {
        const userId = localStorage.getItem('userId') || 'anonymous';

        const response = await fetch(
          `http://localhost:3000/me/services/${serviceId}`,
          {
            headers: { 'X-User-Id': userId }
          }
        );

        const data = await response.json();

        if (data.success) {
          setAllowed(data.data.allowed);
          setReason(data.data.reason);
        }
      } catch (err) {
        console.error('Service check failed:', err);
        setAllowed(false);
      } finally {
        setLoading(false);
      }
    }

    checkService();
  }, [serviceId]);

  return { allowed, loading, reason };
}

// Uso en componente
export function AIFeature() {
  const { allowed, loading, reason } = useServiceCheck('ai-assistant');

  if (loading) return <div>Checking AI availability...</div>;

  if (!allowed) {
    return (
      <div className="feature-locked">
        <p>AI Assistant is not available</p>
        <p className="reason">{reason}</p>
        <button onClick={() => window.location.href = '/upgrade'}>
          Upgrade Plan
        </button>
      </div>
    );
  }

  return <AIAssistantComponent />;
}
```

### Hook para monitorear uso (rate limiting)

```typescript
// hooks/useUsageMonitor.ts
import { useState, useEffect } from 'react';

export function useUsageMonitor() {
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    async function fetchUsage() {
      const userId = localStorage.getItem('userId') || 'anonymous';

      const response = await fetch('http://localhost:3000/me/usage', {
        headers: { 'X-User-Id': userId }
      });

      const data = await response.json();
      if (data.success) {
        setUsage(data.data);
      }
    }

    // Fetch inicial
    fetchUsage();

    // Actualizar cada 10 segundos
    const interval = setInterval(fetchUsage, 10000);

    return () => clearInterval(interval);
  }, []);

  return usage;
}

// Componente de barra de progreso
export function RateLimitBar() {
  const usage = useUsageMonitor();

  if (!usage) return null;

  const rateLimitUsage = usage.services['rate-limiting'];
  if (!rateLimitUsage) return null;

  const { used, limit } = rateLimitUsage;
  const percentage = (used / limit) * 100;
  const remaining = limit - used;

  return (
    <div className="rate-limit-bar">
      <div className="label">
        Messages: {used} / {limit}
      </div>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: percentage > 80 ? 'red' : 'green'
          }}
        />
      </div>
      <div className="remaining">
        {remaining} messages remaining
      </div>
    </div>
  );
}
```

### Vue 3 / Composition API

```typescript
// composables/useCapabilities.ts
import { ref, onMounted } from 'vue';

export function useCapabilities() {
  const capabilities = ref(null);
  const loading = ref(true);
  const error = ref(null);

  async function fetchCapabilities() {
    try {
      const userId = localStorage.getItem('userId') || 'anonymous';

      const response = await fetch('http://localhost:3000/me/capabilities', {
        headers: {
          'X-User-Id': userId
        }
      });

      const data = await response.json();

      if (data.success) {
        capabilities.value = data.data;
      } else {
        error.value = data.error.message;
      }
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  onMounted(fetchCapabilities);

  return { capabilities, loading, error };
}

// Componente Vue
<template>
  <div v-if="!loading" class="capabilities">
    <h3>Your Plan</h3>

    <div class="feature">
      <span>AI Assistant:</span>
      <span :class="hasAI ? 'enabled' : 'disabled'">
        {{ hasAI ? '✓ Enabled' : '✗ Disabled' }}
      </span>
    </div>

    <div class="feature">
      <span>Rate Limit:</span>
      <span>{{ rateLimit }} messages/min</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCapabilities } from '@/composables/useCapabilities';

const { capabilities, loading, error } = useCapabilities();

const hasAI = computed(() =>
  capabilities.value?.services['ai-assistant']?.enabled
);

const rateLimit = computed(() =>
  capabilities.value?.services['rate-limiting']?.limits?.rateLimit || 0
);
</script>
```

### Vanilla JavaScript

```javascript
// capabilities.js
class CapabilitiesAPI {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.userId = localStorage.getItem('userId') || 'anonymous';
  }

  async getCapabilities() {
    const response = await fetch(`${this.baseURL}/me/capabilities`, {
      headers: {
        'X-User-Id': this.userId
      }
    });

    const data = await response.json();
    return data.success ? data.data : null;
  }

  async getUsage() {
    const response = await fetch(`${this.baseURL}/me/usage`, {
      headers: {
        'X-User-Id': this.userId
      }
    });

    const data = await response.json();
    return data.success ? data.data : null;
  }

  async checkService(serviceId) {
    const response = await fetch(
      `${this.baseURL}/me/services/${serviceId}`,
      {
        headers: {
          'X-User-Id': this.userId
        }
      }
    );

    const data = await response.json();
    return data.success ? data.data : null;
  }
}

// Uso
const api = new CapabilitiesAPI();

// Al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
  const capabilities = await api.getCapabilities();

  // Mostrar/ocultar features según capacidades
  const aiButton = document.getElementById('ai-button');
  if (capabilities.services['ai-assistant']?.enabled) {
    aiButton.style.display = 'block';
  } else {
    aiButton.style.display = 'none';
  }

  // Mostrar rate limit
  const rateLimit = capabilities.services['rate-limiting']?.limits?.rateLimit;
  document.getElementById('rate-limit').textContent =
    `${rateLimit} messages/min`;
});

// Verificar servicio antes de usar feature
async function useAI() {
  const check = await api.checkService('ai-assistant');

  if (!check.allowed) {
    alert(`AI not available: ${check.reason}`);
    return;
  }

  // Proceder con funcionalidad AI
  console.log('AI available!');
}
```

## 🎨 UI/UX Patterns

### 1. Feature Gating (bloquear features)

```typescript
// Mostrar/ocultar botón de AI según capacidades
function AIButton() {
  const { allowed } = useServiceCheck('ai-assistant');

  if (!allowed) return null; // Ocultar completamente

  return <button onClick={handleAI}>Ask AI</button>;
}

// O mostrar bloqueado con upgrade CTA
function AIButtonLocked() {
  const { allowed, reason } = useServiceCheck('ai-assistant');

  return (
    <button
      onClick={allowed ? handleAI : handleUpgrade}
      disabled={!allowed}
    >
      {allowed ? 'Ask AI' : '🔒 Upgrade for AI'}
    </button>
  );
}
```

### 2. Usage Progress Bar

```typescript
function UsageBar({ serviceId }: { serviceId: string }) {
  const usage = useUsageMonitor();
  const serviceUsage = usage?.services[serviceId];

  if (!serviceUsage || !serviceUsage.limit) return null;

  const percentage = (serviceUsage.used / serviceUsage.limit) * 100;

  return (
    <div className="usage-bar">
      <div className="bar" style={{ width: `${percentage}%` }} />
      <span>{serviceUsage.used} / {serviceUsage.limit}</span>
    </div>
  );
}
```

### 3. Trial Badge

```typescript
function TrialBadge({ serviceId }: { serviceId: string }) {
  const { capabilities } = useCapabilities();
  const config = capabilities?.services[serviceId];

  if (!config?.metadata?.trial) return null;

  const expiresAt = new Date(config.metadata.expiresAt);
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="trial-badge">
      Trial: {daysLeft} days left
    </div>
  );
}
```

## 🔄 Real-time Updates via WebSocket

El frontend también puede recibir actualizaciones en tiempo real cuando cambian las capacidades:

```typescript
// Conectar WebSocket
const ws = new WebSocket('ws://localhost:3000/realtime');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  // Escuchar eventos de cambio de capacidades
  if (message.type === 'capabilities:updated') {
    // Re-fetch capabilities
    fetchCapabilities();

    // Mostrar notificación
    toast.success('Your plan has been updated!');
  }
};
```

## 📋 Checklist de Integración

- [ ] Crear hook/composable para `useCapabilities()`
- [ ] Crear hook para `useServiceCheck(serviceId)`
- [ ] Crear componente de visualización de plan/capacidades
- [ ] Implementar feature gating (ocultar features no disponibles)
- [ ] Agregar progress bars para uso de servicios
- [ ] Mostrar badges de trial/promo
- [ ] Agregar CTAs de upgrade cuando feature está bloqueada
- [ ] Manejar errores 429 (rate limit exceeded)
- [ ] Cachear capacidades en localStorage (opcional)
- [ ] Agregar loading states durante fetch

## 🚀 Testing

```bash
# Obtener capacidades
curl -H "X-User-Id: test-user" http://localhost:3000/me/capabilities

# Obtener uso
curl -H "X-User-Id: test-user" http://localhost:3000/me/usage

# Verificar servicio
curl -H "X-User-Id: test-user" http://localhost:3000/me/services/ai-assistant
```

## 📚 Más Recursos

- [API Contract completo](../../api-contract.json)
- [Migración de Planes a Capacidades](../migration/plan-to-capabilities.md)
- [Ejemplo de uso completo](../../examples/service-gate-usage.ts)
