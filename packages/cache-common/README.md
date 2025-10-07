# @soc-compliance/cache-common

Enterprise-grade caching utilities for the SOC Compliance platform with NestJS decorators and Redis integration.

## Features

- 🚀 **@Cacheable Decorator** - Method-level caching with automatic key generation
- 🧹 **@CacheEvict Decorator** - Flexible cache invalidation strategies
- 🔑 **Type-Safe Key Generation** - Consistent cache key patterns
- 🏪 **Redis Integration** - Production-ready Redis support
- 🛡️ **Stampede Protection** - Prevents cache stampede scenarios
- 🏷️ **Tag-Based Invalidation** - Group and invalidate related cache entries
- 📊 **Built-in Monitoring** - Cache hit/miss logging and metrics

## Installation

```bash
npm install @soc-compliance/cache-common
```

## Quick Start

### 1. Module Setup

```typescript
import { Module } from '@nestjs/common';
import { SocCacheModule } from '@soc-compliance/cache-common';

@Module({
  imports: [
    // Simple Redis setup for SOC Compliance Platform
    SocCacheModule.forSocCompliance(),
    
    // Or custom configuration
    SocCacheModule.forRoot({
      store: 'redis',
      redis: {
        host: 'localhost',
        port: 6379,
        password: 'your-password'
      },
      ttl: 900, // 15 minutes
      prefix: 'my-app'
    })
  ]
})
export class AppModule {}
```

### 2. Service Integration

```typescript
import { Injectable } from '@nestjs/common';
import { 
  Cacheable, 
  CacheEvict, 
  InjectCacheManager,
  CACHE_TTL 
} from '@soc-compliance/cache-common';
import { Cache } from 'cache-manager';

@Injectable()
export class UserService {
  constructor(
    @InjectCacheManager() private cacheManager: Cache,
    private userRepository: UserRepository
  ) {}

  // Cache user data for 15 minutes
  @Cacheable({ 
    ttl: CACHE_TTL.MEDIUM,
    service: 'auth',
    tags: ['user-data'],
    enableLogging: true
  })
  async getUserById(id: string): Promise<User> {
    return this.userRepository.findOne({ where: { id } });
  }

  // Cache with custom key
  @Cacheable({ 
    key: 'active-users',
    ttl: CACHE_TTL.SHORT 
  })
  async getActiveUsers(): Promise<User[]> {
    return this.userRepository.find({ where: { active: true } });
  }

  // Evict cache after updating user
  @CacheEvict({ 
    methods: ['getUserById'], 
    tags: ['user-data'],
    enableLogging: true
  })
  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    return this.userRepository.save({ id, ...data });
  }

  // Clear all user-related cache
  @CacheEvict({ 
    pattern: 'auth:UserService:*',
    timing: 'before'
  })
  async clearUserCache(): Promise<void> {
    // Implementation
  }
}
```

## Advanced Usage

### Stampede Protection

Prevents multiple concurrent requests from executing expensive operations:

```typescript
@CacheableWithStampedeProtection({ 
  ttl: CACHE_TTL.LONG,
  enableLogging: true
})
async getExpensiveReport(params: ReportParams): Promise<Report> {
  // Only one instance will execute this expensive operation
  // Other concurrent requests will wait for the result
  return this.generateReport(params);
}
```

### Conditional Caching

Cache only when certain conditions are met:

```typescript
@Cacheable({
  ttl: CACHE_TTL.MEDIUM,
  condition: (userId: string, options: any) => {
    // Only cache for premium users
    return options.isPremium === true;
  }
})
async getUserPreferences(userId: string, options: any): Promise<Preferences> {
  return this.preferencesRepository.find({ userId });
}
```

### Bulk Cache Eviction

Execute multiple eviction strategies:

```typescript
import { CacheEvictBulk } from '@soc-compliance/cache-common';

@CacheEvictBulk([
  { tags: ['user-data'] },
  { pattern: 'auth:*:permissions' },
  { methods: ['getUserById', 'getUserPermissions'] }
])
async deleteUser(id: string): Promise<void> {
  await this.userRepository.delete(id);
}
```

### Custom Cache Validation

Validate cached data before returning:

```typescript
@Cacheable({
  ttl: CACHE_TTL.LONG,
  validate: (cachedUser) => {
    // Ensure cached user data is still valid
    return cachedUser && cachedUser.active && !cachedUser.deleted;
  }
})
async getValidUser(id: string): Promise<User> {
  return this.userRepository.findOne({ where: { id, active: true } });
}
```

## Configuration Options

### SocCacheModuleOptions

```typescript
interface SocCacheModuleOptions {
  store?: 'memory' | 'redis';           // Cache store type
  redis?: {
    host?: string;                      // Redis host
    port?: number;                      // Redis port
    password?: string;                  // Redis password
    db?: number;                        // Redis database
    keyPrefix?: string;                 // Key prefix for all Redis keys
  };
  ttl?: number;                         // Default TTL in seconds
  max?: number;                         // Maximum cache entries
  prefix?: string;                      // Global cache prefix
  enableMetrics?: boolean;              // Enable cache metrics
}
```

### CacheableOptions

```typescript
interface CacheableOptions {
  key?: string;                         // Custom cache key
  ttl?: number;                         // Time to live in seconds
  service?: string;                     // Service name for key generation
  tags?: string[];                      // Tags for group invalidation
  enableLogging?: boolean;              // Enable cache operation logging
  condition?: (...args: any[]) => boolean;  // Conditional caching
  validate?: (value: any) => boolean;   // Cached value validation
  onError?: 'ignore' | 'throw' | 'log'; // Error handling strategy
}
```

### CacheEvictOptions

```typescript
interface CacheEvictOptions {
  key?: string;                         // Specific key to evict
  service?: string;                     // Service name for key generation
  tags?: string[];                      // Tags to evict
  pattern?: string;                     // Pattern-based eviction
  allEntries?: boolean;                 // Evict all class entries
  methods?: string[];                   // Specific methods to evict
  timing?: 'before' | 'after';         // When to perform eviction
  condition?: (...args: any[]) => boolean;  // Conditional eviction
  enableLogging?: boolean;              // Enable eviction logging
}
```

## Cache Key Generation

The package automatically generates hierarchical cache keys following Redis best practices:

```typescript
// Generated key format: [service:]className:methodName[:parameters]

// Examples:
'auth:UserService:getUserById:123'
'client:OrganizationService:getByDomain:example.com'
'UserService:getActiveUsers'  // No service specified

// Long parameters are automatically hashed
'auth:UserService:searchUsers:a1b2c3d4'  // Hash of complex search params
```

## Error Handling

The decorators include comprehensive error handling:

```typescript
@Cacheable({
  onError: 'log',  // Options: 'ignore', 'throw', 'log'
  enableLogging: true
})
async getData(): Promise<Data> {
  // If cache operations fail, the method continues without caching
  // Errors are logged but don't break the application flow
}
```

## Best Practices

1. **Use appropriate TTL values** based on data volatility
2. **Enable logging in development** for debugging cache behavior
3. **Use tags for related data** that should be invalidated together
4. **Implement cache validation** for critical data integrity
5. **Monitor cache hit ratios** in production
6. **Use stampede protection** for expensive operations
7. **Consider conditional caching** for user-specific scenarios

## Integration with Existing Services

To integrate with existing SOC Compliance services:

```typescript
// In your service module
@Module({
  imports: [
    SocCacheModule.forSocCompliance(), // Uses environment variables
    // Your existing modules...
  ],
  providers: [YourService],
  exports: [YourService]
})
export class YourServiceModule {}

// Environment variables (.env)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=your-password
CACHE_TTL=900
CACHE_PREFIX=soc-cache
```

## TypeScript Support

Full TypeScript support with proper type inference:

```typescript
// Type-safe caching
@Cacheable({ ttl: CACHE_TTL.MEDIUM })
async getTypedData(id: string): Promise<MyDataType> {
  // Return type is automatically inferred and preserved
  return this.repository.findOne(id);
}
```

## License

Part of the SOC Compliance Platform - Internal Package