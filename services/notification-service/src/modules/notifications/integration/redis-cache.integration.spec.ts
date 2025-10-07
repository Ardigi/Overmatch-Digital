/**
 * REAL Redis Cache Integration Test
 *
 * This test validates actual Redis connectivity and cache operations.
 * Tests will FAIL if Redis is not available - no graceful degradation.
 *
 * Prerequisites:
 * - Redis must be running on 127.0.0.1:6379
 * - Redis must be accessible with correct credentials
 */

import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheService } from '@soc-compliance/cache-common';
import type { Queue } from 'bull';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { KafkaService } from '../../kafka/kafka.service';
import {
  type Notification,
  NotificationChannel,
  NotificationStatus,
} from '../entities/notification.entity';
import type { NotificationPreference } from '../entities/notification-preference.entity';
import type { NotificationTemplate } from '../entities/notification-template.entity';
import { NotificationsService } from '../notifications.service';
import type { UserDataService } from '../services/user-data.service';

describe('Redis Cache Integration (REAL)', () => {
  let cacheService: CacheService;
  let notificationsService: NotificationsService;
  let redis: Redis;
  let mockNotificationRepository: jest.Mocked<Repository<Notification>>;
  let mockTemplateRepository: jest.Mocked<Repository<NotificationTemplate>>;
  let mockPreferenceRepository: jest.Mocked<Repository<NotificationPreference>>;
  let mockQueue: jest.Mocked<Queue>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockKafkaService: jest.Mocked<KafkaService>;
  let mockUserDataService: jest.Mocked<UserDataService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;

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
      connectTimeout: 5000,
    });

    // Wait for cache service to connect
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const isHealthy = await cacheService.isHealthy();
    if (!isHealthy) {
      throw new Error('CacheService failed to connect to Redis');
    }

    // Set up mocks for NotificationService
    mockNotificationRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
        getRawOne: jest.fn().mockResolvedValue({}),
      })),
    } as any;

    mockTemplateRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as any;

    mockPreferenceRepository = {
      findOne: jest.fn(),
    } as any;

    mockQueue = {
      add: jest.fn(),
      getJobs: jest.fn().mockResolvedValue([]),
    } as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockKafkaService = {
      emit: jest.fn(),
    } as any;

    mockUserDataService = {
      getUserById: jest.fn(),
      validateUserAccess: jest.fn(),
      getOrganizationById: jest.fn(),
    } as any;

    mockEventEmitter = {
      emit: jest.fn(),
    } as any;

    notificationsService = new NotificationsService(
      mockNotificationRepository,
      mockTemplateRepository,
      mockPreferenceRepository,
      mockQueue,
      mockConfigService,
      mockKafkaService,
      mockUserDataService,
      mockEventEmitter,
      cacheService
    );
  });

  afterAll(async () => {
    // Clean up connections
    await cacheService.close();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clear test data from Redis before each test
    await redis.flushdb();
    jest.clearAllMocks();
  });

  describe('Redis Connectivity Requirements', () => {
    it('should require active Redis connection (no graceful degradation)', async () => {
      // Verify Redis is actually connected
      const pingResult = await redis.ping();
      expect(pingResult).toBe('PONG');

      // Verify cache service is connected
      const isHealthy = await cacheService.isHealthy();
      expect(isHealthy).toBe(true);

      // Verify no graceful degradation - operations should fail if Redis goes down
      const stats = await cacheService.stats();
      expect(stats.connected).toBe(true);
    });

    it('should fail fast when Redis operations fail', async () => {
      // This test documents expected behavior when Redis is unavailable
      const disconnectedCacheService = new CacheService({
        redis: { host: '127.0.0.1', port: 9999 }, // Non-existent port
        defaultTtl: 60,
        keyPrefix: 'test-disconnected',
        enabled: true,
        gracefulDegradation: false, // Should throw errors
      });

      // Operations should fail, not return fallback values
      await expect(disconnectedCacheService.get('test-key')).rejects.toThrow();
      await expect(disconnectedCacheService.set('test-key', 'value')).rejects.toThrow();

      await disconnectedCacheService.close();
    });
  });

  describe('Real Cache Operations', () => {
    it('should perform actual cache set and get operations', async () => {
      const key = 'integration-test-key';
      const value = { message: 'Hello Redis', timestamp: Date.now() };

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

      // Verify cache stats updated
      const stats = await cacheService.stats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    it('should handle cache expiration with real TTL', async () => {
      const key = 'expiration-test';
      const value = 'expires-soon';
      const shortTtl = 1; // 1 second

      // Set with short TTL
      await cacheService.set(key, value, { ttl: shortTtl });

      // Verify it exists initially
      let retrieved = await cacheService.get(key);
      expect(retrieved).toBe(value);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Verify it's actually expired in Redis
      const redisValue = await redis.get(`integration-test:${key}`);
      expect(redisValue).toBeNull();

      // Verify cache service returns null
      retrieved = await cacheService.get(key);
      expect(retrieved).toBeNull();
    });

    it('should perform bulk operations with real Redis', async () => {
      const keys = ['bulk-1', 'bulk-2', 'bulk-3'];
      const values = ['value-1', 'value-2', 'value-3'];

      // Set multiple values
      const setOperations = keys.map((key, index) => ({
        key,
        value: values[index],
        ttl: 300,
      }));

      const msetResult = await cacheService.mset(setOperations);
      expect(msetResult).toBe(true);

      // Verify all values exist in Redis
      for (let i = 0; i < keys.length; i++) {
        const redisValue = await redis.get(`integration-test:${keys[i]}`);
        expect(JSON.parse(redisValue!)).toBe(values[i]);
      }

      // Get multiple values
      const retrieved = await cacheService.mget(keys);
      expect(retrieved).toEqual(values);

      // Delete multiple values
      const deleteCount = await cacheService.mdel(keys);
      expect(deleteCount).toBe(keys.length);

      // Verify all deleted from Redis
      for (const key of keys) {
        const redisValue = await redis.get(`integration-test:${key}`);
        expect(redisValue).toBeNull();
      }
    });
  });

  describe('Service Integration with Real Cache', () => {
    it('should use real cache for notification stats (@Cacheable decorator)', async () => {
      const organizationId = 'test-org-123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // Mock database query results
      const mockStats = [
        { channel: NotificationChannel.EMAIL, status: NotificationStatus.DELIVERED, count: '10' },
        { channel: NotificationChannel.SMS, status: NotificationStatus.DELIVERED, count: '5' },
      ];

      const mockEngagementStats = { opened: '3', clicked: '2' };

      mockNotificationRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockStats),
        getRawOne: jest.fn().mockResolvedValue(mockEngagementStats),
      } as any);

      // First call - should execute method and cache result
      const stats1 = await notificationsService.getStats(organizationId, startDate, endDate);
      expect(stats1).toBeDefined();
      expect(stats1.total).toBe(15);

      // Verify result is cached in Redis
      const cacheKey = `stats:${organizationId}:${startDate.getTime()}:${endDate.getTime()}`;
      const cachedValue = await redis.get(`integration-test:notification:${cacheKey}`);
      expect(cachedValue).toBeTruthy();
      expect(JSON.parse(cachedValue!)).toEqual(stats1);

      // Reset mock call count
      jest.clearAllMocks();
      mockNotificationRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockStats),
        getRawOne: jest.fn().mockResolvedValue(mockEngagementStats),
      } as any);

      // Second call - should use cache, not execute database query
      const stats2 = await notificationsService.getStats(organizationId, startDate, endDate);
      expect(stats2).toEqual(stats1);

      // Verify database was NOT called again (cached)
      expect(mockNotificationRepository.createQueryBuilder).not.toHaveBeenCalled();

      // Verify cache hit in stats
      const cacheStats = await cacheService.stats();
      expect(cacheStats.hits).toBeGreaterThan(0);
    });

    it('should handle cache invalidation for notification stats', async () => {
      const organizationId = 'test-org-456';
      const startDate = new Date('2024-02-01');
      const endDate = new Date('2024-02-28');

      // Mock initial stats
      mockNotificationRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              channel: NotificationChannel.EMAIL,
              status: NotificationStatus.DELIVERED,
              count: '20',
            },
          ]),
        getRawOne: jest.fn().mockResolvedValueOnce({ opened: '5', clicked: '3' }),
      } as any);

      // Get initial stats (cached)
      const initialStats = await notificationsService.getStats(organizationId, startDate, endDate);
      expect(initialStats.total).toBe(20);

      // Manually invalidate cache
      const cacheKey = `stats:${organizationId}:${startDate.getTime()}:${endDate.getTime()}`;
      const deleted = await cacheService.del(`notification:${cacheKey}`);
      expect(deleted).toBe(true);

      // Verify cache key is gone from Redis
      const cachedValue = await redis.get(`integration-test:notification:${cacheKey}`);
      expect(cachedValue).toBeNull();

      // Mock updated stats
      mockNotificationRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              channel: NotificationChannel.EMAIL,
              status: NotificationStatus.DELIVERED,
              count: '25',
            },
          ]),
        getRawOne: jest.fn().mockResolvedValueOnce({ opened: '7', clicked: '4' }),
      } as any);

      // Get stats again - should fetch fresh data
      const updatedStats = await notificationsService.getStats(organizationId, startDate, endDate);
      expect(updatedStats.total).toBe(25);
      expect(updatedStats.total).not.toBe(initialStats.total);

      // Verify database was called again
      expect(mockNotificationRepository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('Error Handling with Real Infrastructure', () => {
    it('should propagate Redis errors when graceful degradation is disabled', async () => {
      // Create a cache service that will definitely fail
      const failingCacheService = new CacheService({
        redis: { host: '127.0.0.1', port: 9999 }, // Non-existent port
        defaultTtl: 60,
        keyPrefix: 'test-failing',
        enabled: true,
        gracefulDegradation: false,
      });

      // Operations should throw errors, not return fallback values
      await expect(failingCacheService.get('test')).rejects.toThrow();
      await expect(failingCacheService.set('test', 'value')).rejects.toThrow();
      await expect(failingCacheService.del('test')).rejects.toThrow();

      await failingCacheService.close();
    });

    it('should handle Redis memory limits and eviction', async () => {
      // Fill Redis with data to test memory handling
      const largeData = 'x'.repeat(1000); // 1KB string
      const promises = [];

      for (let i = 0; i < 100; i++) {
        promises.push(cacheService.set(`memory-test-${i}`, largeData));
      }

      await Promise.all(promises);

      // Verify data was actually stored
      const stats = await cacheService.stats();
      expect(stats.keys).toBeGreaterThan(0);
      expect(stats.memory).toBeGreaterThan(0);

      // Clean up
      await cacheService.deletePattern('memory-test-*');
    });
  });

  describe('Production Scenarios', () => {
    it('should handle concurrent cache operations', async () => {
      const concurrentOps = 50;
      const promises = [];

      // Start concurrent set operations
      for (let i = 0; i < concurrentOps; i++) {
        promises.push(cacheService.set(`concurrent-${i}`, { id: i, timestamp: Date.now() }));
      }

      const results = await Promise.all(promises);
      expect(results.every((r) => r === true)).toBe(true);

      // Start concurrent get operations
      const getPromises = [];
      for (let i = 0; i < concurrentOps; i++) {
        getPromises.push(cacheService.get(`concurrent-${i}`));
      }

      const values = await Promise.all(getPromises);
      expect(values.length).toBe(concurrentOps);
      expect(values.every((v) => v !== null)).toBe(true);

      // Clean up
      await cacheService.deletePattern('concurrent-*');
    });

    it('should validate cache key constraints', async () => {
      // Test maximum key length if configured
      const longKey = 'x'.repeat(500);

      try {
        await cacheService.set(longKey, 'value');
        const retrieved = await cacheService.get(longKey);
        expect(retrieved).toBe('value');
      } catch (error) {
        // Expected if key length limits are enforced
        expect(error.message).toContain('key');
      }
    });
  });
});
