// Jest setup file for policy-service tests
import 'reflect-metadata';
import { webcrypto } from 'crypto';

// Polyfill for Node.js built-ins - ensure setImmediate is available
if (!global.setImmediate) {
  global.setImmediate = ((fn: any, ...args: any[]) => global.setTimeout(fn, 0, ...args)) as any;
}

// Mock crypto with proper Web Crypto API interface
if (!global.crypto) {
  global.crypto = webcrypto as Crypto;
}

// Ensure crypto functions are available with proper typing
if (!global.crypto.getRandomValues) {
  global.crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    if (array && 'length' in array) {
      for (let i = 0; i < (array as any).length; i++) {
        (array as any)[i] = Math.floor(Math.random() * 256);
      }
    }
    return array;
  };
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
