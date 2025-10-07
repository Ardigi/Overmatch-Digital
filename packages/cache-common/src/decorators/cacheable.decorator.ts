import { Inject, Logger } from '@nestjs/common';
import { CACHE_TTL } from '../index';
import { CacheService } from '../services/cache.service';
import { generateCacheKey, validateCacheKey } from '../utils/cache-key.util';

/**
 * Options for the @Cacheable decorator
 */
export interface CacheableOptions {
  /**
   * Cache key to use. If not provided, will be generated from method name and parameters
   */
  key?: string;

  /**
   * Time to live in seconds. Defaults to CACHE_TTL.MEDIUM (15 minutes)
   */
  ttl?: number;

  /**
   * Service prefix for cache key generation
   */
  service?: string;

  /**
   * Tags for cache invalidation grouping
   */
  tags?: string[];

  /**
   * Validation function to verify cached result
   */
  validate?: (value: any) => boolean;

  /**
   * Enable logging for cache hits/misses
   */
  enableLogging?: boolean;

  /**
   * Condition function to determine if caching should occur
   */
  condition?: (...args: any[]) => boolean;

  /**
   * Error handling strategy for cache operations
   */
  onError?: 'ignore' | 'throw' | 'log';
}

/**
 * Cache service injection token
 */
const CACHE_SERVICE_TOKEN = CacheService;

/**
 * @Cacheable decorator for method-level caching
 * Automatically caches method results with configurable TTL and key generation
 *
 * Usage:
 * @Cacheable({ ttl: 300, service: 'auth' })
 * async getUserById(id: string): Promise<User> {
 *   return this.userRepository.findOne({ where: { id } });
 * }
 *
 * @param options - Caching configuration options
 * @returns Method decorator
 */
export function Cacheable(options: CacheableOptions = {}): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = String(propertyKey);
    const logger = new Logger(`@Cacheable(${className}.${methodName})`);

    const {
      key: customKey,
      ttl = CACHE_TTL.MEDIUM,
      service,
      tags = [],
      validate,
      enableLogging = false,
      condition,
      onError = 'log',
    } = options;

    descriptor.value = async function (...args: any[]) {
      try {
        // Check condition if provided
        if (condition && !condition.apply(this, args)) {
          if (enableLogging) {
            logger.debug(`Cache condition not met for ${methodName}`);
          }
          return await originalMethod.apply(this, args);
        }

        // Get cache service instance
        const cacheService: CacheService = this.cacheService || this.cacheManager;

        if (!cacheService) {
          if (enableLogging) {
            logger.warn(`Cache service not found for ${methodName}, executing without cache`);
          }
          return await originalMethod.apply(this, args);
        }

        // Generate cache key
        const cacheKey = generateCacheKey({
          service,
          className,
          methodName,
          parameters: args,
          customKey,
        });

        // Validate cache key
        const validation = validateCacheKey(cacheKey);
        if (!validation.valid) {
          if (enableLogging) {
            logger.warn(`Invalid cache key for ${methodName}: ${validation.issues.join(', ')}`);
          }
          return await originalMethod.apply(this, args);
        }

        // Try to get from cache
        const cachedResult = await cacheService.get(cacheKey);

        if (cachedResult !== undefined && cachedResult !== null) {
          // Validate cached result if validator provided
          if (validate && !validate(cachedResult)) {
            if (enableLogging) {
              logger.debug(`Cache validation failed for ${methodName}, key: ${cacheKey}`);
            }
            // Remove invalid cached value
            await cacheService.del(cacheKey);
          } else {
            if (enableLogging) {
              logger.debug(`Cache hit for ${methodName}, key: ${cacheKey}`);
            }
            return cachedResult;
          }
        }

        // Cache miss - execute original method
        if (enableLogging) {
          logger.debug(`Cache miss for ${methodName}, key: ${cacheKey}`);
        }

        const result = await originalMethod.apply(this, args);

        // Cache the result
        try {
          await cacheService.set(cacheKey, result, { ttl });

          // Store tags for invalidation if provided
          if (tags.length > 0) {
            for (const tag of tags) {
              const tagKey = `tag:${tag}`;
              const taggedKeys = (await cacheService.get<string[]>(tagKey)) || [];
              if (!taggedKeys.includes(cacheKey)) {
                taggedKeys.push(cacheKey);
                await cacheService.set(tagKey, taggedKeys, { ttl });
              }
            }
          }

          if (enableLogging) {
            logger.debug(`Cached result for ${methodName}, key: ${cacheKey}, ttl: ${ttl}s`);
          }
        } catch (cacheError) {
          if (enableLogging) {
            logger.error(`Failed to cache result for ${methodName}: ${cacheError.message}`);
          }

          if (onError === 'throw') {
            throw cacheError;
          }
        }

        return result;
      } catch (error) {
        if (enableLogging) {
          logger.error(`Cache operation failed for ${methodName}: ${error.message}`);
        }

        if (onError === 'throw') {
          throw error;
        } else if (onError === 'log') {
          logger.error(`Executing ${methodName} without cache due to error: ${error.message}`);
        }

        // Fallback to original method execution
        return await originalMethod.apply(this, args);
      }
    };

    // Preserve original method metadata
    Object.defineProperty(descriptor.value, 'name', {
      value: originalMethod.name,
      configurable: true,
    });

    // Add cache metadata for reflection
    Reflect.defineMetadata('cache:enabled', true, target, propertyKey);
    Reflect.defineMetadata('cache:options', options, target, propertyKey);

    return descriptor;
  };
}

/**
 * Property decorator to inject cache service
 * Use this in services that use @Cacheable decorator
 */
export function InjectCacheService() {
  return Inject(CacheService);
}

/**
 * Legacy alias for compatibility
 */
export const InjectCacheManager = InjectCacheService;

/**
 * Helper function to check if a method is cacheable
 *
 * @param target - Target class
 * @param methodName - Method name
 * @returns Whether the method has caching enabled
 */
export function isCacheable(target: any, methodName: string): boolean {
  return Reflect.getMetadata('cache:enabled', target, methodName) === true;
}

/**
 * Helper function to get cache options for a method
 *
 * @param target - Target class
 * @param methodName - Method name
 * @returns Cache options or null if not cacheable
 */
export function getCacheOptions(target: any, methodName: string): CacheableOptions | null {
  if (!isCacheable(target, methodName)) {
    return null;
  }

  return Reflect.getMetadata('cache:options', target, methodName) || {};
}

/**
 * Advanced @Cacheable decorator with stampede protection
 * Prevents multiple concurrent requests from executing the same expensive operation
 *
 * @param options - Caching configuration options
 * @returns Method decorator with stampede protection
 */
export function CacheableWithStampedeProtection(options: CacheableOptions = {}): MethodDecorator {
  const pendingPromises = new Map<string, Promise<any>>();

  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = String(propertyKey);
    const logger = new Logger(`@CacheableWithStampedeProtection(${className}.${methodName})`);

    const {
      key: customKey,
      ttl = CACHE_TTL.MEDIUM,
      service,
      enableLogging = false,
      onError = 'log',
    } = options;

    descriptor.value = async function (...args: any[]) {
      try {
        const cacheService: CacheService = this.cacheService || this.cacheManager;

        if (!cacheService) {
          return await originalMethod.apply(this, args);
        }

        const cacheKey = generateCacheKey({
          service,
          className,
          methodName,
          parameters: args,
          customKey,
        });

        // Check cache first
        const cachedResult = await cacheService.get(cacheKey);
        if (cachedResult !== undefined && cachedResult !== null) {
          if (enableLogging) {
            logger.debug(`Cache hit for ${methodName}, key: ${cacheKey}`);
          }
          return cachedResult;
        }

        // Check if operation is already in progress
        if (pendingPromises.has(cacheKey)) {
          if (enableLogging) {
            logger.debug(`Waiting for pending operation for ${methodName}, key: ${cacheKey}`);
          }
          return await pendingPromises.get(cacheKey);
        }

        // Start new operation
        const promise = (async () => {
          try {
            const result = await originalMethod.apply(this, args);
            await cacheService.set(cacheKey, result, { ttl });

            if (enableLogging) {
              logger.debug(`Cached result for ${methodName}, key: ${cacheKey}`);
            }

            return result;
          } finally {
            pendingPromises.delete(cacheKey);
          }
        })();

        pendingPromises.set(cacheKey, promise);
        return await promise;
      } catch (error) {
        if (enableLogging) {
          logger.error(`Cache operation failed for ${methodName}: ${error.message}`);
        }

        if (onError === 'throw') {
          throw error;
        }

        return await originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}
