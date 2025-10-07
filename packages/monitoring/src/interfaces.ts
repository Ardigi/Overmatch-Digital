export interface MetricsConfig {
  serviceName: string;
  port?: number;
  path?: string;
  defaultLabels?: Record<string, string>;
  enableDefaultMetrics?: boolean;
  prefix?: string;
}

export interface TracingConfig {
  serviceName: string;
  endpoint?: string;
  headers?: Record<string, string>;
  enabled?: boolean;
  samplingRatio?: number;
}

export interface LoggingConfig {
  serviceName: string;
  level?: string;
  elasticsearch?: {
    node: string;
    index?: string;
  };
  console?: boolean;
  file?: {
    filename: string;
    maxSize?: string;
    maxFiles?: number;
  };
}

export interface MonitoringConfig {
  metrics: MetricsConfig;
  tracing: TracingConfig;
  logging: LoggingConfig;
}

export interface LogContext {
  correlationId?: string;
  userId?: string;
  organizationId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  [key: string]: any;
}
