/**
 * Jest Configuration for Real Integration Tests - Client Service
 *
 * This configuration is specifically for integration tests that:
 * - Require actual infrastructure (Redis, Database, Services)
 * - Run against real implementations (no mocks)
 * - Have longer timeouts for real operations
 * - Run sequentially to avoid resource conflicts
 */

module.exports = {
  displayName: 'Client Service Integration Tests',

  // Target integration test files
  testMatch: [
    '<rootDir>/src/**/*.integration.spec.ts',
    '<rootDir>/src/**/integration/**/*.spec.ts',
  ],

  // Ignore unit tests
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/src/**/*.spec.ts', // Exclude unit tests
    '<rootDir>/test/e2e/', // Exclude E2E tests
  ],

  // Node environment for real infrastructure connections
  testEnvironment: 'node',

  // TypeScript support
  preset: 'ts-jest',

  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@soc-compliance/(.*)$': '<rootDir>/../../packages/$1/src',
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/test/integration-setup.ts'],

  // Extended timeout for real operations
  testTimeout: 60000, // 60 seconds for database/Redis/HTTP operations

  // Run sequentially to avoid resource conflicts
  maxWorkers: 1,

  // Don't collect coverage for integration tests
  collectCoverage: false,

  // Verbose output for debugging
  verbose: true,

  // Simple reporter setup
  reporters: ['default'],

  // Global setup/teardown
  globalSetup: '<rootDir>/test/integration-global-setup.ts',
  globalTeardown: '<rootDir>/test/integration-global-teardown.ts',

  // Clear mocks between tests
  clearMocks: true,

  // Reset modules between tests
  resetModules: true,

  // Environment variables for tests
  setupFiles: ['<rootDir>/test/integration-env.ts'],

  // Transform configuration
  transform: {
    '^.+\.ts$': 'ts-jest',
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'js', 'json'],

  // Don't transform node_modules except for ES modules
  transformIgnorePatterns: ['node_modules/(?!(.*\.mjs$))'],

  // Fail fast on first test failure in CI
  bail: process.env.CI ? 1 : 0,

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles (useful for debugging connection leaks)
  detectOpenHandles: true,

  // Error on deprecated features
  errorOnDeprecated: true,
};
