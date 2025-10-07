export default () => ({
  port: parseInt(process.env.PORT, 10) || 3006,
  environment: process.env.NODE_ENV || 'development',

  database: {
    type: 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'soc_user',
    password: process.env.DB_PASSWORD || 'soc_pass',
    database: process.env.DB_NAME || 'soc_workflows',
    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.DB_LOGGING === 'true',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '30m',
  },

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: 'workflow-service',
    consumerGroup: 'workflow-service-group',
  },

  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  },

  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    path: '/metrics',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
});
