import { Module } from '@nestjs/common';
import type { Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggingService, MetricsService, TracingService } from '@soc-compliance/monitoring';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { AuditModule } from '../audit/audit.module';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { EventsModule } from '../events/events.module';
import { KeycloakModule } from '../keycloak/keycloak.module';
import { MfaModule } from '../mfa/mfa.module';
import { RedisModule } from '../redis/redis.module';
import { SecurityModule } from '../security/security.module';
import { SessionModule } from '../sessions/session.module';
import { SharedAuthModule } from '../shared-auth/shared-auth.module';
import { SsoModule } from '../sso/sso.module';
import { Organization } from '../users/entities/organization.entity';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginEvent } from './entities/login-event.entity';
import { JwtRotationService } from './jwt-rotation.service';
import { RefreshTokenService } from './refresh-token.service';
import { SecurityEventsController } from './security-events.controller';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { MicrosoftStrategy } from './strategies/microsoft.strategy';

// Create dynamic providers for OAuth strategies
const createOAuthProviders = (): Provider[] => {
  const providers: Provider[] = [
    AuthService,
    RefreshTokenService,
    AnomalyDetectionService,
    JwtRotationService,
    LocalStrategy,
    JwtStrategy, // Keep JwtStrategy in AuthModule to avoid circular dependency with UsersService
    
    // Mock monitoring services while MonitoringModule is disabled
    {
      provide: MetricsService,
      useValue: {
        counter: () => ({ inc: () => {} }),
        histogram: () => ({ observe: () => {} }),
        gauge: () => ({ set: () => {} }),
        getMetric: () => undefined, // Return undefined so decorators create new metrics
        registerHistogram: () => ({ observe: () => {} }),
        registerCounter: () => ({ inc: () => {} }),
        registerGauge: () => ({ set: () => {} }),
        config: { serviceName: 'auth-service' }, // Add missing config property
      }
    },
    {
      provide: TracingService,
      useValue: {
        startSpan: () => ({ finish: () => {}, setTag: () => {}, log: () => {} }),
        inject: () => {},
        extract: () => {},
        withSpan: (name, callback, options) => {
          const mockSpan = { setAttribute: () => {}, setStatus: () => {}, finish: () => {} };
          return callback(mockSpan);
        },
      }
    },
    {
      provide: LoggingService,
      useValue: {
        log: () => {},
        error: () => {},
        warn: () => {},
        debug: () => {},
      }
    },
  ];

  // Always add the OAuth strategies, but they will handle their own configuration checks
  providers.push(GoogleStrategy, MicrosoftStrategy);

  return providers;
};

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([RefreshToken, AuditLog, User, Organization, Role, LoginEvent]),
    UsersModule,
    AuditModule,
    RedisModule,
    EventsModule,
    KeycloakModule, // Required for Keycloak JWT validation
    SharedAuthModule, // Import shared auth for common services and guards
    MfaModule, // Required for MfaService
    SessionModule, // Required for SessionService
    SecurityModule, // Required for DeviceFingerprintService
    SsoModule, // Required for OAuth strategies
    // MonitoringModule.forRoot({
    //   metrics: { serviceName: 'auth-service' },
    //   tracing: { serviceName: 'auth-service' },
    //   logging: { serviceName: 'auth-service' },
    // }), // Temporarily disabled - MonitoringModule dependency injection issues
  ],
  providers: createOAuthProviders(),
  controllers: [AuthController, SecurityEventsController],
  exports: [
    AuthService,
    RefreshTokenService,
    AnomalyDetectionService,
    JwtRotationService,
    // Other services are now exported by SharedAuthModule
  ],
})
export class AuthModule {}
