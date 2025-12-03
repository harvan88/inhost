# FluxCoreChat Backend - Arquitectura y Roadmap

**Última actualización:** 2025-12-03  
**Estado:** ✅ ESTABLE - Persistencia funcionando

---

## Estado Actual

### ✅ Funcionando

| Componente | Estado | Descripción |
|------------|--------|-------------|
| PostgreSQL | ✅ | Persistencia real de mensajes |
| Adapters | ✅ | WhatsApp, Telegram, SMS simulados |
| MessageCore | ✅ | Orquestador con resultado real |
| ExtensionHost | ✅ | 3 extensiones registradas |
| WebSocket | ✅ | Notificaciones en tiempo real |

### Arquitectura de Flujo

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ENTRADA                                      │
├─────────────────────────────────────────────────────────────────────┤
│  POST /simulate/client-message                                       │
│    body: { clientId: "whatsapp:user-001", text: "Hola" }            │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ADAPTER (SimulatedWhatsAppAdapter)                                  │
│  ─────────────────────────────────────                              │
│  • Traduce mensaje de plataforma → MessageEnvelope                  │
│  • Genera conversationId consistente por usuario                    │
│  • Prepara metadata: from, to, timestamp                            │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  MESSAGE CORE (Orquestador)                                          │
│  ─────────────────────────────                                       │
│  1. Persistir en PostgreSQL ───────────────────────────────────────┐│
│     • Crea tenant, endUser, conversation si no existen             ││
│     • Inserta mensaje con FK a conversation                        ││
│     • Retorna { persisted: true/false, error? }                    ││
│                                                                     ││
│  2. Broadcast vía WebSocket ───────────────────────────────────────┤│
│     • Evento: message:new                                          ││
│     • Frontend recibe y guarda en IndexedDB                        ││
│                                                                     ││
│  3. Procesar Extensiones ──────────────────────────────────────────┤│
│     • ExtensionHost ejecuta en paralelo:                           ││
│       - FluxCoreExtension → enrichment: ai_response                ││
│       - SentimentExtension → enrichment: sentiment                 ││
│       - KeywordExtension → enrichment: keywords                    ││
│     • Enrichments se persisten en message_enrichments              ││
│     • Broadcast: enrichment:batch                                  ││
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  RESPUESTA                                                           │
├─────────────────────────────────────────────────────────────────────┤
│  {                                                                   │
│    "success": true,                                                  │
│    "data": {                                                         │
│      "message": { id, type, channel, text, conversationId },        │
│      "persistence": { success: true/false, error?, storage }        │
│    }                                                                 │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Estructura de Directorios

```
apps/api-gateway/src/
├── index.ts                 # Punto de entrada Elysia
├── core/
│   ├── MessageCore.ts       # Orquestador principal
│   └── interfaces/          # Contratos (IPersistenceService, etc.)
├── adapters/
│   ├── manager/             # AdapterManager
│   └── simulators/          # WhatsApp, Telegram, SMS
├── extensions/
│   ├── host/ExtensionHost.ts
│   └── builtin/             # FluxCore, Sentiment, Keywords
├── implementations/
│   ├── v1/                  # Memoria (dev)
│   └── v2/                  # PostgreSQL/Redis (prod)
├── routes/
│   ├── simulation.ts        # /simulate/*
│   ├── websocket.ts         # /realtime
│   └── admin/               # /admin/*
├── services/index.ts        # Singletons
└── simulators/
    └── clients.ts           # Clientes simulados
```

---

## Base de Datos (PostgreSQL)

### Tablas Core

| Tabla | Propósito |
|-------|-----------|
| `tenants` | Multi-tenancy |
| `admin_users` | Usuarios del dashboard |
| `end_users` | Clientes externos (WhatsApp, etc.) |
| `conversations` | Hilos de conversación |
| `messages` | Mensajes (FK → conversations) |
| `message_enrichments` | Metadatos de extensiones |

### Diagrama ER Simplificado

```
tenants
  └── end_users (tenant_id FK)
        └── conversations (end_user_id FK)
              └── messages (conversation_id FK)
                    └── message_enrichments (message_id FK)
```

---

## Extensiones

### Extensiones Builtin (Activas)

| ID | Nombre | Produce | Timeout |
|----|--------|---------|---------|
| `builtin:fluxcore` | FluxCore AI | `ai_response` | 10s |
| `builtin:sentiment` | Sentiment Analysis | `sentiment` | 5s |
| `builtin:keywords` | Keyword Extraction | `keywords` | 5s |

### Flujo de Extensiones

```
MessageCore.receive(envelope)
    │
    ├── persistence.save(envelope)
    │
    └── extensionHost.processMessage(context)
            │
            ├── FluxCoreExtension.process(ctx) → { ok, enrichment }
            ├── SentimentExtension.process(ctx) → { ok, enrichment }
            └── KeywordExtension.process(ctx) → { ok, enrichment }
            │
            └── Agregar resultados → ProcessingResult
                    │
                    ├── persistence.saveEnrichments(enrichments)
                    └── notifications.broadcastEnrichments(batch)
```

---

## Comandos Útiles

```bash
# Iniciar PostgreSQL
docker-compose up -d postgres

# Push schema a BD
bun run db:push

# Iniciar backend
bun run dev:api

# Probar simulador
curl -X POST http://localhost:3000/simulate/client-message \
  -H "Content-Type: application/json" \
  -d '{"clientId":"whatsapp:test-001","text":"Hola"}'

# Ver estado del sistema
curl http://localhost:3000/simulate/status
```

---

## Roadmap

### Fase 1: Fundamentos ✅ COMPLETADA
- [x] Persistencia real en PostgreSQL
- [x] Errores transparentes (no hardcodeados)
- [x] Adapters simulados funcionales
- [x] ExtensionHost con extensiones builtin
- [x] WebSocket notifications

### Fase 2: Integración Frontend (EN PROGRESO)
- [x] Corregido: Frontend usa conversationId del backend (no regenera)
- [x] WebSocket recibe eventos message:new correctamente
- [x] IndexedDB sincroniza con mismo conversationId que PostgreSQL
- [ ] Verificar UI muestra mensajes correctamente
- [ ] Enrichments visibles en UI

### Fase 3: Respuestas Automáticas
- [ ] FluxCoreExtension con OpenAI real
- [ ] Modo auto: enviar respuesta automática
- [ ] Modo pre-approval: draft para aprobar
- [ ] Persistir respuestas como mensajes outgoing

### Fase 4: Adapters Reales
- [ ] WhatsApp Cloud API
- [ ] Telegram Bot API
- [ ] Webhooks de entrada
- [ ] Envío real de mensajes

### Fase 5: Multi-tenancy Completo
- [ ] Aislamiento por tenant
- [ ] Configuración de extensiones por tenant
- [ ] Límites de plan
- [ ] Dashboard admin

---

## Métricas de Progreso

| Fase | Progreso | Próximo Hito |
|------|----------|--------------|
| Fase 1 | 100% | ✅ Completada |
| Fase 2 | 75% | Verificar UI |
| Fase 3 | 0% | OpenAI Integration |
| Fase 4 | 0% | WhatsApp Webhook |
| Fase 5 | 0% | Tenant Config |

---

## Notas Técnicas

### Persistencia

- **Backend**: PostgreSQL via Drizzle ORM
- **Frontend**: IndexedDB (reflejo/cache)
- **Extensiones**: Consumen datos core, persistencia propia si necesitan

### Errores

El sistema ahora reporta errores reales:
```json
{
  "persistence": {
    "success": false,
    "error": "DatabasePersistence.save failed: ..."
  }
}
```

### UUIDs

Los UUIDs consistentes se generan con hash para que:
- El mismo usuario siempre tenga el mismo `endUserId`
- La misma conversación tenga el mismo `conversationId`
- Formato válido: `xxxxxxxx-xxxx-4xxx-axxx-xxxxxxxxxxxx`
