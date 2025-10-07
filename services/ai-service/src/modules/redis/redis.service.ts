import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private readonly prefix = 'ai:';

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

  // AI model response caching
  async cacheModelResponse(
    prompt: string,
    model: string,
    response: any,
    ttl = 3600
  ): Promise<void> {
    const cacheKey = `model:${model}:${this.hashPrompt(prompt)}`;
    await this.setCache(cacheKey, response, ttl);
  }

  async getCachedModelResponse(prompt: string, model: string): Promise<any | null> {
    const cacheKey = `model:${model}:${this.hashPrompt(prompt)}`;
    return this.getCache(cacheKey);
  }

  async invalidateModelResponses(model?: string): Promise<void> {
    if (model) {
      await this.invalidatePattern(`model:${model}:*`);
    } else {
      await this.invalidatePattern('model:*');
    }
  }

  // Embedding caching
  async cacheEmbedding(text: string, embedding: number[], ttl = 86400): Promise<void> {
    const cacheKey = `embedding:${this.hashPrompt(text)}`;
    await this.setCache(cacheKey, embedding, ttl);
  }

  async getCachedEmbedding(text: string): Promise<number[] | null> {
    const cacheKey = `embedding:${this.hashPrompt(text)}`;
    return this.getCache(cacheKey);
  }

  // Analysis results caching
  async cacheAnalysis(analysisId: string, result: any, ttl = 7200): Promise<void> {
    await this.setCache(`analysis:${analysisId}`, result, ttl);
  }

  async getCachedAnalysis(analysisId: string): Promise<any | null> {
    return this.getCache(`analysis:${analysisId}`);
  }

  async invalidateAnalysis(analysisId: string): Promise<void> {
    await this.delCache(`analysis:${analysisId}`);
  }

  // Suggestion caching
  async cacheSuggestion(context: any, suggestions: any[], ttl = 1800): Promise<void> {
    const cacheKey = `suggestion:${JSON.stringify(context)}`;
    await this.setCache(cacheKey, suggestions, ttl);
  }

  async getCachedSuggestion(context: any): Promise<any[] | null> {
    const cacheKey = `suggestion:${JSON.stringify(context)}`;
    return this.getCache(cacheKey);
  }

  // Model metadata caching
  async cacheModelMetadata(modelId: string, metadata: any, ttl = 86400): Promise<void> {
    await this.setCache(`model-meta:${modelId}`, metadata, ttl);
  }

  async getCachedModelMetadata(modelId: string): Promise<any | null> {
    return this.getCache(`model-meta:${modelId}`);
  }

  // Processing queue status
  async cacheQueueStatus(jobId: string, status: any, ttl = 300): Promise<void> {
    await this.setCache(`queue:${jobId}`, status, ttl);
  }

  async getCachedQueueStatus(jobId: string): Promise<any | null> {
    return this.getCache(`queue:${jobId}`);
  }

  async invalidateQueueStatus(jobId: string): Promise<void> {
    await this.delCache(`queue:${jobId}`);
  }

  // Rate limiting for AI API calls
  async incrementApiUsage(apiKey: string, window: number): Promise<number> {
    const fullKey = `usage:${apiKey}:${Math.floor(Date.now() / (window * 1000))}`;
    const count = await this.client.incr(fullKey);

    if (count === 1) {
      await this.client.expire(fullKey, window);
    }

    return count;
  }

  async getApiUsage(apiKey: string, window: number): Promise<number> {
    const fullKey = `usage:${apiKey}:${Math.floor(Date.now() / (window * 1000))}`;
    const count = await this.client.get(fullKey);
    return count ? parseInt(count, 10) : 0;
  }

  // Training data caching
  async cacheTrainingData(datasetId: string, data: any, ttl = 86400): Promise<void> {
    await this.setCache(`training:${datasetId}`, data, ttl);
  }

  async getCachedTrainingData(datasetId: string): Promise<any | null> {
    return this.getCache(`training:${datasetId}`);
  }

  async invalidateTrainingData(datasetId: string): Promise<void> {
    await this.delCache(`training:${datasetId}`);
  }

  // Helper method to hash prompts for cache keys
  private hashPrompt(prompt: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(prompt).digest('hex').substring(0, 16);
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
