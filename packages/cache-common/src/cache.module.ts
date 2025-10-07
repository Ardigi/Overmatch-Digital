import { type DynamicModule, Global, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CacheConfig } from './interfaces/cache.interface';
import { CacheService } from './services/cache.service';

/**
 * Configuration token for cache module
 */
export const CACHE_CONFIG_TOKEN = 'CACHE_CONFIG';

/**
 * Cache module options for async configuration
 */
export interface CacheModuleAsyncOptions {
  useFactory?: (...args: any[]) => Promise<CacheConfig> | CacheConfig;
  inject?: any[];
  imports?: any[];
}

/**
 * Global cache module with flexible configuration
 */
@Global()
@Module({})
export class CacheModule {
  /**
   * Configure cache module with static configuration
   */
  static forRoot(config: CacheConfig): DynamicModule {
    const configProvider: Provider = {
      provide: CACHE_CONFIG_TOKEN,
      useValue: config,
    };

    const cacheServiceProvider: Provider = {
      provide: CacheService,
      useFactory: (cacheConfig: CacheConfig) => {
        return new CacheService(cacheConfig);
      },
      inject: [CACHE_CONFIG_TOKEN],
    };

    return {
      module: CacheModule,
      providers: [configProvider, cacheServiceProvider],
      exports: [CacheService],
    };
  }

  /**
   * Configure cache module with async configuration (recommended)
   */
  static forRootAsync(options: CacheModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: CACHE_CONFIG_TOKEN,
      useFactory: options.useFactory!,
      inject: options.inject || [],
    };

    const cacheServiceProvider: Provider = {
      provide: CacheService,
      useFactory: (cacheConfig: CacheConfig) => {
        return new CacheService(cacheConfig);
      },
      inject: [CACHE_CONFIG_TOKEN],
    };

    return {
      module: CacheModule,
      imports: options.imports || [],
      providers: [configProvider, cacheServiceProvider],
      exports: [CacheService],
    };
  }

  /**
   * Create cache configuration from environment variables
   */
  static createConfigFromEnv(configService: ConfigService): CacheConfig {
    return {
      redis: {
        host: configService.get('REDIS_HOST', '127.0.0.1'),
        port: configService.get('REDIS_PORT', 6379),
        password: configService.get('REDIS_PASSWORD'),
        db: configService.get('REDIS_DB', 0),
        retryDelayOnFailover: configService.get('REDIS_RETRY_DELAY', 100),
        maxRetriesPerRequest: configService.get('REDIS_MAX_RETRIES', 3),
      },
      defaultTtl: configService.get('CACHE_DEFAULT_TTL', 900), // 15 minutes
      keyPrefix: configService.get('CACHE_KEY_PREFIX', 'soc'),
      enabled: configService.get('CACHE_ENABLED', 'true') === 'true',
      gracefulDegradation: configService.get('CACHE_GRACEFUL_DEGRADATION', 'true') === 'true',
      maxKeyLength: configService.get('CACHE_MAX_KEY_LENGTH', 250),
      connectTimeout: configService.get('CACHE_CONNECT_TIMEOUT', 10000),
    };
  }
}
