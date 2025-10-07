import { HttpModule } from '@nestjs/axios';
import { type DynamicModule, type ForwardReference, Module, type Provider, type Type } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpCommonModule } from '@soc-compliance/http-common';
import { MonitoringModule as MonitoringPackageModule } from '@soc-compliance/monitoring';
// Secrets are managed at infrastructure level via environment variables
import configuration from './config/configuration';
import { PolicyDynamicConfigService } from './config/dynamic-config.service';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuditService } from './modules/audit/audit.service';
import { CacheModule } from './modules/cache/cache.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { ControlsModule } from './modules/controls/controls.module';
import { EventsModule } from './modules/events/events.module';
import { FrameworksModule } from './modules/frameworks/frameworks.module';
import { HealthModule } from './modules/health/health.module';
import { MappingsModule } from './modules/mappings/mappings.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { OpaModule } from './modules/opa/opa.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { PolicyEngineModule } from './modules/policy-engine/policy-engine.module';
import { RedisModule } from './modules/redis/redis.module';
import { RisksModule } from './modules/risks/risks.module';
import { SearchModule } from './modules/search/search.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { AuditInterceptor } from './shared/interceptors/audit.interceptor';
import { SecurityHeadersInterceptor } from './shared/interceptors/security-headers.interceptor';

@Module({})
export class AppModule {
  static async forRoot(): Promise<DynamicModule> {
    const imports: Array<DynamicModule | Type<any> | Promise<DynamicModule> | ForwardReference> = [];
    const providers: Provider[] = [];

    // Configuration - ConfigModule.forRoot() is now async
    const configModule = await ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
    });
    imports.push(configModule);

    // 🔐 ENTERPRISE SECRETS MANAGEMENT - SOC 2 Compliant
    // Secrets are managed at the infrastructure level:
    // - Docker Secrets for development/swarm
    // - HashiCorp Vault for production
    // - Kubernetes Secrets for K8s deployments
    // Services read secrets from environment variables (12-Factor App methodology)
    
    // Dynamic Configuration Service with Secrets Integration
    providers.push(PolicyDynamicConfigService);
    // Event Emitter
    imports.push(EventEmitterModule.forRoot());

    // Scheduler
    imports.push(ScheduleModule.forRoot());

    // Rate Limiting with multiple throttlers (skip in test)
    if (process.env.NODE_ENV !== 'test') {
      const throttlerModule = await ThrottlerModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => [
          {
            name: 'short',
            ttl: configService.get('policyService.rateLimit.ttl', 60),
            limit: configService.get('policyService.rateLimit.limit', 10),
          },
          {
            name: 'medium',
            ttl: 300, // 5 minutes
            limit: 20,
          },
          {
            name: 'long',
            ttl: 900, // 15 minutes
            limit: 100,
          },
        ],
      });
      imports.push(throttlerModule);
    }

    // Database - Use synchronous config in test environment
    if (process.env.NODE_ENV === 'test') {
      // Import all entities explicitly for test mode
      const entities = await import('./entities');
      const entityList = entities.ALL_ENTITIES;

      // For tests, use synchronous configuration with explicit entities
      const typeOrmModule = TypeOrmModule.forRoot({
        type: 'postgres',
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '5433'),
        username: process.env.DB_USERNAME || 'test_user',
        password: process.env.DB_PASSWORD || 'test_pass',
        database: process.env.DB_NAME || 'soc_policies_test',
        entities: entityList,
        autoLoadEntities: false, // Use explicit entities in test mode
        synchronize: false, // Disable synchronize to avoid index conflicts
        logging: false,
        dropSchema: false,
      });
      imports.push(typeOrmModule);
    } else {
      // For non-test environments, use async configuration
      const typeOrmModule = await TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => {
          const dbConfig = configService.get('policyService.database');
          return {
            type: 'postgres',
            host: dbConfig.host,
            port: dbConfig.port,
            username: dbConfig.username,
            password: dbConfig.password,
            database: dbConfig.database,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: false, // Disable synchronize to avoid index conflicts
            logging: dbConfig.logging,
          };
        },
        inject: [ConfigService],
      });
      imports.push(typeOrmModule);
    }

    // HTTP - Skip in test environment to avoid WeakMap error
    if (process.env.NODE_ENV !== 'test') {
      imports.push(
        HttpModule.register({
          timeout: 5000,
          maxRedirects: 5,
        })
      );
    }

    // Core Modules - Include enterprise monitoring
    imports.push(
      RedisModule,
      CacheModule,
      AuditModule,
      ApiKeysModule,
      MonitoringModule,
      HttpCommonModule.forRoot()
    );

    // Enterprise Monitoring Package Integration
    if (process.env.NODE_ENV !== 'test') {
      const monitoringPackageModule = MonitoringPackageModule.forRoot({
        metrics: {
          serviceName: 'policy-service',
          port: parseInt(process.env.METRICS_PORT || '9091', 10),
          path: '/metrics',
          enableDefaultMetrics: true,
          prefix: 'policy_service_',
        },
        tracing: {
          serviceName: 'policy-service',
          endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
          enabled: process.env.ENABLE_TRACING !== 'false',
          samplingRatio: 1.0,
        },
        logging: {
          serviceName: 'policy-service',
          level: process.env.LOG_LEVEL || 'info',
          console: true,
        },
      });
      imports.push(monitoringPackageModule);
    }

    // Conditionally load modules that might have issues in test environment
    if (process.env.NODE_ENV !== 'test') {
      // SearchModule disabled due to dependency injection issues
      // imports.push(SearchModule, OpaModule);
      imports.push(OpaModule);
    }

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
      EventsModule,
      HealthModule
    );

    // Note: ThrottlerGuard is now applied at controller level via @UseGuards
    // This allows for better control and avoids dependency injection issues in E2E tests

    // Global Filters
    providers.push({
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    });

    // Global Interceptors
    providers.push({
      provide: APP_INTERCEPTOR,
      useClass: SecurityHeadersInterceptor,
    });

    providers.push({
      provide: APP_INTERCEPTOR,
      useFactory: (auditService: AuditService) => new AuditInterceptor(auditService),
      inject: [AuditService],
    });

    return {
      module: AppModule,
      imports,
      providers,
    };
  }
}
