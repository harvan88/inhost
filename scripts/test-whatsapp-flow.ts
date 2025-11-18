#!/usr/bin/env bun
/**
 * Test WhatsApp Flow - Simulación Completa
 *
 * Este script simula todo el flujo de un mensaje desde WhatsApp:
 * 1. Conecta al WebSocket /realtime
 * 2. Activa extensiones (echo, ai, crm)
 * 3. Envía mensaje de WhatsApp
 * 4. Escucha notificaciones en tiempo real
 * 5. Muestra estado de entrega
 *
 * Uso:
 *   bun scripts/test-whatsapp-flow.ts
 */

const API_BASE = 'http://localhost:3000';
const WS_BASE = 'ws://localhost:3000';

// Colores para logs
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(emoji: string, message: string, data?: any) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${emoji} ${message}`);
  if (data) {
    console.log(colors.dim + JSON.stringify(data, null, 2) + colors.reset);
  }
}

function logSuccess(message: string, data?: any) {
  log('✅', colors.green + message + colors.reset, data);
}

function logError(message: string, data?: any) {
  log('❌', colors.red + message + colors.reset, data);
}

function logInfo(message: string, data?: any) {
  log('ℹ️ ', colors.cyan + message + colors.reset, data);
}

function logWarning(message: string, data?: any) {
  log('⚠️ ', colors.yellow + message + colors.reset, data);
}

function logWebSocket(message: string, data?: any) {
  log('📡', colors.magenta + message + colors.reset, data);
}

function logMessage(message: string, data?: any) {
  log('💬', colors.blue + message + colors.reset, data);
}

// Estado del test
const testState = {
  wsConnected: false,
  clientId: '',
  messageSent: false,
  messageReceived: false,
  extensionResponses: [] as string[],
  notifications: [] as any[],
  errors: [] as string[]
};

// Conectar al WebSocket
async function connectWebSocket(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    logInfo('Conectando al WebSocket...');

    const ws = new WebSocket(`${WS_BASE}/realtime`);

    ws.onopen = () => {
      testState.wsConnected = true;
      logSuccess('WebSocket conectado exitosamente');
      resolve(ws);
    };

    ws.onerror = (error) => {
      logError('Error en WebSocket', error);
      testState.errors.push('WebSocket connection error');
      reject(error);
    };

    ws.onclose = (event) => {
      logWarning(`WebSocket cerrado (code: ${event.code}, reason: ${event.reason || 'none'})`);
      testState.wsConnected = false;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        testState.notifications.push(data);

        handleWebSocketMessage(data);
      } catch (error) {
        logError('Error parseando mensaje WebSocket', {
          raw: event.data,
          error: error instanceof Error ? error.message : 'Unknown'
        });
      }
    };

    // Timeout de conexión
    setTimeout(() => {
      if (!testState.wsConnected) {
        reject(new Error('WebSocket connection timeout'));
      }
    }, 5000);
  });
}

// Manejar mensajes del WebSocket
function handleWebSocketMessage(data: any) {
  switch (data.type) {
    case 'connection':
      logWebSocket('Conexión establecida', {
        status: data.status,
        clientId: data.clientId
      });
      testState.clientId = data.clientId || '';
      break;

    case 'echo':
      logWebSocket('Echo recibido', {
        timestamp: data.timestamp
      });
      break;

    case 'message:new':
      const envelope = data.data;
      logMessage(`Nuevo mensaje: ${envelope.type}`, {
        id: envelope.id,
        type: envelope.type,
        channel: envelope.channel,
        from: envelope.metadata.from,
        to: envelope.metadata.to,
        text: envelope.content.text?.substring(0, 50) + '...',
        status: envelope.statusChain?.[0]?.status,
        extensionId: envelope.metadata.extensionId
      });

      if (envelope.type === 'incoming') {
        testState.messageReceived = true;
      }

      if (envelope.type === 'outgoing' && envelope.metadata.extensionId) {
        testState.extensionResponses.push(envelope.metadata.extensionId);
      }
      break;

    case 'message:status':
      logWebSocket('Cambio de estado', {
        messageId: data.data.messageId,
        status: data.data.status,
        timestamp: data.data.timestamp
      });
      break;

    case 'typing:indicator':
      logWebSocket('Indicador de escritura', {
        userId: data.data.userId,
        isTyping: data.data.isTyping
      });
      break;

    case 'message_processing':
      logWebSocket('Procesamiento iniciado', {
        messageId: data.messageId,
        extensionCount: data.extensionCount
      });
      break;

    case 'extension_response':
      logWebSocket('Respuesta de extensión', {
        extensionId: data.extensionId,
        messageId: data.messageId,
        success: data.success
      });
      break;

    case 'client_toggle':
      logWebSocket('Cliente conectado/desconectado', {
        clientId: data.clientId,
        connected: data.connected
      });
      break;

    case 'extension_toggle':
      logWebSocket('Extensión activada/desactivada', {
        extensionId: data.extensionId,
        active: data.active
      });
      break;

    case 'error':
      logError('Error del servidor', {
        code: data.code,
        message: data.message,
        details: data.errors || data.details
      });
      testState.errors.push(`Server error: ${data.code}`);
      break;

    default:
      logWarning('Mensaje WebSocket desconocido', {
        type: data.type,
        data
      });
  }
}

// Activar una extensión
async function toggleExtension(extensionId: string): Promise<boolean> {
  try {
    logInfo(`Activando extensión: ${extensionId}`);

    const response = await fetch(`${API_BASE}/simulate/extension-toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extensionId })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.success) {
      logSuccess(`Extensión ${extensionId} → ${result.data.active ? 'ACTIVA' : 'INACTIVA'}`);
      return result.data.active;
    } else {
      throw new Error(result.error?.message || 'Unknown error');
    }
  } catch (error) {
    logError(`Error activando extensión ${extensionId}`, {
      error: error instanceof Error ? error.message : 'Unknown'
    });
    testState.errors.push(`Failed to toggle extension: ${extensionId}`);
    return false;
  }
}

// Obtener estado del sistema
async function getSimulationStatus() {
  try {
    logInfo('Obteniendo estado del sistema...');

    const response = await fetch(`${API_BASE}/simulate/status`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.success) {
      logSuccess('Estado del sistema obtenido', {
        activeExtensions: result.data.stats.activeExtensions,
        connectedClients: result.data.stats.connectedClients,
        extensions: result.data.extensions.map((e: any) => ({
          id: e.id,
          name: e.name,
          active: e.active,
          latency: e.latency
        })),
        clients: result.data.clients.map((c: any) => ({
          id: c.id,
          name: c.name,
          connected: c.connected
        }))
      });
      return result.data;
    }
  } catch (error) {
    logError('Error obteniendo estado', {
      error: error instanceof Error ? error.message : 'Unknown'
    });
    testState.errors.push('Failed to get simulation status');
  }
}

// Enviar mensaje de WhatsApp
async function sendWhatsAppMessage(text: string): Promise<any> {
  try {
    logInfo(`Enviando mensaje de WhatsApp: "${text}"`);

    const response = await fetch(`${API_BASE}/simulate/client-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'whatsapp',
        text
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result.success) {
      testState.messageSent = true;

      logSuccess('Mensaje enviado exitosamente', {
        messageId: result.data.clientMessage.id,
        persisted: result.data.clientMessage.persisted,
        extensionResponses: result.data.extensionResponses.length,
        summary: result.data.summary
      });

      return result.data;
    } else {
      throw new Error(result.error?.message || 'Unknown error');
    }
  } catch (error) {
    logError('Error enviando mensaje', {
      error: error instanceof Error ? error.message : 'Unknown'
    });
    testState.errors.push('Failed to send message');
    throw error;
  }
}

// Esperar un tiempo
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Mostrar resumen final
function showSummary() {
  console.log('\n' + '='.repeat(60));
  console.log(colors.bright + '📊 RESUMEN DE LA SIMULACIÓN' + colors.reset);
  console.log('='.repeat(60));

  console.log('\n' + colors.bright + 'Estado de la Prueba:' + colors.reset);
  console.log(`  WebSocket Conectado: ${testState.wsConnected ? colors.green + '✓' : colors.red + '✗'} ${colors.reset}`);
  console.log(`  Mensaje Enviado: ${testState.messageSent ? colors.green + '✓' : colors.red + '✗'} ${colors.reset}`);
  console.log(`  Mensaje Recibido: ${testState.messageReceived ? colors.green + '✓' : colors.red + '✗'} ${colors.reset}`);
  console.log(`  Respuestas de Extensiones: ${testState.extensionResponses.length} ${colors.dim}(${testState.extensionResponses.join(', ')})${colors.reset}`);

  console.log('\n' + colors.bright + 'Notificaciones Recibidas:' + colors.reset);
  const notificationTypes = testState.notifications.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(notificationTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${colors.cyan}${count}${colors.reset}`);
  });

  if (testState.errors.length > 0) {
    console.log('\n' + colors.bright + colors.red + 'Errores:' + colors.reset);
    testState.errors.forEach(error => {
      console.log(`  ${colors.red}• ${error}${colors.reset}`);
    });
  }

  console.log('\n' + colors.bright + 'Resultado Final:' + colors.reset);
  const allSuccess = testState.wsConnected &&
                     testState.messageSent &&
                     testState.messageReceived &&
                     testState.extensionResponses.length > 0 &&
                     testState.errors.length === 0;

  if (allSuccess) {
    console.log(`  ${colors.green}${colors.bright}✅ PRUEBA EXITOSA${colors.reset}`);
    console.log(`  Todos los componentes funcionan correctamente`);
  } else {
    console.log(`  ${colors.red}${colors.bright}❌ PRUEBA FALLIDA${colors.reset}`);
    console.log(`  Revisa los errores arriba`);
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

// Función principal
async function main() {
  console.log('\n' + colors.bright + colors.cyan + '🚀 INICIANDO SIMULACIÓN DE WHATSAPP' + colors.reset);
  console.log(colors.dim + 'Simulando flujo completo: envío → procesamiento → respuestas → notificaciones\n' + colors.reset);

  try {
    // Paso 1: Conectar WebSocket
    console.log(colors.bright + '\n📍 PASO 1: Conectar WebSocket' + colors.reset);
    const ws = await connectWebSocket();
    await wait(1000); // Esperar a recibir mensaje de conexión

    // Paso 2: Obtener estado inicial
    console.log(colors.bright + '\n📍 PASO 2: Obtener estado del sistema' + colors.reset);
    await getSimulationStatus();
    await wait(500);

    // Paso 3: Activar extensiones
    console.log(colors.bright + '\n📍 PASO 3: Activar extensiones' + colors.reset);
    await toggleExtension('echo');
    await wait(300);
    await toggleExtension('ai');
    await wait(300);
    await toggleExtension('crm');
    await wait(1000); // Esperar a recibir notificaciones de toggle

    // Paso 4: Enviar mensaje de WhatsApp
    console.log(colors.bright + '\n📍 PASO 4: Enviar mensaje de WhatsApp' + colors.reset);
    await sendWhatsAppMessage('Hola! Necesito ayuda con mi pedido #1234');

    // Paso 5: Esperar respuestas
    console.log(colors.bright + '\n📍 PASO 5: Esperando respuestas de extensiones...' + colors.reset);
    await wait(5000); // Esperar 5 segundos para recibir todas las respuestas

    // Paso 6: Verificar estado final
    console.log(colors.bright + '\n📍 PASO 6: Verificar estado final' + colors.reset);
    await getSimulationStatus();

    // Cerrar WebSocket
    logInfo('Cerrando conexión WebSocket...');
    ws.close();
    await wait(500);

  } catch (error) {
    logError('Error fatal en la simulación', {
      error: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined
    });
    testState.errors.push(`Fatal error: ${error instanceof Error ? error.message : 'Unknown'}`);
  } finally {
    // Mostrar resumen
    showSummary();

    // Exit code según resultado
    process.exit(testState.errors.length > 0 ? 1 : 0);
  }
}

// Ejecutar
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
