/**
 * Jest Configuration for Integration Tests
 *
 * Integration tests with real infrastructure
 * Run with: npm run test:integration
 *
 * Key Features:
 * - Real database connections (no TypeORM mocking)
 * - Longer timeout (60 seconds)
 * - Runs serially for database consistency
 * - Requires Docker infrastructure running
 *
 * Prerequisites:
 * - PostgreSQL: docker-compose up -d postgres
 * - Redis: docker-compose up -d redis
 * - Test database: soc_clients_test
 *
 * For unit tests: npm test
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],

  // Only match integration test files
  testMatch: ['**/*.integration.spec.ts'],

  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.spec.json',
      },
    ],
  },

  moduleFileExtensions: ['ts', 'js', 'json'],

  // NO TypeORM mocking - allows real database connections
  // Only mock non-critical dependencies
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../../shared/$1',
    '^@soc-compliance/auth-common$': '<rootDir>/../../packages/auth-common/dist/index.js',
    '^@soc-compliance/events$': '<rootDir>/../../shared/events/dist/index.js',
    '^@soc-compliance/monitoring$': '<rootDir>/src/__mocks__/@soc-compliance/monitoring.js',
  },

  moduleDirectories: ['node_modules', '<rootDir>/../../node_modules'],
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup.ts'],

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.interface.ts',
    '!src/**/index.ts',
    '!src/main.ts',
  ],

  coverageDirectory: '../coverage/integration',

  // Integration tests need more time
  testTimeout: 60000,

  modulePathIgnorePatterns: ['<rootDir>/dist/'],
};
