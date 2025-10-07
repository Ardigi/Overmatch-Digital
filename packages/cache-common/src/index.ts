/**
 * SOC Compliance Cache Common Package
 * Enterprise-grade caching utilities with decorators and NestJS module
 *
 * Features:
 * - @Cacheable decorator for method-level caching
 * - @CacheEvict decorator for cache invalidation
 * - Type-safe cache key generation
 * - Redis integration with NestJS
 * - Stampede protection
 * - Tag-based invalidation
 * - Pattern-based eviction
 */

export const CACHE_VERSION = '2.0.0';

// Cache key prefixes for each service
export const CACHE_PREFIXES = {
  AUTH: 'auth',
  CLIENT: 'client',
  POLICY: 'policy',
  CONTROL: 'control',
  EVIDENCE: 'evidence',
  WORKFLOW: 'workflow',
  REPORTING: 'reporting',
  AUDIT: 'audit',
  INTEGRATION: 'integration',
  NOTIFICATION: 'notification',
  AI: 'ai',
} as const;

// Common cache TTL values (in seconds)
export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 900, // 15 minutes
  LONG: 1800, // 30 minutes
  VERY_LONG: 3600, // 1 hour
  DAY: 86400, // 24 hours
} as const;

// Cache key patterns
export const CACHE_PATTERNS = {
  USER: (userId: string) => `user:${userId}`,
  SESSION: (sessionId: string) => `session:${sessionId}`,
  ORGANIZATION: (orgId: string) => `org:${orgId}`,
  CONTROL: (controlId: string) => `control:${controlId}`,
  POLICY: (policyId: string) => `policy:${policyId}`,
  REPORT: (reportId: string) => `report:${reportId}`,
} as const;

export { CacheModule } from './cache.module';
// Export existing cache decorator (basic)
export * from './decorators/cache.decorator';

// Export basic decorators (legacy compatibility)
export {
  Cacheable as BasicCacheable,
  type CacheDecoratorOptions,
  CacheEvict as BasicCacheEvict,
  CachePut,
} from './decorators/cache.decorator';
export {
  CacheEvict,
  CacheEvictBulk,
  type CacheEvictOptions,
  getEvictionOptions,
  hasEviction,
} from './decorators/cache-evict.decorator';
// Export enhanced decorators (preferred)
export {
  Cacheable,
  type CacheableOptions,
  CacheableWithStampedeProtection,
  getCacheOptions,
  InjectCacheManager,
  InjectCacheService,
  isCacheable,
} from './decorators/cacheable.decorator';
export { CacheConfigFactory } from './factories/cache-config.factory';
// Export interfaces
export * from './interfaces/cache.interface';
// Export existing cache service and module
export { CacheService } from './services/cache.service';
// Export cache utilities
export {
  generateCacheKey,
  generateHashedKey,
  generateKeyPattern,
  generateParameterKey,
  generateTagKey,
  normalizeCacheKey,
  validateCacheKey,
} from './utils/cache-key.util';
