/**
 * Jest Configuration for Unit Tests
 *
 * This config is for fast unit tests with mocked dependencies
 * Run with: npm test
 *
 * Key Features:
 * - Fast execution (<5 seconds)
 * - All dependencies mocked
 * - No infrastructure required
 * - Perfect for TDD workflow
 *
 * For integration tests, use: npm run test:integration
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  // Exclude integration tests from unit test runs
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.spec\\.ts$'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../../shared/$1',
    '^typeorm$': '<rootDir>/src/__mocks__/typeorm.ts',
    '^@nestjs/typeorm$': '<rootDir>/src/__mocks__/@nestjs/typeorm.ts',
    '^@soc-compliance/monitoring$': '<rootDir>/src/__mocks__/@soc-compliance/monitoring.js',
    '^geolib$': '<rootDir>/src/__mocks__/geolib.ts',
    '^geoip-lite$': '<rootDir>/src/__mocks__/geoip-lite.ts',
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
  coverageDirectory: '../coverage',
  testTimeout: 30000,
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  // Fix for ES modules (jwks-rsa, jose) - must be transformed by Jest
  transformIgnorePatterns: [
    'node_modules/(?!(jwks-rsa|jose)/)'
  ],
};
