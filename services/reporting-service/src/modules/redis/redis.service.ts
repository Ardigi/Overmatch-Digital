import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private readonly prefix = 'report:';

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

  // Report-specific cache methods
  async cacheReport(reportId: string, reportData: any, ttl = 3600): Promise<void> {
    await this.setCache(`report:${reportId}`, reportData, ttl);
  }

  async getCachedReport(reportId: string): Promise<any | null> {
    return this.getCache(`report:${reportId}`);
  }

  async invalidateReport(reportId: string): Promise<void> {
    await this.delCache(`report:${reportId}`);
    // Also invalidate related patterns
    await this.invalidatePattern(`report:${reportId}:*`);
  }

  async cacheReportList(organizationId: string, filters: any, data: any, ttl = 600): Promise<void> {
    const cacheKey = `reports:${organizationId}:${JSON.stringify(filters)}`;
    await this.setCache(cacheKey, data, ttl);
  }

  async getCachedReportList(organizationId: string, filters: any): Promise<any | null> {
    const cacheKey = `reports:${organizationId}:${JSON.stringify(filters)}`;
    return this.getCache(cacheKey);
  }

  async invalidateReportList(organizationId: string): Promise<void> {
    await this.invalidatePattern(`reports:${organizationId}:*`);
  }

  // Template caching
  async cacheTemplate(templateId: string, templateData: any, ttl = 7200): Promise<void> {
    await this.setCache(`template:${templateId}`, templateData, ttl);
  }

  async getCachedTemplate(templateId: string): Promise<any | null> {
    return this.getCache(`template:${templateId}`);
  }

  async invalidateTemplate(templateId: string): Promise<void> {
    await this.delCache(`template:${templateId}`);
  }

  // Report generation status caching
  async cacheGenerationStatus(jobId: string, status: any, ttl = 300): Promise<void> {
    await this.setCache(`gen-status:${jobId}`, status, ttl);
  }

  async getCachedGenerationStatus(jobId: string): Promise<any | null> {
    return this.getCache(`gen-status:${jobId}`);
  }

  async invalidateGenerationStatus(jobId: string): Promise<void> {
    await this.delCache(`gen-status:${jobId}`);
  }

  // Report content caching (for expensive reports)
  async cacheReportContent(reportId: string, content: Buffer, ttl = 1800): Promise<void> {
    // Store as base64 string for binary content
    const base64Content = content.toString('base64');
    await this.setCache(`content:${reportId}`, base64Content, ttl);
  }

  async getCachedReportContent(reportId: string): Promise<Buffer | null> {
    const base64Content = await this.getCache<string>(`content:${reportId}`);
    if (!base64Content) return null;

    try {
      return Buffer.from(base64Content, 'base64');
    } catch (error) {
      this.logger.warn(`Failed to decode report content for ${reportId}: ${error.message}`);
      return null;
    }
  }

  async invalidateReportContent(reportId: string): Promise<void> {
    await this.delCache(`content:${reportId}`);
  }

  // Analytics data caching
  async cacheAnalytics(key: string, data: any, ttl = 3600): Promise<void> {
    await this.setCache(`analytics:${key}`, data, ttl);
  }

  async getCachedAnalytics(key: string): Promise<any | null> {
    return this.getCache(`analytics:${key}`);
  }

  async invalidateAnalytics(pattern?: string): Promise<void> {
    if (pattern) {
      await this.invalidatePattern(`analytics:${pattern}`);
    } else {
      await this.invalidatePattern('analytics:*');
    }
  }

  // Schedule metadata caching
  async cacheSchedule(scheduleId: string, scheduleData: any, ttl = 3600): Promise<void> {
    await this.setCache(`schedule:${scheduleId}`, scheduleData, ttl);
  }

  async getCachedSchedule(scheduleId: string): Promise<any | null> {
    return this.getCache(`schedule:${scheduleId}`);
  }

  async invalidateSchedule(scheduleId: string): Promise<void> {
    await this.delCache(`schedule:${scheduleId}`);
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
