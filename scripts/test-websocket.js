/**
 * WebSocket Testing Script (Sprint 3)
 *
 * Prueba las protecciones implementadas en WebSocket:
 * 1. Rate limiting (12 req/min free, 30 req/min premium)
 * 2. Message validation (TypeBox schemas)
 * 3. Size validation (1MB max)
 *
 * Uso:
 *   bun scripts/test-websocket.js
 */

const WS_URL = 'ws://localhost:3000/realtime';

// Colores para terminal
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test 1: Conexión básica
 */
async function testConnection() {
  log('\n[TEST 1] Testing WebSocket connection...', 'blue');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let received = false;

    ws.onopen = () => {
      log('✓ Connection established', 'green');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'connection' && data.status === 'connected') {
        log(`✓ Connection message received (clientId: ${data.clientId})`, 'green');
        received = true;
        ws.close();
        resolve(true);
      }
    };

    ws.onerror = (error) => {
      log(`✗ Connection error: ${error.message}`, 'red');
      reject(error);
    };

    ws.onclose = () => {
      if (!received) {
        reject(new Error('Connection closed without receiving welcome message'));
      }
    };

    setTimeout(() => {
      if (!received) {
        ws.close();
        reject(new Error('Timeout waiting for connection message'));
      }
    }, 5000);
  });
}

/**
 * Test 2: Message validation - Valid message
 */
async function testValidMessage() {
  log('\n[TEST 2] Testing valid message...', 'blue');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let echoReceived = false;

    ws.onopen = () => {
      const validMessage = {
        type: 'typing',
        conversationId: 'test-conv-1',
        isTyping: true
      };

      ws.send(JSON.stringify(validMessage));
      log('→ Sent valid typing message', 'yellow');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'echo') {
        log('✓ Echo received (message accepted)', 'green');
        echoReceived = true;
        ws.close();
        resolve(true);
      }
    };

    ws.onerror = (error) => {
      log(`✗ Error: ${error.message}`, 'red');
      reject(error);
    };

    setTimeout(() => {
      if (!echoReceived) {
        ws.close();
        reject(new Error('No echo received for valid message'));
      }
    }, 3000);
  });
}

/**
 * Test 3: Message validation - Invalid message
 */
async function testInvalidMessage() {
  log('\n[TEST 3] Testing invalid message validation...', 'blue');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let errorReceived = false;

    ws.onopen = () => {
      // Mensaje typing sin campo isTyping (requerido)
      const invalidMessage = {
        type: 'typing',
        conversationId: 'test-conv-1'
        // isTyping missing!
      };

      ws.send(JSON.stringify(invalidMessage));
      log('→ Sent invalid message (missing isTyping)', 'yellow');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'error' && data.code === 'INVALID_MESSAGE') {
        log(`✓ Validation error received: ${data.message}`, 'green');
        log(`  Errors: ${JSON.stringify(data.errors)}`, 'yellow');
        errorReceived = true;
        ws.close();
        resolve(true);
      } else if (data.type === 'echo') {
        log('✗ Invalid message was accepted (should be rejected)', 'red');
        ws.close();
        reject(new Error('Invalid message accepted'));
      }
    };

    ws.onerror = (error) => {
      log(`✗ Connection error: ${error.message}`, 'red');
      reject(error);
    };

    setTimeout(() => {
      if (!errorReceived) {
        ws.close();
        reject(new Error('No validation error received'));
      }
    }, 3000);
  });
}

/**
 * Test 4: Size validation - Large message
 */
async function testLargeMessage() {
  log('\n[TEST 4] Testing message size validation...', 'blue');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let errorReceived = false;

    ws.onopen = () => {
      // Mensaje > 1MB
      const largeMessage = {
        type: 'new_message',
        text: 'A'.repeat(1024 * 1024 + 1000) // ~1MB + 1KB
      };

      ws.send(JSON.stringify(largeMessage));
      log('→ Sent large message (>1MB)', 'yellow');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'error' && data.code === 'MESSAGE_TOO_LARGE') {
        log(`✓ Size limit error received: ${data.message}`, 'green');
        log(`  Size: ${data.size} bytes`, 'yellow');
        errorReceived = true;
        ws.close();
        resolve(true);
      } else if (data.type === 'echo') {
        log('✗ Large message was accepted (should be rejected)', 'red');
        ws.close();
        reject(new Error('Large message accepted'));
      }
    };

    ws.onerror = (error) => {
      log(`✗ Connection error: ${error.message}`, 'red');
      reject(error);
    };

    setTimeout(() => {
      if (!errorReceived) {
        ws.close();
        reject(new Error('No size error received'));
      }
    }, 5000);
  });
}

/**
 * Test 5: Rate limiting (free plan = 12 req/min)
 */
async function testRateLimiting() {
  log('\n[TEST 5] Testing rate limiting (sending 15 messages rapidly)...', 'blue');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let messagesAccepted = 0;
    let rateLimitErrors = 0;
    const totalMessages = 15;
    let messagesSent = 0;

    ws.onopen = () => {
      log('→ Sending 15 rapid messages...', 'yellow');

      const interval = setInterval(() => {
        if (messagesSent >= totalMessages) {
          clearInterval(interval);
          return;
        }

        const message = {
          type: 'typing',
          conversationId: 'rate-test',
          isTyping: true
        };

        ws.send(JSON.stringify(message));
        messagesSent++;
      }, 100); // 1 mensaje cada 100ms
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'echo') {
        messagesAccepted++;
      } else if (data.type === 'error' && data.code === 'RATE_LIMIT_EXCEEDED') {
        rateLimitErrors++;

        if (rateLimitErrors === 1) {
          log(`✓ Rate limit triggered at message #${messagesAccepted + 1}`, 'green');
          log(`  Limit: ${data.limit} req/min`, 'yellow');
          log(`  Retry after: ${data.retryAfter}s`, 'yellow');
        }
      }
    };

    ws.onerror = (error) => {
      log(`✗ Connection error: ${error.message}`, 'red');
      reject(error);
    };

    setTimeout(() => {
      ws.close();

      log(`\nResults:`, 'blue');
      log(`  Messages sent: ${messagesSent}`, 'yellow');
      log(`  Messages accepted: ${messagesAccepted}`, 'yellow');
      log(`  Rate limit errors: ${rateLimitErrors}`, 'yellow');

      if (rateLimitErrors > 0 && messagesAccepted <= 12) {
        log('✓ Rate limiting working correctly', 'green');
        resolve(true);
      } else {
        log(`✗ Rate limiting issue (expected ~12 accepted, got ${messagesAccepted})`, 'red');
        reject(new Error('Rate limiting not working as expected'));
      }
    }, 3000);
  });
}

/**
 * Run all tests
 */
async function runTests() {
  log('╔════════════════════════════════════════╗', 'blue');
  log('║   WebSocket Protection Tests (Sprint 3) ║', 'blue');
  log('╚════════════════════════════════════════╝', 'blue');

  const tests = [
    { name: 'Connection', fn: testConnection },
    { name: 'Valid Message', fn: testValidMessage },
    { name: 'Invalid Message', fn: testInvalidMessage },
    { name: 'Large Message', fn: testLargeMessage },
    { name: 'Rate Limiting', fn: testRateLimiting }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn();
      passed++;
      await sleep(500); // Pausa entre tests
    } catch (error) {
      log(`\n✗ Test failed: ${error.message}`, 'red');
      failed++;
    }
  }

  log('\n╔════════════════════════════════════════╗', 'blue');
  log('║           Test Summary                 ║', 'blue');
  log('╚════════════════════════════════════════╝', 'blue');
  log(`  Total: ${tests.length}`, 'yellow');
  log(`  Passed: ${passed}`, 'green');
  log(`  Failed: ${failed}`, failed > 0 ? 'red' : 'yellow');

  if (failed === 0) {
    log('\n✓ All tests passed! WebSocket is production-ready.', 'green');
    process.exit(0);
  } else {
    log(`\n✗ ${failed} test(s) failed. Please review.`, 'red');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  log(`\n✗ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
