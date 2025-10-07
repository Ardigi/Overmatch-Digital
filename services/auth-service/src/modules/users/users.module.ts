import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { RedisModule } from '../redis/redis.module';
import { SharedAuthModule } from '../shared-auth/shared-auth.module';
import { Organization, Permission, Role, RolePermission, User, UserRole } from './entities';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization, Role, UserRole, Permission, RolePermission]),
    AuditModule,
    SharedAuthModule, // Use SharedAuthModule instead of AuthModule to avoid circular dependency
    RedisModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
