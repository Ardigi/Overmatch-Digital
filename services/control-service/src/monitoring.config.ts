import type { MonitoringConfig } from '@soc-compliance/monitoring';

export const monitoringConfig: MonitoringConfig = {
  metrics: {
    serviceName: 'control-service',
    port: parseInt(process.env.PORT || '3004'),
    path: '/metrics',
    defaultLabels: {
      environment: process.env.NODE_ENV || 'development',
      version: process.env.SERVICE_VERSION || '1.0.0',
      region: process.env.AWS_REGION || 'us-east-1',
    },
    enableDefaultMetrics: true,
    prefix: 'soc_',
  },
  tracing: {
    serviceName: 'control-service',
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
    enabled: process.env.TRACING_ENABLED !== 'false',
    samplingRatio: parseFloat(process.env.TRACING_SAMPLING_RATIO || '1.0'),
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
      ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
      : {}, // Use empty object instead of undefined
  },
  logging: {
    serviceName: 'control-service',
    level: process.env.LOG_LEVEL || 'info',
    elasticsearch: process.env.ELASTICSEARCH_NODE
      ? {
          node: process.env.ELASTICSEARCH_NODE,
          index: process.env.ELASTICSEARCH_INDEX || 'soc-logs',
        }
      : undefined,
    console: process.env.NODE_ENV !== 'production',
    file: process.env.LOG_FILE
      ? {
          filename: process.env.LOG_FILE,
          maxSize: process.env.LOG_FILE_MAX_SIZE || '10m',
          maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES || '5'),
        }
      : undefined,
  },
};

export const testMonitoringConfig: MonitoringConfig = {
  metrics: {
    serviceName: 'control-service-test',
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
    serviceName: 'control-service-test',
    endpoint: '',
    enabled: false,
    samplingRatio: 0,
    headers: {},
  },
  logging: {
    serviceName: 'control-service-test',
    level: 'error',
    elasticsearch: undefined,
    console: false,
    file: undefined,
  },
};
