/**
 * Test Redis Rate Limiter - Sprint 4
 *
 * Verifica que RedisRateLimiter no tenga race conditions
 * y funcione correctamente con operaciones atómicas.
 *
 * REQUISITO: Redis debe estar corriendo en localhost:6379
 *
 * Uso:
 *   RATE_LIMIT_BACKEND=redis bun scripts/test-redis-ratelimiter.js
 */

const BASE_URL = 'http://localhost:3000';

// Helper para hacer requests
async function sendMessage(userId, text) {
  const response = await fetch(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId
    },
    body: JSON.stringify({
      type: 'incoming',
      channel: 'whatsapp',
      content: { text },
      metadata: {
        from: '+1234567890',
        to: '+9876543210',
        timestamp: new Date().toISOString()
      }
    })
  });

  const rateLimitHeaders = {
    limit: response.headers.get('X-RateLimit-Limit'),
    remaining: response.headers.get('X-RateLimit-Remaining'),
    reset: response.headers.get('X-RateLimit-Reset')
  };

  return {
    status: response.status,
    rateLimitHeaders,
    body: await response.json()
  };
}

// Test 1: Verificar que Redis esté activo
async function testRedisConnection() {
  console.log('\n📡 Test 1: Redis Connection');
  console.log('─'.repeat(50));

  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();

    if (!data.redis || data.redis.status !== 'connected') {
      console.log('❌ Redis NOT connected');
      console.log('   Make sure Redis is running and RATE_LIMIT_BACKEND=redis');
      return false;
    }

    console.log('✅ Redis connected');
    console.log(`   Host: ${data.redis.host}:${data.redis.port}`);
    return true;
  } catch (error) {
    console.log(`❌ Server not reachable: ${error.message}`);
    return false;
  }
}

// Test 2: Rate limiting básico
async function testBasicRateLimiting() {
  console.log('\n🔒 Test 2: Basic Rate Limiting (Free Plan)');
  console.log('─'.repeat(50));

  const userId = `test-basic-${Date.now()}`;
  const limit = 12; // Free plan limit

  let allowed = 0;
  let denied = 0;

  for (let i = 1; i <= 15; i++) {
    const result = await sendMessage(userId, `Test message ${i}`);

    if (result.status === 200) {
      allowed++;
      console.log(`✅ Request ${i}: ALLOWED (${result.rateLimitHeaders.remaining} remaining)`);
    } else if (result.status === 429) {
      denied++;
      console.log(`🚫 Request ${i}: DENIED (rate limit exceeded)`);
    }
  }

  console.log('\nResults:');
  console.log(`  Allowed: ${allowed} (expected: ${limit})`);
  console.log(`  Denied: ${denied} (expected: ${15 - limit})`);

  const passed = allowed === limit && denied === (15 - limit);
  console.log(passed ? '✅ Test PASSED' : '❌ Test FAILED');
  return passed;
}

// Test 3: Concurrent requests (race condition test)
async function testConcurrentRequests() {
  console.log('\n⚡ Test 3: Concurrent Requests (Race Condition Test)');
  console.log('─'.repeat(50));

  const userId = `test-concurrent-${Date.now()}`;
  const limit = 12;
  const concurrentRequests = 20;

  console.log(`Sending ${concurrentRequests} concurrent requests...`);

  // Enviar todas las requests en paralelo (máxima presión)
  const promises = Array.from({ length: concurrentRequests }, (_, i) =>
    sendMessage(userId, `Concurrent test ${i + 1}`)
  );

  const results = await Promise.all(promises);

  const allowed = results.filter(r => r.status === 200).length;
  const denied = results.filter(r => r.status === 429).length;

  console.log('\nResults:');
  console.log(`  Allowed: ${allowed} (expected: ${limit})`);
  console.log(`  Denied: ${denied} (expected: ${concurrentRequests - limit})`);
  console.log(`  Total: ${allowed + denied}`);

  // Con Redis atómico, debe ser EXACTO
  const passed = allowed === limit && denied === (concurrentRequests - limit);

  if (passed) {
    console.log('✅ Test PASSED - No race condition detected');
    console.log('   Redis INCR is working atomically');
  } else {
    console.log('❌ Test FAILED - Possible race condition');
    console.log(`   Expected exactly ${limit} allowed, got ${allowed}`);
  }

  return passed;
}

// Test 4: Rate limit reset después de 1 minuto
async function testRateLimitReset() {
  console.log('\n⏱️  Test 4: Rate Limit Reset (TTL Test)');
  console.log('─'.repeat(50));

  const userId = `test-reset-${Date.now()}`;

  // Consumir todo el límite
  console.log('Consuming rate limit...');
  for (let i = 1; i <= 12; i++) {
    await sendMessage(userId, `Message ${i}`);
  }

  // Verificar que esté bloqueado
  const blockedResult = await sendMessage(userId, 'Should be blocked');
  if (blockedResult.status !== 429) {
    console.log('❌ Test FAILED - Not blocked after limit');
    return false;
  }

  console.log('✅ Rate limit reached (as expected)');

  const resetTime = blockedResult.rateLimitHeaders.reset;
  const resetDate = new Date(resetTime);
  const waitSeconds = Math.ceil((resetDate - new Date()) / 1000);

  console.log(`⏳ Waiting ${waitSeconds}s for rate limit reset...`);
  console.log(`   Reset time: ${resetDate.toLocaleTimeString()}`);

  // Esperar hasta el reset + 1 segundo extra
  await new Promise(resolve => setTimeout(resolve, (waitSeconds + 1) * 1000));

  // Verificar que se haya reseteado
  const afterResetResult = await sendMessage(userId, 'After reset');

  if (afterResetResult.status === 200) {
    console.log('✅ Test PASSED - Rate limit reset after TTL');
    return true;
  } else {
    console.log('❌ Test FAILED - Rate limit not reset');
    return false;
  }
}

// Test 5: Múltiples usuarios en paralelo
async function testMultipleUsers() {
  console.log('\n👥 Test 5: Multiple Users (Isolation Test)');
  console.log('─'.repeat(50));

  const users = [
    `test-user-1-${Date.now()}`,
    `test-user-2-${Date.now()}`,
    `test-user-3-${Date.now()}`
  ];

  console.log(`Testing ${users.length} users simultaneously...`);

  // Cada usuario hace 15 requests
  const allPromises = users.map(userId =>
    Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        sendMessage(userId, `User ${userId} message ${i + 1}`)
      )
    )
  );

  const allResults = await Promise.all(allPromises);

  let allPassed = true;
  users.forEach((userId, index) => {
    const results = allResults[index];
    const allowed = results.filter(r => r.status === 200).length;
    const denied = results.filter(r => r.status === 429).length;

    console.log(`\nUser ${index + 1} (${userId.substring(0, 20)}...):`);
    console.log(`  Allowed: ${allowed} (expected: 12)`);
    console.log(`  Denied: ${denied} (expected: 3)`);

    if (allowed !== 12 || denied !== 3) {
      console.log('  ❌ FAILED');
      allPassed = false;
    } else {
      console.log('  ✅ PASSED');
    }
  });

  console.log(allPassed ? '\n✅ All users isolated correctly' : '\n❌ User isolation failed');
  return allPassed;
}

// Main test runner
async function runTests() {
  console.log('═'.repeat(50));
  console.log('🧪 Redis Rate Limiter Test Suite - Sprint 4');
  console.log('═'.repeat(50));

  const results = {
    connection: await testRedisConnection(),
  };

  if (!results.connection) {
    console.log('\n❌ Cannot proceed without Redis connection');
    console.log('   Start Redis: docker run -d -p 6379:6379 redis:7-alpine');
    console.log('   Set env var: RATE_LIMIT_BACKEND=redis');
    process.exit(1);
  }

  // Ejecutar tests secuencialmente
  results.basic = await testBasicRateLimiting();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Pequeña pausa

  results.concurrent = await testConcurrentRequests();
  await new Promise(resolve => setTimeout(resolve, 1000));

  results.multipleUsers = await testMultipleUsers();

  // Test de reset (el más largo - 60+ segundos)
  console.log('\n⚠️  Next test will take ~60 seconds (TTL reset)');
  console.log('Press Ctrl+C to skip, or wait...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  results.reset = await testRateLimitReset();

  // Resumen final
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Test Summary');
  console.log('═'.repeat(50));

  const tests = [
    ['Redis Connection', results.connection],
    ['Basic Rate Limiting', results.basic],
    ['Concurrent Requests (No Race Condition)', results.concurrent],
    ['Multiple Users Isolation', results.multipleUsers],
    ['Rate Limit Reset (TTL)', results.reset]
  ];

  tests.forEach(([name, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${name}`);
  });

  const totalPassed = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;

  console.log('\n' + '═'.repeat(50));
  console.log(`Result: ${totalPassed}/${totalTests} tests passed`);
  console.log('═'.repeat(50));

  if (totalPassed === totalTests) {
    console.log('\n🎉 All tests PASSED!');
    console.log('   RedisRateLimiter is working correctly');
    console.log('   No race conditions detected');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests FAILED');
    console.log('   Check implementation or Redis connection');
    process.exit(1);
  }
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run tests
runTests();
