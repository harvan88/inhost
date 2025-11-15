import { Elysia } from 'elysia';

/**
 * Niveles de log
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * Estructura de log estándar
 */
interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  context?: Record<string, unknown>;
  duration?: number;
}

/**
 * Logger estructurado
 */
export class Logger {
  private context: Record<string, unknown> = {};

  constructor(defaultContext?: Record<string, unknown>) {
    this.context = defaultContext || {};
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      message,
      context: { ...this.context, ...context }
    };

    // Formatear según el nivel
    const emoji = {
      [LogLevel.DEBUG]: '🔍',
      [LogLevel.INFO]: 'ℹ️',
      [LogLevel.WARN]: '⚠️',
      [LogLevel.ERROR]: '🔴'
    }[level];

    const formatted = `${emoji} [${entry.level}] ${entry.message}`;

    // En desarrollo, mostrar contexto si existe
    if (process.env.NODE_ENV === 'development' && entry.context && Object.keys(entry.context).length > 0) {
      console.log(formatted, entry.context);
    } else {
      console.log(formatted);
    }

    // TODO: En producción, enviar a servicio de logging externo
    // (DataDog, LogDNA, CloudWatch, etc.)
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, unknown>) {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Crea un logger hijo con contexto adicional
   */
  child(additionalContext: Record<string, unknown>): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }
}

/**
 * Instancia global del logger
 */
export const logger = new Logger({ service: 'api-gateway' });

/**
 * Middleware de logging HTTP
 *
 * Registra todas las peticiones HTTP con tiempos de respuesta
 */
export const httpLogger = new Elysia()
  .derive(({ request }) => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    return {
      logger: logger.child({ requestId }),
      requestId,
      startTime
    };
  })
  .onBeforeHandle(({ logger, request, requestId }) => {
    logger.info(`Incoming request`, {
      method: request.method,
      url: request.url,
      requestId
    });
  })
  .onAfterHandle(({ logger, request, startTime }) => {
    const duration = Date.now() - startTime;

    logger.info(`Request completed`, {
      method: request.method,
      url: request.url,
      duration: `${duration}ms`
    });
  })
  .onError(({ logger, error, request }) => {
    const err = error as any;
    logger?.error(`Request failed`, {
      method: request.method,
      url: request.url,
      error: err.message || 'Unknown error',
      stack: err.stack
    });
  });
