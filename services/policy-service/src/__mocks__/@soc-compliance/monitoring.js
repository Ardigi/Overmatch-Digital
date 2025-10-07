const mockMetricsService = {
  recordHttpRequest: jest.fn(),
  registerCounter: jest.fn().mockReturnValue({ inc: jest.fn() }),
  registerHistogram: jest.fn().mockReturnValue({ observe: jest.fn() }),
  registerGauge: jest.fn().mockReturnValue({ set: jest.fn() }),
  getMetric: jest.fn(),
  config: { serviceName: 'policy-service-test' },
};

const mockTracingService = {
  withSpan: jest.fn().mockImplementation((name, fn, options) => fn({ setAttribute: jest.fn() })),
  createSpan: jest.fn().mockReturnValue({ setAttribute: jest.fn(), end: jest.fn() }),
  getActiveSpan: jest.fn().mockReturnValue({ setAttribute: jest.fn() }),
  setStatus: jest.fn(),
  recordException: jest.fn(),
};

const mockLoggingService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  logSecurityEvent: jest.fn(),
  logComplianceEvent: jest.fn(),
  logAuditEvent: jest.fn(),
};

// Mock decorators as pass-through functions
const Observable =
  (options = {}) =>
  (target, propertyKey, descriptor) =>
    descriptor;
const Traced = (spanName) => (target, propertyKey, descriptor) => descriptor;
const Metered = (metricName) => (target, propertyKey, descriptor) => descriptor;
const Logged =
  (options = {}) =>
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
  MonitoringModule: {
    forRoot: jest.fn().mockReturnValue({
      module: class MockMonitoringModule {},
      providers: [
        { provide: 'MetricsService', useValue: mockMetricsService },
        { provide: 'TracingService', useValue: mockTracingService },
        { provide: 'LoggingService', useValue: mockLoggingService },
      ],
      exports: ['MetricsService', 'TracingService', 'LoggingService'],
    }),
  },
};
