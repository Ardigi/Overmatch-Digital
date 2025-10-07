import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private readonly prefix = 'audit:';

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

  // Audit-specific cache methods
  async cacheAudit(auditId: string, auditData: any, ttl = 3600): Promise<void> {
    await this.setCache(`audit:${auditId}`, auditData, ttl);
  }

  async getCachedAudit(auditId: string): Promise<any | null> {
    return this.getCache(`audit:${auditId}`);
  }

  async invalidateAudit(auditId: string): Promise<void> {
    await this.delCache(`audit:${auditId}`);
    // Also invalidate related patterns
    await this.invalidatePattern(`audit:${auditId}:*`);
  }

  async cacheAuditList(organizationId: string, filters: any, data: any, ttl = 600): Promise<void> {
    const cacheKey = `audits:${organizationId}:${JSON.stringify(filters)}`;
    await this.setCache(cacheKey, data, ttl);
  }

  async getCachedAuditList(organizationId: string, filters: any): Promise<any | null> {
    const cacheKey = `audits:${organizationId}:${JSON.stringify(filters)}`;
    return this.getCache(cacheKey);
  }

  async invalidateAuditList(organizationId: string): Promise<void> {
    await this.invalidatePattern(`audits:${organizationId}:*`);
  }

  // Finding caching
  async cacheFinding(findingId: string, findingData: any, ttl = 3600): Promise<void> {
    await this.setCache(`finding:${findingId}`, findingData, ttl);
  }

  async getCachedFinding(findingId: string): Promise<any | null> {
    return this.getCache(`finding:${findingId}`);
  }

  async invalidateFinding(findingId: string): Promise<void> {
    await this.delCache(`finding:${findingId}`);
  }

  // Audit log caching
  async cacheAuditLog(
    entityType: string,
    entityId: string,
    logs: any[],
    ttl = 1800
  ): Promise<void> {
    const cacheKey = `log:${entityType}:${entityId}`;
    await this.setCache(cacheKey, logs, ttl);
  }

  async getCachedAuditLog(entityType: string, entityId: string): Promise<any[] | null> {
    const cacheKey = `log:${entityType}:${entityId}`;
    return this.getCache(cacheKey);
  }

  async invalidateAuditLog(entityType: string, entityId: string): Promise<void> {
    const cacheKey = `log:${entityType}:${entityId}`;
    await this.delCache(cacheKey);
  }

  // Activity tracking caching
  async cacheActivity(userId: string, activity: any, ttl = 300): Promise<void> {
    const cacheKey = `activity:${userId}:${Date.now()}`;
    await this.setCache(cacheKey, activity, ttl);
  }

  async getRecentActivities(userId: string): Promise<any[]> {
    const pattern = `activity:${userId}:*`;
    const keys = await this.client.keys(`${this.prefix}${pattern}`);

    const activities = [];
    for (const key of keys) {
      const activity = await this.client.get(key);
      if (activity) {
        try {
          activities.push(JSON.parse(activity));
        } catch (error) {
          this.logger.warn(`Failed to parse activity: ${error.message}`);
        }
      }
    }

    return activities;
  }

  async clearUserActivities(userId: string): Promise<void> {
    await this.invalidatePattern(`activity:${userId}:*`);
  }

  // Compliance status caching
  async cacheComplianceStatus(auditId: string, status: any, ttl = 1800): Promise<void> {
    await this.setCache(`compliance:${auditId}`, status, ttl);
  }

  async getCachedComplianceStatus(auditId: string): Promise<any | null> {
    return this.getCache(`compliance:${auditId}`);
  }

  async invalidateComplianceStatus(auditId: string): Promise<void> {
    await this.delCache(`compliance:${auditId}`);
  }

  // Audit trail aggregation caching
  async cacheAggregation(key: string, data: any, ttl = 3600): Promise<void> {
    await this.setCache(`agg:${key}`, data, ttl);
  }

  async getCachedAggregation(key: string): Promise<any | null> {
    return this.getCache(`agg:${key}`);
  }

  async invalidateAggregations(pattern?: string): Promise<void> {
    if (pattern) {
      await this.invalidatePattern(`agg:${pattern}`);
    } else {
      await this.invalidatePattern('agg:*');
    }
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
