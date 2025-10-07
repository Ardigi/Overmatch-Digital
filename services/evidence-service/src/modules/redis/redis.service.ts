import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private readonly prefix = 'evidence:';

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

    this.client.on('error', err => {
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
    const keysWithoutPrefix = keys.map(key => key.replace(this.prefix, ''));
    return this.client.del(...keysWithoutPrefix);
  }

  // Evidence-specific cache methods
  async cacheEvidence(evidenceId: string, evidenceData: any, ttl = 3600): Promise<void> {
    await this.setCache(`evidence:${evidenceId}`, evidenceData, ttl);
  }

  async getCachedEvidence(evidenceId: string): Promise<any | null> {
    return this.getCache(`evidence:${evidenceId}`);
  }

  async invalidateEvidence(evidenceId: string): Promise<void> {
    await this.delCache(`evidence:${evidenceId}`);
    // Also invalidate related patterns
    await this.invalidatePattern(`evidence:${evidenceId}:*`);
  }

  async cacheEvidenceList(controlId: string, filters: any, data: any, ttl = 600): Promise<void> {
    const cacheKey = `evidences:${controlId}:${JSON.stringify(filters)}`;
    await this.setCache(cacheKey, data, ttl);
  }

  async getCachedEvidenceList(controlId: string, filters: any): Promise<any | null> {
    const cacheKey = `evidences:${controlId}:${JSON.stringify(filters)}`;
    return this.getCache(cacheKey);
  }

  async invalidateEvidenceList(controlId: string): Promise<void> {
    await this.invalidatePattern(`evidences:${controlId}:*`);
  }

  // Document caching
  async cacheDocument(documentId: string, documentData: any, ttl = 7200): Promise<void> {
    await this.setCache(`document:${documentId}`, documentData, ttl);
  }

  async getCachedDocument(documentId: string): Promise<any | null> {
    return this.getCache(`document:${documentId}`);
  }

  async invalidateDocument(documentId: string): Promise<void> {
    await this.delCache(`document:${documentId}`);
  }

  // Document metadata caching
  async cacheDocumentMetadata(documentId: string, metadata: any, ttl = 7200): Promise<void> {
    await this.setCache(`doc-meta:${documentId}`, metadata, ttl);
  }

  async getCachedDocumentMetadata(documentId: string): Promise<any | null> {
    return this.getCache(`doc-meta:${documentId}`);
  }

  async invalidateDocumentMetadata(documentId: string): Promise<void> {
    await this.delCache(`doc-meta:${documentId}`);
  }

  // Collection status caching
  async cacheCollectionStatus(controlId: string, status: any, ttl = 300): Promise<void> {
    await this.setCache(`collection:${controlId}`, status, ttl);
  }

  async getCachedCollectionStatus(controlId: string): Promise<any | null> {
    return this.getCache(`collection:${controlId}`);
  }

  async invalidateCollectionStatus(controlId: string): Promise<void> {
    await this.delCache(`collection:${controlId}`);
  }

  // Evidence review caching
  async cacheReview(evidenceId: string, reviewData: any, ttl = 3600): Promise<void> {
    await this.setCache(`review:${evidenceId}`, reviewData, ttl);
  }

  async getCachedReview(evidenceId: string): Promise<any | null> {
    return this.getCache(`review:${evidenceId}`);
  }

  async invalidateReview(evidenceId: string): Promise<void> {
    await this.delCache(`review:${evidenceId}`);
  }

  // Upload session caching
  async cacheUploadSession(sessionId: string, sessionData: any, ttl = 1800): Promise<void> {
    await this.setCache(`upload:${sessionId}`, sessionData, ttl);
  }

  async getCachedUploadSession(sessionId: string): Promise<any | null> {
    return this.getCache(`upload:${sessionId}`);
  }

  async invalidateUploadSession(sessionId: string): Promise<void> {
    await this.delCache(`upload:${sessionId}`);
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
