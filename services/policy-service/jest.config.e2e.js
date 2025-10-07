module.exports = {
  displayName: 'policy-service:e2e',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/test/e2e/**/*.e2e-spec.ts'],
  testTimeout: 60000,
  coverageDirectory: './coverage/e2e',
  coveragePathIgnorePatterns: ['/node_modules/', '/src/__mocks__/', '/test/mocks/'],
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.ts',
    '!src/**/*.interface.ts',
    '!src/main.ts',
    '!src/__mocks__/**',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^sanitize-html$': '<rootDir>/test/mocks/sanitize-html.mock.js',
    '^dompurify$': '<rootDir>/test/mocks/dompurify.mock.js',
    '^jsdom$': '<rootDir>/test/mocks/jsdom.mock.js',
    '../../shared/utils/sanitization.util$': '<rootDir>/test/mocks/sanitization.util.mock.js',
  },
  // Explicitly exclude mocks directory for E2E tests
  modulePathIgnorePatterns: ['<rootDir>/src/__mocks__'],
  // Don't use any setup files that might load mocks
  setupFilesAfterEnv: [],
  globals: {
    'ts-jest': {
      tsconfig: {
        // Ensure decorators work properly in E2E tests
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    },
  },
};
