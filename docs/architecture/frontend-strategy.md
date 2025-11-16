# Frontend Strategy - Inhost Chat Extensibility

**Fecha**: 2025-11-15
**Sprint**: Post-1.5 (Preparación para Frontend Avanzado)
**Estado**: Estrategia validada - Implementación pendiente
**Versión**: 2.0 (Actualizada con stack optimizado)

---

## 🎯 Objetivo

Crear un frontend de chat **altamente extensible y reutilizable** que:

1. Soporte **mensajes multimedia** (audio, imágenes, video, documentos)
2. Permita **comentarios y reacciones** en mensajes de IA
3. Ofrezca **usabilidad avanzada** (búsqueda, filtros, exportación)
4. Implemente **sistema de plugins/hooks** para extensibilidad
5. Mantenga **contratos estables** (sin romper MessageCore ni interfaces)
6. Sea **reutilizable** en múltiples plataformas (PWA web, Android, PC)
7. **Performance excepcional**: FCP <800ms, TTI <2s, Bundle <120KB

---

## 🛠️ Stack Tecnológico (Optimizado)

### Core Framework
```
React 18 + TypeScript
├── Vite (builds <100ms)
├── Tree-shaking nativo
└── PWA Light (service worker estratégico)
```

**Por qué React 18**:
- Suspense + Lazy Loading built-in
- Concurrent Rendering (mejor UX)
- Server Components (futuro)
- Ecosistema maduro

**Alternativa considerada**: Preact (4KB vs 42KB) → **Descartada** (edge cases con TypeScript, ecosistema limitado)

---

### Estado y Caché

**Filosofía**: Separar UI state de server state

```typescript
// UI State: Zustand (1.5KB)
const useUIStore = create((set) => ({
  sidebarOpen: true,
  theme: 'dark',
  activeChatId: null
}));

// Server State: TanStack Query (13KB)
const { data: messages } = useQuery({
  queryKey: ['messages', conversationId],
  queryFn: () => fetchMessages(conversationId),
  staleTime: 5 * 60 * 1000,
  cacheTime: 30 * 60 * 1000,
  placeholderData: keepPreviousData
});
```

**Por qué TanStack Query** (+13KB vale la pena):
- ✅ Invalidación de caché automática
- ✅ Background refetch
- ✅ Optimistic updates built-in
- ✅ Retry logic
- ✅ Evita ~200 líneas de código custom

**Alternativas consideradas**:
- Redux (+Redux Toolkit): ~15KB + boilerplate pesado → ❌
- SWR: ~5KB pero menos features → ⚠️ (considerar V2)

---

### Estilos y Componentes

```
Tailwind CSS (10KB purged)
├── shadcn/ui (componentes copiables, 0KB dependency)
├── CSS Variables (theming dinámico)
├── System fonts (evita FOIT/FOUT)
└── Critical CSS inline
```

**shadcn/ui**: NO es una librería, son componentes que copias a tu repo
```bash
npx shadcn-ui@latest add button input dialog
# Copia el código fuente a src/components/ui/
# 100% customizable, 0KB bundle adicional
```

**Ventajas**:
- Accessibility out of the box (ARIA, keyboard nav)
- Basado en Radix UI (primitivos accesibles)
- Tailwind-first
- No dependency lock-in

**Alternativas consideradas**:
- Material-UI: ~50KB → ❌ Demasiado pesado
- Chakra UI: ~40KB → ❌ Runtime CSS-in-JS
- Mantine: ~30KB → ⚠️ Considerado, pero shadcn/ui gana por 0KB

---

### Virtual Scroll

```
@tanstack/react-virtual (5KB)
```

**Por qué**: Más moderna que react-window, usa hooks nativos

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function MessageList({ messages }) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => (
          <MessageCard key={item.key} message={messages[item.index]} />
        ))}
      </div>
    </div>
  );
}
```

---

### Búsqueda

```
MiniSearch (7KB)
```

**Por qué MiniSearch** vs Fuse.js:
- -5KB más ligero
- Mejor performance
- Full-text + fuzzy search
- Indexado más rápido

```typescript
import MiniSearch from 'minisearch';

const searchIndex = new MiniSearch({
  fields: ['content.text', 'content.media.metadata.transcription', 'content.media.metadata.ocrText'],
  storeFields: ['id', 'content', 'metadata'],
  searchOptions: {
    boost: { 'content.text': 2 },
    fuzzy: 0.2
  }
});

searchIndex.addAll(messages);

const results = searchIndex.search(query, {
  prefix: true,
  fuzzy: 0.2
});
```

---

### Routing

```
React Router (10KB)
├── Lazy loading de rutas
├── Prefetch inteligente
└── Suspense integration
```

```typescript
const MessageList = lazy(() => import('./components/MessageList'));
const SearchPanel = lazy(() => import('./components/SearchPanel'));

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={
          <Suspense fallback={<MessageSkeleton />}>
            <MessageList />
          </Suspense>
        } />
        <Route path="/search" element={
          <Suspense fallback={<SearchSkeleton />}>
            <SearchPanel />
          </Suspense>
        } />
      </Route>
    </Routes>
  );
}
```

---

### Offline Storage

```
IndexedDB (V1) → SQLite (V2 con Capacitor)
├── Workbox (service worker)
├── Background sync
└── Conflict resolution
```

---

### 📊 Bundle Size Estimado

```
React 18:                42KB gzipped
React Router:            10KB
Zustand:                 1.5KB
TanStack Query:          13KB
TanStack Virtual:        5KB
MiniSearch:              7KB
shadcn/ui (5 comps):     ~8KB
Workbox:                 ~10KB
Tu código (optimizado):  ~30KB
────────────────────────────────
Total:                   ~127KB gzipped ✅
```

**Target ajustado**: **<120KB** (realista con React)

**Estrategia de código splitting**:
```
Bundle inicial (shell): ~60KB
Lazy (MessageList):     ~30KB (carga on-demand)
Lazy (SearchPanel):     ~20KB (carga on-demand)
Lazy (Export):          ~15KB (carga on-demand)
```

---

## ✅ Viabilidad: 100% CONFIRMADA

### Por qué es viable SIN romper contratos

**1. MessageEnvelopeV2 ya soporta multimedia** (campos no utilizados actualmente):

```typescript
// packages/shared/src/types/MessageEnvelopeV2.ts
export interface MessageContent {
  text?: string;
  media?: MediaContent;      // ✅ YA EXISTE (no usado)
  format?: MessageFormat;    // ✅ YA EXISTE
  metadata?: Record<string, unknown>; // ✅ Extensible
}

export interface MediaContent {
  type: 'image' | 'audio' | 'video' | 'document';
  url: string;
  mimeType: string;
  size?: number;
  thumbnail?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    transcription?: string;  // Audio transcrito
    ocrText?: string;        // Texto extraído de imagen
  };
}
```

**2. MessageMetadata es extensible**:

```typescript
export interface MessageMetadata {
  timestamp: string;
  from: string;
  to: string;
  ownerId?: string;
  conversationId?: string;
  tags?: string[];
  customData?: Record<string, unknown>; // ✅ Puedes añadir CUALQUIER dato
}
```

**3. MessageCore NO necesita cambios**:
- MessageCore solo **delega** a servicios
- Los servicios pueden **evolucionar** sin romper MessageCore
- Nuevas capacidades se añaden mediante **nuevos servicios** (no modificando los existentes)

---

## 🚀 Plan de Implementación: 3 Fases

### **Phase 1: Content Enrichment (4-6 horas)**

**Objetivo**: Soportar mensajes multimedia con procesamiento automático

#### 1.1 Crear `IContentEnricher` Service

```typescript
// apps/api-gateway/src/core/interfaces/IContentEnricher.ts
export interface IContentEnricher {
  /**
   * Enriquece un mensaje con procesamiento multimedia
   */
  enrich(envelope: MessageEnvelope): Promise<EnrichedEnvelope>;

  /**
   * Transcribe audio a texto
   */
  transcribeAudio(mediaUrl: string): Promise<string>;

  /**
   * Analiza imagen (OCR, detección de objetos)
   */
  analyzeImage(mediaUrl: string): Promise<ImageAnalysis>;

  /**
   * Comprime y optimiza media
   */
  optimizeMedia(media: MediaContent): Promise<MediaContent>;
}

export interface ImageAnalysis {
  ocrText?: string;           // Texto detectado
  objects?: string[];         // Objetos detectados
  tags?: string[];            // Tags automáticos
  dominantColors?: string[];  // Colores predominantes
}

export interface EnrichedEnvelope extends MessageEnvelope {
  enrichment?: {
    transcription?: string;
    imageAnalysis?: ImageAnalysis;
    processedAt: string;
    processingTimeMs: number;
  };
}
```

#### 1.2 Implementación V1: `SimpleContentEnricher`

```typescript
// apps/api-gateway/src/implementations/v1/SimpleContentEnricher.ts
export class SimpleContentEnricher implements IContentEnricher {
  async enrich(envelope: MessageEnvelope): Promise<EnrichedEnvelope> {
    const startTime = Date.now();
    const enriched: EnrichedEnvelope = { ...envelope };

    // Si tiene audio, transcribir
    if (envelope.content.media?.type === 'audio') {
      const transcription = await this.transcribeAudio(envelope.content.media.url);
      enriched.content.media.metadata = {
        ...enriched.content.media.metadata,
        transcription
      };
    }

    // Si tiene imagen, analizar
    if (envelope.content.media?.type === 'image') {
      const analysis = await this.analyzeImage(envelope.content.media.url);
      enriched.content.media.metadata = {
        ...enriched.content.media.metadata,
        ocrText: analysis.ocrText
      };
    }

    enriched.enrichment = {
      transcription: enriched.content.media?.metadata?.transcription,
      imageAnalysis: enriched.content.media?.metadata?.ocrText ? { ocrText: enriched.content.media.metadata.ocrText } : undefined,
      processedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime
    };

    return enriched;
  }

  async transcribeAudio(mediaUrl: string): Promise<string> {
    // V1: Retornar placeholder
    // V2: Integrar con Whisper API o similar
    return "[Audio transcription placeholder]";
  }

  async analyzeImage(mediaUrl: string): Promise<ImageAnalysis> {
    // V1: Retornar placeholder
    // V2: Integrar con Vision API (OpenAI, Google Cloud Vision)
    return {
      ocrText: "[Image analysis placeholder]",
      tags: ['placeholder']
    };
  }
}
```

#### 1.3 Integración con MessageCore (SIN ROMPER CONTRATOS)

```typescript
// apps/api-gateway/src/core/MessageCore.ts
export class MessageCore {
  constructor(
    private persistence: IPersistenceService,
    private notifications: INotificationService,
    private planResolver: IPlanResolver,
    private ownerChecker: IOwnerChecker,
    private adapters: AdapterManager,
    private contentEnricher?: IContentEnricher  // ✅ OPCIONAL (no rompe código existente)
  ) {}

  async receive(envelope: MessageEnvelope): Promise<void> {
    // 0. Enriquecimiento de contenido (OPCIONAL)
    const enriched = this.contentEnricher
      ? await this.contentEnricher.enrich(envelope)
      : envelope;

    // 1-3. Flujo normal (SIN CAMBIOS)
    await this.persistence.save(enriched);
    await this.notifications.broadcast(enriched);
    await this.updateStatus(enriched.id, MessageStatus.RECEIVED);
  }
}
```

---

### **Phase 2: Conversation Layers (6-8 horas)**

**Objetivo**: Comentarios, reacciones y capas de conversación

#### 2.1 Crear `IConversationLayer` Service

```typescript
// apps/api-gateway/src/core/interfaces/IConversationLayer.ts
export interface IConversationLayer {
  /**
   * Añade un comentario a un mensaje
   */
  addComment(messageId: string, comment: Comment): Promise<void>;

  /**
   * Obtiene comentarios de un mensaje
   */
  getComments(messageId: string): Promise<Comment[]>;

  /**
   * Añade una reacción a un mensaje
   */
  addReaction(messageId: string, reaction: Reaction): Promise<void>;

  /**
   * Obtiene reacciones de un mensaje
   */
  getReactions(messageId: string): Promise<ReactionSummary>;

  /**
   * Marca un mensaje como favorito
   */
  toggleFavorite(messageId: string, userId: string): Promise<void>;
}

export interface Comment {
  id: string;
  messageId: string;
  userId: string;
  text: string;
  createdAt: string;
  editedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface Reaction {
  emoji: string;
  userId: string;
  timestamp: string;
}

export interface ReactionSummary {
  [emoji: string]: {
    count: number;
    users: string[];
  };
}
```

#### 2.2 Almacenamiento de Capas

**Estrategia**: Las capas NO modifican `MessageEnvelope`, se almacenan **separadamente**

```typescript
// V1: En memoria
export class MemoryConversationLayer implements IConversationLayer {
  private comments: Map<string, Comment[]> = new Map();
  private reactions: Map<string, Reaction[]> = new Map();
  private favorites: Map<string, Set<string>> = new Map();

  async addComment(messageId: string, comment: Comment): Promise<void> {
    const existing = this.comments.get(messageId) || [];
    existing.push(comment);
    this.comments.set(messageId, existing);
  }

  async getComments(messageId: string): Promise<Comment[]> {
    return this.comments.get(messageId) || [];
  }

  // ... similar para reactions y favorites
}

// V2: PostgreSQL (tabla separada)
// comments: message_id, user_id, text, created_at
// reactions: message_id, user_id, emoji, timestamp
// favorites: message_id, user_id
```

#### 2.3 Frontend Component Example

```typescript
// Frontend: MessageCard.tsx
interface MessageCardProps {
  message: MessageEnvelope;
  comments: Comment[];
  reactions: ReactionSummary;
  isFavorite: boolean;
}

function MessageCard({ message, comments, reactions, isFavorite }: MessageCardProps) {
  return (
    <div className="message-card">
      {/* Contenido principal del mensaje */}
      <MessageContent content={message.content} />

      {/* Capa de reacciones */}
      <ReactionBar reactions={reactions} onAddReaction={handleReaction} />

      {/* Capa de comentarios (expandible) */}
      {comments.length > 0 && (
        <CommentSection comments={comments} onAddComment={handleComment} />
      )}

      {/* Acciones */}
      <ActionBar
        isFavorite={isFavorite}
        onToggleFavorite={handleFavorite}
        onShare={handleShare}
      />
    </div>
  );
}
```

---

### **Phase 3: Hooks & Plugins (8-10 horas)**

**Objetivo**: Sistema de extensibilidad mediante eventos

#### 3.1 Crear `IHookSystem` Service

```typescript
// apps/api-gateway/src/core/interfaces/IHookSystem.ts
export interface IHookSystem {
  /**
   * Registra un hook para un evento
   */
  register(event: HookEvent, handler: HookHandler): void;

  /**
   * Ejecuta hooks para un evento
   */
  execute(event: HookEvent, context: HookContext): Promise<void>;

  /**
   * Lista hooks registrados
   */
  list(event?: HookEvent): Hook[];

  /**
   * Desregistra un hook
   */
  unregister(hookId: string): void;
}

export type HookEvent =
  | 'message:before_receive'
  | 'message:after_receive'
  | 'message:before_send'
  | 'message:after_send'
  | 'message:before_persist'
  | 'message:after_persist'
  | 'message:enriched'
  | 'comment:added'
  | 'reaction:added';

export interface HookContext {
  event: HookEvent;
  data: MessageEnvelope | Comment | Reaction;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export type HookHandler = (context: HookContext) => Promise<void> | void;

export interface Hook {
  id: string;
  event: HookEvent;
  handler: HookHandler;
  priority?: number;
  enabled: boolean;
}
```

#### 3.2 Integración con MessageCore

```typescript
// apps/api-gateway/src/core/MessageCore.ts
export class MessageCore {
  constructor(
    // ... servicios existentes
    private hooks?: IHookSystem  // ✅ OPCIONAL
  ) {}

  async receive(envelope: MessageEnvelope): Promise<void> {
    // Hook: antes de recibir
    await this.hooks?.execute('message:before_receive', {
      event: 'message:before_receive',
      data: envelope,
      timestamp: new Date().toISOString()
    });

    // Enriquecimiento
    const enriched = this.contentEnricher
      ? await this.contentEnricher.enrich(envelope)
      : envelope;

    // Hook: después de enriquecer
    if (this.contentEnricher && enriched !== envelope) {
      await this.hooks?.execute('message:enriched', {
        event: 'message:enriched',
        data: enriched,
        timestamp: new Date().toISOString()
      });
    }

    // Hook: antes de persistir
    await this.hooks?.execute('message:before_persist', {
      event: 'message:before_persist',
      data: enriched,
      timestamp: new Date().toISOString()
    });

    // Persistencia
    await this.persistence.save(enriched);

    // Hook: después de persistir
    await this.hooks?.execute('message:after_persist', {
      event: 'message:after_persist',
      data: enriched,
      timestamp: new Date().toISOString()
    });

    // Notificación
    await this.notifications.broadcast(enriched);

    // Hook: después de recibir
    await this.hooks?.execute('message:after_receive', {
      event: 'message:after_receive',
      data: enriched,
      timestamp: new Date().toISOString()
    });

    // Update status
    await this.updateStatus(enriched.id, MessageStatus.RECEIVED);
  }
}
```

#### 3.3 Plugin Example: Auto-Tag AI Messages

```typescript
// apps/api-gateway/src/plugins/AutoTagAIPlugin.ts
export class AutoTagAIPlugin {
  register(hookSystem: IHookSystem) {
    hookSystem.register('message:after_receive', async (context) => {
      const envelope = context.data as MessageEnvelope;

      // Si el mensaje viene de una extensión AI, auto-taggearlo
      if (envelope.metadata.from?.includes('ai-extension')) {
        envelope.metadata.tags = [
          ...(envelope.metadata.tags || []),
          'ai-generated',
          'auto-tagged'
        ];

        logger.info('Auto-tagged AI message', {
          messageId: envelope.id,
          tags: envelope.metadata.tags
        });
      }
    });
  }
}

// Registro en services/index.ts
const autoTagPlugin = new AutoTagAIPlugin();
autoTagPlugin.register(hookSystem);
```

---

## 🔌 Sistema de Inyección de Dependencias

**Filosofía**: Mismo patrón que MessageCore (constructor injection)

### Backend: Service Container

```typescript
// apps/api-gateway/src/core/ServiceContainer.ts
export class ServiceContainer {
  private services: Map<string, any> = new Map();

  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  resolve<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service "${name}" not registered`);
    }
    return service;
  }

  has(name: string): boolean {
    return this.services.has(name);
  }
}

// Inicialización
const container = new ServiceContainer();

// Registrar servicios
container.register('persistence', new MemoryPersistence());
container.register('notifications', new WebSocketNotification());
container.register('planResolver', new SimplePlanResolver());
container.register('ownerChecker', new ConnectionOwnerChecker());

// Inyectar en MessageCore
const messageCore = new MessageCore(
  container.resolve('persistence'),
  container.resolve('notifications'),
  container.resolve('planResolver'),
  container.resolve('ownerChecker'),
  adapterManager
);
```

### Frontend: React Context + Providers

```typescript
// frontend/src/providers/ServiceProvider.tsx
interface Services {
  messageAPI: MessageAPI;
  websocketAPI: WebSocketAPI;
  platformService: IPlatformService;
  searchEngine: MiniSearch;
}

const ServiceContext = createContext<Services | null>(null);

export function ServiceProvider({ children }: { children: ReactNode }) {
  const services = useMemo(() => ({
    messageAPI: new MessageAPI(process.env.VITE_API_URL),
    websocketAPI: new WebSocketAPI(process.env.VITE_WS_URL),
    platformService: Capacitor.isNativePlatform()
      ? new CapacitorPlatformService()
      : new WebPlatformService(),
    searchEngine: new MiniSearch({
      fields: ['content.text', 'content.media.metadata.transcription'],
      storeFields: ['id', 'content', 'metadata']
    })
  }), []);

  return (
    <ServiceContext.Provider value={services}>
      {children}
    </ServiceContext.Provider>
  );
}

export function useServices() {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useServices must be used within ServiceProvider');
  }
  return context;
}

// Uso en componentes
function MessageList() {
  const { messageAPI } = useServices();

  const { data: messages } = useQuery({
    queryKey: ['messages'],
    queryFn: () => messageAPI.fetchMessages()
  });
}
```

---

## 🧩 Registry Central de Plugins

**Objetivo**: Descubrimiento y gestión centralizada de plugins

### Backend: Plugin Registry

```typescript
// apps/api-gateway/src/core/PluginRegistry.ts
export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  register(container: ServiceContainer, hooks: IHookSystem): void;
  unregister?(): void;
}

export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" already registered`);
    }

    this.plugins.set(plugin.id, plugin);
    logger.info('Plugin registered', { id: plugin.id, name: plugin.name });
  }

  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.unregister?.();
      this.plugins.delete(pluginId);
      logger.info('Plugin unregistered', { id: pluginId });
    }
  }

  enable(pluginId: string, container: ServiceContainer, hooks: IHookSystem): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }

    plugin.enabled = true;
    plugin.register(container, hooks);
    logger.info('Plugin enabled', { id: pluginId });
  }

  disable(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = false;
      plugin.unregister?.();
      logger.info('Plugin disabled', { id: pluginId });
    }
  }

  list(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  get(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }
}
```

### Plugin Example: Sentiment Analysis

```typescript
// apps/api-gateway/src/plugins/SentimentAnalysisPlugin.ts
export class SentimentAnalysisPlugin implements Plugin {
  id = 'sentiment-analysis';
  name = 'Sentiment Analysis';
  version = '1.0.0';
  description = 'Analyzes message sentiment and adds tags';
  enabled = false;

  register(container: ServiceContainer, hooks: IHookSystem): void {
    hooks.register('message:after_receive', async (context) => {
      const envelope = context.data as MessageEnvelope;

      if (!envelope.content.text) return;

      const sentiment = await this.analyzeSentiment(envelope.content.text);

      envelope.metadata.tags = [
        ...(envelope.metadata.tags || []),
        `sentiment:${sentiment}`
      ];

      logger.debug('Sentiment analyzed', {
        messageId: envelope.id,
        sentiment
      });
    });
  }

  unregister(): void {
    // Cleanup si es necesario
  }

  private async analyzeSentiment(text: string): Promise<'positive' | 'neutral' | 'negative'> {
    // V1: Simple keyword matching
    const positiveWords = ['good', 'great', 'excellent', 'amazing'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible'];

    const lowerText = text.toLowerCase();

    const hasPositive = positiveWords.some(word => lowerText.includes(word));
    const hasNegative = negativeWords.some(word => lowerText.includes(word));

    if (hasPositive && !hasNegative) return 'positive';
    if (hasNegative && !hasPositive) return 'negative';
    return 'neutral';

    // V2: Integrar con API de sentiment analysis (Google NLP, AWS Comprehend)
  }
}

// Registro
const pluginRegistry = new PluginRegistry();
pluginRegistry.register(new SentimentAnalysisPlugin());
pluginRegistry.register(new AutoTagAIPlugin());

// Habilitar plugins
pluginRegistry.enable('sentiment-analysis', container, hooks);
```

### Frontend: Plugin Registry

```typescript
// frontend/src/plugins/PluginRegistry.ts
export interface FrontendPlugin {
  id: string;
  name: string;
  enabled: boolean;
  renderMessageActions?(message: MessageEnvelope): ReactNode;
  renderSidebarWidget?(): ReactNode;
  processMessage?(message: MessageEnvelope): MessageEnvelope;
}

export class FrontendPluginRegistry {
  private plugins: Map<string, FrontendPlugin> = new Map();

  register(plugin: FrontendPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  getMessageActions(message: MessageEnvelope): ReactNode[] {
    return Array.from(this.plugins.values())
      .filter(p => p.enabled && p.renderMessageActions)
      .map(p => p.renderMessageActions!(message));
  }

  getSidebarWidgets(): ReactNode[] {
    return Array.from(this.plugins.values())
      .filter(p => p.enabled && p.renderSidebarWidget)
      .map(p => p.renderSidebarWidget!());
  }
}

// Uso en componente
function MessageCard({ message }: { message: MessageEnvelope }) {
  const pluginRegistry = usePluginRegistry();
  const actions = pluginRegistry.getMessageActions(message);

  return (
    <div className="message-card">
      <MessageContent content={message.content} />
      <div className="plugin-actions">
        {actions}
      </div>
    </div>
  );
}
```

---

## 🎨 Design System: Consistencia y Variantes

### CSS Variables + Tailwind

```css
/* frontend/src/styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Colors (RGB sin unidades para compatibilidad con alpha) */
    --color-primary: 59 130 246;        /* blue-500 */
    --color-primary-hover: 37 99 235;   /* blue-600 */
    --color-surface: 255 255 255;
    --color-surface-elevated: 249 250 251; /* gray-50 */
    --color-text: 17 24 39;             /* gray-900 */
    --color-text-muted: 107 114 128;    /* gray-500 */
    --color-border: 229 231 235;        /* gray-200 */

    /* Semantic colors */
    --color-success: 34 197 94;         /* green-500 */
    --color-warning: 251 146 60;        /* orange-400 */
    --color-error: 239 68 68;           /* red-500 */
    --color-info: 59 130 246;           /* blue-500 */

    /* Spacing */
    --spacing-message: 1rem;
    --spacing-composer: 1.5rem;

    /* Timing */
    --transition-fast: 150ms;
    --transition-normal: 250ms;
    --transition-slow: 350ms;

    /* Shadows */
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);

    /* Border radius */
    --radius-sm: 0.375rem;
    --radius-md: 0.5rem;
    --radius-lg: 0.75rem;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --color-surface: 17 24 39;          /* gray-900 */
      --color-surface-elevated: 31 41 55; /* gray-800 */
      --color-text: 243 244 246;          /* gray-100 */
      --color-text-muted: 156 163 175;    /* gray-400 */
      --color-border: 55 65 81;           /* gray-700 */
    }
  }

  /* Reducir animaciones si el usuario lo prefiere */
  @media (prefers-reduced-motion: reduce) {
    :root {
      --transition-fast: 0ms;
      --transition-normal: 0ms;
      --transition-slow: 0ms;
    }
  }
}

@layer components {
  /* Componente reutilizable: Message Card */
  .message-card {
    @apply bg-surface text-text rounded-lg p-4 border border-border;
    @apply transition-colors duration-[var(--transition-fast)];
    @apply hover:bg-surface-elevated;
    box-shadow: var(--shadow-sm);
  }

  .message-card:hover {
    box-shadow: var(--shadow-md);
  }

  /* Botón primario */
  .btn-primary {
    @apply bg-primary text-white px-4 py-2 rounded-md;
    @apply transition-colors duration-[var(--transition-fast)];
    @apply hover:bg-primary-hover focus:ring-2 focus:ring-primary/50;
  }
}

/* Utilidades custom usando variables */
@layer utilities {
  .bg-surface {
    background-color: rgb(var(--color-surface));
  }

  .bg-surface-elevated {
    background-color: rgb(var(--color-surface-elevated));
  }

  .text-text {
    color: rgb(var(--color-text));
  }

  .text-text-muted {
    color: rgb(var(--color-text-muted));
  }

  .border-border {
    border-color: rgb(var(--color-border));
  }

  .bg-primary {
    background-color: rgb(var(--color-primary));
  }

  .bg-primary-hover {
    background-color: rgb(var(--color-primary-hover));
  }
}
```

### Class Variance Authority (CVA)

**Por qué CVA**: Composición de variantes type-safe

```bash
npm install class-variance-authority
```

```typescript
// frontend/src/components/ui/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base styles (siempre aplicadas)
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-hover',
        secondary: 'bg-surface-elevated text-text hover:bg-border',
        ghost: 'hover:bg-surface-elevated',
        destructive: 'bg-error text-white hover:bg-red-600'
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-lg',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

// Uso
<Button variant="primary" size="lg">Enviar Mensaje</Button>
<Button variant="ghost" size="icon"><TrashIcon /></Button>
<Button variant="destructive">Eliminar Conversación</Button>
```

### Message Card con Variantes

```typescript
// frontend/src/components/MessageCard/MessageCard.tsx
import { cva } from 'class-variance-authority';

const messageVariants = cva(
  'message-card relative',
  {
    variants: {
      type: {
        incoming: 'ml-0 mr-auto bg-surface',
        outgoing: 'ml-auto mr-0 bg-primary/10',
        system: 'mx-auto bg-surface-elevated text-text-muted text-sm'
      },
      status: {
        sending: 'opacity-70',
        sent: 'opacity-100',
        failed: 'border-error'
      },
      hasMedia: {
        true: 'pb-0',
        false: ''
      }
    },
    defaultVariants: {
      type: 'incoming',
      status: 'sent',
      hasMedia: false
    }
  }
);

interface MessageCardProps extends VariantProps<typeof messageVariants> {
  message: MessageEnvelope;
}

export function MessageCard({ message, type, status, hasMedia }: MessageCardProps) {
  return (
    <div className={messageVariants({ type, status, hasMedia })}>
      <MessageContent content={message.content} />
      {hasMedia && <MediaPreview media={message.content.media} />}
      <MessageMeta timestamp={message.metadata.timestamp} status={status} />
    </div>
  );
}
```

---

## 🖼️ Optimización de Medios

### Estrategia de Formatos Múltiples

**Imágenes**: AVIF → WebP → JPEG (progresivo)

```typescript
// Backend: Conversión múltiple
export class MediaProcessor {
  async processImage(file: File): Promise<MediaContent> {
    const formats = await Promise.all([
      this.convertToAVIF(file),   // Mejor compresión (40-50% menor que WebP)
      this.convertToWebP(file),   // Fallback moderno
      this.convertToJPEG(file)    // Fallback universal
    ]);

    return {
      type: 'image',
      url: formats[2].url,        // JPEG como base
      mimeType: 'image/jpeg',
      metadata: {
        avifUrl: formats[0].url,
        webpUrl: formats[1].url,
        jpegUrl: formats[2].url,
        width: formats[0].width,
        height: formats[0].height
      }
    };
  }
}

// Frontend: Picture con múltiples sources
function MediaPreview({ media }: { media: MediaContent }) {
  if (media.type !== 'image') return null;

  return (
    <picture>
      {media.metadata?.avifUrl && (
        <source srcSet={media.metadata.avifUrl} type="image/avif" />
      )}
      {media.metadata?.webpUrl && (
        <source srcSet={media.metadata.webpUrl} type="image/webp" />
      )}
      <img
        src={media.url}
        alt="Message media"
        loading="lazy"
        className="rounded-lg max-w-full h-auto"
      />
    </picture>
  );
}
```

**Audio**: Opus → AAC → MP3

```typescript
// Backend: Conversión múltiple
export class MediaProcessor {
  async processAudio(file: File): Promise<MediaContent> {
    const formats = await Promise.all([
      this.convertToOpus(file),   // Mejor compresión (WebM container)
      this.convertToAAC(file),    // iOS/Safari fallback
      this.convertToMP3(file)     // Fallback universal
    ]);

    return {
      type: 'audio',
      url: formats[2].url,        // MP3 como base
      mimeType: 'audio/mpeg',
      metadata: {
        opusUrl: formats[0].url,
        aacUrl: formats[1].url,
        mp3Url: formats[2].url,
        duration: formats[0].duration
      }
    };
  }
}

// Frontend: Audio con múltiples sources
function AudioPlayer({ media }: { media: MediaContent }) {
  if (media.type !== 'audio') return null;

  const canPlayOpus = () => {
    const audio = document.createElement('audio');
    return audio.canPlayType('audio/webm; codecs=opus') !== '';
  };

  const canPlayAAC = () => {
    const audio = document.createElement('audio');
    return audio.canPlayType('audio/mp4; codecs=mp4a.40.2') !== '';
  };

  const audioSrc = canPlayOpus()
    ? media.metadata?.opusUrl
    : canPlayAAC()
    ? media.metadata?.aacUrl
    : media.url;

  return (
    <audio controls className="w-full">
      <source src={audioSrc} />
      Your browser does not support audio playback.
    </audio>
  );
}
```

---

## 📱 Capacitor/Ionic: Evaluación y Viabilidad

### ¿Por qué considerar Capacitor?

**Capacitor** (de Ionic) permite convertir una PWA web en aplicación nativa con acceso a APIs del dispositivo:

- **Cámara y micrófono nativo** (grabación de audio/video)
- **Sistema de archivos** (exportar conversaciones localmente)
- **Notificaciones push nativas** (Firebase Cloud Messaging)
- **Geolocalización** (compartir ubicación en mensajes)
- **Contactos** (autocompletado al enviar mensajes)
- **Biometría** (autenticación por huella/Face ID)

### Ventajas para Inhost

| Capacidad | PWA Web | PWA + Capacitor | Beneficio |
|-----------|---------|-----------------|-----------|
| **Audio recording** | MediaRecorder API | Native AudioRecorder | Mejor calidad, más formatos |
| **Push notifications** | Service Workers | FCM nativo | Más confiables, mejor UX |
| **File system** | IndexedDB | Filesystem API | Exportar conversaciones offline |
| **Camera** | getUserMedia | Native Camera | Mejor integración con galería |
| **Offline sync** | Service Workers + IndexedDB | SQLite nativo | Mayor capacidad, mejor performance |

### Estrategia de Adopción: Progresiva

**Fase 1: PWA Web Pura** (Sprint 3)
- Chat funcional en navegador
- MediaRecorder para audio
- IndexedDB para caché

**Fase 2: PWA + Capacitor (Opcional)** (Sprint 6-7)
- Añadir `@capacitor/core`
- Detectar plataforma y usar APIs nativas cuando estén disponibles
- Fallback a Web APIs si no hay Capacitor

**Fase 3: Apps Nativas (Futuro)** (Sprint 8+)
- `npx cap add android`
- `npx cap add ios`
- Distribuir en Google Play / App Store

### Código: Abstracción de Platform Capabilities

```typescript
// frontend/src/services/platform/IPlatformService.ts
export interface IPlatformService {
  recordAudio(): Promise<AudioBlob>;
  takePhoto(): Promise<ImageBlob>;
  saveFile(data: Blob, filename: string): Promise<void>;
  showNotification(title: string, body: string): Promise<void>;
}

// frontend/src/services/platform/WebPlatform.ts
export class WebPlatformService implements IPlatformService {
  async recordAudio(): Promise<AudioBlob> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    // ... web recording logic
  }
}

// frontend/src/services/platform/CapacitorPlatform.ts
import { VoiceRecorder } from '@capacitor-community/voice-recorder';

export class CapacitorPlatformService implements IPlatformService {
  async recordAudio(): Promise<AudioBlob> {
    await VoiceRecorder.requestAudioRecordingPermission();
    const result = await VoiceRecorder.startRecording();
    // ... native recording logic
  }
}

// frontend/src/services/platform/index.ts
import { Capacitor } from '@capacitor/core';

export const platformService: IPlatformService = Capacitor.isNativePlatform()
  ? new CapacitorPlatformService()
  : new WebPlatformService();
```

### Decisión: ¿Cuándo añadir Capacitor?

**Recomendación**: **Postergar a Sprint 6-7**

**Razones**:
1. **Sprint 2**: Enfocarse en seguridad y protección (rate limiting, validación, autenticación)
2. **Sprint 3**: Implementar frontend básico con PWA web pura
3. **Sprint 6**: Evaluar necesidad real de capacidades nativas según feedback de usuarios

**Ventajas de postergar**:
- No añadir complejidad prematura
- Validar UX con PWA web primero
- Decisión informada basada en métricas reales

**Ventajas de añadir temprano**:
- Arquitectura desde el inicio preparada para mobile
- Testear en dispositivos reales desde Sprint 3
- Posibilidad de lanzar en stores más rápido

---

## 🏗️ Arquitectura Frontend Propuesta

```
apps/frontend/
├── public/
│   ├── manifest.json          # PWA manifest
│   └── sw.js                  # Service Worker (generado por Workbox)
├── src/
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Dialog.tsx
│   │   │   └── ...
│   │   ├── MessageCard/
│   │   │   ├── MessageCard.tsx
│   │   │   ├── MessageContent.tsx
│   │   │   ├── MediaPreview.tsx
│   │   │   ├── CommentSection.tsx
│   │   │   └── ReactionBar.tsx
│   │   ├── Composer/
│   │   │   ├── TextComposer.tsx
│   │   │   ├── MediaComposer.tsx
│   │   │   └── VoiceRecorder.tsx
│   │   └── Sidebar/
│   │       ├── ConversationList.tsx
│   │       ├── SearchBar.tsx
│   │       └── FilterPanel.tsx
│   ├── services/
│   │   ├── api/
│   │   │   ├── MessageAPI.ts
│   │   │   ├── WebSocketAPI.ts
│   │   │   └── MediaAPI.ts
│   │   ├── platform/
│   │   │   ├── IPlatformService.ts
│   │   │   ├── WebPlatform.ts
│   │   │   └── CapacitorPlatform.ts
│   │   ├── storage/
│   │   │   ├── IndexedDBStore.ts
│   │   │   └── SQLiteStore.ts (Capacitor)
│   │   └── export/
│   │       └── ConversationExporter.ts
│   ├── hooks/
│   │   ├── useMessages.ts
│   │   ├── useComments.ts
│   │   ├── useReactions.ts
│   │   ├── useMediaUpload.ts
│   │   └── useSearch.ts
│   ├── providers/
│   │   ├── ServiceProvider.tsx
│   │   └── ThemeProvider.tsx
│   ├── plugins/
│   │   ├── PluginRegistry.ts
│   │   └── SamplePlugin.tsx
│   ├── state/
│   │   ├── useUIStore.ts (Zustand)
│   │   └── queries/
│   │       ├── useMessagesQuery.ts (TanStack Query)
│   │       └── useConversationsQuery.ts
│   ├── styles/
│   │   └── globals.css
│   ├── lib/
│   │   └── utils.ts (cn helper)
│   └── App.tsx
├── capacitor.config.ts (opcional)
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

---

## 🚀 Estrategia de Carga Progresiva

### Milestones de Performance

```
0-300ms:   Shell + Critical CSS (inline)
300-800ms: React hydration + Sidebar
800-1500ms: MessageList (lazy loaded)
1500ms+:   Features secundarios (búsqueda, exportación)
```

### Código Splitting

```typescript
// frontend/src/App.tsx
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

// Carga inmediata
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';

// Lazy loading
const MessageList = lazy(() => import('./components/MessageList'));
const SearchPanel = lazy(() => import('./components/SearchPanel'));
const ExportDialog = lazy(() => import('./components/ExportDialog'));

function App() {
  return (
    <ServiceProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={
            <Suspense fallback={<MessageSkeleton />}>
              <MessageList />
            </Suspense>
          } />
          <Route path="/search" element={
            <Suspense fallback={<SearchSkeleton />}>
              <SearchPanel />
            </Suspense>
          } />
        </Route>
      </Routes>
    </ServiceProvider>
  );
}
```

### Prefetch Inteligente

```typescript
// frontend/src/hooks/usePrefetch.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function usePrefetch() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Prefetch conversaciones mientras el usuario está en la lista de mensajes
    const timer = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: ['conversations'],
        queryFn: () => fetchConversations()
      });
    }, 2000); // Esperar 2s después de carga inicial

    return () => clearTimeout(timer);
  }, [queryClient]);
}
```

---

## 📊 Roadmap de Implementación (Actualizado)

| Sprint | Objetivo | Duración | Bundle Size | Dependencias |
|--------|----------|----------|-------------|--------------|
| **Sprint 2** | Protección y Seguridad | 12-16h | N/A | Sprint 1.5 |
| **Sprint 3** | Frontend PWA v1 (Core) | 16-20h | ~80KB | Sprint 2 |
| **Sprint 4** | Content Enrichment | 6-8h | ~95KB | Sprint 3 |
| **Sprint 5** | Conversation Layers | 8-10h | ~110KB | Sprint 4 |
| **Sprint 6** | Hooks & Plugins | 10-12h | ~120KB | Sprint 5 |
| **Sprint 7** | Capacitor Integration (Opcional) | 8-10h | ~125KB | Sprint 6 |

---

## 🎯 Métricas de Performance Objetivo

### Core Web Vitals

```
First Contentful Paint (FCP):     <800ms   ✅
Largest Contentful Paint (LCP):   <2.5s    ✅
Time to Interactive (TTI):        <2s      ✅
First Input Delay (FID):          <100ms   ✅
Cumulative Layout Shift (CLS):    <0.1     ✅
```

### Bundle Metrics

```
Initial Bundle (gzipped):         <80KB    ✅
Full Bundle (all lazy loaded):   <120KB   ✅
Critical CSS (inline):            <10KB    ✅
```

### Testing Strategy

**Dispositivos objetivo**:
- Android gama media (4GB RAM, Snapdragon 660)
- iPhone 11 (referencia iOS)
- Desktop (Chrome, Firefox, Safari)

**Condiciones de red**:
- Fast 3G (1.5 Mbps down, 750 Kbps up)
- 4G (4 Mbps down, 3 Mbps up)

**CPU throttling**:
- 4x slowdown (simular dispositivos low-end)

---

## 🔑 Conclusiones Clave

### ✅ Stack Final Validado

```
React 18 + TypeScript + Vite
Zustand (UI) + TanStack Query (server)
Tailwind CSS + shadcn/ui
@tanstack/react-virtual
MiniSearch
React Router
Workbox (service worker)
```

**Bundle total**: ~127KB gzipped
**Target realista**: <120KB (con code splitting)

### ✅ Decisiones Arquitectónicas

1. **Inyección de dependencias**: ServiceContainer (backend) + React Context (frontend)
2. **Plugin registry**: Central, descubrible, habilitación dinámica
3. **Design system**: CSS Variables + Tailwind + CVA para variantes
4. **Medios**: Formatos múltiples con fallbacks (AVIF/WebP/JPEG, Opus/AAC/MP3)
5. **Capacitor**: Postergar a Sprint 6-7 tras validación de PWA

### ⚠️ Trade-offs Aceptados

| Decisión | Trade-off | Por qué vale la pena |
|----------|-----------|----------------------|
| React vs Preact | +38KB | Ecosistema maduro, mejor DX |
| TanStack Query | +13KB | Evita ~200 líneas de código custom |
| shadcn/ui | Setup inicial | 0KB bundle, 100% customizable |
| Múltiples formatos media | +30% storage | Compatibilidad universal |

### 🎯 Próximos Pasos Inmediatos

1. **Sprint 2**: Implementar protección (rate limiting, validación, autenticación)
2. **Sprint 3**: Setup frontend (Vite + React + Tailwind + shadcn/ui)
3. **Sprint 3**: Implementar componentes core (MessageCard, Composer, Sidebar)
4. **Sprint 3**: Integrar con backend (REST API + WebSocket)
5. **Sprint 4**: Content enrichment (multimedia processing)
6. **Sprint 5**: Conversation layers (comentarios, reacciones)
7. **Sprint 6**: Hooks & plugins system
8. **Sprint 7**: Evaluación de Capacitor según feedback

---

## 📚 Referencias

### Documentación
- [React 18 Documentation](https://react.dev/)
- [Vite Guide](https://vitejs.dev/guide/)
- [TanStack Query](https://tanstack.com/query/latest)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Class Variance Authority](https://cva.style/docs)
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor Community Plugins](https://github.com/capacitor-community)

### Arquitectura Interna
- [MessageEnvelopeV2 Spec](../packages/shared/src/types/MessageEnvelopeV2.ts)
- [MessageCore Implementation](../apps/api-gateway/src/core/MessageCore.ts)
- [Service Interfaces](../apps/api-gateway/src/core/interfaces/)

### Performance
- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Bundle Size Analyzer](https://bundlephobia.com/)

---

**Estado**: ✅ Estrategia validada y documentada (v2.0)
**Siguiente acción**: Iniciar Sprint 2 (Protección y Seguridad)
**Commit**: Documentación completa lista para implementación
