# CONTRATO BACKEND-FRONTEND - INAMOVIBLE

**Fecha:** 2025-11-19
**Status:** ✅ Backend implementado y verificado
**Requiere:** Frontend debe cumplir estas especificaciones EXACTAS

---

## 🎯 FLUJO DE AUTENTICACIÓN Y SYNC (OBLIGATORIO)

### 1️⃣ LOGIN - POST /admin/auth/login

**Request que Frontend DEBE enviar:**
```http
POST http://localhost:3000/admin/auth/login
Content-Type: application/json

{
  "email": "admin@test.com",
  "password": "password123"
}
```

**Response que Backend GARANTIZA:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@test.com",
      "name": "Admin Test",
      "role": "owner",
      "tenantId": "uuid",
      "tenantName": "Test Company",
      "tenantSlug": "test-company"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
      "expiresIn": 604800
    }
  },
  "metadata": {
    "timestamp": "2025-11-19T..."
  }
}
```

**OBLIGACIÓN DE FRONTEND:**
```typescript
// ✅ INMEDIATAMENTE después de recibir la respuesta:
const token = response.data.tokens.accessToken;
localStorage.setItem('inhost_access_token', token);

// ✅ VERIFICAR que se guardó:
const saved = localStorage.getItem('inhost_access_token');
if (!saved) {
  throw new Error('Failed to save token');
}
```

---

### 2️⃣ SYNC INICIAL - GET /admin/sync/initial

**Request que Frontend DEBE enviar:**
```http
GET http://localhost:3000/admin/sync/initial
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Content-Type: application/json
```

**⚠️ OBLIGATORIO:** Header `Authorization` con el token del login

**Response que Backend GARANTIZA (Status 200):**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "uuid",
        "endUserId": "uuid",
        "status": "active",
        "channel": "whatsapp",
        "isPinned": false,
        "unreadCount": 0,
        "lastMessage": {
          "id": "uuid",
          "text": "Último mensaje aquí",
          "type": "incoming",
          "timestamp": "2025-11-19T..."
        },
        "assignedTo": {
          "id": "uuid",
          "name": "Admin Test"
        },
        "createdAt": "2025-11-19T...",
        "updatedAt": "2025-11-19T..."
      }
    ],
    "contacts": [
      {
        "id": "uuid",
        "externalId": "+1234567890",
        "channel": "whatsapp",
        "name": "Juan Pérez",
        "email": "juan.perez@example.com",
        "phone": null,
        "avatarUrl": null,
        "metadata": {},
        "tags": [],
        "isBlocked": false,
        "createdAt": "2025-11-19T..."
      }
    ],
    "team": [
      {
        "id": "uuid",
        "email": "admin@test.com",
        "name": "Admin Test",
        "role": "owner",
        "isActive": true,
        "lastLoginAt": "2025-11-19T...",
        "createdAt": "2025-11-19T..."
      }
    ],
    "integrations": []
  }
}
```

**Response en caso de error (Status 200, success: false):**
```json
{
  "success": false,
  "error": {
    "code": "SYNC_FAILED",
    "message": "Failed to fetch initial data",
    "details": null,
    "timestamp": "2025-11-19T..."
  }
}
```

**CAUSAS POSIBLES DEL ERROR:**
1. ❌ No enviaron header `Authorization`
2. ❌ Token es `undefined` o `null`
3. ❌ Token es inválido o expirado

---

## 🔐 AUTENTICACIÓN EN TODAS LAS PETICIONES

**TODAS las peticiones a `/admin/*` DEBEN incluir:**

```http
Authorization: Bearer <token>
```

**Cómo Frontend DEBE implementarlo:**

```typescript
class AdminAPIClient {
  private baseUrl = 'http://localhost:3000';

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // 1. Leer token de localStorage
    const token = localStorage.getItem('inhost_access_token');

    // 2. Validar que existe
    if (!token) {
      throw new Error('No authentication token found. User must login first.');
    }

    // 3. Hacer petición CON el token
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`, // ← OBLIGATORIO
        ...options.headers,
      },
    });

    // 4. Parsear respuesta
    const data = await response.json();

    // 5. Si backend dice success: false, lanzar error
    if (!data.success) {
      throw new Error(`API Error: ${data.error?.message || 'Unknown error'}`);
    }

    return data;
  }
}
```

---

## 📡 WEBSOCKET - ws://localhost:3000/realtime

**Conexión que Frontend DEBE hacer:**

```typescript
const WS_URL = 'ws://localhost:3000/realtime';
const ws = new WebSocket(WS_URL);

// Cuando el usuario se conecta
ws.onopen = () => {
  console.log('✅ WebSocket connected');
};

// Eventos que recibirán del backend (VERIFICADOS)
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'connection':
      // Conexión establecida con el servidor
      console.log('Connected, clientId:', data.clientId);
      break;

    case 'echo':
      // Echo del mensaje enviado (desarrollo)
      console.log('Echo received:', data.data);
      break;

    case 'typing':
      // Usuario está escribiendo
      // data = { userId, conversationId, isTyping, timestamp }
      handleTypingIndicator(data);
      break;

    case 'error':
      // Error del servidor
      console.error('WebSocket error:', data);
      break;
  }
};
```

**⚠️ NOTA IMPORTANTE:** Los eventos `message:new`, `conversation:updated`, `conversation:read` **NO ESTÁN IMPLEMENTADOS** actualmente en el backend.

---

## 🚫 LO QUE FRONTEND NO DEBE HACER

### ❌ NO usar datos mock después del login exitoso
Si el login funciona, DEBEN usar datos del backend, no mocks.

### ❌ NO hacer sync sin guardar el token primero
Orden correcto:
1. Login
2. Guardar token en localStorage
3. Sync (que lee el token de localStorage)

### ❌ NO modificar la estructura de respuesta del backend
Backend devuelve `response.data.tokens.accessToken`, no cambiar esa ruta.

### ❌ NO ignorar el campo `success` en las respuestas
Siempre verificar: `if (!response.success) { /* error */ }`

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN FRONTEND

Marcar cuando esté implementado:

- [ ] **1. Login guarda token en localStorage**
  ```typescript
  localStorage.setItem('inhost_access_token', response.data.tokens.accessToken);
  ```

- [ ] **2. AdminAPIClient lee token de localStorage**
  ```typescript
  const token = localStorage.getItem('inhost_access_token');
  ```

- [ ] **3. Todas las peticiones incluyen header Authorization**
  ```typescript
  headers: { 'Authorization': `Bearer ${token}` }
  ```

- [ ] **4. Sync se llama DESPUÉS de guardar el token**
  ```typescript
  await login();
  // Token ya está guardado aquí
  await sync();
  ```

- [ ] **5. WebSocket conecta a ws://localhost:3000/realtime**
  ```typescript
  const ws = new WebSocket('ws://localhost:3000/realtime');
  ```

- [ ] **6. Manejan eventos WebSocket correctamente**
  - `connection` - Conexión establecida
  - `echo` - Echo de mensajes enviados
  - `typing` - Indicador de escritura
  - `error` - Errores del servidor

- [ ] **7. NO usan datos mock después de login exitoso**

---

## 🧪 TESTING - Cómo Verificar

### Test 1: Login y Token
```typescript
// En DevTools Console después del login
localStorage.getItem('inhost_access_token')
// Debe devolver: "eyJhbGciOiJIUzI1NiJ9..."
// NO debe devolver: null o undefined
```

### Test 2: Sync Request
```typescript
// En DevTools → Network → /admin/sync/initial → Headers
// Debe mostrar:
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
// NO debe mostrar:
Authorization: Bearer undefined
```

### Test 3: Sync Response
```typescript
// En DevTools → Network → /admin/sync/initial → Response
// Debe mostrar:
{
  "success": true,
  "data": {
    "conversations": [...]  // Array con conversaciones
  }
}
// NO debe mostrar:
{
  "success": false,
  "error": { "code": "SYNC_FAILED" }
}
```

---

## 🎯 DATOS DE PRUEBA DISPONIBLES

Backend tiene estos datos listos:

```
Credenciales:
  Email:    admin@test.com
  Password: password123

Tenant:
  Name: Test Company
  Slug: test-company

Conversaciones: 4
  - Juan Pérez (WhatsApp)
  - María García (WhatsApp)
  - Pedro López (Telegram)
  - Ana Martínez (Web)

Mensajes: 12 (3 por conversación)
```

---

## 📞 CONTACTO Y RESOLUCIÓN DE PROBLEMAS

**Si Frontend ve este error:**
```
TypeError: undefined is not an object (evaluating 'user.tenantId')
```
**Significa:** No están enviando el header Authorization

**Si Frontend ve este error:**
```
Authorization: Bearer undefined
```
**Significa:** No están guardando el token en localStorage

**Si Frontend ve este error:**
```
Backend sync failed, using local data
```
**Significa:** Una de las dos anteriores

---

## 🔒 CONTRATO CERRADO

Este documento define el contrato COMPLETO entre Backend y Frontend.

**Backend garantiza:**
- ✅ Login funciona y devuelve tokens
- ✅ Sync devuelve conversaciones, contactos, team
- ✅ WebSocket funciona en ws://localhost:3000/realtime
- ✅ Datos de prueba están poblados

**Frontend debe cumplir:**
- ✅ Guardar token después del login
- ✅ Enviar token en TODAS las peticiones /admin/*
- ✅ Manejar respuestas con campo `success`
- ✅ Conectar WebSocket a la URL correcta

**Cualquier desviación de este contrato causará errores.**

---

**Fecha de cierre del contrato:** 2025-11-19
**Versión:** 1.0 - FINAL
