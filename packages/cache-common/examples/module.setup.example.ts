import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  CACHE_PREFIXES,
  CacheConfigFactory,
  CacheModule,
  CacheService,
} from '@soc-compliance/cache-common';

/**
 * Example 1: Basic module setup with development configuration
 */
@Module({
  imports: [ConfigModule.forRoot(), CacheModule.forRoot(CacheConfigFactory.development())],
  providers: [
    // Your services here
  ],
  exports: [CacheService],
})
export class BasicCacheExampleModule {}

/**
 * Example 2: Async configuration with environment variables
 */
@Module({
  imports: [
    ConfigModule.forRoot(),
    CacheModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => CacheConfigFactory.fromEnv(configService),
      inject: [ConfigService],
    }),
  ],
  providers: [
    // Your services here
  ],
  exports: [CacheService],
})
export class AsyncCacheExampleModule {}

/**
 * Example 3: Service-specific cache configuration
 */
@Module({
  imports: [
    ConfigModule.forRoot(),
    CacheModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const baseConfig = CacheConfigFactory.fromEnv(configService);
        // Create auth service specific configuration
        return CacheConfigFactory.forService('AUTH', baseConfig);
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    // Your auth services here
  ],
  exports: [CacheService],
})
export class AuthServiceCacheModule {}

/**
 * Example 4: Production configuration with custom settings
 */
@Module({
  imports: [
    ConfigModule.forRoot(),
    CacheModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', '127.0.0.1'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
        },
        defaultTtl: configService.get('CACHE_DEFAULT_TTL', 900), // 15 minutes
        keyPrefix: `soc:${configService.get('SERVICE_NAME', 'unknown')}`,
        enabled: configService.get('CACHE_ENABLED', 'true') === 'true',
        gracefulDegradation: true,
        maxKeyLength: 250,
        connectTimeout: 10000,
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    // Your services here
  ],
  exports: [CacheService],
})
export class ProductionCacheModule {}

/**
 * Example 5: Test configuration (cache disabled or using test Redis)
 */
@Module({
  imports: [
    ConfigModule.forRoot(),
    CacheModule.forRoot(
      process.env.NODE_ENV === 'test'
        ? CacheConfigFactory.test() // Uses test Redis instance
        : CacheConfigFactory.disabled() // Disables cache completely
    ),
  ],
  providers: [
    // Your services here
  ],
  exports: [CacheService],
})
export class TestCacheModule {}

/**
 * Example 6: App module with cache integration
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Cache module with environment-based configuration
    CacheModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get('NODE_ENV', 'development');

        switch (nodeEnv) {
          case 'production':
            return CacheConfigFactory.production(configService);
          case 'test':
            return CacheConfigFactory.test();
          default:
            return CacheConfigFactory.development();
        }
      },
      inject: [ConfigService],
    }),

    // Your feature modules
    // UserModule,
    // AuthModule,
    // etc.
  ],
  providers: [
    // Global providers
  ],
  exports: [CacheService],
})
export class AppModule {}

/**
 * Example environment variables (.env file)
 */
/*
# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# Cache Configuration  
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=900
CACHE_KEY_PREFIX=soc
CACHE_GRACEFUL_DEGRADATION=true
CACHE_MAX_KEY_LENGTH=250
CACHE_CONNECT_TIMEOUT=10000

# Service Configuration
SERVICE_NAME=auth-service
NODE_ENV=development
*

/**
 * Example Docker Compose configuration for Redis
 */
/*
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --requirepass soc_redis_pass
    volumes:
      - redis_data:/data
    environment:
      - REDIS_PASSWORD=soc_redis_pass
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "soc_redis_pass", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    command: redis-server --appendonly yes --requirepass soc_redis_pass
    environment:
      - REDIS_PASSWORD=soc_redis_pass
    profiles:
      - test

volumes:
  redis_data:
*/
