/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "packages/shared/src/types/message-envelope.ts"
 *   type: "type"
 *   layer: "shared"
 *   domain: "messaging"
 *   purpose: "Contrato central que define MessageEnvelopeV2 y tipos relacionados: el formato universal de mensajes usado por frontend y backend, establece el contrato de comunicación"
 *
 * DEPENDENCIES:
 *   internal: []
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["MessageEnvelopeV2", "MessageType", "MessageChannel", "MessageStatus", "MessageContent", "MessageMetadata", "MessageStatusEvent", "MessageContext"]
 *   inputs: []
 *   outputs: []
 *   errors: []
 *
 * INTEGRATION:
 *   data_flow: "[Type definitions] ← [Backend: MessageCore, persistence, services] & [Frontend: store, WebSocketProvider, components]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["MessageCore", "IPersistenceService", "MemoryPersistence", "frontend:types/index.ts", "frontend:WebSocketProvider", "frontend:store"]
 *   uses: []
 *   critical: true
 *
 * === DOC_END :: message-envelope.ts ===
 */

export enum MessageType {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing', 
  SYSTEM = 'system',
  STATUS = 'status'
}

export enum MessageChannel {
  WHATSAPP = 'whatsapp',
  TELEGRAM = 'telegram',
  WEB = 'web',
  SMS = 'sms'
}

export enum MessageStatus {
  RECEIVED = 'received',
  PROCESSING = 'processing',
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

export interface MessageContent {
  text?: string;
  media?: {
    url: string;
    type: 'image' | 'video' | 'audio' | 'document';
    caption?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  buttons?: Array<{
    id: string;
    text: string;
    type: 'reply' | 'url';
  }>;
}

export interface MessageMetadata {
  from: string;
  to: string;
  timestamp: string;
  messageId?: string;
  conversationId?: string;
  ownerId?: string;
  platformMessageId?: string;
}

export interface MessageStatusEvent {
  status: MessageStatus;
  timestamp: string;
  messageId: string;
  details?: string;
}

export interface MessageContext {
  sessionId?: string;
  deviceId?: string;
  userAgent?: string;
  ipAddress?: string;
  plan: 'free' | 'premium';
}

export interface MessageEnvelopeV2 {
  id: string;
  type: MessageType;
  channel: MessageChannel;
  content: MessageContent;
  metadata: MessageMetadata;
  statusChain: MessageStatusEvent[];
  context: MessageContext;
}