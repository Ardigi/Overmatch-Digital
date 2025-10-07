/**
 * Integration Test Setup - Client Service
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

  toBeValidSlug(received: string) {
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const pass = slugRegex.test(received);
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid slug`,
      pass,
    };
  },

  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be within range ${floor} - ${ceiling}`,
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
    database: process.env.DB_NAME || 'soc_clients_test',
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
    db: 2, // Use different DB for client service tests
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
  if (!dataSource.isInitialized) return;

  // Clean up test data in dependency order
  await dataSource.query('DELETE FROM client_users WHERE organization_id = $1', [organizationId]);
  await dataSource.query('DELETE FROM client_documents WHERE organization_id = $1', [
    organizationId,
  ]);
  await dataSource.query('DELETE FROM client_audits WHERE organization_id = $1', [organizationId]);
  await dataSource.query('DELETE FROM contracts WHERE organization_id = $1', [organizationId]);
  await dataSource.query('DELETE FROM clients WHERE organization_id = $1', [organizationId]);
  await dataSource.query('DELETE FROM audit_trails WHERE organization_id = $1', [organizationId]);
};

// Test data factories
(global as any).createTestClient = (overrides = {}) => {
  const timestamp = Date.now();
  return {
    name: `Test Client ${timestamp}`,
    legalName: `Test Client LLC ${timestamp}`,
    slug: `test-client-${timestamp}`,
    clientType: 'direct',
    industry: 'technology',
    size: '1-50',
    status: 'active',
    complianceStatus: 'not_started',
    riskLevel: 'medium',
    complianceScore: 0.0,
    contactInfo: {
      primaryContact: {
        name: 'John Doe',
        title: 'CEO',
        email: `john.doe${timestamp}@testclient.com`,
        phone: '+1234567890',
      },
    },
    address: {
      headquarters: {
        street1: '123 Test Street',
        city: 'Test City',
        state: 'TC',
        postalCode: '12345',
        country: 'US',
      },
    },
    settings: {
      timezone: 'America/New_York',
      currency: 'USD',
      language: 'en',
      notifications: {
        email: true,
        sms: false,
        slack: false,
      },
    },
    ...overrides,
  };
};

(global as any).createTestContract = (clientId: string, overrides = {}) => {
  const timestamp = Date.now();
  return {
    clientId,
    contractNumber: `TEST-${timestamp}`,
    title: `Test Contract ${timestamp}`,
    type: 'sow',
    status: 'active',
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    totalValue: 50000,
    currency: 'USD',
    ...overrides,
  };
};

console.log('Integration test setup completed for client-service');
