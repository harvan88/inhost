# Contexto del Proyecto Inhost

**Última actualización:** 2025-11-14
**Estado:** Fase 1 - MVP en desarrollo
**Stack Principal:** Bun + Elysia.js + TypeScript + PostgreSQL + Redis

---

## 🎯 Visión del Proyecto

Inhost es una plataforma de gestión de mensajería multi-canal (WhatsApp, Telegram, Web, SMS) con:

- **Tier Gratuito:** Almacenamiento local (IndexedDB) + sincronización temporal (Redis 24h)
- **Tier Premium:** Persistencia completa en cloud + Virtual Instance 24/7
- **Arquitectura:** Web-first PWA sin aplicaciones nativas
- **Extensibilidad:** Sistema de extensiones desacoplado para IA, CRM, etc.

## 📋 Plan Arquitectónico

Ver documento completo en: `Docs/planarquitectonico.md`

### Componentes Core (Obligatorios - Fase 1)

1. **Inhost Web Client** - PWA con Web Components
2. **API Gateway** - Punto único de entrada HTTP ✅ IMPLEMENTADO
3. **WebSocket Hub** - Comunicación real-time ✅ BÁSICO IMPLEMENTADO
4. **Sync & State Engine** - Sincronización multi-dispositivo (Pendiente)
5. **Unified Storage Engine** - Gestión de persistencia (Parcial)
6. **Adapter Manager** - Conectores a plataformas externas (Pendiente)
7. **Extension Runtime** - Ejecución de extensiones (Pendiente)

### Componentes Premium (Fase 2-3)

- Virtual Chat Instance
- Advanced Analytics
- Multi-tenant Engine
- Backup & Recovery

## 🏗️ Estado Actual de Implementación

### ✅ Completado (Noviembre 2025)

**API Gateway Reestructurado:**

```
apps/api-gateway/src/
├── index.ts                 → Punto de entrada con middleware global
├── config/
│   └── index.ts            → Configuración centralizada y validada
├── middleware/
│   ├── errorHandler.ts     → Manejo de errores estandarizado
│   └── logger.ts           → Logger estructurado con niveles
├── routes/
│   ├── index.ts            → Índice centralizado de rutas
│   ├── messages.ts         → POST /messages, GET /messages
│   ├── health.ts           → GET /, GET /health
│   └── websocket.ts        → WS /realtime
├── services/
│   └── messageService.ts   → Lógica de negocio de mensajes
└── types/
    └── api.ts              → DTOs y contratos estandarizados
```

**Características Implementadas:**

1. ✅ Arquitectura modular con separación de responsabilidades
2. ✅ Respuestas estandarizadas (`ApiSuccessResponse` / `ApiErrorResponse`)
3. ✅ Logging estructurado con contexto y niveles
4. ✅ Manejo centralizado de errores con códigos estándar
5. ✅ Configuración centralizada con validación
6. ✅ Tipos TypeScript completos para todo el sistema
7. ✅ WebSocket básico funcional
8. ✅ Integración con PostgreSQL (Drizzle ORM)
9. ✅ Sistema de rutas modular y escalable

### 🚧 En Desarrollo / Pendiente

**Fase 1 - MVP (4 semanas estimadas):**

- [ ] Sistema de autenticación JWT
- [ ] Adapter Manager para WhatsApp
- [ ] Extension Runtime (1 extensión simple)
- [ ] Sync Engine (sincronización básica)
- [ ] Redis integrado para cache y sesiones
- [ ] Rate limiting
- [ ] CORS configurado

**Fase 2 - Estabilización (3 semanas):**

- [ ] Service Worker + Offline support
- [ ] Circuit breakers para extensiones
- [ ] Monitoring básico
- [ ] Cleanup engine automático
- [ ] Tests unitarios e integración

**Fase 3 - Premium (3 semanas):**

- [ ] Virtual Chat Instance
- [ ] Persistencia PostgreSQL completa
- [ ] UI web administrativa
- [ ] Sistema de roles básico

## 🎨 Principios de Diseño Implementados

### 1. Separación de Responsabilidades

- **Rutas:** Solo HTTP, validación y serialización
- **Servicios:** Toda la lógica de negocio
- **Middleware:** Funcionalidades transversales
- **Tipos:** Contratos compartidos

### 2. Formato de Respuestas Estándar

```typescript
// Éxito
{
  success: true,
  data: T,
  metadata: { timestamp, requestId? }
}

// Error
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: unknown,
    timestamp: string
  }
}
```

### 3. Estados de Mensaje Completos

Según plan arquitectónico:
- `received` → `processing` → `sending` → `sent` → `delivered` → `read`
- Estados conversacionales: `typing`, `waiting_response`, etc.

### 4. Logging Estructurado

- Niveles: DEBUG, INFO, WARN, ERROR
- Contexto: requestId, userId, operación
- Formato JSON para parsing

## 📊 Modelo de Datos

### Tablas PostgreSQL (en @inhost/shared)

**Tabla `messages`:**
- id (string, PK)
- conversationId (string, FK nullable)
- type (MessageType enum)
- channel (MessageChannel enum)
- content (JSONB)
- metadata (JSONB)
- statusChain (JSONB array)
- context (JSONB)
- createdAt, updatedAt

**Tabla `conversations`:**
- id (uuid, PK)
- ownerId, participantId
- channel, status
- metadata (JSONB)
- createdAt, updatedAt

## 🔧 Comandos Esenciales

```bash
# Desarrollo
bun run dev                    # API Gateway con hot reload
bun run dev:db                 # Levantar PostgreSQL + Redis (Docker)
bun run migrate                # Ejecutar migraciones

# Build
bun run build:api              # Build del API Gateway

# Utilidades
bun run type-check             # Verificar tipos
```

## 📚 Documentos Importantes

1. **Plan Arquitectónico Completo:** `Docs/planarquitectonico.md`
2. **README API Gateway:** `apps/api-gateway/README.md`
3. **Contexto del Proyecto:** `CONTEXT.md` (este documento)
4. **Stack Tecnológico:** `Docs/stack tecnológico.md`
5. **Diagrama Completo:** `Docs/diagrama completom.md`

## 🤝 Cómo Trabajar con Claude en Futuras Sesiones

### Al Iniciar una Nueva Sesión

**Comparte este documento (`CONTEXT.md`) y di:**

> "Estoy trabajando en Inhost. Lee CONTEXT.md para entender el estado actual.
> Hoy quiero trabajar en: [tu objetivo específico]"

### Información a Proporcionar

1. **Contexto mínimo:**
   - Qué parte del sistema vas a trabajar
   - Si necesitas revisar algún documento específico

2. **Archivos relevantes:**
   - Claude puede leer cualquier archivo del proyecto
   - Menciona rutas específicas si necesitas que revise código

### Ejemplo de Prompt Ideal

```
Hola, estoy trabajando en Inhost.

1. Lee CONTEXT.md para entender dónde estamos
2. Hoy quiero implementar [X funcionalidad]
3. Revisa estos archivos si es necesario: [lista de rutas]

¿Estás listo para empezar?
```

## 🎯 Próximos Hitos Recomendados

### Semana 1-2: Autenticación y Seguridad
- Implementar JWT authentication
- Middleware de autenticación
- Sistema de usuarios básico
- Rate limiting

### Semana 3-4: Adapter Manager
- Estructura de adapters
- WhatsApp Business API integration
- Sistema de webhooks
- Queue para mensajes salientes

### Semana 5-6: Extension Runtime
- Contrato HTTP para extensiones
- Primera extensión de ejemplo (Echo bot)
- Sistema de registro de extensiones
- Circuit breakers

## 🏆 Fortalezas de la Implementación Actual

1. **Arquitectura Sólida:** Modular, escalable, mantenible
2. **Type Safety:** 100% TypeScript con tipos estrictos
3. **Estándares:** Respuestas y errores consistentes
4. **Observabilidad:** Logging completo de operaciones
5. **Documentación:** Código autodocumentado + READMEs
6. **Alineación:** Sigue fielmente el plan arquitectónico
7. **Preparado para Testing:** Servicios desacoplados

## ⚠️ Consideraciones Técnicas

### Database
- PostgreSQL debe estar corriendo en `localhost:5432`
- Redis debe estar en `localhost:6379`
- Usar `bun run dev:db` para levantar con Docker

### Desarrollo
- Bun 1.2+ requerido
- TypeScript 5.0+
- Hot reload automático en desarrollo

### Producción (futuro)
- Variables de entorno obligatorias
- JWT_SECRET debe ser seguro
- Logging a servicio externo (DataDog, LogDNA)

---

## 📝 Notas de la Última Sesión

**Fecha:** 2025-11-14

**Trabajo Realizado:**
- Reestructuración completa del API Gateway
- Implementación de arquitectura en capas
- Creación de servicios, middleware y tipos
- Documentación completa del proyecto

**Próximo Paso Sugerido:**
Implementar autenticación JWT para preparar el sistema para usuarios reales.

**Decisiones Importantes:**
- Usar Elysia.js como framework (ligero y rápido)
- Bun como runtime (performance superior)
- Drizzle ORM para type-safe database access
- Logger estructurado custom (no Winston/Pino por simplicidad)

---

**Última actualización por:** Claude (Sesión Nov 2025)
**Para continuar:** Leer este documento + `Docs/planarquitectonico.md`
