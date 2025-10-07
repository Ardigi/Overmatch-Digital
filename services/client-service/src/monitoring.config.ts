import type { MonitoringConfig } from '@soc-compliance/monitoring';

export const monitoringConfig: MonitoringConfig = {
  metrics: {
    serviceName: 'client-service',
    port: parseInt(process.env.PORT || '3002'),
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
    serviceName: 'client-service',
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
    enabled: process.env.TRACING_ENABLED !== 'false',
    samplingRatio: parseFloat(process.env.TRACING_SAMPLING_RATIO || '1.0'),
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
      ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
      : {}, // Use empty object instead of undefined
  },
  logging: {
    serviceName: 'client-service',
    level: process.env.LOG_LEVEL || 'info',
    elasticsearch: process.env.ELASTICSEARCH_NODE
      ? {
          node: process.env.ELASTICSEARCH_NODE,
          index: process.env.ELASTICSEARCH_INDEX || 'soc-logs',
        }
      : null, // Use null instead of undefined for optional configs
    console: process.env.NODE_ENV !== 'production',
    file: process.env.LOG_FILE
      ? {
          filename: process.env.LOG_FILE,
          maxSize: process.env.LOG_FILE_MAX_SIZE || '10m',
          maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES || '5'),
        }
      : null, // Use null instead of undefined for optional configs
  },
};

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
