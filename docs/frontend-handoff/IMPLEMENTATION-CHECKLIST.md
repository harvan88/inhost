# ✅ IMPLEMENTATION CHECKLIST - INHOST Frontend

**Usa este archivo para trackear tu progreso**

Marca con `[x]` cada tarea completada.

---

## 📖 FASE 0: PREPARACIÓN (1 día)

### Lectura y Comprensión
- [ ] Leer `README.md` de este paquete (30 min)
- [ ] Leer `FRONTEND-AUDIT-SUMMARY.md` completo (30 min)
- [ ] Revisar `api-contract.json` (30 min)
- [ ] Leer sección "Mandatos" de `FRONTEND-INTEGRATION-MANDATES.md` (1 hora)
- [ ] Tener `QUICK-REFERENCE.md` a la mano

### Setup de Ambiente
- [ ] Clonar repositorio
- [ ] Instalar dependencias
- [ ] Verificar que backend está corriendo (`curl http://localhost:3000/health`)
- [ ] Verificar testing server (`http://localhost:5500`)
- [ ] Abrir devtools y consola del navegador

---

## 🔴 FASE 1: HALLAZGOS CRÍTICOS (Semana 1)

### CRÍTICO #1: URLs del Contrato de API
**Tiempo estimado:** 1 hora

- [ ] Copiar `api-contract.json` a carpeta de frontend
- [ ] Importar contrato en código principal
- [ ] Reemplazar `WS_URL` hardcoded con `apiContract.websocketURL.development`
- [ ] Reemplazar `API_BASE_URL` hardcoded con `apiContract.baseURL.development`
- [ ] Crear configuración de ambiente (dev/prod)
- [ ] Probar que funciona con backend real

**Código de referencia:** MANDATO 1, línea ~275

```javascript
import apiContract from './api-contract.json';

const CONFIG = {
  API_BASE_URL: apiContract.baseURL.development,
  WS_URL: apiContract.websocketURL.development
};
```

---

### CRÍTICO #2: Manejo de User ID
**Tiempo estimado:** 2 horas

- [ ] Crear función `getUserId()`
- [ ] Guardar/recuperar de localStorage
- [ ] Generar UUID si no existe
- [ ] Agregar a todos los headers de requests
- [ ] Probar que se envía correctamente

**Código de referencia:** MANDATO 2, línea ~300

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

### CRÍTICO #3: Headers Requeridos
**Tiempo estimado:** 1 hora

- [ ] Crear función helper para headers
- [ ] Agregar `Content-Type: application/json` a POST/PUT/PATCH
- [ ] Agregar `X-User-Id` a TODOS los requests
- [ ] Preparar para `Authorization` (futuro)
- [ ] Probar con devtools que se envían

**Código de referencia:** MANDATO 2, línea ~290

```javascript
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': getUserId()
  };
}
```

---

### CRÍTICO #4: Rate Limiting - Leer Headers
**Tiempo estimado:** 4 horas

- [ ] Leer `X-RateLimit-Limit` en cada response
- [ ] Leer `X-RateLimit-Remaining` en cada response
- [ ] Leer `X-RateLimit-Reset` en cada response
- [ ] Crear estado global para rate limit info
- [ ] Actualizar estado después de cada request
- [ ] Probar que los headers se leen correctamente

**Código de referencia:** MANDATO 3, línea ~320

```javascript
const rateLimitInfo = {
  limit: parseInt(response.headers.get('X-RateLimit-Limit')),
  remaining: parseInt(response.headers.get('X-RateLimit-Remaining')),
  resetAt: new Date(parseInt(response.headers.get('X-RateLimit-Reset')) * 1000)
};
```

---

### CRÍTICO #5: Rate Limiting - UI Visual
**Tiempo estimado:** 3 horas

- [ ] Crear componente/elemento de barra de rate limit
- [ ] Calcular porcentaje (remaining/limit)
- [ ] Actualizar ancho de barra después de cada request
- [ ] Cambiar color según nivel (verde/amarillo/rojo)
- [ ] Mostrar texto "X/Y requests remaining"
- [ ] Probar enviando múltiples mensajes

**Código de referencia:** MANDATO 3, línea ~350

```javascript
function updateRateLimitUI({ limit, remaining, resetAt }) {
  const percentage = (remaining / limit) * 100;
  document.getElementById('rate-limit-bar').style.width = `${percentage}%`;
  document.getElementById('rate-limit-text').textContent =
    `${remaining}/${limit} requests remaining`;
}
```

---

### CRÍTICO #6: Manejo de Error 429
**Tiempo estimado:** 2 horas

- [ ] Detectar status 429 en responses
- [ ] Leer header `Retry-After`
- [ ] Mostrar notificación al usuario
- [ ] Deshabilitar botón de envío
- [ ] Mostrar countdown en botón
- [ ] Auto-habilitar cuando expire tiempo
- [ ] Probar enviando >12 mensajes seguidos

**Código de referencia:** MANDATO 3, línea ~380

```javascript
if (response.status === 429) {
  const retryAfter = parseInt(response.headers.get('Retry-After'));
  showRateLimitError(retryAfter);
  disableSendButton(retryAfter);
}

function disableSendButton(seconds) {
  const btn = document.getElementById('send-btn');
  btn.disabled = true;

  const interval = setInterval(() => {
    seconds--;
    btn.textContent = `Wait ${seconds}s`;
    if (seconds <= 0) {
      btn.disabled = false;
      btn.textContent = 'Send';
      clearInterval(interval);
    }
  }, 1000);
}
```

---

## 🟠 FASE 2: WebSocket ROBUSTO (Semana 2)

### WebSocket Manager Base
**Tiempo estimado:** 4 horas

- [ ] Crear clase `WebSocketManager`
- [ ] Implementar método `connect()`
- [ ] Implementar método `disconnect()`
- [ ] Implementar método `send()`
- [ ] Implementar sistema de eventos (on/off/emit)
- [ ] Probar conexión básica

**Código de referencia:** MANDATO 4, línea ~445

---

### Auto-Reconexión
**Tiempo estimado:** 3 horas

- [ ] Implementar `attemptReconnect()`
- [ ] Configurar delay de reconexión (3s default)
- [ ] Configurar max intentos (10 default)
- [ ] Contador de intentos
- [ ] Limpiar timer al desconectar manualmente
- [ ] Probar desconectando servidor

**Código de referencia:** MANDATO 4, línea ~470

```javascript
attemptReconnect() {
  if (this.reconnectAttempts >= this.maxReconnectAttempts) {
    console.error('Max reconnect attempts reached');
    return;
  }

  this.reconnectAttempts++;
  setTimeout(() => this.connect(), this.reconnectDelay);
}
```

---

### Manejo de Mensajes WebSocket
**Tiempo estimado:** 4 horas

- [ ] Handler para `connection` (confirmación)
- [ ] Handler para `echo` (desarrollo)
- [ ] Handler para `message:new` (nuevo mensaje)
- [ ] Handler para `message:status` (cambio de estado)
- [ ] Handler para `typing:indicator` (escribiendo)
- [ ] Handler para `error` (errores del servidor)
- [ ] Handler para `message_processing` (evento control)
- [ ] Handler para `extension_response` (evento control)
- [ ] Probar cada tipo de mensaje

**Código de referencia:** MANDATO 4, línea ~490

---

### Rate Limiting en WebSocket
**Tiempo estimado:** 2 horas

- [ ] Detectar mensaje `type: 'error', code: 'RATE_LIMIT_EXCEEDED'`
- [ ] Leer `retryAfter` del error
- [ ] Mostrar notificación específica de WS
- [ ] Considerar deshabilitar envío vía WS temporalmente
- [ ] Probar enviando muchos mensajes por WS

**Código de referencia:** MANDATO 4, línea ~510

---

## 🟡 FASE 3: PERSISTENCIA (Semana 2-3)

### MessageStore - localStorage
**Tiempo estimado:** 4 horas

- [ ] Crear clase `MessageStore`
- [ ] Implementar `save(message)`
- [ ] Implementar `getAll()`
- [ ] Implementar `clear()`
- [ ] Limitar a 100 mensajes máximo
- [ ] Manejar errores de storage (cuota excedida)
- [ ] Probar guardando mensajes

**Código de referencia:** MANDATO 6, línea ~680

```javascript
class MessageStore {
  constructor() {
    this.storageKey = 'inhost-messages';
    this.maxMessages = 100;
  }

  save(message) {
    const messages = this.getAll();
    messages.unshift(message);
    if (messages.length > this.maxMessages) {
      messages.splice(this.maxMessages);
    }
    localStorage.setItem(this.storageKey, JSON.stringify(messages));
  }

  getAll() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return [];
    }
  }
}
```

---

### Guardar Mensajes al Recibir
**Tiempo estimado:** 2 horas

- [ ] Guardar cuando llega mensaje por WebSocket (`message:new`)
- [ ] Guardar cuando llega mensaje por HTTP
- [ ] Evitar duplicados (verificar por ID)
- [ ] Actualizar UI después de guardar
- [ ] Probar refrescando página (deben persistir)

---

### Carga Inicial desde localStorage
**Tiempo estimado:** 2 horas

- [ ] Cargar mensajes al iniciar app
- [ ] Renderizar mensajes en UI
- [ ] Mostrar placeholder si no hay mensajes
- [ ] Scroll to bottom después de cargar
- [ ] Probar con 0, 10, 100 mensajes

---

### Sincronización con Servidor
**Tiempo estimado:** 6 horas

- [ ] Implementar `syncWithServer()`
- [ ] Fetch GET /messages?limit=50
- [ ] Comparar IDs con mensajes locales
- [ ] Merge mensajes (evitar duplicados)
- [ ] Actualizar localStorage con servidor
- [ ] Llamar sync al iniciar app (background)
- [ ] Llamar sync al reconectar WebSocket
- [ ] Manejar errores de sync (usar cache local)

**Código de referencia:** MANDATO 6, línea ~740

---

## 🟢 FASE 4: MANEJO DE ERRORES (Semana 3)

### Clase APIError
**Tiempo estimado:** 2 horas

- [ ] Crear clase `APIError extends Error`
- [ ] Propiedades: `code`, `message`, `details`
- [ ] Usar en todo el código

**Código de referencia:** MANDATO 7, línea ~850

```javascript
class APIError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.details = details;
  }
}
```

---

### Función apiRequest() Universal
**Tiempo estimado:** 4 horas

- [ ] Crear función `apiRequest(endpoint, options)`
- [ ] Agregar headers automáticamente
- [ ] Leer rate limit headers
- [ ] Detectar errores HTTP (400, 429, 500)
- [ ] Lanzar `APIError` apropiado
- [ ] Manejar errores de red
- [ ] Usar en todo el código

**Código de referencia:** MANDATO 7, línea ~870

---

### Retry con Exponential Backoff
**Tiempo estimado:** 3 horas

- [ ] Implementar `retryWithBackoff(fn, maxRetries, baseDelay)`
- [ ] Exponential backoff (1s, 2s, 4s, 8s...)
- [ ] Log de intentos
- [ ] Aplicar solo a errores de red (no 400, 429)
- [ ] Probar con servidor apagado

**Código de referencia:** MANDATO 7, línea ~920

```javascript
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Retry ${attempt + 1} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

### UI de Errores
**Tiempo estimado:** 3 horas

- [ ] Crear componente de notificación/toast
- [ ] Mostrar errores de validación (400)
- [ ] Mostrar errores de rate limit (429)
- [ ] Mostrar errores de red
- [ ] Auto-cerrar después de 5s
- [ ] Permitir cerrar manualmente
- [ ] Probar cada tipo de error

---

### Timeout Protection
**Tiempo estimado:** 2 horas

- [ ] Implementar `fetchWithTimeout()`
- [ ] Usar `AbortController`
- [ ] Timeout default: 10 segundos
- [ ] Lanzar error específico de timeout
- [ ] Aplicar a todos los requests
- [ ] Probar con servidor lento

**Código de referencia:** QUICK-REFERENCE.md, sección "Snippets"

---

## 🔵 FASE 5: INTEGRACIÓN COMPLETA (Semana 3-4)

### Conectar con Endpoints Reales
**Tiempo estimado:** 1 día

- [ ] Reemplazar mock de clientes
- [ ] Usar `GET /simulate/status` para obtener estado
- [ ] Renderizar clientes desde backend
- [ ] Usar `POST /simulate/client-toggle` para conectar/desconectar
- [ ] Reemplazar mock de extensiones
- [ ] Usar `POST /simulate/extension-toggle`
- [ ] Probar activando/desactivando extensiones

**Endpoints:**
- GET /simulate/status
- POST /simulate/client-toggle
- POST /simulate/extension-toggle

---

### Validación de Input
**Tiempo estimado:** 3 horas

- [ ] Validar texto no vacío
- [ ] Validar longitud máxima (16KB)
- [ ] Detectar caracteres peligrosos (opcional)
- [ ] Mostrar errores en UI (inline)
- [ ] Deshabilitar envío si inválido
- [ ] Contador de caracteres en UI

**Código de referencia:** MANDATO 5, línea ~640

---

### Sanitización XSS
**Tiempo estimado:** 2 horas

- [ ] Implementar `escapeHtml()`
- [ ] Aplicar antes de renderizar en innerHTML
- [ ] Aplicar en atributos HTML
- [ ] Probar con input malicioso (`<script>alert('XSS')</script>`)

**Código de referencia:** MANDATO 5, línea ~620

```javascript
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

---

### Typing Indicators
**Tiempo estimado:** 3 horas

- [ ] Enviar `typing: true` al escribir
- [ ] Timer de 3s de inactividad
- [ ] Enviar `typing: false` después de 3s
- [ ] Escuchar `typing:indicator` de WebSocket
- [ ] Mostrar "Usuario está escribiendo..." en UI
- [ ] Ocultar después de recibir `typing: false`

**Código de referencia:** Flujo 3, línea ~1050

---

### Notificaciones del Sistema
**Tiempo estimado:** 2 horas

- [ ] Pedir permiso de notificaciones (`Notification.requestPermission()`)
- [ ] Detectar cuando tab está en background (`document.hidden`)
- [ ] Mostrar notificación al recibir mensaje
- [ ] Sonido de notificación (opcional)
- [ ] Probar minimizando ventana

---

## ⚡ FASE 6: OPTIMIZACIÓN (Semana 4)

### Performance
**Tiempo estimado:** 1 día

- [ ] Implementar `debounce()` para inputs de búsqueda
- [ ] Implementar `throttle()` para scroll events
- [ ] Usar `requestAnimationFrame()` para animaciones
- [ ] Virtual scrolling para listas largas (>100 mensajes)
- [ ] Lazy loading de imágenes
- [ ] Probar con 1000+ mensajes

**Código de referencia:** MANDATO 8, línea ~950

---

### Accesibilidad Básica
**Tiempo estimado:** 4 horas

- [ ] ARIA labels en botones
- [ ] ARIA labels en inputs
- [ ] role="log" en área de mensajes
- [ ] Keyboard navigation (Enter para enviar)
- [ ] Focus visible en elementos
- [ ] Probar con screen reader

---

### Responsive Design
**Tiempo estimado:** 4 horas

- [ ] Mobile (< 768px)
- [ ] Tablet (768px - 1024px)
- [ ] Desktop (> 1024px)
- [ ] Touch events para móvil
- [ ] Probar en dispositivos reales

---

## ✅ FASE 7: TESTING Y VALIDACIÓN (Semana 4)

### Testing Manual
- [ ] Enviar mensaje y recibir respuesta
- [ ] Listar mensajes históricos
- [ ] WebSocket conecta y reconecta
- [ ] Rate limiting funciona (enviar >12 mensajes)
- [ ] Mensajes persisten al refrescar
- [ ] Typing indicators funcionan
- [ ] Activar/desactivar extensiones
- [ ] Manejo de errores (400, 429, 500)
- [ ] Retry logic (apagar servidor)
- [ ] Timeout protection
- [ ] Validación de inputs
- [ ] Sanitización XSS
- [ ] Responsive en móvil/tablet

---

### Testing E2E (Opcional)
- [ ] Configurar Playwright/Cypress
- [ ] Test: Enviar mensaje
- [ ] Test: Rate limiting
- [ ] Test: WebSocket reconexión
- [ ] Test: Persistencia
- [ ] Test: Manejo de errores
- [ ] CI/CD integration

---

### Performance Testing
- [ ] Lighthouse score > 90
- [ ] Tiempo de carga < 3s
- [ ] First Contentful Paint < 1s
- [ ] Time to Interactive < 3s
- [ ] No memory leaks en WebSocket

---

### Security Review
- [ ] No XSS vulnerabilities
- [ ] No secrets en código
- [ ] Headers correctos (Content-Type, X-User-Id)
- [ ] Input validado en cliente Y servidor
- [ ] HTTPS en producción
- [ ] WSS en producción

---

## 🎯 CHECKLIST FINAL

### Antes de Marcar como "Hecho"
- [ ] Todas las URLs vienen de `api-contract.json`
- [ ] Headers requeridos en todos los requests
- [ ] Rate limiting visible con barra de progreso
- [ ] Error 429 manejado correctamente
- [ ] WebSocket con auto-reconexión robusta
- [ ] Mensajes persisten en localStorage
- [ ] Sincronización con servidor funciona
- [ ] Manejo de errores completo (400, 429, 500, network)
- [ ] Retry logic implementado
- [ ] Validación de inputs antes de enviar
- [ ] Sanitización XSS en todo contenido
- [ ] Typing indicators funcionan
- [ ] Todos los endpoints usan backend real (no mocks)
- [ ] Notificaciones del sistema (opcional)
- [ ] Responsive design
- [ ] Accesibilidad básica
- [ ] Tests E2E (opcional)
- [ ] Performance optimizada
- [ ] Security review pasado
- [ ] Documentación actualizada

---

### Deployment
- [ ] Variables de ambiente configuradas (dev/prod)
- [ ] Build de producción funciona
- [ ] URLs de producción en `api-contract.json`
- [ ] HTTPS habilitado
- [ ] WSS habilitado
- [ ] CORS configurado correctamente
- [ ] Monitoreo de errores (Sentry, etc.)
- [ ] Analytics (opcional)

---

## 📊 PROGRESO

**Fases Completadas:** 0/7

- [ ] Fase 0: Preparación
- [ ] Fase 1: Hallazgos Críticos
- [ ] Fase 2: WebSocket Robusto
- [ ] Fase 3: Persistencia
- [ ] Fase 4: Manejo de Errores
- [ ] Fase 5: Integración Completa
- [ ] Fase 6: Optimización
- [ ] Fase 7: Testing y Validación

**Estimación Total:** 2-3 semanas (1 desarrollador)

**Fast-Track (solo críticos):** 1 semana

---

**¡Éxito con la implementación!**

Actualiza este archivo a medida que avanzas y compártelo con tu equipo para trackear progreso.
