import { Injectable } from '@nestjs/common';
import { 
  CACHE_TTL,
  Cacheable, 
  CacheableWithStampedeProtection,
  CacheEvict, 
  CacheEvictBulk,
  type CacheService, 
  InjectCacheService
} from '@soc-compliance/cache-common';

interface User {
  id: string;
  email: string;
  name: string;
  active: boolean;
}

interface UpdateUserDto {
  name?: string;
  email?: string;
  active?: boolean;
}

/**
 * Example service demonstrating cache decorator usage
 */
@Injectable()
export class UserService {
  constructor(
    @InjectCacheService() private readonly cacheService: CacheService,
    // Your repository would be injected here
    // private readonly userRepository: UserRepository
  ) {}

  /**
   * Example 1: Basic caching with automatic key generation
   * Cache key: "auth:UserService:getUserById:123"
   */
  @Cacheable({ 
    ttl: CACHE_TTL.MEDIUM,
    service: 'auth',
    enableLogging: true
  })
  async getUserById(id: string): Promise<User | null> {
    console.log(`Fetching user ${id} from database...`);
    // Simulate database call
    return {
      id,
      email: `user${id}@example.com`,
      name: `User ${id}`,
      active: true
    };
  }

  /**
   * Example 2: Custom cache key
   * Cache key: "active-users"
   */
  @Cacheable({ 
    key: 'active-users',
    ttl: CACHE_TTL.SHORT,
    enableLogging: true
  })
  async getActiveUsers(): Promise<User[]> {
    console.log('Fetching active users from database...');
    // Simulate database call
    return [
      { id: '1', email: 'user1@example.com', name: 'User 1', active: true },
      { id: '2', email: 'user2@example.com', name: 'User 2', active: true }
    ];
  }

  /**
   * Example 3: Conditional caching
   * Only cache for premium users
   */
  @Cacheable({
    ttl: CACHE_TTL.LONG,
    service: 'auth',
    condition: (userId: string, options: any) => {
      return options?.isPremium === true;
    },
    enableLogging: true
  })
  async getUserPreferences(userId: string, options: { isPremium?: boolean } = {}): Promise<any> {
    console.log(`Fetching preferences for user ${userId}...`);
    return {
      theme: 'dark',
      notifications: true,
      language: 'en'
    };
  }

  /**
   * Example 4: Cache with validation
   * Validate that cached user is still active
   */
  @Cacheable({
    ttl: CACHE_TTL.MEDIUM,
    service: 'auth',
    validate: (cachedUser: User) => {
      return cachedUser && cachedUser.active && !cachedUser.email?.includes('deleted');
    },
    enableLogging: true
  })
  async getValidUser(id: string): Promise<User | null> {
    console.log(`Fetching valid user ${id} from database...`);
    return {
      id,
      email: `user${id}@example.com`,
      name: `User ${id}`,
      active: true
    };
  }

  /**
   * Example 5: Cache with tags for group invalidation
   */
  @Cacheable({ 
    ttl: CACHE_TTL.MEDIUM,
    service: 'auth',
    tags: ['user-data', 'user-permissions'],
    enableLogging: true
  })
  async getUserWithPermissions(id: string): Promise<User & { permissions: string[] }> {
    console.log(`Fetching user ${id} with permissions from database...`);
    const user = await this.getUserById(id);
    return {
      ...user!,
      permissions: ['read', 'write']
    };
  }

  /**
   * Example 6: Stampede protection for expensive operations
   * Multiple concurrent requests will wait for the first to complete
   */
  @CacheableWithStampedeProtection({ 
    ttl: CACHE_TTL.LONG,
    service: 'reporting',
    enableLogging: true
  })
  async generateExpensiveUserReport(userId: string): Promise<any> {
    console.log(`Generating expensive report for user ${userId}...`);
    // Simulate expensive operation
    await new Promise(resolve => setTimeout(resolve, 2000));
    return {
      userId,
      reportData: 'Complex analytics data...',
      generatedAt: new Date()
    };
  }

  /**
   * Example 7: Cache eviction after update
   * Evicts specific method cache and tag-based cache
   */
  @CacheEvict({ 
    methods: ['getUserById', 'getValidUser'], 
    tags: ['user-data'],
    enableLogging: true
  })
  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    console.log(`Updating user ${id}...`);
    // Simulate database update
    return {
      id,
      email: data.email || `user${id}@example.com`,
      name: data.name || `User ${id}`,
      active: data.active ?? true
    };
  }

  /**
   * Example 8: Pattern-based cache eviction
   * Clears all user-related cache
   */
  @CacheEvict({ 
    pattern: 'auth:UserService:*',
    timing: 'before',
    enableLogging: true
  })
  async clearUserCache(): Promise<void> {
    console.log('Clearing all user cache...');
    // This method clears cache before execution
  }

  /**
   * Example 9: Bulk cache eviction with multiple strategies
   */
  @CacheEvictBulk([
    { tags: ['user-data'] },
    { pattern: 'auth:*:permissions' },
    { methods: ['getUserById', 'getUserWithPermissions'] },
    { key: 'active-users' }
  ])
  async deleteUser(id: string): Promise<void> {
    console.log(`Deleting user ${id}...`);
    // Simulate database deletion
    // Multiple cache eviction strategies are applied
  }

  /**
   * Example 10: Manual cache operations using the service directly
   */
  async manualCacheOperations(userId: string): Promise<void> {
    // Manual cache operations when decorators aren't suitable
    const cacheKey = `manual:user:${userId}`;
    
    // Check if cached
    const cached = await this.cacheService.get<User>(cacheKey);
    if (cached) {
      console.log('Found in cache:', cached);
      return;
    }
    
    // Fetch and cache
    const user = await this.getUserById(userId);
    await this.cacheService.set(cacheKey, user, { ttl: CACHE_TTL.SHORT });
    
    // Set with tags
    const tagKey = 'tag:manual-operations';
    const taggedKeys = await this.cacheService.get<string[]>(tagKey) || [];
    taggedKeys.push(cacheKey);
    await this.cacheService.set(tagKey, taggedKeys, { ttl: CACHE_TTL.SHORT });
    
    console.log('Cached manually:', user);
  }

  /**
   * Example 11: Batch operations
   */
  async batchCacheOperations(userIds: string[]): Promise<User[]> {
    // Get multiple users from cache
    const cacheKeys = userIds.map(id => `auth:UserService:getUserById:${id}`);
    const cachedUsers = await this.cacheService.mget<User>(cacheKeys);
    
    // Find missing users
    const missingIds: string[] = [];
    cachedUsers.forEach((user, index) => {
      if (!user) {
        missingIds.push(userIds[index]);
      }
    });
    
    // Fetch missing users
    const missingUsers: User[] = [];
    for (const id of missingIds) {
      const user = await this.getUserById(id); // This will cache individually
      if (user) {
        missingUsers.push(user);
      }
    }
    
    // Combine results
    const allUsers: User[] = [];
    cachedUsers.forEach((user, index) => {
      if (user) {
        allUsers.push(user);
      } else {
        const missingUser = missingUsers.find(u => u.id === userIds[index]);
        if (missingUser) {
          allUsers.push(missingUser);
        }
      }
    });
    
    return allUsers;
  }

  /**
   * Example 12: Cache statistics and health check
   */
  async getCacheInfo(): Promise<any> {
    const stats = await this.cacheService.stats();
    const isHealthy = await this.cacheService.isHealthy();
    
    return {
      stats,
      isHealthy,
      timestamp: new Date()
    };
  }
}