# Redis Caching Implementation

## Overview

The SOC Compliance Platform includes enterprise-grade Redis caching infrastructure with automatic method-level caching, production-ready patterns, and comprehensive monitoring capabilities.

## Key Features

- **@Cacheable Decorator**: Automatic method-level caching with minimal code changes
- **Production-Ready**: Graceful degradation, connection management, and error handling
- **Type-Safe**: Full TypeScript support with generic operations
- **Performance Monitoring**: Built-in statistics and health checks
- **Flexible Configuration**: TTL management, key patterns, and invalidation strategies

## Architecture

### Core Components

1. **CacheService**: Main Redis interface with production features
2. **@Cacheable Decorator**: Method interceptor for automatic caching
3. **Cache Configuration**: Environment-based configuration management
4. **Monitoring**: Performance tracking and health monitoring

### Package Structure

```
packages/cache-common/
├── src/
│   ├── services/
│   │   └── cache.service.ts        # Main Redis implementation
│   ├── decorators/
│   │   └── cacheable.decorator.ts  # @Cacheable decorator
│   ├── interfaces/
│   │   └── cache.interface.ts      # TypeScript interfaces
│   ├── utils/
│   │   └── cache-key.util.ts       # Key generation utilities
│   └── index.ts                    # Public API exports
```

## Usage Patterns

### 1. Automatic Method Caching

Use the `@Cacheable` decorator for automatic caching of expensive operations:

```typescript
import { Injectable } from '@nestjs/common';
import { Cacheable, CacheService } from '@soc-compliance/cache-common';

@Injectable()
export class UserService {
  constructor(
    private readonly cacheService: CacheService,
  ) {}

  @Cacheable({
    key: 'user-stats',
    ttl: 300, // 5 minutes
    service: 'auth',
    enableLogging: true,
  })
  async getUserStats(userId: string, period: string): Promise<UserStats> {
    // Expensive database operation - automatically cached
    const stats = await this.userRepository.createQueryBuilder('user')
      .select(['COUNT(*) as totalUsers', 'AVG(loginCount) as avgLogins'])
      .where('user.id = :userId', { userId })
      .andWhere('user.createdAt >= :startDate', { startDate: period })
      .getRawOne();
    
    return this.transformStats(stats);
  }
}
```

### 2. Manual Cache Operations

For complex scenarios requiring direct cache control:

```typescript
@Injectable()
export class SessionService {
  constructor(
    private readonly cacheService: CacheService,
  ) {}

  async createSession(userId: string, deviceInfo: DeviceInfo): Promise<Session> {
    const session = {
      id: uuidv4(),
      userId,
      deviceInfo,
      createdAt: new Date(),
    };

    // Cache with 24-hour TTL
    await this.cacheService.set(
      `session:${session.id}`, 
      session, 
      { ttl: 86400 }
    );

    // Add to user's active sessions
    const userSessions = await this.cacheService.get<string[]>(`user:${userId}:sessions`) || [];
    userSessions.push(session.id);
    await this.cacheService.set(`user:${userId}:sessions`, userSessions);

    return session;
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    // Get all user sessions
    const sessionIds = await this.cacheService.get<string[]>(`user:${userId}:sessions`);
    
    if (sessionIds?.length) {
      // Batch delete all sessions
      const sessionKeys = sessionIds.map(id => `session:${id}`);
      await this.cacheService.mdel(sessionKeys);
    }

    // Clear user session list
    await this.cacheService.del(`user:${userId}:sessions`);
  }
}
```

### 3. Batch Operations

For high-performance scenarios with multiple cache operations:

```typescript
@Injectable()
export class ClientService {
  async cacheClientData(clients: Client[]): Promise<void> {
    // Prepare batch operations
    const operations = clients.map(client => ({
      key: `client:${client.id}`,
      value: client,
      ttl: 3600, // 1 hour
    }));

    // Batch set all clients
    await this.cacheService.mset(operations);

    // Cache client list
    const clientList = clients.map(c => ({ id: c.id, name: c.name }));
    await this.cacheService.set('clients:list', clientList, { ttl: 1800 });
  }

  async getCachedClients(clientIds: string[]): Promise<(Client | null)[]> {
    const keys = clientIds.map(id => `client:${id}`);
    return await this.cacheService.mget<Client>(keys);
  }
}
```

## Configuration

### Service Configuration

```typescript
// In app.module.ts
import { CacheService } from '@soc-compliance/cache-common';

@Module({
  providers: [
    {
      provide: CacheService,
      useFactory: (configService: ConfigService) => {
        return new CacheService({
          redis: {
            host: configService.get('REDIS_HOST', '127.0.0.1'),
            port: configService.get('REDIS_PORT', 6379),
            password: configService.get('REDIS_PASSWORD'),
            db: configService.get('REDIS_DB', 0),
          },
          defaultTtl: 900, // 15 minutes
          keyPrefix: 'soc-auth',
          enabled: true,
          gracefulDegradation: true,
          maxKeyLength: 250,
          connectTimeout: 10000,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}
```

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# Cache Configuration
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=900
CACHE_KEY_PREFIX=soc-platform
CACHE_GRACEFUL_DEGRADATION=true
```

## @Cacheable Decorator Options

### Basic Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `key` | `string` | Auto-generated | Custom cache key |
| `ttl` | `number` | `CACHE_TTL.MEDIUM` | Time to live in seconds |
| `service` | `string` | Class name | Service prefix for key generation |
| `enableLogging` | `boolean` | `false` | Log cache hits/misses |

### Advanced Options

| Option | Type | Description |
|--------|------|-------------|
| `tags` | `string[]` | Tags for cache invalidation groups |
| `validate` | `function` | Validation function for cached values |
| `condition` | `function` | Condition function to determine if caching should occur |
| `onError` | `'ignore' \| 'throw' \| 'log'` | Error handling strategy |

### Examples

```typescript
// Basic caching
@Cacheable({ ttl: 300 })
async getUser(id: string): Promise<User> { }

// With validation
@Cacheable({
  ttl: 600,
  validate: (user) => user && user.id && !user.deleted,
})
async getActiveUser(id: string): Promise<User> { }

// Conditional caching
@Cacheable({
  ttl: 300,
  condition: (userId, includeDeleted) => !includeDeleted,
})
async getUser(userId: string, includeDeleted: boolean): Promise<User> { }

// With tags for group invalidation
@Cacheable({
  ttl: 1800,
  tags: ['user-data', 'profile'],
})
async getUserProfile(id: string): Promise<UserProfile> { }
```

## Performance Optimization

### Key Generation Strategy

The cache system automatically generates keys based on:

1. **Service prefix**: Prevents key collisions between services
2. **Method name**: Identifies the cached operation
3. **Parameters**: Creates unique keys for different arguments
4. **Custom key**: Override for specific patterns

Example generated key: `soc-auth:UserService:getUserStats:user123:monthly`

### TTL Strategies

```typescript
// Predefined TTL constants
export const CACHE_TTL = {
  SHORT: 60,      // 1 minute - volatile data
  MEDIUM: 900,    // 15 minutes - user sessions
  LONG: 3600,     // 1 hour - user profiles
  EXTENDED: 86400, // 24 hours - static configuration
};

// Usage examples
@Cacheable({ ttl: CACHE_TTL.SHORT })   // Frequently changing data
@Cacheable({ ttl: CACHE_TTL.MEDIUM })  // User-specific data
@Cacheable({ ttl: CACHE_TTL.LONG })    // Organization data
@Cacheable({ ttl: CACHE_TTL.EXTENDED }) // System configuration
```

### Memory Management

```typescript
// Cache cleanup patterns
await this.cacheService.deletePattern('session:expired:*');
await this.cacheService.deletePattern('temp:*');

// Bulk operations for efficiency
const operations = users.map(user => ({
  key: `user:${user.id}`,
  value: user,
  ttl: CACHE_TTL.LONG,
}));
await this.cacheService.mset(operations);
```

## Monitoring and Observability

### Health Checks

```typescript
@Injectable()
export class CacheHealthService {
  constructor(private readonly cacheService: CacheService) {}

  @Get('/health/cache')
  async checkCacheHealth(): Promise<HealthStatus> {
    const isHealthy = await this.cacheService.isHealthy();
    const stats = await this.cacheService.stats();

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      details: {
        connected: stats.connected,
        hits: stats.hits,
        misses: stats.misses,
        hitRate: stats.hits / (stats.hits + stats.misses) * 100,
        uptime: stats.uptime,
        memory: stats.memory,
        keys: stats.keys,
      },
    };
  }
}
```

### Performance Metrics

```typescript
// Built-in statistics
const stats = await this.cacheService.stats();
console.log(`Cache hit rate: ${stats.hits / (stats.hits + stats.misses) * 100}%`);
console.log(`Memory usage: ${stats.memory} bytes`);
console.log(`Total keys: ${stats.keys}`);
```

### Logging

```typescript
// Enable detailed logging
@Cacheable({
  enableLogging: true,
  ttl: 300,
})
async expensiveOperation(): Promise<Result> {
  // Logs will show:
  // - Cache hits/misses
  // - Key generation
  // - Performance timing
  // - Error conditions
}
```

## Error Handling and Resilience

### Graceful Degradation

The cache service is designed to gracefully handle Redis failures:

```typescript
// Production configuration - graceful degradation enabled
const cacheService = new CacheService({
  gracefulDegradation: true, // Continue without cache if Redis fails
  redis: { /* connection config */ },
});

// If Redis is unavailable:
// - get() returns null
// - set() returns false
// - Service continues functioning
// - Errors are logged but don't throw
```

### Connection Management

```typescript
// Automatic reconnection with backoff
const cacheService = new CacheService({
  redis: {
    host: '127.0.0.1',
    port: 6379,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  },
  connectTimeout: 10000,
});
```

### Error Handling Strategies

```typescript
// Different error handling approaches
@Cacheable({
  onError: 'ignore', // Continue silently on cache errors
})
async nonCriticalOperation(): Promise<Result> { }

@Cacheable({
  onError: 'log', // Log errors but continue
})
async importantOperation(): Promise<Result> { }

@Cacheable({
  onError: 'throw', // Throw errors for critical operations
})
async criticalOperation(): Promise<Result> { }
```

## Testing

### Unit Testing

Mock the cache service for unit tests:

```typescript
describe('UserService', () => {
  let service: UserService;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      // ... other methods
    } as any;

    service = new UserService(mockCache);
  });

  it('should cache user stats', async () => {
    mockCache.get.mockResolvedValue(null); // Cache miss
    mockCache.set.mockResolvedValue(true);

    const stats = await service.getUserStats('user123');

    expect(mockCache.get).toHaveBeenCalledWith('user-stats:user123');
    expect(mockCache.set).toHaveBeenCalledWith('user-stats:user123', stats, { ttl: 300 });
  });
});
```

### Integration Testing

Test with real Redis for integration tests:

```typescript
describe('Cache Integration', () => {
  let cacheService: CacheService;
  let redis: Redis;

  beforeAll(async () => {
    // Require real Redis connection
    redis = new Redis({ host: '127.0.0.1', port: 6379 });
    await redis.ping(); // Must succeed or test fails

    cacheService = new CacheService({
      redis: { host: '127.0.0.1', port: 6379 },
      gracefulDegradation: false, // Fail fast for tests
      keyPrefix: 'test',
    });
  });

  afterAll(async () => {
    await redis.flushdb(); // Clean up
    await cacheService.close();
    await redis.quit();
  });

  it('should cache and retrieve data from real Redis', async () => {
    const key = 'integration-test';
    const value = { test: 'data', timestamp: Date.now() };

    // Set in cache
    const setResult = await cacheService.set(key, value);
    expect(setResult).toBe(true);

    // Verify in Redis directly
    const redisValue = await redis.get(`test:${key}`);
    expect(JSON.parse(redisValue)).toEqual(value);

    // Get from cache
    const cached = await cacheService.get(key);
    expect(cached).toEqual(value);
  });
});
```

## Best Practices

### 1. Key Design

```typescript
// Good key patterns
'user:123'              // Simple entity lookup
'user:123:profile'      // Entity sub-resource
'org:456:users:active'  // Hierarchical data
'session:temp:uuid'     // Temporary data with clear lifecycle

// Avoid
'userdata123'          // Not structured
'user_profile_123_v2'  // Hard to pattern match
'very-long-key-name-that-exceeds-limits' // Too long
```

### 2. TTL Management

```typescript
// Match TTL to data volatility
@Cacheable({ ttl: 60 })     // Real-time data (1 minute)
@Cacheable({ ttl: 900 })    // User sessions (15 minutes)  
@Cacheable({ ttl: 3600 })   // User profiles (1 hour)
@Cacheable({ ttl: 86400 })  // System config (24 hours)
```

### 3. Cache Invalidation

```typescript
// Tag-based invalidation
@Cacheable({ tags: ['user-data'] })
async getUserProfile(id: string): Promise<Profile> { }

// Manual invalidation on updates
async updateUserProfile(id: string, updates: ProfileUpdate): Promise<void> {
  await this.userRepository.update(id, updates);
  
  // Invalidate related cache entries
  await this.cacheService.deletePattern(`user:${id}:*`);
}
```

### 4. Performance Considerations

```typescript
// Use batch operations for multiple items
const clients = await this.cacheService.mget(clientIds.map(id => `client:${id}`));

// Prefer specific patterns over broad sweeps
await this.cacheService.deletePattern('session:expired:*'); // Good
await this.cacheService.deletePattern('*'); // Bad - too broad
```

### 5. Error Handling

```typescript
// For critical paths - fail fast
@Cacheable({ onError: 'throw' })
async criticalUserData(): Promise<Data> { }

// For performance optimization - graceful degradation
@Cacheable({ onError: 'ignore' })
async nonEssentialStats(): Promise<Stats> { }
```

## Troubleshooting

### Common Issues

1. **Cache Misses**: Check key generation and TTL values
2. **Memory Usage**: Monitor Redis memory and implement cleanup patterns
3. **Connection Issues**: Verify Redis configuration and network connectivity
4. **Performance**: Use batch operations and appropriate TTL values

### Debugging

```typescript
// Enable logging for debugging
@Cacheable({
  enableLogging: true,
  ttl: 300,
})
async debugMethod(): Promise<Result> {
  // Will log:
  // - Cache key generation
  // - Hit/miss status
  // - Performance timing
  // - Error conditions
}

// Check cache health
const health = await this.cacheService.isHealthy();
const stats = await this.cacheService.stats();
console.log('Cache Health:', { health, stats });
```

### Performance Profiling

```typescript
// Measure cache performance
const start = Date.now();
const result = await this.cachedMethod();
const duration = Date.now() - start;

console.log(`Cache operation took ${duration}ms`);
```

## Migration Guide

### From Previous Implementation

If migrating from a previous caching implementation:

1. **Replace old cache imports**:
   ```typescript
   // Old
   import { CacheManager } from '@nestjs/cache-manager';
   
   // New
   import { CacheService } from '@soc-compliance/cache-common';
   ```

2. **Update service injection**:
   ```typescript
   // Old
   constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}
   
   // New
   constructor(private readonly cacheService: CacheService) {}
   ```

3. **Update method calls**:
   ```typescript
   // Old
   await this.cache.set(key, value, ttl);
   const result = await this.cache.get(key);
   
   // New
   await this.cacheService.set(key, value, { ttl });
   const result = await this.cacheService.get<Type>(key);
   ```

4. **Add @Cacheable decorators**:
   ```typescript
   // Add automatic caching to expensive methods
   @Cacheable({ ttl: 300, service: 'user' })
   async expensiveMethod(): Promise<Result> { }
   ```

## Conclusion

The Redis caching implementation provides enterprise-grade caching capabilities with minimal integration effort. The combination of automatic method-level caching via `@Cacheable` decorator and manual cache operations provides flexibility for all use cases while maintaining production reliability and performance.

For additional questions or issues, refer to the integration tests in each service for real-world usage examples.