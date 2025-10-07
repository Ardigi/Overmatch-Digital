# Real Integration Test Template

This template provides guidelines for creating **REAL** integration tests that test actual infrastructure connectivity and service-to-service communication. These tests must fail if dependencies are unavailable - no graceful degradation or mocks.

## Key Principles

1. **FAIL FAST**: Tests must fail if required infrastructure is unavailable
2. **NO GRACEFUL DEGRADATION**: Integration tests should not have fallback behavior
3. **REAL CONNECTIONS**: Use actual Redis, databases, and HTTP services
4. **NO MOCKS**: Test against real implementations, not mocks
5. **ISOLATION**: Clean up test data between tests

## Test Categories

### 1. Redis Cache Integration Tests

**Purpose**: Validate actual Redis connectivity and cache operations

**Requirements**:
- Redis must be running and accessible
- Tests fail if Redis is unavailable
- No graceful degradation in cache service configuration

**Template**:
```typescript
/**
 * REAL Redis Cache Integration Test
 * 
 * Prerequisites:
 * - Redis must be running on 127.0.0.1:6379
 * - Redis must be accessible with correct credentials
 */

import Redis from 'ioredis';
import { CacheService } from '@soc-compliance/cache-common';

describe('Redis Cache Integration (REAL)', () => {
  let cacheService: CacheService;
  let redis: Redis;

  const REDIS_CONFIG = {
    host: '127.0.0.1',
    port: 6379,
    password: process.env.REDIS_PASSWORD || 'soc_redis_pass',
  };

  beforeAll(async () => {
    // CRITICAL: Test must fail if Redis is unavailable
    redis = new Redis(REDIS_CONFIG);
    
    try {
      const pingResult = await redis.ping();
      if (pingResult !== 'PONG') {
        throw new Error(`Redis ping failed: ${pingResult}`);
      }
    } catch (error) {
      await redis.quit();
      throw new Error(
        `Redis connection failed: ${error.message}. ` +
        'Integration tests require actual Redis connectivity. ' +
        'Start Redis with: docker-compose up redis'
      );
    }

    // Create cache service with NO graceful degradation
    cacheService = new CacheService({
      redis: REDIS_CONFIG,
      defaultTtl: 60,
      keyPrefix: 'integration-test',
      enabled: true,
      gracefulDegradation: false, // CRITICAL: Must fail if Redis unavailable
    });

    const isHealthy = await cacheService.isHealthy();
    if (!isHealthy) {
      throw new Error('CacheService failed to connect to Redis');
    }
  });

  afterAll(async () => {
    await cacheService.close();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clear test data from Redis before each test
    await redis.flushdb();
  });

  it('should require active Redis connection (no graceful degradation)', async () => {
    const pingResult = await redis.ping();
    expect(pingResult).toBe('PONG');
    
    const isHealthy = await cacheService.isHealthy();
    expect(isHealthy).toBe(true);
  });

  it('should perform actual cache operations', async () => {
    const key = 'test-key';
    const value = { test: 'data', timestamp: Date.now() };

    // Set value in cache
    const setResult = await cacheService.set(key, value);
    expect(setResult).toBe(true);

    // Verify value is actually in Redis
    const redisValue = await redis.get(`integration-test:${key}`);
    expect(redisValue).toBeTruthy();
    expect(JSON.parse(redisValue!)).toEqual(value);

    // Get value through cache service
    const retrievedValue = await cacheService.get(key);
    expect(retrievedValue).toEqual(value);
  });
});
```

### 2. Database Integration Tests

**Purpose**: Validate actual database connectivity and TypeORM operations

**Requirements**:
- Database must be running with proper schema
- Tests fail if database is unavailable
- Use actual migrations, not synchronize

**Template**:
```typescript
/**
 * REAL Database Integration Test
 * 
 * Prerequisites:
 * - PostgreSQL must be running with test database
 * - Database migrations must be applied
 */

import { DataSource, Repository } from 'typeorm';
import { YourEntity } from '../entities/your-entity.entity';

describe('Database Integration (REAL)', () => {
  let dataSource: DataSource;
  let repository: Repository<YourEntity>;

  const TEST_ORG_ID = 'test-org-' + Date.now();

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'soc_user',
      password: process.env.DB_PASSWORD || 'soc_pass',
      database: process.env.DB_NAME || 'soc_your_service_test',
      entities: [YourEntity],
      synchronize: false, // Use actual migrations
      logging: false,
    });

    try {
      await dataSource.initialize();
    } catch (error) {
      throw new Error(
        `Database connection failed: ${error.message}. ` +
        'Integration tests require actual database connectivity. ' +
        'Start database with: docker-compose up postgres'
      );
    }

    repository = dataSource.getRepository(YourEntity);

    // Verify database schema exists
    const tables = await dataSource.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const tableNames = tables.map(t => t.table_name);
    expect(tableNames).toContain('your_entities');
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clean up test data
    await repository.delete({ organizationId: TEST_ORG_ID });
  });

  it('should require active database connection', async () => {
    expect(dataSource.isInitialized).toBe(true);
    const result = await dataSource.query('SELECT 1 as test');
    expect(result[0].test).toBe(1);
  });

  it('should perform real CRUD operations', async () => {
    // CREATE
    const entity = repository.create({
      organizationId: TEST_ORG_ID,
      name: 'Integration Test Entity',
      // ... other required fields
    });

    const saved = await repository.save(entity);
    expect(saved.id).toBeDefined();

    // READ
    const found = await repository.findOne({
      where: { id: saved.id },
    });
    expect(found).toBeDefined();
    expect(found!.name).toBe('Integration Test Entity');

    // UPDATE
    found!.name = 'Updated Entity';
    const updated = await repository.save(found!);
    expect(updated.name).toBe('Updated Entity');

    // DELETE
    await repository.remove(updated);
    const deleted = await repository.findOne({ where: { id: saved.id } });
    expect(deleted).toBeNull();
  });
});
```

### 3. Service Communication Integration Tests

**Purpose**: Validate actual HTTP communication between services

**Requirements**:
- Target services must be running and accessible
- Tests fail if services are unavailable
- Use real HTTP calls, not mocks

**Template**:
```typescript
/**
 * REAL Service Communication Integration Test
 * 
 * Prerequisites:
 * - Target services must be running
 * - Services must be accessible and healthy
 */

import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import { YourService } from '../your.service';

describe('Service Communication Integration (REAL)', () => {
  let yourService: YourService;
  let serviceDiscovery: ServiceDiscoveryService;

  const TARGET_SERVICE_URL = 'http://127.0.0.1:3001';
  const API_KEY = 'test-api-key';

  beforeAll(async () => {
    // Verify target service is running
    const axios = require('axios');
    try {
      const health = await axios.get(`${TARGET_SERVICE_URL}/health`, {
        headers: { 'X-API-Key': API_KEY },
        timeout: 5000,
      });
      if (health.status !== 200) {
        throw new Error(`Service health check failed: ${health.status}`);
      }
    } catch (error) {
      throw new Error(
        `Target service is not available at ${TARGET_SERVICE_URL}: ${error.message}. ` +
        'Integration tests require actual service connectivity. ' +
        'Start service with: cd services/target-service && npm run start:dev'
      );
    }

    serviceDiscovery = new ServiceDiscoveryService({
      services: {
        'target-service': { baseUrl: TARGET_SERVICE_URL, apiKey: API_KEY },
      },
      timeout: 10000,
      retries: 3,
    });

    yourService = new YourService(serviceDiscovery);
  });

  it('should verify target service is healthy', async () => {
    const response = await serviceDiscovery.callService(
      'target-service',
      'GET',
      '/health'
    );
    
    expect(response.success).toBe(true);
    expect(response.data?.status).toBe('ok');
  });

  it('should make real service calls', async () => {
    const result = await yourService.callTargetService('test-data');
    
    // Verify actual response structure
    expect(result).toBeDefined();
    // Add specific assertions based on your service's behavior
  });

  it('should handle service errors appropriately', async () => {
    // Test error handling with invalid requests
    const result = await yourService.callTargetService('invalid-data');
    
    // Should handle errors gracefully or throw as appropriate
    expect(result === null || typeof result === 'object').toBe(true);
  });
});
```

## Test Execution

### Prerequisites

1. **Infrastructure Setup**:
   ```bash
   # Start required infrastructure
   docker-compose up postgres redis kafka mongodb elasticsearch
   
   # Run database migrations
   npm run migration:run
   
   # Start target services
   cd services/auth-service && npm run start:dev &
   cd services/client-service && npm run start:dev &
   ```

2. **Environment Variables**:
   ```bash
   export DB_HOST=127.0.0.1
   export DB_PORT=5432
   export DB_USERNAME=soc_user
   export DB_PASSWORD=soc_pass
   export REDIS_PASSWORD=soc_redis_pass
   ```

### Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test
npm test -- integration/redis-cache.integration.spec.ts

# Run with verbose output
npm test -- integration/ --verbose
```

### Test Configuration

Create `jest.integration.config.js`:
```javascript
module.exports = {
  displayName: 'Integration Tests',
  testMatch: ['**/*.integration.spec.ts'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/integration-setup.ts'],
  testTimeout: 30000, // Longer timeout for real operations
  maxWorkers: 1, // Run sequentially to avoid conflicts
};
```

## Common Patterns

### 1. Infrastructure Verification

Always verify infrastructure is available before running tests:

```typescript
beforeAll(async () => {
  // Verify Redis
  const redis = new Redis(REDIS_CONFIG);
  try {
    await redis.ping();
  } catch (error) {
    throw new Error('Redis is required for integration tests');
  }
  await redis.quit();
  
  // Verify Database
  const connection = await createConnection(DB_CONFIG);
  try {
    await connection.query('SELECT 1');
  } catch (error) {
    throw new Error('Database is required for integration tests');
  }
  await connection.close();
});
```

### 2. Test Data Cleanup

Always clean up test data:

```typescript
beforeEach(async () => {
  // Clean test data before each test
  await redis.flushdb();
  await repository.delete({ organizationId: TEST_ORG_ID });
});

afterAll(async () => {
  // Final cleanup
  await cacheService.deletePattern('integration-test:*');
  await repository.delete({ organizationId: TEST_ORG_ID });
});
```

### 3. Error Handling Verification

Test real error scenarios:

```typescript
it('should handle infrastructure failures', async () => {
  // Test with disconnected service
  const failingService = new ServiceDiscoveryService({
    services: {
      'target': { baseUrl: 'http://127.0.0.1:9999' } // Non-existent
    },
    timeout: 1000,
    retries: 1,
  });
  
  const result = await failingService.callService('target', 'GET', '/test');
  expect(result.success).toBe(false);
});
```

## Anti-Patterns to Avoid

### ❌ Don't Do This

```typescript
// Graceful degradation in integration tests
const cacheService = new CacheService({
  gracefulDegradation: true, // ❌ NO!
});

// Mocking infrastructure
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
}; // ❌ NO!

// Ignoring connection failures
try {
  await redis.connect();
} catch (error) {
  // Ignore and continue // ❌ NO!
}
```

### ✅ Do This Instead

```typescript
// Fail fast on infrastructure unavailability
const cacheService = new CacheService({
  gracefulDegradation: false, // ✅ YES!
});

// Use real Redis
const redis = new Redis(REDIS_CONFIG); // ✅ YES!

// Fail tests if connections fail
try {
  await redis.connect();
} catch (error) {
  throw new Error('Redis required for integration tests'); // ✅ YES!
}
```

## Documentation

For each integration test file, include:

1. **Prerequisites comment** at the top
2. **Setup instructions** in the describe block
3. **Cleanup procedures** in afterAll/afterEach
4. **Error scenarios** that are tested
5. **Performance expectations** where relevant

## Monitoring Integration Test Health

Consider adding a script to verify integration test environment:

```bash
#!/bin/bash
# verify-integration-env.sh

echo "Checking integration test prerequisites..."

# Check Redis
redis-cli -h 127.0.0.1 -p 6379 ping || { echo "Redis not available"; exit 1; }

# Check PostgreSQL
psql -h 127.0.0.1 -p 5432 -U soc_user -d soc_notifications_test -c "SELECT 1" || { echo "Database not available"; exit 1; }

# Check services
curl -f http://127.0.0.1:3001/health || { echo "Auth service not available"; exit 1; }
curl -f http://127.0.0.1:3002/health || { echo "Client service not available"; exit 1; }

echo "✅ All integration test prerequisites are available"
```

This template ensures that integration tests actually test real infrastructure and service communication, providing confidence that the system works in production environments.
