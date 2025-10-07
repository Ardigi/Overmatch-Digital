import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private readonly prefix = 'integration:';

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

  // Integration-specific cache methods
  async cacheIntegration(integrationId: string, integrationData: any, ttl = 3600): Promise<void> {
    await this.setCache(`integration:${integrationId}`, integrationData, ttl);
  }

  async getCachedIntegration(integrationId: string): Promise<any | null> {
    return this.getCache(`integration:${integrationId}`);
  }

  async invalidateIntegration(integrationId: string): Promise<void> {
    await this.delCache(`integration:${integrationId}`);
    // Also invalidate related patterns
    await this.invalidatePattern(`integration:${integrationId}:*`);
  }

  async cacheIntegrationList(
    organizationId: string,
    filters: any,
    data: any,
    ttl = 600
  ): Promise<void> {
    const cacheKey = `integrations:${organizationId}:${JSON.stringify(filters)}`;
    await this.setCache(cacheKey, data, ttl);
  }

  async getCachedIntegrationList(organizationId: string, filters: any): Promise<any | null> {
    const cacheKey = `integrations:${organizationId}:${JSON.stringify(filters)}`;
    return this.getCache(cacheKey);
  }

  async invalidateIntegrationList(organizationId: string): Promise<void> {
    await this.invalidatePattern(`integrations:${organizationId}:*`);
  }

  // Connector configuration caching
  async cacheConnectorConfig(connectorId: string, config: any, ttl = 7200): Promise<void> {
    await this.setCache(`connector:${connectorId}`, config, ttl);
  }

  async getCachedConnectorConfig(connectorId: string): Promise<any | null> {
    return this.getCache(`connector:${connectorId}`);
  }

  async invalidateConnectorConfig(connectorId: string): Promise<void> {
    await this.delCache(`connector:${connectorId}`);
  }

  // API response caching
  async cacheApiResponse(endpoint: string, params: any, response: any, ttl = 300): Promise<void> {
    const cacheKey = `api:${endpoint}:${JSON.stringify(params)}`;
    await this.setCache(cacheKey, response, ttl);
  }

  async getCachedApiResponse(endpoint: string, params: any): Promise<any | null> {
    const cacheKey = `api:${endpoint}:${JSON.stringify(params)}`;
    return this.getCache(cacheKey);
  }

  async invalidateApiResponses(endpoint?: string): Promise<void> {
    if (endpoint) {
      await this.invalidatePattern(`api:${endpoint}:*`);
    } else {
      await this.invalidatePattern('api:*');
    }
  }

  // OAuth token caching
  async cacheOAuthToken(integrationId: string, token: any, ttl?: number): Promise<void> {
    // Use token expiry time if available, otherwise default to 1 hour
    const tokenTtl = ttl || 3600;
    await this.setCache(`oauth:${integrationId}`, token, tokenTtl);
  }

  async getCachedOAuthToken(integrationId: string): Promise<any | null> {
    return this.getCache(`oauth:${integrationId}`);
  }

  async invalidateOAuthToken(integrationId: string): Promise<void> {
    await this.delCache(`oauth:${integrationId}`);
  }

  // Webhook configuration caching
  async cacheWebhookConfig(webhookId: string, config: any, ttl = 3600): Promise<void> {
    await this.setCache(`webhook:${webhookId}`, config, ttl);
  }

  async getCachedWebhookConfig(webhookId: string): Promise<any | null> {
    return this.getCache(`webhook:${webhookId}`);
  }

  async invalidateWebhookConfig(webhookId: string): Promise<void> {
    await this.delCache(`webhook:${webhookId}`);
  }

  // Data sync status caching
  async cacheSyncStatus(integrationId: string, status: any, ttl = 300): Promise<void> {
    await this.setCache(`sync:${integrationId}`, status, ttl);
  }

  async getCachedSyncStatus(integrationId: string): Promise<any | null> {
    return this.getCache(`sync:${integrationId}`);
  }

  async invalidateSyncStatus(integrationId: string): Promise<void> {
    await this.delCache(`sync:${integrationId}`);
  }

  // Rate limit tracking
  async incrementRateLimit(key: string, window: number): Promise<number> {
    const fullKey = `ratelimit:${key}`;
    const count = await this.client.incr(fullKey);

    if (count === 1) {
      await this.client.expire(fullKey, window);
    }

    return count;
  }

  async getRateLimit(key: string): Promise<number> {
    const fullKey = `ratelimit:${key}`;
    const count = await this.client.get(fullKey);
    return count ? parseInt(count, 10) : 0;
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
