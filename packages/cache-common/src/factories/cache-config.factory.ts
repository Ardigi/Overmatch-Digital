import { ConfigService } from '@nestjs/config';
import { CACHE_PREFIXES, CACHE_TTL } from '../index';
import type { CacheConfig } from '../interfaces/cache.interface';

/**
 * Factory for creating cache configurations
 */
export class CacheConfigFactory {
  /**
   * Create development configuration
   */
  static development(): CacheConfig {
    return {
      redis: {
        host: '127.0.0.1',
        port: 6379,
        password: 'soc_redis_pass',
        db: 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      },
      defaultTtl: CACHE_TTL.MEDIUM,
      keyPrefix: 'soc:dev',
      enabled: true,
      gracefulDegradation: true,
      maxKeyLength: 250,
      connectTimeout: 10000,
    };
  }

  /**
   * Create test configuration
   */
  static test(): CacheConfig {
    return {
      redis: {
        host: '127.0.0.1',
        port: 6380, // Different port for testing
        password: 'soc_redis_pass',
        db: 1,
        retryDelayOnFailover: 50,
        maxRetriesPerRequest: 1,
      },
      defaultTtl: CACHE_TTL.SHORT,
      keyPrefix: 'soc:test',
      enabled: true,
      gracefulDegradation: true,
      maxKeyLength: 250,
      connectTimeout: 5000,
    };
  }

  /**
   * Create production configuration
   */
  static production(configService: ConfigService): CacheConfig {
    return {
      redis: {
        host: configService.get('REDIS_HOST', 'redis'),
        port: configService.get('REDIS_PORT', 6379),
        password: configService.get('REDIS_PASSWORD'),
        db: configService.get('REDIS_DB', 0),
        retryDelayOnFailover: configService.get('REDIS_RETRY_DELAY', 100),
        maxRetriesPerRequest: configService.get('REDIS_MAX_RETRIES', 3),
      },
      defaultTtl: configService.get('CACHE_DEFAULT_TTL', CACHE_TTL.MEDIUM),
      keyPrefix: configService.get('CACHE_KEY_PREFIX', 'soc'),
      enabled: configService.get('CACHE_ENABLED', 'true') === 'true',
      gracefulDegradation: configService.get('CACHE_GRACEFUL_DEGRADATION', 'true') === 'true',
      maxKeyLength: configService.get('CACHE_MAX_KEY_LENGTH', 250),
      connectTimeout: configService.get('CACHE_CONNECT_TIMEOUT', 10000),
    };
  }

  /**
   * Create service-specific configuration
   */
  static forService(
    serviceName: keyof typeof CACHE_PREFIXES,
    baseConfig: CacheConfig
  ): CacheConfig {
    return {
      ...baseConfig,
      keyPrefix: `${baseConfig.keyPrefix}:${CACHE_PREFIXES[serviceName]}`,
    };
  }

  /**
   * Create configuration from environment variables
   */
  static fromEnv(configService: ConfigService): CacheConfig {
    const nodeEnv = configService.get('NODE_ENV', 'development');

    switch (nodeEnv) {
      case 'production':
        return CacheConfigFactory.production(configService);
      case 'test':
        return CacheConfigFactory.test();
      default:
        return CacheConfigFactory.development();
    }
  }

  /**
   * Create disabled configuration (for testing without Redis)
   */
  static disabled(): CacheConfig {
    return {
      redis: {
        host: 'localhost',
        port: 6379,
      },
      defaultTtl: CACHE_TTL.MEDIUM,
      keyPrefix: 'soc:disabled',
      enabled: false,
      gracefulDegradation: true,
      maxKeyLength: 250,
      connectTimeout: 1000,
    };
  }
}
