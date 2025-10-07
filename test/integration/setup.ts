/**
 * Integration Test Setup
 *
 * Global setup for integration tests
 */

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock environment variables for consistent testing
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Suppress console logs during tests unless debugging
if (!process.env.DEBUG) {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.debug = jest.fn();
}

// Global test cleanup
afterAll(async () => {
  // Allow time for any async cleanup
  await new Promise((resolve) => setTimeout(resolve, 100));
});
