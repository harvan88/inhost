# 🎨 Frontend Multi-Tenancy - Guía de Restructuración

## 🎯 El Cambio Fundamental

### Antes (Frontend Actual)
```
Un solo frontend → Un solo tipo de usuario → API simple
```

**Problema:** No diferencia entre:
- ❌ Admin que configura el servicio
- ❌ Cliente final que envía mensajes

### Después (Multi-Tenancy)
```
DOS frontends → DOS tipos de usuarios → DOS APIs diferentes
```

**Solución:** Separar claramente:
- ✅ **Admin Dashboard** (Tenant Users) - Configuran y gestionan
- ✅ **Chat Widget** (End Users) - Chatean con la organización

---

## 📊 Arquitectura de Frontends

```
┌────────────────────────────────────────────────────────────────┐
│                     INHOST Platform                            │
└────────────────────┬───────────────────────┬───────────────────┘
                     │                       │
                     ↓                       ↓
┌──────────────────────────────┐  ┌──────────────────────────────┐
│   FRONTEND 1: Admin Dashboard│  │  FRONTEND 2: Chat Widget     │
│   (Tenant Users)             │  │  (End Users)                 │
│                              │  │                              │
│  👤 Usuario:                 │  │  👤 Usuario:                 │
│     admin@tiendaxyz.com      │  │     Juan Pérez               │
│                              │  │     (+5215512345678)         │
│  🎯 Objetivo:                │  │                              │
│     Gestionar servicio       │  │  🎯 Objetivo:                │
│                              │  │     Chatear/soporte          │
│  📍 URL:                     │  │                              │
│     https://app.inhost.com   │  │  📍 URL:                     │
│                              │  │     https://chat.tiendaxyz.com│
│  🔐 Auth:                    │  │     (o widget embebido)      │
│     Email/Password           │  │                              │
│     JWT Token                │  │  🔐 Auth:                    │
│                              │  │     Phone verification       │
│  📦 Features:                │  │     (WhatsApp, Telegram)     │
│     • Ver end-users          │  │                              │
│     • Ver conversaciones     │  │  📦 Features:                │
│     • Métricas/dashboard     │  │     • Enviar mensajes        │
│     • Configurar plan        │  │     • Ver historial          │
│     • Gestionar team         │  │     • Adjuntar archivos      │
│     • Billing                │  │     • Indicador de "typing"  │
└──────────────────────────────┘  └──────────────────────────────┘
                     │                       │
                     ↓                       ↓
┌──────────────────────────────────────────────────────────────┐
│                      Backend API                              │
│                                                               │
│  /admin/*  ← Admin Dashboard endpoints                       │
│  /chat/*   ← Chat Widget endpoints                           │
│  /public/* ← Public endpoints (health, etc.)                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 Cómo Cambia el Contrato Actual

### Estado Actual (api-contract.json)

```json
{
  "headers": {
    "required": [
      {
        "name": "X-User-Id",  // ← Ambiguo: ¿tenant user o end user?
        "value": "<userId>"
      }
    ]
  }
}
```

**Problema:** `X-User-Id` no distingue entre tenant user y end user.

### Nuevo Contrato (Multi-Tenancy)

```json
{
  "adminAPI": {
    "baseURL": "https://api.inhost.com/admin",
    "headers": {
      "required": [
        {
          "name": "Authorization",
          "value": "Bearer <jwt_token>",
          "description": "JWT del tenant_user autenticado"
        }
      ]
    }
  },
  "chatAPI": {
    "baseURL": "https://api.inhost.com/chat",
    "headers": {
      "required": [
        {
          "name": "X-Tenant-Id",
          "value": "<tenant_id>",
          "description": "ID de la organización"
        },
        {
          "name": "X-End-User-Id",
          "value": "<end_user_id>",
          "description": "ID del cliente final (o phone)"
        }
      ]
    }
  }
}
```

---

## 📋 Frontend 1: Admin Dashboard (Tenant Users)

### ¿Quién lo usa?
- Empleados de "Tienda XYZ" que configuran el servicio
- Roles: owner, admin, agent, viewer

### ¿Qué hace?
Dashboard completo para gestionar el servicio de chat de la organización

### Tecnología Recomendada
- **Framework:** React, Vue, o Svelte
- **Auth:** JWT-based authentication
- **UI:** Dashboard completo (Next.js App Router ideal)

### Estructura de Archivos

```
inhost-admin-dashboard/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   └── forgot-password/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx      # Layout con sidebar
│   │   │   ├── page.tsx        # Dashboard home
│   │   │   ├── conversations/
│   │   │   │   ├── page.tsx    # Lista de conversaciones
│   │   │   │   └── [id]/page.tsx  # Detalle de conversación
│   │   │   ├── end-users/
│   │   │   │   ├── page.tsx    # Lista de clientes
│   │   │   │   └── [id]/page.tsx  # Perfil de cliente
│   │   │   ├── team/
│   │   │   │   └── page.tsx    # Gestión de equipo
│   │   │   ├── settings/
│   │   │   │   ├── plan/       # Plan y billing
│   │   │   │   ├── capabilities/  # Extensiones habilitadas
│   │   │   │   └── integrations/  # WhatsApp, Telegram
│   │   │   └── analytics/
│   │   │       └── page.tsx    # Métricas y reportes
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── dashboard/
│   │   │   ├── ConversationList.tsx
│   │   │   ├── EndUserCard.tsx
│   │   │   ├── MetricsWidget.tsx
│   │   │   └── TeamMemberList.tsx
│   ├── lib/
│   │   ├── api/
│   │   │   ├── admin-client.ts  # API client para admin
│   │   │   └── types.ts
│   │   └── auth/
│   │       └── jwt.ts          # JWT helpers
│   └── hooks/
│       ├── useTenantInfo.ts
│       ├── useConversations.ts
│       └── useEndUsers.ts
└── package.json
```

### Ejemplo de Componente

```typescript
// src/components/dashboard/ConversationList.tsx
'use client';

import { useConversations } from '@/hooks/useConversations';
import { useAuth } from '@/hooks/useAuth';

export function ConversationList() {
  const { tenantUser } = useAuth(); // admin@tiendaxyz.com
  const { conversations, loading } = useConversations({
    tenantId: tenantUser.tenantId
  });

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <h2>Conversaciones de {tenantUser.tenantName}</h2>
      {conversations.map(conv => (
        <ConversationCard
          key={conv.id}
          conversation={conv}
          endUser={conv.endUser}  // Juan Pérez (+52...)
        />
      ))}
    </div>
  );
}
```

### API Endpoints Necesarios (Admin)

```typescript
// Admin API Contract
export const adminAPIEndpoints = {
  // Autenticación
  login: 'POST /admin/auth/login',
  logout: 'POST /admin/auth/logout',
  me: 'GET /admin/auth/me',

  // Tenant Info
  getTenant: 'GET /admin/tenant',
  updateTenant: 'PATCH /admin/tenant',
  upgradePlan: 'POST /admin/tenant/upgrade',

  // End Users (clientes)
  listEndUsers: 'GET /admin/end-users',
  getEndUser: 'GET /admin/end-users/:id',
  createEndUser: 'POST /admin/end-users',
  updateEndUser: 'PATCH /admin/end-users/:id',
  deleteEndUser: 'DELETE /admin/end-users/:id',

  // Conversaciones
  listConversations: 'GET /admin/conversations',
  getConversation: 'GET /admin/conversations/:id',
  getMessages: 'GET /admin/conversations/:id/messages',

  // Team (tenant_users)
  listTeam: 'GET /admin/team',
  inviteTeamMember: 'POST /admin/team/invite',
  updateTeamMember: 'PATCH /admin/team/:id',
  removeTeamMember: 'DELETE /admin/team/:id',

  // Capabilities
  listCapabilities: 'GET /admin/capabilities',
  toggleCapability: 'POST /admin/capabilities/:serviceId/toggle',

  // Analytics
  getDashboard: 'GET /admin/analytics/dashboard',
  getMetrics: 'GET /admin/analytics/metrics',
  exportReport: 'GET /admin/analytics/export',

  // Billing
  getBillingInfo: 'GET /admin/billing',
  updatePaymentMethod: 'POST /admin/billing/payment-method',
  getInvoices: 'GET /admin/billing/invoices'
};
```

---

## 💬 Frontend 2: Chat Widget (End Users)

### ¿Quién lo usa?
- Clientes finales de "Tienda XYZ"
- Ejemplo: Juan Pérez chateando por soporte

### ¿Qué hace?
Widget de chat simple (como Intercom, Crisp)

### Tecnología Recomendada
- **Framework:** React (para embeber en cualquier sitio)
- **Distribución:** NPM package + script tag
- **Auth:** Phone verification / WhatsApp context

### Estructura de Archivos

```
inhost-chat-widget/
├── src/
│   ├── Widget.tsx              # Componente principal
│   ├── components/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageInput.tsx
│   │   ├── TypingIndicator.tsx
│   │   └── AttachmentButton.tsx
│   ├── lib/
│   │   ├── api/
│   │   │   └── chat-client.ts  # API client para chat
│   │   ├── websocket/
│   │   │   └── ws-client.ts    # WebSocket connection
│   │   └── storage/
│   │       └── local-storage.ts
│   ├── hooks/
│   │   ├── useMessages.ts
│   │   ├── useWebSocket.ts
│   │   └── useTypingIndicator.ts
│   └── styles/
│       └── widget.css
├── dist/
│   ├── inhost-widget.js        # Bundle UMD
│   └── inhost-widget.css
└── package.json
```

### Ejemplo de Uso

```html
<!-- Sitio web de Tienda XYZ -->
<!DOCTYPE html>
<html>
<head>
  <title>Tienda XYZ</title>
</head>
<body>
  <h1>Bienvenido a Tienda XYZ</h1>

  <!-- Widget de chat embebido -->
  <script src="https://cdn.inhost.com/widget/v1/inhost-widget.js"></script>
  <script>
    InhostWidget.init({
      tenantId: 'tienda-xyz',  // ← ID de la organización
      channel: 'web',
      position: 'bottom-right',
      theme: {
        primaryColor: '#007bff',
        brandName: 'Tienda XYZ'
      },
      // Auto-identificar end-user (opcional)
      endUser: {
        phone: '+5215512345678',  // Si está logueado
        name: 'Juan Pérez',
        email: 'juan@example.com'
      }
    });
  </script>
</body>
</html>
```

### API Endpoints Necesarios (Chat)

```typescript
// Chat API Contract
export const chatAPIEndpoints = {
  // Autenticación de end-user (opcional)
  verifyPhone: 'POST /chat/auth/verify-phone',
  verifyOTP: 'POST /chat/auth/verify-otp',

  // Conversación
  getOrCreateConversation: 'POST /chat/conversations',
  getMessages: 'GET /chat/conversations/:id/messages',
  sendMessage: 'POST /chat/conversations/:id/messages',

  // Archivos
  uploadAttachment: 'POST /chat/attachments',

  // Typing indicator
  sendTypingIndicator: 'POST /chat/conversations/:id/typing',

  // WebSocket
  wsConnect: 'WS /chat/realtime'
};
```

### Componente Chat Widget

```typescript
// src/Widget.tsx
import { useMessages } from './hooks/useMessages';
import { useWebSocket } from './hooks/useWebSocket';

interface WidgetProps {
  tenantId: string;
  endUser?: {
    phone?: string;
    name?: string;
    email?: string;
  };
}

export function ChatWidget({ tenantId, endUser }: WidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, sendMessage } = useMessages({
    tenantId,
    endUserId: endUser?.phone  // Identificar por phone
  });

  const { connected, typing } = useWebSocket({
    tenantId,
    endUserId: endUser?.phone
  });

  return (
    <div className="inhost-widget">
      {/* Botón flotante */}
      {!isOpen && (
        <button
          className="inhost-trigger"
          onClick={() => setIsOpen(true)}
        >
          💬
        </button>
      )}

      {/* Ventana de chat */}
      {isOpen && (
        <div className="inhost-chat-window">
          <Header tenantName="Tienda XYZ" onClose={() => setIsOpen(false)} />

          <MessageList messages={messages} />

          {typing && <TypingIndicator />}

          <MessageInput onSend={sendMessage} />
        </div>
      )}
    </div>
  );
}
```

---

## 🔐 Autenticación y Autorización

### Admin Dashboard (Tenant Users)

```typescript
// Login flow
POST /admin/auth/login
Body: {
  email: "admin@tiendaxyz.com",
  password: "********"
}

Response: {
  success: true,
  data: {
    token: "eyJhbGc...",  // JWT
    user: {
      id: "uuid",
      email: "admin@tiendaxyz.com",
      name: "Admin Tienda XYZ",
      role: "owner",
      tenant: {
        id: "tienda-xyz",
        name: "Tienda XYZ",
        plan: "professional"
      }
    }
  }
}

// Todas las requests subsecuentes:
Authorization: Bearer eyJhbGc...
```

**JWT Payload:**
```json
{
  "sub": "tenant_user_id",
  "email": "admin@tiendaxyz.com",
  "tenant_id": "tienda-xyz",
  "role": "owner",
  "iat": 1700000000,
  "exp": 1700086400
}
```

### Chat Widget (End Users)

```typescript
// Opción 1: Identificación por phone (WhatsApp-style)
Headers: {
  "X-Tenant-Id": "tienda-xyz",
  "X-End-User-Phone": "+5215512345678"
}

// Backend auto-crea end_user si no existe
const endUser = await getOrCreateEndUser({
  tenantId: 'tienda-xyz',
  phone: '+5215512345678',
  channel: 'web'
});

// Opción 2: Identificación con OTP (más seguro)
// 1. Solicitar OTP
POST /chat/auth/verify-phone
Body: { tenantId: "tienda-xyz", phone: "+5215512345678" }

// 2. Verificar OTP
POST /chat/auth/verify-otp
Body: { phone: "+5215512345678", otp: "123456" }
Response: {
  token: "eyJhbGc...",  // JWT de end-user
  endUser: {
    id: "uuid",
    phone: "+5215512345678",
    name: "Juan Pérez"
  }
}
```

---

## 📡 WebSocket - Dos Canales

### Admin WebSocket (Tenant Users)

```typescript
// wss://api.inhost.com/admin/realtime
// Auth: JWT en query param o header

ws.connect('wss://api.inhost.com/admin/realtime?token=<jwt>');

// Eventos que recibe:
{
  "type": "conversation:new",
  "data": {
    "conversationId": "uuid",
    "endUser": { "name": "Juan Pérez", "phone": "+52..." },
    "lastMessage": "Hola, necesito ayuda"
  }
}

{
  "type": "message:new",
  "data": {
    "conversationId": "uuid",
    "message": { ... },
    "endUser": { ... }
  }
}

{
  "type": "end_user:online",
  "data": {
    "endUserId": "uuid",
    "status": "online"
  }
}
```

### Chat WebSocket (End Users)

```typescript
// wss://api.inhost.com/chat/realtime
// Auth: X-Tenant-Id + X-End-User-Id headers

ws.connect('wss://api.inhost.com/chat/realtime', {
  headers: {
    'X-Tenant-Id': 'tienda-xyz',
    'X-End-User-Id': 'end-user-uuid'
  }
});

// Eventos que recibe:
{
  "type": "message:new",
  "data": {
    "messageId": "uuid",
    "type": "outgoing",  // Respuesta del agente
    "text": "Hola Juan, ¿en qué puedo ayudarte?"
  }
}

{
  "type": "agent:typing",
  "data": {
    "agentName": "María (Agente)"
  }
}

{
  "type": "message:delivered",
  "data": {
    "messageId": "uuid",
    "status": "delivered"
  }
}
```

---

## 🔄 Flujo Completo de Interacción

### Escenario: Juan pregunta por su pedido

```
1. Juan abre chat widget en tiendaxyz.com

   Frontend (Widget):
   InhostWidget.init({
     tenantId: 'tienda-xyz',
     endUser: { phone: '+5215512345678', name: 'Juan' }
   })

2. Widget conecta a WebSocket

   WS → wss://api.inhost.com/chat/realtime
   Headers: { X-Tenant-Id: 'tienda-xyz', X-End-User-Phone: '+52...' }

3. Juan escribe: "¿Dónde está mi pedido #123?"

   POST /chat/conversations/:id/messages
   Headers: {
     X-Tenant-Id: 'tienda-xyz',
     X-End-User-Id: 'end-user-uuid'
   }
   Body: {
     text: "¿Dónde está mi pedido #123?"
   }

4. Backend procesa:
   - Identifica tenant: Tienda XYZ
   - Identifica end-user: Juan Pérez
   - Verifica capabilities: ¿Tienda XYZ tiene AI?
   - Si tiene AI → Genera respuesta inteligente
   - Broadcast vía WebSocket

5. Admin Dashboard recibe notificación

   WS Event (Admin):
   {
     type: "message:new",
     conversationId: "uuid",
     endUser: { name: "Juan Pérez", phone: "+52..." },
     message: "¿Dónde está mi pedido #123?"
   }

   → Admin ve nueva conversación en dashboard
   → Puede responder manualmente

6. Widget recibe respuesta

   WS Event (Chat):
   {
     type: "message:new",
     message: {
       type: "outgoing",
       text: "Hola Juan, tu pedido #123 está en camino..."
     }
   }

   → Juan ve respuesta en widget
```

---

## 📦 Migración del Frontend Actual

### Paso 1: Identificar el uso actual

Tu frontend actual (`inhostfrontend`) parece ser:
- ❌ Mezcla de admin + chat
- ❌ Sin autenticación clara
- ❌ `X-User-Id` ambiguo

### Paso 2: Decisión Estratégica

**Opción A: Bifurcar en 2 frontends** (Recomendado)
```
inhost-admin-dashboard/    ← Nuevo (Next.js)
inhost-chat-widget/        ← Nuevo (React widget)
inhostfrontend/            ← Deprecar
```

**Opción B: Multi-modo en un solo frontend**
```typescript
// Detectar contexto
if (isAdminRoute) {
  return <AdminDashboard />;
} else {
  return <ChatWidget />;
}
```

**Recomendación:** Opción A (dos frontends separados) porque:
- ✅ Separación clara de responsabilidades
- ✅ Deploy independiente
- ✅ Optimización específica (dashboard vs widget)
- ✅ Escalabilidad

### Paso 3: Plan de Migración

```
Week 1-2: Admin Dashboard MVP
- Login/Signup
- Dashboard home con métricas
- Lista de conversaciones
- Ver mensajes

Week 3-4: Chat Widget MVP
- Widget embebible
- Enviar/recibir mensajes
- WebSocket en tiempo real

Week 5: Integración Multi-Tenancy
- Migrar backend a usar tenant_id
- Actualizar contratos
- Testing E2E

Week 6: Deploy Beta
- Deploy admin dashboard
- Deploy widget
- Onboarding de primeros tenants
```

---

## 🎨 Diseño UI/UX

### Admin Dashboard

**Inspiración:** Intercom, Zendesk, HubSpot

```
┌────────────────────────────────────────────────────────┐
│  [Logo] Tienda XYZ     🔔 👤 admin@tiendaxyz.com      │
├────────────────────────────────────────────────────────┤
│              │                                         │
│  📊 Dashboard│  📈 Métricas (últimos 30 días)         │
│  💬 Inbox    │  ┌──────────┬──────────┬──────────┐    │
│  👥 Clientes │  │ 1,250    │ 45,230   │ 92%      │    │
│  👤 Equipo   │  │ Clientes │ Mensajes │ CSAT     │    │
│  ⚙️  Config   │  └──────────┴──────────┴──────────┘    │
│  💳 Billing  │                                         │
│              │  💬 Conversaciones Recientes            │
│              │  ┌─────────────────────────────────┐    │
│              │  │ 🟢 Juan Pérez (+52...)          │    │
│              │  │    "¿Dónde está mi pedido?"     │    │
│              │  │    Hace 2 min                    │    │
│              │  ├─────────────────────────────────┤    │
│              │  │ 🔴 María López (+52...)         │    │
│              │  │    "Quiero devolver un producto"│    │
│              │  │    Hace 10 min                   │    │
│              │  └─────────────────────────────────┘    │
└────────────────────────────────────────────────────────┘
```

### Chat Widget

**Inspiración:** Crisp, Drift, Intercom Messenger

```
┌─────────────────────────┐
│ 💬 Tienda XYZ       [x] │
├─────────────────────────┤
│                         │
│  🧑 Tú:                 │
│  Hola, ¿dónde está mi   │
│  pedido #123?           │
│                   10:30 │
│                         │
│  🤖 Bot:                │
│  Hola Juan! Tu pedido   │
│  #123 está en camino.   │
│  Llegará mañana.        │
│                   10:31 │
│                         │
│  María está escribiendo...│
│                         │
├─────────────────────────┤
│ [📎] Escribe mensaje... │
└─────────────────────────┘
```

---

## ✅ Checklist de Implementación

### Backend Updates

- [ ] Crear endpoints `/admin/*`
- [ ] Crear endpoints `/chat/*`
- [ ] Implementar JWT auth para tenant users
- [ ] Implementar phone verification para end users
- [ ] Actualizar WebSocket con namespaces
- [ ] Migrar `X-User-Id` → `X-Tenant-Id` + `X-End-User-Id`

### Admin Dashboard

- [ ] Setup Next.js proyecto
- [ ] Implementar autenticación (JWT)
- [ ] Dashboard home con métricas
- [ ] Inbox de conversaciones
- [ ] Vista de end-users
- [ ] Gestión de equipo
- [ ] Settings y capabilities
- [ ] Billing integration

### Chat Widget

- [ ] Setup React widget
- [ ] Build system (UMD bundle)
- [ ] WebSocket connection
- [ ] Message list + input
- [ ] Typing indicators
- [ ] File uploads
- [ ] Customizable theme
- [ ] NPM package + CDN

### Testing

- [ ] E2E tests (Playwright)
- [ ] Integration tests
- [ ] Load testing (WebSocket)
- [ ] Security audit

### Docs

- [ ] Admin Dashboard docs
- [ ] Chat Widget docs (embeding guide)
- [ ] API reference
- [ ] Migration guide

---

## 🚀 Próximos Pasos Inmediatos

1. **Crear nuevos endpoints en backend**
   - `/admin/*` para tenant users
   - `/chat/*` para end users

2. **Actualizar api-contract.json**
   - Separar en `admin-contract.json` y `chat-contract.json`

3. **Setup repositorios frontend**
   - `inhost-admin-dashboard` (Next.js)
   - `inhost-chat-widget` (React)

4. **Implementar autenticación**
   - JWT para tenant users
   - Phone verification para end users

¿Quieres que empiece creando los nuevos contratos de API (admin-contract.json y chat-contract.json)?
