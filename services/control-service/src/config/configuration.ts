/**
 * Secure configuration for Control Service
 * Implements fail-fast pattern for missing environment variables
 * SOC 2 Compliance: No hardcoded credentials allowed
 */

function getRequiredEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`SECURITY ERROR: Required environment variable ${name} is not set. This violates SOC 2 compliance requirements.`);
  }
  return value;
}

function getRequiredEnvVarInt(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`SECURITY ERROR: Required environment variable ${name} is not set. This violates SOC 2 compliance requirements.`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`SECURITY ERROR: Environment variable ${name} must be a valid integer, got: ${value}`);
  }
  return parsed;
}

export default () => ({
  port: getRequiredEnvVarInt('PORT', 3004),
  database: {
    host: getRequiredEnvVar('DB_HOST', '127.0.0.1'),
    port: getRequiredEnvVarInt('DB_PORT', 5432),
    username: getRequiredEnvVar('DB_USERNAME', 'soc_user'),
    // SECURITY: Database password MUST be provided via environment variable
    password: getRequiredEnvVar('DB_PASSWORD'),
    name: getRequiredEnvVar('DB_NAME', 'soc_controls'),
  },
  redis: {
    host: getRequiredEnvVar('REDIS_HOST', '127.0.0.1'),
    port: getRequiredEnvVarInt('REDIS_PORT', 6379),
    // SECURITY: Redis password MUST be provided via environment variable  
    password: getRequiredEnvVar('REDIS_PASSWORD'),
  },
  kafka: {
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['127.0.0.1:9092'],
  },
  controlTesting: {
    defaultFrequencyDays: getRequiredEnvVarInt('DEFAULT_TEST_FREQUENCY_DAYS', 90),
    maxRetries: getRequiredEnvVarInt('MAX_TEST_RETRIES', 3),
    testTimeout: getRequiredEnvVarInt('TEST_TIMEOUT_MS', 300000), // 5 minutes
  },
});
