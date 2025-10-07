import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RedisService } from '../redis/redis.service';
import type {
  CacheItem,
  PolicyListFilters,
  PolicyEvaluationCacheContext,
  CacheMetrics,
} from './types/cache.types';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  refreshTtl?: boolean; // Refresh TTL on get
  tags?: string[]; // Tags for cache invalidation
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTtl: number;
  private readonly keyPrefix: string;

  // Cache statistics
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };

  // Cache size management
  private maxSize = 10000; // Default max size
  private lruMap = new Map<string, number>(); // Track access times

  constructor(
    private redisService: RedisService,
    private configService: ConfigService
  ) {
    const redisConfig = this.configService.get('policyService.redis') || {};
    this.defaultTtl = redisConfig.ttl || 3600; // 1 hour default
    this.keyPrefix = 'policy-service:';
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key);
      const value = await this.redisService.get<string>(fullKey);

      if (value) {
        this.logger.debug(`Cache hit for key: ${fullKey}`);
        this.stats.hits++;
        this.lruMap.set(key, Date.now()); // Update access time

        // Try to parse JSON, if it fails return the raw value
        try {
          return JSON.parse(value) as T;
        } catch {
          // If parsing fails, return the raw value
          return value as unknown as T;
        }
      } else {
        this.logger.debug(`Cache miss for key: ${fullKey}`);
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      this.logger.error(`Error getting cache key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const fullKey = this.buildKey(key);
      const ttl = options?.ttl || this.defaultTtl;

      // Serialize value to JSON string for consistent storage
      const serializedValue = JSON.stringify(value);

      await this.redisService.set(fullKey, serializedValue, ttl);

      // Store tags for invalidation
      if (options?.tags && options.tags.length > 0) {
        await this.addToTaggedSet(options.tags, fullKey);
      }

      this.stats.sets++;
      this.lruMap.set(key, Date.now()); // Track access time

      this.logger.debug(`Cache set for key: ${fullKey}, TTL: ${ttl}s`);
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.buildKey(key);
      await this.redisService.del(fullKey);
      this.stats.deletes++;
      this.lruMap.delete(key); // Remove from LRU map
      this.logger.debug(`Cache deleted for key: ${fullKey}`);
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}:`, error);
    }
  }

  // deleteByPattern is implemented below with proper functionality

  async deleteByTags(tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const keys = await this.getTaggedKeys(tag);
        for (const key of keys) {
          await this.redisService.del(key);
        }
        await this.clearTaggedSet(tag);
      }
      this.logger.debug(`Cache deleted for tags: ${tags.join(', ')}`);
    } catch (error) {
      this.logger.error(`Error deleting cache by tags ${tags}:`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redisService.flushdb();
      this.logger.debug('Cache cleared');
    } catch (error) {
      this.logger.error('Error clearing cache:', error);
    }
  }

  async remember<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
    tags?: string[]
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, { ttl, tags });
    return value;
  }

  async getOrSet<T>(
    key: string,
    value: T | (() => Promise<T>),
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    // Fix type checking before calling value()
    const resolvedValue =
      typeof value === 'function' && value !== null
        ? await (value as () => Promise<T>)()
        : (value as T);
    await this.set(key, resolvedValue, options);
    return resolvedValue;
  }

  generateKey(...parts: (string | number)[]): string {
    return parts.map((part) => String(part)).join(':');
  }

  generateHash(data: unknown): string {
    const stringified = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(stringified).digest('hex');
  }

  // Cache key builders
  buildPolicyKey(policyId: string): string {
    return this.generateKey('policy', policyId);
  }

  buildPolicyListKey(organizationId: string, filters: PolicyListFilters = {}): string {
    const filterHash = this.generateHash(filters);
    return this.generateKey('policy-list', organizationId, filterHash);
  }

  buildComplianceMappingKey(policyId: string): string {
    return this.generateKey('compliance-mapping', policyId);
  }

  buildFrameworkKey(frameworkId: string): string {
    return this.generateKey('framework', frameworkId);
  }

  buildControlKey(controlId: string): string {
    return this.generateKey('control', controlId);
  }

  buildEvaluationKey(policyId: string, context: PolicyEvaluationCacheContext): string {
    const contextHash = this.generateHash(context);
    return this.generateKey('evaluation', policyId, contextHash);
  }

  buildAssessmentKey(policyId: string, framework: string): string {
    return this.generateKey('assessment', policyId, framework);
  }

  // Additional key builders for tests
  buildMappingKey(mappingId: string): string {
    return this.generateKey('mapping', mappingId);
  }

  buildKey(...parts: (string | number)[]): string {
    const key = parts.map((part) => String(part)).join(':');
    return `${this.keyPrefix}${key}`;
  }

  private async addToTaggedSet(tags: string[], key: string): Promise<void> {
    for (const tag of tags) {
      const tagKey = this.buildKey(`tag:${tag}`);
      await this.redisService.sadd(tagKey, key);
      // Set TTL for the tag set (Redis Sets don't auto-expire, so we manage TTL separately)
      await this.redisService.expire(tagKey, 86400); // 24 hours
    }
  }

  private async getTaggedKeys(tag: string): Promise<string[]> {
    const tagKey = this.buildKey(`tag:${tag}`);
    return await this.redisService.smembers(tagKey);
  }

  private async clearTaggedSet(tag: string): Promise<void> {
    const tagKey = this.buildKey(`tag:${tag}`);
    await this.redisService.del(tagKey);
  }

  // Batch operations
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) {
      return [];
    }

    try {
      const fullKeys = keys.map((key) => this.buildKey(key));
      const values = await this.redisService.mget<string>(...fullKeys);

      return values.map((value) => {
        if (!value) {
          return null;
        }
        try {
          return JSON.parse(value as string) as T;
        } catch {
          return value as T;
        }
      });
    } catch (error) {
      this.logger.error('Error in mget:', error);
      return keys.map(() => null);
    }
  }

  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    return this.mget<T>(keys);
  }

  async mset(items: CacheItem[]): Promise<void> {
    try {
      for (const item of items) {
        await this.set(item.key, item.value, { ttl: item.ttl });
      }
    } catch (error) {
      this.logger.error('Error in mset:', error);
    }
  }

  // Clear operations method is already defined above at line 133

  // Pattern-based operations
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      const fullPattern = this.buildKey(pattern);
      const keys = await this.redisService.keys(fullPattern);

      if (keys && keys.length > 0) {
        // Delete keys one by one as mdel isn't available
        for (const key of keys) {
          await this.redisService.del(key);
        }
        return keys.length;
      }

      return 0;
    } catch (error) {
      this.logger.error(`Error deleting by pattern ${pattern}:`, error);
      return 0;
    }
  }

  async getKeysByPattern(pattern: string): Promise<string[]> {
    try {
      const fullPattern = this.buildKey(pattern);
      const keys = await this.redisService.keys(fullPattern);

      // Remove prefix from keys
      const prefix = this.keyPrefix;
      return (keys || []).map((key) =>
        key.startsWith(prefix) ? key.substring(prefix.length) : key
      );
    } catch (error) {
      this.logger.error(`Error getting keys by pattern ${pattern}:`, error);
      return [];
    }
  }

  async getStats(): Promise<{
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    hitRate: number;
  }> {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      ...this.stats,
      hitRate,
    };
  }

  async resetStats(): Promise<void> {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };
  }

  // Cache warming
  async warmCache(data: CacheItem[]): Promise<void> {
    try {
      await this.mset(data);
      this.logger.debug(`Warmed cache with ${data.length} items`);
    } catch (error) {
      this.logger.error('Error warming cache:', error);
    }
  }

  // TTL management
  async getTTL(key: string): Promise<number | null> {
    try {
      const fullKey = this.buildKey(key);
      const ttl = await this.redisService.ttl(fullKey);
      return ttl > 0 ? ttl : null;
    } catch (error) {
      this.logger.error(`Error getting TTL for key ${key}:`, error);
      return null;
    }
  }

  async refreshTTL(key: string, ttl?: number): Promise<void> {
    try {
      const value = await this.get(key);
      if (value !== null) {
        await this.set(key, value, { ttl });
      }
    } catch (error) {
      this.logger.error(`Error refreshing TTL for key ${key}:`, error);
    }
  }

  async getSize(): Promise<number> {
    try {
      const keys = await this.redisService.keys(`${this.keyPrefix}*`);
      return keys ? keys.length : 0;
    } catch (error) {
      this.logger.error('Error getting cache size:', error);
      return 0;
    }
  }

  async evictLRU(targetSize: number): Promise<number> {
    try {
      const currentSize = await this.getSize();
      if (currentSize <= targetSize) {
        return 0;
      }

      // Get all keys with their access times
      const entries = Array.from(this.lruMap.entries()).sort((a, b) => a[1] - b[1]); // Sort by access time (oldest first)

      let evicted = 0;
      const toEvict = currentSize - targetSize;

      for (const [key] of entries) {
        if (evicted >= toEvict) {
          break;
        }

        await this.delete(key);
        this.lruMap.delete(key);
        evicted++;
      }

      return evicted;
    } catch (error) {
      this.logger.error('Error evicting LRU items:', error);
      return 0;
    }
  }
}
