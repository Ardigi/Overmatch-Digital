import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../redis/redis.module';
import { CacheService } from './cache.service';

@Module({
  imports: [RedisModule, ConfigModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
