import { registerAs } from '@nestjs/config';

export interface PolicyServiceConfig {
  port: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    synchronize: boolean;
    logging: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  opa: {
    url: string;
    policyPath: string;
    timeout: number;
    retries: number;
  };
  redis: {
    host: string;
    port: number;
    password: string;
    ttl: number;
  };
  elasticsearch: {
    node: string;
    index: string;
    apiKey?: string;
  };
  kafka: {
    brokers: string[];
    clientId: string;
    consumerGroup: string;
  };
  rateLimit: {
    ttl: number;
    limit: number;
  };
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  audit: {
    retentionDays: number;
    cleanupEnabled: boolean;
  };
  security: {
    apiKeyPrefix: string;
    bcryptRounds: number;
    sessionTimeout: number;
  };
  monitoring: {
    failedAuthThreshold: number;
    failedAuthWindow: number;
    rateLimitThreshold: number;
    rateLimitWindow: number;
    downloadThreshold: number;
    downloadWindow: number;
    apiKeyAnomalyThreshold: number;
  };
  observability: {
    tracing: {
      enabled: boolean;
      jaegerEndpoint: string;
      serviceName: string;
      serviceVersion: string;
    };
    metrics: {
      enabled: boolean;
      prometheusPort: number;
      prometheusPath: string;
    };
    logging: {
      enabled: boolean;
      level: string;
      format: string;
      elasticsearch: {
        enabled: boolean;
        node: string;
        index: string;
      };
    };
  };
}

export default registerAs(
  'policyService',
  (): PolicyServiceConfig => ({
    port: parseInt(process.env.PORT, 10) || 3003,
    database: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      username: process.env.DB_USERNAME || 'soc_user',
      password: process.env.DB_PASSWORD || 'soc_pass',
      database: process.env.DB_NAME || 'soc_policies',
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development',
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'policy-service-secret',
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    },
    opa: {
      url: process.env.OPA_URL || 'http://localhost:8181',
      policyPath: process.env.OPA_POLICY_PATH || '/v1/data/soc2/compliance',
      timeout: parseInt(process.env.OPA_TIMEOUT, 10) || 5000,
      retries: parseInt(process.env.OPA_RETRIES, 10) || 3,
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      password: process.env.REDIS_PASSWORD || 'soc_redis_pass',
      ttl: parseInt(process.env.CACHE_TTL, 10) || 3600, // 1 hour default
    },
    elasticsearch: {
      node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
      index: process.env.ELASTICSEARCH_INDEX || 'policies',
      apiKey: process.env.ELASTICSEARCH_API_KEY,
    },
    kafka: {
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      clientId: process.env.KAFKA_CLIENT_ID || 'policy-service',
      consumerGroup: process.env.KAFKA_CONSUMER_GROUP || 'policy-service-group',
    },
    rateLimit: {
      ttl: parseInt(process.env.RATE_LIMIT_TTL, 10) || 60, // 1 minute
      limit: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    },
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
    audit: {
      retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS, 10) || 90,
      cleanupEnabled: process.env.AUDIT_CLEANUP_ENABLED !== 'false',
    },
    security: {
      apiKeyPrefix: process.env.API_KEY_PREFIX || 'sk_',
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
      sessionTimeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 3600, // 1 hour
    },
    monitoring: {
      failedAuthThreshold: parseInt(process.env.MONITORING_FAILED_AUTH_THRESHOLD, 10) || 5,
      failedAuthWindow: parseInt(process.env.MONITORING_FAILED_AUTH_WINDOW, 10) || 10, // minutes
      rateLimitThreshold: parseInt(process.env.MONITORING_RATE_LIMIT_THRESHOLD, 10) || 20,
      rateLimitWindow: parseInt(process.env.MONITORING_RATE_LIMIT_WINDOW, 10) || 5, // minutes
      downloadThreshold: parseInt(process.env.MONITORING_DOWNLOAD_THRESHOLD, 10) || 50,
      downloadWindow: parseInt(process.env.MONITORING_DOWNLOAD_WINDOW, 10) || 60, // minutes
      apiKeyAnomalyThreshold: parseInt(process.env.MONITORING_API_KEY_ANOMALY_THRESHOLD, 10) || 200, // percentage
    },
    observability: {
      tracing: {
        enabled: process.env.ENABLE_TRACING !== 'false',
        jaegerEndpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
        serviceName: 'policy-service',
        serviceVersion: process.env.SERVICE_VERSION || '1.0.0',
      },
      metrics: {
        enabled: process.env.ENABLE_METRICS !== 'false',
        prometheusPort: parseInt(process.env.METRICS_PORT, 10) || 9091,
        prometheusPath: process.env.METRICS_PATH || '/metrics',
      },
      logging: {
        enabled: process.env.ENABLE_LOGGING !== 'false',
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'json',
        elasticsearch: {
          enabled: process.env.ENABLE_LOG_ELASTICSEARCH === 'true',
          node: process.env.ELASTICSEARCH_LOGS_NODE || process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
          index: process.env.ELASTICSEARCH_LOGS_INDEX || 'policy-service-logs',
        },
      },
    },
  })
);
