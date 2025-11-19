/**
 * Tipos y contratos de API
 *
 * Define la forma de todas las respuestas y peticiones de la API
 * según el plan arquitectónico.
 */

/**
 * Respuesta estándar exitosa
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  metadata?: {
    timestamp: string;
    requestId?: string;
    [key: string]: unknown;
  };
}

/**
 * Respuesta estándar de error
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
  };
}

/**
 * Tipo de respuesta genérica
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Helper para crear respuestas exitosas
 */
export function createSuccessResponse<T>(
  data: T,
  metadata?: Record<string, unknown>
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata
    }
  };
}

/**
 * Helper para crear respuestas de error
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * DTOs de Mensajes
 */
export namespace MessageDTO {
  /**
   * Request para crear un mensaje
   */
  export interface CreateRequest {
    type: 'incoming' | 'outgoing' | 'system' | 'status';
    channel: 'whatsapp' | 'telegram' | 'web' | 'sms';
    content: {
      text: string;
    };
    metadata: {
      from: string;
      to: string;
      timestamp: string;
    };
    conversationId?: string;
  }

  /**
   * Response al crear un mensaje
   */
  export interface CreateResponse {
    status: 'received' | 'error';
    messageId?: string;
    timestamp: string;
    storage: 'postgresql' | 'redis';
    error?: string;
  }

  /**
   * Response al listar mensajes
   */
  export interface ListResponse {
    count: number;
    messages: Array<{
      id: string;
      type: string;
      channel: string;
      content: unknown;
      metadata: unknown;
      createdAt: Date;
    }>;
    storage: 'postgresql' | 'redis';
  }
}

/**
 * DTOs de Health
 */
export namespace HealthDTO {
  /**
   * Response de health check
   */
  export interface Response {
    status: 'healthy' | 'unhealthy';
    database: 'postgresql' | 'disconnected';
    timestamp: string;
    error?: string;
    version?: string;
  }

  /**
   * Response detallada de health
   */
  export interface DetailedResponse {
    name: string;
    version: string;
    status: 'running' | 'degraded' | 'down';
    timestamp: string;
    services: {
      database: {
        status: 'up' | 'down';
        responseTime?: number;
      };
      redis?: {
        status: 'up' | 'down';
        responseTime?: number;
      };
    };
  }
}

/**
 * DTOs de WebSocket
 */
export namespace WebSocketDTO {
  /**
   * Mensaje de conexión
   */
  export interface ConnectionMessage {
    type: 'connection';
    status: 'connected' | 'disconnected';
    timestamp: string;
    clientId?: string;
  }

  /**
   * Mensaje de echo
   */
  export interface EchoMessage {
    type: 'echo';
    data: unknown;
    timestamp: string;
  }

  /**
   * Mensaje de typing indicator
   */
  export interface TypingMessage {
    type: 'typing';
    conversationId: string;
    userId: string;
    isTyping: boolean;
    timestamp: string;
  }

  /**
   * Mensaje de nuevo mensaje
   */
  export interface NewMessageNotification {
    type: 'new_message';
    messageId: string;
    conversationId: string;
    preview: {
      from: string;
      text: string;
    };
    timestamp: string;
  }

  /**
   * Mensaje de actualización de estado
   */
  export interface StatusUpdateMessage {
    type: 'status_update';
    messageId: string;
    status: 'sent' | 'delivered' | 'read';
    timestamp: string;
  }

  /**
   * Tipo unión de todos los mensajes WebSocket
   */
  export type Message =
    | ConnectionMessage
    | EchoMessage
    | TypingMessage
    | NewMessageNotification
    | StatusUpdateMessage;
}
