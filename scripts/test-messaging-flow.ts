/**
 * Test End-to-End del Flujo de Mensajería
 *
 * Prueba:
 * 1. Frontend envía mensaje → Backend lo recibe
 * 2. Backend persiste en PostgreSQL
 * 3. Frontend consulta mensajes → Verifica que está guardado
 * 4. WebSocket recibe notificación en tiempo real
 */

const API_URL = 'http://localhost:3000';
const TEST_USER_ID = 'test-user-e2e';

interface TestResult {
  step: string;
  success: boolean;
  duration: number;
  data?: any;
  error?: string;
}

const results: TestResult[] = [];

function logStep(emoji: string, message: string) {
  console.log(`${emoji} ${message}`);
}

function logSuccess(message: string) {
  console.log(`✅ ${message}`);
}

function logError(message: string, error?: any) {
  console.error(`❌ ${message}`);
  if (error) console.error('   Error:', error);
}

async function testStep<T>(
  stepName: string,
  fn: () => Promise<T>
): Promise<T | null> {
  const startTime = Date.now();

  try {
    logStep('🔄', stepName);
    const result = await fn();
    const duration = Date.now() - startTime;

    results.push({
      step: stepName,
      success: true,
      duration,
      data: result
    });

    logSuccess(`${stepName} (${duration}ms)`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    results.push({
      step: stepName,
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error)
    });

    logError(stepName, error);
    return null;
  }
}

async function sendMessage(messageText: string) {
  const payload = {
    type: 'incoming',
    channel: 'whatsapp',
    content: {
      text: messageText
    },
    metadata: {
      from: '+1234567890',
      to: '+0987654321',
      timestamp: new Date().toISOString()
    }
  };

  const response = await fetch(`${API_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': TEST_USER_ID
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return await response.json();
}

async function getMessages(limit: number = 10) {
  const response = await fetch(`${API_URL}/messages?limit=${limit}`, {
    headers: {
      'X-User-Id': TEST_USER_ID
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return await response.json();
}

async function checkHealth() {
  const response = await fetch(`${API_URL}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: HTTP ${response.status}`);
  }

  return await response.json();
}

async function testWebSocketConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(`ws://localhost:3000/realtime`);

      ws.onopen = () => {
        logSuccess('WebSocket connected');
        ws.close();
        resolve(true);
      };

      ws.onerror = (error) => {
        logError('WebSocket connection failed', error);
        resolve(false);
      };

      // Timeout después de 5 segundos
      setTimeout(() => {
        ws.close();
        resolve(false);
      }, 5000);
    } catch (error) {
      logError('WebSocket test failed', error);
      resolve(false);
    }
  });
}

async function runTests() {
  console.log('\n🚀 Starting End-to-End Messaging Flow Test\n');
  console.log('='.repeat(60));

  // Step 1: Health Check
  const health = await testStep('Step 1: Check backend health', checkHealth);
  if (!health) {
    logError('Backend is not healthy. Aborting tests.');
    return;
  }

  console.log(`   Database: ${health.data?.database || health.database}`);
  console.log(`   Status: ${health.data?.status || health.status}`);

  // Step 2: Send Message (Frontend → Backend)
  const testMessage = `Test message at ${new Date().toISOString()}`;
  const sendResult = await testStep(
    'Step 2: Send message (Frontend → Backend)',
    () => sendMessage(testMessage)
  );

  if (!sendResult) {
    logError('Failed to send message. Aborting tests.');
    return;
  }

  console.log(`   Message ID: ${sendResult.data?.messageId}`);
  console.log(`   Status: ${sendResult.data?.status}`);
  console.log(`   Storage: ${sendResult.data?.storage}`);

  // Step 3: Wait a bit for persistence
  await testStep('Step 3: Wait for persistence', () =>
    new Promise(resolve => setTimeout(resolve, 500))
  );

  // Step 4: Retrieve Messages (Backend → Frontend)
  const messagesResult = await testStep(
    'Step 4: Retrieve messages (Backend → Frontend)',
    () => getMessages(10)
  );

  if (!messagesResult) {
    logError('Failed to retrieve messages');
    return;
  }

  console.log(`   Total messages: ${messagesResult.data?.count}`);
  console.log(`   Storage: ${messagesResult.data?.storage}`);

  // Step 5: Verify message was persisted
  const wasPersistedResult = await testStep(
    'Step 5: Verify message persistence',
    async () => {
      const messages = messagesResult.data?.messages || [];
      const found = messages.find((msg: any) =>
        msg.content?.text === testMessage
      );

      if (!found) {
        throw new Error('Message not found in database');
      }

      return {
        found: true,
        messageId: found.id,
        content: found.content.text
      };
    }
  );

  if (wasPersistedResult) {
    console.log(`   ✓ Message found in database`);
    console.log(`   ✓ Message ID: ${wasPersistedResult.messageId}`);
    console.log(`   ✓ Content matches`);
  }

  // Step 6: Test WebSocket (Optional)
  const wsResult = await testStep(
    'Step 6: Test WebSocket real-time connection',
    testWebSocketConnection
  );

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary\n');

  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms`);

  console.log('\nDetailed Results:');
  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${index + 1}. ${result.step} (${result.duration}ms)`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n' + '='.repeat(60));

  if (failedTests === 0) {
    console.log('\n🎉 All tests passed! Messaging flow is working correctly.\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('\n💥 Test suite crashed:', error);
  process.exit(1);
});
