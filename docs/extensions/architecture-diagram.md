# 🏗️ Arquitectura: ServiceGate + Extensions

## Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React/Vue)                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│  │  Messages  │  │ Extensions │  │  Settings  │  │  Billing   │       │
│  │    UI      │  │ Marketplace│  │    UI      │  │    UI      │       │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘       │
└───────────────────┬──────────────────────┬──────────────────────────────┘
                    │ REST API             │ REST API
                    ↓                      ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY (Elysia.js)                          │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                         Routes Layer                             │  │
│  │  POST /messages       GET /me/capabilities                       │  │
│  │  GET /messages        GET /extensions/marketplace                │  │
│  │  WS /realtime         POST /extensions/:id/enable                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                ↓                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      MessageCore (Orchestrator)                  │  │
│  │                                                                  │  │
│  │  receiveMessage() → persistir → notificar → procesar            │  │
│  │  sendMessage()    → adapters → actualizar status                │  │
│  └────────────┬─────────────────────────────────┬───────────────────┘  │
│               │                                  │                      │
│               ↓                                  ↓                      │
│  ┌─────────────────────────┐       ┌────────────────────────────────┐ │
│  │     ServiceGate (V2)    │       │   ExtensionRegistry (V1)       │ │
│  │  (IServiceGate)         │       │   (IExtensionRegistry)         │ │
│  │                         │       │                                │ │
│  │ • canUseService()       │◄──────┤ • register()                   │ │
│  │ • getUserCapabilities() │       │ • execute()                    │ │
│  │ • recordServiceUsage()  │       │ • executeAll()                 │ │
│  │ • setServiceEnabled()   │       │ • list()                       │ │
│  │ • updateServiceConfig() │       │ • healthCheck()                │ │
│  └────────────┬────────────┘       └───────────┬────────────────────┘ │
│               │                                 │                      │
└───────────────┼─────────────────────────────────┼──────────────────────┘
                │                                 │
                ↓                                 ↓
┌─────────────────────────────┐    ┌──────────────────────────────────┐
│    PostgreSQL Database      │    │   Registered Extensions         │
│                             │    │                                  │
│ • user_capabilities         │    │ ┌──────────────────────────┐    │
│   - user_id                 │    │ │  AIAssistantExtension    │    │
│   - service_id              │    │ │  implements IExtension   │    │
│   - enabled: boolean        │    │ └──────────────────────────┘    │
│   - config: jsonb           │    │ ┌──────────────────────────┐    │
│   - expires_at              │    │ │  AnalyticsExtension      │    │
│                             │    │ │  implements IExtension   │    │
│ • service_usage             │    │ └──────────────────────────┘    │
│   - user_id                 │    │ ┌──────────────────────────┐    │
│   - service_id              │    │ │  TranslationExtension    │    │
│   - count                   │    │ │  implements IExtension   │    │
│   - reset_at                │    │ └──────────────────────────┘    │
│                             │    │ ┌──────────────────────────┐    │
│ • capability_templates      │    │ │  WorkflowExtension       │    │
│   - name (starter, pro...)  │    │ │  implements IExtension   │    │
│   - config: jsonb           │    │ └──────────────────────────┘    │
└─────────────────────────────┘    └──────────────────────────────────┘
```

## Flujo de Ejecución: Usuario Envía Mensaje

```
┌──────┐
│ User │ "Hola, necesito ayuda con mi pedido"
└──┬───┘
   │
   │ POST /messages
   │ Headers: { X-User-Id: "user-123" }
   │
   ↓
┌──────────────────────────────────────────────────────────────────┐
│ 1. API Gateway - Route Handler                                   │
│    POST /messages                                                │
└──┬───────────────────────────────────────────────────────────────┘
   │
   ↓
┌──────────────────────────────────────────────────────────────────┐
│ 2. MessageCore.receiveMessage()                                   │
│    • Genera messageId                                            │
│    • Persiste en base de datos                                   │
│    • Prepara contexto para extensions                            │
└──┬───────────────────────────────────────────────────────────────┘
   │
   ↓
┌──────────────────────────────────────────────────────────────────┐
│ 3. ServiceGate - Verificar Acceso                                │
│                                                                   │
│    const canUseAI = await serviceGate.canUseService(             │
│      'user-123',                                                 │
│      'ai-assistant'                                              │
│    );                                                            │
│                                                                   │
│    ↓ PostgreSQL Query:                                           │
│    SELECT enabled, config, expires_at                            │
│    FROM user_capabilities                                        │
│    WHERE user_id = 'user-123'                                    │
│      AND service_id = 'ai-assistant'                             │
│                                                                   │
│    ✅ Result: { allowed: true, config: {...} }                   │
└──┬───────────────────────────────────────────────────────────────┘
   │
   ↓
┌──────────────────────────────────────────────────────────────────┐
│ 4. ServiceGate - Verificar Quota                                 │
│                                                                   │
│    const usage = await serviceGate.recordServiceUsage(           │
│      'user-123',                                                 │
│      'ai-assistant',                                             │
│      1  // increment                                             │
│    );                                                            │
│                                                                   │
│    ↓ PostgreSQL Query:                                           │
│    INSERT INTO service_usage (user_id, service_id, count)        │
│    VALUES ('user-123', 'ai-assistant', 1)                        │
│    ON CONFLICT (user_id, service_id)                             │
│    DO UPDATE SET                                                 │
│      count = service_usage.count + 1,                            │
│      last_used_at = NOW()                                        │
│                                                                   │
│    ✅ Result: { allowed: true, remaining: 973 }                  │
└──┬───────────────────────────────────────────────────────────────┘
   │
   ↓
┌──────────────────────────────────────────────────────────────────┐
│ 5. ExtensionRegistry - Ejecutar AI Extension                     │
│                                                                   │
│    const result = await extensionRegistry.execute(               │
│      'ai-assistant',                                             │
│      context,                                                    │
│      message                                                     │
│    );                                                            │
│                                                                   │
│    ↓ AIAssistantExtension:                                       │
│    • canExecute() ✅                                             │
│    • execute():                                                  │
│      - Analizar sentimiento del mensaje                          │
│      - Detectar intención: "customer_support"                    │
│      - Generar respuesta sugerida                                │
│      - Retornar mensaje enriquecido                              │
│                                                                   │
│    ✅ Result: { success: true, data: enrichedMessage }           │
└──┬───────────────────────────────────────────────────────────────┘
   │
   ↓
┌──────────────────────────────────────────────────────────────────┐
│ 6. MessageCore - Enviar Respuesta AI                             │
│                                                                   │
│    await messageCore.sendMessage({                               │
│      type: 'outgoing',                                           │
│      content: {                                                  │
│        text: "Hola! Veo que tienes una consulta sobre tu        │
│               pedido. ¿Podrías darme tu número de orden?"       │
│      },                                                          │
│      metadata: {                                                 │
│        aiGenerated: true,                                        │
│        aiModel: 'gpt-4',                                         │
│        aiConfidence: 0.92                                        │
│      }                                                           │
│    });                                                           │
└──┬───────────────────────────────────────────────────────────────┘
   │
   ↓
┌──────┐
│ User │ Recibe respuesta AI inteligente
└──────┘
```

## Flujo Alternativo: Usuario Sin Acceso a AI

```
┌──────┐
│ User │ "Hola" (usuario con plan starter)
└──┬───┘
   │
   ↓
┌──────────────────────────────────────────────────────────────────┐
│ ServiceGate - Verificar Acceso                                   │
│                                                                   │
│    const canUseAI = await serviceGate.canUseService(             │
│      'user-starter-001',                                         │
│      'ai-assistant'                                              │
│    );                                                            │
│                                                                   │
│    ↓ PostgreSQL Query:                                           │
│    SELECT enabled FROM user_capabilities                         │
│    WHERE user_id = 'user-starter-001'                            │
│      AND service_id = 'ai-assistant'                             │
│                                                                   │
│    ❌ Result: { allowed: false, reason: 'Service disabled' }     │
└──┬───────────────────────────────────────────────────────────────┘
   │
   ↓
┌──────────────────────────────────────────────────────────────────┐
│ MessageCore - Skip AI Processing                                 │
│                                                                   │
│    • No ejecutar AIAssistantExtension                            │
│    • Procesar mensaje sin AI                                     │
│    • Retornar respuesta básica o routing a agente humano         │
└──┬───────────────────────────────────────────────────────────────┘
   │
   ↓
┌──────┐
│ User │ Recibe respuesta sin AI (template básico o agente humano)
└──────┘
```

## Pipeline de Múltiples Extensiones

```
Mensaje Entrante
      ↓
┌─────────────────────────┐
│  1. Moderation          │  ⚡ Priority: CRITICAL
│     Extension           │  ↓ Verificar spam/abuso
│  ✅ canUse?             │  ✅ Mensaje limpio
└─────────┬───────────────┘
          ↓
┌─────────────────────────┐
│  2. AI Assistant        │  ⚡ Priority: HIGH
│     Extension           │  ↓ Generar respuesta
│  ✅ canUse? (quota OK)  │  ✅ Respuesta generada
└─────────┬───────────────┘
          ↓
┌─────────────────────────┐
│  3. Translation         │  ⚡ Priority: NORMAL
│     Extension           │  ↓ Traducir si necesario
│  ❌ canUse? (disabled)  │  ⏭️  SKIP
└─────────┬───────────────┘
          ↓
┌─────────────────────────┐
│  4. Analytics           │  ⚡ Priority: LOW
│     Extension           │  ↓ Registrar métricas
│  ✅ canUse?             │  ✅ Métrica guardada
└─────────┬───────────────┘
          ↓
    Mensaje Procesado
```

## Interacción ServiceGate ↔ ExtensionRegistry

```
┌──────────────────────────────────────────────────────────────────┐
│ ExtensionRegistry.execute()                                       │
│                                                                   │
│ async execute(extensionId, context, input) {                     │
│                                                                   │
│   // 1️⃣ Obtener extensión registrada                            │
│   const ext = this.extensions.get(extensionId);                  │
│                                                                   │
│   // 2️⃣ CRÍTICO: Verificar con ServiceGate                      │
│   const canUse = await serviceGate.canUseService(                │
│     context.userId,                                              │
│     extensionId  // 'ai-assistant'                               │
│   );                                                             │
│                                                                   │
│   if (!canUse.allowed) {                                         │
│     return {                                                     │
│       success: false,                                            │
│       error: {                                                   │
│         code: 'NO_ACCESS',                                       │
│         message: canUse.reason,                                  │
│         upgrade: 'Professional plan required'                    │
│       }                                                          │
│     };                                                           │
│   }                                                              │
│                                                                   │
│   // 3️⃣ Ejecutar extensión                                      │
│   const result = await ext.execute(context, input);              │
│                                                                   │
│   // 4️⃣ Registrar uso                                           │
│   await serviceGate.recordServiceUsage(                          │
│     context.userId,                                              │
│     extensionId,                                                 │
│     1                                                            │
│   );                                                             │
│                                                                   │
│   return result;                                                 │
│ }                                                                │
└──────────────────────────────────────────────────────────────────┘
```

## Modelo de Datos: Capabilities + Extensions

```
┌─────────────────────────────────────────────────────────────────┐
│ PostgreSQL: user_capabilities                                    │
├──────────┬──────────────┬─────────┬────────────────┬────────────┤
│ user_id  │ service_id   │ enabled │ config         │ expires_at │
├──────────┼──────────────┼─────────┼────────────────┼────────────┤
│ user-123 │ ai-assistant │ ✅ true │ {"quota":1000} │ NULL       │
│ user-123 │ analytics    │ ✅ true │ {}             │ NULL       │
│ user-123 │ translation  │ ❌ false│ {}             │ NULL       │
│ user-456 │ ai-assistant │ ✅ true │ {"quota": 50}  │ 2025-12-31 │
│ user-456 │ analytics    │ ❌ false│ {}             │ NULL       │
│ user-789 │ ai-assistant │ ❌ false│ {}             │ NULL       │
└──────────┴──────────────┴─────────┴────────────────┴────────────┘
                              ↑
                              │ ServiceGate consulta
                              │
┌─────────────────────────────────────────────────────────────────┐
│ Memory: ExtensionRegistry                                        │
├──────────────┬──────────────────────────────────────────────────┤
│ Extension ID │ Registered Extension                             │
├──────────────┼──────────────────────────────────────────────────┤
│ ai-assistant │ AIAssistantExtension (OpenAI integration)        │
│              │ • config: { timeout: 5000, model: 'gpt-4' }      │
│              │ • executionCount: 3421                           │
│              │ • errorCount: 5                                  │
├──────────────┼──────────────────────────────────────────────────┤
│ analytics    │ AnalyticsExtension (Mixpanel integration)        │
│              │ • config: { endpoint: 'https://...' }            │
│              │ • executionCount: 8934                           │
│              │ • errorCount: 12                                 │
├──────────────┼──────────────────────────────────────────────────┤
│ translation  │ TranslationExtension (DeepL integration)         │
│              │ • config: { defaultLang: 'es' }                  │
│              │ • executionCount: 1203                           │
│              │ • errorCount: 3                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

## Marketplace Flow

```
Frontend → GET /extensions/marketplace
             ↓
┌──────────────────────────────────────────────────────────────┐
│ ExtensionMarketplace.getAvailableExtensions(userId)           │
│                                                               │
│ 1. registry.list() → Todas las extensiones                   │
│ 2. Para cada extensión:                                      │
│    serviceGate.canUseService(userId, extId)                  │
│    ↓                                                          │
│    ✅ allowed → status: 'active', pricing: 'included'        │
│    ❌ denied  → status: 'locked', pricing: 'upgrade'         │
└──────────────────────────────────────────────────────────────┘
             ↓
Response: [
  {
    id: 'ai-assistant',
    name: 'AI Assistant',
    status: 'active',       ← Usuario puede usar
    hasAccess: true,
    pricing: { type: 'included', price: 0 }
  },
  {
    id: 'translation',
    name: 'Translation',
    status: 'locked',        ← No disponible
    hasAccess: false,
    pricing: { type: 'addon', price: 9 }
  }
]
```

## A/B Testing Flow

```
┌──────────────────────────────────────────────────────────────┐
│ FeatureRolloutManager.setupABTest('ai-assistant')             │
│                                                               │
│ 1. Obtener todos los usuarios                                │
│    users = ['user-001', 'user-002', ..., 'user-100']         │
│                                                               │
│ 2. Split 50/50 por hash consistente                          │
│    groupA = hash(userId) % 2 === 0  → 50 users              │
│    groupB = hash(userId) % 2 === 1  → 50 users              │
│                                                               │
│ 3. Configurar capabilities                                    │
│    ┌─────────┐                      ┌─────────┐             │
│    │ Group A │  ai-assistant: OFF   │ Group B │ ai: ON      │
│    └─────────┘  (control)           └─────────┘ (test)      │
│                                                               │
│    UPDATE user_capabilities                                  │
│    SET enabled = false                                       │
│    WHERE user_id IN (groupA) AND service_id = 'ai-assistant' │
│                                                               │
│    UPDATE user_capabilities                                  │
│    SET enabled = true                                        │
│    WHERE user_id IN (groupB) AND service_id = 'ai-assistant' │
│                                                               │
│ 4. Medir resultados (después de 30 días)                     │
│    • Engagement                                              │
│    • Conversión                                              │
│    • Retención                                               │
└──────────────────────────────────────────────────────────────┘
```

## Resumen de Capas

```
┌─────────────────────────────────────────────────┐
│           CAPA 1: FRONTEND                      │
│  • React/Vue components                         │
│  • REST API calls                               │
│  • UI para marketplace, settings                │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│           CAPA 2: API ROUTES                    │
│  • Elysia routes (messages, capabilities)       │
│  • Middleware (auth, validation, rate limit)    │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│           CAPA 3: ORCHESTRATION                 │
│  • MessageCore                                  │
│  • Business logic                               │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│           CAPA 4: CAPABILITY CONTROL            │
│  • ServiceGate (IServiceGate)                   │
│  • Verifica acceso, quota, expiración           │
│  • PostgreSQL backend                           │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│           CAPA 5: EXTENSION EXECUTION           │
│  • ExtensionRegistry (IExtensionRegistry)       │
│  • Ejecuta extensiones habilitadas              │
│  • Gestiona ciclo de vida                       │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│           CAPA 6: EXTENSIONS                    │
│  • AIAssistantExtension (IExtension)            │
│  • AnalyticsExtension (IExtension)              │
│  • TranslationExtension (IExtension)            │
│  • CustomExtension (IExtension)                 │
└─────────────────────────────────────────────────┘
```

## Ventajas de esta Arquitectura

✅ **Separación de Responsabilidades**
- ServiceGate → Control de acceso (quién puede usar qué)
- ExtensionRegistry → Ejecución de lógica (cómo funciona cada extensión)

✅ **Flexibilidad Total**
- Usuarios pueden tener combinaciones únicas de extensiones
- No limitado a planes fijos (free/premium/enterprise)

✅ **Escalabilidad**
- PostgreSQL como backend de ServiceGate → Horizontal scaling
- ExtensionRegistry en memoria → Rápida ejecución

✅ **Feature Flags Nativos**
- Habilitar/deshabilitar features sin deploy
- A/B testing integrado

✅ **Trial/Freemium Friendly**
- Expiración automática de trials
- Quotas configurables por usuario

✅ **Monetización Granular**
- Vender extensiones individuales (no paquetes)
- Pricing dinámico por usuario/empresa

✅ **Developer Experience**
- Agregar extensiones = implementar interfaz IExtension
- No tocar core del sistema
- Testing aislado por extensión
