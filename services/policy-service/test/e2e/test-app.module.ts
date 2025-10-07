// Ensure TypeORM is not mocked in E2E tests
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

// Test-specific health module without Terminus
import { Controller, type DynamicModule, Get, Module, Module as NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
// Import all entities
import { ALL_ENTITIES } from '../../src/entities';
import { ApiKeysModule } from '../../src/modules/api-keys/api-keys.module';
import { AssessmentsModule } from '../../src/modules/assessments/assessments.module';
import { AuditModule } from '../../src/modules/audit/audit.module';
import { CacheModule } from '../../src/modules/cache/cache.module';
import { ComplianceModule } from '../../src/modules/compliance/compliance.module';
import { ControlsModule } from '../../src/modules/controls/controls.module';
import { FrameworksModule } from '../../src/modules/frameworks/frameworks.module';
import { MappingsModule } from '../../src/modules/mappings/mappings.module';
import { MonitoringModule } from '../../src/modules/monitoring/monitoring.module';
// Feature modules
import { PoliciesModule } from '../../src/modules/policies/policies.module';
import { PolicyEngineModule } from '../../src/modules/policy-engine/policy-engine.module';
// Core modules
import { RedisModule } from '../../src/modules/redis/redis.module';
import { RisksModule } from '../../src/modules/risks/risks.module';
import { AllExceptionsFilter } from '../../src/shared/filters/all-exceptions.filter';
import { AuthorizationGuard } from '../../src/shared/guards/authorization.guard';
// Import guards and interceptors
import { KongAuthGuard } from '../../src/shared/guards/kong-auth.guard';
import { RolesGuard } from '../../src/shared/guards/roles.guard';
import { AuditInterceptor } from '../../src/shared/interceptors/audit.interceptor';
import { ErrorHandlingInterceptor } from '../../src/shared/interceptors/error-handling.interceptor';
// Shared modules for guards and services
import { SharedServicesModule } from '../../src/shared/shared-services.module';
// Use test version of EventsModule to avoid Kafka dependencies
import { TestEventsModule } from '../mocks/test-events.module';

@Controller('health')
class TestHealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}

@NestModule({
  controllers: [TestHealthController],
})
class TestHealthModule {}

@Module({})
export class TestAppModule {
  static async forRoot(): Promise<DynamicModule> {
    const imports: any[] = [];

    // Configuration - ConfigModule.forRoot() is now async
    const configModule = await ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.test', '.env'],
    });
    imports.push(configModule);

    // Event Emitter
    imports.push(EventEmitterModule.forRoot());

    // Scheduler
    imports.push(ScheduleModule.forRoot());

    // Database
    imports.push(
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          type: 'postgres',
          host: configService.get('DB_HOST', '127.0.0.1'),
          port: configService.get('DB_PORT', 5433),
          username: configService.get('DB_USERNAME', 'test_user'),
          password: configService.get('DB_PASSWORD', 'test_pass'),
          database: configService.get('DB_NAME', 'soc_policies_test'),
          entities: ALL_ENTITIES,
          synchronize: false, // Disable synchronize to avoid issues
          logging: false,
        }),
        inject: [ConfigService],
      })
    );

    // Shared modules (MUST be before other modules that use guards)
    imports.push(SharedServicesModule);

    // Core Modules
    imports.push(RedisModule, CacheModule, AuditModule, ApiKeysModule, MonitoringModule);

    // Feature Modules
    imports.push(
      PoliciesModule,
      ComplianceModule,
      ControlsModule,
      FrameworksModule,
      RisksModule,
      AssessmentsModule,
      MappingsModule,
      PolicyEngineModule,
      TestEventsModule
    );

    // Test Health Module (without Terminus)
    imports.push(TestHealthModule);

    return {
      module: TestAppModule,
      imports,
      providers: [
        // Note: Guards are applied at controller level via @UseGuards()
        // They will be instantiated in the module context where the controller lives
        // This is why we have SharedServicesModule to provide common dependencies

        // Global interceptors (these work fine as global providers)
        {
          provide: APP_INTERCEPTOR,
          useClass: ErrorHandlingInterceptor,
        },
        // Global filters
        {
          provide: APP_FILTER,
          useClass: AllExceptionsFilter,
        },
      ],
    };
  }
}
