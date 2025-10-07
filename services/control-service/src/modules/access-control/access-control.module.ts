import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringModule } from '@soc-compliance/monitoring';
import { RedisModule } from '../redis/redis.module';
import { RbacAbacService } from './rbac-abac.service';
import { UserRole } from './entities/user-role.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { AbacPolicy } from './entities/abac-policy.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserRole,
      Role,
      Permission,
      AbacPolicy,
    ]),
    RedisModule,
    MonitoringModule,
  ],
  providers: [RbacAbacService],
  exports: [RbacAbacService],
})
export class AccessControlModule {}