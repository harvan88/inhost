/**
 * Observability Logger
 *
 * Sistema centralizado de logging para debugging y observabilidad.
 * Los logs se guardan en tests/logs/ para análisis posterior.
 *
 * Uso:
 *   import { observeLog } from './utils/observability-logger';
 *   observeLog.adapter('Mensaje recibido', { from: '+123' });
 *   observeLog.core('Procesando mensaje', { id: 'abc' });
 */

import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

// Tipos de componentes
export type LogComponent =
  | 'adapter'
  | 'core'
  | 'persistence'
  | 'websocket'
  | 'http'
  | 'test';

// Nivel de log
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  component: LogComponent;
  level: LogLevel;
  message: string;
  data?: any;
}

class ObservabilityLogger {
  private enabled: boolean;
  private logDir: string;
  private sessionId: string;

  constructor() {
    // Activar con env variable OBSERVE=true o NODE_ENV=test
    this.enabled =
      process.env.OBSERVE === 'true' ||
      process.env.NODE_ENV === 'test' ||
      process.env.LOG_LEVEL === 'debug';

    // Directorio de logs
    this.logDir = join(process.cwd(), 'tests', 'logs');

    // Session ID para identificar esta ejecución
    this.sessionId = new Date().toISOString().replace(/[:.]/g, '-');

    // Crear directorio si no existe
    if (this.enabled) {
      this.ensureLogDir();
    }
  }

  private ensureLogDir() {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatMessage(component: LogComponent, level: LogLevel, message: string, data?: any): string {
    const emoji = this.getEmoji(component, level);
    const componentTag = `[${component.toUpperCase()}]`;

    let formatted = `${emoji} ${componentTag} ${message}`;

    if (data) {
      formatted += '\n' + JSON.stringify(data, null, 2);
    }

    return formatted;
  }

  private getEmoji(component: LogComponent, level: LogLevel): string {
    if (level === 'error') return '❌';
    if (level === 'warn') return '⚠️';

    const emojiMap: Record<LogComponent, string> = {
      adapter: '📱',
      core: '📦',
      persistence: '💾',
      websocket: '📡',
      http: '🌐',
      test: '🧪'
    };

    return emojiMap[component] || '📝';
  }

  private log(component: LogComponent, level: LogLevel, message: string, data?: any) {
    if (!this.enabled) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      component,
      level,
      message,
      data
    };

    // Console output (siempre en color)
    const formatted = this.formatMessage(component, level, message, data);

    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }

    // File output (JSON para análisis)
    try {
      const logFile = join(this.logDir, `session-${this.sessionId}.log`);
      const jsonLine = JSON.stringify(entry) + '\n';
      appendFileSync(logFile, jsonLine, 'utf8');
    } catch (error) {
      console.error('Failed to write log file:', error);
    }
  }

  // Métodos por componente

  adapter(message: string, data?: any) {
    this.log('adapter', 'info', message, data);
  }

  adapterDebug(message: string, data?: any) {
    this.log('adapter', 'debug', message, data);
  }

  adapterError(message: string, data?: any) {
    this.log('adapter', 'error', message, data);
  }

  core(message: string, data?: any) {
    this.log('core', 'info', message, data);
  }

  coreDebug(message: string, data?: any) {
    this.log('core', 'debug', message, data);
  }

  coreError(message: string, data?: any) {
    this.log('core', 'error', message, data);
  }

  persistence(message: string, data?: any) {
    this.log('persistence', 'info', message, data);
  }

  persistenceDebug(message: string, data?: any) {
    this.log('persistence', 'debug', message, data);
  }

  persistenceError(message: string, data?: any) {
    this.log('persistence', 'error', message, data);
  }

  websocket(message: string, data?: any) {
    this.log('websocket', 'info', message, data);
  }

  websocketDebug(message: string, data?: any) {
    this.log('websocket', 'debug', message, data);
  }

  websocketError(message: string, data?: any) {
    this.log('websocket', 'error', message, data);
  }

  http(message: string, data?: any) {
    this.log('http', 'info', message, data);
  }

  httpDebug(message: string, data?: any) {
    this.log('http', 'debug', message, data);
  }

  httpError(message: string, data?: any) {
    this.log('http', 'error', message, data);
  }

  test(message: string, data?: any) {
    this.log('test', 'info', message, data);
  }

  testError(message: string, data?: any) {
    this.log('test', 'error', message, data);
  }

  // Helpers para secciones visuales

  separator(title?: string) {
    if (!this.enabled) return;

    console.log('');
    console.log('═'.repeat(60));
    if (title) {
      console.log(title);
      console.log('═'.repeat(60));
    }
  }

  step(stepNumber: number, description: string) {
    if (!this.enabled) return;

    console.log('');
    console.log(`${'─'.repeat(60)}`);
    console.log(`PASO ${stepNumber}: ${description}`);
    console.log(`${'─'.repeat(60)}`);
  }

  success(message: string) {
    if (!this.enabled) return;
    console.log(`✅ ${message}`);
  }

  error(message: string) {
    if (!this.enabled) return;
    console.error(`❌ ${message}`);
  }

  // Obtener path del log actual
  getLogPath(): string | null {
    if (!this.enabled) return null;
    return join(this.logDir, `session-${this.sessionId}.log`);
  }

  // Estado
  isEnabled(): boolean {
    return this.enabled;
  }

  // Enable/disable dinámicamente
  enable() {
    this.enabled = true;
    this.ensureLogDir();
  }

  disable() {
    this.enabled = false;
  }
}

// Export singleton
export const observeLog = new ObservabilityLogger();

// También exportar la clase por si alguien necesita múltiples instancias
export { ObservabilityLogger };
