import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisConfig = {
      host: this.configService.get('REDIS_HOST', '127.0.0.1'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    // Use test-specific config in test environment
    if (process.env.NODE_ENV === 'test') {
      redisConfig.port = parseInt(process.env.REDIS_PORT || '6380');
      redisConfig.password = process.env.REDIS_PASSWORD || 'test_redis_pass';
    }

    this.client = new Redis(redisConfig);

    // Handle connection events
    this.client.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis client error:', err);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  getClient(): Redis {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
    }
    return this.client;
  }

  // Key-Value Operations
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return;
    }
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return null;
    }
    const value = await this.client.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      // If T is expected to be a string and parsing fails, return the raw value
      if (typeof value === 'string') {
        return value as unknown as T;
      }

      this.logger.warn(`Failed to parse Redis value for key ${key}: ${error.message}`);
      return null;
    }
  }

  async del(key: string | string[]): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return 0;
    }
    if (Array.isArray(key)) {
      return this.client.del(...key);
    }
    return this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return false;
    }
    const result = await this.client.exists(key);
    return result === 1;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return false;
    }
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return -2;
    }
    return this.client.ttl(key);
  }

  // Hash Operations
  async hset(key: string, field: string, value: any): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return 0;
    }
    return this.client.hset(key, field, JSON.stringify(value));
  }

  async hget<T>(key: string, field: string): Promise<T | null> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return null;
    }
    const value = await this.client.hget(key, field);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      if (typeof value === 'string') {
        return value as unknown as T;
      }

      this.logger.warn(
        `Failed to parse Redis hash value for key ${key}, field ${field}: ${error.message}`
      );
      return null;
    }
  }

  async hgetall<T>(key: string): Promise<Record<string, T>> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return {};
    }
    const hash = await this.client.hgetall(key);
    const result: Record<string, T> = {};

    for (const [field, value] of Object.entries(hash)) {
      try {
        result[field] = JSON.parse(value) as T;
      } catch (error) {
        if (typeof value === 'string') {
          result[field] = value as unknown as T;
        } else {
          this.logger.warn(
            `Failed to parse Redis hash field ${field} for key ${key}: ${error.message}`
          );
        }
      }
    }

    return result;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return 0;
    }
    return this.client.hdel(key, ...fields);
  }

  // Set Operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return 0;
    }
    return this.client.sadd(key, ...members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return 0;
    }
    return this.client.srem(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return [];
    }
    return this.client.smembers(key);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return false;
    }
    const result = await this.client.sismember(key, member);
    return result === 1;
  }

  // Multi-key operations
  async mget<T>(...keys: string[]): Promise<(T | null)[]> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return keys.map(() => null);
    }

    const values = await this.client.mget(...keys);
    return values.map((value) => {
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    });
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return [];
    }
    return this.client.keys(pattern);
  }

  // Clear all keys (useful for tests)
  async flushdb(): Promise<void> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return;
    }
    if (process.env.NODE_ENV === 'test') {
      await this.client.flushdb();
    } else {
      this.logger.error('flushdb is only allowed in test environment');
    }
  }
}
