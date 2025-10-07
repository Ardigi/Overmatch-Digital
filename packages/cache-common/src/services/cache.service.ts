import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import {
  type BatchOperation,
  type CacheConfig,
  type CacheEvent,
  CacheEventType,
  type CacheOptions,
  type CacheStats,
  type ICacheService,
} from '../interfaces/cache.interface';

/**
 * Production-ready Redis cache service with graceful degradation
 */
@Injectable()
export class CacheService implements ICacheService, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private isConnected = false;
  private config: CacheConfig;
  private statsCounter = {
    hits: 0,
    misses: 0,
    errors: 0,
  };

  constructor(config: CacheConfig) {
    this.config = config;
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection with error handling
   */
  private async initializeRedis(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.warn('Cache is disabled via configuration');
      return;
    }

    try {
      this.redis = new Redis({
        host: this.config.redis.host,
        port: this.config.redis.port,
        password: this.config.redis.password,
        db: this.config.redis.db || 0,
        retryDelayOnFailover: this.config.redis.retryDelayOnFailover || 100,
        maxRetriesPerRequest: this.config.redis.maxRetriesPerRequest || 3,
        connectTimeout: this.config.connectTimeout || 10000,
        lazyConnect: true,
        keyPrefix: this.config.keyPrefix ? `${this.config.keyPrefix}:` : '',
      } as any); // Type assertion to bypass stricter ioredis typing

      // Set up event listeners
      this.redis.on('connect', () => {
        this.logger.log('Redis connection established');
        this.isConnected = true;
        this.emitEvent(CacheEventType.CONNECTED);
      });

      this.redis.on('ready', () => {
        this.logger.log('Redis is ready to accept commands');
        this.emitEvent(CacheEventType.READY);
      });

      this.redis.on('error', (error) => {
        this.logger.error('Redis connection error:', error.message);
        this.isConnected = false;
        this.emitEvent(CacheEventType.ERROR, { error });
        this.statsCounter.errors++;
      });

      this.redis.on('close', () => {
        this.logger.warn('Redis connection closed');
        this.isConnected = false;
        this.emitEvent(CacheEventType.DISCONNECTED);
      });

      this.redis.on('reconnecting', () => {
        this.logger.log('Attempting to reconnect to Redis');
        this.emitEvent(CacheEventType.RECONNECTING);
      });

      // Attempt initial connection
      await this.redis.connect();
    } catch (error) {
      this.logger.error('Failed to initialize Redis:', error);
      this.redis = null;
      this.isConnected = false;

      if (!this.config.gracefulDegradation) {
        throw error;
      }
    }
  }

  /**
   * Emit cache events for monitoring
   */
  private emitEvent(type: CacheEventType, data?: any): void {
    const event: CacheEvent = {
      type,
      timestamp: new Date(),
      data,
    };
    // Could be extended to emit to event bus if needed
    this.logger.debug(`Cache event: ${type}`, event);
  }

  /**
   * Execute Redis operation with graceful degradation
   */
  private async executeOperation<T>(
    operation: () => Promise<T>,
    fallbackValue: T,
    operationName: string
  ): Promise<T> {
    if (!this.redis || !this.isConnected) {
      if (this.config.gracefulDegradation) {
        this.logger.debug(`Cache unavailable for ${operationName}, using fallback`);
        return fallbackValue;
      }
      throw new Error('Cache is not available and graceful degradation is disabled');
    }

    try {
      return await operation();
    } catch (error) {
      this.logger.error(`Cache operation ${operationName} failed:`, error);
      this.statsCounter.errors++;

      if (this.config.gracefulDegradation) {
        return fallbackValue;
      }
      throw error;
    }
  }

  /**
   * Build cache key with prefix and validation
   */
  private buildKey(key: string, prefix?: string): string {
    const finalPrefix = prefix || '';
    const finalKey = finalPrefix ? `${finalPrefix}:${key}` : key;

    if (this.config.maxKeyLength && finalKey.length > this.config.maxKeyLength) {
      throw new Error(`Cache key too long: ${finalKey.length} > ${this.config.maxKeyLength}`);
    }

    return finalKey;
  }

  /**
   * Get TTL value with fallback to default
   */
  private getTtl(options?: CacheOptions): number {
    return options?.ttl || this.config.defaultTtl;
  }

  /**
   * Get a value from cache
   */
  async get<T = any>(key: string, options?: CacheOptions): Promise<T | null> {
    const cacheKey = this.buildKey(key, options?.prefix);

    return this.executeOperation(
      async () => {
        const value = await this.redis!.get(cacheKey);
        if (value === null) {
          this.statsCounter.misses++;
          return null;
        }
        this.statsCounter.hits++;
        return JSON.parse(value) as T;
      },
      null,
      'get'
    );
  }

  /**
   * Set a value in cache
   */
  async set<T = any>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    const cacheKey = this.buildKey(key, options?.prefix);
    const ttl = this.getTtl(options);

    return this.executeOperation(
      async () => {
        const serializedValue = JSON.stringify(value);
        const result = await this.redis!.setex(cacheKey, ttl, serializedValue);
        return result === 'OK';
      },
      false,
      'set'
    );
  }

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<boolean> {
    const cacheKey = this.buildKey(key);

    return this.executeOperation(
      async () => {
        const result = await this.redis!.del(cacheKey);
        return result > 0;
      },
      false,
      'del'
    );
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    const cacheKey = this.buildKey(key);

    return this.executeOperation(
      async () => {
        const result = await this.redis!.exists(cacheKey);
        return result === 1;
      },
      false,
      'exists'
    );
  }

  /**
   * Get multiple values at once
   */
  async mget<T = any>(keys: string[]): Promise<Array<T | null>> {
    if (keys.length === 0) {
      return [];
    }

    const cacheKeys = keys.map((key) => this.buildKey(key));

    return this.executeOperation(
      async () => {
        const values = await this.redis!.mget(...cacheKeys);
        return values.map((value) => {
          if (value === null) {
            this.statsCounter.misses++;
            return null;
          }
          this.statsCounter.hits++;
          return JSON.parse(value) as T;
        });
      },
      keys.map(() => null),
      'mget'
    );
  }

  /**
   * Set multiple values at once
   */
  async mset<T = any>(operations: BatchOperation<T>[]): Promise<boolean> {
    if (operations.length === 0) {
      return true;
    }

    return this.executeOperation(
      async () => {
        const pipeline = this.redis!.pipeline();

        for (const op of operations) {
          const cacheKey = this.buildKey(op.key);
          const ttl = op.ttl || this.config.defaultTtl;
          const serializedValue = JSON.stringify(op.value);
          pipeline.setex(cacheKey, ttl, serializedValue);
        }

        const results = await pipeline.exec();
        return results?.every(([error, result]) => error === null && result === 'OK') || false;
      },
      false,
      'mset'
    );
  }

  /**
   * Delete multiple keys at once
   */
  async mdel(keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    const cacheKeys = keys.map((key) => this.buildKey(key));

    return this.executeOperation(
      async () => {
        return await this.redis!.del(...cacheKeys);
      },
      0,
      'mdel'
    );
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    const searchPattern = this.buildKey(pattern);

    return this.executeOperation(
      async () => {
        return await this.redis!.keys(searchPattern);
      },
      [],
      'keys'
    );
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    return this.executeOperation(
      async () => {
        const keys = await this.keys(pattern);
        if (keys.length === 0) {
          return 0;
        }
        return await this.mdel(keys);
      },
      0,
      'deletePattern'
    );
  }

  /**
   * Increment a numeric value
   */
  async incr(key: string, options?: CacheOptions): Promise<number> {
    const cacheKey = this.buildKey(key, options?.prefix);

    return this.executeOperation(
      async () => {
        const result = await this.redis!.incr(cacheKey);
        // Set expiration if this is a new key
        if (result === 1) {
          const ttl = this.getTtl(options);
          await this.redis!.expire(cacheKey, ttl);
        }
        return result;
      },
      0,
      'incr'
    );
  }

  /**
   * Decrement a numeric value
   */
  async decr(key: string, options?: CacheOptions): Promise<number> {
    const cacheKey = this.buildKey(key, options?.prefix);

    return this.executeOperation(
      async () => {
        const result = await this.redis!.decr(cacheKey);
        // Set expiration if this is a new key
        if (result === -1) {
          const ttl = this.getTtl(options);
          await this.redis!.expire(cacheKey, ttl);
        }
        return result;
      },
      0,
      'decr'
    );
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const cacheKey = this.buildKey(key);

    return this.executeOperation(
      async () => {
        const result = await this.redis!.expire(cacheKey, seconds);
        return result === 1;
      },
      false,
      'expire'
    );
  }

  /**
   * Get remaining time to live for a key
   */
  async ttl(key: string): Promise<number> {
    const cacheKey = this.buildKey(key);

    return this.executeOperation(
      async () => {
        return await this.redis!.ttl(cacheKey);
      },
      -1,
      'ttl'
    );
  }

  /**
   * Clear all cache
   */
  async flush(): Promise<boolean> {
    return this.executeOperation(
      async () => {
        await this.redis!.flushdb();
        return true;
      },
      false,
      'flush'
    );
  }

  /**
   * Get cache statistics
   */
  async stats(): Promise<CacheStats> {
    return this.executeOperation(
      async () => {
        const info = await this.redis!.info('memory,stats');
        const lines = info.split('\r\n');
        const stats: any = {};

        lines.forEach((line) => {
          const [key, value] = line.split(':');
          if (key && value) {
            stats[key] = value;
          }
        });

        return {
          hits: this.statsCounter.hits,
          misses: this.statsCounter.misses,
          keys: parseInt(stats.db0?.split(',')[0]?.split('=')[1] || '0'),
          memory: parseInt(stats.used_memory || '0'),
          uptime: parseInt(stats.uptime_in_seconds || '0'),
          connected: this.isConnected,
        };
      },
      {
        hits: this.statsCounter.hits,
        misses: this.statsCounter.misses,
        keys: 0,
        memory: 0,
        uptime: 0,
        connected: false,
      },
      'stats'
    );
  }

  /**
   * Check if cache is connected and healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Close cache connection gracefully
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
      this.logger.log('Redis connection closed gracefully');
    }
  }

  /**
   * NestJS lifecycle method - close connection on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
