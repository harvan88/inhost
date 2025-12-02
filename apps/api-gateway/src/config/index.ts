/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "C:\Users\harva\Documents\Trabajos\meetgar\FluxCoreChat\inhost-backend\apps\api-gateway\src\config\index.ts"
 *   type: "utility"
 *   layer: "backend"
 *   domain: "api"
 *   purpose: "Barrel export for config module"
 *
 * DEPENDENCIES:
 *   internal: []
 *   external: []
 *   infrastructure: []
 *
 * CONTRACTS:
 *   exports: ["AppConfig","config"]
 *   inputs: "AppConfig"
 *   outputs: "AppConfig"
 *   errors: "Error"
 *
 * INTEGRATION:
 *   data_flow: "WebSocket → Handler → Store → UI"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: "To be determined via dependency analysis"
 *   uses: []
 *   critical: true
 *
 * === DOC_END :: index.ts ===
 */

/**
 * Configuración centralizada del API Gateway
 *
 * Todas las variables de entorno y configuraciones del sistema
 * deben estar centralizadas aquí para facilitar el mantenimiento.
 */

export interface AppConfig {
  app: {
    name: string;
    version: string;
    env: 'development' | 'production' | 'test';
    port: number;
  };
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  auth: {
    jwtSecret: string;
    jwtExpiration: string;
  };
  features: {
    enableWebSocket: boolean;
    enableRateLimiting: boolean;
    enableCors: boolean;
  };
  limits: {
    maxMessageLength: number;
    rateLimit: {
      windowMs: number;
      maxRequests: number;
    };
  };
}

/**
 * Carga y valida la configuración desde variables de entorno
 */
function loadConfig(): AppConfig {
  return {
    app: {
      name: 'Inhost API Gateway',
      version: '1.0.0',
      env: (process.env.NODE_ENV as AppConfig['app']['env']) || 'development',
      port: parseInt(process.env.PORT || '3000', 10)
    },
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'inhost_user',
      password: process.env.DB_PASSWORD || 'inhost_password',
      database: process.env.DB_NAME || 'inhost'
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      jwtExpiration: process.env.JWT_EXPIRATION || '24h'
    },
    features: {
      enableWebSocket: process.env.ENABLE_WEBSOCKET !== 'false',
      enableRateLimiting: process.env.ENABLE_RATE_LIMITING === 'true',
      enableCors: process.env.ENABLE_CORS !== 'false'
    },
    limits: {
      maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH || '10000', 10),
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
      }
    }
  };
}

/**
 * Valida que la configuración sea correcta
 */
function validateConfig(config: AppConfig): void {
  // Validaciones críticas
  if (config.app.env === 'production' && config.auth.jwtSecret === 'dev-secret-change-in-production') {
    throw new Error('JWT_SECRET must be set in production environment');
  }

  if (config.app.port < 1 || config.app.port > 65535) {
    throw new Error(`Invalid port number: ${config.app.port}`);
  }

  // Agregar más validaciones según sea necesario
}

// Cargar y exportar configuración
export const config = loadConfig();

// Validar en tiempo de inicio
validateConfig(config);

// Log de configuración en desarrollo
if (config.app.env === 'development') {
  console.log('📋 Configuration loaded:', {
    env: config.app.env,
    port: config.app.port,
    database: `${config.database.host}:${config.database.port}`,
    redis: `${config.redis.host}:${config.redis.port}`
  });
}
