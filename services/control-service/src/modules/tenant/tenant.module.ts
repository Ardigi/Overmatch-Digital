import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringModule } from '@soc-compliance/monitoring';
import { RedisModule } from '../redis/redis.module';
import { TenantIsolationService } from './tenant-isolation.service';
import { TenantAccessLog } from './entities/tenant-access-log.entity';
import { CrossTenantAccessRequest } from './entities/cross-tenant-access-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantAccessLog,
      CrossTenantAccessRequest,
    ]),
    RedisModule,
    MonitoringModule,
  ],
  providers: [TenantIsolationService],
  exports: [TenantIsolationService],
})
export class TenantModule {}