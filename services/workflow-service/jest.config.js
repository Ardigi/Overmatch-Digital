module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
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
    '^@nestjs/typeorm$': '<rootDir>/src/__mocks__/typeorm.ts',
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
    '!src/config/**',
    '!src/**/*.module.ts',
  ],
  coverageDirectory: '../coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
};
