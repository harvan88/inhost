# FASE 2 - Nuevos Endpoints

Documentación de endpoints implementados en FASE 2: Sistema de @mentions universal + Sistema de feedback para mensajes.

## 📌 Mentions (@username)

### GET /admin/mentions
Obtener lista de menciones para el usuario actual (inbox de menciones).

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Query Parameters:**
- `status` (optional): `'all' | 'read' | 'unread'` - Default: `'unread'`
- `limit` (optional): number - Default: `50`
- `offset` (optional): number - Default: `0`

**Response:**
```json
{
  "success": true,
  "data": {
    "mentions": [
      {
        "id": "uuid",
        "entityType": "message|conversation|feedback|note|assignment",
        "entityId": "uuid",
        "entityDetails": {
          "id": "uuid",
          "type": "incoming|outgoing",
          "text": "mensaje donde aparece la mención...",
          "conversationId": "uuid",
          "endUser": {
            "id": "uuid",
            "name": "Cliente Name",
            "externalId": "+123456789"
          },
          "createdAt": "2025-11-19T10:00:00Z"
        },
        "mentionType": "user|team|admins|everyone",
        "context": "...texto alrededor de @username...",
        "isRead": false,
        "mentionedBy": {
          "id": "uuid",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "createdAt": "2025-11-19T10:00:00Z"
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 5
    }
  }
}
```

---

### GET /admin/mentions/unread-count
Obtener contador de menciones no leídas (para badge en UI).

**Response:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 3
  }
}
```

---

### GET /admin/mentions/:id
Obtener detalles de una mención específica.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "entityType": "message",
    "entityId": "uuid",
    "entityDetails": { /* full entity object */ },
    "mentionType": "user",
    "context": "...texto...",
    "isRead": false,
    "mentionedBy": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "createdAt": "2025-11-19T10:00:00Z"
  }
}
```

---

### POST /admin/mentions/:id/mark-as-read
Marcar una mención como leída.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "isRead": true,
    "message": "Mention marked as read"
  }
}
```

---

### POST /admin/mentions/mark-all-read
Marcar todas las menciones como leídas.

**Response:**
```json
{
  "success": true,
  "data": {
    "markedCount": 5,
    "message": "5 mentions marked as read"
  }
}
```

---

## 📝 Message Feedback

### POST /admin/messages/:messageId/feedback
Crear o actualizar feedback para un mensaje (rating + comentarios).

**Body:**
```json
{
  "rating": "positive|negative",  // optional
  "comment": "El mensaje no fue claro...",  // optional
  "suggestedCorrection": "Debió decir: ..."  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "feedback": {
      "id": "uuid",
      "messageId": "uuid",
      "rating": "negative",
      "comment": "El mensaje no fue claro...",
      "suggestedCorrection": "Debió decir: ...",
      "extensionId": "ai",
      "createdAt": "2025-11-19T10:00:00Z",
      "updatedAt": "2025-11-19T10:00:00Z"
    },
    "message": "Feedback created"
  }
}
```

---

### GET /admin/messages/:messageId/feedback
Obtener todo el feedback de un mensaje.

**Response:**
```json
{
  "success": true,
  "data": {
    "feedback": [
      {
        "id": "uuid",
        "messageId": "uuid",
        "rating": "negative",
        "comment": "Respuesta no ayudó",
        "suggestedCorrection": "Debió ofrecer opciones",
        "extensionId": "ai",
        "givenBy": {
          "id": "uuid",
          "name": "Jane Admin",
          "email": "jane@example.com"
        },
        "createdAt": "2025-11-19T10:00:00Z",
        "updatedAt": "2025-11-19T10:00:00Z"
      }
    ]
  }
}
```

---

### GET /admin/feedback
Listar todo el feedback con filtros.

**Query Parameters:**
- `extensionId` (optional): string - Filtrar por extensión
- `rating` (optional): `'positive' | 'negative' | 'none' | 'all'` - Filtrar por rating
- `limit` (optional): number - Default: `50`
- `offset` (optional): number - Default: `0`

**Response:**
```json
{
  "success": true,
  "data": {
    "feedback": [
      {
        "id": "uuid",
        "messageId": "uuid",
        "rating": "positive",
        "comment": "Respuesta perfecta!",
        "extensionId": "ai",
        "message": {
          "id": "uuid",
          "type": "outgoing",
          "text": "Gracias por contactarnos...",
          "conversationId": "uuid",
          "endUser": {
            "id": "uuid",
            "name": "Cliente Name",
            "externalId": "+123456789"
          },
          "createdAt": "2025-11-19T09:55:00Z"
        },
        "givenBy": {
          "id": "uuid",
          "name": "Jane Admin",
          "email": "jane@example.com"
        },
        "createdAt": "2025-11-19T10:00:00Z",
        "updatedAt": "2025-11-19T10:00:00Z"
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0
    }
  }
}
```

---

### GET /admin/feedback/analytics
Obtener estadísticas de feedback (por extensión, rating, etc.).

**Query Parameters:**
- `extensionId` (optional): string - Filtrar por extensión específica
- `days` (optional): number - Default: `30` - Días hacia atrás

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "days": 30,
      "from": "2025-10-20T00:00:00Z",
      "to": "2025-11-19T10:00:00Z"
    },
    "overall": {
      "total": 150,
      "positive": 120,
      "negative": 30,
      "positivePercentage": 80,
      "negativePercentage": 20,
      "withComments": 45,
      "withCorrections": 15
    },
    "byExtension": [
      {
        "extensionId": "ai",
        "total": 100,
        "positive": 85,
        "negative": 15,
        "positivePercentage": 85,
        "negativePercentage": 15
      },
      {
        "extensionId": "echo",
        "total": 30,
        "positive": 25,
        "negative": 5,
        "positivePercentage": 83,
        "negativePercentage": 17
      },
      {
        "extensionId": "crm",
        "total": 20,
        "positive": 10,
        "negative": 10,
        "positivePercentage": 50,
        "negativePercentage": 50
      }
    ]
  }
}
```

---

## 🔄 Comportamiento Automático

### Auto-detección de Mentions
Cuando se crea un mensaje (POST /admin/conversations/:id/messages), el sistema automáticamente:
1. **Parsea el texto** buscando patrones `@username`
2. **Resuelve usuarios** en el tenant
3. **Crea registros** en tabla `mentions`
4. **Soporta menciones especiales:**
   - `@team` - Menciona a todos los miembros del equipo
   - `@admins` - Menciona solo a owners y admins
   - `@everyone` - Menciona a todos

**Ejemplo:**
```
Texto: "Hey @john, necesito ayuda de @team con esto"
```
→ Crea 2 grupos de menciones:
1. Mención personal a John
2. Mención grupal a todo el team

---

## 🗄️ Database Schema

### Tabla: `mentions`
```sql
CREATE TABLE mentions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  mentioned_user_id UUID NOT NULL,  -- Usuario mencionado
  mentioned_by_user_id UUID NOT NULL,  -- Usuario que mencionó
  entity_type VARCHAR NOT NULL,  -- 'message' | 'conversation' | 'feedback' | 'note' | 'assignment'
  entity_id UUID NOT NULL,  -- ID de la entidad (polimórfico)
  mention_type VARCHAR,  -- 'user' | 'team' | 'admins' | 'everyone'
  context TEXT,  -- Texto alrededor de la mención
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX mentions_tenant_id_idx ON mentions(tenant_id);
CREATE INDEX mentions_mentioned_user_id_idx ON mentions(mentioned_user_id);
CREATE INDEX mentions_entity_type_id_idx ON mentions(entity_type, entity_id);
CREATE INDEX mentions_is_read_idx ON mentions(is_read);
```

### Tabla: `message_feedback`
```sql
CREATE TABLE message_feedback (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  message_id UUID NOT NULL,
  given_by_user_id UUID NOT NULL,  -- Usuario que da feedback
  rating VARCHAR,  -- 'positive' | 'negative'
  comment TEXT,  -- Qué estuvo mal
  suggested_correction TEXT,  -- Cómo debió ser
  extension_id VARCHAR(100),  -- Extensión que generó el mensaje
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX message_feedback_tenant_id_idx ON message_feedback(tenant_id);
CREATE INDEX message_feedback_message_id_idx ON message_feedback(message_id);
CREATE INDEX message_feedback_extension_id_idx ON message_feedback(extension_id);
CREATE INDEX message_feedback_rating_idx ON message_feedback(rating);
```

---

## 🧪 Testing

### Test Manual: Mentions
```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:3000/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password"}' | jq -r '.data.accessToken')

# 2. Crear mensaje con mención
curl -X POST http://localhost:3000/admin/conversations/<conversation-id>/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hey @john, can you help with @team?","type":"outgoing"}'

# 3. Ver menciones (como John)
curl http://localhost:3000/admin/mentions?status=unread \
  -H "Authorization: Bearer $TOKEN"

# 4. Contador de menciones no leídas
curl http://localhost:3000/admin/mentions/unread-count \
  -H "Authorization: Bearer $TOKEN"
```

### Test Manual: Feedback
```bash
# 1. Crear feedback para un mensaje
curl -X POST http://localhost:3000/admin/messages/<message-id>/feedback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating":"negative",
    "comment":"La respuesta fue demasiado genérica",
    "suggestedCorrection":"Debió preguntar más detalles del problema"
  }'

# 2. Ver feedback de un mensaje
curl http://localhost:3000/admin/messages/<message-id>/feedback \
  -H "Authorization: Bearer $TOKEN"

# 3. Analytics de feedback
curl "http://localhost:3000/admin/feedback/analytics?days=30" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📊 Use Cases

### Frontend Integration - Mentions Badge
```typescript
// 1. Fetch unread count on login
const { data } = await fetch('/admin/mentions/unread-count', {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());

// Show badge: data.unreadCount

// 2. Fetch mentions when clicking badge
const mentions = await fetch('/admin/mentions?status=unread', {
  headers: { Authorization: `Bearer ${token}` }
}).then(r => r.json());

// 3. Mark as read when user clicks mention
await fetch(`/admin/mentions/${mentionId}/mark-as-read`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});
```

### Frontend Integration - Message Feedback
```typescript
// Add thumbs up/down buttons to each message from extensions

// Thumbs up
await fetch(`/admin/messages/${messageId}/feedback`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ rating: 'positive' })
});

// Thumbs down with comment
await fetch(`/admin/messages/${messageId}/feedback`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({
    rating: 'negative',
    comment: 'Response was not helpful',
    suggestedCorrection: 'Should have provided specific solutions'
  })
});
```

---

## ✨ Características Clave

### Mentions System
- ✅ **Universal** - Funciona en cualquier texto (mensajes, notas, assignments)
- ✅ **Auto-detección** - Parser automático de @username
- ✅ **Menciones especiales** - @team, @admins, @everyone
- ✅ **Context preview** - Muestra texto alrededor de la mención
- ✅ **Unread tracking** - Contador de menciones no leídas
- ✅ **Tenant isolation** - Multi-tenancy completo

### Feedback System
- ✅ **Quick rating** - Thumbs up/down para feedback rápido
- ✅ **Detailed feedback** - Comentarios y correcciones sugeridas
- ✅ **Extension tracking** - Vinculado a extensión que generó mensaje
- ✅ **Analytics** - Estadísticas por extensión y rating
- ✅ **Training data** - Exportable para mejorar IA

---

## 🚀 Migration

Migración generada automáticamente:
```
drizzle/migrations/0002_empty_sheva_callister.sql
```

Para aplicar la migración:
```bash
bun run db:push
```
