import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for cache decorator
 */
export const CACHE_METADATA = 'cache_metadata';

/**
 * Cache decorator options
 */
export interface CacheDecoratorOptions {
  /**
   * Cache key template (can use parameter names)
   * Example: 'user:{userId}:profile'
   */
  key: string;

  /**
   * TTL in seconds
   */
  ttl?: number;

  /**
   * Whether to cache null/undefined results
   */
  cacheNull?: boolean;

  /**
   * Custom key prefix
   */
  prefix?: string;

  /**
   * Tags for cache invalidation
   */
  tags?: string[];
}

/**
 * Decorator to mark methods for caching
 * Usage: @Cacheable({ key: 'user:{userId}', ttl: 300 })
 */
export const Cacheable = (options: CacheDecoratorOptions) => {
  return SetMetadata(CACHE_METADATA, options);
};

/**
 * Decorator to mark methods that should invalidate cache
 * Usage: @CacheEvict({ keys: ['user:{userId}', 'users:*'] })
 */
export const CacheEvict = (options: { keys: string[]; beforeInvocation?: boolean }) => {
  return SetMetadata('cache_evict', options);
};

/**
 * Decorator to mark methods that should update cache
 * Usage: @CachePut({ key: 'user:{userId}', ttl: 300 })
 */
export const CachePut = (options: CacheDecoratorOptions) => {
  return SetMetadata('cache_put', options);
};
