// Jest setup file for auth-service tests
import 'reflect-metadata';
import { webcrypto } from 'crypto';
import './integration-setup';

// Polyfill for Node.js built-ins in Jest environment
if (!global.setImmediate) {
  global.setImmediate = ((fn: any, ...args: any[]) => global.setTimeout(fn, 0, ...args)) as any;
}

// Ensure global crypto is available for Web Crypto API usage
if (!global.crypto) {
  // Use Node.js webcrypto for browser-compatible crypto in tests
  Object.defineProperty(global, 'crypto', {
    value: webcrypto,
    writable: true,
  });
}

// Mock console to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};
