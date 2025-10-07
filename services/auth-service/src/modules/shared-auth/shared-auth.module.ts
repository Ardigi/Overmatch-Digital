import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { EmailVerificationService } from '../auth/email-verification.service';
import { ForgotPasswordService } from '../auth/forgot-password.service';
// Guards that other modules need
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
// Core services that can be shared without circular dependencies
import { PasswordPolicyService } from '../auth/password-policy.service';
import { PermissionService } from '../auth/permission.service';
import { RefreshTokenService } from '../auth/refresh-token.service';

// Note: ApiKeyStrategy moved to ApiKeysModule to avoid circular dependencies

import { RefreshToken } from '../../entities/refresh-token.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { EventsModule } from '../events/events.module';
// Import modules that don't cause circular dependencies
import { RedisModule } from '../redis/redis.module';
import { Organization } from '../users/entities/organization.entity';
import { Permission } from '../users/entities/permission.entity';
import { Role } from '../users/entities/role.entity';
import { RolePermission } from '../users/entities/role-permission.entity';
// Entities needed by shared services
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';

/**
 * SharedAuthModule contains common authentication utilities that can be
 * safely imported by other modules without causing circular dependencies.
 *
 * This module exports:
 * - Guards (JWT, Roles, Permission, RateLimit)
 * - Core services (PasswordPolicy, Permission, EmailVerification, ForgotPassword)
 * - Strategies (ApiKey only - JWT strategy remains in AuthModule due to UsersService dependency)
 *
 * It does NOT include:
 * - AuthService (to avoid circular dependencies)
 * - Controllers
 * - Services that depend on other feature modules
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION', '8h'),
        },
        verifyOptions: {
          clockTolerance: 30,
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      User,
      Organization,
      Role,
      UserRole,
      RolePermission,
      Permission,
      RefreshToken,
      AuditLog,
    ]),
    RedisModule,
    EventsModule,
  ],
  providers: [
    // Core services
    PasswordPolicyService,
    PermissionService,
    EmailVerificationService,
    ForgotPasswordService,
    RefreshTokenService,

    // Guards
    JwtAuthGuard,
    RolesGuard,
    PermissionGuard,
    RateLimitGuard,
  ],
  exports: [
    // Export services that other modules need
    PasswordPolicyService,
    PermissionService,
    EmailVerificationService,
    ForgotPasswordService,
    RefreshTokenService,

    // Export guards that other modules use
    JwtAuthGuard,
    RolesGuard,
    PermissionGuard,
    RateLimitGuard,

    // Export TypeORM for entity access
    TypeOrmModule,

    // Export JwtModule for other modules that need it
    JwtModule,
  ],
})
export class SharedAuthModule {}
