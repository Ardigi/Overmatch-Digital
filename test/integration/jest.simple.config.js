module.exports = {
  displayName: 'Simple Service Communication Tests',
  rootDir: '../../',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/integration/simple-service-communication.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testTimeout: 15000,
  moduleFileExtensions: ['js', 'json', 'ts'],
  collectCoverage: false,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  // Use built packages instead of source for better compatibility
  moduleNameMapping: {
    '^@soc-compliance/shared-contracts$': '<rootDir>/shared/contracts/dist/index.js',
    '^@soc-compliance/shared-events$': '<rootDir>/shared/events/dist/index.js',
    '^@soc-compliance/auth-common$': '<rootDir>/packages/auth-common/dist/index.js',
    '^@soc-compliance/http-common$': '<rootDir>/packages/http-common/dist/index.js',
    '^@soc-compliance/cache-common$': '<rootDir>/packages/cache-common/dist/index.js',
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/services/*/dist/',
    '<rootDir>/packages/*/dist/',
    '<rootDir>/services/*/__mocks__/',
  ],
};
