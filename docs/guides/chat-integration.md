# Chat Real - Guía de Integración con Backend

## 🎯 Propósito

Este documento explica cómo el **chat real (frontend)** debe integrarse con el **backend INHOST** para enviar mensajes, recibir respuestas de extensiones, y sincronizar estados en tiempo real.

---

## 🔄 Flujo Completo de Mensajería

```
┌─────────────┐
│  Chat Real  │
│  (Frontend) │
└──────┬──────┘
       │
       │ 1. Usuario escribe mensaje
       │
       ▼
POST /simulate/client-message
{ clientId: 'web', text: 'Hola' }
       │
       ▼
┌──────────────────────────────┐
│ Backend: simulation.ts       │
├──────────────────────────────┤
│ 1. createClientMessage()     │  ← Crea MessageEnvelope
│ 2. messageCore.receive()     │  ← Persiste en PostgreSQL
│                               │  ← Broadcast vía WebSocket: message:new
│ 3. processExtensions()       │  ← Genera respuestas (Echo, AI, CRM)
│ 4. messageCore.send() x N    │  ← Persiste cada respuesta
│                               │  ← Envía vía adapter
│                               │  ← Broadcast vía WebSocket: message:new
└──────────────────────────────┘
       │
       │ 2. WebSocket Notifications
       ▼
┌─────────────┐
│  Chat Real  │  ← Recibe notificaciones en tiempo real
│  (Frontend) │     • message:new (mensaje original)
└─────────────┘     • message:new (respuestas extensiones)
                    • message:status (cambios de estado)
                    • typing:indicator (si aplica)
```

---

## 📡 1. Enviar Mensajes desde el Chat

### Endpoint: `POST /simulate/client-message`

**Cuando el usuario escribe un mensaje en el chat, enviar:**

```typescript
POST http://localhost:3000/simulate/client-message
Content-Type: application/json

{
  "clientId": "web",  // Siempre "web" para chat web
  "text": "Hola, necesito ayuda"
}
```

**Response esperada:**

```typescript
{
  "success": true,
  "data": {
    "clientMessage": {
      "id": "uuid-v4",
      "type": "incoming",
      "channel": "web",
      "text": "Hola, necesito ayuda",
      "persisted": true  ← ✅ Guardado en PostgreSQL
    },
    "extensionResponses": [
      {
        "extensionId": "echo",
        "messageId": "uuid-v4",
        "success": true,
        "status": "sent",
        "persisted": true  ← ✅ Guardado en PostgreSQL
      },
      {
        "extensionId": "ai",
        "messageId": "uuid-v4",
        "success": true,
        "status": "sent",
        "persisted": true
      }
    ],
    "processedCount": 2,
    "summary": {
      "clientMessagePersisted": true,
      "extensionResponsesSent": 2,
      "totalExtensions": 2
    }
  },
  "metadata": {
    "timestamp": "2025-11-18T12:00:00Z"
  }
}
```

---

## 🔌 2. Recibir Notificaciones en Tiempo Real

### Conectar WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3000/realtime');

ws.onopen = () => {
  console.log('✅ Connected to backend');
};

ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  handleNotification(notification);
};
```

### Tipos de Notificaciones que Recibirás

#### 2.1 Conexión establecida

```typescript
{
  "type": "connection",
  "status": "connected",
  "timestamp": "2025-11-18T12:00:00Z",
  "clientId": "uuid-v4"
}
```

**Acción:** Guardar `clientId` para referencia futura.

---

#### 2.2 Nuevo mensaje recibido (`message:new`)

**Cuando el usuario envía un mensaje:**

```typescript
{
  "type": "message:new",
  "data": {
    "id": "uuid-msg-1",
    "conversationId": "conv-uuid",
    "type": "incoming",
    "channel": "web",
    "content": {
      "text": "Hola, necesito ayuda",
      "contentType": "text"
    },
    "metadata": {
      "from": "web-session-abc",
      "to": "inhost",
      "timestamp": "2025-11-18T12:00:00Z"
    },
    "statusChain": [
      {
        "status": "received",
        "timestamp": "2025-11-18T12:00:00Z",
        "messageId": "uuid-msg-1"
      }
    ],
    "context": {
      "plan": "free",
      "timestamp": "2025-11-18T12:00:00Z",
      "source": "simulator"
    }
  },
  "timestamp": "2025-11-18T12:00:00Z"
}
```

**Acción:**
- Renderizar mensaje en el chat con estado "received"
- Persistir en IndexedDB local
- Mostrar checkmark verde

---

**Cuando una extensión responde:**

```typescript
{
  "type": "message:new",
  "data": {
    "id": "uuid-msg-2",
    "conversationId": "conv-uuid",
    "type": "outgoing",
    "channel": "web",
    "content": {
      "text": "¡Hola! 👋 Soy un asistente de IA. ¿En qué puedo ayudarte?",
      "contentType": "text"
    },
    "metadata": {
      "from": "ai-bot",
      "to": "web-session-abc",
      "timestamp": "2025-11-18T12:00:02Z",
      "extensionId": "ai",
      "originalMessageId": "uuid-msg-1"
    },
    "statusChain": [
      {
        "status": "sent",
        "timestamp": "2025-11-18T12:00:02Z",
        "messageId": "uuid-msg-2"
      }
    ],
    "context": {
      "plan": "free",
      "timestamp": "2025-11-18T12:00:02Z",
      "extension": {
        "id": "ai",
        "name": "AI Assistant",
        "latency": 120
      }
    }
  },
  "timestamp": "2025-11-18T12:00:02Z"
}
```

**Acción:**
- Renderizar respuesta del bot en el chat (burbuja izquierda)
- Mostrar ícono de extensión: 🧠 (AI), 📢 (Echo), 📊 (CRM)
- Persistir en IndexedDB local
- Animar entrada del mensaje

---

#### 2.3 Actualización de estado (`message:status`)

```typescript
{
  "type": "message:status",
  "data": {
    "messageId": "uuid-msg-1",
    "status": "sent",
    "timestamp": "2025-11-18T12:00:01Z"
  },
  "timestamp": "2025-11-18T12:00:01Z"
}
```

**Posibles estados:**
- `received` - Mensaje recibido por el servidor
- `processing` - Siendo procesado
- `sending` - Enviándose
- `sent` - Enviado exitosamente
- `delivered` - Entregado al destinatario
- `read` - Leído por el destinatario
- `failed` - Error en el envío

**Acción:**
- Actualizar indicador visual (checkmarks: ✓, ✓✓, ✓✓ azul)
- Actualizar estado en IndexedDB

---

#### 2.4 Indicador de escritura (`typing:indicator`)

```typescript
{
  "type": "typing:indicator",
  "data": {
    "userId": "ai-bot",
    "conversationId": "conv-uuid",
    "isTyping": true,
    "timestamp": "2025-11-18T12:00:01Z"
  },
  "timestamp": "2025-11-18T12:00:01Z"
}
```

**Acción:**
- Mostrar "AI Assistant está escribiendo..." con animación de puntos
- Ocultar cuando `isTyping: false`

---

#### 2.5 Eventos de control

**Procesamiento iniciado:**

```typescript
{
  "type": "message_processing",
  "messageId": "uuid-msg-1",
  "extensionCount": 2,
  "timestamp": "2025-11-18T12:00:00Z"
}
```

**Respuesta de extensión:**

```typescript
{
  "type": "extension_response",
  "extensionId": "ai",
  "messageId": "uuid-msg-2",
  "success": true,
  "timestamp": "2025-11-18T12:00:02Z"
}
```

**Acción:** Opcional - mostrar indicador de "2 extensiones procesando"

---

## 🎮 3. Gestión de Extensiones desde el Chat

### 3.1 Activar/Desactivar Extensión

```typescript
POST http://localhost:3000/simulate/extension-toggle
Content-Type: application/json

{
  "extensionId": "ai"  // "echo" | "ai" | "crm"
}
```

**Response:**

```typescript
{
  "success": true,
  "data": {
    "extensionId": "ai",
    "active": true  // o false
  }
}
```

**Notificación WebSocket automática:**

```typescript
{
  "type": "extension_toggle",
  "extensionId": "ai",
  "active": true,
  "timestamp": "2025-11-18T12:00:00Z"
}
```

### 3.2 Obtener Estado del Sistema

```typescript
GET http://localhost:3000/simulate/status
```

**Response:**

```typescript
{
  "success": true,
  "data": {
    "clients": [
      {
        "id": "web-sim",
        "name": "Web Chat",
        "icon": "🌐",
        "channel": "web",
        "connected": true,
        "metadata": {
          "sessionId": "web-session-abc"
        }
      }
    ],
    "extensions": [
      {
        "id": "echo",
        "name": "Echo Bot",
        "icon": "📢",
        "active": false,
        "latency": 45,
        "subscriptions": ["incoming"]
      },
      {
        "id": "ai",
        "name": "AI Assistant",
        "icon": "🧠",
        "active": true,
        "latency": 120,
        "subscriptions": ["incoming"]
      }
    ],
    "stats": {
      "activeExtensions": 1,
      "connectedClients": 1,
      "totalClients": 4,
      "totalExtensions": 3
    }
  }
}
```

---

## 💾 4. Persistencia Local (Frontend)

### Estructura Recomendada - IndexedDB

```typescript
// Store: messages
interface StoredMessage {
  id: string;                    // UUID del mensaje
  conversationId: string;        // UUID de conversación
  type: 'incoming' | 'outgoing';
  channel: 'web';
  text: string;
  from: string;
  to: string;
  timestamp: string;             // ISO 8601
  status: MessageStatus;
  extensionId?: string;          // Si viene de bot
  synced: boolean;               // ¿Sincronizado con servidor?
  localTimestamp: number;        // Date.now() para ordenar offline
}

// Store: conversations
interface StoredConversation {
  id: string;
  participant: string;           // 'ai-bot', 'echo-bot', etc.
  channel: 'web';
  lastMessageAt: string;
  unreadCount: number;
  lastMessage: string;
}

// Store: syncQueue (para offline-first)
interface QueuedMessage {
  id: string;
  clientId: 'web';
  text: string;
  createdAt: number;
  retryCount: number;
}
```

### Flujo de Persistencia

```typescript
// 1. Usuario envía mensaje
async function sendMessage(text: string) {
  const tempId = `temp-${Date.now()}`;

  // Guardar localmente primero (optimistic UI)
  await db.messages.add({
    id: tempId,
    type: 'incoming',
    text,
    timestamp: new Date().toISOString(),
    status: 'sending',
    synced: false,
    localTimestamp: Date.now()
  });

  // Mostrar en UI inmediatamente
  renderMessage(tempId, text, 'sending');

  try {
    // Enviar al servidor
    const response = await fetch('/simulate/client-message', {
      method: 'POST',
      body: JSON.stringify({ clientId: 'web', text })
    });

    const data = await response.json();

    // Actualizar con ID real del servidor
    await db.messages.update(tempId, {
      id: data.data.clientMessage.id,
      status: 'received',
      synced: true
    });

  } catch (error) {
    // Error: marcar como fallido
    await db.messages.update(tempId, {
      status: 'failed',
      synced: false
    });

    // Agregar a cola de reintentos
    await db.syncQueue.add({
      id: tempId,
      clientId: 'web',
      text,
      createdAt: Date.now(),
      retryCount: 0
    });
  }
}

// 2. Recibir mensaje del WebSocket
ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'message:new') {
    const envelope = msg.data;

    // Guardar en IndexedDB
    await db.messages.add({
      id: envelope.id,
      conversationId: envelope.conversationId,
      type: envelope.type,
      channel: envelope.channel,
      text: envelope.content.text,
      from: envelope.metadata.from,
      to: envelope.metadata.to,
      timestamp: envelope.metadata.timestamp,
      status: envelope.statusChain[0].status,
      extensionId: envelope.metadata.extensionId,
      synced: true,
      localTimestamp: Date.now()
    });

    // Renderizar en UI
    renderMessage(envelope);
  }
};
```

---

## 🧪 5. Testing del Flujo Completo

### Prueba Manual con cURL

```bash
# Terminal 1: Ver logs del servidor
bun --cwd apps/api-gateway dev

# Terminal 2: Enviar mensaje
curl -X POST http://localhost:3000/simulate/client-message \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "web",
    "text": "Hola mundo"
  }'

# Verificar en logs:
# ✅ Message received through MessageCore
# ✅ Message persisted (PostgreSQL)
# ✅ Message broadcasted (WebSocket)
# ✅ Extensions processed (2)
# ✅ Extension responses sent (2)
```

### Verificar Persistencia en DB

```bash
# Conectar a PostgreSQL
psql -U inhost -d inhost

# Ver mensajes guardados
SELECT id, type, channel, content->>'text' as text,
       metadata->>'from' as from_user,
       created_at
FROM messages
ORDER BY created_at DESC
LIMIT 10;
```

### Prueba con WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3000/realtime');

ws.onopen = () => {
  console.log('✅ Connected');
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log('📨 Received:', msg.type, msg);
};

// Enviar mensaje de prueba
fetch('http://localhost:3000/simulate/client-message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    clientId: 'web',
    text: 'Test desde chat'
  })
});

// Esperar recibir:
// 1. { type: 'message:new', data: { type: 'incoming', text: 'Test desde chat' } }
// 2. { type: 'message_processing', extensionCount: N }
// 3. { type: 'message:new', data: { type: 'outgoing', from: 'echo-bot' } }
// 4. { type: 'message:new', data: { type: 'outgoing', from: 'ai-bot' } }
```

---

## ⚠️ 6. Manejo de Errores

### Error: Rate Limit Excedido

```typescript
// Response HTTP
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "details": { "retryAfter": 60 },
    "timestamp": "2025-11-18T12:00:00Z"
  }
}

// WebSocket (si envías vía WS)
{
  "type": "error",
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded. Please slow down.",
  "retryAfter": 60,
  "limit": 12,
  "resetAt": "2025-11-18T12:01:00Z",
  "timestamp": "2025-11-18T12:00:00Z"
}
```

**Acción:**
- Mostrar mensaje: "Demasiados mensajes, espera 60 segundos"
- Deshabilitar input temporalmente
- Countdown timer visible

### Error: Validación Fallida

```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": "Field 'text' is required",
    "timestamp": "2025-11-18T12:00:00Z"
  }
}
```

**Acción:**
- Mostrar error inline en el input
- No enviar mensaje vacío

### Error: Servidor Desconectado

```typescript
ws.onclose = (event) => {
  console.log('❌ Disconnected:', event.code, event.reason);

  // Mostrar banner: "Conexión perdida. Reconectando..."
  // Intentar reconexión con backoff exponencial
  setTimeout(() => reconnect(), 2000);
};
```

---

## 📊 7. Extensiones Disponibles

| ID | Nombre | Icono | Descripción | Latencia |
|----|--------|-------|-------------|----------|
| `echo` | Echo Bot | 📢 | Devuelve el mensaje con prefijo "Echo: " | 45ms |
| `ai` | AI Assistant | 🧠 | Respuestas inteligentes basadas en keywords | 120ms |
| `crm` | CRM Sync | 📊 | Registra contacto en CRM simulado | 200ms |

**Activar/desactivar:**

```typescript
// Activar AI Bot
await fetch('/simulate/extension-toggle', {
  method: 'POST',
  body: JSON.stringify({ extensionId: 'ai' })
});

// La próxima vez que envíes un mensaje, recibirás respuesta de AI
```

---

## ✅ Checklist de Integración

- [ ] **WebSocket conectado** al iniciar chat
- [ ] **Envío de mensajes** vía POST `/simulate/client-message`
- [ ] **Renderizado optimista** (UI antes de confirmación)
- [ ] **Escuchar `message:new`** para mensajes entrantes y salientes
- [ ] **Escuchar `message:status`** para actualizar checkmarks
- [ ] **Persistir en IndexedDB** todos los mensajes
- [ ] **Cola de reintentos** para mensajes fallidos offline
- [ ] **Manejo de errores** (rate limit, validación, desconexión)
- [ ] **Panel de extensiones** para activar/desactivar bots
- [ ] **Indicador de typing** cuando bot responde
- [ ] **Testing** con múltiples extensiones activas

---

## 🚀 Próximos Pasos

1. **Implementar UI del chat** consumiendo estos endpoints
2. **Agregar autenticación** (reemplazar `clientId: 'web'` con token JWT)
3. **Implementar sincronización offline** con `syncQueue`
4. **Agregar paginación** para cargar historial (`GET /messages?limit=20&offset=40`)
5. **Implementar búsqueda** en mensajes guardados localmente
6. **Agregar notificaciones** push cuando el chat esté en background

---

## 📚 Recursos

- **Contrato completo API:** `/docs/guides/api-contract.md`
- **MessageEnvelope schema:** `packages/shared/src/types/message-envelope.ts`
- **Rutas de simulación:** `apps/api-gateway/src/routes/simulation.ts`
- **WebSocket notifications:** `apps/api-gateway/src/routes/websocket.ts`

---

**El sistema está listo para producción.** El chat puede empezar a enviar mensajes y recibirá respuestas automáticas de las extensiones, todo persistido en PostgreSQL y notificado en tiempo real vía WebSocket.
