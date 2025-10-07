export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  namespace?: string;
  compress?: boolean;
}

export interface CacheKey {
  key: string;
  namespace?: string;
  tags?: string[];
}

export interface CacheEntry<T = any> {
  value: T;
  ttl?: number;
  createdAt: Date;
  expiresAt?: Date;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface CacheStatistics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  itemCount: number;
}

export interface CacheConfig {
  defaultTtl: number;
  maxSize?: number;
  evictionPolicy?: 'lru' | 'lfu' | 'fifo';
  namespace?: string;
  redisUrl?: string;
  enableCompression?: boolean;
  enableStatistics?: boolean;
}

export type CacheProvider = 'memory' | 'redis' | 'hybrid';

export interface ICacheService {
  get<T>(key: string, options?: CacheOptions): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByTags(tags: string[]): Promise<void>;
  clear(namespace?: string): Promise<void>;
  getStatistics(): Promise<CacheStatistics>;
}

export interface CacheItem<T = any> {
  key: string;
  value: T;
  metadata?: Record<string, any>;
  ttl?: number;
  tags?: string[];
}

export interface PolicyListFilters {
  category?: string;
  status?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PolicyEvaluationCacheContext {
  policyId: string;
  contextHash: string;
  result: any;
  evaluatedAt: Date;
  ttl: number;
  userId?: string;
  organizationId?: string;
  resource?: string;
  action?: string;
}

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  memoryUsage: number;
  keyCount: number;
  avgResponseTime: number;
}