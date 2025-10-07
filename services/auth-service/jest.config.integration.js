/**
 * Jest Configuration for Integration Tests
 *
 * IMPORTANT: This config is for integration tests that require real infrastructure
 * Run with: npm run test:integration
 *
 * Prerequisites:
 * - Docker must be running
 * - PostgreSQL container must be started (docker-compose up postgres)
 * - Redis container must be started (docker-compose up redis)
 * - Test database soc_auth_test must exist
 *
 * Key Differences from jest.config.js:
 * - NO TypeORM mocking (real database connections)
 * - Longer timeout (60 seconds)
 * - Runs serially (--runInBand) for database consistency
 * - Only matches *.integration.spec.ts files
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Only integration tests
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.integration.spec.ts'],

  // TypeScript transformation
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.spec.json',
      },
    ],
  },

  moduleFileExtensions: ['ts', 'js', 'json'],

  // Path mappings - NO TypeORM/NestJS TypeORM mocking for integration tests
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../../shared/$1',
    // Keep non-critical mocks
    '^@soc-compliance/monitoring$': '<rootDir>/src/__mocks__/@soc-compliance/monitoring.js',
    '^geolib$': '<rootDir>/src/__mocks__/geolib.ts',
    '^geoip-lite$': '<rootDir>/src/__mocks__/geoip-lite.ts',
  },

  moduleDirectories: ['node_modules', '<rootDir>/../../node_modules'],
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup.ts'],

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.integration.spec.ts',
    '!src/**/*.interface.ts',
    '!src/**/index.ts',
    '!src/main.ts',
  ],

  coverageDirectory: '../coverage/integration',

  // Integration tests need more time
  testTimeout: 60000,

  modulePathIgnorePatterns: ['<rootDir>/dist/'],

  // Fix for ES modules (jwks-rsa, jose)
  transformIgnorePatterns: [
    'node_modules/(?!(jwks-rsa|jose)/)'
  ],

  // Global setup/teardown (optional - can be added later)
  // globalSetup: '<rootDir>/test/integration-global-setup.ts',
  // globalTeardown: '<rootDir>/test/integration-global-teardown.ts',
};
