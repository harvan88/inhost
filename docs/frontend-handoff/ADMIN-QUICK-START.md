# QUICK START - Admin Dashboard Integration

**⚡ Guía rápida de 5 minutos para empezar con la integración del dashboard admin**

---

## 🚀 Setup en 5 Pasos

### 1️⃣ Instalar y Ejecutar Backend

```bash
# Instalar dependencias
bun install

# Iniciar PostgreSQL
bun run dev:db

# Ejecutar migraciones
bun run db:push

# Iniciar API (puerto 3000)
bun run dev:api
```

### 2️⃣ Verificar que el Backend Funciona

```bash
# Health check
curl http://localhost:3000/health

# Debe responder:
# {"success":true,"data":{"status":"healthy","database":"postgresql",...}}
```

### 3️⃣ Crear Tu Primera Cuenta

```bash
curl -X POST http://localhost:3000/admin/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Mi Empresa Test",
    "name": "Test User",
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

**Guarda el `accessToken` de la respuesta!**

### 4️⃣ Probar Endpoints Protegidos

```bash
# Reemplaza YOUR_TOKEN con el accessToken del paso anterior
curl http://localhost:3000/admin/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5️⃣ Importar API Contract en tu Frontend

```typescript
// En tu proyecto frontend
import apiContract from '@/path/to/api-contract.json';

const BASE_URL = apiContract.baseURL.development; // http://localhost:3000

// Ejemplo: Login
const login = async (email: string, password: string) => {
  const endpoint = apiContract.adminEndpoints.auth.login;
  const response = await fetch(`${BASE_URL}${endpoint.path}`, {
    method: endpoint.method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return response.json();
};
```

---

## 📋 Endpoints Principales

### Auth
- `POST /admin/auth/signup` - Crear cuenta
- `POST /admin/auth/login` - Login
- `GET /admin/auth/me` - Usuario actual (requiere token)

### Dashboard
- `GET /admin/tenant/stats` - Estadísticas (requiere token)

### Conversaciones
- `GET /admin/conversations` - Listar (requiere token)
- `GET /admin/conversations/:id` - Detalles (requiere token)
- `PATCH /admin/conversations/:id` - Actualizar (requiere token)

### End Users (Clientes)
- `GET /admin/end-users` - Listar (requiere token)
- `GET /admin/end-users/:id` - Detalles (requiere token)
- `PATCH /admin/end-users/:id` - Actualizar (requiere token)

### Team
- `GET /admin/team` - Listar equipo (requiere token)
- `POST /admin/team` - Invitar miembro (requiere token, owner/admin)
- `PATCH /admin/team/:id` - Actualizar (requiere token, owner/admin)
- `DELETE /admin/team/:id` - Eliminar (requiere token, owner only)

---

## 🔑 Autenticación - Copy/Paste Ready

### React Hook para Auth

```typescript
// useAuth.ts
import { useState, useEffect } from 'react';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('inhost_access_token');
    const userData = localStorage.getItem('inhost_user');

    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch('http://localhost:3000/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) throw new Error('Login failed');

    const data = await response.json();
    localStorage.setItem('inhost_access_token', data.data.tokens.accessToken);
    localStorage.setItem('inhost_user', JSON.stringify(data.data.user));
    setUser(data.data.user);
  };

  const logout = () => {
    localStorage.removeItem('inhost_access_token');
    localStorage.removeItem('inhost_refresh_token');
    localStorage.removeItem('inhost_user');
    setUser(null);
  };

  return { user, loading, login, logout };
};
```

### Fetch Helper con Auth

```typescript
// api.ts
export const authFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('inhost_access_token');

  const response = await fetch(`http://localhost:3000${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Token expired, redirect to login
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Request failed');
  }

  return response.json();
};

// Uso:
const stats = await authFetch('/admin/tenant/stats');
console.log(stats.data); // { conversations: {...}, endUsers: {...}, team: {...} }
```

### Protected Route Component

```typescript
// ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" />;
  }

  return children;
};

// Uso en router:
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />

<Route path="/team" element={
  <ProtectedRoute requiredRoles={['owner', 'admin']}>
    <TeamManagement />
  </ProtectedRoute>
} />
```

---

## 📊 Dashboard Stats - Copy/Paste Ready

```typescript
// Dashboard.tsx
import { useEffect, useState } from 'react';
import { authFetch } from './api';

export const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await authFetch('/admin/tenant/stats');
        setStats(data.data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="card">
        <h3>Conversaciones Activas</h3>
        <p className="text-4xl">{stats?.conversations.active}</p>
        <p className="text-sm text-gray-500">de {stats?.conversations.total} total</p>
      </div>

      <div className="card">
        <h3>Clientes</h3>
        <p className="text-4xl">{stats?.endUsers.total}</p>
      </div>

      <div className="card">
        <h3>Equipo Activo</h3>
        <p className="text-4xl">{stats?.team.active}</p>
      </div>
    </div>
  );
};
```

---

## 🗂️ Estructura de Proyecto Recomendada

```
src/
├── pages/
│   ├── Login.tsx                    # POST /admin/auth/login
│   ├── Signup.tsx                   # POST /admin/auth/signup
│   ├── Dashboard.tsx                # GET /admin/tenant/stats
│   ├── Conversations.tsx            # GET /admin/conversations
│   ├── ConversationView.tsx         # GET /admin/conversations/:id
│   ├── EndUsers.tsx                 # GET /admin/end-users
│   └── Team.tsx                     # GET /admin/team
├── components/
│   ├── ProtectedRoute.tsx
│   ├── ConversationCard.tsx
│   ├── StatsCard.tsx
│   └── ...
├── hooks/
│   ├── useAuth.ts
│   ├── useConversations.ts
│   └── useEndUsers.ts
├── lib/
│   └── api.ts                       # authFetch helper
└── types/
    └── api.ts                       # TypeScript types del API contract
```

---

## ⚠️ Errores Comunes y Soluciones

### ❌ "401 Unauthorized"
**Causa:** Token expirado o inválido
**Solución:** Redirect a login

### ❌ "403 Forbidden"
**Causa:** No tienes permisos para esta acción
**Solución:** Verificar rol del usuario, mostrar mensaje apropiado

### ❌ "ECONNREFUSED"
**Causa:** Backend no está corriendo
**Solución:** Ejecutar `bun run dev:api`

### ❌ "Database connection failed"
**Causa:** PostgreSQL no está corriendo
**Solución:** Ejecutar `bun run dev:db`

### ❌ "Table does not exist"
**Causa:** Migraciones no ejecutadas
**Solución:** Ejecutar `bun run db:push`

---

## 📚 Documentación Completa

- **Reporte de Implementación:** `/docs/frontend-handoff/ADMIN-BACKEND-IMPLEMENTATION-REPORT.md`
- **Mandatos de Integración:** `/docs/frontend-handoff/ADMIN-INTEGRATION-MANDATES.md`
- **API Contract:** `/api-contract.json`

---

## ✅ Checklist Mínimo Viable

Para tener un dashboard funcional básico:

- [ ] Backend corriendo en `http://localhost:3000`
- [ ] Página de Signup funcional
- [ ] Página de Login funcional
- [ ] Almacenar JWT en localStorage
- [ ] Protected routes implementadas
- [ ] Dashboard con stats básicas
- [ ] Lista de conversaciones
- [ ] Manejo de errores 401/403/500

---

## 🎯 Next Steps

1. **Implementa Auth** → Signup + Login + Protected Routes
2. **Dashboard Stats** → Integra `/admin/tenant/stats`
3. **Conversaciones** → Lista + Vista detallada
4. **End Users** → Lista básica
5. **Team** → Lista + Invitar miembros

---

**¿Preguntas?** Revisa la documentación completa en `/docs/frontend-handoff/` 📖
