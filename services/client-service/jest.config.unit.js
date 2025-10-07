module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
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
    '^@soc-compliance/monitoring$': '<rootDir>/src/__mocks__/@soc-compliance/monitoring.js',
    '^typeorm$': '<rootDir>/src/__mocks__/typeorm.ts',
    '^@nestjs/typeorm$': '<rootDir>/src/__mocks__/@nestjs/typeorm.ts',
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
};
