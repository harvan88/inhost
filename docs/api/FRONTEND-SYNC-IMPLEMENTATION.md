# Frontend Sync System - Complete Implementation

## ✅ Implementación Completada

Este documento resume todas las implementaciones realizadas para soportar el sistema de sincronización offline-first del Frontend.

---

## 📊 Database Schema Changes

### 1. Conversations Table - Campos Denormalizados

**Agregados:**
```sql
-- Campos desnormalizados de lastMessage (para performance)
last_message_id UUID,
last_message_text TEXT,
last_message_type VARCHAR(50),
last_message_at TIMESTAMP
```

**Ubicación:** `packages/shared/src/database/schema.ts:82-85`

**Propósito:** Evitar N+1 queries al cargar conversaciones. El trigger auto-actualiza estos campos.

---

### 2. message_reads Table - Tracking Granular

**Nueva tabla:**
```sql
CREATE TABLE message_reads (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  read_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);
```

**Ubicación:** `packages/shared/src/database/schema.ts:169-182`

**Propósito:** Tracking granular de qué usuarios han leído qué mensajes. **Crítico para workspaces con equipos.**

**Índices:**
- `message_reads_message_id_idx` - Búsqueda por mensaje
- `message_reads_user_id_idx` - Búsqueda por usuario
- `message_reads_composite_idx` - Búsqueda combinada
- `message_reads_message_user_unique` - UNIQUE constraint

---

### 3. Database Triggers & Functions

**Trigger: `update_conversation_last_message`**
```sql
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

CREATE TRIGGER trigger_update_conversation_last_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_last_message();
```

**Function: `calculate_unread_count(conversation_id, user_id)`**
```sql
CREATE OR REPLACE FUNCTION calculate_unread_count(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.type = 'incoming'
    AND NOT EXISTS (
      SELECT 1 FROM message_reads mr
      WHERE mr.message_id = m.id
        AND mr.user_id = p_user_id
    );
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
```

**Ubicación:** `drizzle/migrations/0003_add_message_reads_and_last_message.sql`

---

## 🔧 Endpoint Updates

### 1. GET /admin/sync/initial

**ANTES:** Hacía N+1 queries para lastMessage de cada conversación
**AHORA:** Usa campos denormalizados (1 query total)

**Cambios:**
```typescript
// ❌ ANTES (N+1 queries)
const lastMsg = await db.query.messages.findFirst({
  where: eq(messages.conversationId, conv.id),
  orderBy: desc(messages.createdAt),
});

// ✅ AHORA (campos denormalizados)
lastMessage: conv.lastMessageId
  ? {
      id: conv.lastMessageId,
      text: conv.lastMessageText || '',
      type: conv.lastMessageType || '',
      timestamp: conv.lastMessageAt?.toISOString() || '',
    }
  : undefined
```

**Performance:** O(N) → O(1) queries

**Ubicación:** `apps/api-gateway/src/routes/admin/sync.ts:42-69`

---

### 2. POST /admin/conversations/:id/mark-as-read

**ANTES:** Simple reset de unreadCount a 0
**AHORA:** Sistema granular con message_reads

**Cambios:**
```typescript
// 1. Encuentra mensajes no leídos por este usuario
const unreadMessages = await db
  .select({ id: messages.id })
  .from(messages)
  .where(
    and(
      eq(messages.conversationId, id),
      eq(messages.type, 'incoming'),
      notExists(
        db.select().from(messageReads)
          .where(
            and(
              eq(messageReads.messageId, messages.id),
              eq(messageReads.userId, user.id)
            )
          )
      )
    )
  );

// 2. Crea registros message_reads (bulk insert)
if (unreadMessages.length > 0) {
  await db.insert(messageReads).values(
    unreadMessages.map((msg) => ({
      messageId: msg.id,
      userId: user.id,
      readAt: new Date(),
    }))
  );
}

// 3. Calcula unreadCount usando función DB
const result = await db.execute(
  sql`SELECT calculate_unread_count(${id}, ${user.id}) as unread_count`
);

// 4. Actualiza conversación
await db.update(conversations)
  .set({
    lastReadAt: now,
    unreadCount: newUnreadCount,
    updatedAt: now,
  })
  .where(eq(conversations.id, id));

// 5. Broadcast evento conversation:read
await notifications.broadcastConversationRead({
  conversationId: id,
  userId: user.id,
  unreadCount: newUnreadCount,
  lastReadAt: now.toISOString(),
  timestamp: now.toISOString(),
});
```

**Ubicación:** `apps/api-gateway/src/routes/admin/conversations.ts:650-735`

**Beneficio:** Soporte para múltiples agentes viendo la misma conversación con estados de lectura independientes.

---

### 3. POST /admin/conversations/:id/messages

**Agregado:** Broadcast de `conversation:updated` cuando se crea mensaje

```typescript
// Broadcast conversation:updated event
await notifications.broadcastConversationUpdated({
  conversationId: id,
  updates: {
    lastMessage: {
      id: newMessage.id,
      text,
      type: newMessage.type,
      timestamp: newMessage.createdAt?.toISOString() || '',
    },
    ...(type === 'incoming' && {
      unreadCount: (conversation.unreadCount || 0) + 1,
    }),
  },
  timestamp: new Date().toISOString(),
});
```

**Ubicación:** `apps/api-gateway/src/routes/admin/conversations.ts:483-501`

**Propósito:** Actualizar UI en tiempo real cuando llega nuevo mensaje.

---

## 🔔 WebSocket Events - Structured Broadcasting

### Nuevas Interfaces

**Archivo:** `apps/api-gateway/src/core/interfaces/INotificationService.ts`

```typescript
export interface ConversationReadEvent {
  conversationId: string;
  userId: string;
  unreadCount: number;
  lastReadAt: string;
  timestamp: string;
}

export interface ConversationUpdatedEvent {
  conversationId: string;
  updates: {
    lastMessage?: {
      id: string;
      text: string;
      type: string;
      timestamp: string;
    };
    unreadCount?: number;
    status?: string;
    assignedToId?: string;
  };
  timestamp: string;
}
```

**Métodos agregados:**
```typescript
interface INotificationService {
  // Existing methods...

  broadcastConversationRead(
    event: ConversationReadEvent,
    target?: NotificationTarget
  ): Promise<void>;

  broadcastConversationUpdated(
    event: ConversationUpdatedEvent,
    target?: NotificationTarget
  ): Promise<void>;
}
```

---

### Implementación WebSocket

**Archivo:** `apps/api-gateway/src/implementations/v1/WebSocketNotification.ts:109-152`

```typescript
async broadcastConversationRead(
  event: ConversationReadEvent,
  target?: NotificationTarget
): Promise<void> {
  const payload = {
    type: 'conversation:read',
    data: event,
    timestamp: new Date().toISOString()
  };

  if (target?.userId) {
    await this.broadcastToUser(target.userId, payload);
  } else {
    await this.broadcastToAll(payload);
  }
}

async broadcastConversationUpdated(
  event: ConversationUpdatedEvent,
  target?: NotificationTarget
): Promise<void> {
  const payload = {
    type: 'conversation:updated',
    data: event,
    timestamp: new Date().toISOString()
  };

  if (target?.userId) {
    await this.broadcastToUser(target.userId, payload);
  } else {
    await this.broadcastToAll(payload);
  }
}
```

---

## 📡 WebSocket Events Reference

### Eventos que Frontend Recibe

#### 1. `message:new` (Ya existía)
```json
{
  "type": "message:new",
  "data": {
    "id": "uuid",
    "conversationId": "uuid",
    "type": "incoming",
    "content": { "text": "..." },
    "metadata": { ... },
    "createdAt": "2025-11-19T10:00:00Z"
  },
  "timestamp": "2025-11-19T10:00:00Z"
}
```

#### 2. `conversation:read` (NUEVO)
```json
{
  "type": "conversation:read",
  "data": {
    "conversationId": "uuid",
    "userId": "uuid",
    "unreadCount": 0,
    "lastReadAt": "2025-11-19T10:00:00Z",
    "timestamp": "2025-11-19T10:00:00Z"
  },
  "timestamp": "2025-11-19T10:00:00Z"
}
```

**Cuándo:** Cuando un agente marca conversación como leída

**Frontend debe:** Actualizar `unreadCount` y `lastReadAt` en IndexedDB

#### 3. `conversation:updated` (NUEVO)
```json
{
  "type": "conversation:updated",
  "data": {
    "conversationId": "uuid",
    "updates": {
      "lastMessage": {
        "id": "uuid",
        "text": "Nuevo mensaje...",
        "type": "incoming",
        "timestamp": "2025-11-19T10:00:00Z"
      },
      "unreadCount": 5
    },
    "timestamp": "2025-11-19T10:00:00Z"
  },
  "timestamp": "2025-11-19T10:00:00Z"
}
```

**Cuándo:** Cuando se crea nuevo mensaje en conversación

**Frontend debe:** Actualizar `lastMessage` y `unreadCount` en IndexedDB

#### 4. `typing:indicator` (Ya existía)
```json
{
  "type": "typing:indicator",
  "data": {
    "userId": "uuid",
    "conversationId": "uuid",
    "isTyping": true,
    "timestamp": "2025-11-19T10:00:00Z"
  },
  "timestamp": "2025-11-19T10:00:00Z"
}
```

---

## ✅ Features Implementadas vs Propuesta Frontend

| Feature | Status | Notas |
|---------|--------|-------|
| ✅ Desnormalización lastMessage | Implementado | Trigger auto-actualiza |
| ✅ Tabla message_reads | Implementado | Tracking granular por usuario |
| ✅ Función calculate_unread_count() | Implementado | Per-user unread count |
| ✅ GET /sync/initial optimizado | Implementado | Sin N+1 queries |
| ✅ POST /mark-as-read con message_reads | Implementado | Bulk insert eficiente |
| ✅ WebSocket conversation:read | Implementado | Broadcast en mark-as-read |
| ✅ WebSocket conversation:updated | Implementado | Broadcast en message creation |
| ✅ Typing indicators | Ya existía | Funcional desde Sprint 3 |
| ⚠️ Cursor-based pagination | Pendiente | Usar timestamp en vez de OFFSET |
| ⚠️ WebSocket authentication | Pendiente | userId temporal por ahora |

---

## 🚀 Próximos Pasos

### 1. Migration Aplicada
```bash
# Aplicar migración
bun run db:push

# Verificar tablas
psql -d inhost -c "\dt message_reads"
psql -d inhost -c "\df calculate_unread_count"
```

### 2. Testing Manual

**Test 1: Sync Initial**
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password"}' | jq -r '.data.accessToken')

curl http://localhost:3000/admin/sync/initial \
  -H "Authorization: Bearer $TOKEN" | jq '.data.conversations[0].lastMessage'
```

**Test 2: Mark as Read**
```bash
curl -X POST http://localhost:3000/admin/conversations/{id}/mark-as-read \
  -H "Authorization: Bearer $TOKEN"
```

**Test 3: WebSocket Events**
```javascript
const ws = new WebSocket('ws://localhost:3000/realtime');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'conversation:read') {
    console.log('Conversation marked as read:', data.data);
  }

  if (data.type === 'conversation:updated') {
    console.log('Conversation updated:', data.data);
  }
};
```

### 3. Cursor-based Pagination (Pendiente)

**Cambiar:**
```typescript
// ❌ OFFSET-based (no escala)
.limit(50).offset(offset)

// ✅ Cursor-based (escalable)
.where(lt(messages.createdAt, cursor))
.limit(50)
```

**Beneficios:**
- Rendimiento constante O(log N)
- No salta mensajes si hay inserts concurrentes
- Soporta "infinite scroll" eficiente

---

## 📝 Archivos Modificados

### Schema & Migrations
- ✅ `packages/shared/src/database/schema.ts` - Campos lastMessage + messageReads table
- ✅ `drizzle/migrations/0003_add_message_reads_and_last_message.sql` - Migration completa

### Interfaces
- ✅ `apps/api-gateway/src/core/interfaces/INotificationService.ts` - Nuevas interfaces

### Implementations
- ✅ `apps/api-gateway/src/implementations/v1/WebSocketNotification.ts` - Nuevos métodos broadcast

### Routes
- ✅ `apps/api-gateway/src/routes/admin/sync.ts` - Optimización lastMessage
- ✅ `apps/api-gateway/src/routes/admin/conversations.ts` - mark-as-read + broadcasts

### Documentation
- ✅ `docs/api/FRONTEND-SYNC-IMPLEMENTATION.md` - Este documento

---

## 🎯 Conclusión

**Status:** ✅ Sistema completo de sincronización offline-first implementado

**Performance Improvements:**
- GET /sync/initial: O(N) → O(1) queries
- mark-as-read: Soporte multi-agente con tracking granular
- Real-time: Broadcast estructurado para actualizaciones instantáneas

**Próximo Sprint:** Cursor-based pagination + WebSocket auth

---

**Fecha:** 2025-11-19
**Sprint:** FASE 1 + FASE 2 Completadas
**Ready for Frontend Integration:** ✅ YES
