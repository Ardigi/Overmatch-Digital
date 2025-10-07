import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { RedisModule } from '../redis/redis.module';
import { SharedAuthModule } from '../shared-auth/shared-auth.module';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AuditLog]),
    UsersModule,
    AuditModule, // Remove forwardRef since MfaModule doesn't create circular dependency with AuditModule
    RedisModule,
    SharedAuthModule, // Add SharedAuthModule for guards and decorators
  ],
  controllers: [MfaController],
  providers: [MfaService],
  exports: [MfaService],
})
export class MfaModule {}
