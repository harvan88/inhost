/**
 * INHOST API Client - Ejemplo de Implementación Frontend
 *
 * Este archivo puede ser copiado directamente a tu proyecto frontend.
 *
 * INSTALACIÓN:
 * 1. Copiar este archivo a: frontend/src/api/inhost-client.ts
 * 2. Configurar variables de entorno en .env:
 *    VITE_API_URL=http://localhost:3000
 *    VITE_WS_URL=ws://localhost:3000
 * 3. Importar y usar: import { inhostClient } from '@/api/inhost-client'
 */

// ============================================
// CONFIGURACIÓN
// ============================================

const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  wsURL: import.meta.env.VITE_WS_URL || 'ws://localhost:3000',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
};

// ============================================
// TIPOS (Copiar desde api-contract.json)
// ============================================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
}

interface MessageEnvelope {
  id: string;
  conversationId: string;
  type: 'incoming' | 'outgoing' | 'system' | 'status';
  channel: 'web' | 'whatsapp' | 'telegram' | 'sms';
  content: {
    text: string;
    contentType: string;
  };
  metadata: {
    from: string;
    to: string;
    timestamp: string;
    extensionId?: string;
  };
  statusChain: Array<{
    status: 'received' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
    messageId: string;
  }>;
}

interface SendMessageResponse {
  clientMessage: {
    id: string;
    type: string;
    channel: string;
    text: string;
    persisted: boolean;
  };
  extensionResponses: Array<{
    extensionId: string;
    messageId: string;
    success: boolean;
    status: string;
    persisted: boolean;
  }>;
  processedCount: number;
  summary: {
    clientMessagePersisted: boolean;
    extensionResponsesSent: number;
    totalExtensions: number;
  };
}

interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp: string;
}

// ============================================
// ERRORES PERSONALIZADOS
// ============================================

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class RateLimitError extends ApiError {
  constructor(
    message: string,
    public retryAfter: number,
    public limit: number,
    public remaining: number,
    public resetAt: Date
  ) {
    super('RATE_LIMIT_EXCEEDED', message, { retryAfter, limit, remaining, resetAt });
    this.name = 'RateLimitError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public originalError: any) {
    super(message);
    this.name = 'NetworkError';
  }
}

// ============================================
// HTTP CLIENT
// ============================================

class InhostHttpClient {
  private baseURL: string;
  private headers: Record<string, string>;

  constructor() {
    this.baseURL = API_CONFIG.baseURL;
    this.headers = {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Establece el userId para rate limiting
   * Llamar después del login: inhostClient.setUserId('user-123')
   */
  setUserId(userId: string) {
    this.headers['X-User-Id'] = userId;
  }

  /**
   * Establece el token JWT (futuro)
   */
  setAuthToken(token: string) {
    this.headers['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Request genérico con manejo de errores
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers
        },
        signal: AbortSignal.timeout(API_CONFIG.timeout)
      });

      // Manejar rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        const limit = parseInt(response.headers.get('X-RateLimit-Limit') || '0', 10);
        const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0', 10);
        const resetTimestamp = parseInt(response.headers.get('X-RateLimit-Reset') || '0', 10);
        const resetAt = new Date(resetTimestamp * 1000);

        throw new RateLimitError(
          'Has excedido el límite de mensajes. Por favor espera.',
          retryAfter,
          limit,
          remaining,
          resetAt
        );
      }

      const data: ApiResponse<T> = await response.json();

      if (!data.success) {
        throw new ApiError(
          data.error?.code || 'UNKNOWN_ERROR',
          data.error?.message || 'Unknown error occurred',
          data.error?.details
        );
      }

      return data.data as T;

    } catch (error) {
      if (error instanceof RateLimitError || error instanceof ApiError) {
        throw error;
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError(
          'No se pudo conectar al servidor. Verifica tu conexión a internet.',
          error
        );
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new NetworkError(
          'La petición tardó demasiado. Por favor intenta de nuevo.',
          error
        );
      }

      throw new NetworkError('Error desconocido al comunicarse con el servidor', error);
    }
  }

  /**
   * GET /health - Verificar que el backend esté funcionando
   */
  async healthCheck() {
    return this.request<{
      status: string;
      database: string;
      timestamp: string;
      version: string;
    }>('/health');
  }

  /**
   * POST /simulate/client-message - Enviar mensaje desde el chat
   */
  async sendMessage(text: string): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>('/simulate/client-message', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'web',
        text
      })
    });
  }

  /**
   * GET /messages - Obtener últimos mensajes
   */
  async getMessages(limit: number = 20) {
    return this.request<{
      count: number;
      messages: Array<any>;
      storage: string;
    }>(`/messages?limit=${limit}`);
  }

  /**
   * POST /simulate/extension-toggle - Activar/desactivar bot
   */
  async toggleExtension(extensionId: 'echo' | 'ai' | 'crm') {
    return this.request<{
      extensionId: string;
      active: boolean;
    }>('/simulate/extension-toggle', {
      method: 'POST',
      body: JSON.stringify({ extensionId })
    });
  }

  /**
   * GET /simulate/status - Estado del sistema
   */
  async getSimulationStatus() {
    return this.request<{
      clients: Array<any>;
      extensions: Array<any>;
      stats: any;
    }>('/simulate/status');
  }
}

// ============================================
// WEBSOCKET CLIENT
// ============================================

type WebSocketEventHandler = (message: WebSocketMessage) => void;

class InhostWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 2000;
  private handlers: Map<string, Set<WebSocketEventHandler>> = new Map();
  private isIntentionalClose = false;

  constructor() {
    this.url = `${API_CONFIG.wsURL}/realtime`;
  }

  /**
   * Conectar al WebSocket
   */
  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.warn('[INHOST WS] Already connected');
      return;
    }

    this.isIntentionalClose = false;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('[INHOST WS] ✅ Connected');
      this.reconnectAttempts = 0;
      this.emit('connect', { connected: true });
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('[INHOST WS] Failed to parse message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[INHOST WS] ❌ Error:', error);
      this.emit('error', { error });
    };

    this.ws.onclose = (event) => {
      console.log(`[INHOST WS] 🔌 Closed (code: ${event.code})`);
      this.emit('disconnect', { code: event.code, reason: event.reason });

      // Reconexión automática si no fue intencional
      if (!this.isIntentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
        console.log(`[INHOST WS] 🔄 Reconnecting in ${delay}ms...`);

        setTimeout(() => {
          this.reconnectAttempts++;
          this.connect();
        }, delay);
      }
    };
  }

  /**
   * Desconectar del WebSocket
   */
  disconnect() {
    this.isIntentionalClose = true;
    this.ws?.close();
    this.ws = null;
  }

  /**
   * Enviar mensaje al servidor (para envío directo vía WebSocket)
   */
  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[INHOST WS] Not connected, cannot send message');
    }
  }

  /**
   * Suscribirse a un tipo de evento
   */
  on(eventType: string, handler: WebSocketEventHandler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    // Retornar función para desuscribirse
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * Manejar mensaje recibido
   */
  private handleMessage(message: WebSocketMessage) {
    // Emitir evento específico por tipo
    this.emit(message.type, message);

    // Log para debugging
    console.log(`[INHOST WS] 📨 ${message.type}:`, message);
  }

  /**
   * Emitir evento a todos los suscriptores
   */
  private emit(eventType: string, data: any) {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[INHOST WS] Error in handler for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Estado de la conexión
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// ============================================
// CLIENTE UNIFICADO
// ============================================

class InhostClient {
  public http: InhostHttpClient;
  public ws: InhostWebSocketClient;

  constructor() {
    this.http = new InhostHttpClient();
    this.ws = new InhostWebSocketClient();
  }

  /**
   * Inicializar cliente (llamar al inicio de la app)
   */
  async init(userId?: string) {
    if (userId) {
      this.http.setUserId(userId);
    }

    // Conectar WebSocket
    this.ws.connect();

    // Health check
    try {
      const health = await this.http.healthCheck();
      console.log('[INHOST] ✅ Backend is healthy:', health);
      return true;
    } catch (error) {
      console.error('[INHOST] ❌ Backend health check failed:', error);
      return false;
    }
  }

  /**
   * Limpiar (llamar al desmontar la app)
   */
  cleanup() {
    this.ws.disconnect();
  }
}

// ============================================
// EXPORTAR SINGLETON
// ============================================

export const inhostClient = new InhostClient();

// ============================================
// EJEMPLOS DE USO
// ============================================

/*

// 1. INICIALIZAR AL INICIO DE LA APP
// ---------------------------------
// App.tsx o main.tsx

import { inhostClient } from './api/inhost-client';

useEffect(() => {
  // Inicializar con userId (opcional)
  inhostClient.init('user-123');

  // Limpiar al desmontar
  return () => {
    inhostClient.cleanup();
  };
}, []);


// 2. ENVIAR MENSAJE
// ---------------------------------
// ChatInput.tsx

import { inhostClient, RateLimitError, NetworkError } from './api/inhost-client';

async function handleSend(text: string) {
  try {
    const response = await inhostClient.http.sendMessage(text);
    console.log('Message sent:', response);

    // Actualizar UI con mensaje enviado
    addMessage({
      id: response.clientMessage.id,
      text: response.clientMessage.text,
      status: 'received',
      persisted: true
    });

  } catch (error) {
    if (error instanceof RateLimitError) {
      showError(
        `Demasiados mensajes. Espera ${error.retryAfter} segundos.`,
        { type: 'warning', duration: error.retryAfter * 1000 }
      );
    } else if (error instanceof NetworkError) {
      showError('Error de conexión. Verifica tu internet.');
    } else {
      showError('Error al enviar mensaje. Intenta de nuevo.');
    }
  }
}


// 3. ESCUCHAR NOTIFICACIONES WEBSOCKET
// ---------------------------------
// useWebSocketMessages.ts hook

import { inhostClient } from './api/inhost-client';

export function useWebSocketMessages() {
  useEffect(() => {
    // Escuchar nuevos mensajes
    const unsubscribe = inhostClient.ws.on('message:new', (data) => {
      const envelope = data.data;

      if (envelope.type === 'incoming') {
        // Mensaje del usuario
        addUserMessage(envelope);
      } else if (envelope.type === 'outgoing') {
        // Respuesta de bot
        addBotMessage(envelope);
      }
    });

    // Escuchar cambios de estado
    const unsubscribeStatus = inhostClient.ws.on('message:status', (data) => {
      updateMessageStatus(data.data.messageId, data.data.status);
    });

    // Escuchar typing indicator
    const unsubscribeTyping = inhostClient.ws.on('typing:indicator', (data) => {
      if (data.data.isTyping) {
        showTypingIndicator(data.data.userId);
      } else {
        hideTypingIndicator(data.data.userId);
      }
    });

    // Limpiar suscripciones
    return () => {
      unsubscribe();
      unsubscribeStatus();
      unsubscribeTyping();
    };
  }, []);
}


// 4. ACTIVAR/DESACTIVAR BOTS
// ---------------------------------
// SettingsPanel.tsx

import { inhostClient } from './api/inhost-client';

async function toggleBot(botId: 'echo' | 'ai' | 'crm') {
  try {
    const result = await inhostClient.http.toggleExtension(botId);
    console.log(`Bot ${botId} is now ${result.active ? 'active' : 'inactive'}`);

    // Actualizar UI
    setBotStatus(botId, result.active);
  } catch (error) {
    showError(`Error toggling bot: ${error.message}`);
  }
}


// 5. CARGAR HISTORIAL
// ---------------------------------
// MessageList.tsx

import { inhostClient } from './api/inhost-client';

async function loadHistory() {
  try {
    const { messages } = await inhostClient.http.getMessages(50);
    setMessages(messages);
  } catch (error) {
    showError('Error loading messages');
  }
}


// 6. HEALTH CHECK PERIÓDICO
// ---------------------------------
// useBackendStatus.ts hook

import { inhostClient } from './api/inhost-client';

export function useBackendStatus() {
  const [status, setStatus] = useState<'online' | 'offline'>('offline');

  useEffect(() => {
    // Check inicial
    checkHealth();

    // Check cada 30 segundos
    const interval = setInterval(checkHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  async function checkHealth() {
    try {
      await inhostClient.http.healthCheck();
      setStatus('online');
    } catch (error) {
      setStatus('offline');
    }
  }

  return status;
}

*/
