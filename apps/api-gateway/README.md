# Inhost API Gateway

API Gateway modular y escalable construido con Elysia.js, Bun y TypeScript siguiendo las mejores prácticas de arquitectura de software.

## Arquitectura

Este proyecto implementa una arquitectura en capas con separación clara de responsabilidades:

```
src/
├── index.ts                 # Punto de entrada principal
├── config/                  # Configuración centralizada
│   └── index.ts            # Variables de entorno y config
├── middleware/              # Middleware global
│   ├── errorHandler.ts     # Manejo centralizado de errores
│   └── logger.ts           # Logger estructurado
├── routes/                  # Definición de rutas HTTP
│   ├── index.ts            # Índice de rutas
│   ├── messages.ts         # Rutas de mensajes
│   ├── health.ts           # Rutas de health check
│   └── websocket.ts        # Rutas WebSocket
├── services/                # Lógica de negocio
│   └── messageService.ts   # Servicio de mensajes
└── types/                   # Tipos y contratos
    └── api.ts              # DTOs y tipos de API
```

## Principios Arquitectónicos

### 1. Separación de Responsabilidades

- **Rutas**: Solo manejan HTTP, validación de entrada y respuestas
- **Servicios**: Contienen toda la lógica de negocio
- **Middleware**: Funcionalidades transversales (logging, errores, auth)
- **Tipos**: Contratos y DTOs compartidos

### 2. Respuestas Estandarizadas

Todas las respuestas siguen el formato del plan arquitectónico:

**Respuesta Exitosa:**
```typescript
{
  success: true,
  data: T,
  metadata: {
    timestamp: string,
    requestId?: string
  }
}
```

**Respuesta de Error:**
```typescript
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

### 3. Logging Estructurado

Todos los logs incluyen:
- Nivel (DEBUG, INFO, WARN, ERROR)
- Timestamp ISO 8601
- Contexto relevante (requestId, userId, etc.)
- Formato JSON para fácil parsing

### 4. Manejo de Errores

- Errores centralizados con códigos estándar
- Circuit breakers para servicios externos (futuro)
- Logs automáticos de errores
- Formato consistente en producción/desarrollo

## Rutas Disponibles

### Health Check

- `GET /` - Información del API
- `GET /health` - Health check con verificación de DB

### Mensajes

- `POST /messages` - Crear un nuevo mensaje
- `GET /messages` - Listar mensajes (con paginación)

### WebSocket

- `WS /realtime` - Conexión WebSocket para tiempo real

## Configuración

Las variables de entorno se gestionan en [config/index.ts](src/config/index.ts):

```env
# Aplicación
PORT=3000
NODE_ENV=development

# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_USER=inhost_user
DB_PASSWORD=inhost_password
DB_NAME=inhost

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Autenticación (futuro)
JWT_SECRET=your-secret-key
JWT_EXPIRATION=24h
```

## Comandos Disponibles

```bash
# Desarrollo con hot reload
bun run dev

# Build para producción
bun run build

# Type checking
bun run type-check
```

## Estructura de Servicios

### MessageService

Responsable de toda la lógica relacionada con mensajes:

- `createMessage()` - Crea mensajes con validaciones de negocio
- `listMessages()` - Lista mensajes con filtros opcionales
- `updateMessageStatus()` - Actualiza estados del ciclo de vida
- `checkHealth()` - Verifica conectividad con BD

## Middleware

### Error Handler

- Intercepta todos los errores
- Formatea según estándar `StandardErrorResponse`
- Logs automáticos de errores
- Oculta detalles sensibles en producción

### HTTP Logger

- Log de todas las peticiones HTTP
- Incluye tiempos de respuesta
- Request ID único por petición
- Contexto estructurado

## Tipos y Contratos

Todos los DTOs están definidos en [types/api.ts](src/types/api.ts):

- `MessageDTO.*` - Contratos de mensajes
- `HealthDTO.*` - Contratos de health
- `WebSocketDTO.*` - Mensajes WebSocket
- `ApiResponse<T>` - Tipo genérico de respuesta

## Próximos Pasos

### Fase 1 - MVP (En desarrollo)

- [x] Estructura modular de rutas
- [x] Servicios de negocio
- [x] Middleware de errores y logging
- [x] Tipos y contratos estandarizados
- [ ] Autenticación JWT
- [ ] Rate limiting
- [ ] Integración con Redis
- [ ] Adapter Manager para WhatsApp

### Fase 2 - Estabilización

- [ ] Service Worker + Offline support
- [ ] Circuit breakers
- [ ] Monitoring y métricas
- [ ] Tests unitarios y de integración
- [ ] Documentación OpenAPI/Swagger

### Fase 3 - Premium Features

- [ ] Virtual Chat Instance
- [ ] Multi-tenant support
- [ ] Advanced analytics
- [ ] Backup automatizado

## Stack Tecnológico

| Tecnología | Versión | Propósito |
|-----------|---------|-----------|
| **Bun** | 1.2+ | Runtime y package manager |
| **Elysia.js** | 1.2+ | Framework web |
| **TypeScript** | 5.0+ | Type safety |
| **Drizzle ORM** | 0.44+ | ORM para PostgreSQL |
| **PostgreSQL** | 15 | Base de datos principal |
| **Redis** | 7 | Cache y sesiones |

## Mejores Prácticas Implementadas

1. **Type Safety**: 100% TypeScript con tipos estrictos
2. **Error Handling**: Errores tipados y centralizados
3. **Logging**: Logs estructurados con contexto
4. **Configuración**: Centralizada y validada
5. **Modularidad**: Cada componente tiene una responsabilidad única
6. **Escalabilidad**: Fácil agregar nuevas rutas/servicios
7. **Documentación**: Código autodocumentado con JSDoc
8. **Estándares**: Respuestas consistentes en toda la API

## Contribuir

Este proyecto sigue el plan arquitectónico definido en `/Docs/planarquitectonico.md`.

Al contribuir, asegúrate de:

1. Seguir la estructura de carpetas establecida
2. Usar los tipos definidos en `types/api.ts`
3. Implementar logging en todas las operaciones importantes
4. Manejar errores usando `createError.*` helpers
5. Documentar funciones con JSDoc
6. Mantener la separación de responsabilidades

## Licencia

Privado - Inhost © 2025
