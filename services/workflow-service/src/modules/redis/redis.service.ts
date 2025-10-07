import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private readonly prefix = 'workflow:';

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisConfig = {
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
      keyPrefix: this.prefix,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    };

    this.client = new Redis(redisConfig);

    this.client.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis client error:', err);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  // Cache Operations
  async setCache<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized, skipping cache set');
      return;
    }
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async getCache<T>(key: string): Promise<T | null> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized, skipping cache get');
      return null;
    }
    const value = await this.client.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.warn(`Failed to parse Redis value for key ${key}: ${error.message}`);
      return null;
    }
  }

  async delCache(key: string | string[]): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized, skipping cache delete');
      return 0;
    }
    if (Array.isArray(key)) {
      return this.client.del(...key);
    }
    return this.client.del(key);
  }

  async existsCache(key: string): Promise<boolean> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized, skipping cache exists check');
      return false;
    }
    const result = await this.client.exists(key);
    return result === 1;
  }

  async expireCache(key: string, seconds: number): Promise<boolean> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized, skipping cache expire');
      return false;
    }
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  async ttlCache(key: string): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis client not initialized, skipping TTL check');
      return -1;
    }
    return this.client.ttl(key);
  }

  // Pattern-based cache invalidation
  async invalidatePattern(pattern: string): Promise<number> {
    const keys = await this.client.keys(`${this.prefix}${pattern}`);
    if (keys.length === 0) return 0;

    // Remove prefix from keys since del doesn't use keyPrefix
    const keysWithoutPrefix = keys.map((key) => key.replace(this.prefix, ''));
    return this.client.del(...keysWithoutPrefix);
  }

  // Workflow-specific cache methods
  async cacheWorkflow(workflowId: string, workflowData: any, ttl = 3600): Promise<void> {
    await this.setCache(`workflow:${workflowId}`, workflowData, ttl);
  }

  async getCachedWorkflow(workflowId: string): Promise<any | null> {
    return this.getCache(`workflow:${workflowId}`);
  }

  async invalidateWorkflow(workflowId: string): Promise<void> {
    await this.delCache(`workflow:${workflowId}`);
    // Also invalidate related patterns
    await this.invalidatePattern(`workflow:${workflowId}:*`);
  }

  async cacheWorkflowList(
    organizationId: string,
    filters: any,
    data: any,
    ttl = 600
  ): Promise<void> {
    const cacheKey = `workflows:${organizationId}:${JSON.stringify(filters)}`;
    await this.setCache(cacheKey, data, ttl);
  }

  async getCachedWorkflowList(organizationId: string, filters: any): Promise<any | null> {
    const cacheKey = `workflows:${organizationId}:${JSON.stringify(filters)}`;
    return this.getCache(cacheKey);
  }

  async invalidateWorkflowList(organizationId: string): Promise<void> {
    await this.invalidatePattern(`workflows:${organizationId}:*`);
  }

  // Template caching
  async cacheWorkflowTemplate(templateId: string, templateData: any, ttl = 7200): Promise<void> {
    await this.setCache(`template:${templateId}`, templateData, ttl);
  }

  async getCachedWorkflowTemplate(templateId: string): Promise<any | null> {
    return this.getCache(`template:${templateId}`);
  }

  async invalidateWorkflowTemplate(templateId: string): Promise<void> {
    await this.delCache(`template:${templateId}`);
  }

  // Instance caching
  async cacheInstance(instanceId: string, instanceData: any, ttl = 1800): Promise<void> {
    await this.setCache(`instance:${instanceId}`, instanceData, ttl);
  }

  async getCachedInstance(instanceId: string): Promise<any | null> {
    return this.getCache(`instance:${instanceId}`);
  }

  async invalidateInstance(instanceId: string): Promise<void> {
    await this.delCache(`instance:${instanceId}`);
    // Also invalidate related execution data
    await this.invalidatePattern(`execution:${instanceId}:*`);
  }

  // Task caching
  async cacheTask(taskId: string, taskData: any, ttl = 1800): Promise<void> {
    await this.setCache(`task:${taskId}`, taskData, ttl);
  }

  async getCachedTask(taskId: string): Promise<any | null> {
    return this.getCache(`task:${taskId}`);
  }

  async invalidateTask(taskId: string): Promise<void> {
    await this.delCache(`task:${taskId}`);
  }

  // Execution state caching
  async cacheExecutionState(instanceId: string, state: any, ttl = 900): Promise<void> {
    await this.setCache(`execution:${instanceId}:state`, state, ttl);
  }

  async getCachedExecutionState(instanceId: string): Promise<any | null> {
    return this.getCache(`execution:${instanceId}:state`);
  }

  async invalidateExecutionState(instanceId: string): Promise<void> {
    await this.delCache(`execution:${instanceId}:state`);
  }

  // Activity log caching
  async cacheActivityLog(instanceId: string, activities: any[], ttl = 1800): Promise<void> {
    await this.setCache(`activity:${instanceId}`, activities, ttl);
  }

  async getCachedActivityLog(instanceId: string): Promise<any[] | null> {
    return this.getCache(`activity:${instanceId}`);
  }

  async invalidateActivityLog(instanceId: string): Promise<void> {
    await this.delCache(`activity:${instanceId}`);
  }

  // Approval caching
  async cacheApproval(approvalId: string, approvalData: any, ttl = 3600): Promise<void> {
    await this.setCache(`approval:${approvalId}`, approvalData, ttl);
  }

  async getCachedApproval(approvalId: string): Promise<any | null> {
    return this.getCache(`approval:${approvalId}`);
  }

  async invalidateApproval(approvalId: string): Promise<void> {
    await this.delCache(`approval:${approvalId}`);
  }

  // Lock operations for distributed operations
  async acquireLock(resource: string, ttl: number): Promise<string | null> {
    const lockId = Math.random().toString(36).substring(7);
    const lockKey = `lock:${resource}`;

    const result = await this.client.set(lockKey, lockId, 'PX', ttl * 1000, 'NX');
    return result === 'OK' ? lockId : null;
  }

  async releaseLock(resource: string, lockId: string): Promise<boolean> {
    const lockKey = `lock:${resource}`;
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.client.eval(script, 1, lockKey, lockId);
    return result === 1;
  }
}
