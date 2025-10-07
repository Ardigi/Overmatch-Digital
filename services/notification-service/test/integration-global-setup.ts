/**
 * Global Setup for Integration Tests
 *
 * This file runs once before all integration tests.
 * It performs global setup and verification.
 */

import axios from 'axios';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

export default async function globalSetup() {
  console.log('🚀 Starting integration test global setup...');

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

  // Clean up any leftover test data from previous runs
  console.log('🧹 Cleaning up previous test data...');

  try {
    // Clean Redis
    const redis = new Redis(redisConfig);
    const testKeys = await redis.keys('integration-test:*');
    const cacheTestKeys = await redis.keys('cache-test:*');
    const allTestKeys = [...testKeys, ...cacheTestKeys];

    if (allTestKeys.length > 0) {
      await redis.del(...allTestKeys);
      console.log(`🗑️  Cleaned ${allTestKeys.length} Redis keys from previous runs`);
    }

    await redis.quit();
  } catch (error) {
    console.warn('⚠️  Failed to clean Redis (may not be available yet):', error.message);
  }

  try {
    // Clean database test data
    const dataSource = new DataSource({
      ...dbConfig,
      synchronize: false,
      logging: false,
    });

    await dataSource.initialize();

    // Clean up test data (organizations starting with 'test-')
    await dataSource.query(`
      DELETE FROM notifications WHERE organization_id LIKE 'test-%'
    `);
    await dataSource.query(`
      DELETE FROM notification_templates WHERE organization_id LIKE 'test-%'
    `);
    await dataSource.query(`
      DELETE FROM notification_preferences WHERE organization_id LIKE 'test-%'
    `);

    console.log('🗑️  Cleaned database test data from previous runs');

    await dataSource.destroy();
  } catch (error) {
    console.warn('⚠️  Failed to clean database (may not be available yet):', error.message);
  }

  // Create test data directory
  const fs = require('fs');
  const path = require('path');
  const testResultsDir = path.join(process.cwd(), 'test-results');

  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, { recursive: true });
    console.log('📁 Created test results directory');
  }

  console.log('✅ Integration test global setup complete\n');
}
