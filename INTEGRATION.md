# 🔗 INHOST - Guía de Integración Frontend ↔ Backend

## 📋 Problema que Resuelve este Documento

**Tu chat (frontend) necesita saber:**
1. ¿En qué URL está el backend?
2. ¿Qué endpoints existen?
3. ¿Qué headers enviar?
4. ¿Cómo autenticarse?
5. ¿Cómo conectarse al WebSocket?

Este documento responde TODO eso.

---

## 🌐 Configuración de URLs

### Desarrollo Local

```typescript
// frontend/src/config/api.ts
export const API_CONFIG = {
  // HTTP REST API
  baseURL: 'http://localhost:3000',

  // WebSocket
  wsURL: 'ws://localhost:3000',

  // Timeout
  timeout: 30000, // 30 segundos

  // Retry
  retryAttempts: 3,
  retryDelay: 1000 // 1 segundo
};
```

### Producción

```typescript
// frontend/src/config/api.ts
export const API_CONFIG = {
  // Variables de entorno del frontend
  baseURL: import.meta.env.VITE_API_URL || 'https://api.inhost.com',
  wsURL: import.meta.env.VITE_WS_URL || 'wss://api.inhost.com',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
};
```

### Variables de Entorno

**Frontend necesita:**
```bash
# .env (desarrollo)
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000

# .env.production
VITE_API_URL=https://api.inhost.com
VITE_WS_URL=wss://api.inhost.com
```

**Backend necesita:**
```bash
# apps/api-gateway/.env
PORT=3000
NODE_ENV=development

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=inhost_user
DB_PASSWORD=inhost_password
DB_NAME=inhost

# Redis (opcional)
REDIS_HOST=localhost
REDIS_PORT=6379

# Features
ENABLE_WEBSOCKET=true
ENABLE_CORS=true
```

---

## 📡 Endpoints Disponibles

### 1. Health Check

```typescript
// GET /health
const response = await fetch(`${API_CONFIG.baseURL}/health`);
// Response: { success: true, data: { status: "healthy", ... } }
```

### 2. Enviar Mensaje

```typescript
// POST /simulate/client-message
const response = await fetch(`${API_CONFIG.baseURL}/simulate/client-message`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-Id': currentUserId // Requerido para rate limiting
  },
  body: JSON.stringify({
    clientId: 'web', // Siempre 'web' para chat web
    text: 'Hola, necesito ayuda'
  })
});

// Response:
// {
//   success: true,
//   data: {
//     clientMessage: { id, type, channel, text, persisted: true },
//     extensionResponses: [...],
//     summary: { ... }
//   }
// }
```

### 3. Listar Mensajes

```typescript
// GET /messages?limit=20
const response = await fetch(
  `${API_CONFIG.baseURL}/messages?limit=20`,
  {
    headers: {
      'X-User-Id': currentUserId
    }
  }
);

// Response:
// {
//   success: true,
//   data: {
//     count: 20,
//     messages: [...],
//     storage: 'postgresql'
//   }
// }
```

### 4. Estado de Simulación

```typescript
// GET /simulate/status
const response = await fetch(`${API_CONFIG.baseURL}/simulate/status`);

// Response: Estado de extensiones y clientes conectados
```

### 5. Activar/Desactivar Extensión

```typescript
// POST /simulate/extension-toggle
const response = await fetch(
  `${API_CONFIG.baseURL}/simulate/extension-toggle`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      extensionId: 'ai' // 'echo' | 'ai' | 'crm'
    })
  }
);
```

---

## 🔌 WebSocket - Notificaciones en Tiempo Real

### Conexión

```typescript
// frontend/src/services/websocket.ts
class WebSocketService {
  private ws: WebSocket | null = null;

  connect() {
    this.ws = new WebSocket(`${API_CONFIG.wsURL}/realtime`);

    this.ws.onopen = () => {
      console.log('✅ WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('🔌 WebSocket closed, reconnecting...');
      setTimeout(() => this.connect(), 2000); // Reconexión automática
    };
  }

  handleMessage(message: any) {
    switch (message.type) {
      case 'connection':
        // Conectado - guardar clientId
        localStorage.setItem('wsClientId', message.clientId);
        break;

      case 'message:new':
        // Nuevo mensaje (incoming o outgoing)
        const envelope = message.data;
        if (envelope.type === 'incoming') {
          // Mensaje del usuario
          this.onUserMessage(envelope);
        } else if (envelope.type === 'outgoing') {
          // Respuesta de bot
          this.onBotMessage(envelope);
        }
        break;

      case 'message:status':
        // Cambio de estado (received → sent → delivered → read)
        this.onMessageStatusChange(message.data);
        break;

      case 'typing:indicator':
        // Bot está escribiendo
        this.onTypingIndicator(message.data);
        break;

      case 'error':
        // Error del servidor (rate limit, validación, etc.)
        this.onError(message);
        break;
    }
  }

  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect() {
    this.ws?.close();
  }
}

// Singleton
export const wsService = new WebSocketService();
```

### Uso en el Chat

```typescript
// frontend/src/App.tsx o main.tsx
import { wsService } from './services/websocket';

// Al iniciar la app
useEffect(() => {
  wsService.connect();

  return () => {
    wsService.disconnect();
  };
}, []);
```

---

## 🔐 Headers Requeridos

### Para HTTP Requests

```typescript
const headers = {
  'Content-Type': 'application/json',
  'X-User-Id': getCurrentUserId(), // REQUERIDO para rate limiting
  // 'Authorization': `Bearer ${token}`, // Futuro: JWT auth
};
```

### Rate Limiting

El backend usa `X-User-Id` para aplicar rate limits:
- **Free plan**: 12 mensajes/minuto
- **Premium plan**: 30 mensajes/minuto

Si excedes el límite, recibes:
```typescript
{
  success: false,
  error: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Rate limit exceeded',
    details: { retryAfter: 60 },
    timestamp: '...'
  }
}

// Headers de respuesta:
// X-RateLimit-Limit: 12
// X-RateLimit-Remaining: 0
// X-RateLimit-Reset: 1700308800
// Retry-After: 60
```

**Acción recomendada:**
- Mostrar mensaje: "Demasiados mensajes, espera {retryAfter} segundos"
- Deshabilitar input temporalmente
- Mostrar countdown

---

## 🚀 Client HTTP - Implementación Recomendada

```typescript
// frontend/src/api/client.ts
import { API_CONFIG } from '../config/api';

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = API_CONFIG.baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': this.getUserId(),
        ...options.headers
      }
    });

    // Manejar rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new RateLimitError(
        'Rate limit exceeded',
        parseInt(retryAfter || '60', 10)
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new ApiError(data.error.code, data.error.message);
    }

    return data.data as T;
  }

  private getUserId(): string {
    // Obtener del storage, contexto, etc.
    return localStorage.getItem('userId') || 'anonymous';
  }

  // Métodos específicos
  async sendMessage(text: string) {
    return this.request('/simulate/client-message', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'web',
        text
      })
    });
  }

  async getMessages(limit: number = 20) {
    return this.request(`/messages?limit=${limit}`);
  }

  async toggleExtension(extensionId: string) {
    return this.request('/simulate/extension-toggle', {
      method: 'POST',
      body: JSON.stringify({ extensionId })
    });
  }

  async getSimulationStatus() {
    return this.request('/simulate/status');
  }

  async healthCheck() {
    return this.request('/health');
  }
}

// Errors personalizados
class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

class RateLimitError extends Error {
  constructor(message: string, public retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// Singleton
export const apiClient = new ApiClient();
```

---

## 🔄 Flujo Completo de Integración

### 1. Al Iniciar la App

```typescript
// frontend/src/App.tsx
useEffect(() => {
  // 1. Conectar WebSocket
  wsService.connect();

  // 2. Health check
  apiClient.healthCheck()
    .then(() => console.log('Backend is healthy'))
    .catch(() => console.error('Backend is down'));

  // 3. Cargar mensajes iniciales
  apiClient.getMessages(50)
    .then(messages => setMessages(messages))
    .catch(err => console.error('Failed to load messages', err));

  return () => {
    wsService.disconnect();
  };
}, []);
```

### 2. Al Enviar Mensaje

```typescript
// frontend/src/components/ChatInput.tsx
async function handleSendMessage(text: string) {
  // 1. Mostrar mensaje inmediatamente (optimistic UI)
  const tempId = `temp-${Date.now()}`;
  addMessage({
    id: tempId,
    type: 'incoming',
    text,
    status: 'sending',
    timestamp: new Date().toISOString()
  });

  try {
    // 2. Enviar al backend
    const response = await apiClient.sendMessage(text);

    // 3. Actualizar con ID real del servidor
    updateMessage(tempId, {
      id: response.clientMessage.id,
      status: 'received'
    });

    // 4. WebSocket enviará las respuestas de bots automáticamente

  } catch (error) {
    if (error instanceof RateLimitError) {
      // Mostrar error de rate limit
      showError(`Demasiados mensajes. Espera ${error.retryAfter}s`);
      updateMessage(tempId, { status: 'failed' });
    } else {
      // Error genérico
      showError('No se pudo enviar el mensaje');
      updateMessage(tempId, { status: 'failed' });
    }
  }
}
```

### 3. Al Recibir Notificación WebSocket

```typescript
// El wsService.handleMessage ya maneja esto
wsService.onBotMessage = (envelope) => {
  // Agregar mensaje del bot a la UI
  addMessage({
    id: envelope.id,
    type: 'outgoing',
    from: envelope.metadata.extensionId, // 'echo', 'ai', 'crm'
    text: envelope.content.text,
    status: envelope.statusChain[0].status,
    timestamp: envelope.metadata.timestamp
  });
};

wsService.onMessageStatusChange = (statusUpdate) => {
  // Actualizar checkmarks (✓, ✓✓, ✓✓ azul)
  updateMessageStatus(
    statusUpdate.messageId,
    statusUpdate.status
  );
};
```

---

## 🐛 Detección de Problemas

### Backend No Disponible

```typescript
// Hacer health check periódico
setInterval(async () => {
  try {
    await apiClient.healthCheck();
    setBackendStatus('online');
  } catch (error) {
    setBackendStatus('offline');
    showWarning('Backend desconectado. Reconectando...');
  }
}, 30000); // Cada 30 segundos
```

### WebSocket Desconectado

```typescript
// El wsService ya maneja reconexión automática
// Pero puedes mostrar banner:
wsService.ws.onclose = () => {
  showBanner('Conexión perdida. Reconectando...', 'warning');
  setTimeout(() => wsService.connect(), 2000);
};

wsService.ws.onopen = () => {
  hideBanner();
  showToast('Reconectado exitosamente', 'success');
};
```

### CORS Errors

Si ves en consola:
```
Access to fetch at 'http://localhost:3000/messages' from origin 'http://localhost:5173'
has been blocked by CORS policy
```

**Solución:**
1. Verificar que el backend esté corriendo
2. Verificar `ENABLE_CORS=true` en backend .env
3. En desarrollo, el backend acepta CUALQUIER origen

---

## 📦 Estructura de Archivos Frontend

```
frontend/
├── src/
│   ├── config/
│   │   └── api.ts              # ← Configuración de URLs
│   ├── api/
│   │   └── client.ts           # ← HTTP client (fetch wrapper)
│   ├── services/
│   │   └── websocket.ts        # ← WebSocket service
│   ├── types/
│   │   └── message.ts          # ← Tipos (MessageEnvelope, etc.)
│   └── components/
│       ├── Chat.tsx
│       ├── ChatInput.tsx
│       └── MessageList.tsx
├── .env                         # ← Variables locales
├── .env.production              # ← Variables producción
└── package.json
```

---

## ✅ Checklist de Integración

### Backend
- [ ] Servidor corriendo en puerto 3000
- [ ] PostgreSQL corriendo
- [ ] CORS habilitado (`ENABLE_CORS=true`)
- [ ] WebSocket habilitado (`ENABLE_WEBSOCKET=true`)
- [ ] Health check responde: `GET /health`

### Frontend
- [ ] Variable `VITE_API_URL` configurada
- [ ] Variable `VITE_WS_URL` configurada
- [ ] ApiClient implementado
- [ ] WebSocketService implementado
- [ ] Headers `X-User-Id` enviándose en requests
- [ ] Manejo de rate limiting
- [ ] Manejo de errores de red
- [ ] Reconexión automática de WebSocket

### Testing
- [ ] `bun test:whatsapp` pasa exitosamente
- [ ] Frontend puede enviar mensaje
- [ ] Frontend recibe respuestas de bots
- [ ] Checkmarks de estado funcionan
- [ ] Rate limiting funciona (probar 15 mensajes rápidos)

---

## 🚢 Despliegue

### Backend (Producción)

```bash
# Variables de entorno requeridas
PORT=3000
NODE_ENV=production

DB_HOST=your-db-host.com
DB_PORT=5432
DB_USER=prod_user
DB_PASSWORD=strong_password
DB_NAME=inhost_prod

JWT_SECRET=your-super-secret-jwt-key-change-this

ENABLE_CORS=true
ENABLE_WEBSOCKET=true
ENABLE_RATE_LIMITING=true
```

### Frontend (Producción)

```bash
# .env.production
VITE_API_URL=https://api.inhost.com
VITE_WS_URL=wss://api.inhost.com
```

### Nginx Reverse Proxy

Si usas Nginx para servir el frontend y backend:

```nginx
# /etc/nginx/sites-available/inhost
upstream backend {
  server localhost:3000;
}

server {
  listen 80;
  server_name app.inhost.com;

  # Frontend (React/Vue build)
  location / {
    root /var/www/frontend/dist;
    try_files $uri /index.html;
  }

  # Backend API
  location /api {
    proxy_pass http://backend;
    proxy_http_version 1.1;

    # CORS (si no está en el backend)
    add_header 'Access-Control-Allow-Origin' '*';
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
  }

  # WebSocket
  location /realtime {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
  }
}
```

---

## 📞 Soporte

Si algo no funciona:

1. **Verificar logs del backend:**
   ```bash
   bun --cwd apps/api-gateway dev
   # Buscar errores en consola
   ```

2. **Verificar network tab en DevTools:**
   - ¿Las requests llegan al backend?
   - ¿Qué status code devuelven?
   - ¿Hay errores CORS?

3. **Ejecutar test de integración:**
   ```bash
   bun test:whatsapp
   ```

4. **Verificar variables de entorno:**
   ```bash
   # Frontend
   echo $VITE_API_URL

   # Backend
   cd apps/api-gateway && cat .env
   ```

---

## 📚 Recursos

- **Guía de Testing:** `scripts/README-TESTING.md`
- **Guía de Chat:** `docs/guides/chat-integration.md`
- **Contrato API:** Devolver a este documento (INTEGRATION.md)
- **MessageEnvelope Schema:** `packages/shared/src/types/message-envelope.ts`

---

**Versión:** 1.0
**Fecha:** 2025-11-18
**Autor:** Claude Code
