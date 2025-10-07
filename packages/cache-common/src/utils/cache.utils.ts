import type { CacheOptions } from '../interfaces/cache.interface';
import type { CacheService } from '../services/cache.service';

/**
 * Utility functions for common caching patterns
 */
export class CacheUtils {
  constructor(private readonly cacheService: CacheService) {}

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.cacheService.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fetchFunction();
    if (result !== null && result !== undefined) {
      await this.cacheService.set(key, result, options);
    }

    return result;
  }

  /**
   * Memoize a function with caching
   */
  memoize<TArgs extends any[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    keyGenerator: (...args: TArgs) => string,
    options?: CacheOptions
  ): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs): Promise<TReturn> => {
      const key = keyGenerator(...args);
      return this.getOrSet(key, () => fn(...args), options);
    };
  }

  /**
   * Cache list of items by individual keys
   */
  async cacheList<T extends { id: string }>(
    items: T[],
    getKey: (item: T) => string,
    options?: CacheOptions
  ): Promise<void> {
    if (items.length === 0) return;

    const operations = items.map((item) => ({
      key: getKey(item),
      value: item,
      ttl: options?.ttl,
    }));

    await this.cacheService.mset(operations);
  }

  /**
   * Get list of items from cache by keys
   */
  async getCachedList<T>(keys: string[], options?: CacheOptions): Promise<Array<T | null>> {
    if (keys.length === 0) return [];

    return this.cacheService.mget<T>(keys);
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.cacheService.deletePattern(`*:tag:${tag}:*`);
    }
  }

  /**
   * Cache with write-through pattern
   */
  async writeThrough<T>(
    key: string,
    value: T,
    persistFunction: (value: T) => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Persist to database first
    const persistedValue = await persistFunction(value);

    // Then cache the result
    await this.cacheService.set(key, persistedValue, options);

    return persistedValue;
  }

  /**
   * Cache with write-behind pattern
   */
  async writeBehind<T>(
    key: string,
    value: T,
    persistFunction: (value: T) => Promise<void>,
    options?: CacheOptions
  ): Promise<void> {
    // Cache immediately
    await this.cacheService.set(key, value, options);

    // Persist asynchronously (fire and forget)
    setImmediate(async () => {
      try {
        await persistFunction(value);
      } catch (error) {
        // Log error but don't fail the cache operation
        console.error('Write-behind persistence failed:', error);
      }
    });
  }

  /**
   * Lock pattern for preventing cache stampede
   */
  async lockAndSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    lockTtl = 10, // 10 seconds lock
    options?: CacheOptions
  ): Promise<T> {
    const lockKey = `lock:${key}`;

    // Try to acquire lock - simple approach
    const keyExists = await this.cacheService.exists(lockKey);
    if (keyExists) {
      // Lock is held by another process
      await this.sleep(100); // Wait 100ms
      const cached = await this.cacheService.get<T>(key, options);
      if (cached !== null) {
        return cached;
      }
      // If still no cached value, throw error to prevent stampede
      throw new Error('Cache lock conflict - try again later');
    }

    // Set the lock
    const lockAcquired = await this.cacheService.set(lockKey, '1', { ttl: lockTtl });

    if (!lockAcquired) {
      // Lock exists, wait and try to get cached value
      await this.sleep(100); // Wait 100ms
      const cached = await this.cacheService.get<T>(key, options);
      if (cached !== null) {
        return cached;
      }
      // If still no cached value, throw error to prevent stampede
      throw new Error('Cache lock conflict - try again later');
    }

    try {
      // Check cache again in case another process set it
      const cached = await this.cacheService.get<T>(key, options);
      if (cached !== null) {
        return cached;
      }

      // Execute function and cache result
      const result = await fetchFunction();
      if (result !== null && result !== undefined) {
        await this.cacheService.set(key, result, options);
      }

      return result;
    } finally {
      // Always release lock
      await this.cacheService.del(lockKey);
    }
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate cache key from template and parameters
   */
  static generateKey(template: string, params: Record<string, any>): string {
    let key = template;
    for (const [param, value] of Object.entries(params)) {
      key = key.replace(new RegExp(`{${param}}`, 'g'), String(value));
    }
    return key;
  }

  /**
   * Hash large keys to prevent key length issues
   */
  static hashKey(key: string): string {
    // Simple hash function - in production might want to use crypto
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Create hierarchical cache keys
   */
  static createHierarchicalKey(parts: string[]): string {
    return parts.filter(Boolean).join(':');
  }
}
