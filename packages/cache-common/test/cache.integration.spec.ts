import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { CacheConfigFactory, CacheModule, CacheService } from '../index';

describe('CacheService Integration', () => {
  let module: TestingModule;
  let cacheService: CacheService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(),
        CacheModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => CacheConfigFactory.test(),
          inject: [ConfigService],
        }),
      ],
    }).compile();

    cacheService = module.get<CacheService>(CacheService);
  });

  afterAll(async () => {
    if (cacheService) {
      await cacheService.close();
    }
    await module.close();
  });

  describe('Basic Operations', () => {
    const testKey = 'test:key';
    const testValue = { id: '123', name: 'Test User' };

    afterEach(async () => {
      // Clean up after each test
      await cacheService.del(testKey);
    });

    it('should set and get values', async () => {
      // Set value
      const setResult = await cacheService.set(testKey, testValue);
      expect(setResult).toBe(true);

      // Get value
      const getValue = await cacheService.get(testKey);
      expect(getValue).toEqual(testValue);
    });

    it('should return null for non-existent keys', async () => {
      const value = await cacheService.get('non:existent:key');
      expect(value).toBeNull();
    });

    it('should delete keys', async () => {
      // Set and verify
      await cacheService.set(testKey, testValue);
      const beforeDelete = await cacheService.get(testKey);
      expect(beforeDelete).toEqual(testValue);

      // Delete and verify
      const deleteResult = await cacheService.del(testKey);
      expect(deleteResult).toBe(true);

      const afterDelete = await cacheService.get(testKey);
      expect(afterDelete).toBeNull();
    });

    it('should check key existence', async () => {
      // Key should not exist initially
      let exists = await cacheService.exists(testKey);
      expect(exists).toBe(false);

      // Set key and check again
      await cacheService.set(testKey, testValue);
      exists = await cacheService.exists(testKey);
      expect(exists).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    const testKeys = ['batch:1', 'batch:2', 'batch:3'];
    const testValues = [
      { id: '1', name: 'User 1' },
      { id: '2', name: 'User 2' },
      { id: '3', name: 'User 3' },
    ];

    afterEach(async () => {
      // Clean up after each test
      await cacheService.mdel(testKeys);
    });

    it('should handle batch set and get operations', async () => {
      // Batch set
      const operations = testKeys.map((key, index) => ({
        key,
        value: testValues[index],
        ttl: 300,
      }));

      const msetResult = await cacheService.mset(operations);
      expect(msetResult).toBe(true);

      // Batch get
      const values = await cacheService.mget(testKeys);
      expect(values).toHaveLength(3);
      expect(values[0]).toEqual(testValues[0]);
      expect(values[1]).toEqual(testValues[1]);
      expect(values[2]).toEqual(testValues[2]);
    });

    it('should handle batch delete operations', async () => {
      // Set values first
      const operations = testKeys.map((key, index) => ({
        key,
        value: testValues[index],
      }));
      await cacheService.mset(operations);

      // Batch delete
      const deleteCount = await cacheService.mdel(testKeys);
      expect(deleteCount).toBe(3);

      // Verify all deleted
      const values = await cacheService.mget(testKeys);
      expect(values).toEqual([null, null, null]);
    });
  });

  describe('Pattern Operations', () => {
    const patternKeys = ['pattern:user:1', 'pattern:user:2', 'pattern:other:1'];
    const testValue = { data: 'test' };

    beforeEach(async () => {
      // Set up test data
      const operations = patternKeys.map((key) => ({ key, value: testValue }));
      await cacheService.mset(operations);
    });

    afterEach(async () => {
      // Clean up
      await cacheService.mdel(patternKeys);
    });

    it('should find keys by pattern', async () => {
      const userKeys = await cacheService.keys('pattern:user:*');
      expect(userKeys).toHaveLength(2);
      expect(userKeys).toContain('pattern:user:1');
      expect(userKeys).toContain('pattern:user:2');
    });

    it('should delete keys by pattern', async () => {
      // Delete user pattern
      const deleteCount = await cacheService.deletePattern('pattern:user:*');
      expect(deleteCount).toBe(2);

      // Verify user keys are deleted but other remains
      const remainingKeys = await cacheService.keys('pattern:*');
      expect(remainingKeys).toHaveLength(1);
      expect(remainingKeys[0]).toBe('pattern:other:1');
    });
  });

  describe('Health and Stats', () => {
    it('should report health status', async () => {
      const isHealthy = await cacheService.isHealthy();
      // Should be true if Redis is available, false otherwise
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should provide cache statistics', async () => {
      const stats = await cacheService.stats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('keys');
      expect(stats).toHaveProperty('memory');
      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('connected');
      expect(typeof stats.connected).toBe('boolean');
    });
  });

  describe('TTL Operations', () => {
    const ttlKey = 'ttl:test';
    const testValue = { data: 'ttl test' };

    afterEach(async () => {
      await cacheService.del(ttlKey);
    });

    it('should set and get TTL', async () => {
      // Set with TTL
      await cacheService.set(ttlKey, testValue, { ttl: 10 });

      // Check TTL
      const ttl = await cacheService.ttl(ttlKey);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(10);
    });

    it('should update expiration', async () => {
      // Set key
      await cacheService.set(ttlKey, testValue);

      // Set expiration
      const expireResult = await cacheService.expire(ttlKey, 5);
      expect(expireResult).toBe(true);

      // Check TTL
      const ttl = await cacheService.ttl(ttlKey);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(5);
    });
  });

  describe('Increment/Decrement Operations', () => {
    const counterKey = 'counter:test';

    afterEach(async () => {
      await cacheService.del(counterKey);
    });

    it('should increment values', async () => {
      const result1 = await cacheService.incr(counterKey);
      expect(result1).toBe(1);

      const result2 = await cacheService.incr(counterKey);
      expect(result2).toBe(2);
    });

    it('should decrement values', async () => {
      // Start with some value
      await cacheService.incr(counterKey);
      await cacheService.incr(counterKey);

      const result1 = await cacheService.decr(counterKey);
      expect(result1).toBe(1);

      const result2 = await cacheService.decr(counterKey);
      expect(result2).toBe(0);
    });
  });
});
