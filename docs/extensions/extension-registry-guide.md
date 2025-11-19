# 🧩 Banco de Aplicaciones/Extensiones

## ¿Qué es el Extension Registry?

El **Extension Registry** es el "banco de aplicaciones" del sistema - un catálogo dinámico de extensiones opcionales que se pueden habilitar/deshabilitar por usuario.

Piensa en él como una **App Store interna** donde cada usuario puede tener diferentes apps instaladas según sus capacidades.

## Arquitectura General

```
┌─────────────────────────────────────────────────────┐
│                  Extension Registry                  │
│  (Banco de Aplicaciones - IExtensionRegistry)       │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ AI Assistant │  │  Analytics   │  │ Workflows │ │
│  │  Extension   │  │  Extension   │  │ Extension │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│  ┌──────────────┐  ┌──────────────┐                │
│  │ Translation  │  │ Integrations │   ...          │
│  │  Extension   │  │  Extension   │                │
│  └──────────────┘  └──────────────┘                │
└─────────────────────────────────────────────────────┘
                       ↑
                       │ Controla acceso
                       │
        ┌──────────────┴──────────────┐
        │      ServiceGate (V2)       │
        │  (PostgreSQL capabilities)  │
        └─────────────────────────────┘
                       ↑
                       │ Consulta
                       │
              ┌────────┴────────┐
              │   user_id: 123  │
              └─────────────────┘
```

## 3 Componentes Clave

### 1. `IExtension` - Contrato de Extensión

Cada extensión (app) implementa este contrato:

```typescript
export interface IExtension<TInput, TOutput> {
  // 📝 Identificación
  readonly metadata: ExtensionMetadata;  // id, name, version, type

  // ⚙️ Ciclo de vida
  initialize(config: ExtensionConfig): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<boolean>;

  // 🚀 Ejecución
  canExecute(context: ExtensionContext): Promise<boolean>;
  execute(context: ExtensionContext, input: TInput): Promise<ExtensionResult<TOutput>>;
}
```

**Ejemplo - AI Assistant Extension:**

```typescript
export class AIAssistantExtension implements IExtension {
  readonly metadata = {
    id: 'ai-assistant',
    name: 'AI Assistant',
    version: '1.0.0',
    type: 'ai-assistant'
  };

  async canExecute(context: ExtensionContext): Promise<boolean> {
    // ✅ AQUÍ se verifica si el usuario puede usar esta extensión
    // (en producción: consultar ServiceGate)
    return this.enabled;
  }

  async execute(context: ExtensionContext, input: Message): Promise<ExtensionResult> {
    // 🤖 Lógica de AI: analizar mensaje, generar respuesta, etc.
    const aiResponse = await this.processWithAI(input);
    return { success: true, data: aiResponse };
  }
}
```

### 2. `IExtensionRegistry` - El Banco/Catálogo

El registry gestiona todas las extensiones disponibles:

```typescript
export interface IExtensionRegistry {
  // 📦 Gestión de extensiones
  register(extension: IExtension, config: ExtensionConfig): Promise<void>;
  unregister(extensionId: string): Promise<void>;

  // 📋 Consultas
  get(extensionId: string): RegisteredExtension | undefined;
  list(filter?: ExtensionFilter): RegisteredExtension[];

  // 🚀 Ejecución
  execute<TInput, TOutput>(
    extensionId: string,
    context: ExtensionContext,
    input: TInput
  ): Promise<ExtensionResult<TOutput>>;

  executeAll<TInput, TOutput>(
    type: ExtensionType,
    context: ExtensionContext,
    input: TInput
  ): Promise<ExtensionResult<TOutput>[]>;

  // ⚙️ Control
  setEnabled(extensionId: string, enabled: boolean): Promise<void>;
  updateConfig(extensionId: string, config: Partial<ExtensionConfig>): Promise<void>;

  // 📊 Monitoreo
  getStats(): RegistryStats;
  healthCheck(): Promise<Map<string, boolean>>;
}
```

### 3. `IServiceGate` - El Guardián de Acceso

ServiceGate controla **quién puede usar qué extensión**:

```typescript
// ✅ Usuario "premium" intenta usar AI
const result = await serviceGate.canUseService('user-premium', 'ai-assistant');

if (result.allowed) {
  // ✅ Ejecutar extensión
  await extensionRegistry.execute('ai-assistant', context, message);
} else {
  // ❌ Rechazar - usuario no tiene acceso
  return { error: 'AI Assistant no disponible en tu plan' };
}
```

## Flujo Completo: De Usuario a Extensión

### Escenario: Usuario envía mensaje y quiere respuesta AI

```typescript
// 1️⃣ Usuario "user-123" envía mensaje
POST /messages
Headers: { X-User-Id: "user-123" }
Body: { text: "Hola, necesito ayuda" }

// 2️⃣ MessageCore recibe el mensaje
async receiveMessage(message: MessageEnvelopeV2, userId: string) {

  // 3️⃣ ServiceGate verifica si usuario puede usar AI
  const canUseAI = await this.serviceGate.canUseService(userId, 'ai-assistant');

  if (!canUseAI.allowed) {
    // ❌ Usuario no tiene acceso a AI
    return { error: 'AI no disponible', upgrade: 'Plan Professional' };
  }

  // ✅ Usuario PUEDE usar AI

  // 4️⃣ Verificar quota/límites
  const hasQuota = await this.serviceGate.recordServiceUsage(userId, 'ai-assistant');

  if (!hasQuota.allowed) {
    // ❌ Quota excedida
    return { error: 'Límite de AI alcanzado', resetAt: hasQuota.resetAt };
  }

  // 5️⃣ Ejecutar extensión AI
  const aiResult = await this.extensionRegistry.execute(
    'ai-assistant',
    { userId, message, metadata: {}, timestamp: new Date() },
    message
  );

  // 6️⃣ Procesar respuesta AI
  if (aiResult.success) {
    await this.sendMessage(aiResult.data); // Enviar respuesta AI al usuario
  }
}
```

## Cómo ServiceGate Habilita/Deshabilita Extensiones

### En Base de Datos (V2)

Tabla `user_capabilities`:

```sql
user_id    | service_id     | enabled | config                        | expires_at
-----------|----------------|---------|-------------------------------|------------
user-123   | ai-assistant   | true    | {"limits": {"quota": 1000}}   | NULL
user-456   | ai-assistant   | false   | {}                            | NULL
user-789   | ai-assistant   | true    | {"limits": {"quota": 50}}     | 2025-12-31
```

### Consulta de ServiceGate

```typescript
// Usuario "user-123"
const result = await serviceGate.canUseService('user-123', 'ai-assistant');

// PostgreSQL query:
// SELECT enabled, config, expires_at
// FROM user_capabilities
// WHERE user_id = 'user-123' AND service_id = 'ai-assistant'

// Resultado:
{
  allowed: true,
  config: { limits: { quota: 1000 } },
  reason: 'Service enabled for user'
}

// Usuario "user-456"
const result = await serviceGate.canUseService('user-456', 'ai-assistant');

// Resultado:
{
  allowed: false,
  reason: 'Service disabled for user',
  upgrade: 'Upgrade to Professional to unlock AI Assistant'
}
```

## Tipos de Extensiones

El sistema soporta varios tipos de extensiones:

```typescript
export type ExtensionType =
  | 'ai-assistant'      // 🤖 OpenAI, Claude, GPT
  | 'analytics'         // 📊 Métricas, dashboards
  | 'workflow'          // 🔄 Automatizaciones custom
  | 'routing'           // 🛣️  Routing inteligente
  | 'integration'       // 🔗 Zapier, webhooks, APIs
  | 'moderation'        // 🛡️  Content filtering
  | 'translation'       // 🌐 Traducción multiidioma
  | 'custom';           // 🎨 Extensiones custom
```

### Ejemplo: Extension Registry con Múltiples Apps

```typescript
// Registro de extensiones en startup
const registry = new ExtensionRegistry();

// 🤖 Extensión AI
await registry.register(
  new AIAssistantExtension(),
  { enabled: true, priority: 'high', timeout: 5000 }
);

// 📊 Extensión Analytics
await registry.register(
  new AnalyticsExtension(),
  { enabled: true, priority: 'normal' }
);

// 🌐 Extensión Translation
await registry.register(
  new TranslationExtension(),
  { enabled: true, priority: 'normal', settings: { defaultLang: 'es' } }
);

// 🔗 Extensión Webhook Integrations
await registry.register(
  new WebhookIntegrationExtension(),
  { enabled: true, priority: 'low' }
);
```

## Ejecución de Extensiones

### Ejecución Individual

```typescript
// Ejecutar solo AI Assistant
const result = await extensionRegistry.execute(
  'ai-assistant',
  { userId: 'user-123', message, metadata: {}, timestamp: new Date() },
  message
);

if (result.success) {
  console.log('AI response:', result.data);
}
```

### Ejecución por Tipo (Todas las extensiones AI)

```typescript
// Ejecutar TODAS las extensiones tipo 'ai-assistant'
// (útil si tienes múltiples providers: OpenAI, Claude, etc.)
const results = await extensionRegistry.executeAll(
  'ai-assistant',
  context,
  message
);

// Resultados de todas las extensiones AI
results.forEach(result => {
  if (result.success) {
    console.log('AI result:', result.data);
  }
});
```

### Ejecución con Prioridades

Extensiones se ejecutan en orden de prioridad:

```typescript
// Configuración:
{ priority: 'critical' }  // Se ejecuta primero
{ priority: 'high' }      // Después
{ priority: 'normal' }    // Después
{ priority: 'low' }       // Al final
```

**Ejemplo - Pipeline de Mensaje:**

1. **Critical:** Content Moderation (bloquear spam/abuso)
2. **High:** AI Assistant (generar respuesta inteligente)
3. **Normal:** Translation (traducir si es necesario)
4. **Low:** Analytics (registrar métricas)

## IMessageExtension - Extensiones de Mensajes

Tipo especial de extensión con hooks específicos para mensajes:

```typescript
export interface IMessageExtension extends IExtension {
  // 📥 Procesar mensaje entrante (antes de persistir)
  onIncoming?(message: MessageEnvelopeV2, context: ExtensionContext): Promise<ExtensionResult>;

  // 📤 Procesar mensaje saliente (antes de enviar)
  onOutgoing?(message: MessageEnvelopeV2, context: ExtensionContext): Promise<ExtensionResult>;

  // ✅ Post-procesamiento (después de enviar)
  afterSend?(message: MessageEnvelopeV2, context: ExtensionContext): Promise<ExtensionResult>;
}
```

### Ejemplo - AI Extension con Hooks

```typescript
export class AIAssistantExtension implements IMessageExtension {

  // 📥 Analizar mensaje entrante
  async onIncoming(message, context) {
    // 1. Verificar acceso
    const canUse = await serviceGate.canUseService(context.userId, 'ai-assistant');
    if (!canUse.allowed) {
      return { success: false, error: { code: 'NO_ACCESS' } };
    }

    // 2. Analizar sentimiento/intención
    const analysis = await this.analyzeMessage(message);

    // 3. Agregar metadata al mensaje
    return {
      success: true,
      data: {
        ...message,
        metadata: {
          ...message.metadata,
          aiAnalysis: {
            sentiment: 'positive',
            intent: 'customer_support',
            confidence: 0.92
          }
        }
      }
    };
  }

  // 📤 Mejorar mensaje saliente
  async onOutgoing(message, context) {
    // Verificar acceso
    const canUse = await serviceGate.canUseService(context.userId, 'ai-assistant');
    if (!canUse.allowed) {
      return { success: true, data: message }; // Sin procesar
    }

    // Mejorar redacción con AI
    const enhanced = await this.enhanceText(message.content.text);

    return {
      success: true,
      data: {
        ...message,
        content: {
          ...message.content,
          text: enhanced
        }
      }
    };
  }

  // ✅ Post-procesamiento
  async afterSend(message, context) {
    // Aprender de conversación
    await this.learnFromMessage(message);

    // Actualizar métricas
    await serviceGate.recordServiceUsage(context.userId, 'ai-assistant');

    return { success: true };
  }
}
```

## Monitoreo y Estadísticas

### Estadísticas del Registry

```typescript
const stats = await extensionRegistry.getStats();

// Resultado:
{
  totalExtensions: 8,
  enabledExtensions: 6,
  byType: {
    'ai-assistant': 2,
    'analytics': 1,
    'workflow': 1,
    'integration': 2,
    'translation': 2
  },
  totalExecutions: 15420,
  totalErrors: 23
}
```

### Health Check de Extensiones

```typescript
const health = await extensionRegistry.healthCheck();

// Resultado: Map<extensionId, healthy>
Map {
  'ai-assistant' => true,
  'analytics' => true,
  'translation' => false,  // ⚠️ Translation service down
  'webhooks' => true
}
```

### Información de Extensión Registrada

```typescript
const aiExtension = extensionRegistry.get('ai-assistant');

// Resultado:
{
  extension: AIAssistantExtension,
  config: {
    enabled: true,
    priority: 'high',
    timeout: 5000,
    settings: { model: 'gpt-4' }
  },
  registeredAt: Date('2025-11-15T10:00:00Z'),
  lastExecutedAt: Date('2025-11-19T14:23:12Z'),
  executionCount: 3421,
  errorCount: 5
}
```

## Comparación: Plans vs Capabilities vs Extensions

| Concepto | Descripción | Ejemplo |
|----------|-------------|---------|
| **Plans (Legacy)** | Paquetes fijos predefinidos | `free`, `premium`, `enterprise` |
| **Capabilities (V2)** | Servicios habilitados por usuario | `ai-assistant: enabled=true` |
| **Extensions** | Implementación de servicios | `AIAssistantExtension`, `AnalyticsExtension` |

### Relación:

```
Plan "Professional"
  ↓ (template en DB)
Capabilities
  - ai-assistant: enabled
  - analytics: enabled
  - workflow: enabled
  ↓ (ServiceGate verifica)
Extensions habilitadas
  - AIAssistantExtension ✅
  - AnalyticsExtension ✅
  - WorkflowExtension ✅
  - TranslationExtension ❌ (no en plan)
```

## Casos de Uso Reales

### 1. Marketplace de Extensiones

```typescript
// GET /extensions/marketplace
export async function getAvailableExtensions(userId: string) {
  // 1. Obtener todas las extensiones disponibles
  const allExtensions = extensionRegistry.list();

  // 2. Verificar cuáles puede usar el usuario
  const extensionsWithAccess = await Promise.all(
    allExtensions.map(async (ext) => {
      const canUse = await serviceGate.canUseService(userId, ext.extension.metadata.id);

      return {
        ...ext.extension.metadata,
        hasAccess: canUse.allowed,
        currentPlan: canUse.allowed ? 'included' : 'upgrade_required',
        pricing: getPricingForExtension(ext.extension.metadata.id)
      };
    })
  );

  return extensionsWithAccess;
}

// Respuesta ejemplo:
[
  {
    id: 'ai-assistant',
    name: 'AI Assistant',
    description: 'GPT-powered responses',
    hasAccess: true,        // ✅ Usuario puede usar
    currentPlan: 'included'
  },
  {
    id: 'translation',
    name: 'Translation',
    description: 'Auto-translate messages',
    hasAccess: false,       // ❌ No disponible
    currentPlan: 'upgrade_required',
    pricing: { plan: 'Professional', price: '$29/mo' }
  }
]
```

### 2. A/B Testing de Extensiones

```typescript
// Grupo A: Sin AI (control)
await serviceGate.setServiceEnabled('group-a-users', 'ai-assistant', false);

// Grupo B: Con AI (experimental)
await serviceGate.setServiceEnabled('group-b-users', 'ai-assistant', true);

// Medir resultados después de 30 días
const statsA = await analyticsExtension.getConversionRate('group-a-users');
const statsB = await analyticsExtension.getConversionRate('group-b-users');

console.log('Conversión con AI:', statsB.conversion - statsA.conversion);
```

### 3. Trial Temporal de Extensión

```typescript
// Dar 7 días de AI gratis
await serviceGate.updateServiceConfig('trial-user', 'ai-assistant', {
  enabled: true,
  limits: { quota: 100 },
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
});

// Job que verifica expiración (cron diario)
async function checkTrialExpirations() {
  const expiredTrials = await db.query(`
    SELECT user_id, service_id
    FROM user_capabilities
    WHERE expires_at < NOW() AND enabled = true
  `);

  for (const trial of expiredTrials) {
    await serviceGate.setServiceEnabled(trial.user_id, trial.service_id, false);
    await notifyTrialExpired(trial.user_id, trial.service_id);
  }
}
```

### 4. Feature Flags con Extensiones

```typescript
// Rollout gradual de nueva extensión
const rolloutPercentage = 10; // 10% de usuarios

async function shouldEnableNewFeature(userId: string): Promise<boolean> {
  // Hash consistente del userId
  const hash = hashCode(userId);
  return (hash % 100) < rolloutPercentage;
}

// En runtime
if (await shouldEnableNewFeature(userId)) {
  await serviceGate.setServiceEnabled(userId, 'new-ai-feature', true);
}
```

## Próximos Pasos: Implementación V1

Para implementar el ExtensionRegistry V1 (en memoria), necesitarías crear:

```
apps/api-gateway/src/implementations/v1/
└── ExtensionRegistry.ts  ← Implementación en memoria de IExtensionRegistry
```

**Estructura básica:**

```typescript
export class ExtensionRegistry implements IExtensionRegistry {
  private extensions: Map<string, RegisteredExtension> = new Map();

  async register(extension: IExtension, config: ExtensionConfig): Promise<void> {
    // Guardar en Map
    this.extensions.set(extension.metadata.id, {
      extension,
      config,
      registeredAt: new Date(),
      executionCount: 0,
      errorCount: 0
    });

    // Inicializar extensión
    await extension.initialize(config);
  }

  async execute<TInput, TOutput>(
    extensionId: string,
    context: ExtensionContext,
    input: TInput
  ): Promise<ExtensionResult<TOutput>> {
    const registered = this.extensions.get(extensionId);

    if (!registered) {
      return { success: false, error: { code: 'EXTENSION_NOT_FOUND' } };
    }

    // Verificar si puede ejecutarse
    const canExecute = await registered.extension.canExecute(context);
    if (!canExecute) {
      return { success: false, error: { code: 'EXECUTION_NOT_ALLOWED' } };
    }

    // Ejecutar
    try {
      const result = await registered.extension.execute(context, input);
      registered.executionCount++;
      registered.lastExecutedAt = new Date();
      return result;
    } catch (error) {
      registered.errorCount++;
      throw error;
    }
  }

  // ... resto de métodos
}
```

## Resumen

**Extension Registry es:**
- 📦 **Banco de Aplicaciones** - Catálogo de extensiones disponibles
- 🔌 **Sistema de Plugins** - Extensiones se registran/desregistran dinámicamente
- 🚦 **Controlado por ServiceGate** - Acceso basado en capacidades por usuario
- 🎯 **Flexible** - Cada usuario puede tener diferentes extensiones habilitadas
- 📊 **Monitoreable** - Stats, health checks, métricas de ejecución

**Flujo completo:**
1. Usuario envía request
2. ServiceGate verifica si usuario puede usar extensión
3. Si tiene acceso, ExtensionRegistry ejecuta la extensión
4. Extensión procesa y retorna resultado
5. Sistema registra uso y actualiza métricas

**Ventajas vs sistema legacy de plans:**
- ✅ Granularidad por extensión (no paquetes fijos)
- ✅ Trial temporal de extensiones
- ✅ A/B testing fácil
- ✅ Marketplace de extensiones
- ✅ Feature flags integrados
- ✅ Customización completa por usuario
