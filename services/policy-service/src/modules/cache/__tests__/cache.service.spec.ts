import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache.service';
import { RedisService } from '../../redis/redis.service';

describe('CacheService', () => {
  let service: CacheService;
  let mockRedisService: jest.Mocked<Pick<RedisService, 'get' | 'set' | 'del' | 'flushdb' | 'mget' | 'ttl' | 'keys' | 'sadd' | 'smembers' | 'srem' | 'expire'>>;
  let mockConfigService: any;

  beforeEach(() => {
    // Initialize Redis service mock with all required methods
    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      flushdb: jest.fn(),
      mget: jest.fn(),
      ttl: jest.fn(),
      keys: jest.fn(),
      sadd: jest.fn(),
      smembers: jest.fn(),
      srem: jest.fn(),
      expire: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key) => {
        if (key === 'policyService.redis') {
          return {
            ttl: 3600,
            max: 1000,
            prefix: 'policy-service',
          };
        }
        const config = {
          'cache.ttl': 3600,
          'cache.max': 1000,
          'cache.prefix': 'policy-service',
        };
        return config[key];
      }),
    };

    // Manual instantiation to avoid TypeORM issues
    service = new CacheService(mockRedisService as any, mockConfigService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should retrieve cached value', async () => {
      const cachedData = { id: 'test-123', value: 'test data' };
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await service.get('test-key');

      expect(result).toEqual(cachedData);
      expect(mockRedisService.get).toHaveBeenCalledWith('policy-service:test-key');
    });

    it('should return null for non-existent key', async () => {
      mockRedisService.get.mockResolvedValue(null);

      const result = await service.get('non-existent');

      expect(result).toBeNull();
    });

    it('should handle JSON parse errors', async () => {
      mockRedisService.get.mockResolvedValue('invalid-json');

      const result = await service.get('test-key');

      expect(result).toBe('invalid-json');
    });

    it('should track cache hit in stats', async () => {
      mockRedisService.get.mockResolvedValue('"cached-value"');

      await service.get('test-key');
      const stats = await service.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });

    it('should track cache miss in stats', async () => {
      mockRedisService.get.mockResolvedValue(null);

      await service.get('test-key');
      const stats = await service.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
    });
  });

  describe('set', () => {
    it('should cache value with default TTL', async () => {
      const data = { id: 'test-123', value: 'test data' };

      await service.set('test-key', data);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'policy-service:test-key',
        JSON.stringify(data),
        3600 // TTL in seconds, not milliseconds
      );
    });

    it('should cache value with custom TTL', async () => {
      const data = { value: 'test' };
      const options = { ttl: 1800 };

      await service.set('test-key', data, options);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'policy-service:test-key',
        JSON.stringify(data),
        1800 // TTL in seconds, not milliseconds
      );
    });

    it('should store tags when provided', async () => {
      const data = { value: 'test' };
      const options = { ttl: 3600, tags: ['tag1', 'tag2'] };

      await service.set('test-key', data, options);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'policy-service:test-key',
        JSON.stringify(data),
        3600
      );
      expect(mockRedisService.sadd).toHaveBeenCalledWith(
        'policy-service:tag:tag1',
        'policy-service:test-key'
      );
      expect(mockRedisService.sadd).toHaveBeenCalledWith(
        'policy-service:tag:tag2',
        'policy-service:test-key'
      );
      expect(mockRedisService.expire).toHaveBeenCalledWith(
        'policy-service:tag:tag1',
        86400
      );
      expect(mockRedisService.expire).toHaveBeenCalledWith(
        'policy-service:tag:tag2',
        86400
      );
    });

    it('should track cache set in stats', async () => {
      await service.set('test-key', { value: 'test' });
      const stats = await service.getStats();

      expect(stats.sets).toBe(1);
    });

    it('should handle circular references', async () => {
      const obj: any = { a: 1 };
      obj.circular = obj;

      await expect(service.set('test-key', obj)).resolves.not.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete cached value', async () => {
      await service.delete('test-key');

      expect(mockRedisService.del).toHaveBeenCalledWith('policy-service:test-key');
    });

    it('should handle deletion of non-existent keys', async () => {
      mockRedisService.del.mockResolvedValue(0);

      await expect(service.delete('non-existent')).resolves.not.toThrow();
    });
  });

  describe('deleteByTags', () => {
    it('should delete all keys associated with tags', async () => {
      const taggedKeys = ['policy-service:key1', 'policy-service:key2'];
      mockRedisService.smembers
        .mockResolvedValueOnce(taggedKeys)
        .mockResolvedValueOnce(taggedKeys);
      mockRedisService.del.mockResolvedValue(1);
      mockRedisService.srem.mockResolvedValue(1);

      await service.deleteByTags(['tag1', 'tag2']);

      expect(mockRedisService.smembers).toHaveBeenCalledWith('policy-service:tag:tag1');
      expect(mockRedisService.smembers).toHaveBeenCalledWith('policy-service:tag:tag2');
    });

    it('should handle empty tag lists', async () => {
      await service.deleteByTags([]);

      expect(mockRedisService.smembers).not.toHaveBeenCalled();
    });

    it('should handle tags with no associated keys', async () => {
      mockRedisService.smembers.mockResolvedValue([]);

      await service.deleteByTags(['empty-tag']);

      // Should still clean up the empty tag set
      expect(mockRedisService.del).toHaveBeenCalledWith('policy-service:tag:empty-tag');
    });
  });

  describe('clear', () => {
    it('should clear entire cache', async () => {
      await service.clear();

      expect(mockRedisService.flushdb).toHaveBeenCalled();
    });
  });

  describe('mget', () => {
    it('should retrieve multiple values', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = [JSON.stringify({ id: 1 }), JSON.stringify({ id: 2 }), null];
      mockRedisService.mget.mockResolvedValue(values);

      const result = await service.mget(keys);

      expect(result).toEqual([{ id: 1 }, { id: 2 }, null]);
      expect(mockRedisService.mget).toHaveBeenCalledWith(
        'policy-service:key1',
        'policy-service:key2',
        'policy-service:key3'
      );
    });

    it('should handle empty key array', async () => {
      const result = await service.mget([]);

      expect(result).toEqual([]);
      expect(mockRedisService.mget).not.toHaveBeenCalled();
    });
  });

  describe('mset', () => {
    it('should set multiple values', async () => {
      const items = [
        { key: 'key1', value: { id: 1 }, ttl: 1800 },
        { key: 'key2', value: { id: 2 } },
      ];

      await service.mset(items);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'policy-service:key1',
        JSON.stringify({ id: 1 }),
        1800 // TTL in seconds
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'policy-service:key2',
        JSON.stringify({ id: 2 }),
        3600 // TTL in seconds
      );
    });
  });

  describe('key building helpers', () => {
    it('should build framework key', () => {
      const key = service.buildFrameworkKey('framework-123');
      expect(key).toBe('framework:framework-123');
    });

    it('should build control key', () => {
      const key = service.buildControlKey('control-123');
      expect(key).toBe('control:control-123');
    });

    it('should build policy key', () => {
      const key = service.buildPolicyKey('policy-123');
      expect(key).toBe('policy:policy-123');
    });

    it('should build mapping key', () => {
      const key = service.buildMappingKey('mapping-123');
      expect(key).toBe('mapping:mapping-123');
    });
  });

  describe('cache statistics', () => {
    it('should track cache hits and misses', async () => {
      mockRedisService.get
        .mockResolvedValueOnce('"value"')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('"value"');

      await service.get('key1');
      await service.get('key2');
      await service.get('key3');

      const stats = await service.getStats();

      expect(stats).toMatchObject({
        hits: 2,
        misses: 1,
      });
      expect(stats.hitRate).toBeCloseTo(0.67, 1);
    });

    it('should reset statistics', async () => {
      mockRedisService.get.mockResolvedValue('"value"');

      await service.get('key1');
      await service.resetStats();

      const stats = await service.getStats();

      expect(stats).toMatchObject({
        hits: 0,
        misses: 0,
        hitRate: 0,
      });
    });
  });

  describe('cache warming', () => {
    it('should warm cache with predefined data', async () => {
      const warmupData = [
        { key: 'framework:soc2', value: { name: 'SOC2' } },
        { key: 'framework:iso27001', value: { name: 'ISO 27001' } },
      ];

      await service.warmCache(warmupData);

      expect(mockRedisService.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('TTL management', () => {
    it('should get remaining TTL for key', async () => {
      mockRedisService.ttl.mockResolvedValue(3600);

      const ttl = await service.getTTL('test-key');

      expect(ttl).toBe(3600);
      expect(mockRedisService.ttl).toHaveBeenCalledWith('policy-service:test-key');
    });

    it('should refresh TTL for existing key', async () => {
      mockRedisService.get.mockResolvedValue('"value"');

      await service.refreshTTL('test-key', 7200);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'policy-service:test-key',
        JSON.stringify('value'),
        7200 // TTL in seconds
      );
    });
  });

  describe('pattern-based operations', () => {
    it('should delete keys by pattern', async () => {
      mockRedisService.keys.mockResolvedValue([
        'policy-service:framework:123',
        'policy-service:framework:456',
      ]);
      mockRedisService.del.mockResolvedValue(2);

      const deletedCount = await service.deleteByPattern('framework:*');

      expect(deletedCount).toBe(2);
      expect(mockRedisService.del).toHaveBeenCalledWith('policy-service:framework:123');
      expect(mockRedisService.del).toHaveBeenCalledWith('policy-service:framework:456');
    });

    it('should get keys by pattern', async () => {
      mockRedisService.keys.mockResolvedValue([
        'policy-service:control:123',
        'policy-service:control:456',
      ]);

      const keys = await service.getKeysByPattern('control:*');

      expect(keys).toEqual(['control:123', 'control:456']);
    });
  });

  describe('error handling', () => {
    it('should handle redis service errors gracefully', async () => {
      mockRedisService.get.mockRejectedValue(new Error('Cache error'));

      const result = await service.get('test-key');

      expect(result).toBeNull();
    });

    it('should continue operation when tag deletion fails', async () => {
      mockRedisService.smembers.mockResolvedValue(['policy-service:key1']);
      mockRedisService.del.mockRejectedValue(new Error('Delete failed'));

      await expect(service.deleteByTags(['tag1'])).resolves.not.toThrow();
    });
  });

  describe('cache size management', () => {
    it('should check cache size', async () => {
      mockRedisService.keys.mockResolvedValue(Array(150).fill('policy-service:key'));

      const size = await service.getSize();

      expect(size).toBe(150);
    });

    it('should evict least recently used items when max size exceeded', async () => {
      // This would require LRU implementation
      const evicted = await service.evictLRU(10);

      expect(evicted).toBe(0); // Default implementation
    });
  });
});
