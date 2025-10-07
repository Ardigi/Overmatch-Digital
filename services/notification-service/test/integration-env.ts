/**
 * Integration Test Environment Variables
 *
 * Set up environment variables for integration tests
 */

// Ensure we're in test environment
process.env.NODE_ENV = 'test';

// Database configuration for integration tests
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_USERNAME = process.env.DB_USERNAME || 'soc_user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'soc_pass';
process.env.DB_NAME = process.env.DB_NAME || 'soc_notifications_test';

// Redis configuration for integration tests
process.env.REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'soc_redis_pass';

// Service URLs for integration tests
process.env.AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:3001';
process.env.CLIENT_SERVICE_URL = process.env.CLIENT_SERVICE_URL || 'http://127.0.0.1:3002';

// API Key for service communication
process.env.API_KEY = process.env.API_KEY || 'test-api-key';

// Disable Kafka for faster tests (unless explicitly enabled)
if (!process.env.ENABLE_KAFKA_INTEGRATION) {
  process.env.DISABLE_KAFKA = 'true';
}

// Disable graceful degradation for integration tests
process.env.CACHE_GRACEFUL_DEGRADATION = 'false';

// Set reasonable timeouts
process.env.HTTP_TIMEOUT = process.env.HTTP_TIMEOUT || '10000';
process.env.CACHE_TIMEOUT = process.env.CACHE_TIMEOUT || '5000';
process.env.DB_TIMEOUT = process.env.DB_TIMEOUT || '10000';

// Logging configuration
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'warn'; // Reduce noise in tests

// Test-specific configurations
process.env.INTEGRATION_TEST = 'true';
process.env.TEST_TIMEOUT = '60000';

console.log('🔧 Integration test environment configured');
