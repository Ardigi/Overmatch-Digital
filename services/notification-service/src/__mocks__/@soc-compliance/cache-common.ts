// Mock for @soc-compliance/cache-common

export class CacheService {
  private isConnected = true;
  
  constructor(config?: any) {
    // Mock constructor
  }

  async get<T = any>(key: string, options?: any): Promise<T | null> {
    return null;
  }

  async set<T = any>(key: string, value: T, options?: any): Promise<boolean> {
    return true;
  }

  async del(key: string): Promise<boolean> {
    return true;
  }

  async deletePattern(pattern: string): Promise<number> {
    return 0;
  }

  async flush(): Promise<boolean> {
    return true;
  }

  async isHealthy(): Promise<boolean> {
    return this.isConnected;
  }

  async close(): Promise<void> {
    this.isConnected = false;
    return Promise.resolve();
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}

// Mock the decorator
export function Cacheable(options?: any) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    return descriptor;
  };
}

// Export the interface
export interface ICacheService {
  get<T = any>(key: string, options?: any): Promise<T | null>;
  set<T = any>(key: string, value: T, options?: any): Promise<boolean>;
  del(key: string): Promise<boolean>;
  deletePattern(pattern: string): Promise<number>;
  flush(): Promise<boolean>;
  isHealthy(): Promise<boolean>;
  close(): Promise<void>;
}

export interface CacheOptions {
  ttl?: number;
  skipCache?: boolean;
}

export interface CacheConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  defaultTtl?: number;
  keyPrefix?: string;
  enabled?: boolean;
  gracefulDegradation?: boolean;
  connectTimeout?: number;
}