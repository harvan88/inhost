# 🏢 Multi-Tenancy Model - Tenants vs End Users

## Concepto: Dos Tipos de Usuarios

En INHOST hay **dos tipos de usuarios distintos**:

### 1. **Tenants (Organizaciones/Empresas)** 🏢
- **Quiénes son:** Tus clientes directos que COMPRAN el servicio
- **Qué hacen:** Configuran el servicio, pagan, administran
- **Ejemplos:**
  - "Tienda XYZ" - E-commerce que quiere chat con clientes
  - "Clínica ABC" - Consultorio médico que necesita comunicación con pacientes
  - "Empresa 123" - Corporativo que requiere soporte multicanal

### 2. **End Users (Clientes Finales)** 👤
- **Quiénes son:** Los que CHATEAN (clientes de tus clientes)
- **Qué hacen:** Envían/reciben mensajes vía WhatsApp, Telegram, etc.
- **Ejemplos:**
  - Juan Pérez - Cliente de "Tienda XYZ" preguntando por un pedido
  - María López - Paciente de "Clínica ABC" agendando cita
  - Pedro García - Usuario de "Empresa 123" solicitando soporte

---

## 📊 Modelo de Datos Actual vs Propuesto

### ❌ Modelo ACTUAL (Problemático)

```sql
-- Una sola tabla "users" para todo
users
├── id: uuid
├── email: varchar
├── name: varchar
├── plan: varchar ('free', 'premium')  ← Mezclado
└── ...

-- Capabilities vinculadas a "users"
user_capabilities
├── user_id → users.id  ← ¿Usuario final o tenant?
├── service_id
└── enabled
```

**Problemas:**
- ❌ No distingue entre tenant y end-user
- ❌ End-users no deberían tener "plan" (lo tiene su tenant)
- ❌ No hay concepto de "organización"
- ❌ Imposible facturar a nivel empresa
- ❌ No hay aislamiento de datos

---

### ✅ Modelo PROPUESTO (Multi-Tenancy)

```sql
-- Tabla de Organizaciones (Tenants)
tenants
├── id: uuid (PRIMARY KEY)
├── name: varchar               -- "Tienda XYZ"
├── slug: varchar (UNIQUE)      -- "tienda-xyz"
├── email: varchar              -- admin@tiendaxyz.com
├── plan: varchar               -- 'starter', 'professional', 'enterprise'
├── subscription_status: varchar -- 'active', 'trial', 'cancelled'
├── billing_email: varchar
├── settings: jsonb             -- Config de la organización
├── created_at: timestamp
└── updated_at: timestamp

-- Tabla de Usuarios de Organización (Admins/Managers)
tenant_users
├── id: uuid (PRIMARY KEY)
├── tenant_id → tenants.id (FK)
├── email: varchar (UNIQUE)
├── name: varchar
├── role: varchar               -- 'owner', 'admin', 'agent'
├── permissions: jsonb          -- Permisos específicos
├── created_at: timestamp
└── updated_at: timestamp

-- Tabla de Clientes Finales (End Users)
end_users
├── id: uuid (PRIMARY KEY)
├── tenant_id → tenants.id (FK) -- ¡Pertenece a un tenant!
├── phone: varchar              -- +52123456789
├── name: varchar               -- "Juan Pérez"
├── email: varchar              -- juan@example.com (opcional)
├── channel: varchar            -- 'whatsapp', 'telegram', etc.
├── metadata: jsonb             -- Info custom del tenant
├── created_at: timestamp
└── updated_at: timestamp

-- Capabilities ahora a nivel TENANT
tenant_capabilities
├── id: uuid (PRIMARY KEY)
├── tenant_id → tenants.id (FK) -- ¡Capacidades por organización!
├── service_id: varchar
├── enabled: boolean
├── config: jsonb
├── expires_at: timestamp
└── ...

-- Usage tracking a nivel TENANT
tenant_usage
├── id: uuid (PRIMARY KEY)
├── tenant_id → tenants.id (FK)
├── service_id: varchar
├── count: integer
├── reset_at: timestamp
└── ...
```

---

## 🔄 Relaciones entre Entidades

```
┌─────────────────────────────────────────────────────────────┐
│                    TENANT (Organización)                     │
│  • Tienda XYZ                                               │
│  • Plan: Professional                                       │
│  • Billing: billing@tiendaxyz.com                           │
└───────────┬─────────────────────────────┬───────────────────┘
            │                             │
            │ tiene                       │ tiene
            ↓                             ↓
┌──────────────────────────┐   ┌──────────────────────────────┐
│   TENANT_USERS           │   │   END_USERS                  │
│   (Empleados/Admins)     │   │   (Clientes finales)         │
│                          │   │                              │
│  • admin@tiendaxyz.com   │   │  • Juan Pérez                │
│    Role: owner           │   │    Phone: +52111111111       │
│                          │   │    Channel: whatsapp         │
│  • agent@tiendaxyz.com   │   │                              │
│    Role: agent           │   │  • María López               │
│                          │   │    Phone: +52222222222       │
└──────────────────────────┘   │    Channel: telegram         │
                               │                              │
                               │  • Pedro García              │
                               │    Phone: +52333333333       │
                               └──────────────────────────────┘
            │
            │ usan capacidades de
            ↓
┌──────────────────────────────────────────┐
│      TENANT_CAPABILITIES                 │
│                                          │
│  tenant_id: tienda-xyz                   │
│                                          │
│  • ai-assistant: enabled ✅              │
│  • analytics: enabled ✅                 │
│  • translation: disabled ❌              │
│  • workflow: enabled ✅                  │
└──────────────────────────────────────────┘
```

---

## 💡 Cómo Funciona en la Práctica

### Escenario 1: Cliente Final Envía Mensaje

```
1. Juan Pérez (end_user) envía WhatsApp
   "Hola, ¿dónde está mi pedido #123?"

2. Sistema identifica:
   • End User: Juan Pérez (end_users.id = xxx)
   • Pertenece a Tenant: Tienda XYZ (tenant_id = yyy)

3. Verificar capabilities del TENANT (no del end-user):
   SELECT * FROM tenant_capabilities
   WHERE tenant_id = 'tienda-xyz' AND service_id = 'ai-assistant'

   ✅ enabled = true (Tienda XYZ tiene AI en su plan)

4. Ejecutar AI Assistant para generar respuesta

5. Enviar respuesta a Juan
```

**Punto clave:** Las capabilities están a nivel **TENANT**, no end-user. Todos los end-users de "Tienda XYZ" comparten las mismas capabilities.

---

### Escenario 2: Tenant Upgrade de Plan

```
1. Tienda XYZ decide upgrade de Starter → Professional

2. Sistema actualiza:
   UPDATE tenants
   SET plan = 'professional'
   WHERE id = 'tienda-xyz'

3. Aplicar template de capabilities:
   INSERT INTO tenant_capabilities (tenant_id, service_id, enabled, config)
   SELECT 'tienda-xyz', service_id, enabled, config
   FROM capability_templates
   WHERE name = 'professional'

4. AUTOMÁTICAMENTE, todos los end-users de Tienda XYZ
   ahora pueden usar AI Assistant, Analytics, etc.
   (porque pertenecen al mismo tenant)
```

---

### Escenario 3: Facturación

```
-- Facturar a nivel TENANT, no end-user
SELECT
  t.name AS tenant_name,
  t.billing_email,
  t.plan,
  COUNT(eu.id) AS total_end_users,
  SUM(tu.count) AS total_messages
FROM tenants t
LEFT JOIN end_users eu ON eu.tenant_id = t.id
LEFT JOIN tenant_usage tu ON tu.tenant_id = t.id
WHERE t.subscription_status = 'active'
GROUP BY t.id

-- Resultado:
┌──────────────┬────────────────────────┬──────────────┬─────────────────┬────────────────┐
│ tenant_name  │ billing_email          │ plan         │ total_end_users │ total_messages │
├──────────────┼────────────────────────┼──────────────┼─────────────────┼────────────────┤
│ Tienda XYZ   │ billing@tiendaxyz.com  │ professional │ 1250            │ 45,230         │
│ Clínica ABC  │ admin@clinicaabc.com   │ enterprise   │ 340             │ 12,890         │
│ Empresa 123  │ finance@empresa123.com │ starter      │ 89              │ 2,340          │
└──────────────┴────────────────────────┴──────────────┴─────────────────┴────────────────┘
```

---

## 🔐 Aislamiento de Datos (Data Isolation)

Cada tenant tiene sus datos completamente aislados:

```sql
-- Conversaciones: Filtrar por tenant
SELECT * FROM conversations c
JOIN end_users eu ON eu.id = c.end_user_id
WHERE eu.tenant_id = 'tienda-xyz'  -- Solo ver conversaciones de Tienda XYZ

-- Mensajes: Filtrar por tenant
SELECT m.* FROM messages m
JOIN conversations c ON c.id = m.conversation_id
JOIN end_users eu ON eu.id = c.end_user_id
WHERE eu.tenant_id = 'tienda-xyz'  -- Solo mensajes de Tienda XYZ

-- Métricas: Por tenant
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS messages_count
FROM messages m
JOIN conversations c ON c.id = m.conversation_id
JOIN end_users eu ON eu.id = c.end_user_id
WHERE eu.tenant_id = 'tienda-xyz'
GROUP BY DATE(created_at)
```

---

## 📋 Comparación Detallada

| Aspecto | Modelo Actual | Multi-Tenancy Propuesto |
|---------|--------------|-------------------------|
| **Estructura** | 1 tabla `users` | 3 tablas: `tenants`, `tenant_users`, `end_users` |
| **Capabilities** | Por usuario individual | Por tenant (organización) |
| **Facturación** | ❌ Por usuario (confuso) | ✅ Por tenant |
| **Planes** | ❌ Cada user tiene plan | ✅ Tenant tiene plan, users heredan |
| **Aislamiento** | ❌ No hay | ✅ Filtro por `tenant_id` |
| **Escalabilidad** | ❌ Difícil gestionar | ✅ Fácil agregar empresas |
| **Admin UI** | ❌ No claro quién administra | ✅ `tenant_users` con roles |
| **Métricas** | ❌ Por usuario | ✅ Por tenant (agregadas) |

---

## 🛠️ Casos de Uso

### Caso 1: SaaS Multi-Tenant Típico

**Clientes:**
- Tienda Online A (500 clientes finales)
- Tienda Online B (1,200 clientes finales)
- Clínica Médica C (300 pacientes)

**Características:**
- Cada tenant paga por su plan
- Capabilities a nivel tenant
- End-users heredan capabilities de su tenant
- Datos completamente aislados
- Facturación por tenant

### Caso 2: White-Label

**Cliente:** Agencia de Marketing que revende tu servicio

```
Tenant: Agencia Marketing XYZ (Plan: Enterprise)
├── Sub-tenant 1: Cliente A de la agencia
│   └── End-users: Clientes finales de A
├── Sub-tenant 2: Cliente B de la agencia
│   └── End-users: Clientes finales de B
└── Sub-tenant 3: Cliente C de la agencia
    └── End-users: Clientes finales de C
```

(Requeriría añadir `parent_tenant_id` para jerarquía)

### Caso 3: Freemium → Upgrade

**Flujo:**
1. Startup nueva se registra → Tenant con plan "starter"
2. Usa el servicio con 10 end-users
3. Crece y hace upgrade → Plan "professional"
4. AUTOMÁTICAMENTE todos sus end-users obtienen nuevas capabilities
5. Facturación se actualiza automáticamente

---

## 🚀 Migración del Modelo Actual

### Estrategia de Migración

```sql
-- 1. Crear nuevas tablas
CREATE TABLE tenants (...);
CREATE TABLE tenant_users (...);
CREATE TABLE end_users (...);
CREATE TABLE tenant_capabilities (...);

-- 2. Migrar usuarios existentes
-- Por defecto, cada "user" actual se convierte en un tenant individual
INSERT INTO tenants (id, name, email, plan, created_at)
SELECT
  id AS id,
  COALESCE(name, email) AS name,
  email,
  plan,  -- Migrar plan de user a tenant
  created_at
FROM users;

-- 3. Crear tenant_user para cada tenant (owner)
INSERT INTO tenant_users (tenant_id, email, name, role)
SELECT
  u.id AS tenant_id,
  u.email,
  u.name,
  'owner' AS role
FROM users u;

-- 4. Migrar capabilities
-- user_capabilities → tenant_capabilities
INSERT INTO tenant_capabilities (tenant_id, service_id, enabled, config, expires_at)
SELECT
  user_id AS tenant_id,  -- user_id se vuelve tenant_id
  service_id,
  enabled,
  config,
  expires_at
FROM user_capabilities;

-- 5. Los end_users se crearán dinámicamente
-- cuando lleguen mensajes de WhatsApp/Telegram
-- (auto-crear end_user al recibir primer mensaje)
```

---

## 📊 Esquema Visual Completo

```
┌──────────────────────────────────────────────────────────────────────┐
│                         LAYER 1: TENANTS                              │
│  (Organizaciones que compran el servicio)                            │
│                                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ Tienda XYZ      │  │ Clínica ABC     │  │ Empresa 123     │     │
│  │ Plan: Pro       │  │ Plan: Enterprise│  │ Plan: Starter   │     │
│  │ Status: Active  │  │ Status: Active  │  │ Status: Trial   │     │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘     │
│           │                    │                     │              │
└───────────┼────────────────────┼─────────────────────┼──────────────┘
            │                    │                     │
            ↓                    ↓                     ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    LAYER 2: TENANT CAPABILITIES                       │
│  (Qué puede hacer cada organización)                                 │
│                                                                       │
│  Tienda XYZ:           Clínica ABC:           Empresa 123:           │
│  • AI ✅               • AI ✅                • AI ❌                 │
│  • Analytics ✅        • Analytics ✅         • Analytics ❌          │
│  • Translation ❌      • Translation ✅       • Translation ❌        │
│  • Workflow ✅         • Workflow ✅          • Workflow ❌           │
└──────────────────────────────────────────────────────────────────────┘
            │                    │                     │
            ↓                    ↓                     ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    LAYER 3: TENANT USERS                              │
│  (Empleados/Admins que configuran el servicio)                       │
│                                                                       │
│  Tienda XYZ:           Clínica ABC:           Empresa 123:           │
│  • admin@xyz.com       • admin@abc.com        • owner@123.com        │
│    Role: Owner         Role: Owner            Role: Owner            │
│  • agent1@xyz.com      • doctor@abc.com       • agent@123.com        │
│    Role: Agent         Role: Admin            Role: Agent            │
└──────────────────────────────────────────────────────────────────────┘
            │                    │                     │
            ↓                    ↓                     ↓
┌──────────────────────────────────────────────────────────────────────┐
│                    LAYER 4: END USERS                                 │
│  (Clientes finales que chatean)                                      │
│                                                                       │
│  Tienda XYZ:           Clínica ABC:           Empresa 123:           │
│  • Juan (+521111...)   • María (+521222...)   • Pedro (+523333...)   │
│    WA: Pedido #123     WA: Cita médica        TG: Soporte            │
│  • Ana (+521112...)    • Luis (+521223...)    • Laura (+523334...)   │
│    WA: Devolución      TG: Resultados         WA: Consulta           │
│  • 1,248 más...        • 338 más...           • 87 más...            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## ✅ Beneficios del Multi-Tenancy

1. **Facturación Clara**
   - Facturas por tenant (organización)
   - Métricas agregadas por empresa
   - Fácil escalar pricing

2. **Aislamiento de Datos**
   - Datos de Tienda XYZ NO visibles para Clínica ABC
   - Seguridad y compliance
   - Filtrado automático por `tenant_id`

3. **Gestión Simplificada**
   - Upgrade de plan → Afecta a todos los end-users del tenant
   - Configuración centralizada
   - Admin UI por tenant

4. **Escalabilidad**
   - Agregar nuevos tenants es trivial
   - Horizontal scaling por tenant
   - Sharding por `tenant_id` en el futuro

5. **Features Empresariales**
   - Roles y permisos (owner, admin, agent)
   - SSO por tenant
   - Customización por empresa (branding, config)
   - White-label support

6. **Monetización**
   - Planes por tenant, no por usuario
   - Add-ons por tenant
   - Usage-based billing agregado

---

## 🔮 Evolución Futura

### Fase 1: Basic Multi-Tenancy (Actual propuesta)
- Tablas: `tenants`, `tenant_users`, `end_users`
- Capabilities a nivel tenant
- Aislamiento básico

### Fase 2: Tenant Hierarchy
```sql
tenants
├── parent_tenant_id → tenants.id  -- Para white-label
├── hierarchy_level: integer
└── ...
```

### Fase 3: Tenant Customization
```sql
tenant_settings
├── tenant_id
├── branding: jsonb  -- Logo, colores, etc.
├── domain: varchar  -- custom.tudominio.com
├── sso_config: jsonb
└── ...
```

### Fase 4: Cross-Tenant Features
- Marketplace de extensiones entre tenants
- Shared resources (opcional)
- Federation/partnerships

---

## 📝 Recomendación

**Implementar multi-tenancy AHORA** antes de escalar, porque:

✅ **Es más fácil ahora** - Pocas migraciones de datos
✅ **Escalabilidad futura** - Soportar miles de empresas
✅ **Monetización clara** - Facturar por organización
✅ **Compliance** - Aislamiento de datos obligatorio
✅ **Product-market fit** - Model correcto para SaaS B2B

❌ **Postergar es costoso** - Refactorizar con millones de users es difícil
