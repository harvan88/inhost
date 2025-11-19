# ⚡ QUICK REFERENCE - INHOST Frontend

**Guía rápida de consulta - Ten esto a la mano**

---

## 🔗 URLs

```javascript
// Development
API: http://localhost:3000
WebSocket: ws://localhost:3000/realtime

// Production
API: https://api.inhost.com
WebSocket: wss://api.inhost.com/realtime
```

**⚠️ IMPORTANTE:** NO hardcodear - usar `api-contract.json`

---

## 📡 ENDPOINTS PRINCIPALES

### Enviar Mensaje
```http
POST /simulate/client-message
Content-Type: application/json
X-User-Id: <userId>

{
  "clientId": "web",
  "text": "Mensaje de prueba"
}
```

### Listar Mensajes
```http
GET /messages?limit=50
X-User-Id: <userId>
```

### Estado del Sistema
```http
GET /simulate/status
```

### Toggle Extensión
```http
POST /simulate/extension-toggle
Content-Type: application/json

{
  "extensionId": "ai"
}
```

---

## 🔌 WebSocket - Mensajes

### Cliente → Servidor
```javascript
// Typing indicator
ws.send(JSON.stringify({
  type: 'typing',
  conversationId: 'default',
  isTyping: true
}));
```

### Servidor → Cliente
```javascript
// Nuevo mensaje
{
  type: 'message:new',
  data: {
    id: "uuid",
    type: "incoming",
    channel: "web",
    content: { text: "..." },
    metadata: { from: "...", to: "...", timestamp: "..." }
  }
}

// Error
{
  type: 'error',
  code: 'RATE_LIMIT_EXCEEDED',
  message: '...',
  retryAfter: 60
}
```

---

## 📋 HEADERS OBLIGATORIOS

```javascript
const headers = {
  'Content-Type': 'application/json',  // POST/PUT/PATCH
  'X-User-Id': getUserId()             // TODOS los endpoints
};
```

---

## 🚦 RATE LIMITING

### Configuración
- **Free:** 12 mensajes/minuto
- **Premium:** 30 mensajes/minuto
- **Window:** 60 segundos

### Headers de Respuesta
```javascript
X-RateLimit-Limit: 12
X-RateLimit-Remaining: 5
X-RateLimit-Reset: 1700308800  // Unix timestamp
Retry-After: 60                // Solo en error 429
```

### Leer en Código
```javascript
const limit = response.headers.get('X-RateLimit-Limit');
const remaining = response.headers.get('X-RateLimit-Remaining');
const reset = response.headers.get('X-RateLimit-Reset');

// Actualizar UI
const percentage = (remaining / limit) * 100;
rateLimitBar.style.width = `${percentage}%`;
```

---

## ❌ CÓDIGOS DE ERROR

| Código | HTTP | Descripción | Acción |
|--------|------|-------------|--------|
| `VALIDATION_ERROR` | 400 | Campo requerido faltante | Mostrar error en UI |
| `INVALID_JSON` | 400 | JSON malformado | Revisar payload |
| `RATE_LIMIT_EXCEEDED` | 429 | Límite excedido | Deshabilitar envío N segundos |
| `TIMEOUT` | 408 | Request demorado | Reintentar |
| `INTERNAL_ERROR` | 500 | Error del servidor | Reintentar con backoff |

---

## 🛡️ VALIDACIÓN

### Antes de Enviar
```javascript
function validateMessage(text) {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Mensaje vacío' };
  }
  if (text.length > 16384) {  // 16KB
    return { valid: false, error: 'Mensaje muy largo' };
  }
  return { valid: true };
}
```

### Sanitización XSS
```javascript
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// USO
messageElement.innerHTML = escapeHtml(message.text);
```

---

## 💾 PERSISTENCIA

### Guardar en localStorage
```javascript
class MessageStore {
  save(message) {
    const messages = this.getAll();
    messages.unshift(message);
    localStorage.setItem('inhost-messages', JSON.stringify(messages));
  }

  getAll() {
    const data = localStorage.getItem('inhost-messages');
    return data ? JSON.parse(data) : [];
  }
}
```

### User ID
```javascript
function getUserId() {
  let userId = localStorage.getItem('inhost-user-id');
  if (!userId) {
    userId = 'user-' + crypto.randomUUID().substring(0, 8);
    localStorage.setItem('inhost-user-id', userId);
  }
  return userId;
}
```

---

## 🔄 RETRY LOGIC

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      const delay = 1000 * Math.pow(2, attempt);  // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// USO
await retryWithBackoff(() => sendMessage(data));
```

---

## 🌐 WebSocket AUTO-RECONEXIÓN

```javascript
class WebSocketManager {
  connect() {
    this.ws = new WebSocket(WS_URL);

    this.ws.onclose = () => {
      console.log('Desconectado, reconectando en 3s...');
      setTimeout(() => this.connect(), 3000);
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
  }
}
```

---

## 🎨 UI PATTERNS

### Rate Limit Bar
```html
<div class="rate-limit-bar" id="rateLimitBar"></div>
<span id="rateLimitText">12/12 requests</span>
```

```css
.rate-limit-bar {
  height: 4px;
  background: linear-gradient(90deg, #f00, #ff0, #0f0);
  transition: width 0.3s;
}
```

### Loading State
```javascript
button.disabled = true;
button.textContent = 'Sending...';

// Después del envío
button.disabled = false;
button.textContent = 'Send';
```

### Typing Indicator
```javascript
// Enviar cada vez que el usuario escribe
messageInput.addEventListener('input', () => {
  ws.send(JSON.stringify({
    type: 'typing',
    conversationId: 'default',
    isTyping: true
  }));

  // Cancelar después de 3s sin teclear
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    ws.send(JSON.stringify({
      type: 'typing',
      isTyping: false
    }));
  }, 3000);
});
```

---

## 🔧 DEBUGGING

### Ver Headers de Rate Limit
```javascript
console.log('Limit:', response.headers.get('X-RateLimit-Limit'));
console.log('Remaining:', response.headers.get('X-RateLimit-Remaining'));
console.log('Reset:', response.headers.get('X-RateLimit-Reset'));
```

### Ver Mensajes WebSocket
```javascript
ws.onmessage = (event) => {
  console.log('WS ←', event.data);
  const data = JSON.parse(event.data);
  // ...
};

ws.send = (data) => {
  console.log('WS →', data);
  WebSocket.prototype.send.call(ws, data);
};
```

### Test de Conexión
```bash
# Health check
curl http://localhost:3000/health

# Enviar mensaje
curl -X POST http://localhost:3000/simulate/client-message \
  -H "Content-Type: application/json" \
  -H "X-User-Id: test-user" \
  -d '{"clientId":"web","text":"Test"}'
```

---

## ⚡ SNIPPETS ÚTILES

### Fetch con Timeout
```javascript
async function fetchWithTimeout(url, options, timeout = 10000) {
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
      throw new Error('Request timeout');
    }
    throw error;
  }
}
```

### Formatear Tiempo
```javascript
function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour12: false });
}

function formatTimeWithMs(date) {
  return date.toLocaleTimeString('en-US', { hour12: false }) +
         '.' + date.getMilliseconds().toString().padStart(3, '0');
}
```

### Scroll to Bottom
```javascript
function scrollToBottom() {
  requestAnimationFrame(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}
```

---

## 🚨 ERRORES COMUNES

### "Failed to fetch"
**Causa:** Dashboard en `file://` en vez de `http://`
**Solución:** `cd testing && bun server.js`

### Headers no visibles
**Causa:** Browser devtools no muestra CORS headers
**Solución:** Leer en código con `.headers.get()`

### WebSocket desconecta
**Causa:** Firewall o timeout
**Solución:** Implementar auto-reconexión

### Mensajes duplicados
**Causa:** Recibir por HTTP y WebSocket
**Solución:** Usar Set de IDs para deduplicar

---

## 📚 VER TAMBIÉN

- **Documentación completa:** FRONTEND-INTEGRATION-MANDATES.md
- **Resumen ejecutivo:** FRONTEND-AUDIT-SUMMARY.md
- **Contrato de API:** api-contract.json
- **README del paquete:** README.md

---

**TIP:** Imprime esta página y tenla a la mano mientras desarrollas
