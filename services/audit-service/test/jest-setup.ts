import 'reflect-metadata';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console.error = jest.fn();
global.console.warn = jest.fn();
global.console.log = jest.fn();
global.console.info = jest.fn();
global.console.debug = jest.fn();

// Mock Logger to prevent EPIPE errors
jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  return {
    ...actual,
    Logger: jest.fn().mockImplementation(() => ({
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    })),
  };
});
