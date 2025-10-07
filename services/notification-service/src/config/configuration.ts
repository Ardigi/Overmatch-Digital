export default () => ({
  app: {
    env: process.env.NODE_ENV || 'development',
  },
  port: parseInt(process.env.PORT, 10) || 3010,

  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'soc_user',
    password: process.env.DB_PASSWORD || 'soc_pass',
    database: process.env.DB_NAME || 'soc_notifications',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
  },

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'notification-service',
    groupId: process.env.KAFKA_GROUP_ID || 'notification-service-group',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    from: process.env.SMTP_FROM || 'noreply@soc-compliance.com',
    fromName: process.env.SMTP_FROM_NAME || 'SOC Compliance Platform',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
  },

  slack: {
    botToken: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  },

  queue: {
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  },

  tracking: {
    baseUrl: process.env.TRACKING_BASE_URL || 'http://localhost:3006',
  },

  cors: {
    origins: process.env.CORS_ORIGINS || 'http://localhost:3000',
  },

  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:3001',
    client: process.env.CLIENT_SERVICE_URL || 'http://127.0.0.1:3002',
    policy: process.env.POLICY_SERVICE_URL || 'http://127.0.0.1:3003',
    control: process.env.CONTROL_SERVICE_URL || 'http://127.0.0.1:3004',
    evidence: process.env.EVIDENCE_SERVICE_URL || 'http://127.0.0.1:3005',
    workflow: process.env.WORKFLOW_SERVICE_URL || 'http://127.0.0.1:3006',
    reporting: process.env.REPORTING_SERVICE_URL || 'http://127.0.0.1:3007',
    audit: process.env.AUDIT_SERVICE_URL || 'http://127.0.0.1:3008',
    integration: process.env.INTEGRATION_SERVICE_URL || 'http://127.0.0.1:3009',
    ai: process.env.AI_SERVICE_URL || 'http://127.0.0.1:3011',
  },
});
