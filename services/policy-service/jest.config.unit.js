/**
 * Jest Configuration for Unit Tests
 *
 * This config is for fast unit tests with mocked dependencies
 * Run with: npm test
 *
 * Key Features:
 * - All dependencies mocked
 * - Fast execution (<10 seconds)
 * - No infrastructure required
 * - Perfect for TDD workflow
 * - Excludes integration tests
 *
 * For integration tests, use: npm run test:integration
 */

module.exports = {
  displayName: 'policy-service:unit',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/__tests__/**/*.spec.ts', '**/*.spec.ts'],
  // Exclude integration tests and e2e tests from unit test runs
  testPathIgnorePatterns: ['/node_modules/', '/test/e2e/', '\\.integration\\.spec\\.ts$'],
  coverageDirectory: './coverage/unit',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.interface.ts',
    '!src/main.ts',
    '!src/**/__mocks__/**',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^typeorm$': '<rootDir>/src/__mocks__/typeorm.ts',
    '^@nestjs/typeorm$': '<rootDir>/src/__mocks__/@nestjs/typeorm.ts',
    '^@nestjs/elasticsearch$': '<rootDir>/src/__mocks__/@nestjs/elasticsearch.ts',
    '^@nestjs/axios$': '<rootDir>/src/__mocks__/@nestjs/axios.ts',
    '^@nestjs/cache-manager$': '<rootDir>/src/__mocks__/@nestjs/cache-manager.ts',
    '^@nestjs/throttler$': '<rootDir>/src/__mocks__/@nestjs/throttler.ts',
    '^@soc-compliance/monitoring$': '<rootDir>/src/__mocks__/@soc-compliance/monitoring.js',
    '^isomorphic-dompurify$': '<rootDir>/src/__mocks__/isomorphic-dompurify.js',
    '^sanitize-html$': '<rootDir>/src/__mocks__/sanitize-html.ts',
    '^@shared/utils/sanitization\\.util$': '<rootDir>/src/shared/utils/__mocks__/sanitization.util.ts',
  },
  moduleDirectories: ['node_modules', '<rootDir>/../../node_modules'],
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup.ts'],
  testTimeout: 30000,
};