import { Elysia } from 'elysia';

/**
 * Formato estándar de error según plan arquitectónico
 */
export interface StandardErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
  };
}

/**
 * Códigos de error estándar
 */
export const ErrorCodes = {
  // Errores de validación (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Errores de autenticación (401)
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Errores de autorización (403)
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Errores de recursos (404)
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',

  // Errores de servidor (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Errores de negocio
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
} as const;

/**
 * Clase base para errores de aplicación
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON(): StandardErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Middleware de manejo de errores global
 *
 * Intercepta todos los errores y los formatea según el estándar
 */
export const errorHandler = new Elysia()
  .onError(({ code, error, set }) => {
    // Convertir error a tipo seguro
    const err = error as Error;

    console.error('🔴 Error handled:', {
      code,
      message: err?.message || 'Unknown error',
      stack: err?.stack
    });

    // Asegurar que siempre retornamos JSON
    set.headers['Content-Type'] = 'application/json';

    // Si es un AppError, usar su formato
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return error.toJSON();
    }

    // Manejo específico según el código de Elysia
    switch (code) {
      case 'VALIDATION':
        set.status = 400;
        return {
          success: false,
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Validation failed',
            details: err?.message,
            timestamp: new Date().toISOString()
          }
        } as StandardErrorResponse;

      case 'NOT_FOUND':
        set.status = 404;
        return {
          success: false,
          error: {
            code: ErrorCodes.NOT_FOUND,
            message: 'Route not found',
            timestamp: new Date().toISOString()
          }
        } as StandardErrorResponse;

      case 'PARSE':
        set.status = 400;
        return {
          success: false,
          error: {
            code: ErrorCodes.INVALID_INPUT,
            message: 'Invalid request format',
            details: err?.message,
            timestamp: new Date().toISOString()
          }
        } as StandardErrorResponse;

      default:
        // Error genérico de servidor
        set.status = 500;
        return {
          success: false,
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err?.message : undefined,
            timestamp: new Date().toISOString()
          }
        } as StandardErrorResponse;
    }
  });

/**
 * Helper para crear errores específicos
 */
export const createError = {
  validation: (message: string, details?: unknown) =>
    new AppError(ErrorCodes.VALIDATION_ERROR, message, 400, details),

  unauthorized: (message: string = 'Unauthorized') =>
    new AppError(ErrorCodes.UNAUTHORIZED, message, 401),

  forbidden: (message: string = 'Forbidden') =>
    new AppError(ErrorCodes.FORBIDDEN, message, 403),

  notFound: (message: string = 'Resource not found') =>
    new AppError(ErrorCodes.NOT_FOUND, message, 404),

  database: (message: string, details?: unknown) =>
    new AppError(ErrorCodes.DATABASE_ERROR, message, 500, details),

  internal: (message: string, details?: unknown) =>
    new AppError(ErrorCodes.INTERNAL_ERROR, message, 500, details),

  business: (message: string, details?: unknown) =>
    new AppError(ErrorCodes.BUSINESS_RULE_VIOLATION, message, 400, details)
};
