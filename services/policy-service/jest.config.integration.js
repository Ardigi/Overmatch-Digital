/**
 * Jest Configuration for Integration Tests
 *
 * This config is for integration tests that require real infrastructure
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
 * - Test database: soc_policies_test
 *
 * For unit tests, use: npm test
 */

module.exports = {
  displayName: 'policy-service:integration',
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
    '^@soc-compliance/monitoring$': '<rootDir>/src/__mocks__/@soc-compliance/monitoring.js',
    '^isomorphic-dompurify$': '<rootDir>/src/__mocks__/isomorphic-dompurify.js',
    '^sanitize-html$': '<rootDir>/src/__mocks__/sanitize-html.ts',
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

  coverageDirectory: './coverage/integration',

  // Integration tests need more time
  testTimeout: 60000,

  modulePathIgnorePatterns: ['<rootDir>/dist/'],
};
