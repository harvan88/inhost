# 🎯 Arquitectura: Separación Frontend/Backend

**Principio Fundamental:** El chat es un cliente delgado. El backend tiene toda la lógica.

---

## 📐 Principios de Diseño

### 1. Backend = Toda la Lógica

El backend es el **único dueño** de:
- ✅ **Lógica de negocio** (reglas, validaciones, workflows)
- ✅ **Estado autoritativo** (source of truth)
- ✅ **Procesamiento** (IA, extensiones, integraciones)
- ✅ **Persistencia** (base de datos, historial)
- ✅ **Seguridad** (autenticación, autorización, rate limiting)

### 2. Frontend = Cliente Delgado

El chat local es **solo una vista**:
- ✅ **RECIBE** mensajes del backend
- ✅ **ENTREGA** mensajes al backend
- ✅ **NOTIFICA** estados visuales
- ✅ **PERSISTE** localmente (cache/offline)

**NO hace:** Validación de negocio, procesamiento, routing, integraciones

---

## 🔒 Garantías Arquitectónicas

### Garantía #1: Cambio de Backend Transparente

**Si el backend cambia completamente pero respeta el contrato:**
```
Backend V1 (Bun + Elysia)  →  Backend V2 (Node + Express)
                             ↓
               Chat local sigue funcionando
```

**Contrato a respetar:**
- HTTP API: `POST /messages`, `GET /messages`
- WebSocket: `WS /realtime`
- Formato: `MessageEnvelopeV2`
- Respuestas de error estándar

**Ejemplo:**
```typescript
// Backend V1 (actual)
POST /messages
Body: MessageEnvelopeV2
Response: { success: true, data: MessageEnvelopeV2 }

// Backend V2 (futuro - mismo contrato)
POST /messages
Body: MessageEnvelopeV2
Response: { success: true, data: MessageEnvelopeV2 }

// Chat local: NO NECESITA CAMBIOS
```

---

### Garantía #2: Representación Virtual del Chat

**Si el chat local es eliminado/deshabilitado:**
```
Usuario Premium  →  Sin chat local instalado
                   ↓
     Sistema sigue procesando mensajes
              (representación virtual)
```

**¿Cómo funciona?**

El backend mantiene una **representación virtual** del chat:
- Mensajes se reciben por webhook (WhatsApp, Telegram, etc)
- Backend los procesa con extensiones/IA
- Respuestas se envían automáticamente
- Todo sin necesidad de chat local

**Flujo:**
```
WhatsApp → Webhook Backend → MessageCore → Extension (IA) → Response → WhatsApp
                               ↓
                  (Opcional) WebSocket → Chat Local
```

---

## 🏗️ Arquitectura por Capas

### Capa 1: Backend Core (Autoritativo)

```
┌─────────────────────────────────────┐
│        MessageCore (Orquestador)     │
│                                     │
│  • Recibe de CUALQUIER fuente       │
│  • Persiste SIEMPRE                 │
│  • Procesa con extensiones          │
│  • Notifica a TODOS los clientes    │
└─────────────────────────────────────┘
           ↓           ↓           ↓
   ┌───────────┐ ┌──────────┐ ┌──────────┐
   │  Adapters │ │Extensions│ │ Database │
   │ (WhatsApp)│ │   (IA)   │ │(Postgres)│
   └───────────┘ └──────────┘ └──────────┘
```

**Fuentes de mensajes:**
- Webhook de WhatsApp
- Webhook de Telegram
- HTTP API desde chat local
- WebSocket desde chat local
- Scheduled jobs (cron)

**Todas convergen en MessageCore** → Procesamiento único

---

### Capa 2: Notificación (Broadcast)

```
┌─────────────────────────────────────┐
│     WebSocketNotification (V1)      │
│      RedisPubSub (V2 - Sprint 4)    │
│                                     │
│  • Broadcast a TODOS los clientes   │
│  • Chat local recibe SI está online │
│  • Chat local NO afecta procesamiento│
└─────────────────────────────────────┘
           ↓           ↓           ↓
   ┌───────────┐ ┌──────────┐ ┌──────────┐
   │Chat Local │ │Dashboard │ │   API    │
   │ (Opcional)│ │  (Admin) │ │ Clients  │
   └───────────┘ └──────────┘ └──────────┘
```

**Clientes conectados:**
- Chat local del usuario (opcional)
- Dashboard de administración (opcional)
- Mobile app (futuro)
- Cualquier cliente WebSocket

**Ninguno es crítico** → Sistema funciona sin ellos

---

### Capa 3: Frontend (Cliente Delgado)

```
┌─────────────────────────────────────┐
│         Chat Local (Opcional)        │
│                                     │
│  SOLO responsable de:               │
│  • Mostrar mensajes (UI)            │
│  • Enviar input del usuario         │
│  • Cache local (IndexedDB/SQLite)   │
│  • Notificaciones visuales          │
│                                     │
│  NO hace:                           │
│  ✗ Validación de negocio            │
│  ✗ Procesamiento                    │
│  ✗ Routing entre canales            │
│  ✗ Integraciones                    │
└─────────────────────────────────────┘
```

---

## 📡 Flujo de Mensajes

### Flujo Completo (Con Chat Local)

```
1. Usuario escribe en Chat Local
   ↓
2. Chat Local → HTTP POST /messages (MessageEnvelope)
   ↓
3. Backend → Valida + Persiste + Procesa
   ↓
4. Backend → Extension IA genera respuesta
   ↓
5. Backend → Persiste respuesta
   ↓
6. Backend → Broadcast vía WebSocket
   ↓
7. Chat Local → Recibe y muestra
```

**Importante:** Si paso 1 falla (chat offline), pasos 2-6 siguen funcionando con webhooks.

---

### Flujo Sin Chat Local (Usuario Premium Virtual)

```
1. WhatsApp → Webhook Backend
   ↓
2. Backend → Valida + Persiste + Procesa
   ↓
3. Backend → Extension IA genera respuesta
   ↓
4. Backend → Persiste respuesta
   ↓
5. Backend → Envía vía Adapter WhatsApp
   ↓
6. WhatsApp → Usuario recibe
```

**Resultado:** Conversación completa sin chat local instalado.

---

## 🔐 Contrato API (Inmutable)

### MessageEnvelopeV2 (Contrato Base)

```typescript
interface MessageEnvelopeV2 {
  id: string;
  type: 'incoming' | 'outgoing' | 'system' | 'status';
  channel: 'whatsapp' | 'telegram' | 'web' | 'sms';
  content: {
    text?: string;
    media?: MediaContent[];
    buttons?: Button[];
    // Extensible
  };
  metadata: {
    from: string;
    to: string;
    timestamp: string;
    conversationId?: string;
    // Extensible
  };
  status?: MessageStatus;
}
```

**Reglas del Contrato:**
- ✅ Campos opcionales pueden agregarse
- ✅ Campos existentes NO pueden removerse
- ✅ Tipos existentes NO pueden cambiar
- ✅ Validación en backend (TypeBox)

---

### HTTP API (Contrato)

```typescript
// Enviar mensaje
POST /messages
Headers:
  Content-Type: application/json
  X-User-Id: <userId>
Body: MessageEnvelopeV2
Response: {
  success: boolean;
  data?: MessageEnvelopeV2;
  error?: { code: string; message: string; }
}

// Obtener mensajes
GET /messages?conversationId=<id>&limit=50&offset=0
Response: {
  success: boolean;
  data?: MessageEnvelopeV2[];
  metadata?: { total: number; hasMore: boolean; }
}
```

---

### WebSocket API (Contrato)

```typescript
// Conexión
WS /realtime

// Cliente → Servidor (enviar)
{
  type: 'typing' | 'new_message' | 'message_received';
  // ... campos específicos
}

// Servidor → Cliente (recibir)
{
  type: 'message:new' | 'message:status' | 'typing:indicator' | 'error';
  data: MessageEnvelopeV2 | ErrorData;
  timestamp: string;
}
```

---

## 🎯 Beneficios de la Separación

### 1. Frontend Intercambiable

```
Backend único → Múltiples frontends
                ├── Chat Web (React)
                ├── Chat Desktop (Electron)
                ├── Chat Mobile (React Native)
                └── Dashboard Admin (Vue)
```

**Todos comparten:**
- Misma API
- Misma lógica
- Mismos datos

---

### 2. Backend Escalable

```
Frontend único → Múltiples backends
                ├── Backend US (Elysia)
                ├── Backend EU (Elysia)
                └── Backend ASIA (Elysia)
```

**Load balancer decide** qué backend, frontend no se entera.

---

### 3. Offline-First Frontend

```
Chat Local:
  ├── Enviar → Queue local → Sync cuando online
  ├── Recibir → Cache local (IndexedDB)
  └── Mostrar → Desde cache (rápido)

Backend:
  └── Source of truth (siempre)
```

---

### 4. Representación Virtual (Premium)

```
Usuario Premium:
  ├── Opción A: Chat Local instalado → UX mejor
  └── Opción B: Sin chat → Funciona igual (virtual)

Backend:
  └── Procesa TODO igual (webhooks + IA)
```

**Ventaja competitiva:** Usuario premium no necesita instalar nada.

---

## 🚀 Casos de Uso Reales

### Caso 1: Migración de Backend

```
Situación: Migrar de Bun a Deno
Solución:
  1. Reescribir backend en Deno (mantener contratos)
  2. Deploy nuevo backend en paralelo
  3. Switch gradual con feature flags
  4. Chat local: CERO cambios

Tiempo de migración frontend: 0 horas
```

---

### Caso 2: Usuario Sin Conexión

```
Situación: Chat local offline 3 horas
Backend:
  - WhatsApp webhook → MessageCore → IA → Response
  - Todo procesado y respondido
  - Mensajes persistidos en DB

Chat local (cuando vuelve online):
  - Sync desde DB
  - Muestra conversación completa
  - Usuario no nota la diferencia
```

---

### Caso 3: Múltiples Dispositivos

```
Usuario con:
  - Chat Desktop (Mac)
  - Chat Mobile (iPhone)
  - Dashboard Web (Chrome)

Todos conectados a mismo WebSocket:
  - Mensaje enviado desde Mac
  - Aparece instantáneamente en iPhone y Chrome
  - Sincronización perfecta (broadcast)
```

---

## 📋 Checklist de Implementación

**Para mantener separación:**

### Backend
- [ ] ✅ Toda la lógica en MessageCore/Extensions
- [ ] ✅ Contratos de API versionados (v1, v2, ...)
- [ ] ✅ Validación de entrada con TypeBox
- [ ] ✅ Rate limiting en backend (no confiar en frontend)
- [ ] ✅ Autenticación/autorización en cada request
- [ ] ✅ Webhooks como fuente primaria (no HTTP API)
- [ ] ✅ WebSocket broadcast (no required client)

### Frontend
- [ ] ⚠️ NO validación de negocio (solo UI)
- [ ] ⚠️ NO procesamiento (enviar raw al backend)
- [ ] ⚠️ NO state management complejo (backend es source of truth)
- [ ] ✅ Cache local para UX (IndexedDB)
- [ ] ✅ Optimistic UI (actualizar antes de respuesta)
- [ ] ✅ Retry logic para requests fallidos
- [ ] ✅ Offline queue (sync cuando vuelva online)

---

## ✅ Validación de Arquitectura

**Preguntas para validar:**

1. ¿Puedo reemplazar el backend sin tocar el frontend?
   - ✅ Sí, si respeto contratos API

2. ¿Puedo eliminar el frontend y el sistema sigue funcionando?
   - ✅ Sí, webhooks + representación virtual

3. ¿Puedo agregar un nuevo frontend sin tocar el backend?
   - ✅ Sí, solo consume API existente

4. ¿El frontend puede funcionar offline?
   - ✅ Sí, con cache local + queue

5. ¿Puedo escalar backend horizontalmente?
   - 🔄 Sprint 4 (Redis PubSub)

---

## 🎓 Conclusión

**Arquitectura correcta:**
```
Backend = Cerebro (toda la lógica)
Frontend = Ojos y manos (mostrar y enviar)
```

**Arquitectura incorrecta:**
```
Backend = Base de datos (solo guardar)
Frontend = Cerebro (toda la lógica)
```

**Resultado:**
- ✅ Backend reemplazable
- ✅ Frontend reemplazable
- ✅ Frontend opcional (representación virtual)
- ✅ Escalabilidad horizontal
- ✅ Offline-first UX

---

**Última Actualización:** 2025-11-16
**Revisado por:** Claude Code
**Status:** Arquitectura validada en Sprint 1-3
