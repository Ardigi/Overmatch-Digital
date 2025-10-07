// Mock for @soc-compliance/monitoring package to avoid OpenTelemetry issues in Jest tests

const mockMetricsService = {
  recordHttpRequest: jest.fn(),
  incrementHttpRequestsInFlight: jest.fn(),
  decrementHttpRequestsInFlight: jest.fn(),
  recordDbQuery: jest.fn(),
  recordCacheHit: jest.fn(),
  recordCacheMiss: jest.fn(),
  registerCounter: jest.fn().mockReturnValue({ inc: jest.fn() }),
  registerGauge: jest.fn().mockReturnValue({ set: jest.fn() }),
  registerHistogram: jest.fn().mockReturnValue({ observe: jest.fn() }),
  getMetric: jest.fn(),
  config: { serviceName: 'test-service' },
};

const mockTracingService = {
  withSpan: jest.fn().mockImplementation((name, fn, options) => fn({ setAttribute: jest.fn() })),
  createSpan: jest.fn().mockReturnValue({ setAttribute: jest.fn(), end: jest.fn() }),
  getActiveSpan: jest.fn().mockReturnValue({ setAttribute: jest.fn() }),
};

const mockLoggingService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

// Mock decorators as simple pass-through functions
const Observable =
  (options = {}) =>
  (target, propertyKey, descriptor) =>
    descriptor;
const Traced = (spanName) => (target, propertyKey, descriptor) => descriptor;
const Metered = (metricName) => (target, propertyKey, descriptor) => descriptor;
const Logged =
  (level = 'info') =>
  (target, propertyKey, descriptor) =>
    descriptor;

module.exports = {
  MetricsService: jest.fn().mockImplementation(() => mockMetricsService),
  TracingService: jest.fn().mockImplementation(() => mockTracingService),
  LoggingService: jest.fn().mockImplementation(() => mockLoggingService),
  Observable,
  Traced,
  Metered,
  Logged,
  // Ensure all services are properly mocked
  __esModule: true,
  default: {
    MetricsService: jest.fn().mockImplementation(() => mockMetricsService),
    TracingService: jest.fn().mockImplementation(() => mockTracingService),
    LoggingService: jest.fn().mockImplementation(() => mockLoggingService),
    Observable,
    Traced,
    Metered,
    Logged,
  },
};
