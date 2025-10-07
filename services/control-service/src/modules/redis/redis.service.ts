import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private readonly prefix = 'control:';

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisConfig = {
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
      keyPrefix: this.prefix,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    this.client = new Redis(redisConfig);

    this.client.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis client error:', err);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // Cache Operations
  async setCache<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async getCache<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.warn(`Failed to parse Redis value for key ${key}: ${error.message}`);
      return null;
    }
  }

  async delCache(key: string | string[]): Promise<number> {
    if (Array.isArray(key)) {
      return this.client.del(...key);
    }
    return this.client.del(key);
  }

  async existsCache(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async expireCache(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  async ttlCache(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  // Pattern-based cache invalidation
  async invalidatePattern(pattern: string): Promise<number> {
    const keys = await this.client.keys(`${this.prefix}${pattern}`);
    if (keys.length === 0) return 0;

    // Remove prefix from keys since del doesn't use keyPrefix
    const keysWithoutPrefix = keys.map((key) => key.replace(this.prefix, ''));
    return this.client.del(...keysWithoutPrefix);
  }

  // Control-specific cache methods
  async cacheControl(controlId: string, controlData: any, ttl = 3600): Promise<void> {
    await this.setCache(`control:${controlId}`, controlData, ttl);
  }

  async getCachedControl(controlId: string): Promise<any | null> {
    return this.getCache(`control:${controlId}`);
  }

  async invalidateControl(controlId: string): Promise<void> {
    await this.delCache(`control:${controlId}`);
    // Also invalidate related patterns
    await this.invalidatePattern(`control:${controlId}:*`);
  }

  async cacheControlList(
    organizationId: string,
    filters: any,
    data: any,
    ttl = 600
  ): Promise<void> {
    const cacheKey = `controls:${organizationId}:${JSON.stringify(filters)}`;
    await this.setCache(cacheKey, data, ttl);
  }

  async getCachedControlList(organizationId: string, filters: any): Promise<any | null> {
    const cacheKey = `controls:${organizationId}:${JSON.stringify(filters)}`;
    return this.getCache(cacheKey);
  }

  async invalidateControlList(organizationId: string): Promise<void> {
    await this.invalidatePattern(`controls:${organizationId}:*`);
  }

  // Control category caching
  async cacheCategory(categoryId: string, categoryData: any, ttl = 7200): Promise<void> {
    await this.setCache(`category:${categoryId}`, categoryData, ttl);
  }

  async getCachedCategory(categoryId: string): Promise<any | null> {
    return this.getCache(`category:${categoryId}`);
  }

  async invalidateCategory(categoryId: string): Promise<void> {
    await this.delCache(`category:${categoryId}`);
  }

  // Control implementation caching
  async cacheImplementation(controlId: string, implData: any, ttl = 3600): Promise<void> {
    await this.setCache(`impl:${controlId}`, implData, ttl);
  }

  async getCachedImplementation(controlId: string): Promise<any | null> {
    return this.getCache(`impl:${controlId}`);
  }

  async invalidateImplementation(controlId: string): Promise<void> {
    await this.delCache(`impl:${controlId}`);
  }

  // Control test results caching
  async cacheTestResult(controlId: string, testId: string, result: any, ttl = 1800): Promise<void> {
    const cacheKey = `test:${controlId}:${testId}`;
    await this.setCache(cacheKey, result, ttl);
  }

  async getCachedTestResult(controlId: string, testId: string): Promise<any | null> {
    const cacheKey = `test:${controlId}:${testId}`;
    return this.getCache(cacheKey);
  }

  async invalidateTestResults(controlId: string): Promise<void> {
    await this.invalidatePattern(`test:${controlId}:*`);
  }

  // Control coverage caching
  async cacheCoverage(controlId: string, coverage: any, ttl = 3600): Promise<void> {
    await this.setCache(`coverage:${controlId}`, coverage, ttl);
  }

  async getCachedCoverage(controlId: string): Promise<any | null> {
    return this.getCache(`coverage:${controlId}`);
  }

  async invalidateCoverage(controlId: string): Promise<void> {
    await this.delCache(`coverage:${controlId}`);
  }

  // Generic Redis operations (for compatibility with other services)
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<'OK' | null> {
    if (ttl) {
      return this.client.setex(key, ttl, value) as Promise<'OK' | null>;
    }
    return this.client.set(key, value);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async del(key: string | string[]): Promise<number> {
    if (Array.isArray(key)) {
      return this.client.del(...key);
    }
    return this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  // Lock operations for distributed operations
  async acquireLock(resource: string, ttl: number): Promise<string | null> {
    const lockId = Math.random().toString(36).substring(7);
    const lockKey = `lock:${resource}`;

    const result = await this.client.set(lockKey, lockId, 'PX', ttl * 1000, 'NX');
    return result === 'OK' ? lockId : null;
  }

  async releaseLock(resource: string, lockId: string): Promise<boolean> {
    const lockKey = `lock:${resource}`;
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.client.eval(script, 1, lockKey, lockId);
    return result === 1;
  }
}
