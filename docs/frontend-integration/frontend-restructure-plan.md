# 🎨 Plan de Restructuración del Frontend (Multi-Tenancy)

## 🎯 Arquitectura Clara

### End Users (Clientes Finales)
**NO usan inhost-frontend**
- ✅ Chatean via WhatsApp Business API
- ✅ Chatean via Instagram Direct
- ✅ Usan UI propia desacoplada del tenant
- ❌ NUNCA acceden a inhost-frontend

### Tenant Users (Admins/Agentes)
**SÍ usan inhost-frontend**
- ✅ Admin Dashboard para ver conversaciones
- ✅ Responder mensajes desde dashboard
- ✅ Ver métricas y analíticas
- ✅ Configurar plan y capabilities
- ✅ Gestionar equipo

---

## 📊 Arquitectura Simplificada

```
┌──────────────────────────────────────────────────────────────┐
│                      End Users                               │
│  (Clientes finales - NO usan inhost-frontend)               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📱 WhatsApp                 📷 Instagram                    │
│     Juan Pérez                  María López                  │
│     "¿Dónde está mi             "Quiero comprar              │
│      pedido?"                    el producto X"              │
│           │                            │                     │
│           ↓                            ↓                     │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ WhatsApp Business API │  │ Instagram Messaging  │        │
│  │  (Meta)              │  │  API (Meta)          │        │
│  └──────────┬───────────┘  └──────────┬───────────┘        │
│             │                          │                     │
│             │  Webhook                 │  Webhook            │
│             ↓                          ↓                     │
│  ┌──────────────────────────────────────────────┐           │
│  │  🌐 UI Propia Desacoplada (Tienda XYZ)      │           │
│  │  - App móvil del tenant                      │           │
│  │  - Website del tenant                        │           │
│  │  - Kiosko en tienda                          │           │
│  └──────────────────────────────────────────────┘           │
│             │                                                │
│             │  API REST/WebSocket                            │
│             ↓                                                │
└──────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌──────────────────────────────────────────────────────────────┐
│                   INHOST Backend API                          │
│                                                               │
│  /chat/*   ← End Users (WhatsApp, Instagram, UI externa)    │
│  /admin/*  ← Tenant Users (Admin Dashboard)                  │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ↓
┌──────────────────────────────────────────────────────────────┐
│              INHOST Frontend (Admin Dashboard)               │
│              (Tenant Users ÚNICAMENTE)                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  👤 Usuario: admin@tiendaxyz.com (Tenant User)              │
│                                                              │
│  📍 URL: https://app.inhost.com                             │
│                                                              │
│  🔐 Auth: Email/Password → JWT                              │
│                                                              │
│  📦 Features:                                                │
│     • Ver conversaciones de WhatsApp/Instagram/UI externa   │
│     • Responder mensajes                                     │
│     • Ver perfil de end-users (Juan, María, etc.)          │
│     • Dashboard de métricas                                  │
│     • Configurar plan y capabilities                         │
│     • Gestionar equipo (otros admins/agentes)               │
│     • Billing y facturación                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 Migración del Frontend Actual

### Estado Actual: `inhostfrontend`

```
inhostfrontend/
└── src/
    ├── Chat simple (confuso)
    ├── No distingue tenant user vs end user
    ├── X-User-Id ambiguo
    └── Sin autenticación clara
```

### Objetivo: Admin Dashboard (Tenant Users)

```
inhost-admin-dashboard/
└── src/
    ├── app/
    │   ├── (auth)/
    │   │   └── login/             ← JWT auth
    │   └── (dashboard)/
    │       ├── inbox/             ← Ver conversaciones
    │       ├── end-users/         ← Ver clientes (Juan, María)
    │       ├── team/              ← Gestionar equipo
    │       ├── settings/          ← Plan, capabilities
    │       └── analytics/         ← Métricas
    ├── components/
    │   ├── ConversationList       ← Lista de WhatsApp/Instagram
    │   ├── MessageThread          ← Ver historial + responder
    │   └── EndUserCard            ← Perfil de end-user
    └── lib/
        └── api/
            └── admin-client.ts    ← API client (admin-contract.json)
```

---

## 📋 Plan de Migración (3 Semanas)

### Week 1: Setup + Auth

**Día 1-2: Nuevo proyecto**
```bash
# Crear nuevo proyecto Next.js
npx create-next-app@latest inhost-admin-dashboard --typescript --tailwind --app

# Instalar dependencias
cd inhost-admin-dashboard
npm install @tanstack/react-query axios zustand
npm install -D @types/node
```

**Día 3-5: Autenticación**
- Implementar login/logout con JWT
- Proteger rutas con middleware
- Crear context de autenticación

```typescript
// src/lib/auth/jwt.ts
export async function login(email: string, password: string) {
  const res = await fetch('http://localhost:3000/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const { data } = await res.json();

  // Guardar JWT
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));

  return data;
}
```

### Week 2: Core Features

**Día 1-2: Dashboard Home**
- Layout con sidebar
- Métricas básicas (total end-users, mensajes, etc.)
- Gráficos simples

**Día 3-5: Inbox de Conversaciones**
- Lista de conversaciones (todas las fuentes: WhatsApp, Instagram, UI externa)
- Vista de mensajes (thread)
- Enviar respuestas
- WebSocket para real-time updates

```typescript
// src/app/(dashboard)/inbox/page.tsx
'use client';

import { useConversations } from '@/hooks/useConversations';
import { useAuth } from '@/hooks/useAuth';

export default function InboxPage() {
  const { user } = useAuth(); // admin@tiendaxyz.com
  const { conversations, loading } = useConversations();

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Lista de conversaciones */}
      <div className="col-span-1">
        <ConversationList
          conversations={conversations}
          tenantId={user.tenant.id}
        />
      </div>

      {/* Thread de mensajes */}
      <div className="col-span-2">
        <MessageThread conversationId={selectedConv} />
      </div>
    </div>
  );
}
```

### Week 3: Features Adicionales

**Día 1-2: End Users**
- Lista de end-users (todos los canales)
- Perfil de end-user
- Filtros (canal, activos, búsqueda)

**Día 3-4: Settings**
- Ver plan actual
- Lista de capabilities
- Configuración de webhooks

**Día 5: Polish + Deploy**
- Testing E2E
- Deploy a Vercel/Netlify
- Documentación

---

## 🔐 Autenticación y Headers

### Admin Dashboard → Backend

**Login:**
```typescript
POST /admin/auth/login
Body: {
  email: "admin@tiendaxyz.com",
  password: "********"
}

Response: {
  token: "eyJhbGc...",
  user: {
    id: "uuid",
    email: "admin@tiendaxyz.com",
    role: "owner",
    tenant: {
      id: "tienda-xyz-uuid",
      name: "Tienda XYZ",
      plan: "professional"
    }
  }
}
```

**Todas las requests subsecuentes:**
```typescript
fetch('/admin/conversations', {
  headers: {
    'Authorization': 'Bearer eyJhbGc...',
    'Content-Type': 'application/json'
  }
});
```

**JWT Payload:**
```json
{
  "sub": "tenant_user_id",
  "email": "admin@tiendaxyz.com",
  "tenant_id": "tienda-xyz-uuid",
  "role": "owner",
  "exp": 1700086400
}
```

Backend extrae `tenant_id` del JWT → Filtra automáticamente:
```sql
-- Backend aplica filtro automático
SELECT c.* FROM conversations c
JOIN end_users eu ON eu.id = c.end_user_id
WHERE eu.tenant_id = '<tenant_id_from_jwt>'  -- Auto-filtrado
```

---

## 📡 WebSocket (Admin Dashboard)

### Conexión

```typescript
// src/lib/websocket/admin-ws.ts
import { useAuth } from '@/hooks/useAuth';

export function useAdminWebSocket() {
  const { token } = useAuth();

  useEffect(() => {
    const ws = new WebSocket(
      `ws://localhost:3000/admin/realtime?token=${token}`
    );

    ws.onopen = () => {
      console.log('✅ Connected to admin WebSocket');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'conversation:new':
          // Nueva conversación (desde WhatsApp/Instagram/UI)
          handleNewConversation(data.data);
          break;

        case 'message:new':
          // Nuevo mensaje (de end-user desde cualquier canal)
          handleNewMessage(data.data);
          break;

        case 'end_user:online':
          // End-user cambió estado
          updateEndUserStatus(data.data);
          break;
      }
    };

    return () => ws.close();
  }, [token]);
}
```

### Eventos que Recibe Admin Dashboard

**Nueva Conversación:**
```json
{
  "type": "conversation:new",
  "data": {
    "conversationId": "uuid",
    "endUser": {
      "id": "uuid",
      "name": "Juan Pérez",
      "phone": "+5215512345678"
    },
    "channel": "whatsapp",
    "lastMessage": "¿Dónde está mi pedido?"
  }
}
```

**Nuevo Mensaje:**
```json
{
  "type": "message:new",
  "data": {
    "conversationId": "uuid",
    "message": {
      "id": "uuid",
      "type": "incoming",
      "text": "Necesito ayuda",
      "createdAt": "2025-11-19T10:00:00Z"
    },
    "endUser": {
      "name": "María López",
      "phone": "+5215522222222"
    },
    "channel": "instagram"
  }
}
```

---

## 🎨 UI Components Clave

### 1. ConversationList

```typescript
// src/components/dashboard/ConversationList.tsx
interface Conversation {
  id: string;
  endUser: {
    name: string;
    phone: string;
    channel: 'whatsapp' | 'instagram' | 'web';
  };
  lastMessage: {
    text: string;
    timestamp: string;
  };
  unreadCount: number;
}

export function ConversationList({ conversations }: { conversations: Conversation[] }) {
  return (
    <div className="space-y-2">
      {conversations.map(conv => (
        <div key={conv.id} className="p-4 border rounded hover:bg-gray-50 cursor-pointer">
          {/* Channel Icon */}
          <div className="flex items-center gap-2">
            {conv.endUser.channel === 'whatsapp' && '📱'}
            {conv.endUser.channel === 'instagram' && '📷'}
            {conv.endUser.channel === 'web' && '🌐'}

            <div className="flex-1">
              <div className="font-semibold">{conv.endUser.name}</div>
              <div className="text-sm text-gray-600">{conv.endUser.phone}</div>
            </div>

            {/* Unread badge */}
            {conv.unreadCount > 0 && (
              <span className="bg-blue-500 text-white rounded-full px-2 py-1 text-xs">
                {conv.unreadCount}
              </span>
            )}
          </div>

          {/* Last message preview */}
          <div className="text-sm text-gray-500 mt-2 truncate">
            {conv.lastMessage.text}
          </div>

          {/* Timestamp */}
          <div className="text-xs text-gray-400 mt-1">
            {formatRelativeTime(conv.lastMessage.timestamp)}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 2. MessageThread

```typescript
// src/components/dashboard/MessageThread.tsx
export function MessageThread({ conversationId }: { conversationId: string }) {
  const { messages, sendMessage } = useMessages(conversationId);
  const [text, setText] = useState('');

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={cn(
              'flex',
              msg.type === 'incoming' ? 'justify-start' : 'justify-end'
            )}
          >
            <div
              className={cn(
                'max-w-xs rounded-lg px-4 py-2',
                msg.type === 'incoming'
                  ? 'bg-gray-100'
                  : 'bg-blue-500 text-white'
              )}
            >
              <p>{msg.content.text}</p>
              {msg.metadata?.aiGenerated && (
                <span className="text-xs opacity-70">🤖 AI</span>
              )}
              <div className="text-xs opacity-70 mt-1">
                {formatTime(msg.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 border rounded px-4 py-2"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                sendMessage({ text });
                setText('');
              }
            }}
          />
          <button
            onClick={() => {
              sendMessage({ text });
              setText('');
            }}
            className="bg-blue-500 text-white px-6 py-2 rounded"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3. EndUserCard

```typescript
// src/components/dashboard/EndUserCard.tsx
export function EndUserCard({ endUser }: { endUser: EndUser }) {
  return (
    <div className="border rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-2xl">
          {endUser.name?.charAt(0) || '?'}
        </div>
        <div>
          <h2 className="text-xl font-semibold">{endUser.name}</h2>
          <div className="text-gray-600">{endUser.phone}</div>
          <div className="text-gray-600">{endUser.email}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div>
          <div className="text-2xl font-bold">{endUser.stats.totalConversations}</div>
          <div className="text-sm text-gray-600">Conversaciones</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{endUser.stats.totalMessages}</div>
          <div className="text-sm text-gray-600">Mensajes</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{endUser.stats.avgResponseTime}</div>
          <div className="text-sm text-gray-600">Resp. Promedio</div>
        </div>
      </div>

      {/* Custom Fields */}
      {endUser.customFields && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Información Adicional</h3>
          <dl className="space-y-2">
            {Object.entries(endUser.customFields).map(([key, value]) => (
              <div key={key} className="flex">
                <dt className="text-gray-600 w-1/3">{key}:</dt>
                <dd className="font-medium">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Tags */}
      {endUser.tags && endUser.tags.length > 0 && (
        <div className="mt-4 flex gap-2">
          {endUser.tags.map(tag => (
            <span key={tag} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## ✅ Checklist de Implementación

### Backend (API Endpoints)

- [ ] Crear `/admin/auth/*` endpoints
- [ ] Crear `/admin/conversations` endpoints
- [ ] Crear `/admin/end-users` endpoints
- [ ] Crear `/admin/team` endpoints
- [ ] Crear `/admin/capabilities` endpoints
- [ ] Crear `/admin/analytics` endpoints
- [ ] Implementar JWT auth middleware
- [ ] WebSocket `/admin/realtime`

### Frontend (Admin Dashboard)

- [ ] Setup Next.js proyecto
- [ ] Implementar login/logout
- [ ] Dashboard home (métricas)
- [ ] Inbox (conversaciones multi-canal)
- [ ] Message thread + responder
- [ ] Lista de end-users
- [ ] Perfil de end-user
- [ ] Settings (plan, capabilities)
- [ ] Team management
- [ ] WebSocket integration
- [ ] Responsive design
- [ ] Dark mode (opcional)

### Testing

- [ ] E2E tests (Playwright)
- [ ] Unit tests (Vitest)
- [ ] Integration tests
- [ ] Load testing

### Deploy

- [ ] Deploy backend (Railway/Fly.io)
- [ ] Deploy frontend (Vercel/Netlify)
- [ ] Setup domain (app.inhost.com)
- [ ] SSL certificates
- [ ] Monitoring (Sentry)

---

## 🚀 Próximos Pasos Inmediatos

1. **Crear endpoints backend `/admin/*`**
   - Usar `api-contract-admin.json` como guía
   - Implementar JWT auth

2. **Setup nuevo proyecto Next.js**
   ```bash
   npx create-next-app@latest inhost-admin-dashboard
   ```

3. **Implementar autenticación**
   - Login page
   - JWT storage
   - Protected routes

4. **Build Inbox MVP**
   - Listar conversaciones
   - Ver mensajes
   - Responder

¿Empezamos creando los endpoints `/admin/*` en el backend?
