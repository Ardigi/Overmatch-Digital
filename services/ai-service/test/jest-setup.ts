import 'reflect-metadata';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console.error = jest.fn();
global.console.warn = jest.fn();
