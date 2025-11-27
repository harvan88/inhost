/**
 * Test Setup and Global Configuration
 *
 * This file runs before all tests to set up the test environment.
 * It configures environment variables, database connections, and test utilities.
 */

import { beforeAll, afterAll } from 'bun:test';

/**
 * Setup test environment variables
 */
function setupTestEnv() {
  // Set test environment
  process.env.NODE_ENV = 'test';

  // Generate a test JWT secret (64 bytes base64)
  process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-characters-for-testing-purposes-only';

  // Test database URL (use a separate test database)
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/inhost_test';

  // Disable Redis in tests (use memory implementations)
  process.env.RATE_LIMIT_BACKEND = 'memory';

  // Test API URL
  process.env.API_URL = 'http://localhost:3456';

  console.log('🧪 Test environment configured');
}

/**
 * Global setup - runs once before all tests
 */
beforeAll(() => {
  setupTestEnv();
});

/**
 * Global teardown - runs once after all tests
 */
afterAll(() => {
  console.log('🏁 All tests completed');
});

/**
 * Test helper: Wait for async operations
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test helper: Generate random email for testing
 */
export function randomEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

/**
 * Test helper: Generate random tenant name
 */
export function randomTenantName(): string {
  return `Test Company ${Date.now()}`;
}
