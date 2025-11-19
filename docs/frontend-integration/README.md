# Frontend → Backend Integration

Guía rápida de cómo el **frontend** consume el sistema de capacidades del backend.

## 🚀 Quick Start

### 1. Obtener Capacidades del Usuario

```javascript
// GET /me/capabilities
const response = await fetch('http://localhost:3000/me/capabilities', {
  headers: {
    'X-User-Id': 'current-user-id'
  }
});

const data = await response.json();
console.log(data.data.services);
// {
//   'rate-limiting': { enabled: true, limits: { rateLimit: 12 } },
//   'ai-assistant': { enabled: false },
//   'analytics': { enabled: false },
//   ...
// }
```

### 2. Verificar Servicio Específico

```javascript
// GET /me/services/ai-assistant
const response = await fetch('http://localhost:3000/me/services/ai-assistant', {
  headers: {
    'X-User-Id': 'current-user-id'
  }
});

const data = await response.json();
console.log(data.data.allowed); // true/false
```

### 3. Monitorear Uso

```javascript
// GET /me/usage
const response = await fetch('http://localhost:3000/me/usage', {
  headers: {
    'X-User-Id': 'current-user-id'
  }
});

const data = await response.json();
console.log(data.data.services);
// {
//   'rate-limiting': { used: 5, limit: 12 },
//   'ai-assistant': { used: 0, limit: 0 }
// }
```

## 📋 Endpoints Disponibles

### Públicos (usuario)

| Endpoint | Método | Headers | Descripción |
|----------|--------|---------|-------------|
| `/me/capabilities` | GET | X-User-Id | Ver todos los servicios habilitados |
| `/me/usage` | GET | X-User-Id | Ver uso actual de servicios |
| `/me/services/:serviceId` | GET | X-User-Id | Verificar servicio específico |
| `/me/services/:serviceId/config` | GET | X-User-Id | Obtener config de servicio |

### Admin (requiere permisos)

| Endpoint | Método | Headers | Body | Descripción |
|----------|--------|---------|------|-------------|
| `/admin/templates` | GET | - | - | Listar templates disponibles |
| `/admin/users/:userId/template/:name` | POST | - | - | Aplicar template a usuario |
| `/admin/users/:userId/services/:serviceId/enable` | POST | - | `{ enabled: true/false }` | Habilitar/deshabilitar servicio |
| `/admin/users/:userId/services/:serviceId/config` | PATCH | - | `{ limits: {...} }` | Actualizar config de servicio |

## 🎯 Casos de Uso

### 1. Feature Gating (mostrar/ocultar features)

```javascript
// Verificar si usuario puede usar AI
const check = await fetch('http://localhost:3000/me/services/ai-assistant', {
  headers: { 'X-User-Id': userId }
}).then(r => r.json());

if (check.data.allowed) {
  // Mostrar botón de AI
  document.getElementById('ai-button').style.display = 'block';
} else {
  // Ocultar o mostrar upgrade CTA
  document.getElementById('ai-button').style.display = 'none';
}
```

### 2. Progress Bar de Uso

```javascript
// Obtener uso de rate limiting
const usage = await fetch('http://localhost:3000/me/usage', {
  headers: { 'X-User-Id': userId }
}).then(r => r.json());

const rateLimitUsage = usage.data.services['rate-limiting'];
const percentage = (rateLimitUsage.used / rateLimitUsage.limit) * 100;

// Mostrar progress bar
document.getElementById('progress-bar').style.width = `${percentage}%`;
document.getElementById('progress-text').textContent =
  `${rateLimitUsage.used} / ${rateLimitUsage.limit} messages`;
```

### 3. Mostrar Plan del Usuario

```javascript
// Obtener todas las capacidades
const caps = await fetch('http://localhost:3000/me/capabilities', {
  headers: { 'X-User-Id': userId }
}).then(r => r.json());

// Determinar plan aproximado
const hasAI = caps.data.services['ai-assistant']?.enabled;
const rateLimit = caps.data.services['rate-limiting']?.limits?.rateLimit;

let plan = 'Starter';
if (hasAI && rateLimit >= 30) plan = 'Professional';
if (rateLimit >= 100) plan = 'Enterprise';

document.getElementById('plan-name').textContent = plan;
```

## 📦 Recursos

- **[API Contract completo](../../api-contract.json)** - Especificación completa de endpoints
- **[Guía detallada de integración](./capabilities-api.md)** - Ejemplos con React, Vue, vanilla JS
- **[Demo HTML](../../examples/frontend-capabilities-demo.html)** - Ejemplo funcional
- **[Migración de Planes](../migration/plan-to-capabilities.md)** - Cómo migrar de planes a capacidades

## 🧪 Testing

```bash
# 1. Iniciar servidor backend
cd apps/api-gateway
bun dev

# 2. Probar endpoints
curl -H "X-User-Id: test-user" http://localhost:3000/me/capabilities
curl -H "X-User-Id: test-user" http://localhost:3000/me/usage
curl -H "X-User-Id: test-user" http://localhost:3000/me/services/ai-assistant

# 3. Abrir demo HTML
open examples/frontend-capabilities-demo.html
# → Abre el demo en el navegador
```

## 💡 Tips

**1. Cachear capabilities**
```javascript
// Cachear en localStorage para evitar múltiples fetches
const cached = localStorage.getItem('capabilities');
if (cached && Date.now() - JSON.parse(cached).timestamp < 60000) {
  return JSON.parse(cached).data;
}
```

**2. Auto-refrescar uso**
```javascript
// Actualizar cada 10 segundos
setInterval(async () => {
  const usage = await fetchUsage();
  updateUI(usage);
}, 10000);
```

**3. Manejar rate limit exceeded**
```javascript
try {
  await sendMessage();
} catch (error) {
  if (error.status === 429) {
    const retryAfter = error.headers.get('Retry-After');
    alert(`Rate limit exceeded. Try again in ${retryAfter} seconds`);
  }
}
```

## 🔐 Autenticación (futuro)

Actualmente usamos header `X-User-Id` simple. En producción:

```javascript
// Usar Bearer token en lugar de X-User-Id
const response = await fetch('http://localhost:3000/me/capabilities', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

El backend extraerá el userId del token JWT.
