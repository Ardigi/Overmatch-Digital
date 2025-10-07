/**
 * Integration Test Setup
 *
 * Common setup and utilities for integration tests.
 * This file is run after the test environment is set up.
 */

import Redis from 'ioredis';
import { DataSource } from 'typeorm';

// Extend Jest matchers with custom matchers
expect.extend({
  toBeUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
      pass,
    };
  },
});

// Global test utilities
(global as any).createTestDataSource = (entities: any[]) => {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'soc_user',
    password: process.env.DB_PASSWORD || 'soc_pass',
    database: process.env.DB_NAME || 'soc_auth_test',
    entities,
    synchronize: false, // Use actual migrations
    logging: false,
  });
};

(global as any).createTestRedis = () => {
  return new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || 'soc_redis_pass',
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
};

// Test timeout helpers
(global as any).shortTimeout = 5000; // 5 seconds
(global as any).mediumTimeout = 15000; // 15 seconds
(global as any).longTimeout = 30000; // 30 seconds

// Clean up function for tests
(global as any).cleanupTestData = async (dataSource: DataSource, organizationId: string) => {
  if (!dataSource || !dataSource.isInitialized) return;

  // Clean up test data in dependency order using query runner
  const queryRunner = dataSource.createQueryRunner();
  try {
    await queryRunner.query('DELETE FROM user_roles WHERE organization_id = $1', [organizationId]);
    await queryRunner.query('DELETE FROM users WHERE organization_id = $1', [organizationId]);
    await queryRunner.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    await queryRunner.query('DELETE FROM login_events WHERE organization_id = $1', [organizationId]);
    await queryRunner.query('DELETE FROM audit_logs WHERE organization_id = $1', [organizationId]);
    await queryRunner.query('DELETE FROM api_keys WHERE organization_id = $1', [organizationId]);
    await queryRunner.query('DELETE FROM sso_sessions WHERE organization_id = $1', [organizationId]);
  } catch (error) {
    // Tables might not exist yet if migrations haven't run
    console.error('Warning: Could not clean up test data:', error.message);
  } finally {
    if (queryRunner) {
      await queryRunner.release();
    }
  }
};

console.log('Integration test setup completed for auth-service');
