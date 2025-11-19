# 📋 Backend Feedback - Sistema de Sincronización Offline-First

**Fecha:** 2025-01-15
**Revisado por:** Backend Team
**Estado:** ✅ Aprobado con ajustes menores

---

## 🎯 Resumen Ejecutivo

La propuesta de Frontend para sincronización offline-first es **excelente y está alineada con best practices**. Backend confirma que:

✅ **Arquitectura aprobada** - Local-first con IndexedDB + WebSocket sync
✅ **Desnormalización aprobada** - `unreadCount` y `lastMessage` en `conversations`
✅ **Endpoints críticos** - Ya están implementados en FASE 1
⚠️ **Ajustes menores** - Algunos campos y triggers necesitan refinamiento

---

## ✅ Lo Que YA Está Implementado

### 1. Endpoints Críticos (FASE 1 Completa)

| Endpoint | Estado | Commit | Notas |
|----------|--------|--------|-------|
| `POST /admin/auth/login` | ✅ Implementado | `311aa11` | JWT tokens funcionando |
| `GET /admin/sync/initial` | ✅ Implementado | `ae46db0` | Hydration completa |
| `GET /admin/conversations/:id/messages` | ✅ Implementado | `311aa11` | Con paginación |
| `POST /admin/conversations/:id/messages` | ✅ Implementado | `ae46db0` | Con auto-detección @mentions |
| `POST /admin/conversations/:id/mark-as-read` | ✅ Implementado | `ae46db0` | Resetea `unreadCount` |

### 2. Schema de Base de Datos

**Tabla `conversations`** - Ya tiene los campos desnormalizados:
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  end_user_id UUID NOT NULL,
  channel VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  assigned_to_id UUID,

  -- ✅ Campos desnormalizados YA implementados
  is_pinned BOOLEAN DEFAULT false,
  unread_count INTEGER DEFAULT 0,
  last_read_at TIMESTAMP,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP
);
```

**⚠️ FALTA:** `lastMessage` desnormalizado (ver sección "Ajustes Necesarios")

### 3. Sistema Read/Unread

✅ **Ya implementado** en `POST /admin/conversations/:id/mark-as-read`:
- Resetea `unreadCount` a 0
- Actualiza `lastReadAt`
- Auto-incrementa `unreadCount` al recibir mensaje `incoming`

**Archivo:** `apps/api-gateway/src/routes/admin/conversations.ts:615`

### 4. Auto-detección de @Mentions

✅ **Bonus ya implementado** (FASE 2):
- Parser universal de mentions
- Auto-crea registros en tabla `mentions`
- Integrado en `POST /admin/conversations/:id/messages`

**Archivo:** `apps/api-gateway/src/utils/mentions-parser.ts`

---

## ⚠️ Ajustes Necesarios

### 1. Agregar Campos `lastMessage` a Tabla `conversations`

**Propuesta Frontend:**
```sql
last_message_id UUID,
last_message_text TEXT,
last_message_type VARCHAR(50),
last_message_at TIMESTAMP
```

**✅ Backend aprueba** - Necesitamos agregar estos campos.

**Migración propuesta:**
```sql
-- drizzle/migrations/0003_add_last_message_to_conversations.sql

ALTER TABLE conversations
ADD COLUMN last_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
ADD COLUMN last_message_text TEXT,
ADD COLUMN last_message_type VARCHAR(50),
ADD COLUMN last_message_at TIMESTAMP;

CREATE INDEX idx_conversations_last_message
ON conversations(last_message_id);
```

**Actualizar schema:**
```typescript
// packages/shared/src/database/schema.ts

export const conversations = pgTable('conversations', {
  // ... campos existentes ...

  // Nuevos campos
  lastMessageId: uuid('last_message_id').references(() => messages.id),
  lastMessageText: text('last_message_text'),
  lastMessageType: varchar('last_message_type', { length: 50 }),
  lastMessageAt: timestamp('last_message_at'),

  // ... resto de campos ...
});
```

### 2. Implementar Triggers para Mantener `lastMessage` Sincronizado

**Frontend propuso usar triggers** - ✅ Backend aprueba.

**Trigger a implementar:**
```sql
-- drizzle/migrations/0003_add_last_message_to_conversations.sql (continuación)

-- Función para actualizar lastMessage
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_id = NEW.id,
    last_message_text = (NEW.content->>'text'),
    last_message_type = NEW.type,
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que ejecuta la función
CREATE TRIGGER trigger_update_conversation_last_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_last_message();
```

**✅ Ventajas:**
- Mantiene `lastMessage` sincronizado automáticamente
- No requiere lógica adicional en endpoints
- Performance: evita JOIN en `GET /sync/initial`

### 3. Actualizar Response de `GET /admin/sync/initial`

**Estado actual:**
```typescript
// ❌ NO incluye lastMessage como objeto
{
  conversations: [
    {
      id: "uuid",
      endUserId: "uuid",
      unreadCount: 3,
      isPinned: true,
      // ... falta lastMessage
    }
  ]
}
```

**Cambio necesario:**
```typescript
// ✅ Debe incluir lastMessage como objeto
{
  conversations: [
    {
      id: "uuid",
      endUserId: "uuid",
      unreadCount: 3,
      isPinned: true,
      lastMessage: {  // ← Agregar
        id: "uuid",
        text: "Último mensaje aquí",
        type: "incoming",
        timestamp: "2025-01-15T10:00:00Z"
      },
      // ...
    }
  ]
}
```

**Archivo a modificar:** `apps/api-gateway/src/routes/admin/sync.ts:60-95`

**Query actualizado:**
```typescript
const conversationsWithDetails = await Promise.all(
  conversationsList.map(async (conv) => {
    // Usar campos desnormalizados en vez de query
    return {
      id: conv.id,
      endUserId: conv.endUserId,
      status: conv.status,
      channel: conv.channel,
      isPinned: conv.isPinned || false,
      unreadCount: conv.unreadCount || 0,
      lastMessage: conv.lastMessageId ? {  // ← Usar campos desnormalizados
        id: conv.lastMessageId,
        text: conv.lastMessageText || '',
        type: conv.lastMessageType,
        timestamp: conv.lastMessageAt?.toISOString() || '',
      } : undefined,
      assignedTo: conv.assignedTo ? {
        id: conv.assignedTo.id,
        name: conv.assignedTo.name,
      } : null,
      createdAt: conv.createdAt?.toISOString() || '',
      updatedAt: conv.updatedAt?.toISOString() || '',
    };
  })
);
```

### 4. Estructura de WebSocket Events

**Frontend propuso eventos estructurados** - ✅ Backend aprueba con ajustes.

**Events a implementar:**

#### **Event: `message:new`**
```typescript
// Server → Client (broadcast a tenant)
{
  type: 'message:new',
  data: MessageEnvelope,  // Mensaje completo
  conversationId: 'uuid',
  unreadCount: 4,  // Nuevo unreadCount de la conversación
  timestamp: '2025-01-15T10:00:00Z'
}
```

**✅ Ya tenemos broadcast parcial** en `WebSocketNotification.ts`, pero necesita:
- Agregar `conversationId` al payload
- Agregar `unreadCount` actualizado
- Broadcast solo al tenant correcto

**Archivo a modificar:** `apps/api-gateway/src/implementations/v1/WebSocketNotification.ts:40-60`

#### **Event: `message:status`**
```typescript
// Server → Client
{
  type: 'message:status',
  data: {
    messageId: 'uuid',
    status: 'read',
    timestamp: '2025-01-15T10:00:00Z',
    details?: 'Optional details'
  }
}
```

**✅ Ya implementado** en `broadcastStatus()`.

#### **Event: `conversation:updated`**
```typescript
// Server → Client
{
  type: 'conversation:updated',
  data: {
    conversationId: 'uuid',
    updates: {
      status?: 'active' | 'closed' | 'archived',
      assignedTo?: { id: 'uuid', name: 'Agent' },
      isPinned?: boolean,
      updatedAt: '2025-01-15T10:00:00Z'
    }
  }
}
```

**❌ No implementado** - Necesitamos agregarlo en `PATCH /admin/conversations/:id`.

#### **Event: `conversation:read`**
```typescript
// Server → Client
{
  type: 'conversation:read',
  data: {
    conversationId: 'uuid',
    readBy: {
      id: 'uuid',
      name: 'Agent Smith'
    },
    unreadCount: 0,
    timestamp: '2025-01-15T10:00:00Z'
  }
}
```

**❌ No implementado** - Necesitamos agregarlo en `POST /mark-as-read`.

---

## 🔧 Decisiones Técnicas Confirmadas

### 1. Desnormalización de `unreadCount` ✅ APROBADA

**Razón:** Performance en listado de conversaciones.

**Cómo se mantiene sincronizado:**
```typescript
// ✅ Ya implementado en POST /admin/conversations/:id/messages
if (type === 'incoming') {
  updateData.unreadCount = sql`${conversations.unreadCount} + 1`;
}
```

**Trigger para incrementar (opcional - podemos usar lógica en endpoint):**
```sql
CREATE OR REPLACE FUNCTION increment_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'incoming' THEN
    UPDATE conversations
    SET unread_count = unread_count + 1
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Decisión:** ✅ Mantener lógica en endpoint (más fácil de debuggear).

### 2. Desnormalización de `lastMessage` ✅ APROBADA

**Razón:** Evita JOIN costoso al listar conversaciones.

**Cómo se mantiene sincronizado:**
- **✅ Usar trigger** (más confiable)
- ❌ NO usar lógica en endpoint (fácil olvidar actualizar)

**Decisión:** ✅ Implementar trigger (ver sección "Ajustes Necesarios #2").

### 3. Sistema de `message_reads` ❌ NO NECESARIA (por ahora)

**Frontend propuso tabla `message_reads`:**
```sql
CREATE TABLE message_reads (
  message_id UUID,
  user_id UUID,
  read_at TIMESTAMP
);
```

**Backend opina:**
- ✅ **Pro:** Tracking granular de quién leyó qué
- ❌ **Con:** Complejidad adicional para MVP
- ⚠️ **Realidad:** Con `unreadCount` en conversations es suficiente

**Decisión:** ❌ NO implementar tabla `message_reads` en FASE 1.
**Razón:** `unreadCount` + `lastReadAt` en conversations es suficiente para MVP.

**Si en FASE 2/3 necesitamos tracking granular:**
- Crear tabla `message_reads`
- Recalcular `unreadCount` con query:
  ```sql
  SELECT COUNT(*) FROM messages m
  WHERE m.conversation_id = :id
    AND m.type = 'incoming'
    AND NOT EXISTS (
      SELECT 1 FROM message_reads mr
      WHERE mr.message_id = m.id AND mr.user_id = :userId
    )
  ```

### 4. WebSocket Rooms por Tenant ✅ APROBADA

**Frontend propuso:**
```javascript
// Server
socket.join(`tenant:${socket.tenantId}`);

// Broadcast
io.to(`tenant:${user.tenantId}`).emit('message:new', data);
```

**Backend confirma:** ✅ **Ya implementado parcialmente**.

**Archivo:** `apps/api-gateway/src/routes/websocket.ts`

**Mejora necesaria:**
- ✅ Ya unimos a room del tenant
- ❌ Falta broadcast estructurado a `tenant:${tenantId}`

### 5. Paginación con Cursor ✅ APROBADA

**Frontend propuso:**
```sql
SELECT * FROM messages
WHERE conversation_id = :id
  AND created_at < :cursor
ORDER BY created_at DESC
LIMIT 100;
```

**Backend confirma:** ✅ **Mejor que OFFSET**.

**Estado actual:** ❌ Usamos OFFSET en `GET /messages`.

**Cambio necesario:**
```typescript
// Query parameter
?before=2025-01-15T10:00:00Z

// Query
const messages = await db.query.messages.findMany({
  where: and(
    eq(messages.conversationId, conversationId),
    before ? lt(messages.createdAt, new Date(before)) : undefined
  ),
  orderBy: desc(messages.createdAt),
  limit: 100,
});
```

---

## 📊 Comparación: Propuesta vs Implementación

| Aspecto | Frontend Propone | Backend Estado | Acción |
|---------|------------------|----------------|--------|
| Hydration endpoint | GET /sync/initial con lastMessage | ✅ Existe, ❌ sin lastMessage | Agregar lastMessage |
| unreadCount | Desnormalizado en conversations | ✅ Ya implementado | Ninguna |
| lastMessage | Desnormalizado + trigger | ❌ No existe | Agregar campos + trigger |
| message_reads table | Sí | ❌ No | ❌ No implementar (MVP no lo necesita) |
| WebSocket events | Estructurados | ⚠️ Parcial | Estructurar mejor |
| Paginación | Cursor (timestamp) | ❌ OFFSET | Cambiar a cursor |
| Optimistic updates | Cliente maneja | N/A (frontend) | Backend solo confirma |
| Multi-tenancy | Validación estricta | ✅ Ya implementado | Ninguna |

---

## 🚀 Plan de Implementación

### FASE 1A - Ajustes Críticos (2-3 horas)

**Prioridad: ALTA** - Necesarios para que frontend funcione correctamente.

1. **Migración: Agregar campos `lastMessage` a `conversations`**
   - Archivo: `drizzle/migrations/0003_add_last_message.sql`
   - Campos: `last_message_id`, `last_message_text`, `last_message_type`, `last_message_at`
   - Trigger: `update_conversation_last_message()`

2. **Actualizar `GET /admin/sync/initial`**
   - Archivo: `apps/api-gateway/src/routes/admin/sync.ts:60-95`
   - Cambio: Usar campos desnormalizados para `lastMessage`
   - Return: Objeto `lastMessage` en response

3. **Estructurar WebSocket Events**
   - Archivo: `apps/api-gateway/src/routes/admin/conversations.ts`
   - Broadcast `conversation:read` en `POST /mark-as-read`
   - Broadcast `conversation:updated` en `PATCH /conversations/:id`
   - Agregar `conversationId` y `unreadCount` a `message:new`

### FASE 1B - Mejoras de Performance (1-2 horas)

**Prioridad: MEDIA** - Mejoran performance pero no bloquean.

4. **Cambiar paginación a cursor**
   - Archivo: `apps/api-gateway/src/routes/admin/messages.ts`
   - Query param: `?before=timestamp` en vez de `?offset=N`
   - Query: `WHERE created_at < :cursor`

5. **Agregar índices faltantes**
   ```sql
   CREATE INDEX idx_conversations_last_message ON conversations(last_message_id);
   CREATE INDEX idx_conversations_tenant_updated ON conversations(tenant_id, updated_at DESC);
   CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
   ```

### FASE 2 - Tracking Granular (Futuro)

**Prioridad: BAJA** - Solo si se necesita en el futuro.

6. **Implementar tabla `message_reads`** (si se requiere tracking por usuario)
7. **Recalcular `unreadCount` con query** (más preciso pero más costoso)

---

## ✅ Aprobación Final

### ✅ Backend APRUEBA la propuesta con estos ajustes:

1. ✅ **Arquitectura offline-first** - Excelente approach
2. ✅ **Desnormalización** - `unreadCount` (ya hecho) + `lastMessage` (agregar)
3. ✅ **WebSocket sync** - Estructurar eventos como propuso frontend
4. ✅ **Optimistic updates** - Backend solo confirma/rechaza
5. ❌ **Tabla `message_reads`** - NO necesaria para MVP

### 🎯 Próximos Pasos

**Backend implementará:**
1. Migración: Campos `lastMessage` + trigger
2. Actualizar `GET /sync/initial` con `lastMessage`
3. Estructurar WebSocket events (`conversation:read`, `conversation:updated`)
4. Cambiar paginación a cursor-based

**Frontend puede proceder con:**
1. Hydration desde `GET /sync/initial` (funcionará mejor después de ajustes)
2. Optimistic updates (ya está listo)
3. WebSocket listeners (funcionarán mejor después de estructurar events)

---

## 📞 Puntos de Coordinación

### 1. Formato de `lastMessage`

**Confirmado:**
```typescript
lastMessage: {
  id: string;
  text: string;
  type: 'incoming' | 'outgoing' | 'system';
  timestamp: string; // ISO 8601
} | undefined;
```

### 2. WebSocket Event `message:new`

**Confirmado:**
```typescript
{
  type: 'message:new',
  data: MessageEnvelope,
  conversationId: string,
  unreadCount: number,  // Nuevo unreadCount de la conversación
  timestamp: string
}
```

### 3. Optimistic Update Flow

**Confirmado:**
1. Frontend crea mensaje con `id: temp-${timestamp}`
2. Frontend llama `POST /messages` en background
3. Backend responde con mensaje real (ID de DB)
4. Frontend reemplaza mensaje temporal con mensaje real
5. Si falla, frontend marca como `failed` en `statusChain`

---

## 💬 Feedback para Frontend

### ✅ Excelente Trabajo

- 📋 Documento muy completo y bien estructurado
- 🎯 Arquitectura sólida (offline-first es la mejor approach)
- 🔧 Propuestas técnicas bien fundamentadas
- 📊 Casos de uso claros y detallados

### 💡 Sugerencias

1. **Validación de IDs temporales**
   - Frontend debe validar que `temp-*` IDs no colisionen
   - Sugerencia: `temp-${Date.now()}-${Math.random().toString(36)}`

2. **Manejo de conflictos**
   - ¿Qué pasa si dos agentes editan la misma conversación simultáneamente?
   - Sugerencia: Last-write-wins (el último WebSocket event gana)

3. **Sincronización después de offline**
   - ¿Cómo detectan que están online de nuevo?
   - Sugerencia: `window.addEventListener('online', () => syncPendingChanges())`

---

## 📝 Preguntas para Frontend

### 1. ¿Necesitan paginación en `GET /sync/initial`?

**Opción A:** Retornar todas las conversaciones activas (puede ser mucho)
**Opción B:** Retornar solo últimas 50, luego paginar con `GET /conversations?limit=50&offset=50`

**Backend recomienda:** Opción B (más escalable).

### 2. ¿Qué pasa con mensajes `failed`?

**Escenario:** Usuario envía mensaje, falla el POST al backend.

**Opciones:**
- A) Frontend guarda en IndexedDB como `failed`, usuario puede reintentar manualmente
- B) Frontend reintenta automáticamente N veces
- C) Frontend descarta el mensaje

**Backend recomienda:** Opción A (dar control al usuario).

### 3. ¿Quieren recibir `typing:indicator` de otros agentes?

**Use case:** "Agent Smith está escribiendo en esta conversación..."

**Implementación:**
- Frontend emite `typing:start` al escribir
- Backend broadcast a todos (excepto emisor)
- Frontend muestra indicador

**Backend pregunta:** ¿Lo necesitan en MVP? (fácil de agregar)

---

## 🏁 Conclusión

**✅ Backend está de acuerdo con el 95% de la propuesta.**

**Ajustes menores:**
- Agregar campos `lastMessage` a `conversations` (2h)
- Estructurar WebSocket events (1h)
- Cambiar paginación a cursor (1h)

**Total:** ~4 horas de trabajo para backend.

**Una vez implementados estos ajustes, el sistema estará 100% listo para la integración frontend-backend.**

---

**¿Alguna pregunta o necesitan clarificación en algún punto?**
