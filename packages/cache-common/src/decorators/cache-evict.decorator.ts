import { Inject, Logger } from '@nestjs/common';
import type { CacheService } from '../services/cache.service';
import { generateCacheKey, generateKeyPattern, generateTagKey } from '../utils/cache-key.util';

/**
 * Options for the @CacheEvict decorator
 */
export interface CacheEvictOptions {
  /**
   * Specific cache key to evict. If not provided, will be generated from method name and parameters
   */
  key?: string;

  /**
   * Service prefix for cache key generation
   */
  service?: string;

  /**
   * Tags to evict (all keys associated with these tags)
   */
  tags?: string[];

  /**
   * Pattern-based eviction (Redis SCAN pattern)
   */
  pattern?: string;

  /**
   * Whether to evict all cache entries for the class
   */
  allEntries?: boolean;

  /**
   * Method names to evict cache for (within the same class)
   */
  methods?: string[];

  /**
   * Enable logging for cache eviction operations
   */
  enableLogging?: boolean;

  /**
   * When to perform eviction: 'before' (before method execution) or 'after' (after method execution)
   */
  timing?: 'before' | 'after';

  /**
   * Condition function to determine if eviction should occur
   */
  condition?: (...args: any[]) => boolean;

  /**
   * Error handling strategy for eviction operations
   */
  onError?: 'ignore' | 'throw' | 'log';
}

/**
 * @CacheEvict decorator for cache invalidation
 * Automatically invalidates cache entries based on various strategies
 *
 * Usage examples:
 *
 * // Evict specific method cache
 * @CacheEvict({ methods: ['getUserById'] })
 * async updateUser(id: string, data: UpdateUserDto): Promise<User> {
 *   return this.userRepository.save({ id, ...data });
 * }
 *
 * // Evict by tags
 * @CacheEvict({ tags: ['user-data', 'user-permissions'] })
 * async deleteUser(id: string): Promise<void> {
 *   await this.userRepository.delete(id);
 * }
 *
 * // Evict by pattern
 * @CacheEvict({ pattern: 'user:*' })
 * async clearAllUserCache(): Promise<void> {
 *   // Implementation
 * }
 *
 * @param options - Cache eviction configuration options
 * @returns Method decorator
 */
export function CacheEvict(options: CacheEvictOptions = {}): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = String(propertyKey);
    const logger = new Logger(`@CacheEvict(${className}.${methodName})`);

    const {
      key: customKey,
      service,
      tags = [],
      pattern,
      allEntries = false,
      methods = [],
      enableLogging = false,
      timing = 'after',
      condition,
      onError = 'log',
    } = options;

    descriptor.value = async function (...args: any[]) {
      try {
        // Check condition if provided
        if (condition && !condition.apply(this, args)) {
          if (enableLogging) {
            logger.debug(`Cache eviction condition not met for ${methodName}`);
          }
          return await originalMethod.apply(this, args);
        }

        // Get cache service instance
        const cacheService: CacheService = this.cacheService || this.cacheManager;

        if (!cacheService) {
          if (enableLogging) {
            logger.warn(`Cache service not found for ${methodName}, skipping eviction`);
          }
          return await originalMethod.apply(this, args);
        }

        // Perform eviction before method execution if specified
        if (timing === 'before') {
          await performEviction(cacheService, {
            customKey,
            service,
            className,
            methodName,
            args,
            tags,
            pattern,
            allEntries,
            methods,
            enableLogging,
            logger,
          });
        }

        // Execute original method
        const result = await originalMethod.apply(this, args);

        // Perform eviction after method execution if specified
        if (timing === 'after') {
          await performEviction(cacheService, {
            customKey,
            service,
            className,
            methodName,
            args,
            tags,
            pattern,
            allEntries,
            methods,
            enableLogging,
            logger,
          });
        }

        return result;
      } catch (error) {
        if (enableLogging) {
          logger.error(`Cache eviction failed for ${methodName}: ${error.message}`);
        }

        if (onError === 'throw') {
          throw error;
        } else if (onError === 'log') {
          logger.error(
            `Continuing ${methodName} execution despite eviction error: ${error.message}`
          );
        }

        // Continue with original method execution even if eviction fails
        return await originalMethod.apply(this, args);
      }
    };

    // Preserve original method metadata
    Object.defineProperty(descriptor.value, 'name', {
      value: originalMethod.name,
      configurable: true,
    });

    // Add eviction metadata for reflection
    Reflect.defineMetadata('cache-evict:enabled', true, target, propertyKey);
    Reflect.defineMetadata('cache-evict:options', options, target, propertyKey);

    return descriptor;
  };
}

/**
 * Internal function to perform cache eviction
 */
async function performEviction(
  cacheService: CacheService,
  options: {
    customKey?: string;
    service?: string;
    className: string;
    methodName: string;
    args: any[];
    tags: string[];
    pattern?: string;
    allEntries: boolean;
    methods: string[];
    enableLogging: boolean;
    logger: Logger;
  }
): Promise<void> {
  const {
    customKey,
    service,
    className,
    methodName,
    args,
    tags,
    pattern,
    allEntries,
    methods,
    enableLogging,
    logger,
  } = options;

  try {
    // Evict specific key
    if (customKey) {
      await cacheService.del(customKey);
      if (enableLogging) {
        logger.debug(`Evicted cache key: ${customKey}`);
      }
    }

    // Evict by tags
    if (tags.length > 0) {
      await evictByTags(cacheService, tags, logger, enableLogging);
    }

    // Evict by pattern
    if (pattern) {
      await evictByPattern(cacheService, pattern, logger, enableLogging);
    }

    // Evict all entries for the class
    if (allEntries) {
      const classPattern = generateKeyPattern({ service, className });
      await evictByPattern(cacheService, classPattern, logger, enableLogging);
    }

    // Evict specific methods
    if (methods.length > 0) {
      for (const method of methods) {
        const methodKey = generateCacheKey({
          service,
          className,
          methodName: method,
          parameters: args,
        });
        await cacheService.del(methodKey);

        if (enableLogging) {
          logger.debug(`Evicted cache for method ${className}.${method}: ${methodKey}`);
        }
      }
    }

    // If no specific eviction strategy, evict current method cache
    if (!customKey && tags.length === 0 && !pattern && !allEntries && methods.length === 0) {
      const defaultKey = generateCacheKey({
        service,
        className,
        methodName,
        parameters: args,
      });
      await cacheService.del(defaultKey);

      if (enableLogging) {
        logger.debug(`Evicted default cache key: ${defaultKey}`);
      }
    }
  } catch (error) {
    if (enableLogging) {
      logger.error(`Cache eviction operation failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Evict cache entries by tags
 */
async function evictByTags(
  cacheService: CacheService,
  tags: string[],
  logger: Logger,
  enableLogging: boolean
): Promise<void> {
  for (const tag of tags) {
    try {
      const tagKey = generateTagKey(tag);
      const taggedKeys = await cacheService.get<string[]>(tagKey);

      if (taggedKeys && Array.isArray(taggedKeys)) {
        // Evict all keys associated with the tag
        await Promise.all(taggedKeys.map((key) => cacheService.del(key)));

        // Remove the tag key itself
        await cacheService.del(tagKey);

        if (enableLogging) {
          logger.debug(`Evicted ${taggedKeys.length} cache entries for tag: ${tag}`);
        }
      }
    } catch (error) {
      if (enableLogging) {
        logger.error(`Failed to evict cache by tag ${tag}: ${error.message}`);
      }
    }
  }
}

/**
 * Evict cache entries by pattern
 * Note: This is a simplified implementation. In production with Redis,
 * you should use SCAN command for better performance
 */
async function evictByPattern(
  cacheService: CacheService,
  pattern: string,
  logger: Logger,
  enableLogging: boolean
): Promise<void> {
  try {
    // This is a basic implementation - in production Redis environments,
    // you should implement SCAN-based pattern matching for better performance

    // Use the cache service's keys method
    const keys = await cacheService.keys(pattern);

    if (keys && keys.length > 0) {
      await Promise.all(keys.map((key: string) => cacheService.del(key)));

      if (enableLogging) {
        logger.debug(`Evicted ${keys.length} cache entries matching pattern: ${pattern}`);
      }
    } else {
      if (enableLogging) {
        logger.debug(`No keys found matching pattern: ${pattern}`);
      }
    }
  } catch (error) {
    if (enableLogging) {
      logger.error(`Failed to evict cache by pattern ${pattern}: ${error.message}`);
    }
  }
}

/**
 * Bulk cache eviction decorator
 * Evicts multiple cache strategies in one operation
 *
 * @param strategies - Array of eviction strategies
 * @returns Method decorator
 */
export function CacheEvictBulk(strategies: CacheEvictOptions[]): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = String(propertyKey);
    const logger = new Logger(`@CacheEvictBulk(${className}.${methodName})`);

    descriptor.value = async function (...args: any[]) {
      try {
        const cacheService: CacheService = this.cacheService || this.cacheManager;

        if (!cacheService) {
          logger.warn(`Cache service not found for ${methodName}, skipping bulk eviction`);
          return await originalMethod.apply(this, args);
        }

        // Execute original method first
        const result = await originalMethod.apply(this, args);

        // Perform bulk eviction
        await Promise.all(
          strategies.map(async (strategy) => {
            try {
              await performEviction(cacheService, {
                customKey: strategy.key,
                service: strategy.service,
                className,
                methodName,
                args,
                tags: strategy.tags || [],
                pattern: strategy.pattern,
                allEntries: strategy.allEntries || false,
                methods: strategy.methods || [],
                enableLogging: strategy.enableLogging || false,
                logger,
              });
            } catch (error) {
              logger.error(`Bulk eviction strategy failed: ${error.message}`);
            }
          })
        );

        return result;
      } catch (error) {
        logger.error(`Bulk cache eviction failed for ${methodName}: ${error.message}`);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Helper function to check if a method has cache eviction enabled
 *
 * @param target - Target class
 * @param methodName - Method name
 * @returns Whether the method has cache eviction enabled
 */
export function hasEviction(target: any, methodName: string): boolean {
  return Reflect.getMetadata('cache-evict:enabled', target, methodName) === true;
}

/**
 * Helper function to get cache eviction options for a method
 *
 * @param target - Target class
 * @param methodName - Method name
 * @returns Cache eviction options or null if not configured
 */
export function getEvictionOptions(target: any, methodName: string): CacheEvictOptions | null {
  if (!hasEviction(target, methodName)) {
    return null;
  }

  return Reflect.getMetadata('cache-evict:options', target, methodName) || {};
}
