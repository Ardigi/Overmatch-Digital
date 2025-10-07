import type { MonitoringConfig } from '@soc-compliance/monitoring';

export const testMonitoringConfig: MonitoringConfig = {
  metrics: {
    serviceName: 'client-service-test',
    port: 0,
    path: '/metrics',
    defaultLabels: {
      environment: 'test',
      version: '1.0.0',
      region: 'test',
    },
    enableDefaultMetrics: false,
    prefix: 'soc_test_',
  },
  tracing: {
    serviceName: 'client-service-test',
    endpoint: '',
    enabled: false,
    samplingRatio: 0,
    headers: {},
  },
  logging: {
    serviceName: 'client-service-test',
    level: 'error',
    elasticsearch: null,
    console: false,
    file: null,
  },
};
