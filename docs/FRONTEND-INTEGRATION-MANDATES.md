# FRONTEND INTEGRATION MANDATES - INHOST

**Versión:** 1.0.0
**Fecha:** 2025-11-19
**Estado:** Production-Ready
**Audiencia:** Equipos Frontend, Product Owners, Arquitectos

---

## 📋 TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Auditoría del Sistema Actual](#auditoría-del-sistema-actual)
3. [Mandatos de Integración](#mandatos-de-integración)
4. [Flujos de Mensajes](#flujos-de-mensajes)
5. [Sistema de Notificaciones en Tiempo Real](#sistema-de-notificaciones-en-tiempo-real)
6. [Protecciones y Seguridad](#protecciones-y-seguridad)
7. [Persistencia y Estado](#persistencia-y-estado)
8. [Casos de Uso Completos](#casos-de-uso-completos)
9. [Ejemplos de Código](#ejemplos-de-código)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 RESUMEN EJECUTIVO

**INHOST** es un API Gateway multi-canal de mensajería construido sobre arquitectura modular basada en interfaces. Este documento establece los **mandatos obligatorios** para integración frontend, asegurando:

- ✅ Comunicación bidireccional (HTTP + WebSocket)
- ✅ Tiempo real con protecciones (rate limiting, validación, timeout)
- ✅ Persistencia garantizada (PostgreSQL)
- ✅ Escalabilidad (interface-based architecture)
- ✅ Seguridad (validación de tamaños, sanitización, rate limits)

### Stack Tecnológico Backend
- **Runtime:** Bun
- **Framework:** Elysia.js
- **Base de Datos:** PostgreSQL (vía Prisma)
- **WebSocket:** Integrado en Elysia
- **Validación:** TypeBox

### Requisitos Mínimos Frontend
- Soporte HTTP/REST
- Soporte WebSocket (ws:// / wss://)
- Manejo de JSON
- Gestión de estado reactivo
- Manejo de errores HTTP (400, 429, 500)

---

## 🔍 AUDITORÍA DEL SISTEMA ACTUAL

### 1. Frontend Actual (Testing Dashboard)

**Ubicación:** `/testing/`

**Estado:** ✅ Funcional como demo, ⚠️ No production-ready

#### 1.1 Estructura Actual
```
testing/
├── index.html                          # Dashboard principal
├── tests/
│   ├── test-chat-flow-improved.html   # ✅ Chat flow demo (MEJOR)
│   ├── test-chat-flow.html            # Chat básico
│   ├── test-interface.html            # Interface demo
│   └── test-sprint2-protection.html   # Tests de protección
├── assets/
│   ├── js/components.js               # ✅ Sistema de componentes reutilizables
│   └── css/shared.css                 # Estilos compartidos
└── server.js                          # ✅ HTTP server (REQUERIDO)
```

#### 1.2 Características del Frontend Actual

**FORTALEZAS:**
- ✅ Sistema de componentes atómicos (Atoms, Molecules, Organisms)
- ✅ Manejo de WebSocket con auto-reconexión
- ✅ Event logging estructurado
- ✅ Estado reactivo básico (StateManager)
- ✅ Sanitización XSS (Utils.escape)
- ✅ UI responsive (CSS Grid + Flexbox)
- ✅ Autoscroll inteligente
- ✅ Performance optimization (throttle, debounce, requestAnimationFrame)

**DEBILIDADES:**
- ⚠️ WebSocket hardcoded a `ws://localhost:8085` (debería usar contrato de API)
- ⚠️ No usa el contrato de API (`api-contract.json`)
- ⚠️ No maneja rate limiting de forma visible (headers no mostrados)
- ⚠️ No implementa persistencia de mensajes (localStorage)
- ⚠️ No implementa retry logic para requests fallidos
- ⚠️ Mock de clientes y extensiones (no conecta con backend real)
- ⚠️ No implementa autenticación (X-User-Id hardcoded)

**CÓDIGO CRÍTICO ENCONTRADO:**
```javascript
// test-chat-flow-improved.html:690
const CONFIG = {
    WS_URL: 'ws://localhost:8085',  // ❌ HARDCODED - debería venir del contrato
    MAX_LOG_ENTRIES: 100,
    MAX_MESSAGES: 50,
    AUTOSCROLL_THRESHOLD: 50,
    RECONNECT_DELAY: 3000
};
```

#### 1.3 Sistema de Componentes (components.js)

**EXCELENTE ARQUITECTURA** - Reusable y escalable:

```javascript
// Utilities
Utils.escape(text)           // Sanitización XSS
Utils.formatTime(date)       // Formateo de tiempo
Utils.uid()                  // Generación de IDs

// Atoms (componentes básicos)
Atoms.badge(text, type)
Atoms.button(text, options)
Atoms.input(options)
Atoms.progress(percent, type)
Atoms.stat(label, value)
Atoms.logLine(type, badge, message)

// Molecules (componentes compuestos)
Molecules.panel(title, content, options)
Molecules.cardMicro(title, options)
Molecules.emptyState(icon, message, submessage)

// Organisms (componentes complejos)
Organisms.header(title, stats)

// Managers
LogManager        // Gestión de logs con auto-scroll
StateManager      // Estado reactivo
DOMCache          // Optimización de acceso DOM
```

**RECOMENDACIÓN:** 🎯 **Mantener y expandir este sistema de componentes**

---

### 2. Backend (API Gateway)

**Ubicación:** `/apps/api-gateway/src/`

**Estado:** ✅ Production-Ready (Sprint 2 completado)

#### 2.1 Arquitectura Backend

```
apps/api-gateway/src/
├── core/
│   ├── MessageCore.ts              # ✅ Orquestador central
│   └── interfaces/                 # ✅ Contratos inmutables
│       ├── IAdapter.ts
│       ├── IRateLimiter.ts
│       ├── IPersistenceService.ts
│       ├── INotificationService.ts
│       ├── IMessageQueue.ts
│       ├── IValidator.ts
│       ├── IPlanResolver.ts
│       └── IOwnerChecker.ts
├── implementations/
│   ├── v1/                         # ✅ Implementaciones actuales
│   │   ├── MemoryRateLimiter.ts
│   │   ├── MemoryPersistence.ts
│   │   ├── WebSocketNotification.ts
│   │   ├── SimpleValidator.ts
│   │   └── ...
│   └── v2/                         # 🔄 Futuras implementaciones
│       └── RedisRateLimiter.ts
├── middleware/                     # ✅ Sprint 2 completado
│   ├── rateLimiting.ts            # Rate limiting HTTP + WS
│   ├── validation.ts              # Validación de schemas
│   ├── timeout.ts                 # Protección de timeout
│   ├── logger.ts                  # Logging estructurado
│   └── errorHandler.ts            # Manejo de errores
├── routes/
│   ├── messages.ts                # ✅ POST/GET /messages
│   ├── simulation.ts              # ✅ Simuladores
│   ├── websocket.ts               # ✅ WS /realtime (Sprint 3)
│   └── health.ts                  # ✅ GET /health
└── services/
    └── index.ts                   # ✅ Servicios inicializados
```

#### 2.2 MessageCore - El Orquestador

**RESPONSABILIDADES:**
1. ✅ Recibir mensajes (`receive()`)
2. ✅ Persistir inmediatamente (`IPersistenceService`)
3. ✅ Notificar en tiempo real (`INotificationService`)
4. ✅ Enviar mensajes (`send()`)
5. ✅ Delegar a adaptadores de canal

**FLUJO INTERNO:**
```
Frontend → POST /simulate/client-message
    ↓
MessageCore.receive(message)
    ↓
IPersistenceService.save() → PostgreSQL
    ↓
INotificationService.broadcast() → WebSocket broadcast (message:new)
    ↓
Extensions procesadas (simuladas)
    ↓
MessageCore.send(response) por cada extensión
    ↓
IAdapter.sendMessage() → Simulated adapter
    ↓
IPersistenceService.save() → PostgreSQL
    ↓
INotificationService.broadcast() → WebSocket broadcast (message:new)
```

#### 2.3 Middleware de Protección (Sprint 2)

**✅ IMPLEMENTADO Y FUNCIONANDO:**

| Middleware | Ubicación | Estado | Descripción |
|------------|-----------|--------|-------------|
| Rate Limiting | `rateLimiting.ts:48` | ✅ Activo | 12 req/min (free), 30 req/min (premium) |
| Validation | `validation.ts:42` | ✅ Activo | TypeBox schemas, sanitización |
| Timeout | `timeout.ts` | ✅ Activo | 30s timeout en `/messages` |
| Logger | `logger.ts` | ✅ Activo | Structured logging |
| Error Handler | `errorHandler.ts` | ✅ Activo | Formato JSON consistente |

**RATE LIMITING - DETALLES:**
```typescript
// middleware/rateLimiting.ts:45
export function rateLimiting(config: RateLimitConfig) {
  return new Elysia()
    .onRequest(async ({ request, set }) => {  // ✅ onRequest (NO derive/onBeforeHandle)
      const userId = config.getUserId(request) || 'anonymous';
      const plan = config.getPlan(userId);

      const result = await config.rateLimiter.checkLimit(userId, plan);

      // Headers SIEMPRE enviados
      set.headers['X-RateLimit-Limit'] = result.limit.toString();
      set.headers['X-RateLimit-Remaining'] = result.remaining.toString();
      set.headers['X-RateLimit-Reset'] = Math.floor(result.resetAt.getTime() / 1000).toString();

      if (!result.allowed) {
        set.status = 429;
        set.headers['Retry-After'] = (result.retryAfter || 60).toString();
        return { success: false, error: { ... } };
      }

      await config.rateLimiter.recordRequest(userId, plan);
    });
}
```

**CRITICAL:** ⚠️ Los headers de rate limiting (`X-RateLimit-*`) **SÍ se envían** pero pueden no ser visibles en algunas herramientas de testing. El frontend DEBE leerlos de `response.headers`.

---

### 3. Contrato de API (`api-contract.json`)

**Ubicación:** `/api-contract.json`

**Estado:** ✅ Completo y actualizado

**MANDATO:** 🎯 **El frontend DEBE importar y usar este contrato como fuente de verdad**

#### 3.1 Endpoints Disponibles

| Endpoint | Método | Descripción | Headers Requeridos |
|----------|--------|-------------|-------------------|
| `/health` | GET | Health check | - |
| `/simulate/client-message` | POST | Enviar mensaje de cliente | `Content-Type`, `X-User-Id` |
| `/messages` | GET | Listar últimos mensajes | `X-User-Id` |
| `/simulate/extension-toggle` | POST | Activar/desactivar extensión | `Content-Type` |
| `/simulate/status` | GET | Estado del sistema | - |
| `/realtime` | WS | WebSocket tiempo real | - |

#### 3.2 Formato de Mensajes (MessageEnvelopeV2)

```typescript
{
  id: string;              // UUID generado por backend
  type: 'incoming' | 'outgoing' | 'system' | 'status';
  channel: 'whatsapp' | 'telegram' | 'web' | 'sms';
  content: {
    text: string;          // Requerido
    contentType?: string;  // 'text' | 'image' | 'video' | 'file'
    mediaUrl?: string;     // URL del media (futuro)
  };
  metadata: {
    from: string;          // Origen del mensaje
    to: string;            // Destino del mensaje
    timestamp: string;     // ISO8601
    extensionId?: string;  // Si es respuesta de extensión
  };
  status?: {
    current: 'received' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
    history: StatusChange[];
  };
}
```

#### 3.3 WebSocket - Tipos de Mensajes

| Tipo | Dirección | Descripción |
|------|-----------|-------------|
| `connection` | Server → Client | Confirmación de conexión |
| `echo` | Server → Client | Echo de cada mensaje (desarrollo) |
| `message:new` | Server → Client | Nuevo mensaje persistido |
| `message:status` | Server → Client | Cambio de estado de mensaje |
| `typing:indicator` | Server → Client | Alguien está escribiendo |
| `message_processing` | Server → Client | Extensiones procesando (evento control) |
| `extension_response` | Server → Client | Extensión respondió (evento control) |
| `error` | Server → Client | Error (rate limit, validación, etc.) |

#### 3.4 Rate Limiting - Configuración

```json
{
  "free": {
    "messagesPerMinute": 12,
    "windowMs": 60000
  },
  "premium": {
    "messagesPerMinute": 30,
    "windowMs": 60000
  }
}
```

**Headers de Rate Limiting:**
- `X-RateLimit-Limit`: Límite máximo de requests
- `X-RateLimit-Remaining`: Requests restantes
- `X-RateLimit-Reset`: Unix timestamp de reset
- `Retry-After`: Segundos hasta reintentar (solo en 429)

---

## 🎯 MANDATOS DE INTEGRACIÓN

### MANDATO 1: Usar el Contrato de API como Fuente de Verdad

**OBLIGATORIO:**
```javascript
// ✅ CORRECTO
import apiContract from './api-contract.json';

const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? apiContract.baseURL.production
  : apiContract.baseURL.development;

const WS_URL = process.env.NODE_ENV === 'production'
  ? apiContract.websocketURL.production
  : apiContract.websocketURL.development;
```

**❌ INCORRECTO:**
```javascript
// ❌ Hardcodear URLs
const WS_URL = 'ws://localhost:8085';  // MAL
const API_BASE_URL = 'http://localhost:3000';  // MAL
```

---

### MANDATO 2: Implementar Headers Requeridos

**OBLIGATORIO:**

```javascript
// Headers SIEMPRE requeridos en POST/PUT/PATCH
const headers = {
  'Content-Type': 'application/json',
  'X-User-Id': getUserId()  // Obtener del auth context
};

// Opcional (futuro)
if (authToken) {
  headers['Authorization'] = `Bearer ${authToken}`;
}
```

**Función de utilidad:**
```javascript
function getUserId() {
  // Obtener del localStorage, auth context, o generar temporal
  let userId = localStorage.getItem('inhost-user-id');
  if (!userId) {
    userId = 'user-' + crypto.randomUUID().substring(0, 8);
    localStorage.setItem('inhost-user-id', userId);
  }
  return userId;
}
```

---

### MANDATO 3: Manejar Rate Limiting

**OBLIGATORIO:**

```javascript
async function sendMessage(data) {
  try {
    const response = await fetch(`${API_BASE_URL}/simulate/client-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': getUserId()
      },
      body: JSON.stringify(data)
    });

    // 1. Leer headers de rate limiting
    const rateLimitLimit = response.headers.get('X-RateLimit-Limit');
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    const rateLimitReset = response.headers.get('X-RateLimit-Reset');

    // 2. Actualizar UI con información de rate limit
    updateRateLimitUI({
      limit: parseInt(rateLimitLimit),
      remaining: parseInt(rateLimitRemaining),
      resetAt: new Date(parseInt(rateLimitReset) * 1000)
    });

    // 3. Manejar 429 (Rate Limit Exceeded)
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const errorData = await response.json();

      showRateLimitError({
        retryAfter: parseInt(retryAfter),
        resetAt: errorData.error.resetAt
      });

      // Desactivar envío de mensajes temporalmente
      disableSendButton(parseInt(retryAfter));

      return { success: false, rateLimited: true };
    }

    // 4. Procesar respuesta normal
    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

// UI Helper
function updateRateLimitUI({ limit, remaining, resetAt }) {
  const percentage = (remaining / limit) * 100;
  document.getElementById('rate-limit-bar').style.width = `${percentage}%`;
  document.getElementById('rate-limit-text').textContent =
    `${remaining}/${limit} requests remaining`;
}

function showRateLimitError({ retryAfter, resetAt }) {
  alert(`Rate limit exceeded. Please wait ${retryAfter} seconds.`);
  // O mostrar un toast/notification más elegante
}

function disableSendButton(seconds) {
  const btn = document.getElementById('send-btn');
  btn.disabled = true;
  btn.textContent = `Wait ${seconds}s`;

  const interval = setInterval(() => {
    seconds--;
    if (seconds <= 0) {
      btn.disabled = false;
      btn.textContent = 'Send';
      clearInterval(interval);
    } else {
      btn.textContent = `Wait ${seconds}s`;
    }
  }, 1000);
}
```

---

### MANDATO 4: Implementar WebSocket con Auto-Reconexión

**OBLIGATORIO:**

```javascript
class WebSocketManager {
  constructor(url, options = {}) {
    this.url = url;
    this.ws = null;
    this.reconnectDelay = options.reconnectDelay || 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.listeners = new Map();
    this.connected = false;
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('⚠️ WebSocket disconnected', event.code, event.reason);
        this.connected = false;
        this.emit('disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.emit('error', error);
      };

    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.attemptReconnect();
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      this.emit('reconnect-failed');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    console.log(`Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }

  handleMessage(data) {
    const { type } = data;

    // Eventos del sistema
    if (type === 'connection') {
      console.log('Connection confirmed:', data);
      this.emit('connection', data);
      return;
    }

    if (type === 'echo') {
      console.log('Echo received:', data);
      this.emit('echo', data);
      return;
    }

    if (type === 'error') {
      console.error('Server error:', data);
      this.emit('server-error', data);

      // Manejar rate limiting
      if (data.code === 'RATE_LIMIT_EXCEEDED') {
        this.emit('rate-limit', data);
      }
      return;
    }

    // Mensajes de negocio
    if (type === 'message:new') {
      this.emit('message', data.data);
      return;
    }

    if (type === 'message:status') {
      this.emit('message-status', data.data);
      return;
    }

    if (type === 'typing:indicator') {
      this.emit('typing', data.data);
      return;
    }

    // Eventos de control (simulación)
    if (type === 'message_processing') {
      this.emit('processing', data);
      return;
    }

    if (type === 'extension_response') {
      this.emit('extension-response', data);
      return;
    }

    // Tipo desconocido
    console.warn('Unknown message type:', type, data);
  }

  send(data) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}

// USO
const wsManager = new WebSocketManager(WS_URL, {
  reconnectDelay: 3000,
  maxReconnectAttempts: 10
});

// Escuchar eventos
wsManager.on('connected', () => {
  console.log('Connected to server');
  updateUIStatus('connected');
});

wsManager.on('message', (message) => {
  console.log('New message:', message);
  addMessageToUI(message);
});

wsManager.on('typing', (data) => {
  showTypingIndicator(data.userId, data.isTyping);
});

wsManager.on('rate-limit', (error) => {
  showRateLimitError(error.retryAfter);
});

// Conectar
wsManager.connect();

// Cleanup al cerrar la aplicación
window.addEventListener('beforeunload', () => {
  wsManager.disconnect();
});
```

---

### MANDATO 5: Validación y Sanitización de Input

**OBLIGATORIO:**

```javascript
// Sanitización XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Validación de mensaje antes de enviar
function validateMessage(text) {
  const errors = [];

  // Requerido
  if (!text || text.trim().length === 0) {
    errors.push('El mensaje no puede estar vacío');
  }

  // Longitud máxima (16KB por texto según contrato)
  if (text.length > 16384) {
    errors.push('El mensaje es demasiado largo (máximo 16KB)');
  }

  // Caracteres peligrosos (opcional)
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i  // onclick=, onerror=, etc.
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(text)) {
      errors.push('El mensaje contiene contenido no permitido');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Uso
function handleSendMessage() {
  const input = document.getElementById('message-input');
  const text = input.value;

  const validation = validateMessage(text);
  if (!validation.valid) {
    alert(validation.errors.join('\n'));
    return;
  }

  // Sanitizar antes de mostrar en UI
  const sanitizedText = escapeHtml(text);

  // Enviar al servidor
  sendMessage({
    clientId: 'web',
    text: text  // El servidor también sanitiza
  });

  // Limpiar input
  input.value = '';
}
```

---

### MANDATO 6: Persistencia Local y Sincronización

**OBLIGATORIO:**

```javascript
class MessageStore {
  constructor() {
    this.storageKey = 'inhost-messages';
    this.maxMessages = 100;
  }

  // Guardar mensaje localmente
  save(message) {
    const messages = this.getAll();
    messages.unshift(message);  // Más recientes primero

    // Limitar cantidad
    if (messages.length > this.maxMessages) {
      messages.splice(this.maxMessages);
    }

    localStorage.setItem(this.storageKey, JSON.stringify(messages));
  }

  // Obtener todos los mensajes
  getAll() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading messages from localStorage:', error);
      return [];
    }
  }

  // Limpiar mensajes antiguos
  clear() {
    localStorage.removeItem(this.storageKey);
  }

  // Sincronizar con servidor
  async syncWithServer() {
    try {
      const response = await fetch(`${API_BASE_URL}/messages?limit=50`, {
        headers: {
          'X-User-Id': getUserId()
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data.messages) {
        // Reemplazar mensajes locales con los del servidor
        localStorage.setItem(this.storageKey, JSON.stringify(result.data.messages));
        return result.data.messages;
      }
    } catch (error) {
      console.error('Error syncing messages:', error);
      // Retornar mensajes locales como fallback
      return this.getAll();
    }
  }
}

// USO
const messageStore = new MessageStore();

// Al recibir mensaje por WebSocket
wsManager.on('message', (message) => {
  messageStore.save(message);
  addMessageToUI(message);
});

// Al cargar la aplicación
async function initializeApp() {
  // Cargar mensajes locales primero (UI inmediata)
  const localMessages = messageStore.getAll();
  renderMessages(localMessages);

  // Sincronizar con servidor en background
  const serverMessages = await messageStore.syncWithServer();
  renderMessages(serverMessages);
}
```

---

### MANDATO 7: Manejo de Errores Completo

**OBLIGATORIO:**

```javascript
class APIError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.details = details;
  }
}

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': getUserId(),
        ...options.headers
      }
    });

    // Leer rate limiting headers
    const rateLimitInfo = {
      limit: response.headers.get('X-RateLimit-Limit'),
      remaining: response.headers.get('X-RateLimit-Remaining'),
      reset: response.headers.get('X-RateLimit-Reset')
    };

    updateRateLimitUI(rateLimitInfo);

    // Manejar errores HTTP
    if (!response.ok) {
      const errorData = await response.json();

      switch (response.status) {
        case 400:
          throw new APIError(
            errorData.error.code || 'VALIDATION_ERROR',
            errorData.error.message || 'Validación fallida',
            errorData.error.details
          );

        case 429:
          throw new APIError(
            'RATE_LIMIT_EXCEEDED',
            `Rate limit excedido. Espera ${errorData.error.retryAfter}s`,
            {
              retryAfter: errorData.error.retryAfter,
              resetAt: errorData.error.resetAt
            }
          );

        case 500:
          throw new APIError(
            'INTERNAL_ERROR',
            'Error interno del servidor',
            errorData.error
          );

        default:
          throw new APIError(
            'UNKNOWN_ERROR',
            `Error HTTP ${response.status}`,
            errorData
          );
      }
    }

    // Respuesta exitosa
    const result = await response.json();
    return result;

  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    // Error de red o timeout
    if (error.name === 'AbortError') {
      throw new APIError('TIMEOUT', 'La solicitud tardó demasiado');
    }

    if (error.message.includes('fetch')) {
      throw new APIError('NETWORK_ERROR', 'Error de conexión', { original: error });
    }

    // Error desconocido
    throw new APIError('UNKNOWN_ERROR', error.message, { original: error });
  }
}

// Uso con manejo de errores
async function sendMessageWithErrorHandling(data) {
  try {
    const result = await apiRequest('/simulate/client-message', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    console.log('✅ Message sent:', result);
    return result;

  } catch (error) {
    if (error instanceof APIError) {
      switch (error.code) {
        case 'RATE_LIMIT_EXCEEDED':
          showNotification('error', error.message);
          disableSendButton(error.details.retryAfter);
          break;

        case 'VALIDATION_ERROR':
          showNotification('error', `Error de validación: ${error.message}`);
          break;

        case 'NETWORK_ERROR':
          showNotification('error', 'Sin conexión. Reintentando...');
          // Implementar retry logic
          await retryWithBackoff(() => sendMessageWithErrorHandling(data));
          break;

        default:
          showNotification('error', `Error: ${error.message}`);
      }
    } else {
      console.error('Unexpected error:', error);
      showNotification('error', 'Error inesperado');
    }

    throw error;
  }
}

// Retry con exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

### MANDATO 8: Performance y Optimización

**OBLIGATORIO:**

```javascript
// 1. Debounce para inputs de búsqueda
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 2. Throttle para scroll events
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 3. Virtual scrolling para listas grandes
class VirtualScroller {
  constructor(container, itemHeight, renderItem) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.renderItem = renderItem;
    this.items = [];
    this.visibleStart = 0;
    this.visibleEnd = 0;

    this.container.addEventListener('scroll', throttle(() => {
      this.updateVisibleRange();
    }, 100));
  }

  setItems(items) {
    this.items = items;
    this.container.style.height = `${items.length * this.itemHeight}px`;
    this.updateVisibleRange();
  }

  updateVisibleRange() {
    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;

    this.visibleStart = Math.floor(scrollTop / this.itemHeight);
    this.visibleEnd = Math.ceil((scrollTop + containerHeight) / this.itemHeight);

    this.render();
  }

  render() {
    const fragment = document.createDocumentFragment();

    for (let i = this.visibleStart; i < this.visibleEnd && i < this.items.length; i++) {
      const element = this.renderItem(this.items[i], i);
      element.style.position = 'absolute';
      element.style.top = `${i * this.itemHeight}px`;
      fragment.appendChild(element);
    }

    this.container.innerHTML = '';
    this.container.appendChild(fragment);
  }
}

// 4. RequestAnimationFrame para animaciones
function smoothScrollToBottom(element) {
  const targetScroll = element.scrollHeight - element.clientHeight;
  const startScroll = element.scrollTop;
  const distance = targetScroll - startScroll;
  const duration = 300;
  let startTime = null;

  function animation(currentTime) {
    if (!startTime) startTime = currentTime;
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function
    const easeInOutQuad = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    element.scrollTop = startScroll + distance * easeInOutQuad;

    if (progress < 1) {
      requestAnimationFrame(animation);
    }
  }

  requestAnimationFrame(animation);
}

// 5. Lazy loading de imágenes
const imageObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      img.classList.add('loaded');
      imageObserver.unobserve(img);
    }
  });
});

function lazyLoadImage(img) {
  imageObserver.observe(img);
}
```

---

## 📊 FLUJOS DE MENSAJES

### Flujo 1: Envío de Mensaje Simple

```
1. Usuario escribe mensaje en input
2. Frontend valida (longitud, contenido)
3. Frontend envía POST /simulate/client-message
   Headers: Content-Type, X-User-Id
   Body: { clientId: 'web', text: '...' }
4. Backend (MessageCore):
   a. Persiste mensaje → PostgreSQL
   b. Broadcast WebSocket → message:new (mensaje del cliente)
   c. Procesa extensiones activas
   d. Por cada extensión:
      - Genera respuesta
      - Persiste → PostgreSQL
      - Broadcast WebSocket → message:new (respuesta de extensión)
5. Frontend recibe via WebSocket:
   - message:new (cliente) → muestra en UI
   - message_processing → muestra "Processing..."
   - extension_response x N → actualiza status
   - message:new (extensiones) → muestra respuestas
```

**Diagrama de Secuencia:**
```
User          Frontend        Backend         PostgreSQL      WebSocket
  |              |               |                |               |
  |--type msg--->|               |                |               |
  |              |--POST-------->|                |               |
  |              |               |--save--------->|               |
  |              |               |                |<---ok---------|
  |              |               |----------------broadcast------->|
  |              |<--------------message:new----------------------|
  |<---show------|               |                |               |
  |              |               |--extensions--->|               |
  |              |               |--save n times->|               |
  |              |               |----------------broadcast x n-->|
  |              |<--------------message:new x n------------------|
  |<---show------|               |                |               |
```

---

### Flujo 2: Carga Inicial de Mensajes

```
1. Frontend carga (DOMContentLoaded)
2. Intenta cargar desde localStorage (UI inmediata)
3. Conecta WebSocket en background
4. Fetch GET /messages?limit=50
   Headers: X-User-Id
5. Backend:
   a. Query PostgreSQL → últimos 50 mensajes
   b. Retorna JSON con array de mensajes
6. Frontend:
   a. Compara con localStorage
   b. Actualiza localStorage
   c. Re-renderiza UI con mensajes del servidor
7. WebSocket conectado → escucha nuevos mensajes
```

**Código Ejemplo:**
```javascript
async function loadInitialMessages() {
  // 1. Cargar de localStorage (rápido, offline-first)
  const localMessages = messageStore.getAll();
  if (localMessages.length > 0) {
    renderMessages(localMessages);
  }

  // 2. Conectar WebSocket
  wsManager.connect();

  // 3. Sincronizar con servidor
  try {
    const response = await apiRequest('/messages?limit=50');
    if (response.success) {
      const serverMessages = response.data.messages;
      messageStore.clear();
      serverMessages.forEach(msg => messageStore.save(msg));
      renderMessages(serverMessages);
    }
  } catch (error) {
    console.error('Failed to load messages from server:', error);
    // Continuar con mensajes locales
  }
}
```

---

### Flujo 3: Typing Indicators

```
1. Usuario empieza a escribir
2. Frontend envía via WebSocket:
   {
     type: 'typing',
     conversationId: 'default',
     isTyping: true
   }
3. Backend valida (size, schema, rate limit)
4. Backend broadcast a otros clientes conectados
5. Otros frontends reciben typing:indicator
6. Muestran "Usuario está escribiendo..."
7. Después de 3s sin teclear, enviar isTyping: false
```

**Código Ejemplo:**
```javascript
let typingTimer = null;
const TYPING_TIMEOUT = 3000;

messageInput.addEventListener('input', () => {
  // Enviar "typing: true"
  wsManager.send({
    type: 'typing',
    conversationId: 'default',
    isTyping: true
  });

  // Cancelar timer anterior
  if (typingTimer) {
    clearTimeout(typingTimer);
  }

  // Después de 3s de inactividad, enviar "typing: false"
  typingTimer = setTimeout(() => {
    wsManager.send({
      type: 'typing',
      conversationId: 'default',
      isTyping: false
    });
  }, TYPING_TIMEOUT);
});

// Escuchar typing indicators
wsManager.on('typing', (data) => {
  if (data.isTyping) {
    showTypingIndicator(data.userId);
  } else {
    hideTypingIndicator(data.userId);
  }
});
```

---

### Flujo 4: Manejo de Rate Limiting

```
1. Usuario envía muchos mensajes rápidamente
2. Frontend lee X-RateLimit-Remaining después de cada request
3. Si remaining < 3, mostrar warning
4. Si remaining = 0, deshabilitar botón de envío
5. Si backend retorna 429:
   a. Leer Retry-After header
   b. Mostrar countdown en UI
   c. Deshabilitar envío por N segundos
   d. Auto-habilitar cuando expire
6. Mostrar barra de progreso de rate limit
```

**UI Recomendada:**
```html
<div class="rate-limit-indicator">
  <div class="rate-limit-bar" id="rateLimitBar" style="width: 100%"></div>
  <span id="rateLimitText">12/12 requests remaining</span>
</div>

<style>
.rate-limit-indicator {
  padding: 4px 8px;
  background: #1a1a1a;
  border-radius: 4px;
  margin-bottom: 8px;
}

.rate-limit-bar {
  height: 4px;
  background: linear-gradient(90deg, #f00, #ff0, #0f0);
  border-radius: 2px;
  transition: width 0.3s;
}

.rate-limit-bar[data-level="low"] {
  background: #f00;
}
</style>
```

---

## 🔔 SISTEMA DE NOTIFICACIONES EN TIEMPO REAL

### Arquitectura WebSocket

**Backend:** `WebSocketNotification` (implementación V1)
- Ubicación: `implementations/v1/WebSocketNotification.ts`
- Responsabilidad: Broadcast de mensajes a clientes conectados
- Integrado con: MessageCore (auto-broadcast al persistir)

**Tipos de Notificaciones:**

| Tipo | Cuándo | Payload |
|------|--------|---------|
| `message:new` | Mensaje nuevo persistido | MessageEnvelope completo |
| `message:status` | Estado de mensaje cambia | { messageId, status, timestamp } |
| `typing:indicator` | Usuario escribiendo | { userId, conversationId, isTyping } |
| `message_processing` | Extensiones procesando | { messageId, extensionCount } |
| `extension_response` | Extensión respondió | { extensionId, messageId, success } |
| `error` | Error del servidor | { code, message, retryAfter } |

### Implementación Frontend

```javascript
// Configurar listeners
wsManager.on('message', (message) => {
  // Persistir localmente
  messageStore.save(message);

  // Actualizar UI
  addMessageToUI(message);

  // Notificación del sistema (si está en background)
  if (document.hidden && Notification.permission === 'granted') {
    new Notification('Nuevo mensaje', {
      body: message.content.text.substring(0, 100),
      icon: '/icon.png'
    });
  }

  // Reproducir sonido
  playNotificationSound();
});

wsManager.on('message-status', (statusUpdate) => {
  updateMessageStatus(statusUpdate.messageId, statusUpdate.status);
});

wsManager.on('typing', (data) => {
  if (data.isTyping) {
    showTypingIndicator(data.userId);
  } else {
    hideTypingIndicator(data.userId);
  }
});

wsManager.on('processing', (data) => {
  showProcessingIndicator(data.messageId, data.extensionCount);
});

wsManager.on('extension-response', (data) => {
  updateExtensionStatus(data.extensionId, data.success);
});

wsManager.on('server-error', (error) => {
  handleServerError(error);
});

wsManager.on('rate-limit', (error) => {
  showRateLimitNotification(error.retryAfter);
});
```

---

## 🛡️ PROTECCIONES Y SEGURIDAD

### 1. Rate Limiting (Sprint 2 ✅)

**Configuración Actual:**
- Free: 12 mensajes/minuto
- Premium: 30 mensajes/minuto
- Window: 60 segundos
- Shared entre HTTP y WebSocket (mismo userId)

**Headers Siempre Enviados:**
```
X-RateLimit-Limit: 12
X-RateLimit-Remaining: 5
X-RateLimit-Reset: 1700308800
```

**Error 429:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "limit": 12,
    "retryAfter": 60,
    "resetAt": "2025-11-19T12:00:00Z",
    "timestamp": "2025-11-19T11:59:00Z"
  }
}
```

**Recomendaciones Frontend:**
- Leer headers después de cada request
- Mostrar barra de progreso de rate limit
- Deshabilitar UI cuando remaining = 0
- Implementar queue local para mensajes pendientes
- Auto-retry después de resetAt

---

### 2. Validación (Sprint 2 ✅)

**Backend valida:**
- Estructura del mensaje (TypeBox schemas)
- Campos requeridos (type, channel, content, metadata)
- Tamaños máximos:
  - Texto: 16KB
  - Mensaje completo: 1MB
- Tipos válidos: incoming, outgoing, system, status
- Canales válidos: whatsapp, telegram, web, sms

**Error 400:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "details": [
      {
        "field": "content.text",
        "code": "REQUIRED_FIELD_MISSING",
        "message": "Field 'text' is required"
      }
    ],
    "timestamp": "2025-11-19T12:00:00Z"
  }
}
```

**Recomendaciones Frontend:**
- Validar localmente ANTES de enviar
- Mostrar errores field-specific en UI
- Sanitizar HTML/XSS antes de renderizar
- Límites visuales en inputs (contador de caracteres)

---

### 3. Timeout Protection (Sprint 2 ✅)

**Configuración:**
- Timeout: 30 segundos para `/messages`
- Cancelación automática si excede tiempo

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "TIMEOUT",
    "message": "Request timeout exceeded",
    "timestamp": "2025-11-19T12:00:00Z"
  }
}
```

**Recomendaciones Frontend:**
- Implementar propio timeout en fetch (AbortController)
- Mostrar spinner/loading durante requests
- Timeout máximo recomendado: 10 segundos
- Retry automático en caso de timeout

**Ejemplo:**
```javascript
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new APIError('TIMEOUT', 'Request timed out');
    }
    throw error;
  }
}
```

---

### 4. Sanitización XSS

**Backend sanitiza:**
- Contenido de texto (escapa HTML)
- Metadata fields

**Frontend DEBE sanitizar:**
- Antes de renderizar en innerHTML
- Antes de insertar en atributos HTML
- Antes de ejecutar eval/Function

**Función Obligatoria:**
```javascript
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// USO
messageElement.innerHTML = `
  <div class="message-body">
    ${escapeHtml(message.content.text)}
  </div>
`;
```

---

### 5. CORS

**Configuración Backend:**
- Development: `*` (todos los orígenes)
- Production: Whitelist específica
- Credentials: Habilitado
- Headers Expuestos:
  - X-RateLimit-Limit
  - X-RateLimit-Remaining
  - X-RateLimit-Reset
  - Retry-After

**Frontend DEBE:**
- Servirse vía HTTP (no `file://`)
- Usar puerto 5500 en desarrollo
- En producción, estar en dominio whitelisted

---

## 💾 PERSISTENCIA Y ESTADO

### Estado Local (Frontend)

**Recomendaciones:**

1. **LocalStorage para:**
   - Mensajes (últimos 100)
   - User ID
   - Preferencias UI
   - Rate limit status

2. **SessionStorage para:**
   - Estado de conexión WebSocket
   - Drafts de mensajes
   - Scroll position

3. **IndexedDB para:**
   - Mensajes históricos (>1000)
   - Media files (imágenes, videos)
   - Cache de búsqueda

**Estructura Recomendada:**
```javascript
// localStorage
{
  "inhost-messages": [...],        // Array de MessageEnvelope
  "inhost-user-id": "user-abc123",
  "inhost-preferences": {
    "notifications": true,
    "sound": true,
    "theme": "dark"
  },
  "inhost-rate-limit": {
    "limit": 12,
    "remaining": 8,
    "resetAt": 1700308800000
  }
}
```

---

### Estado del Servidor (Backend)

**PostgreSQL Schema (Prisma):**
```prisma
model Message {
  id            String   @id @default(uuid())
  type          String   // incoming, outgoing, system, status
  channel       String   // whatsapp, telegram, web, sms
  content       Json     // { text, contentType, mediaUrl }
  metadata      Json     // { from, to, timestamp, extensionId }
  status        Json?    // { current, history }
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([createdAt])
  @@index([channel])
  @@index([type])
}
```

**Query de Mensajes:**
```sql
-- GET /messages?limit=50
SELECT * FROM "Message"
ORDER BY "createdAt" DESC
LIMIT 50;
```

---

### Sincronización

**Estrategia Recomendada: Offline-First**

```javascript
class SyncManager {
  constructor() {
    this.syncInterval = 30000; // 30s
    this.lastSync = null;
  }

  async sync() {
    try {
      // 1. Push mensajes locales pendientes
      const pendingMessages = this.getPendingMessages();
      for (const msg of pendingMessages) {
        await this.sendMessage(msg);
        this.markAsSynced(msg.id);
      }

      // 2. Pull mensajes nuevos del servidor
      const lastMessageId = this.getLastMessageId();
      const newMessages = await this.fetchMessagesSince(lastMessageId);

      // 3. Merge con mensajes locales
      this.mergeMessages(newMessages);

      this.lastSync = Date.now();
      console.log('✅ Sync completed');

    } catch (error) {
      console.error('❌ Sync failed:', error);
    }
  }

  startAutoSync() {
    setInterval(() => this.sync(), this.syncInterval);
  }

  getPendingMessages() {
    const messages = messageStore.getAll();
    return messages.filter(msg => !msg.synced);
  }

  getLastMessageId() {
    const messages = messageStore.getAll();
    return messages[0]?.id;
  }

  async fetchMessagesSince(messageId) {
    const response = await apiRequest(
      `/messages?since=${messageId}&limit=100`
    );
    return response.data.messages;
  }

  mergeMessages(newMessages) {
    const localMessages = messageStore.getAll();
    const messageMap = new Map(localMessages.map(m => [m.id, m]));

    // Agregar nuevos mensajes
    for (const msg of newMessages) {
      if (!messageMap.has(msg.id)) {
        messageStore.save(msg);
      }
    }
  }

  markAsSynced(messageId) {
    const messages = messageStore.getAll();
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
      msg.synced = true;
      messageStore.save(msg);
    }
  }
}

// Inicializar
const syncManager = new SyncManager();
syncManager.startAutoSync();

// Sincronizar al reconectar
wsManager.on('connected', () => {
  syncManager.sync();
});
```

---

## 📘 CASOS DE USO COMPLETOS

### Caso de Uso 1: Chat en Tiempo Real

**Requisitos:**
- Enviar mensajes
- Recibir respuestas de bots
- Indicadores de escritura
- Persistencia offline
- Rate limiting visual

**Implementación Completa:**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>INHOST Chat</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="chat-container">
    <!-- Header con rate limit -->
    <div class="chat-header">
      <h1>INHOST Chat</h1>
      <div class="rate-limit-indicator">
        <div class="rate-limit-bar" id="rateLimitBar"></div>
        <span id="rateLimitText">--/-- requests</span>
      </div>
    </div>

    <!-- Mensajes -->
    <div class="chat-messages" id="chatMessages"></div>

    <!-- Typing indicator -->
    <div class="typing-indicator" id="typingIndicator" style="display: none;">
      <span>Bot is typing...</span>
    </div>

    <!-- Input -->
    <div class="chat-input-area">
      <input
        type="text"
        id="messageInput"
        placeholder="Type a message..."
        maxlength="16384">
      <button id="sendBtn">Send</button>
    </div>
  </div>

  <script type="module" src="app.js"></script>
</body>
</html>
```

```javascript
// app.js
import apiContract from './api-contract.json';

const API_BASE_URL = apiContract.baseURL.development;
const WS_URL = apiContract.websocketURL.development;

// Managers
const messageStore = new MessageStore();
const wsManager = new WebSocketManager(WS_URL);
const syncManager = new SyncManager();

// DOM
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const rateLimitBar = document.getElementById('rateLimitBar');
const rateLimitText = document.getElementById('rateLimitText');
const typingIndicator = document.getElementById('typingIndicator');

// Estado
let typingTimer = null;

// Inicialización
async function init() {
  // 1. Cargar mensajes locales
  const localMessages = messageStore.getAll();
  renderMessages(localMessages);

  // 2. Conectar WebSocket
  wsManager.connect();
  setupWebSocketListeners();

  // 3. Sincronizar con servidor
  await syncManager.sync();

  // 4. Eventos UI
  sendBtn.addEventListener('click', handleSendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendMessage();
  });
  messageInput.addEventListener('input', handleTyping);

  // 5. Auto-sync
  syncManager.startAutoSync();
}

// WebSocket listeners
function setupWebSocketListeners() {
  wsManager.on('connected', () => {
    console.log('✅ Connected');
    syncManager.sync();
  });

  wsManager.on('message', (message) => {
    messageStore.save(message);
    addMessageToUI(message);
  });

  wsManager.on('typing', (data) => {
    typingIndicator.style.display = data.isTyping ? 'block' : 'none';
  });

  wsManager.on('rate-limit', (error) => {
    alert(`Rate limit exceeded. Wait ${error.retryAfter}s`);
    disableSendButton(error.retryAfter);
  });
}

// Enviar mensaje
async function handleSendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  // Validar
  const validation = validateMessage(text);
  if (!validation.valid) {
    alert(validation.errors.join('\n'));
    return;
  }

  try {
    const response = await apiRequest('/simulate/client-message', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'web',
        text: text
      })
    });

    if (response.success) {
      messageInput.value = '';
      console.log('✅ Message sent');
    }

  } catch (error) {
    if (error instanceof APIError) {
      handleAPIError(error);
    } else {
      alert('Error sending message');
    }
  }
}

// Typing indicator
function handleTyping() {
  wsManager.send({
    type: 'typing',
    conversationId: 'default',
    isTyping: true
  });

  if (typingTimer) clearTimeout(typingTimer);

  typingTimer = setTimeout(() => {
    wsManager.send({
      type: 'typing',
      conversationId: 'default',
      isTyping: false
    });
  }, 3000);
}

// Renderizar mensajes
function renderMessages(messages) {
  chatMessages.innerHTML = '';
  messages.forEach(msg => addMessageToUI(msg));
  scrollToBottom();
}

function addMessageToUI(message) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${message.type}`;
  messageEl.innerHTML = `
    <div class="message-header">
      <span class="message-from">${escapeHtml(message.metadata.from)}</span>
      <span class="message-time">${formatTime(new Date(message.metadata.timestamp))}</span>
    </div>
    <div class="message-body">${escapeHtml(message.content.text)}</div>
  `;
  chatMessages.appendChild(messageEl);
  scrollToBottom();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

// Rate limit UI
function updateRateLimitUI({ limit, remaining, reset }) {
  const percentage = (remaining / limit) * 100;
  rateLimitBar.style.width = `${percentage}%`;
  rateLimitText.textContent = `${remaining}/${limit} requests`;

  if (percentage < 20) {
    rateLimitBar.classList.add('low');
  } else {
    rateLimitBar.classList.remove('low');
  }
}

function disableSendButton(seconds) {
  sendBtn.disabled = true;
  const interval = setInterval(() => {
    seconds--;
    sendBtn.textContent = `Wait ${seconds}s`;
    if (seconds <= 0) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
      clearInterval(interval);
    }
  }, 1000);
}

// Manejar errores
function handleAPIError(error) {
  switch (error.code) {
    case 'RATE_LIMIT_EXCEEDED':
      disableSendButton(error.details.retryAfter);
      break;
    case 'VALIDATION_ERROR':
      alert(`Validation error: ${error.message}`);
      break;
    case 'NETWORK_ERROR':
      alert('Network error. Retrying...');
      break;
    default:
      alert(`Error: ${error.message}`);
  }
}

// Utils
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour12: false });
}

function validateMessage(text) {
  const errors = [];
  if (!text || text.trim().length === 0) {
    errors.push('Message cannot be empty');
  }
  if (text.length > 16384) {
    errors.push('Message is too long (max 16KB)');
  }
  return {
    valid: errors.length === 0,
    errors
  };
}

// Iniciar
init();
```

---

### Caso de Uso 2: Dashboard de Monitoreo

**Requisitos:**
- Listar mensajes recientes
- Ver estado de clientes y extensiones
- Activar/desactivar extensiones
- Estadísticas en tiempo real

**Ver:** `testing/tests/test-chat-flow-improved.html` para referencia completa

---

## 🔧 TROUBLESHOOTING

### Problema 1: "Failed to fetch" en todos los requests

**Causas:**
1. Dashboard abierto desde `file://` (CORS bloqueado)
2. Backend no iniciado
3. Múltiples instancias de Bun

**Solución:**
```bash
# 1. Verificar que el dashboard esté en HTTP
# URL debe ser: http://localhost:5500
# NO: file:///C:/Users/.../index.html

# 2. Iniciar testing server
cd testing && bun server.js

# 3. Verificar backend
curl http://localhost:3000/health

# 4. Si múltiples instancias de Bun:
taskkill /F /IM bun.exe
bun --cwd apps/api-gateway dev
```

---

### Problema 2: Headers de rate limiting no visibles

**Causa:** Algunos navegadores/herramientas no muestran headers CORS

**Solución:**
```javascript
// Leer headers explícitamente en código
const response = await fetch(url);
console.log('Rate Limit:', response.headers.get('X-RateLimit-Limit'));
console.log('Remaining:', response.headers.get('X-RateLimit-Remaining'));
console.log('Reset:', response.headers.get('X-RateLimit-Reset'));
```

---

### Problema 3: WebSocket desconecta constantemente

**Causas:**
1. Firewall bloqueando WebSocket
2. Proxy HTTP (no soporta WS)
3. Timeout de red

**Solución:**
```javascript
// Aumentar intentos de reconexión
const wsManager = new WebSocketManager(WS_URL, {
  reconnectDelay: 5000,
  maxReconnectAttempts: 20
});

// Implementar ping/pong
setInterval(() => {
  if (wsManager.connected) {
    wsManager.send({ type: 'ping' });
  }
}, 30000);
```

---

### Problema 4: Mensajes duplicados en UI

**Causa:** Recibir mensaje tanto por HTTP response como WebSocket

**Solución:**
```javascript
const messageIds = new Set();

function addMessageToUI(message) {
  // Evitar duplicados
  if (messageIds.has(message.id)) {
    return;
  }
  messageIds.add(message.id);

  // Renderizar
  const messageEl = createMessageElement(message);
  chatMessages.appendChild(messageEl);
}
```

---

## 📚 RECURSOS ADICIONALES

### Documentos Relacionados
- `api-contract.json` - Contrato de API completo
- `CLAUDE.md` - Guía del proyecto
- `QUICK-START.md` - Inicio rápido
- `docs/guides/sprint2-testing.md` - Testing de protecciones
- `docs/architecture/plan-modular.md` - Arquitectura modular

### Scripts de Testing
- `testing/tests/test-chat-flow-improved.html` - Demo completo
- `testing/tests/test-sprint2-protection.html` - Tests de protección
- `scripts/test-websocket.js` - Test automatizado de WebSocket

### APIs Importantes
- **Health:** `GET /health`
- **Mensajes:** `GET /messages`, `POST /simulate/client-message`
- **WebSocket:** `ws://localhost:3000/realtime`
- **Estado:** `GET /simulate/status`

---

## ✅ CHECKLIST DE INTEGRACIÓN

**Antes de ir a producción, verificar:**

- [ ] Frontend usa `api-contract.json` como fuente de verdad
- [ ] Headers requeridos enviados (`Content-Type`, `X-User-Id`)
- [ ] Rate limiting manejado (headers leídos, UI actualizada, 429 handled)
- [ ] WebSocket con auto-reconexión implementado
- [ ] Validación de inputs antes de enviar
- [ ] Sanitización XSS en todo contenido renderizado
- [ ] Persistencia local con localStorage/IndexedDB
- [ ] Sincronización con servidor implementada
- [ ] Manejo de errores completo (400, 429, 500, network)
- [ ] Timeout protection en requests (AbortController)
- [ ] Retry logic con exponential backoff
- [ ] Typing indicators funcionando
- [ ] Notificaciones del sistema (Notification API)
- [ ] Performance optimizada (debounce, throttle, virtual scroll)
- [ ] Accesibilidad (ARIA labels, keyboard navigation)
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Tests end-to-end escritos
- [ ] Documentación frontend actualizada

---

## 🎯 PRÓXIMOS PASOS RECOMENDADOS

1. **Migrar frontend actual:**
   - Reemplazar URLs hardcoded con contrato
   - Implementar manejo de rate limiting visual
   - Agregar persistencia con localStorage
   - Conectar con endpoints reales (no mocks)

2. **Expandir funcionalidades:**
   - Soporte de multimedia (imágenes, videos, archivos)
   - Búsqueda de mensajes
   - Filtros por canal/tipo
   - Exportar conversaciones

3. **Optimizaciones:**
   - Implementar Service Worker (PWA)
   - Cache de API responses
   - Virtual scrolling para listas grandes
   - Lazy loading de imágenes

4. **Seguridad:**
   - Implementar autenticación real (JWT)
   - Cifrado end-to-end (futuro)
   - Content Security Policy
   - Rate limiting local (evitar spam al servidor)

---

**FIN DEL DOCUMENTO**

Versión: 1.0.0
Última actualización: 2025-11-19
Mantenido por: Equipo INHOST
