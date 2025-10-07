/**
 * Integration Test Environment Variables - Client Service
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
process.env.DB_NAME = 'soc_clients_test';

// Redis configuration for integration tests
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = 'soc_redis_pass';

// Auth service configuration for integration tests
process.env.AUTH_SERVICE_URL = 'http://localhost:3001';
process.env.JWT_SECRET = 'integration-test-jwt-secret-key-for-client-service';

// Cache configuration
process.env.CACHE_TTL = '300'; // 5 minutes for tests
process.env.CACHE_PREFIX = 'client-service-integration-test';

// Disable external services for integration tests
process.env.DISABLE_KAFKA = 'true';
process.env.DISABLE_EMAIL = 'true';

// API configuration
process.env.API_VERSION = 'v1';
process.env.API_PREFIX = 'api';

// Multi-tenancy configuration
process.env.ENABLE_MULTI_TENANCY = 'true';
process.env.DEFAULT_ORGANIZATION_ID = 'default-org';

// File upload configuration (for document tests)
process.env.UPLOAD_DEST = 'test-uploads';
process.env.MAX_FILE_SIZE = '10485760'; // 10MB

// Audit configuration
process.env.ENABLE_AUDIT_LOGS = 'true';
process.env.AUDIT_RETENTION_DAYS = '90';

// Client management configuration
process.env.DEFAULT_COMPLIANCE_SCORE = '0.0';
process.env.DEFAULT_RISK_LEVEL = 'medium';
process.env.AUTO_GENERATE_SLUG = 'true';

// Service discovery configuration
process.env.SERVICE_DISCOVERY_ENABLED = 'false'; // Disable for integration tests

// Logging configuration (reduce noise in tests)
process.env.LOG_LEVEL = 'warn';

console.log('Integration test environment configured for client-service');
