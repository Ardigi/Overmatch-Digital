import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MonitoringModule } from '@soc-compliance/monitoring';
import { RedisModule } from '../redis/redis.module';
import { EncryptionService } from './encryption.service';

@Module({
  imports: [ConfigModule, RedisModule, MonitoringModule],
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class EncryptionModule {}