/**
 * Integration Test Setup
 *
 * This file configures the test environment for real integration tests.
 * It ensures that all required infrastructure is available before tests run.
 */

import axios from 'axios';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

// Extend Jest timeout for integration tests
jest.setTimeout(60000);

// Global test configuration
const INTEGRATION_CONFIG = {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || 'soc_redis_pass',
  },
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'soc_user',
    password: process.env.DB_PASSWORD || 'soc_pass',
    database: process.env.DB_NAME || 'soc_notifications_test',
  },
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:3001',
    client: process.env.CLIENT_SERVICE_URL || 'http://127.0.0.1:3002',
  },
  apiKey: process.env.API_KEY || 'test-api-key',
};

/**
 * Verify infrastructure availability before running tests
 */
beforeAll(async () => {
  console.log('🔍 Verifying integration test prerequisites...');

  const errors: string[] = [];

  // Verify Redis connectivity
  try {
    const redis = new Redis(INTEGRATION_CONFIG.redis);
    const pingResult = await redis.ping();
    if (pingResult !== 'PONG') {
      errors.push(`Redis ping failed: ${pingResult}`);
    } else {
      console.log('✅ Redis is available');
    }
    await redis.quit();
  } catch (error) {
    errors.push(`Redis connection failed: ${error.message}`);
  }

  // Verify Database connectivity
  try {
    const dataSource = new DataSource({
      type: 'postgres',
      ...INTEGRATION_CONFIG.database,
      synchronize: false,
      logging: false,
    });

    await dataSource.initialize();
    await dataSource.query('SELECT 1');
    console.log('✅ Database is available');
    await dataSource.destroy();
  } catch (error) {
    errors.push(`Database connection failed: ${error.message}`);
  }

  // Verify Service availability (optional - some tests may not need all services)
  for (const [serviceName, serviceUrl] of Object.entries(INTEGRATION_CONFIG.services)) {
    try {
      const response = await axios.get(`${serviceUrl}/health`, {
        headers: { 'X-API-Key': INTEGRATION_CONFIG.apiKey },
        timeout: 5000,
      });

      if (response.status === 200) {
        console.log(`✅ ${serviceName} service is available`);
      } else {
        console.warn(`⚠️  ${serviceName} service health check returned ${response.status}`);
      }
    } catch (error) {
      console.warn(`⚠️  ${serviceName} service is not available: ${error.message}`);
      // Don't fail for service unavailability - individual tests will handle this
    }
  }

  // Fail if critical infrastructure is unavailable
  if (errors.length > 0) {
    console.error('❌ Integration test prerequisites not met:');
    errors.forEach((error) => console.error(`   ${error}`));
    console.error('\n💡 To fix this, ensure the following are running:');
    console.error('   docker-compose up postgres redis');
    console.error('   cd services/auth-service && npm run start:dev');
    console.error('   cd services/client-service && npm run start:dev');

    throw new Error(
      'Integration tests require actual infrastructure. ' + `Failed checks: ${errors.join(', ')}`
    );
  }

  console.log('🎉 All integration test prerequisites are available\n');
});

/**
 * Global cleanup after all tests
 */
afterAll(async () => {
  console.log('🧹 Cleaning up integration test environment...');

  // Clean up any global test data
  try {
    const redis = new Redis(INTEGRATION_CONFIG.redis);
    const testKeys = await redis.keys('integration-test:*');
    if (testKeys.length > 0) {
      await redis.del(...testKeys);
      console.log(`🗑️  Cleaned up ${testKeys.length} Redis test keys`);
    }
    await redis.quit();
  } catch (error) {
    console.warn('⚠️  Failed to clean up Redis test data:', error.message);
  }

  console.log('✅ Integration test cleanup complete');
});

/**
 * Export configuration for use in tests
 */
export { INTEGRATION_CONFIG };

/**
 * Utility functions for integration tests
 */
export const integrationTestUtils = {
  /**
   * Generate unique test identifier
   */
  generateTestId: (prefix: string = 'test') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

  /**
   * Wait for a condition to be true
   */
  waitFor: async (
    condition: () => Promise<boolean>,
    timeout: number = 10000,
    interval: number = 100
  ) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  /**
   * Retry an operation with exponential backoff
   */
  retry: async <T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> => {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts) {
          break;
        }

        const delay = baseDelay * 2 ** (attempt - 1);
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  },
};
