/**
 * Integration Test Environment Variables
 *
 * Sets up environment variables for integration tests that require
 * real infrastructure connections.
 */

// Database configuration for integration tests
process.env.NODE_ENV = 'test';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '5432';
process.env.DB_USERNAME = 'soc_user';
process.env.DB_PASSWORD = 'soc_pass';
process.env.DB_NAME = 'soc_auth_test';

// Redis configuration for integration tests
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = 'soc_redis_pass';

// JWT configuration for integration tests
process.env.JWT_SECRET = 'integration-test-jwt-secret-key-for-auth-service';
process.env.JWT_EXPIRES_IN = '30m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

// Disable external services for integration tests
process.env.DISABLE_KAFKA = 'true';
process.env.DISABLE_EMAIL = 'true';

// Encryption keys for integration tests
process.env.ENCRYPTION_KEY = 'integration-test-encryption-key-32-chars';

// Rate limiting configuration (more lenient for tests)
process.env.RATE_LIMIT_WINDOW = '60000'; // 1 minute
process.env.RATE_LIMIT_MAX_REQUESTS = '1000'; // Higher limit for tests

// MFA configuration
process.env.MFA_ISSUER = 'SOC-Compliance-Integration-Test';

// Session configuration
process.env.SESSION_SECRET = 'integration-test-session-secret';
process.env.SESSION_TTL = '3600'; // 1 hour

// API Key configuration
process.env.API_KEY_LENGTH = '32';
process.env.API_KEY_PREFIX = 'soc_int_test_';

// Logging configuration (reduce noise in tests)
process.env.LOG_LEVEL = 'warn';

console.log('Integration test environment configured for auth-service');
