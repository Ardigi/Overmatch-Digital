/**
 * Cache configuration options
 */
export interface CacheConfig {
  /**
   * Redis connection configuration
   */
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    retryDelayOnFailover?: number;
    maxRetriesPerRequest?: number;
  };

  /**
   * Default TTL in seconds
   */
  defaultTtl: number;

  /**
   * Cache key prefix
   */
  keyPrefix: string;

  /**
   * Enable/disable cache (useful for testing)
   */
  enabled: boolean;

  /**
   * Graceful degradation when Redis is unavailable
   */
  gracefulDegradation: boolean;

  /**
   * Maximum key length allowed
   */
  maxKeyLength?: number;

  /**
   * Connection timeout in milliseconds
   */
  connectTimeout?: number;
}

/**
 * Options for cache operations
 */
export interface CacheOptions {
  /**
   * Time to live in seconds
   */
  ttl?: number;

  /**
   * Whether to return null or throw error on cache miss
   */
  throwOnMiss?: boolean;

  /**
   * Custom key prefix for this operation
   */
  prefix?: string;

  /**
   * Whether to use compression for large values
   */
  compress?: boolean;

  /**
   * Tags for cache invalidation
   */
  tags?: string[];
}

/**
 * Batch operation for multiple keys
 */
export interface BatchOperation<T = any> {
  key: string;
  value: T;
  ttl?: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memory: number;
  uptime: number;
  connected: boolean;
}

/**
 * Main cache service interface
 */
export interface ICacheService {
  /**
   * Get a value from cache
   */
  get<T = any>(key: string, options?: CacheOptions): Promise<T | null>;

  /**
   * Set a value in cache
   */
  set<T = any>(key: string, value: T, options?: CacheOptions): Promise<boolean>;

  /**
   * Delete a key from cache
   */
  del(key: string): Promise<boolean>;

  /**
   * Check if a key exists in cache
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get multiple values at once
   */
  mget<T = any>(keys: string[]): Promise<Array<T | null>>;

  /**
   * Set multiple values at once
   */
  mset<T = any>(operations: BatchOperation<T>[]): Promise<boolean>;

  /**
   * Delete multiple keys at once
   */
  mdel(keys: string[]): Promise<number>;

  /**
   * Get all keys matching a pattern
   */
  keys(pattern: string): Promise<string[]>;

  /**
   * Delete all keys matching a pattern
   */
  deletePattern(pattern: string): Promise<number>;

  /**
   * Increment a numeric value
   */
  incr(key: string, options?: CacheOptions): Promise<number>;

  /**
   * Decrement a numeric value
   */
  decr(key: string, options?: CacheOptions): Promise<number>;

  /**
   * Set expiration time for a key
   */
  expire(key: string, seconds: number): Promise<boolean>;

  /**
   * Get remaining time to live for a key
   */
  ttl(key: string): Promise<number>;

  /**
   * Clear all cache
   */
  flush(): Promise<boolean>;

  /**
   * Get cache statistics
   */
  stats(): Promise<CacheStats>;

  /**
   * Check if cache is connected and healthy
   */
  isHealthy(): Promise<boolean>;

  /**
   * Close cache connection
   */
  close(): Promise<void>;
}

/**
 * Cache event types
 */
export enum CacheEventType {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  READY = 'ready',
  RECONNECTING = 'reconnecting',
}

/**
 * Cache event data
 */
export interface CacheEvent {
  type: CacheEventType;
  timestamp: Date;
  data?: any;
  error?: Error;
}
