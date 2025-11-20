# DOCUMENTACIÓN DE API - INHOST

**Proyecto:** INHOST - Plataforma de Mensajería Multicanal
**Versión:** 2.0.0 (Multi-Tenancy)
**Base URL:** `http://localhost:3000` (desarrollo) | `https://api.inhost.com` (producción)
**Última actualización:** 2025-11-20

---

## TABLA DE CONTENIDOS

1. [Introducción](#1-introducción)
2. [Autenticación](#2-autenticación)
3. [Errores](#3-errores)
4. [Rate Limiting](#4-rate-limiting)
5. [Endpoints](#5-endpoints)
   - [Health & Info](#51-health--info)
   - [Authentication](#52-authentication)
   - [Tenants](#53-tenants)
   - [Conversations](#54-conversations)
   - [Messages](#55-messages)
   - [End Users](#56-end-users)
   - [Team Management](#57-team-management)
   - [Account](#58-account)
   - [Integrations](#59-integrations)
   - [Mentions](#510-mentions)
   - [Feedback](#511-feedback)
   - [Sync](#512-sync)
   - [WebSocket](#513-websocket)
   - [Simulation (Dev)](#514-simulation-dev)
6. [Webhooks](#6-webhooks)
7. [Ejemplos Completos](#7-ejemplos-completos)

---

## 1. INTRODUCCIÓN

### 1.1 Descripción

La API de INHOST permite gestionar conversaciones multicanal con clientes finales. Soporta WhatsApp, Instagram, Telegram, SMS y Web.

### 1.2 Características

- ✅ **RESTful API:** Endpoints REST estándar
- ✅ **WebSocket:** Actualizaciones en tiempo real
- ✅ **Multi-Tenancy:** Aislamiento completo entre organizaciones
- ✅ **Type-Safe:** Validación de inputs con TypeBox
- ✅ **Rate Limiting:** Protección contra abuso
- ✅ **JWT Authentication:** Autenticación segura

### 1.3 Estructura de Respuestas

**Respuesta exitosa:**
```json
{
  "success": true,
  "data": { /* ... */ }
}
```

**Respuesta de error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { /* ... optional ... */ }
  }
}
```

---

## 2. AUTENTICACIÓN

### 2.1 Obtener Token (Login)

Todos los endpoints `/admin/*` requieren autenticación JWT, excepto los endpoints de autenticación mismos (`/admin/auth/login` y `/admin/auth/signup`).

**Flujo:**
```
1. POST /admin/auth/login → Obtiene JWT token
2. Incluir token en header: Authorization: Bearer <token>
3. Hacer requests a endpoints protegidos
```

### 2.2 Header de Autenticación

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2.3 JWT Payload

```json
{
  "sub": "user-id",              // Usuario autenticado
  "email": "admin@company.com",
  "tenant_id": "tenant-id",      // Organización (multi-tenancy)
  "role": "admin",               // Rol: owner | admin | agent | viewer
  "iat": 1234567890,             // Issued at
  "exp": 1234654290              // Expires at (24h después)
}
```

### 2.4 Roles y Permisos

| Rol | Permisos |
|-----|----------|
| **owner** | Acceso total (incluye billing, delete tenant) |
| **admin** | Casi todo (excepto billing) |
| **agent** | Conversaciones asignadas, enviar mensajes |
| **viewer** | Solo lectura |

---

## 3. ERRORES

### 3.1 Códigos de Error HTTP

| Código | Significado | Cuándo ocurre |
|--------|-------------|---------------|
| `200 OK` | Éxito | Request exitoso |
| `201 Created` | Recurso creado | POST exitoso |
| `400 Bad Request` | Input inválido | Validación falló |
| `401 Unauthorized` | No autenticado | Token inválido/expirado |
| `403 Forbidden` | No autorizado | Sin permisos |
| `404 Not Found` | No encontrado | Recurso no existe |
| `409 Conflict` | Conflicto | Duplicado (email, slug) |
| `422 Unprocessable Entity` | Validación falló | Input semánticamente inválido |
| `429 Too Many Requests` | Rate limit | Demasiados requests |
| `500 Internal Server Error` | Error del servidor | Bug o DB down |
| `503 Service Unavailable` | Servicio no disponible | DB no responde |

### 3.2 Códigos de Error de la API

| Código | Descripción |
|--------|-------------|
| `INVALID_CREDENTIALS` | Email o password incorrecto |
| `EMAIL_EXISTS` | Email ya registrado |
| `TENANT_EXISTS` | Tenant slug ya existe |
| `TOKEN_EXPIRED` | JWT token expirado |
| `INVALID_TOKEN` | JWT token inválido |
| `VALIDATION_ERROR` | Validación de input falló |
| `NOT_FOUND` | Recurso no encontrado |
| `FORBIDDEN` | Acceso denegado |
| `RATE_LIMIT_EXCEEDED` | Límite de requests excedido |
| `PLAN_LIMIT_EXCEEDED` | Límite del plan excedido |
| `DATABASE_UNAVAILABLE` | Base de datos no disponible |
| `DATABASE_TIMEOUT` | Timeout de base de datos |
| `INTERNAL_ERROR` | Error interno del servidor |

### 3.3 Ejemplo de Error

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "details": {
      "field": "password",
      "hint": "Check your credentials and try again"
    }
  }
}
```

---

## 4. RATE LIMITING

### 4.1 Límites Globales

| Endpoint Pattern | Límite | Ventana |
|------------------|--------|---------|
| `/admin/auth/login` | 5 requests | 15 minutos |
| `/admin/auth/signup` | 3 requests | 1 hora |
| `/admin/*` | 100 requests | 1 minuto |
| `/messages` | 60 requests | 1 minuto |

### 4.2 Headers de Rate Limit

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
Retry-After: 60
```

### 4.3 Respuesta de Rate Limit Excedido

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "retryAfter": 60,
      "limit": 100,
      "resetAt": "2025-11-20T10:30:00Z"
    }
  }
}
```

---

## 5. ENDPOINTS

### 5.1 Health & Info

#### `GET /`

Información básica de la API.

**Autenticación:** No requerida

**Response:**
```json
{
  "name": "Inhost API Gateway",
  "version": "2.0.0",
  "status": "running",
  "timestamp": "2025-11-20T10:00:00Z"
}
```

---

#### `GET /health`

Health check con verificación de base de datos.

**Autenticación:** No requerida

**Response (healthy):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "connected",
    "redis": "connected",
    "uptime": 123456,
    "timestamp": "2025-11-20T10:00:00Z"
  }
}
```

**Response (unhealthy):**
```json
{
  "success": false,
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "Database connection failed",
    "details": {
      "database": "disconnected",
      "lastCheck": "2025-11-20T10:00:00Z"
    }
  }
}
```

---

### 5.2 Authentication

#### `POST /admin/auth/signup`

Crear una nueva organización (tenant) con usuario owner.

**Autenticación:** No requerida

**Request Body:**
```json
{
  "tenantName": "Acme Inc",
  "name": "John Doe",
  "email": "john@acme.com",
  "password": "SecurePass123!",
  "plan": "starter"  // opcional: starter | professional | enterprise
}
```

**Validación:**
- `tenantName`: 2-255 caracteres
- `name`: 2-255 caracteres
- `email`: Email válido
- `password`: Mínimo 8 caracteres
- `plan`: Uno de los planes disponibles

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john@acme.com",
      "name": "John Doe",
      "role": "owner",
      "tenantId": "660e8400-e29b-41d4-a716-446655440000",
      "tenantName": "Acme Inc",
      "tenantSlug": "acme-inc"
    },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "expiresIn": 604800  // 7 días en segundos
    }
  }
}
```

**Errors:**
- `409 Conflict` - Email o tenant slug ya existe
- `422 Unprocessable Entity` - Password débil
- `503 Service Unavailable` - Base de datos no disponible

---

#### `POST /admin/auth/login`

Autenticar usuario y obtener JWT token.

**Autenticación:** No requerida

**Request Body:**
```json
{
  "email": "john@acme.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john@acme.com",
      "name": "John Doe",
      "role": "admin",
      "tenant": {
        "id": "660e8400-e29b-41d4-a716-446655440000",
        "name": "Acme Inc",
        "slug": "acme-inc",
        "plan": "professional"
      }
    }
  }
}
```

**Errors:**
- `401 Unauthorized` - Credenciales inválidas
- `403 Forbidden` - Cuenta suspendida
- `429 Too Many Requests` - Rate limit (5 intentos en 15 min)

---

#### `GET /admin/auth/me`

Obtener información del usuario autenticado.

**Autenticación:** Requerida (JWT)

**Headers:**
```http
Authorization: Bearer eyJhbGc...
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@acme.com",
    "name": "John Doe",
    "role": "admin",
    "isActive": true,
    "lastLoginAt": "2025-11-20T09:00:00Z",
    "createdAt": "2025-01-01T00:00:00Z",
    "tenant": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Acme Inc",
      "slug": "acme-inc",
      "plan": "professional",
      "subscriptionStatus": "active",
      "trialEndsAt": null
    }
  }
}
```

**Errors:**
- `401 Unauthorized` - Token inválido o expirado
- `404 Not Found` - Usuario no encontrado

---

### 5.3 Tenants

#### `GET /admin/tenant`

Obtener información de la organización (tenant) actual.

**Autenticación:** Requerida (JWT)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Acme Inc",
    "slug": "acme-inc",
    "plan": "professional",
    "subscriptionStatus": "active",
    "settings": {
      "timezone": "America/New_York",
      "language": "en",
      "features": {
        "ai_assistant": true,
        "analytics": true
      }
    },
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-11-20T10:00:00Z"
  }
}
```

---

#### `PATCH /admin/tenant`

Actualizar configuración del tenant.

**Autenticación:** Requerida (JWT, role: owner | admin)

**Request Body:**
```json
{
  "name": "Acme Corporation",
  "settings": {
    "timezone": "America/Los_Angeles",
    "language": "es"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Acme Corporation",
    "slug": "acme-inc",
    "settings": {
      "timezone": "America/Los_Angeles",
      "language": "es"
    },
    "updatedAt": "2025-11-20T10:05:00Z"
  }
}
```

**Errors:**
- `403 Forbidden` - Sin permisos (solo owner/admin)

---

#### `GET /admin/tenant/stats`

Obtener estadísticas del tenant.

**Autenticación:** Requerida (JWT)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "conversations": {
      "total": 150,
      "active": 45,
      "closed": 100,
      "archived": 5
    },
    "messages": {
      "total": 3250,
      "incoming": 1800,
      "outgoing": 1450
    },
    "endUsers": {
      "total": 120,
      "byChannel": {
        "whatsapp": 80,
        "telegram": 20,
        "web": 15,
        "sms": 5
      }
    },
    "team": {
      "total": 10,
      "active": 8,
      "byRole": {
        "owner": 1,
        "admin": 2,
        "agent": 6,
        "viewer": 1
      }
    },
    "period": {
      "start": "2025-11-01T00:00:00Z",
      "end": "2025-11-20T10:00:00Z"
    }
  }
}
```

---

### 5.4 Conversations

#### `GET /admin/conversations`

Listar conversaciones del tenant.

**Autenticación:** Requerida (JWT)

**Query Parameters:**
```
page: number (default: 1)
limit: number (default: 20, max: 100)
status: 'active' | 'closed' | 'archived'
channel: 'whatsapp' | 'telegram' | 'web' | 'sms' | 'instagram'
assignedTo: UUID (filter por agente asignado)
search: string (buscar en nombre de end user)
```

**Request:**
```http
GET /admin/conversations?page=1&limit=20&status=active&channel=whatsapp
Authorization: Bearer eyJhbGc...
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "conv-123",
        "tenantId": "tenant-456",
        "endUser": {
          "id": "user-789",
          "name": "Carlos García",
          "phone": "+5491112345678",
          "avatarUrl": "https://...",
          "channel": "whatsapp"
        },
        "channel": "whatsapp",
        "status": "active",
        "assignedTo": {
          "id": "agent-111",
          "name": "María López",
          "role": "agent"
        },
        "isPinned": false,
        "unreadCount": 3,
        "lastMessage": {
          "id": "msg-999",
          "text": "Hola, ¿me pueden ayudar?",
          "type": "incoming",
          "createdAt": "2025-11-20T09:30:00Z"
        },
        "lastMessageAt": "2025-11-20T09:30:00Z",
        "lastReadAt": "2025-11-20T09:00:00Z",
        "createdAt": "2025-11-19T14:00:00Z",
        "updatedAt": "2025-11-20T09:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasMore": true
    }
  }
}
```

---

#### `GET /admin/conversations/:id`

Obtener detalles de una conversación con sus mensajes.

**Autenticación:** Requerida (JWT)

**Path Parameters:**
- `id`: UUID de la conversación

**Query Parameters:**
```
messagesPage: number (default: 1)
messagesLimit: number (default: 50, max: 200)
```

**Request:**
```http
GET /admin/conversations/conv-123?messagesPage=1&messagesLimit=50
Authorization: Bearer eyJhbGc...
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": "conv-123",
      "tenantId": "tenant-456",
      "endUser": {
        "id": "user-789",
        "name": "Carlos García",
        "email": "carlos@example.com",
        "phone": "+5491112345678",
        "avatarUrl": "https://...",
        "channel": "whatsapp",
        "metadata": {
          "source": "website",
          "tags": ["vip", "priority"]
        },
        "createdAt": "2025-10-01T00:00:00Z"
      },
      "channel": "whatsapp",
      "status": "active",
      "assignedTo": {
        "id": "agent-111",
        "name": "María López",
        "email": "maria@acme.com",
        "role": "agent"
      },
      "isPinned": false,
      "unreadCount": 3,
      "metadata": {
        "source": "web-widget",
        "tags": ["support"]
      },
      "createdAt": "2025-11-19T14:00:00Z",
      "updatedAt": "2025-11-20T09:30:00Z"
    },
    "messages": {
      "data": [
        {
          "id": "msg-001",
          "conversationId": "conv-123",
          "type": "incoming",
          "channel": "whatsapp",
          "content": {
            "type": "text",
            "text": "Hola, necesito ayuda con mi pedido"
          },
          "metadata": {
            "from": "+5491112345678",
            "timestamp": "2025-11-20T09:00:00Z"
          },
          "statusChain": [
            {
              "status": "received",
              "timestamp": "2025-11-20T09:00:00Z"
            }
          ],
          "createdAt": "2025-11-20T09:00:00Z"
        },
        {
          "id": "msg-002",
          "conversationId": "conv-123",
          "type": "outgoing",
          "channel": "whatsapp",
          "content": {
            "type": "text",
            "text": "¡Hola Carlos! Con gusto te ayudo. ¿Cuál es tu número de pedido?"
          },
          "metadata": {
            "to": "+5491112345678",
            "timestamp": "2025-11-20T09:01:00Z"
          },
          "statusChain": [
            {
              "status": "sending",
              "timestamp": "2025-11-20T09:01:00Z"
            },
            {
              "status": "sent",
              "timestamp": "2025-11-20T09:01:05Z"
            },
            {
              "status": "delivered",
              "timestamp": "2025-11-20T09:01:10Z"
            },
            {
              "status": "read",
              "timestamp": "2025-11-20T09:02:00Z"
            }
          ],
          "sentByAdminUser": {
            "id": "agent-111",
            "name": "María López"
          },
          "createdAt": "2025-11-20T09:01:00Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 50,
        "total": 15,
        "totalPages": 1,
        "hasMore": false
      }
    }
  }
}
```

**Errors:**
- `404 Not Found` - Conversación no encontrada
- `403 Forbidden` - Conversación pertenece a otro tenant

---

#### `POST /admin/conversations`

Crear una nueva conversación.

**Autenticación:** Requerida (JWT)

**Request Body:**
```json
{
  "endUserId": "user-789",
  "channel": "whatsapp",
  "assignedToId": "agent-111",  // opcional
  "metadata": {
    "source": "api",
    "tags": ["support"]
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "conv-new",
    "tenantId": "tenant-456",
    "endUserId": "user-789",
    "channel": "whatsapp",
    "status": "active",
    "assignedToId": "agent-111",
    "isPinned": false,
    "unreadCount": 0,
    "createdAt": "2025-11-20T10:00:00Z"
  }
}
```

**Errors:**
- `404 Not Found` - End user no encontrado
- `409 Conflict` - Ya existe conversación activa para este end user

---

#### `PATCH /admin/conversations/:id`

Actualizar una conversación.

**Autenticación:** Requerida (JWT)

**Path Parameters:**
- `id`: UUID de la conversación

**Request Body:**
```json
{
  "status": "closed",
  "assignedToId": "agent-222",
  "isPinned": true,
  "metadata": {
    "resolution": "solved",
    "category": "billing"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "conv-123",
    "status": "closed",
    "assignedToId": "agent-222",
    "isPinned": true,
    "metadata": {
      "resolution": "solved",
      "category": "billing"
    },
    "closedAt": "2025-11-20T10:05:00Z",
    "updatedAt": "2025-11-20T10:05:00Z"
  }
}
```

---

#### `DELETE /admin/conversations/:id`

Archivar una conversación.

**Autenticación:** Requerida (JWT, role: admin+)

**Path Parameters:**
- `id`: UUID de la conversación

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "conv-123",
    "status": "archived",
    "deletedAt": "2025-11-20T10:10:00Z"
  }
}
```

**Errors:**
- `403 Forbidden` - Sin permisos (solo admin+)

---

#### `POST /admin/conversations/:id/mark-as-read`

Marcar conversación como leída para el usuario actual.

**Autenticación:** Requerida (JWT)

**Path Parameters:**
- `id`: UUID de la conversación

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "conversationId": "conv-123",
    "lastReadAt": "2025-11-20T10:15:00Z",
    "unreadCount": 0
  }
}
```

---

### 5.5 Messages

#### `GET /admin/conversations/:conversationId/messages`

Listar mensajes de una conversación (alternativa al GET conversations/:id).

**Autenticación:** Requerida (JWT)

**Path Parameters:**
- `conversationId`: UUID de la conversación

**Query Parameters:**
```
page: number (default: 1)
limit: number (default: 50, max: 200)
```

**Response:** Ver ejemplo en `GET /admin/conversations/:id`

---

#### `POST /admin/conversations/:conversationId/messages`

Crear un mensaje saliente en una conversación.

**Autenticación:** Requerida (JWT)

**Path Parameters:**
- `conversationId`: UUID de la conversación

**Request Body:**
```json
{
  "content": {
    "type": "text",
    "text": "Hola, ¿en qué puedo ayudarte?"
  },
  "metadata": {
    "internalNote": "Cliente VIP, prioridad alta"
  }
}
```

**Tipos de contenido soportados:**

**Texto:**
```json
{
  "type": "text",
  "text": "Mensaje de texto"
}
```

**Imagen:**
```json
{
  "type": "image",
  "url": "https://cdn.example.com/image.jpg",
  "caption": "Descripción de la imagen"
}
```

**Audio:**
```json
{
  "type": "audio",
  "url": "https://cdn.example.com/audio.mp3",
  "duration": 30
}
```

**Video:**
```json
{
  "type": "video",
  "url": "https://cdn.example.com/video.mp4",
  "caption": "Video explicativo",
  "duration": 120
}
```

**Documento:**
```json
{
  "type": "document",
  "url": "https://cdn.example.com/doc.pdf",
  "filename": "invoice.pdf",
  "mimeType": "application/pdf",
  "size": 102400
}
```

**Ubicación:**
```json
{
  "type": "location",
  "latitude": -34.603722,
  "longitude": -58.381592,
  "name": "Obelisco",
  "address": "Av. 9 de Julio, Buenos Aires"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "msg-new",
    "conversationId": "conv-123",
    "type": "outgoing",
    "channel": "whatsapp",
    "content": {
      "type": "text",
      "text": "Hola, ¿en qué puedo ayudarte?"
    },
    "metadata": {
      "to": "+5491112345678",
      "timestamp": "2025-11-20T10:20:00Z",
      "internalNote": "Cliente VIP, prioridad alta"
    },
    "statusChain": [
      {
        "status": "sending",
        "timestamp": "2025-11-20T10:20:00Z"
      }
    ],
    "sentByAdminUser": {
      "id": "agent-111",
      "name": "María López"
    },
    "createdAt": "2025-11-20T10:20:00Z"
  }
}
```

**Errors:**
- `404 Not Found` - Conversación no encontrada
- `422 Unprocessable Entity` - Contenido inválido
- `429 Too Many Requests` - Rate limit excedido (plan)

---

#### `PATCH /admin/messages/:id/status`

Actualizar estado de un mensaje (usado por webhooks de canales).

**Autenticación:** Requerida (JWT o API Key)

**Path Parameters:**
- `id`: UUID del mensaje

**Request Body:**
```json
{
  "status": "delivered",
  "timestamp": "2025-11-20T10:20:05Z"
}
```

**Status posibles:**
- `sending` - Enviando
- `sent` - Enviado
- `delivered` - Entregado
- `read` - Leído
- `failed` - Fallido

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "messageId": "msg-new",
    "status": "delivered",
    "timestamp": "2025-11-20T10:20:05Z"
  }
}
```

---

### 5.6 End Users

#### `GET /admin/end-users`

Listar usuarios finales (clientes) del tenant.

**Autenticación:** Requerida (JWT)

**Query Parameters:**
```
page: number (default: 1)
limit: number (default: 20, max: 100)
channel: 'whatsapp' | 'telegram' | 'web' | 'sms' | 'instagram'
search: string (buscar en nombre, email, phone)
tags: string[] (filtrar por tags)
```

**Request:**
```http
GET /admin/end-users?page=1&limit=20&channel=whatsapp&search=carlos
Authorization: Bearer eyJhbGc...
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "user-789",
        "tenantId": "tenant-456",
        "externalId": "5491112345678",
        "channel": "whatsapp",
        "name": "Carlos García",
        "email": "carlos@example.com",
        "phone": "+5491112345678",
        "avatarUrl": "https://...",
        "metadata": {
          "source": "website",
          "customFields": {
            "customerType": "premium"
          }
        },
        "tags": ["vip", "priority"],
        "isBlocked": false,
        "lastInteractionAt": "2025-11-20T09:30:00Z",
        "createdAt": "2025-10-01T00:00:00Z",
        "updatedAt": "2025-11-20T09:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 120,
      "totalPages": 6,
      "hasMore": true
    }
  }
}
```

---

#### `GET /admin/end-users/:id`

Obtener detalles de un end user.

**Autenticación:** Requerida (JWT)

**Path Parameters:**
- `id`: UUID del end user

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "user-789",
    "tenantId": "tenant-456",
    "externalId": "5491112345678",
    "channel": "whatsapp",
    "name": "Carlos García",
    "email": "carlos@example.com",
    "phone": "+5491112345678",
    "avatarUrl": "https://...",
    "metadata": {
      "source": "website",
      "customFields": {
        "customerType": "premium",
        "lifetime_value": 5000
      }
    },
    "tags": ["vip", "priority"],
    "isBlocked": false,
    "conversationsCount": 5,
    "lastInteractionAt": "2025-11-20T09:30:00Z",
    "createdAt": "2025-10-01T00:00:00Z",
    "updatedAt": "2025-11-20T09:30:00Z"
  }
}
```

---

#### `POST /admin/end-users`

Crear un nuevo end user.

**Autenticación:** Requerida (JWT)

**Request Body:**
```json
{
  "externalId": "5491112345678",
  "channel": "whatsapp",
  "name": "Carlos García",
  "email": "carlos@example.com",
  "phone": "+5491112345678",
  "avatarUrl": "https://...",
  "metadata": {
    "source": "api"
  },
  "tags": ["vip"]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "user-new",
    "tenantId": "tenant-456",
    "externalId": "5491112345678",
    "channel": "whatsapp",
    "name": "Carlos García",
    "email": "carlos@example.com",
    "phone": "+5491112345678",
    "tags": ["vip"],
    "createdAt": "2025-11-20T10:30:00Z"
  }
}
```

**Errors:**
- `409 Conflict` - Ya existe end user con este externalId + channel

---

#### `PATCH /admin/end-users/:id`

Actualizar un end user.

**Autenticación:** Requerida (JWT)

**Path Parameters:**
- `id`: UUID del end user

**Request Body:**
```json
{
  "name": "Carlos García Pérez",
  "tags": ["vip", "platinum"],
  "metadata": {
    "customFields": {
      "customerType": "platinum"
    }
  },
  "isBlocked": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "user-789",
    "name": "Carlos García Pérez",
    "tags": ["vip", "platinum"],
    "metadata": {
      "customFields": {
        "customerType": "platinum"
      }
    },
    "updatedAt": "2025-11-20T10:35:00Z"
  }
}
```

---

#### `GET /admin/end-users/:id/conversations`

Obtener conversaciones de un end user.

**Autenticación:** Requerida (JWT)

**Path Parameters:**
- `id`: UUID del end user

**Query Parameters:**
```
page: number (default: 1)
limit: number (default: 20, max: 100)
status: 'active' | 'closed' | 'archived'
```

**Response:** Similar a `GET /admin/conversations`

---

### 5.7 Team Management

#### `GET /admin/team`

Listar miembros del equipo (tenant users).

**Autenticación:** Requerida (JWT)

**Query Parameters:**
```
page: number (default: 1)
limit: number (default: 20, max: 100)
role: 'owner' | 'admin' | 'agent' | 'viewer'
isActive: boolean
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "agent-111",
        "tenantId": "tenant-456",
        "email": "maria@acme.com",
        "name": "María López",
        "role": "agent",
        "isActive": true,
        "lastLoginAt": "2025-11-20T08:00:00Z",
        "assignedConversationsCount": 12,
        "createdAt": "2025-06-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "totalPages": 1,
      "hasMore": false
    }
  }
}
```

---

#### `GET /admin/team/:id`

Obtener detalles de un miembro del equipo.

**Autenticación:** Requerida (JWT)

**Path Parameters:**
- `id`: UUID del team member

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "agent-111",
    "tenantId": "tenant-456",
    "email": "maria@acme.com",
    "name": "María López",
    "role": "agent",
    "isActive": true,
    "lastLoginAt": "2025-11-20T08:00:00Z",
    "assignedConversationsCount": 12,
    "stats": {
      "messagesThisMonth": 450,
      "conversationsClosed": 25,
      "avgResponseTime": 120
    },
    "createdAt": "2025-06-01T00:00:00Z",
    "updatedAt": "2025-11-20T08:00:00Z"
  }
}
```

---

#### `POST /admin/team`

Crear un nuevo miembro del equipo.

**Autenticación:** Requerida (JWT, role: owner | admin)

**Request Body:**
```json
{
  "email": "nuevo@acme.com",
  "name": "Pedro Gómez",
  "password": "SecurePass123!",
  "role": "agent"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "agent-new",
    "tenantId": "tenant-456",
    "email": "nuevo@acme.com",
    "name": "Pedro Gómez",
    "role": "agent",
    "isActive": true,
    "createdAt": "2025-11-20T10:40:00Z"
  }
}
```

**Errors:**
- `403 Forbidden` - Sin permisos (solo owner/admin)
- `409 Conflict` - Email ya existe

---

#### `PATCH /admin/team/:id`

Actualizar un miembro del equipo.

**Autenticación:** Requerida (JWT, role: owner | admin)

**Path Parameters:**
- `id`: UUID del team member

**Request Body:**
```json
{
  "name": "Pedro Gómez García",
  "role": "admin",
  "isActive": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "agent-111",
    "name": "Pedro Gómez García",
    "role": "admin",
    "updatedAt": "2025-11-20T10:45:00Z"
  }
}
```

**Errors:**
- `403 Forbidden` - Sin permisos o intentando editar owner

---

#### `DELETE /admin/team/:id`

Eliminar (desactivar) un miembro del equipo.

**Autenticación:** Requerida (JWT, role: owner | admin)

**Path Parameters:**
- `id`: UUID del team member

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "agent-111",
    "isActive": false,
    "deletedAt": "2025-11-20T10:50:00Z"
  }
}
```

**Errors:**
- `403 Forbidden` - Sin permisos o intentando eliminar owner
- `409 Conflict` - Usuario tiene conversaciones activas asignadas

---

#### `POST /admin/team/invites`

Enviar invitación por email para unirse al equipo.

**Autenticación:** Requerida (JWT, role: owner | admin)

**Request Body:**
```json
{
  "email": "nuevo@acme.com",
  "role": "agent",
  "message": "Únete a nuestro equipo de soporte"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "invite-123",
    "email": "nuevo@acme.com",
    "role": "agent",
    "token": "inv_abc123def456",
    "expiresAt": "2025-11-27T10:55:00Z",
    "createdAt": "2025-11-20T10:55:00Z"
  }
}
```

---

#### `GET /admin/team/invites`

Listar invitaciones pendientes.

**Autenticación:** Requerida (JWT, role: owner | admin)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "invite-123",
      "email": "nuevo@acme.com",
      "role": "agent",
      "status": "pending",
      "expiresAt": "2025-11-27T10:55:00Z",
      "createdAt": "2025-11-20T10:55:00Z"
    }
  ]
}
```

---

#### `POST /admin/team/invites/:token/accept`

Aceptar una invitación (público - no requiere JWT del tenant).

**Autenticación:** No requerida

**Path Parameters:**
- `token`: Token de invitación (ej: `inv_abc123def456`)

**Request Body:**
```json
{
  "name": "Pedro Gómez",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "user": {
      "id": "agent-new",
      "email": "nuevo@acme.com",
      "name": "Pedro Gómez",
      "role": "agent"
    }
  }
}
```

**Errors:**
- `404 Not Found` - Token inválido o expirado
- `409 Conflict` - Invitación ya aceptada

---

### 5.8 Account

#### `GET /admin/account`

Obtener configuración de cuenta del usuario actual.

**Autenticación:** Requerida (JWT)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "agent-111",
    "email": "maria@acme.com",
    "name": "María López",
    "role": "agent",
    "settings": {
      "notifications": {
        "email": true,
        "push": true,
        "desktop": true
      },
      "language": "es",
      "timezone": "America/Buenos_Aires"
    },
    "createdAt": "2025-06-01T00:00:00Z"
  }
}
```

---

#### `PATCH /admin/account`

Actualizar configuración de cuenta.

**Autenticación:** Requerida (JWT)

**Request Body:**
```json
{
  "name": "María López García",
  "settings": {
    "notifications": {
      "email": false
    },
    "language": "en"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "name": "María López García",
    "settings": {
      "notifications": {
        "email": false,
        "push": true,
        "desktop": true
      },
      "language": "en"
    },
    "updatedAt": "2025-11-20T11:00:00Z"
  }
}
```

---

#### `PATCH /admin/account/password`

Cambiar contraseña.

**Autenticación:** Requerida (JWT)

**Request Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewSecurePass456!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Password updated successfully"
  }
}
```

**Errors:**
- `401 Unauthorized` - Password actual incorrecto
- `422 Unprocessable Entity` - Password nuevo débil

---

### 5.9 Integrations

#### `GET /admin/integrations`

Listar integraciones del tenant.

**Autenticación:** Requerida (JWT)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "integration-123",
      "tenantId": "tenant-456",
      "type": "whatsapp",
      "name": "WhatsApp Business",
      "status": "active",
      "config": {
        "phoneNumber": "+5491112345678",
        "businessId": "abc123"
      },
      "isActive": true,
      "lastSyncAt": "2025-11-20T10:00:00Z",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

#### `GET /admin/integrations/:id`

Obtener detalles de una integración.

**Autenticación:** Requerida (JWT)

**Path Parameters:**
- `id`: UUID de la integración

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "integration-123",
    "tenantId": "tenant-456",
    "type": "whatsapp",
    "name": "WhatsApp Business",
    "status": "active",
    "config": {
      "phoneNumber": "+5491112345678",
      "businessId": "abc123",
      "webhookUrl": "https://api.inhost.com/webhooks/whatsapp"
    },
    "stats": {
      "messagesThisMonth": 1500,
      "conversationsActive": 25
    },
    "isActive": true,
    "lastSyncAt": "2025-11-20T10:00:00Z",
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-11-20T10:00:00Z"
  }
}
```

---

#### `POST /admin/integrations`

Crear una nueva integración.

**Autenticación:** Requerida (JWT, role: owner | admin)

**Request Body:**
```json
{
  "type": "telegram",
  "name": "Telegram Bot",
  "config": {
    "botToken": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "integration-new",
    "tenantId": "tenant-456",
    "type": "telegram",
    "name": "Telegram Bot",
    "status": "pending",
    "config": {
      "botToken": "123456:ABC-***"
    },
    "createdAt": "2025-11-20T11:05:00Z"
  }
}
```

**Errors:**
- `403 Forbidden` - Sin permisos
- `422 Unprocessable Entity` - Config inválida

---

#### `PATCH /admin/integrations/:id`

Actualizar una integración.

**Autenticación:** Requerida (JWT, role: owner | admin)

**Path Parameters:**
- `id`: UUID de la integración

**Request Body:**
```json
{
  "name": "Telegram Support Bot",
  "isActive": true,
  "config": {
    "botToken": "new-token-here"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "integration-123",
    "name": "Telegram Support Bot",
    "isActive": true,
    "updatedAt": "2025-11-20T11:10:00Z"
  }
}
```

---

#### `DELETE /admin/integrations/:id`

Eliminar una integración.

**Autenticación:** Requerida (JWT, role: owner | admin)

**Path Parameters:**
- `id`: UUID de la integración

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "integration-123",
    "deletedAt": "2025-11-20T11:15:00Z"
  }
}
```

**Errors:**
- `403 Forbidden` - Sin permisos
- `409 Conflict` - Integración tiene conversaciones activas

---

### 5.10 Mentions

#### `GET /admin/mentions`

Listar menciones del usuario actual (@username).

**Autenticación:** Requerida (JWT)

**Query Parameters:**
```
page: number (default: 1)
limit: number (default: 20, max: 100)
isRead: boolean
entityType: 'message' | 'conversation' | 'feedback' | 'note'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "mention-123",
        "tenantId": "tenant-456",
        "mentionedUser": {
          "id": "agent-111",
          "name": "María López"
        },
        "mentionedByUser": {
          "id": "agent-222",
          "name": "Pedro Gómez"
        },
        "entityType": "message",
        "entityId": "msg-789",
        "mentionType": "user",
        "context": "Hey @maria, ¿puedes revisar este caso?",
        "isRead": false,
        "entity": {
          "id": "msg-789",
          "conversationId": "conv-456",
          "text": "Hey @maria, ¿puedes revisar este caso?"
        },
        "createdAt": "2025-11-20T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1,
      "hasMore": false
    }
  }
}
```

---

#### `GET /admin/mentions/unread-count`

Obtener contador de menciones no leídas.

**Autenticación:** Requerida (JWT)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "unreadCount": 3,
    "byEntityType": {
      "message": 2,
      "conversation": 1,
      "feedback": 0
    }
  }
}
```

---

#### `PATCH /admin/mentions/:id/mark-as-read`

Marcar mención como leída.

**Autenticación:** Requerida (JWT)

**Path Parameters:**
- `id`: UUID de la mención

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "mention-123",
    "isRead": true,
    "readAt": "2025-11-20T11:20:00Z"
  }
}
```

---

#### `POST /admin/mentions/mark-all-as-read`

Marcar todas las menciones como leídas.

**Autenticación:** Requerida (JWT)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "markedAsRead": 3,
    "timestamp": "2025-11-20T11:25:00Z"
  }
}
```

---

### 5.11 Feedback

#### `POST /admin/messages/:id/feedback`

Dar feedback (thumbs up/down) a un mensaje.

**Autenticación:** Requerida (JWT)

**Path Parameters:**
- `id`: UUID del mensaje

**Request Body:**
```json
{
  "rating": "positive",  // 'positive' | 'negative'
  "comment": "La respuesta fue muy útil",
  "suggestedCorrection": null,  // Solo si rating es 'negative'
  "metadata": {
    "extensionId": "ai-assistant"
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "feedback-123",
    "messageId": "msg-789",
    "givenByUserId": "agent-111",
    "rating": "positive",
    "comment": "La respuesta fue muy útil",
    "createdAt": "2025-11-20T11:30:00Z"
  }
}
```

---

#### `GET /admin/feedback/analytics`

Obtener analytics de feedback por extensión.

**Autenticación:** Requerida (JWT)

**Query Parameters:**
```
extensionId: string (opcional)
startDate: ISO 8601 date
endDate: ISO 8601 date
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2025-11-01T00:00:00Z",
      "end": "2025-11-20T11:35:00Z"
    },
    "byExtension": {
      "ai-assistant": {
        "total": 150,
        "positive": 120,
        "negative": 30,
        "positiveRate": 0.8,
        "topComplaints": [
          {
            "category": "incorrect_information",
            "count": 15
          },
          {
            "category": "tone",
            "count": 10
          }
        ]
      },
      "analytics": {
        "total": 50,
        "positive": 45,
        "negative": 5,
        "positiveRate": 0.9
      }
    },
    "overall": {
      "total": 200,
      "positive": 165,
      "negative": 35,
      "positiveRate": 0.825
    }
  }
}
```

---

#### `GET /admin/feedback/by-extension/:extensionId`

Obtener feedback detallado de una extensión específica.

**Autenticación:** Requerida (JWT)

**Path Parameters:**
- `extensionId`: ID de la extensión (ej: `ai-assistant`)

**Query Parameters:**
```
page: number (default: 1)
limit: number (default: 20)
rating: 'positive' | 'negative'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "feedback-123",
        "message": {
          "id": "msg-789",
          "text": "Respuesta generada por AI",
          "conversationId": "conv-456"
        },
        "givenByUser": {
          "id": "agent-111",
          "name": "María López"
        },
        "rating": "negative",
        "comment": "La respuesta fue incorrecta",
        "suggestedCorrection": "Debería haber dicho X en lugar de Y",
        "createdAt": "2025-11-20T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 30,
      "totalPages": 2,
      "hasMore": true
    }
  }
}
```

---

### 5.12 Sync

#### `GET /admin/sync/initial`

Obtener datos iniciales para cargar el dashboard (single endpoint para reducir requests).

**Autenticación:** Requerida (JWT)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "tenant-456",
      "name": "Acme Inc",
      "plan": "professional"
    },
    "user": {
      "id": "agent-111",
      "name": "María López",
      "role": "agent"
    },
    "conversations": {
      "active": 25,
      "unread": 8,
      "recent": [
        {
          "id": "conv-123",
          "endUser": { "name": "Carlos García" },
          "lastMessage": { "text": "Hola..." },
          "unreadCount": 2
        }
      ]
    },
    "mentions": {
      "unread": 3
    },
    "team": [
      {
        "id": "agent-222",
        "name": "Pedro Gómez",
        "role": "agent",
        "isOnline": true
      }
    ],
    "stats": {
      "messagesThisMonth": 1500,
      "conversationsThisMonth": 120
    },
    "timestamp": "2025-11-20T11:40:00Z"
  }
}
```

---

### 5.13 WebSocket

#### `WS /realtime`

Conexión WebSocket para actualizaciones en tiempo real.

**Autenticación:** Requerida (JWT como query param)

**Conexión:**
```javascript
const ws = new WebSocket('ws://localhost:3000/realtime?token=eyJhbGc...');

ws.onopen = () => {
  console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.event, data);

  switch (data.event) {
    case 'message:new':
      // Nuevo mensaje recibido
      handleNewMessage(data.envelope);
      break;

    case 'message:status':
      // Cambio de estado de mensaje
      handleMessageStatus(data.messageId, data.status);
      break;

    case 'conversation:updated':
      // Conversación actualizada
      handleConversationUpdate(data.conversation);
      break;

    case 'conversation:read':
      // Conversación marcada como leída
      handleConversationRead(data.conversationId, data.userId);
      break;

    case 'mention:new':
      // Nueva mención
      handleNewMention(data.mention);
      break;

    case 'typing:start':
      // Usuario comenzó a escribir
      handleTypingStart(data.conversationId, data.userId);
      break;

    case 'typing:stop':
      // Usuario dejó de escribir
      handleTypingStop(data.conversationId, data.userId);
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from WebSocket');
};
```

**Eventos del servidor:**

| Evento | Descripción | Payload |
|--------|-------------|---------|
| `message:new` | Nuevo mensaje recibido | `{ event, envelope }` |
| `message:status` | Cambio de estado de mensaje | `{ event, messageId, status, timestamp }` |
| `conversation:updated` | Conversación actualizada | `{ event, conversation }` |
| `conversation:read` | Conversación marcada como leída | `{ event, conversationId, userId, readAt }` |
| `mention:new` | Nueva mención | `{ event, mention }` |
| `typing:start` | Usuario escribiendo | `{ event, conversationId, userId }` |
| `typing:stop` | Usuario dejó de escribir | `{ event, conversationId, userId }` |
| `team:member-online` | Miembro del equipo online | `{ event, userId, timestamp }` |
| `team:member-offline` | Miembro del equipo offline | `{ event, userId, timestamp }` |

**Mensajes del cliente:**

```javascript
// Indicar que estoy escribiendo
ws.send(JSON.stringify({
  type: 'typing',
  conversationId: 'conv-123'
}));

// Marcar conversación como leída
ws.send(JSON.stringify({
  type: 'read',
  conversationId: 'conv-123'
}));

// Heartbeat (keep-alive)
setInterval(() => {
  ws.send(JSON.stringify({ type: 'ping' }));
}, 30000);  // cada 30 segundos
```

**Errors:**
- `401 Unauthorized` - Token inválido
- `1006 Abnormal Closure` - Conexión cerrada sin close frame

---

### 5.14 Simulation (Dev)

Endpoints para simular mensajes de canales en desarrollo.

#### `POST /simulate/whatsapp`

Simular mensaje entrante de WhatsApp.

**Autenticación:** No requerida (solo desarrollo)

**Request Body:**
```json
{
  "from": "+5491112345678",
  "body": "Hola, necesito ayuda",
  "timestamp": "2025-11-20T11:50:00Z"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "messageId": "msg-simulated",
    "channel": "whatsapp",
    "status": "received"
  }
}
```

---

#### `POST /simulate/telegram`

Simular mensaje entrante de Telegram.

**Autenticación:** No requerida (solo desarrollo)

**Request Body:**
```json
{
  "chatId": "123456789",
  "text": "Hola desde Telegram",
  "timestamp": "2025-11-20T11:55:00Z"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "messageId": "msg-simulated",
    "channel": "telegram",
    "status": "received"
  }
}
```

---

#### `POST /simulate/sms`

Simular mensaje entrante de SMS.

**Autenticación:** No requerida (solo desarrollo)

**Request Body:**
```json
{
  "from": "+5491112345678",
  "body": "Hola desde SMS",
  "timestamp": "2025-11-20T12:00:00Z"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "messageId": "msg-simulated",
    "channel": "sms",
    "status": "received"
  }
}
```

---

#### `POST /simulate/client-message`

Simular mensaje desde cualquier canal (genérico).

**Autenticación:** No requerida (solo desarrollo)

**Request Body:**
```json
{
  "channel": "whatsapp",
  "userId": "user-123",
  "content": {
    "type": "text",
    "text": "Mensaje de prueba"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "messageId": "msg-simulated",
    "channel": "whatsapp",
    "status": "received"
  }
}
```

---

## 6. WEBHOOKS

### 6.1 Webhooks de Canales

INHOST puede recibir webhooks de los canales externos (WhatsApp, Telegram, etc.) para sincronizar mensajes.

#### Webhook de WhatsApp

**Endpoint:** `POST /webhooks/whatsapp`

**Headers:**
```http
X-Hub-Signature-256: sha256=abc123...
Content-Type: application/json
```

**Request Body (ejemplo):**
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "5491112345678",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "messages": [
              {
                "from": "5491198765432",
                "id": "wamid.HBgLNTQ5MTE5ODc2NTQzMhUCABIYFjNFQjBDMUM0RDhBODRBNjY4NTZD",
                "timestamp": "1640995200",
                "type": "text",
                "text": {
                  "body": "Hola, necesito ayuda"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "success": true
}
```

---

## 7. EJEMPLOS COMPLETOS

### 7.1 Flujo Completo de Autenticación y Envío de Mensaje

```javascript
// 1. Signup
const signupResponse = await fetch('http://localhost:3000/admin/auth/signup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tenantName: 'Acme Inc',
    name: 'John Doe',
    email: 'john@acme.com',
    password: 'SecurePass123!',
    plan: 'professional'
  })
});

const { data: signupData } = await signupResponse.json();
const token = signupData.token;
console.log('JWT Token:', token);

// 2. Obtener conversaciones
const conversationsResponse = await fetch('http://localhost:3000/admin/conversations?status=active', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { data: conversationsData } = await conversationsResponse.json();
const firstConversation = conversationsData.data[0];
console.log('First conversation:', firstConversation);

// 3. Enviar mensaje
const messageResponse = await fetch(`http://localhost:3000/admin/conversations/${firstConversation.id}/messages`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    content: {
      type: 'text',
      text: '¡Hola! ¿En qué puedo ayudarte hoy?'
    }
  })
});

const { data: messageData } = await messageResponse.json();
console.log('Message sent:', messageData);

// 4. Conectar WebSocket para actualizaciones en tiempo real
const ws = new WebSocket(`ws://localhost:3000/realtime?token=${token}`);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time event:', data);
};
```

### 7.2 Gestión de Errores

```javascript
async function sendMessage(conversationId, text) {
  try {
    const response = await fetch(`http://localhost:3000/admin/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: { type: 'text', text }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      // Manejar errores específicos
      switch (data.error.code) {
        case 'RATE_LIMIT_EXCEEDED':
          console.error(`Rate limit exceeded. Retry after ${data.error.details.retryAfter}s`);
          break;

        case 'PLAN_LIMIT_EXCEEDED':
          console.error('Plan limit exceeded. Upgrade your plan.');
          break;

        case 'INVALID_TOKEN':
        case 'TOKEN_EXPIRED':
          console.error('Authentication failed. Please login again.');
          // Redirigir a login
          break;

        case 'NOT_FOUND':
          console.error('Conversation not found.');
          break;

        default:
          console.error(`Error: ${data.error.message}`);
      }

      return null;
    }

    return data.data;
  } catch (error) {
    console.error('Network error:', error);
    return null;
  }
}
```

### 7.3 Paginación

```javascript
async function getAllConversations() {
  const allConversations = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`http://localhost:3000/admin/conversations?page=${page}&limit=100`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const { data } = await response.json();

    allConversations.push(...data.data);
    hasMore = data.pagination.hasMore;
    page++;
  }

  console.log(`Fetched ${allConversations.length} conversations`);
  return allConversations;
}
```

---

## CONCLUSIÓN

Esta documentación cubre todos los endpoints de la API de INHOST v2.0. Para más detalles sobre la arquitectura del sistema, consulta `ARCHITECTURE.md`.

**Recursos adicionales:**
- [Documentación de Arquitectura](./ARCHITECTURE.md)
- [Guía de Integración Frontend](./FRONTEND-INTEGRATION-GUIDE.md)
- [Reporte de Auditoría](./AUDIT-REPORT.md)

**Soporte:**
- Email: support@inhost.com
- Docs: https://docs.inhost.com
- Status: https://status.inhost.com

---

**Última actualización:** 2025-11-20
**Versión de la API:** 2.0.0
