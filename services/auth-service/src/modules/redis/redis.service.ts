import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DynamicConfigService } from '../../config/dynamic-config.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;

  constructor(
    private configService: ConfigService,
    private dynamicConfigService?: DynamicConfigService
  ) {}

  async onModuleInit() {
    let redisConfig;

    try {
      // Try to use dynamic config service if available
      if (this.dynamicConfigService) {
        const config = await this.dynamicConfigService.getRedisConfig();
        redisConfig = {
          ...config,
          db: this.configService.get('REDIS_DB', 0),
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
        };
      } else {
        // Fallback to direct config service
        redisConfig = {
          host: this.configService.get('REDIS_HOST', 'localhost'),
          port: this.configService.get('REDIS_PORT', 6379),
          password: this.configService.get('REDIS_PASSWORD'),
          db: this.configService.get('REDIS_DB', 0),
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
        };
      }
    } catch (error) {
      this.logger.warn('Dynamic Redis config failed, using environment variables:', error.message);
      redisConfig = {
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: this.configService.get('REDIS_PORT', 6379),
        password: this.configService.get('REDIS_PASSWORD'),
        db: this.configService.get('REDIS_DB', 0),
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      };
    }

    this.client = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);
    this.publisher = new Redis(redisConfig);

    // Handle connection events
    this.client.on('connect', () => {
      console.log('Redis client connected');
    });

    this.client.on('error', (err) => {
      console.error('Redis client error:', err);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    if (this.publisher) {
      await this.publisher.quit();
    }
  }

  getClient(): Redis {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
    }
    return this.client;
  }

  getSubscriber(): Redis {
    if (!this.subscriber) {
      this.logger.warn('Redis subscriber not initialized');
    }
    return this.subscriber;
  }

  getPublisher(): Redis {
    if (!this.publisher) {
      this.logger.warn('Redis publisher not initialized');
    }
    return this.publisher;
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
      // This handles cases where the stored value is already a plain string
      if (typeof value === 'string') {
        // Use type guard to ensure type safety
        return value as unknown as T;
      }

      // Log parsing error for debugging
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

  async incr(key: string): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return 0;
    }
    return this.client.incr(key);
  }

  async decr(key: string): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return 0;
    }
    return this.client.decr(key);
  }

  async incrby(key: string, increment: number): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return 0;
    }
    return this.client.incrby(key, increment);
  }

  async decrby(key: string, decrement: number): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return 0;
    }
    return this.client.decrby(key, decrement);
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
      // If T is expected to be a string and parsing fails, return the raw value
      if (typeof value === 'string') {
        return value as unknown as T;
      }

      // Log parsing error for debugging
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
        // If T is expected to be a string and parsing fails, return the raw value
        if (typeof value === 'string') {
          result[field] = value as unknown as T;
        } else {
          // Log parsing error and skip this field
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

  // List Operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return 0;
    }
    return this.client.lpush(key, ...values);
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return 0;
    }
    return this.client.rpush(key, ...values);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return [];
    }
    return this.client.lrange(key, start, stop);
  }

  async llen(key: string): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return 0;
    }
    return this.client.llen(key);
  }

  async ltrim(key: string, start: number, stop: number): Promise<string> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return 'OK';
    }
    return this.client.ltrim(key, start, stop);
  }

  // Pub/Sub Operations
  async publish(channel: string, message: any): Promise<number> {
    if (!this.publisher) {
      this.logger.warn('Redis publisher not initialized');
      return 0;
    }
    return this.publisher.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    if (!this.subscriber) {
      this.logger.warn('Redis subscriber not initialized');
      return;
    }
    await this.subscriber.subscribe(channel);

    this.subscriber.on('message', (ch, message) => {
      if (ch === channel) {
        try {
          callback(JSON.parse(message));
        } catch {
          callback(message);
        }
      }
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    if (!this.subscriber) {
      this.logger.warn('Redis subscriber not initialized');
      return;
    }
    await this.subscriber.unsubscribe(channel);
  }

  // Pattern Operations
  async keys(pattern: string): Promise<string[]> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return [];
    }
    return this.client.keys(pattern);
  }

  async scan(pattern: string, count = 100): Promise<string[]> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return [];
    }
    const results: string[] = [];
    const stream = this.client.scanStream({
      match: pattern,
      count,
    });

    return new Promise((resolve, reject) => {
      stream.on('data', (keys) => {
        results.push(...keys);
      });

      stream.on('end', () => {
        resolve(results);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  // Transaction Operations
  multi() {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return null;
    }
    return this.client.multi();
  }

  // Lock Operations
  async acquireLock(
    key: string,
    ttl: number,
    retries = 10,
    retryDelay = 100
  ): Promise<string | null> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return null;
    }
    const lockId = Math.random().toString(36).substring(7);
    const lockKey = `lock:${key}`;

    for (let i = 0; i < retries; i++) {
      const result = await this.client.set(lockKey, lockId, 'PX', ttl * 1000, 'NX');

      if (result === 'OK') {
        return lockId;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    return null;
  }

  async releaseLock(key: string, lockId: string): Promise<boolean> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized');
      return false;
    }
    const lockKey = `lock:${key}`;
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
