/**
 * Bun Test Configuration
 *
 * This file configures the Bun test runner for the INHOST backend.
 * Bun includes a built-in test runner similar to Jest but with better performance.
 */

export default {
  /**
   * Test environment setup
   */
  preload: ['./tests/setup.ts'],

  /**
   * Coverage settings
   */
  coverage: {
    enabled: true,
    reporter: ['text', 'json', 'html'],
    threshold: {
      lines: 0, // Start at 0%, will increase as we add tests
      functions: 0,
      branches: 0,
      statements: 0,
    },
  },

  /**
   * Test timeout (ms)
   */
  timeout: 10000,
};
