# Scripts de Testing - INHOST

## 📋 Contenido

### `test-whatsapp-flow.ts`

Script completo de simulación del flujo de WhatsApp que prueba:
- ✅ Conexión WebSocket en tiempo real
- ✅ Activación de extensiones (echo, ai, crm)
- ✅ Envío de mensaje desde WhatsApp
- ✅ Recepción de notificaciones
- ✅ Respuestas de extensiones
- ✅ Persistencia en PostgreSQL
- ✅ Cambios de estado de mensajes

---

## 🚀 Uso

### Prerrequisitos

1. **Servidor API corriendo:**
   ```bash
   # Terminal 1
   bun --cwd apps/api-gateway dev
   ```

2. **PostgreSQL corriendo:**
   ```bash
   docker-compose up -d
   ```

### Ejecutar Test Completo

```bash
# Desde la raíz del proyecto
bun scripts/test-whatsapp-flow.ts
```

---

## 📊 Output Esperado

### Éxito ✅

```
🚀 INICIANDO SIMULACIÓN DE WHATSAPP
Simulando flujo completo: envío → procesamiento → respuestas → notificaciones

📍 PASO 1: Conectar WebSocket
[10:30:15.123] ℹ️  Conectando al WebSocket...
[10:30:15.456] ✅ WebSocket conectado exitosamente
[10:30:15.789] 📡 Conexión establecida

📍 PASO 2: Obtener estado del sistema
[10:30:16.012] ℹ️  Obteniendo estado del sistema...
[10:30:16.234] ✅ Estado del sistema obtenido

📍 PASO 3: Activar extensiones
[10:30:16.456] ℹ️  Activando extensión: echo
[10:30:16.678] ✅ Extensión echo → ACTIVA
[10:30:16.901] ℹ️  Activando extensión: ai
[10:30:17.123] ✅ Extensión ai → ACTIVA
[10:30:17.345] ℹ️  Activando extensión: crm
[10:30:17.567] ✅ Extensión crm → ACTIVA

📍 PASO 4: Enviar mensaje de WhatsApp
[10:30:18.789] ℹ️  Enviando mensaje de WhatsApp: "Hola! Necesito ayuda..."
[10:30:19.012] ✅ Mensaje enviado exitosamente
[10:30:19.234] 💬 Nuevo mensaje: incoming
[10:30:19.456] 📡 Procesamiento iniciado
[10:30:19.678] 💬 Nuevo mensaje: outgoing (from echo-bot)
[10:30:19.901] 💬 Nuevo mensaje: outgoing (from ai-bot)
[10:30:20.123] 💬 Nuevo mensaje: outgoing (from crm-bot)

📍 PASO 5: Esperando respuestas de extensiones...
[10:30:22.345] 📡 Cambio de estado: messageId=xxx, status=sent

📍 PASO 6: Verificar estado final
[10:30:23.567] ✅ Estado del sistema obtenido

============================================================
📊 RESUMEN DE LA SIMULACIÓN
============================================================

Estado de la Prueba:
  WebSocket Conectado: ✓
  Mensaje Enviado: ✓
  Mensaje Recibido: ✓
  Respuestas de Extensiones: 3 (echo, ai, crm)

Notificaciones Recibidas:
  connection: 1
  message:new: 4
  message_processing: 1
  extension_response: 3
  message:status: 3

Resultado Final:
  ✅ PRUEBA EXITOSA
  Todos los componentes funcionan correctamente

============================================================
```

### Fallo ❌

Si algo falla, verás errores como:

```
[10:30:15.123] ❌ Error en WebSocket
{
  "error": "ECONNREFUSED"
}

============================================================
Estado de la Prueba:
  WebSocket Conectado: ✗
  Mensaje Enviado: ✗

Errores:
  • WebSocket connection error
  • Failed to send message

Resultado Final:
  ❌ PRUEBA FALLIDA
  Revisa los errores arriba
============================================================
```

---

## 🔍 Qué Verifica el Script

### 1. Conexión WebSocket
- ✅ Conecta a `ws://localhost:3000/realtime`
- ✅ Recibe mensaje de bienvenida con `clientId`
- ✅ Mantiene conexión abierta durante test

### 2. Estado del Sistema
- ✅ GET `/simulate/status`
- ✅ Lista de extensiones disponibles
- ✅ Estado de clientes conectados

### 3. Activación de Extensiones
- ✅ POST `/simulate/extension-toggle` para `echo`
- ✅ POST `/simulate/extension-toggle` para `ai`
- ✅ POST `/simulate/extension-toggle` para `crm`
- ✅ Recibe notificaciones WebSocket de activación

### 4. Envío de Mensaje
- ✅ POST `/simulate/client-message` con `clientId: "whatsapp"`
- ✅ Verifica respuesta con `persisted: true`
- ✅ Verifica que extensiones procesaron el mensaje

### 5. Notificaciones WebSocket
- ✅ `connection` - Conexión establecida
- ✅ `message:new` - Mensaje entrante (incoming)
- ✅ `message_processing` - Procesamiento iniciado
- ✅ `message:new` - Respuestas de extensiones (outgoing x3)
- ✅ `extension_response` - Control de extensiones
- ✅ `message:status` - Cambios de estado

### 6. Persistencia
- ✅ Mensaje original guardado en PostgreSQL
- ✅ Respuestas de extensiones guardadas en PostgreSQL
- ✅ Cadena de estados (statusChain) actualizada

---

## 🐛 Troubleshooting

### Error: "ECONNREFUSED"

**Causa:** El servidor no está corriendo.

**Solución:**
```bash
bun --cwd apps/api-gateway dev
```

### Error: "WebSocket connection timeout"

**Causa:** El servidor no responde en 5 segundos.

**Solución:**
- Verificar que el puerto 3000 esté libre
- Verificar logs del servidor

### Error: "Failed to send message"

**Causa:** Endpoint `/simulate/client-message` falla.

**Solución:**
- Verificar que PostgreSQL esté corriendo
- Verificar logs del servidor para errores de persistencia

### Extensiones no responden

**Causa:** Extensiones no están activas o hubo error en procesamiento.

**Solución:**
- Verificar que el script activó las extensiones correctamente
- Revisar logs del servidor para errores en `processMessageThroughExtensions`

### No se reciben notificaciones WebSocket

**Causa:** WebSocketNotification no está funcionando.

**Solución:**
- Verificar que `messageCore` esté usando `notifications.broadcast()`
- Revisar logs del servidor para errores en broadcast

---

## 📝 Logs del Servidor

Mientras el script corre, en el servidor deberías ver:

```
🔧 Initializing services...
✅ Services initialized successfully
🔌 WebSocket client connected
🎬 Simulating client message
✅ Message received through MessageCore
💾 Message persisted
📢 Message broadcasted
🔄 Extensions processed
✅ Extension response sent through MessageCore
```

---

## 🔄 Variaciones del Test

### Test Solo WebSocket

```typescript
// Modificar main() para solo probar WebSocket
async function main() {
  const ws = await connectWebSocket();
  await wait(10000); // Esperar 10 segundos
  ws.close();
}
```

### Test Sin Extensiones

```typescript
// Comentar paso 3 en main()
// console.log('\n📍 PASO 3: Activar extensiones');
// await toggleExtension('echo');
// ...
```

### Test Mensaje Largo

```typescript
// Modificar el texto del mensaje
await sendWhatsAppMessage('Hola! '.repeat(100)); // Mensaje muy largo
```

### Test Rate Limiting

```typescript
// Enviar 15 mensajes rápidos
for (let i = 0; i < 15; i++) {
  await sendWhatsAppMessage(`Mensaje ${i + 1}`);
}
// Debería fallar después del mensaje 12 (rate limit free plan)
```

---

## 🎯 Casos de Uso

### 1. Verificar Integración Completa

Después de modificar `simulation.ts` o `MessageCore`, ejecutar este script para verificar que todo sigue funcionando.

### 2. Debugging

Si algo no funciona en producción, este script ayuda a:
- Ver exactamente qué mensajes WebSocket se envían
- Verificar que la persistencia funciona
- Detectar qué extensión falla

### 3. Demo para Clientes

Mostrar el flujo completo funcionando en tiempo real con logs coloridos.

### 4. CI/CD Integration

Agregar este script a tu pipeline de CI/CD para tests automáticos:

```yaml
# .github/workflows/test.yml
- name: Run integration tests
  run: bun scripts/test-whatsapp-flow.ts
```

---

## 📚 Recursos Relacionados

- **Guía de Integración Chat:** `docs/guides/chat-integration.md`
- **Rutas de Simulación:** `apps/api-gateway/src/routes/simulation.ts`
- **MessageCore:** `apps/api-gateway/src/core/MessageCore.ts`
- **WebSocket Routes:** `apps/api-gateway/src/routes/websocket.ts`

---

## 🚀 Próximos Scripts

### `test-rate-limiting.ts` (Pendiente)
Probar límites de rate limiting con múltiples mensajes.

### `test-persistence.ts` (Pendiente)
Verificar que los mensajes se guardan correctamente en PostgreSQL.

### `test-websocket-reconnect.ts` (Pendiente)
Probar reconexión automática del WebSocket.

---

**Creado:** 2025-11-18
**Autor:** Claude Code
**Versión:** 1.0
