# Frontend Strategy - Inhost Chat Extensibility

**Fecha**: 2025-11-15
**Sprint**: Post-1.5 (Preparación para Frontend Avanzado)
**Estado**: Estrategia validada - Implementación pendiente

---

## 🎯 Objetivo

Crear un frontend de chat **altamente extensible y reutilizable** que:

1. Soporte **mensajes multimedia** (audio, imágenes, video, documentos)
2. Permita **comentarios y reacciones** en mensajes de IA
3. Ofrezca **usabilidad avanzada** (búsqueda, filtros, exportación)
4. Implemente **sistema de plugins/hooks** para extensibilidad
5. Mantenga **contratos estables** (sin romper MessageCore ni interfaces)
6. Sea **reutilizable** en múltiples plataformas (PWA web, Android, PC)

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

**Fase 1: PWA Web Pura** (Sprint actual)
- Chat funcional en navegador
- MediaRecorder para audio
- IndexedDB para caché

**Fase 2: PWA + Capacitor (Opcional)**
- Añadir `@capacitor/core`
- Detectar plataforma y usar APIs nativas cuando estén disponibles
- Fallback a Web APIs si no hay Capacitor

**Fase 3: Apps Nativas (Futuro)**
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

**Recomendación**: **Postergar a Sprint 3-4**

**Razones**:
1. **Sprint 2**: Enfocarse en seguridad y protección (rate limiting, validación, autenticación)
2. **Sprint 3**: Implementar frontend básico con PWA web pura
3. **Sprint 4**: Evaluar necesidad real de capacidades nativas según feedback de usuarios

**Ventajas de postergar**:
- No añadir complejidad prematura
- Validar UX con PWA web primero
- Decisión informada basada en métricas reales

**Ventajas de añadir ahora**:
- Arquitectura desde el inicio preparada para mobile
- Testear en dispositivos reales desde Sprint 3
- Posibilidad de lanzar en stores más rápido

---

## 🏗️ Arquitectura Frontend Propuesta

```
frontend/
├── src/
│   ├── components/
│   │   ├── MessageCard/
│   │   │   ├── MessageCard.tsx
│   │   │   ├── MessageContent.tsx
│   │   │   ├── MediaPreview.tsx         # Audio, image, video
│   │   │   ├── CommentSection.tsx       # Comentarios
│   │   │   └── ReactionBar.tsx          # Reacciones
│   │   ├── Composer/
│   │   │   ├── TextComposer.tsx
│   │   │   ├── MediaComposer.tsx        # Upload audio/image
│   │   │   └── VoiceRecorder.tsx        # Grabación de audio
│   │   └── Sidebar/
│   │       ├── ConversationList.tsx
│   │       ├── SearchBar.tsx
│   │       └── FilterPanel.tsx
│   ├── services/
│   │   ├── api/
│   │   │   ├── MessageAPI.ts            # REST: GET/POST /messages
│   │   │   ├── WebSocketAPI.ts          # WS: /realtime
│   │   │   └── MediaAPI.ts              # Upload media
│   │   ├── platform/
│   │   │   ├── IPlatformService.ts
│   │   │   ├── WebPlatform.ts
│   │   │   └── CapacitorPlatform.ts     # (Futuro)
│   │   └── storage/
│   │       ├── IndexedDBStore.ts        # Caché local
│   │       └── SQLiteStore.ts           # (Capacitor)
│   ├── hooks/
│   │   ├── useMessages.ts               # Estado de mensajes
│   │   ├── useComments.ts               # Comentarios
│   │   ├── useReactions.ts              # Reacciones
│   │   └── useMediaUpload.ts            # Upload multimedia
│   └── state/
│       ├── messagesSlice.ts             # Redux/Zustand
│       ├── conversationsSlice.ts
│       └── uiSlice.ts
```

---

## 🎨 UX/UI Avanzada: Features Clave

### 1. **Búsqueda Full-Text**

```typescript
// Frontend: hooks/useSearch.ts
export function useSearch() {
  const [query, setQuery] = useState('');
  const messages = useSelector(selectMessages);

  const results = useMemo(() => {
    if (!query) return messages;

    return messages.filter(msg => {
      // Buscar en texto
      if (msg.content.text?.toLowerCase().includes(query.toLowerCase())) {
        return true;
      }

      // Buscar en transcripciones de audio
      if (msg.content.media?.metadata?.transcription?.toLowerCase().includes(query.toLowerCase())) {
        return true;
      }

      // Buscar en OCR de imágenes
      if (msg.content.media?.metadata?.ocrText?.toLowerCase().includes(query.toLowerCase())) {
        return true;
      }

      // Buscar en comentarios
      const comments = msg.metadata.customData?.comments as Comment[] || [];
      if (comments.some(c => c.text.toLowerCase().includes(query.toLowerCase()))) {
        return true;
      }

      return false;
    });
  }, [query, messages]);

  return { query, setQuery, results };
}
```

### 2. **Filtros Avanzados**

```typescript
// Frontend: components/FilterPanel.tsx
interface Filters {
  channels: MessageChannel[];
  types: MessageType[];
  dateRange: { start: Date; end: Date };
  hasMedia: boolean;
  hasComments: boolean;
  tags: string[];
  favorites: boolean;
}

export function FilterPanel() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);

  return (
    <aside className="filter-panel">
      <h3>Filtros</h3>

      <FilterSection title="Canales">
        <Checkbox label="WhatsApp" value={MessageChannel.WHATSAPP} />
        <Checkbox label="Telegram" value={MessageChannel.TELEGRAM} />
        <Checkbox label="SMS" value={MessageChannel.SMS} />
      </FilterSection>

      <FilterSection title="Multimedia">
        <Toggle label="Solo con imágenes" onChange={setHasImages} />
        <Toggle label="Solo con audio" onChange={setHasAudio} />
      </FilterSection>

      <FilterSection title="Interacciones">
        <Toggle label="Con comentarios" onChange={setHasComments} />
        <Toggle label="Favoritos" onChange={setFavorites} />
      </FilterSection>

      <FilterSection title="Fecha">
        <DateRangePicker onChange={setDateRange} />
      </FilterSection>
    </aside>
  );
}
```

### 3. **Exportación de Conversaciones**

```typescript
// Frontend: services/export/ConversationExporter.ts
export class ConversationExporter {
  async exportAsJSON(conversationId: string): Promise<Blob> {
    const messages = await getConversationMessages(conversationId);
    const comments = await getConversationComments(conversationId);

    const data = {
      conversation: conversationId,
      exportedAt: new Date().toISOString(),
      messages: messages.map(msg => ({
        ...msg,
        comments: comments.filter(c => c.messageId === msg.id)
      }))
    };

    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  }

  async exportAsPDF(conversationId: string): Promise<Blob> {
    // V2: Usar jsPDF o similar
    // Renderizar mensajes, imágenes, comentarios en PDF
  }

  async exportAsHTML(conversationId: string): Promise<Blob> {
    // V1: Generar HTML estático con estilos embebidos
    const messages = await getConversationMessages(conversationId);
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Conversación ${conversationId}</title></head>
        <body>
          ${messages.map(msg => `<div class="message">...</div>`).join('')}
        </body>
      </html>
    `;

    return new Blob([html], { type: 'text/html' });
  }
}
```

---

## 📊 Roadmap de Implementación

| Sprint | Objetivo | Duración | Contratos Rotos | Dependencias |
|--------|----------|----------|-----------------|--------------|
| **Sprint 2** | Protección y Seguridad | 12-16h | ❌ Ninguno | Sprint 1.5 |
| **Sprint 3** | Content Enrichment (Phase 1) | 6-8h | ❌ Ninguno | Sprint 2 |
| **Sprint 4** | Conversation Layers (Phase 2) | 8-10h | ❌ Ninguno | Sprint 3 |
| **Sprint 5** | Hooks & Plugins (Phase 3) | 10-12h | ❌ Ninguno | Sprint 4 |
| **Sprint 6** | Frontend PWA v1 | 16-20h | ❌ Ninguno | Sprint 5 |
| **Sprint 7** | Capacitor Integration (Opcional) | 8-10h | ❌ Ninguno | Sprint 6 |

---

## 🔑 Conclusiones Clave

### ✅ Lo que SÍ funciona (validado)

1. **MessageEnvelopeV2 ya está preparado** para multimedia
2. **MessageCore NO necesita cambios** (servicios opcionales)
3. **Capas de conversación** (comentarios, reacciones) se almacenan separadamente
4. **Hooks permiten extensibilidad** sin modificar código core
5. **Capacitor puede añadirse progresivamente** sin reescribir frontend

### ⚠️ Decisiones Pendientes

1. **¿Capacitor en Sprint 7 o postergar?** → Depende de feedback de usuarios en Sprint 6
2. **¿Qué API usar para transcripción de audio?** → OpenAI Whisper vs Google Speech-to-Text
3. **¿Almacenar comentarios en PostgreSQL o servicio separado?** → V1: PostgreSQL, V2: Evaluar MongoDB

### 🎯 Próximos Pasos Inmediatos

1. **Sprint 2**: Implementar protección (rate limiting, validación, autenticación)
2. **Documentar arquitectura de frontend** (componentes, estado, APIs)
3. **Diseñar mockups de UX** (Figma/Sketch) para validar con stakeholders
4. **Evaluar librerías multimedia**: react-audio-recorder, react-dropzone, etc.

---

## 📚 Referencias

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor Community Plugins](https://github.com/capacitor-community)
- [MessageEnvelopeV2 Spec](../packages/shared/src/types/MessageEnvelopeV2.ts)
- [MessageCore Implementation](../apps/api-gateway/src/core/MessageCore.ts)
- [Service Interfaces](../apps/api-gateway/src/core/interfaces/)

---

**Estado**: ✅ Estrategia validada y documentada
**Siguiente acción**: Commit de este documento + Iniciar Sprint 2
