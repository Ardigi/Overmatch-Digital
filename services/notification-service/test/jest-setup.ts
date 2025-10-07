import 'reflect-metadata';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console.error = jest.fn();
global.console.warn = jest.fn();

// Ensure all timers are cleared after each test
afterEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});

// Clean up any open handles after all tests
afterAll(async () => {
  // Wait a bit for any pending operations
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});
