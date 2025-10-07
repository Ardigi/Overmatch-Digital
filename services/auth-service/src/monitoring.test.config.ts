import type { MonitoringConfig } from '@soc-compliance/monitoring';

// Test-specific monitoring configuration that doesn't connect to external services
export const testMonitoringConfig: MonitoringConfig = {
  metrics: {
    serviceName: 'auth-service-test',
    port: 0, // Disable metrics server in tests
    path: '/metrics',
    defaultLabels: {
      environment: 'test',
      version: '1.0.0',
      region: 'test',
    },
    enableDefaultMetrics: false, // Disable default metrics collection
    prefix: 'soc_test_',
  },
  tracing: {
    serviceName: 'auth-service-test',
    endpoint: '', // No endpoint for tests
    enabled: false, // Disable tracing in tests
    samplingRatio: 0,
    headers: {},
  },
  logging: {
    serviceName: 'auth-service-test',
    level: 'error', // Only log errors in tests
    elasticsearch: null, // No Elasticsearch in tests
    console: false, // Disable console logging in tests
    file: null, // No file logging in tests
  },
};
