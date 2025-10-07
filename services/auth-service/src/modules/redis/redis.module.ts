import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamicConfigService } from '../../config/dynamic-config.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: RedisService,
      useFactory: (configService: ConfigService, dynamicConfigService?: DynamicConfigService) => {
        return new RedisService(configService, dynamicConfigService);
      },
      inject: [ConfigService, { token: DynamicConfigService, optional: true }],
    },
  ],
  exports: [RedisService],
})
export class RedisModule {}
