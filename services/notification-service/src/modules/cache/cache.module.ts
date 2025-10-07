import { Module } from '@nestjs/common';
import { CacheService } from '@soc-compliance/cache-common';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [
    {
      provide: CacheService,
      useFactory: (configService: ConfigService) => {
        return new CacheService({
          enabled: configService.get('cache.enabled', true),
          defaultTtl: configService.get('cache.ttl', 300),
          keyPrefix: configService.get('cache.keyPrefix', 'notification'),
          gracefulDegradation: true,
          connectTimeout: 10000,
          redis: {
            host: configService.get('redis.host', '127.0.0.1'),
            port: configService.get('redis.port', 6379),
            password: configService.get('redis.password'),
            db: configService.get('redis.db', 0),
          },
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}