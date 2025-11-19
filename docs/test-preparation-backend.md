# 📋 Preparación del Backend para Test E2E con Logs Completos

## 🎯 Flujo Completo a Probar

```
1. 📱 Chat Simulado (WhatsApp)
   ↓
2. 🔌 Adapter recibe y traduce a MessageEnvelope
   ↓
3. 📦 MessageCore.receive() - Orquestador
   ↓
4. 💾 Persistence Service - Guarda en PostgreSQL
   ↓
5. 📢 Notification Service - Notifica via WebSocket
   ↓
6. 🌐 Frontend consulta mensajes
```

---

## ✅ Lo que YA tiene el Backend

### 1. MessageCore (Orquestador) - `apps/api-gateway/src/core/MessageCore.ts`
**Logs existentes:**
- ✅ `📥 MessageCore: Receiving message` - Al recibir
- ✅ `💾 Message persisted` - Después de persistir
- ✅ `📢 Message broadcasted` - Después de notificar

**Estado:** ⚠️ NECESITA MÁS LOGS

### 2. SimulatedWhatsAppAdapter - `apps/api-gateway/src/adapters/simulators/SimulatedWhatsAppAdapter.ts`
**Logs existentes:**
- ❌ NO TIENE LOGS

**Estado:** ⚠️ NECESITA LOGS

### 3. Persistence Service - `apps/api-gateway/src/implementations/v1/MemoryPersistence.ts`
**Logs existentes:**
- ❌ NO TIENE LOGS

**Estado:** ⚠️ NECESITA LOGS

### 4. Notification Service (WebSocket) - `apps/api-gateway/src/implementations/v1/WebSocketNotification.ts`
**Logs existentes:**
- ✅ `🔌 WebSocketNotification: Connection registered`
- ✅ `👤 Owner marked online`

**Estado:** ⚠️ NECESITA MÁS LOGS (especialmente al enviar mensaje)

---

## 📝 Lo que NECESITA el Backend

### 1. **SimulatedWhatsAppAdapter - Agregar Logs Detallados**

**Archivo:** `apps/api-gateway/src/adapters/simulators/SimulatedWhatsAppAdapter.ts`

**Logs a agregar:**

```typescript
// En createIncomingMessage():
console.log('📱 [WhatsApp Adapter] Mensaje recibido del chat simulado');
console.log('   From:', from);
console.log('   Text:', text);
console.log('   Traduciendo a MessageEnvelope...');

// Después de crear envelope:
console.log('✅ [WhatsApp Adapter] Mensaje traducido a MessageEnvelope');
console.log('   ID:', envelope.id);
console.log('   Type:', envelope.type);
console.log('   Channel:', envelope.channel);
console.log('   Status:', envelope.statusChain[0].status);
```

---

### 2. **MessageCore - Agregar Logs Más Detallados**

**Archivo:** `apps/api-gateway/src/core/MessageCore.ts`

**Logs a agregar en `receive()`:**

```typescript
async receive(envelope: MessageEnvelope): Promise<void> {
  console.log('');
  console.log('═'.repeat(60));
  console.log('📦 [MessageCore] INICIO - Procesando mensaje');
  console.log('═'.repeat(60));
  console.log('   ID:', envelope.id);
  console.log('   Type:', envelope.type);
  console.log('   Channel:', envelope.channel);
  console.log('   From:', envelope.metadata?.from);
  console.log('   Text:', envelope.content?.text);
  console.log('');

  try {
    // PASO 1: Persistencia
    if (this.config.enablePersistence) {
      console.log('💾 [MessageCore] PASO 1: Iniciando persistencia...');
      await this.persistence.save(envelope);
      console.log('✅ [MessageCore] PASO 1: Mensaje persistido en PostgreSQL');
      console.log('');
    }

    // PASO 2: Notificación
    if (this.config.enableNotifications) {
      console.log('📢 [MessageCore] PASO 2: Iniciando notificación...');
      await this.notifications.broadcast(envelope);
      console.log('✅ [MessageCore] PASO 2: Mensaje enviado via WebSocket');
      console.log('');
    }

    console.log('═'.repeat(60));
    console.log('✅ [MessageCore] FIN - Mensaje procesado exitosamente');
    console.log('═'.repeat(60));
    console.log('');
  } catch (error) {
    console.error('');
    console.error('═'.repeat(60));
    console.error('❌ [MessageCore] ERROR - Fallo al procesar mensaje');
    console.error('═'.repeat(60));
    console.error('   Error:', error);
    console.error('');
    throw error;
  }
}
```

---

### 3. **DatabasePersistence - Agregar Logs en Operaciones de BD**

**Archivo:** `apps/api-gateway/src/implementations/v2/DatabasePersistence.ts`

**Logs a agregar en `save()`:**

```typescript
async save(envelope: MessageEnvelope): Promise<void> {
  console.log('💾 [PostgreSQL] Guardando mensaje en base de datos...');
  console.log('   Message ID:', envelope.id);
  console.log('   Type:', envelope.type);

  try {
    const result = await db.insert(messages).values({
      id: envelope.id,
      // ... rest of values
    }).returning();

    console.log('✅ [PostgreSQL] Mensaje guardado exitosamente');
    console.log('   DB Record ID:', result[0].id);
    console.log('   Created At:', result[0].createdAt);
  } catch (error) {
    console.error('❌ [PostgreSQL] Error al guardar mensaje:', error);
    throw error;
  }
}
```

**Logs a agregar en `query()`:**

```typescript
async query(options: QueryOptions): Promise<MessageEnvelope[]> {
  console.log('🔍 [PostgreSQL] Consultando mensajes...');
  console.log('   Limit:', options.limit);

  try {
    const result = await db.select().from(messages)
      .orderBy(messages.createdAt)
      .limit(options.limit || 10);

    console.log('✅ [PostgreSQL] Mensajes recuperados');
    console.log('   Count:', result.length);

    return result.map(this.toMessageEnvelope);
  } catch (error) {
    console.error('❌ [PostgreSQL] Error al consultar mensajes:', error);
    throw error;
  }
}
```

---

### 4. **WebSocketNotification - Agregar Logs al Enviar**

**Archivo:** `apps/api-gateway/src/implementations/v1/WebSocketNotification.ts`

**Logs a agregar en `broadcast()`:**

```typescript
async broadcast(envelope: MessageEnvelope): Promise<void> {
  console.log('📡 [WebSocket] Broadcasting mensaje a clientes conectados...');
  console.log('   Message ID:', envelope.id);
  console.log('   Conexiones activas:', this.connections.size);

  let sentCount = 0;

  for (const [connectionId, ws] of this.connections) {
    try {
      ws.send(JSON.stringify({
        type: 'new_message',
        data: envelope
      }));
      sentCount++;
    } catch (error) {
      console.error(`❌ [WebSocket] Error enviando a conexión ${connectionId}:`, error);
    }
  }

  console.log(`✅ [WebSocket] Mensaje enviado a ${sentCount} clientes`);
}
```

---

### 5. **HTTP Routes - Agregar Logs en Endpoints**

**Archivo:** `apps/api-gateway/src/routes/messages.ts`

**Logs a agregar en POST `/messages`:**

```typescript
.post('/', async ({ body, set }: any) => {
  console.log('');
  console.log('🌐 [HTTP] POST /messages - Solicitud recibida');
  console.log('   Type:', body.type);
  console.log('   Channel:', body.channel);
  console.log('   From:', body.metadata?.from);

  try {
    const result = await messageService.createMessage(body);

    console.log('✅ [HTTP] POST /messages - Respuesta exitosa');
    console.log('   Message ID:', result.messageId);
    console.log('');

    return createSuccessResponse({
      status: 'received',
      messageId: result.messageId,
      timestamp: new Date().toISOString(),
      storage: 'postgresql'
    });
  } catch (error) {
    console.error('❌ [HTTP] POST /messages - Error:', error);
    throw error;
  }
})
```

**Logs a agregar en GET `/messages`:**

```typescript
.get('/', async ({ query, set }: any) => {
  const limit = query.limit ? parseInt(query.limit) : 10;

  console.log('');
  console.log('🌐 [HTTP] GET /messages - Solicitud recibida');
  console.log('   Limit:', limit);

  try {
    const result = await messageService.listMessages(limit);

    console.log('✅ [HTTP] GET /messages - Respuesta exitosa');
    console.log('   Count:', result.count);
    console.log('');

    return createSuccessResponse({
      count: result.count,
      messages: result.data.map(/* ... */),
      storage: 'postgresql'
    });
  } catch (error) {
    console.error('❌ [HTTP] GET /messages - Error:', error);
    throw error;
  }
})
```

---

## 🧪 Test Script con Logs Completos

**Crear:** `scripts/test-full-flow-with-logs.ts`

El test debe:

1. **Inicializar** - Logs de preparación
2. **Simular mensaje WhatsApp** - Logs del adapter
3. **Enviar a MessageCore** - Logs del orquestador
4. **Verificar PostgreSQL** - Logs de persistencia
5. **Verificar WebSocket** - Logs de notificación
6. **Consultar desde Frontend** - Logs de recuperación

---

## 📊 Ejemplo de Output Esperado

```
═══════════════════════════════════════════════════════
🚀 TEST: Flujo Completo de Mensajería
═══════════════════════════════════════════════════════

📱 [WhatsApp Adapter] Mensaje recibido del chat simulado
   From: +1234567890
   Text: Hola, este es un mensaje de prueba
   Traduciendo a MessageEnvelope...

✅ [WhatsApp Adapter] Mensaje traducido a MessageEnvelope
   ID: abc-123-def
   Type: incoming
   Channel: whatsapp
   Status: received

═══════════════════════════════════════════════════════
📦 [MessageCore] INICIO - Procesando mensaje
═══════════════════════════════════════════════════════
   ID: abc-123-def
   Type: incoming
   Channel: whatsapp
   From: +1234567890
   Text: Hola, este es un mensaje de prueba

💾 [MessageCore] PASO 1: Iniciando persistencia...
💾 [PostgreSQL] Guardando mensaje en base de datos...
   Message ID: abc-123-def
   Type: incoming
✅ [PostgreSQL] Mensaje guardado exitosamente
   DB Record ID: abc-123-def
   Created At: 2025-11-19T14:30:00.000Z
✅ [MessageCore] PASO 1: Mensaje persistido en PostgreSQL

📢 [MessageCore] PASO 2: Iniciando notificación...
📡 [WebSocket] Broadcasting mensaje a clientes conectados...
   Message ID: abc-123-def
   Conexiones activas: 2
✅ [WebSocket] Mensaje enviado a 2 clientes
✅ [MessageCore] PASO 2: Mensaje enviado via WebSocket

═══════════════════════════════════════════════════════
✅ [MessageCore] FIN - Mensaje procesado exitosamente
═══════════════════════════════════════════════════════

🌐 [HTTP] GET /messages - Solicitud recibida
   Limit: 10
🔍 [PostgreSQL] Consultando mensajes...
   Limit: 10
✅ [PostgreSQL] Mensajes recuperados
   Count: 15
✅ [HTTP] GET /messages - Respuesta exitosa
   Count: 15

═══════════════════════════════════════════════════════
✅ TEST COMPLETADO - Todo funcionó correctamente
═══════════════════════════════════════════════════════
```

---

## 🎯 Resumen - Lista de Tareas

### Backend necesita preparar:

- [ ] **Adapter:** Agregar logs en `createIncomingMessage()` y `sendMessage()`
- [ ] **MessageCore:** Mejorar logs en `receive()` con separadores y pasos claros
- [ ] **DatabasePersistence:** Agregar logs en `save()` y `query()`
- [ ] **WebSocketNotification:** Agregar logs en `broadcast()` con contador de clientes
- [ ] **HTTP Routes:** Agregar logs al inicio y fin de cada request
- [ ] **Test Script:** Crear script con verificación paso a paso

### Formato de logs recomendado:

```typescript
// Inicio de proceso
console.log('🔄 [Component] Acción iniciando...');

// Datos importantes
console.log('   Key:', value);

// Éxito
console.log('✅ [Component] Acción completada');

// Error
console.error('❌ [Component] Acción falló:', error);
```

---

¿Quieres que implemente estos logs en el backend ahora?
