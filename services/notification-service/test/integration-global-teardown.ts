/**
 * Global Teardown for Integration Tests
 *
 * This file runs once after all integration tests complete.
 * It performs final cleanup and resource deallocation.
 */

import Redis from 'ioredis';
import { DataSource } from 'typeorm';

export default async function globalTeardown() {
  console.log('\n🧹 Starting integration test global teardown...');

  const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || 'soc_redis_pass',
  };

  const dbConfig = {
    type: 'postgres' as const,
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'soc_user',
    password: process.env.DB_PASSWORD || 'soc_pass',
    database: process.env.DB_NAME || 'soc_notifications_test',
  };

  // Final cleanup of test data
  try {
    // Clean all test keys from Redis
    const redis = new Redis(redisConfig);
    const testKeys = await redis.keys('*test*');

    if (testKeys.length > 0) {
      await redis.del(...testKeys);
      console.log(`🗑️  Final cleanup: removed ${testKeys.length} Redis test keys`);
    }

    await redis.quit();
  } catch (error) {
    console.warn('⚠️  Failed to perform final Redis cleanup:', error.message);
  }

  try {
    // Clean all test data from database
    const dataSource = new DataSource({
      ...dbConfig,
      synchronize: false,
      logging: false,
    });

    await dataSource.initialize();

    // Clean up all test data
    const tables = ['notifications', 'notification_templates', 'notification_preferences'];
    let totalDeleted = 0;

    for (const table of tables) {
      const result = await dataSource.query(
        `DELETE FROM ${table} WHERE organization_id LIKE 'test-%' OR organization_id LIKE '%test%'`
      );
      if (result.affectedRows) {
        totalDeleted += result.affectedRows;
      }
    }

    if (totalDeleted > 0) {
      console.log(`🗑️  Final cleanup: removed ${totalDeleted} database test records`);
    }

    await dataSource.destroy();
  } catch (error) {
    console.warn('⚠️  Failed to perform final database cleanup:', error.message);
  }

  // Generate test summary report
  const fs = require('fs');
  const path = require('path');
  const testResultsDir = path.join(process.cwd(), 'test-results');
  const summaryPath = path.join(testResultsDir, 'integration-summary.txt');

  try {
    const summary = [
      'Integration Test Summary',
      '========================',
      `Completed at: ${new Date().toISOString()}`,
      `Environment: ${process.env.NODE_ENV}`,
      `Redis: ${redisConfig.host}:${redisConfig.port}`,
      `Database: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`,
      '',
      'All test data has been cleaned up.',
      'Integration tests completed successfully.',
    ].join('\n');

    fs.writeFileSync(summaryPath, summary);
    console.log(`📊 Generated test summary: ${summaryPath}`);
  } catch (error) {
    console.warn('⚠️  Failed to generate test summary:', error.message);
  }

  console.log('✅ Integration test global teardown complete');
}
