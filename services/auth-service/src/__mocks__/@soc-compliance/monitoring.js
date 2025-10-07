// Mock implementation of @soc-compliance/monitoring for unit tests
// Prevents OpenTelemetry initialization issues in Jest

// Mock decorator functions that do nothing in tests
const Observable = (options = {}) => (target, propertyKey, descriptor) => descriptor;
const Traced = (spanName) => (target, propertyKey, descriptor) => descriptor;
const Metered = (metricName) => (target, propertyKey, descriptor) => descriptor;

// Mock service classes
const MockMetricsService = function() {
  this.recordCounter = jest.fn();
  this.recordHistogram = jest.fn();
  this.recordGauge = jest.fn();
  this.getMetrics = jest.fn().mockReturnValue({});
};

const MockTracingService = function() {
  this.startSpan = jest.fn().mockReturnValue({
    setAttributes: jest.fn(),
    setStatus: jest.fn(),
    recordException: jest.fn(),
    end: jest.fn(),
  });
  this.getActiveSpan = jest.fn().mockReturnValue(null);
};

const MockLoggingService = function() {
  this.log = jest.fn();
  this.error = jest.fn();
  this.warn = jest.fn();
  this.info = jest.fn();
  this.debug = jest.fn();
};

module.exports = {
  Observable,
  Traced,
  Metered,
  MetricsService: MockMetricsService,
  TracingService: MockTracingService,
  LoggingService: MockLoggingService,
};