# MANDATOS DE INTEGRACIÓN - ADMIN DASHBOARD

**Versión:** 1.0.0
**Fecha:** 2025-11-19
**Estado:** 🔴 OBLIGATORIO - Implementación Requerida
**Prioridad:** P0 (Crítico)
**Audiencia:** Equipo Frontend

---

## 🎯 OBJETIVO

Implementar el dashboard de administración integrado con el backend multi-tenancy recién desarrollado. Este documento establece los **mandatos obligatorios** para la integración.

---

## 📋 MANDATOS GENERALES

### MANDATO #1: Uso del API Contract
**Prioridad:** P0 - CRÍTICO

✅ **OBLIGATORIO:**
- Importar `/api-contract.json` en tu proyecto
- Usar URLs del contract (NO hardcodear endpoints)
- Seguir exactamente los formatos de request/response documentados

❌ **PROHIBIDO:**
- Hardcodear URLs
- Inventar formatos de payload no documentados
- Ignorar códigos de error del contract

**Ejemplo:**
```typescript
import apiContract from '@/api-contract.json';

const BASE_URL = apiContract.baseURL.development; // http://localhost:3000
const signup = async (data) => {
  const endpoint = apiContract.adminEndpoints.auth.signup;
  const response = await fetch(`${BASE_URL}${endpoint.path}`, {
    method: endpoint.method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
};
```

---

### MANDATO #2: Autenticación JWT
**Prioridad:** P0 - CRÍTICO

✅ **OBLIGATORIO:**
- Almacenar `accessToken` y `refreshToken` después de login/signup
- Enviar `Authorization: Bearer <token>` en TODAS las requests a `/admin/*`
- Implementar refresh token logic ANTES de que expire el access token
- Limpiar tokens al hacer logout

❌ **PROHIBIDO:**
- Guardar tokens en cookies sin HttpOnly flag
- Enviar tokens en query parameters
- Ignorar errores 401/403

**Almacenamiento Recomendado:**
```typescript
// localStorage para persist entre sesiones
localStorage.setItem('inhost_access_token', tokens.accessToken);
localStorage.setItem('inhost_refresh_token', tokens.refreshToken);

// O sessionStorage para solo la sesión actual
sessionStorage.setItem('inhost_access_token', tokens.accessToken);
```

**Interceptor de Requests (Ejemplo con Fetch):**
```typescript
const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('inhost_access_token');

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };

  const response = await fetch(url, { ...options, headers });

  // Handle 401 - Token expired
  if (response.status === 401) {
    // Refresh token logic aquí
    // O redirect a login
    window.location.href = '/login';
  }

  return response;
};
```

---

### MANDATO #3: Manejo de Errores
**Prioridad:** P0 - CRÍTICO

✅ **OBLIGATORIO:**
- Manejar TODOS los códigos HTTP documentados en el contract
- Mostrar mensajes de error amigables al usuario
- Loggear errores 500 para debugging
- Implementar retry logic para errores de red

**Códigos a Manejar:**
- `401` - Token inválido/expirado → Redirect a login
- `403` - Sin permisos → Mostrar mensaje "No tienes permisos"
- `404` - Recurso no encontrado → Mensaje específico
- `409` - Conflicto (ej: email existe) → Mostrar error en formulario
- `422` - Validación fallida → Mostrar errores de validación
- `500` - Error del servidor → Mensaje genérico + log

**Ejemplo:**
```typescript
const handleApiError = (status: number, error: any) => {
  switch (status) {
    case 401:
      toast.error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      navigate('/login');
      break;
    case 403:
      toast.error('No tienes permisos para realizar esta acción.');
      break;
    case 409:
      if (error.code === 'EMAIL_EXISTS') {
        toast.error('Este email ya está registrado.');
      }
      break;
    case 422:
      toast.error(error.message); // "Password must be at least 8 characters"
      break;
    case 500:
      console.error('Server error:', error);
      toast.error('Ocurrió un error. Intenta nuevamente.');
      break;
  }
};
```

---

## 🔐 FLUJO DE AUTENTICACIÓN

### MANDATO #4: Implementar Signup Flow
**Prioridad:** P0 - CRÍTICO

**Endpoint:** `POST /admin/auth/signup`

**Pasos Obligatorios:**

1. **Validar formulario en frontend:**
   - Company name: 2-255 chars
   - Name: 2-255 chars
   - Email: formato válido
   - Password: min 8 chars, 1 uppercase, 1 lowercase, 1 number

2. **Enviar request:**
```typescript
const signup = async (formData: SignupForm) => {
  const response = await fetch('http://localhost:3000/admin/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyName: formData.companyName,
      name: formData.name,
      email: formData.email,
      password: formData.password
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  return response.json();
};
```

3. **Almacenar tokens y redirect:**
```typescript
const handleSignup = async () => {
  try {
    const result = await signup(formData);

    // Almacenar tokens
    localStorage.setItem('inhost_access_token', result.data.tokens.accessToken);
    localStorage.setItem('inhost_refresh_token', result.data.tokens.refreshToken);

    // Almacenar info del usuario
    localStorage.setItem('inhost_user', JSON.stringify(result.data.user));

    // Redirect a dashboard
    navigate('/dashboard');
  } catch (error) {
    toast.error(error.message);
  }
};
```

---

### MANDATO #5: Implementar Login Flow
**Prioridad:** P0 - CRÍTICO

**Endpoint:** `POST /admin/auth/login`

**Implementación:**
```typescript
const login = async (email: string, password: string) => {
  const response = await fetch('http://localhost:3000/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 401) {
      throw new Error('Email o contraseña incorrectos');
    }
    if (response.status === 403) {
      throw new Error('Tu cuenta ha sido desactivada');
    }
    throw new Error('Error al iniciar sesión');
  }

  return response.json();
};
```

---

### MANDATO #6: Implementar Protected Routes
**Prioridad:** P0 - CRÍTICO

✅ **OBLIGATORIO:**
- Verificar token antes de renderizar rutas protegidas
- Redirect a `/login` si no hay token
- Verificar rol del usuario para rutas específicas (owner/admin only)

**Ejemplo con React Router:**
```typescript
const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const token = localStorage.getItem('inhost_access_token');
  const user = JSON.parse(localStorage.getItem('inhost_user') || '{}');

  if (!token) {
    return <Navigate to="/login" />;
  }

  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" />;
  }

  return children;
};

// Uso
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

## 📊 DASHBOARD PRINCIPAL

### MANDATO #7: Vista de Estadísticas
**Prioridad:** P0 - CRÍTICO

**Endpoint:** `GET /admin/tenant/stats`

**Componentes Obligatorios:**
1. Card de Conversaciones Activas
2. Card de Total de Clientes
3. Card de Miembros del Equipo

**Ejemplo:**
```typescript
const DashboardStats = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      const response = await authFetch('http://localhost:3000/admin/tenant/stats');
      const data = await response.json();
      setStats(data.data);
    };
    fetchStats();
  }, []);

  return (
    <div className="grid grid-cols-3 gap-4">
      <StatsCard
        title="Conversaciones Activas"
        value={stats?.conversations.active}
        total={stats?.conversations.total}
      />
      <StatsCard
        title="Clientes"
        value={stats?.endUsers.total}
      />
      <StatsCard
        title="Equipo Activo"
        value={stats?.team.active}
      />
    </div>
  );
};
```

---

### MANDATO #8: Lista de Conversaciones
**Prioridad:** P0 - CRÍTICO

**Endpoint:** `GET /admin/conversations`

**Features Obligatorias:**
- Paginación (limit/offset)
- Filtros por status (active/closed/archived)
- Filtros por canal (whatsapp/telegram/web/instagram)
- Mostrar información del end user
- Mostrar agente asignado
- Contador de mensajes
- Click para ver detalles

**Ejemplo:**
```typescript
const ConversationsList = () => {
  const [conversations, setConversations] = useState([]);
  const [filters, setFilters] = useState({ status: 'active', limit: 50, offset: 0 });

  const fetchConversations = async () => {
    const params = new URLSearchParams(filters);
    const response = await authFetch(
      `http://localhost:3000/admin/conversations?${params}`
    );
    const data = await response.json();
    setConversations(data.data.conversations);
  };

  return (
    <div>
      {/* Filtros */}
      <Filters onChange={setFilters} />

      {/* Lista */}
      <div className="conversations-list">
        {conversations.map(conv => (
          <ConversationCard
            key={conv.id}
            conversation={conv}
            onClick={() => navigate(`/conversations/${conv.id}`)}
          />
        ))}
      </div>
    </div>
  );
};
```

---

### MANDATO #9: Vista de Conversación
**Prioridad:** P1 - ALTA

**Endpoint:** `GET /admin/conversations/:id`

**Features Obligatorias:**
- Mostrar todos los mensajes (últimos 100)
- Scroll automático a mensaje más reciente
- Diferenciar incoming/outgoing visualmente
- Mostrar timestamp de cada mensaje
- Botón para asignar conversación
- Botón para cerrar conversación

**Ejemplo:**
```typescript
const ConversationView = ({ conversationId }) => {
  const [conversation, setConversation] = useState(null);

  useEffect(() => {
    const fetchConversation = async () => {
      const response = await authFetch(
        `http://localhost:3000/admin/conversations/${conversationId}`
      );
      const data = await response.json();
      setConversation(data.data);
    };
    fetchConversation();
  }, [conversationId]);

  return (
    <div className="conversation-view">
      {/* Header con info del end user */}
      <ConversationHeader endUser={conversation?.endUser} />

      {/* Mensajes */}
      <MessagesList messages={conversation?.messages} />

      {/* Actions */}
      <ConversationActions
        conversationId={conversationId}
        onAssign={handleAssign}
        onClose={handleClose}
      />
    </div>
  );
};
```

---

### MANDATO #10: Asignar Conversación
**Prioridad:** P1 - ALTA

**Endpoint:** `PATCH /admin/conversations/:id`

**Implementación:**
```typescript
const assignConversation = async (conversationId: string, agentId: string) => {
  const response = await authFetch(
    `http://localhost:3000/admin/conversations/${conversationId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedToId: agentId })
    }
  );

  if (!response.ok) {
    throw new Error('Error al asignar conversación');
  }

  return response.json();
};
```

---

## 👥 GESTIÓN DE CLIENTES

### MANDATO #11: Lista de End Users
**Prioridad:** P1 - ALTA

**Endpoint:** `GET /admin/end-users`

**Features Obligatorias:**
- Búsqueda por nombre/email/teléfono
- Filtro por canal
- Filtro por bloqueados
- Mostrar tags
- Contador de conversaciones
- Click para ver detalles

**Ejemplo:**
```typescript
const EndUsersList = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    const params = new URLSearchParams({
      search,
      limit: '50',
      isBlocked: 'false'
    });
    const response = await authFetch(
      `http://localhost:3000/admin/end-users?${params}`
    );
    const data = await response.json();
    setUsers(data.data.endUsers);
  };

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} />
      <UsersList users={users} />
    </div>
  );
};
```

---

### MANDATO #12: Perfil de Cliente
**Prioridad:** P1 - ALTA

**Endpoint:** `GET /admin/end-users/:id`

**Features Obligatorias:**
- Mostrar toda la información del cliente
- Editar tags
- Bloquear/desbloquear usuario
- Ver historial de conversaciones
- Ver metadata

---

## 👨‍💼 GESTIÓN DE EQUIPO

### MANDATO #13: Lista de Equipo
**Prioridad:** P1 - ALTA

**Endpoint:** `GET /admin/team`

**Features Obligatorias:**
- Mostrar todos los miembros activos
- Badge visual para roles (owner/admin/agent/viewer)
- Último login
- Botón para agregar miembro (solo owner/admin)

---

### MANDATO #14: Invitar Miembro
**Prioridad:** P1 - ALTA

**Endpoint:** `POST /admin/team`

**Roles que pueden:** `owner`, `admin`

**Validaciones Frontend:**
- Email válido
- Password fuerte (usar mismas reglas que signup)
- Rol seleccionado

**Implementación:**
```typescript
const inviteTeamMember = async (memberData) => {
  const response = await authFetch('http://localhost:3000/admin/team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(memberData)
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 409) {
      throw new Error('Este email ya está registrado');
    }
    if (response.status === 403) {
      throw new Error('No tienes permisos para realizar esta acción');
    }
    throw new Error('Error al invitar miembro');
  }

  return response.json();
};
```

---

### MANDATO #15: Gestionar Roles
**Prioridad:** P2 - MEDIA

**Endpoint:** `PATCH /admin/team/:id`

**Roles que pueden:** `owner`, `admin`

**Restricciones a Implementar:**
- No permitir que el usuario se modifique a sí mismo
- Solo owners pueden cambiar roles de owner
- Mostrar mensaje de error apropiado

---

## 🎨 UI/UX MANDATOS

### MANDATO #16: Loading States
**Prioridad:** P1 - ALTA

✅ **OBLIGATORIO:**
- Mostrar skeleton loaders durante fetch
- Deshabilitar botones durante POST/PATCH/DELETE
- Mostrar spinner en botones de submit

---

### MANDATO #17: Success Feedback
**Prioridad:** P1 - ALTA

✅ **OBLIGATORIO:**
- Toast/notification de éxito después de:
  - Signup/Login exitoso
  - Conversación asignada
  - Conversación cerrada
  - Miembro de equipo agregado
  - Cliente actualizado

---

### MANDATO #18: Empty States
**Prioridad:** P1 - ALTA

✅ **OBLIGATORIO:**
- Mostrar empty state cuando:
  - No hay conversaciones activas
  - No hay clientes
  - Búsqueda sin resultados
- Incluir call-to-action apropiado

---

## 📱 RESPONSIVE DESIGN

### MANDATO #19: Mobile First
**Prioridad:** P1 - ALTA

✅ **OBLIGATORIO:**
- Dashboard debe funcionar en móvil (min-width: 320px)
- Navegación mobile-friendly
- Formularios adaptados a pantallas pequeñas
- Touch targets de mínimo 44x44px

---

## 🔒 SEGURIDAD

### MANDATO #20: Sanitización XSS
**Prioridad:** P0 - CRÍTICO

✅ **OBLIGATORIO:**
- Sanitizar TODOS los inputs de usuario antes de renderizar
- Usar librerías como DOMPurify
- Escapar HTML en nombres de clientes, mensajes, etc.

**Ejemplo:**
```typescript
import DOMPurify from 'dompurify';

const SafeText = ({ text }) => {
  const clean = DOMPurify.sanitize(text);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
};
```

---

### MANDATO #21: No Exponer Tokens
**Prioridad:** P0 - CRÍTICO

❌ **PROHIBIDO:**
- Loggear tokens en console.log
- Enviar tokens en query parameters
- Almacenar tokens en cookies sin HttpOnly (si usas cookies)

---

## 🧪 TESTING

### MANDATO #22: Tests de Integración
**Prioridad:** P2 - MEDIA

✅ **RECOMENDADO:**
- Test de signup flow completo
- Test de login flow
- Test de conversaciones CRUD
- Test de team management

---

## 📦 ENTREGABLES

### Sprint 1 (P0)
- [x] Signup/Login funcional
- [x] Protected routes
- [x] Dashboard con estadísticas
- [x] Lista de conversaciones
- [x] Manejo de errores

### Sprint 2 (P1)
- [ ] Vista de conversación completa
- [ ] Asignar conversaciones
- [ ] Lista de end users
- [ ] Gestión de equipo básica

### Sprint 3 (P2)
- [ ] Perfil de cliente editable
- [ ] Gestión avanzada de equipo
- [ ] Filtros avanzados
- [ ] Tests

---

## 🚨 ANTI-PATTERNS A EVITAR

❌ **NO HAGAS ESTO:**

1. **Hardcodear URLs**
```typescript
// ❌ MAL
const response = await fetch('http://localhost:3000/admin/auth/login');

// ✅ BIEN
import contract from '@/api-contract.json';
const url = `${contract.baseURL.development}${contract.adminEndpoints.auth.login.path}`;
```

2. **Ignorar errores**
```typescript
// ❌ MAL
try {
  await fetchData();
} catch (error) {
  // Silenciar error
}

// ✅ BIEN
try {
  await fetchData();
} catch (error) {
  handleApiError(error.status, error.data);
  toast.error('Error al cargar datos');
}
```

3. **No validar en frontend**
```typescript
// ❌ MAL - Enviar sin validar
const handleSubmit = () => {
  signup(formData); // Sin validación
};

// ✅ BIEN - Validar antes de enviar
const handleSubmit = () => {
  const errors = validateSignupForm(formData);
  if (errors.length > 0) {
    setFormErrors(errors);
    return;
  }
  signup(formData);
};
```

4. **No manejar estados de loading**
```typescript
// ❌ MAL
const handleSubmit = async () => {
  await signup(formData);
};

// ✅ BIEN
const handleSubmit = async () => {
  setLoading(true);
  try {
    await signup(formData);
  } finally {
    setLoading(false);
  }
};
```

---

## 📞 SOPORTE

**Dudas sobre integración:**
- Revisar `/docs/frontend-handoff/ADMIN-BACKEND-IMPLEMENTATION-REPORT.md`
- Revisar `/api-contract.json`
- Crear issue en GitHub

**Backend no funciona:**
- Verificar que PostgreSQL esté corriendo
- Verificar que migraciones se hayan ejecutado (`bun run db:push`)
- Verificar logs del servidor

---

## ✅ CHECKLIST DE INTEGRACIÓN

Antes de dar por terminada la integración, verificar:

- [ ] Signup funciona y almacena tokens
- [ ] Login funciona y almacena tokens
- [ ] Rutas protegidas redirect a login si no hay token
- [ ] Dashboard muestra estadísticas reales del backend
- [ ] Lista de conversaciones se carga y filtra correctamente
- [ ] Se puede asignar una conversación a un agente
- [ ] Se puede cerrar una conversación
- [ ] Lista de end users se carga y busca correctamente
- [ ] Se puede invitar un nuevo miembro al equipo
- [ ] Manejo de errores funciona para todos los casos
- [ ] Loading states están implementados
- [ ] Success notifications están implementadas
- [ ] Empty states están implementados
- [ ] Responsive en mobile funciona
- [ ] No hay hardcoded URLs
- [ ] Sanitización XSS implementada

---

**Fin de Mandatos** 🎯
