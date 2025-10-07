/**
 * Global Integration Test Setup - Client Service
 *
 * Runs once before all integration tests start.
 * Validates that required infrastructure is available.
 */

import Redis from 'ioredis';
import { DataSource } from 'typeorm';

export default async () => {
  console.log('🚀 Starting Client Service Integration Test Global Setup...');

  // Test database connectivity
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'soc_user',
    password: process.env.DB_PASSWORD || 'soc_pass',
    database: process.env.DB_NAME || 'soc_clients_test',
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connection verified');

    // Verify required tables exist
    const tables = await dataSource.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const tableNames = tables.map((t) => t.table_name);

    const requiredTables = [
      'clients',
      'contracts',
      'client_users',
      'client_documents',
      'audit_trails',
    ];
    const missingTables = requiredTables.filter((table) => !tableNames.includes(table));

    if (missingTables.length > 0) {
      throw new Error(
        `Missing required tables: ${missingTables.join(', ')}. Run migrations first.`
      );
    }

    console.log('✅ Database schema verified');
    await dataSource.destroy();
  } catch (error) {
    await dataSource.destroy();
    throw new Error(
      `❌ Database setup failed: ${error.message}\\n` +
        'Required infrastructure for integration tests:\\n' +
        '1. Run: docker-compose up postgres\\n' +
        '2. Run: npm run migration:run\\n' +
        '3. Ensure test database exists: soc_clients_test'
    );
  }

  // Test Redis connectivity
  const redis = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || 'soc_redis_pass',
    db: 2, // Use different DB for client service
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  try {
    await redis.connect();
    const pingResult = await redis.ping();

    if (pingResult !== 'PONG') {
      throw new Error(`Redis ping failed: ${pingResult}`);
    }

    console.log('✅ Redis connection verified');
    await redis.quit();
  } catch (error) {
    await redis.quit();
    throw new Error(
      `❌ Redis setup failed: ${error.message}\\n` +
        'Required infrastructure for integration tests:\\n' +
        '1. Run: docker-compose up redis\\n' +
        '2. Ensure Redis is accessible on 127.0.0.1:6379\\n' +
        '3. Verify Redis password: soc_redis_pass'
    );
  }

  console.log('🎉 Client Service Integration Test Global Setup Complete');
};
