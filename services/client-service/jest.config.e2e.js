module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test/e2e'],
  testMatch: ['**/*.e2e-spec.ts'],
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
    '^@soc-compliance/auth-common$': '<rootDir>/../../packages/auth-common/dist/index.js',
    '^@soc-compliance/events$': '<rootDir>/../../shared/events/dist/index.js',
    '^@soc-compliance/contracts$': '<rootDir>/../../shared/contracts/dist/index.js',
    // No TypeORM mocks for E2E tests
  },
  moduleDirectories: ['node_modules', '<rootDir>/../../node_modules'],
  testTimeout: 30000,
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/src/__mocks__'],
  transformIgnorePatterns: ['node_modules/(?!(typeorm)/)'],
  clearMocks: true,
  // Force Jest to use single worker for stability
  maxWorkers: 1,
  forceExit: true, // Force exit to handle hanging connections
  detectOpenHandles: true, // Help identify connection leaks
};
