# Guía de Pruebas Manuales - Sprint 1

**Fecha:** 2025-11-14
**Sprint:** 1 - Modularización
**Objetivo:** Verificar que todos los módulos funcionan correctamente

---

## 🎯 Objetivos de las Pruebas

1. Verificar que los servicios se inicializan correctamente
2. Probar cada adaptador (WhatsApp, Telegram, SMS)
3. Verificar rate limiting
4. Verificar validación de mensajes
5. Verificar cola de mensajes
6. Documentar cualquier problema encontrado

---

## ✅ Pre-requisitos

1. **Servidor corriendo:**
   ```bash
   cd c:\Users\harva\Documents\Trabajos\meetgar\inhost
   bun --cwd apps/api-gateway dev
   ```

2. **Verificar logs de inicialización:**
   Deberías ver en la consola:
   ```
   🔧 Initializing services...
   ℹ️ Adapter registered: whatsapp-simulator
   ℹ️ Adapter registered: telegram-simulator
   ℹ️ Adapter registered: sms-simulator
   ✅ Services initialized successfully
   🏥 Adapters health check:
     - whatsapp: true
     - telegram: true
     - sms: true
   🦊 Inhost API Gateway is running on port 3000
   ```

   ⚠️ **Si NO ves estos logs, HAY UN PROBLEMA - reportar aquí**

3. **Herramientas necesarias:**
   - Navegador (para abrir test-chat-flow.html)
   - Terminal (para curl/http requests)
   - O Postman/Insomnia (opcional)

---

## 📝 Pruebas a Realizar

### Prueba 1: Health Check del Sistema

**Objetivo:** Verificar que el API Gateway responde

**Comando:**
```bash
curl http://localhost:3000/health
```

**Resultado esperado:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-14T...",
  "database": {
    "status": "disconnected"  // Esperado, no tenemos PostgreSQL corriendo
  }
}
```

**Logs esperados en servidor:**
```
ℹ️ [INFO] Health check requested
🔍 [DEBUG] Checking database connection
⚠️ [WARN] Database connection failed (expected)
```

**✅ PASS si:** Responde con status 200 y JSON válido
**❌ FAIL si:** Error 500 o no responde

---

### Prueba 2: Inicialización de Servicios

**Objetivo:** Verificar que todos los servicios están disponibles

**Qué buscar en los logs del servidor:**

1. **AdapterManager inicializado:**
   ```
   ℹ️ Adapter registered: whatsapp-simulator
   ℹ️ Adapter registered: telegram-simulator
   ℹ️ Adapter registered: sms-simulator
   ```

2. **Health checks pasaron:**
   ```
   🏥 Adapters health check:
     - whatsapp: true
     - telegram: true
     - sms: true
   ```

3. **RateLimiter iniciado:**
   ```
   ℹ️ Rate limiter cleanup started
   ```

4. **MessageQueue iniciado:**
   ```
   ℹ️ Queue auto-reset started (every 24h)
   ```

**✅ PASS si:** Todos los logs aparecen
**❌ FAIL si:** Falta algún log o hay errores

**📋 REPORTAR:** Si falla, copiar los logs completos

---

### Prueba 3: Simulación de Cliente WhatsApp

**Objetivo:** Verificar que el adaptador de WhatsApp funciona

**Paso 1:** Abrir en navegador
```
file:///c:/Users/harva/Documents/Trabajos/meetgar/inhost/test-chat-flow.html
```

**Paso 2:** En la sección "CLIENTES" (derecha), hacer clic en:
- Botón "Connect" del cliente WhatsApp

**Logs esperados en servidor:**
```
ℹ️ [INFO] Adapter WhatsApp simulator initialized
🔍 [DEBUG] Adapter whatsapp-simulator starting
ℹ️ [INFO] Adapter whatsapp-simulator started successfully
```

**Paso 3:** Escribir mensaje en WhatsApp y enviar: "Hola desde WhatsApp"

**Logs esperados:**
```
ℹ️ [INFO] Simulating client message
🔍 [DEBUG] Message from whatsapp-simulator
ℹ️ [INFO] Message created via simulator
📱 [INFO] WhatsApp message: "Hola desde WhatsApp"
```

**Paso 4:** Verificar en el Chat Central
- El mensaje debe aparecer en el centro
- Debe mostrar "📱 WhatsApp" como origen
- Debe tener timestamp

**✅ PASS si:**
- Mensaje aparece en chat central
- Logs muestran el flujo completo
- Sin errores

**❌ FAIL si:**
- Mensaje no aparece
- Hay errores en consola
- Logs incompletos

**📋 REPORTAR:** Captura de pantalla del chat + logs de la consola del servidor

---

### Prueba 4: Simulación de Cliente Telegram

**Objetivo:** Verificar adaptador de Telegram

**Pasos:**
1. Click "Connect" en cliente Telegram
2. Enviar mensaje: "Hola desde Telegram"

**Logs esperados:**
```
ℹ️ [INFO] Adapter Telegram simulator initialized
💬 [INFO] Telegram message: "Hola desde Telegram"
```

**Verificar:**
- Mensaje aparece con ícono 💬
- Latencia simulada ~80ms
- Sin errores

**✅ PASS / ❌ FAIL:** Igual que Prueba 3

---

### Prueba 5: Simulación de Cliente SMS

**Objetivo:** Verificar adaptador SMS con límite de 160 caracteres

**Pasos:**
1. Click "Connect" en cliente SMS
2. Enviar mensaje corto: "SMS test"
3. Enviar mensaje largo (>160 chars): "Este es un mensaje muy largo que excede los 160 caracteres permitidos en SMS. Los SMS tradicionales tienen un límite de 160 caracteres y este mensaje claramente lo excede para probar la funcionalidad."

**Logs esperados para mensaje largo:**
```
📨 [INFO] SMS message (truncated): "Este es un mensaje muy largo que excede los 160 caracteres permitidos en SMS. Los SMS tradicionales tienen un límite de 160 cara..."
⚠️ [WARN] SMS message truncated to 160 characters
```

**Verificar:**
- Mensaje corto pasa sin problemas
- Mensaje largo se trunca a 160 caracteres
- Log de advertencia aparece

**✅ PASS si:** Truncamiento funciona correctamente
**❌ FAIL si:** Mensaje largo pasa completo sin truncar

**📋 REPORTAR:** Logs mostrando el truncamiento

---

### Prueba 6: Rate Limiting

**Objetivo:** Verificar que el rate limiter funciona

**Preparación:** Abrir la consola del navegador (F12)

**Pasos:**
1. Desde el navegador, ejecutar en la consola:

```javascript
// Enviar 15 mensajes rápidamente (límite free es 12/min)
for(let i = 0; i < 15; i++) {
  fetch('http://localhost:3000/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId: null,
      type: 'incoming',
      channel: 'web',
      content: { text: `Test rate limit ${i}` },
      metadata: {
        from: 'test-user',
        to: 'inhost',
        timestamp: new Date().toISOString()
      }
    })
  }).then(r => r.json()).then(console.log);
}
```

**Logs esperados en servidor:**
```
ℹ️ [INFO] Checking rate limit for user: test-user
🔍 [DEBUG] Rate limit: 0/12 remaining
🔍 [DEBUG] Rate limit: 1/12 remaining
...
🔍 [DEBUG] Rate limit: 11/12 remaining
⚠️ [WARN] Rate limit exceeded for user: test-user
❌ [ERROR] Rate limit blocked request
```

**Verificar en consola del navegador:**
- Primeros 12 requests: Status 200/201
- Siguientes 3 requests: Status 429 (Too Many Requests)

**✅ PASS si:**
- Primeros 12 pasan
- Del 13 en adelante son bloqueados
- Logs muestran el conteo

**❌ FAIL si:**
- Todos los 15 pasan (rate limiting no funciona)
- Se bloquean antes del 12

**📋 REPORTAR:** Logs del servidor + respuestas en consola del navegador

---

### Prueba 7: Validación de Mensajes

**Objetivo:** Verificar que el validador rechaza mensajes inválidos

#### Prueba 7a: Mensaje sin campo requerido (id)

**Comando:**
```bash
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -d '{
    "type": "incoming",
    "channel": "web",
    "content": { "text": "Test" }
  }'
```

**Resultado esperado:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Required field 'id' is missing or empty"
  }
}
```

**Logs esperados:**
```
⚠️ [WARN] Message validation failed
🔍 [DEBUG] Validation errors: REQUIRED_FIELD_MISSING (id)
```

**✅ PASS si:** Request rechazado con error de validación
**❌ FAIL si:** Mensaje se acepta sin validar

#### Prueba 7b: Texto muy largo (>16KB)

**Crear archivo:** `test-long-message.json`
```json
{
  "id": "test-long-msg",
  "type": "incoming",
  "channel": "web",
  "content": {
    "text": "A....(repetir hasta >16384 caracteres)...Z"
  },
  "metadata": {
    "from": "test",
    "to": "inhost",
    "timestamp": "2025-11-14T10:00:00Z"
  }
}
```

**Comando:**
```bash
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -d @test-long-message.json
```

**Logs esperados:**
```
⚠️ [WARN] Message validation failed
🔍 [DEBUG] Validation error: TEXT_TOO_LONG (16500 > 16384)
```

**✅ PASS si:** Mensaje rechazado por tamaño
**❌ FAIL si:** Mensaje muy largo se acepta

**📋 REPORTAR:** Log mostrando el tamaño exacto rechazado

---

### Prueba 8: Message Queue

**Objetivo:** Verificar que la cola de mensajes funciona

**Nota:** Esta prueba requiere acceso programático. Vamos a verificar con logs.

**Verificar en logs de inicio:**
```
ℹ️ [INFO] Queue configured
ℹ️ [INFO] Queue auto-reset started (every 24h)
```

**Durante las pruebas anteriores, buscar:**
```
🔍 [DEBUG] Message enqueued
🔍 [DEBUG] Queue size: 1
🔍 [DEBUG] Message dequeued
```

**✅ PASS si:** Logs de queue aparecen durante procesamiento
**❌ FAIL si:** No hay logs de queue

**📋 REPORTAR:** Logs mostrando enqueue/dequeue

---

## 📊 Formato de Reporte de Pruebas

Cuando termines las pruebas, dame un reporte así:

```
## Resultados de Pruebas - Sprint 1

### Prueba 1: Health Check
✅ PASS - Responde correctamente

### Prueba 2: Inicialización de Servicios
✅ PASS - Todos los servicios iniciados

### Prueba 3: Cliente WhatsApp
✅ PASS - Mensajes funcionan
[Captura/Logs si hay problemas]

### Prueba 4: Cliente Telegram
✅ PASS / ❌ FAIL - [Descripción]

### Prueba 5: Cliente SMS
✅ PASS - Truncamiento funciona

### Prueba 6: Rate Limiting
❌ FAIL - No bloqueó después del request 12
[Logs adjuntos]

### Prueba 7: Validación
✅ PASS - Rechaza mensajes inválidos

### Prueba 8: Message Queue
✅ PASS - Logs de queue visibles

## Problemas Encontrados
1. [Descripción del problema 1]
   - Logs: [pegar logs relevantes]
   - Captura: [si aplica]

2. [Descripción del problema 2]
   ...

## Observaciones Generales
- [Cualquier cosa que notaste]
```

---

## 🔍 Cómo Interpretar los Logs

### Niveles de Log:

1. **DEBUG (🔍)** - Información detallada de flujo
   - Útil para entender qué está pasando internamente
   - Ejemplo: `🔍 [DEBUG] Rate limit: 5/12 remaining`

2. **INFO (ℹ️)** - Eventos importantes normales
   - Confirmación de operaciones exitosas
   - Ejemplo: `ℹ️ [INFO] Adapter registered: whatsapp-simulator`

3. **WARN (⚠️)** - Advertencias (no son errores fatales)
   - Cosas que funcionan pero pueden ser problemáticas
   - Ejemplo: `⚠️ [WARN] Rate limit exceeded`

4. **ERROR (❌)** - Errores que deben investigarse
   - Algo falló y necesita atención
   - Ejemplo: `❌ [ERROR] Adapter failed to send message`

### Patrones de Logs Normales:

**Inicio del servidor:**
```
🔧 Initializing services...
ℹ️ Adapter registered...
✅ Services initialized successfully
🦊 Inhost API Gateway is running
```

**Mensaje entrante:**
```
ℹ️ Simulating client message
🔍 Message from [adapter]
ℹ️ Message created via simulator
```

**Rate limiting (normal):**
```
ℹ️ Checking rate limit for user: X
🔍 Rate limit: N/12 remaining
```

**Rate limiting (bloqueado):**
```
⚠️ Rate limit exceeded for user: X
❌ Rate limit blocked request
```

---

## ⚠️ Problemas Comunes

### Problema 1: No veo logs de inicialización

**Síntoma:** El servidor arranca pero no veo logs de servicios

**Causa probable:** `initializeServices()` no se está llamando

**Verificar:**
```typescript
// En apps/api-gateway/src/index.ts debe estar:
await initializeServices();
```

**Reportar:** Copiar el contenido de `src/index.ts` líneas 30-40

---

### Problema 2: Cliente no se conecta en la UI

**Síntoma:** Click en "Connect" pero nada pasa

**Verificar:**
1. Abrir consola del navegador (F12)
2. Buscar errores JavaScript
3. Verificar que WebSocket se conectó:
   ```
   WebSocket connected
   ```

**Reportar:** Errores de la consola del navegador

---

### Problema 3: Mensajes no aparecen en chat

**Síntoma:** Envío mensaje pero no aparece en chat central

**Verificar:**
1. Logs del servidor - ¿llegó el mensaje?
2. Consola del navegador - ¿hay errores?
3. WebSocket - ¿está conectado?

**Reportar:** Logs del servidor + consola del navegador

---

## 📞 Siguiente Paso

Una vez completadas las pruebas, dame el reporte y:

1. Si **TODO PASA (✅):**
   - Podemos continuar con Sprint 2 (Protección)
   - O escribir tests automatizados

2. Si **HAY FALLOS (❌):**
   - Los arreglamos antes de continuar
   - Con tus logs podré debuggear rápido

---

## 💡 Tips

1. **Haz las pruebas en orden** - Algunas dependen de otras
2. **No cierres el servidor** - Déjalo corriendo durante todas las pruebas
3. **Copia los logs** - Antes de que se scrolleen fuera de vista
4. **Prueba en navegador incógnito** - Si algo raro pasa, para evitar caché
5. **Un problema a la vez** - Si encuentras un error, repórtalo antes de continuar

---

## ⏱️ Tiempo Estimado

- Pruebas 1-2: 5 minutos
- Pruebas 3-5: 10 minutos
- Prueba 6: 5 minutos
- Prueba 7: 10 minutos
- Prueba 8: 5 minutos
- Documentar: 10 minutos

**Total: ~45 minutos**

¡Suerte con las pruebas! 🚀
