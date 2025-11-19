# 🎨 Mandatos para Frontend - Multi-Tenancy V2

**Para:** Equipo Frontend
**Backend API:** http://localhost:3000/admin/*
**Auth:** JWT (Bearer token)
**Fecha:** 2025-11-19

---

## 🎯 Objetivo

Crear **inhost-admin-dashboard** (Next.js) que consuma `/admin/*` API con autenticación JWT.

**NO crear:**
- ❌ Chat widget para end users (ellos usan WhatsApp/Instagram)
- ❌ Frontend para end users (no lo necesitan)

**SÍ crear:**
- ✅ Admin Dashboard para tenant users (admins/agentes)
- ✅ Login/Signup
- ✅ Inbox (conversaciones multi-canal)
- ✅ Gestión de end users
- ✅ Settings

---

## 📋 Mandato 1: Setup Proyecto

### Crear proyecto Next.js

```bash
npx create-next-app@latest inhost-admin-dashboard \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir

cd inhost-admin-dashboard
```

### Instalar dependencias

```bash
npm install @tanstack/react-query axios zustand
npm install -D @types/node
```

### Copiar contrato API

```bash
# Copiar desde backend
cp ../api-contract-admin.json ./
```

### Estructura de carpetas

```
inhost-admin-dashboard/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── signup/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx           # Layout con sidebar
│   │   ├── page.tsx             # Dashboard home
│   │   ├── inbox/
│   │   │   └── page.tsx
│   │   ├── end-users/
│   │   │   └── page.tsx
│   │   ├── team/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   └── layout.tsx               # Root layout
├── lib/
│   ├── api/
│   │   └── admin-client.ts      # API client (MANDATO 2)
│   ├── auth/
│   │   └── jwt.ts               # JWT helpers
│   └── store/
│       └── auth-store.ts        # Zustand store
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── SignupForm.tsx
│   └── dashboard/
│       ├── Sidebar.tsx
│       ├── ConversationList.tsx
│       └── EndUserCard.tsx
└── api-contract-admin.json
```

---

## 📋 Mandato 2: API Client

### Crear `lib/api/admin-client.ts`

```typescript
// lib/api/admin-client.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  tenantName: string;
  plan?: 'starter' | 'professional' | 'enterprise';
}

export interface AuthResponse {
  success: boolean;
  data: {
    token: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      tenant: {
        id: string;
        name: string;
        slug: string;
        plan: string;
      };
    };
  };
}

class AdminAPIClient {
  private baseURL = API_BASE_URL + '/admin';

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const token = localStorage.getItem('token');

    const res = await fetch(this.baseURL + endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options?.headers
      }
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || `API Error: ${res.statusText}`);
    }

    return res.json();
  }

  // Auth
  async login(data: LoginRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async signup(data: SignupRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Tenant (TODO - cuando backend implemente)
  async getTenant() {
    return this.request('/tenant');
  }

  async updateTenant(data: any) {
    return this.request('/tenant', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  // Conversations (TODO)
  async getConversations(params?: { limit?: number; offset?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/conversations?${query}`);
  }

  // End Users (TODO)
  async getEndUsers(params?: { limit?: number; search?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/end-users?${query}`);
  }
}

export const adminAPI = new AdminAPIClient();
```

---

## 📋 Mandato 3: Auth Store (Zustand)

### Crear `lib/store/auth-store.ts`

```typescript
// lib/store/auth-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        localStorage.setItem('token', token);
        set({ token, user });
      },
      logout: () => {
        localStorage.removeItem('token');
        set({ token: null, user: null });
      }
    }),
    {
      name: 'auth-storage'
    }
  )
);
```

---

## 📋 Mandato 4: Login Page

### Crear `app/(auth)/login/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminAPI } from '@/lib/api/admin-client';
import { useAuthStore } from '@/lib/store/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore(state => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const response = await adminAPI.login({ email, password });

      if (response.success) {
        setAuth(response.data.token, response.data.user);
        router.push('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-3xl font-bold text-center">INHOST Admin</h2>
          <p className="mt-2 text-center text-gray-600">Sign in to your account</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <p className="text-center text-sm">
            Don't have an account?{' '}
            <a href="/signup" className="text-blue-600 hover:underline">
              Sign up
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
```

---

## 📋 Mandato 5: Signup Page

### Crear `app/(auth)/signup/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminAPI } from '@/lib/api/admin-client';
import { useAuthStore } from '@/lib/store/auth-store';

export default function SignupPage() {
  const router = useRouter();
  const setAuth = useAuthStore(state => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);

    try {
      const response = await adminAPI.signup({
        email: formData.get('email') as string,
        password: formData.get('password') as string,
        name: formData.get('name') as string,
        tenantName: formData.get('tenantName') as string,
        plan: formData.get('plan') as any || 'starter'
      });

      if (response.success) {
        setAuth(response.data.token, response.data.user);
        router.push('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-3xl font-bold text-center">Create Account</h2>
          <p className="mt-2 text-center text-gray-600">Start your 14-day free trial</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="tenantName" className="block text-sm font-medium">
              Company Name
            </label>
            <input
              id="tenantName"
              name="tenantName"
              type="text"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Your Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label htmlFor="plan" className="block text-sm font-medium">
              Plan
            </label>
            <select
              id="plan"
              name="plan"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="starter">Starter (Free)</option>
              <option value="professional">Professional ($49/mo)</option>
              <option value="enterprise">Enterprise ($199/mo)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          <p className="text-center text-sm">
            Already have an account?{' '}
            <a href="/login" className="text-blue-600 hover:underline">
              Sign in
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
```

---

## 📋 Mandato 6: Protected Route Middleware

### Crear `middleware.ts` en la raíz

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
                     request.nextUrl.pathname.startsWith('/signup');

  // Si no hay token y no es página de auth → redirect a login
  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Si hay token y es página de auth → redirect a dashboard
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};
```

---

## 📋 Mandato 7: Dashboard Layout

### Crear `app/(dashboard)/layout.tsx`

```typescript
// app/(dashboard)/layout.tsx
'use client';

import { useAuthStore } from '@/lib/store/auth-store';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-full w-64 bg-white shadow">
        <div className="p-4">
          <h1 className="text-2xl font-bold">INHOST</h1>
          <p className="text-sm text-gray-600">{user?.tenant.name}</p>
        </div>

        <nav className="mt-8">
          <a href="/" className="block px-4 py-2 hover:bg-gray-100">
            📊 Dashboard
          </a>
          <a href="/inbox" className="block px-4 py-2 hover:bg-gray-100">
            💬 Inbox
          </a>
          <a href="/end-users" className="block px-4 py-2 hover:bg-gray-100">
            👥 Customers
          </a>
          <a href="/team" className="block px-4 py-2 hover:bg-gray-100">
            🤝 Team
          </a>
          <a href="/settings" className="block px-4 py-2 hover:bg-gray-100">
            ⚙️ Settings
          </a>
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t">
          <p className="text-sm">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="mt-2 text-sm text-red-600 hover:underline"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
```

---

## 📋 Mandato 8: Dashboard Home

### Crear `app/(dashboard)/page.tsx`

```typescript
// app/(dashboard)/page.tsx
'use client';

import { useAuthStore } from '@/lib/store/auth-store';

export default function DashboardPage() {
  const user = useAuthStore(state => state.user);

  return (
    <div>
      <h1 className="text-3xl font-bold">
        Welcome back, {user?.name}! 👋
      </h1>

      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-600">Active Conversations</h3>
          <p className="text-3xl font-bold mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-600">Total Customers</h3>
          <p className="text-3xl font-bold mt-2">0</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-600">Team Members</h3>
          <p className="text-3xl font-bold mt-2">1</p>
        </div>
      </div>

      <div className="mt-8 bg-yellow-50 border-l-4 border-yellow-400 p-4">
        <p className="text-sm">
          <strong>Coming soon:</strong> Conversations, End Users, and Analytics will be available once backend endpoints are implemented.
        </p>
      </div>
    </div>
  );
}
```

---

## ✅ Checklist de Implementación

### Setup (1 hora)
- [ ] Crear proyecto Next.js
- [ ] Instalar dependencias
- [ ] Copiar api-contract-admin.json
- [ ] Crear estructura de carpetas

### Core (2-3 horas)
- [ ] Implementar API Client (`lib/api/admin-client.ts`)
- [ ] Implementar Auth Store (`lib/store/auth-store.ts`)
- [ ] Crear middleware de autenticación

### Auth Pages (2 horas)
- [ ] Página de Login
- [ ] Página de Signup
- [ ] Testing de auth flow

### Dashboard (3-4 horas)
- [ ] Layout con sidebar
- [ ] Dashboard home
- [ ] Placeholders para Inbox, End Users, Team, Settings

### Testing (1 hora)
- [ ] Test signup → crea tenant + user
- [ ] Test login → obtiene JWT
- [ ] Test protected routes → redirect si no auth
- [ ] Test logout → limpia token

---

## 🚀 Comandos Útiles

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Start producción
npm start

# Linter
npm run lint
```

---

## 📞 API Backend

**Base URL:** http://localhost:3000/admin
**Endpoints disponibles AHORA:**
- ✅ POST /admin/auth/login
- ✅ POST /admin/auth/signup

**Endpoints próximos:**
- 📋 GET /admin/tenant
- 📋 GET /admin/conversations
- 📋 GET /admin/end-users
- 📋 GET /admin/capabilities

---

## 🎯 Resultado Esperado

Al finalizar, debes tener:

1. ✅ Usuario puede hacer signup → crea cuenta
2. ✅ Usuario puede hacer login → obtiene JWT
3. ✅ Dashboard muestra info del usuario y tenant
4. ✅ Sidebar con navegación
5. ✅ Logout funciona correctamente
6. ✅ Protected routes redirigen a login si no auth

---

**⏰ Tiempo estimado total: 8-10 horas**
**🚀 ¡Empezar con Mandato 1!**
