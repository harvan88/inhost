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