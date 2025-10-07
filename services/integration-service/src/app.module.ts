import { BullModule } from '@nestjs/bull';
import { type DynamicModule, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthCommonModule, JwtAuthGuard } from '@soc-compliance/auth-common';
import { HttpCommonModule } from '@soc-compliance/http-common';
import { MonitoringModule } from '@soc-compliance/monitoring';
// Common
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { monitoringConfig, testMonitoringConfig } from './monitoring.config';
import { HealthModule } from './modules/health/health.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
// Feature Modules
import { RedisModule } from './modules/redis/redis.module';
import { SyncModule } from './modules/sync/sync.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({})
export class AppModule {
  static async forRoot(): Promise<DynamicModule> {
    const imports = [];

    imports.push(
      // Configuration
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env',
        validate: (config) => {
          // Validate required environment variables
          const required = ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME'];
          const missing = required.filter((key) => !config[key]);
          if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
          }
          return config;
        },
      }),

      // Event Emitter for internal events
      EventEmitterModule.forRoot({
        wildcard: true,
        delimiter: '.',
        maxListeners: 10,
        verboseMemoryLeak: true,
      }),

      // Scheduler for sync jobs
      ScheduleModule.forRoot(),

      // Database
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          type: 'postgres',
          host: configService.get('DB_HOST', '127.0.0.1'),
          port: configService.get('DB_PORT', 5432),
          username: configService.get('DB_USERNAME', 'soc_user'),
          password: configService.get('DB_PASSWORD', 'soc_pass'),
          database: configService.get('DB_NAME', 'soc_integrations'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
          synchronize: configService.get('NODE_ENV') !== 'production',
          migrationsRun: configService.get('NODE_ENV') === 'production',
          logging: configService.get('NODE_ENV') === 'development',
          logger: 'advanced-console',
          poolSize: 10,
          extra: {
            max: 10,
            connectionTimeoutMillis: 10000,
          },
        }),
        inject: [ConfigService],
      }),

      // Redis Queue Configuration
      BullModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          redis: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            password: configService.get('REDIS_PASSWORD'),
          },
          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: false,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        }),
        inject: [ConfigService],
      }),

      // Kafka Client for event publishing
      ClientsModule.registerAsync([
        {
          name: 'KAFKA_SERVICE',
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'integration-service',
                brokers: configService.get('KAFKA_BROKERS')?.split(',') || ['localhost:9092'],
              },
              producer: {
                allowAutoTopicCreation: true,
                transactionTimeout: 30000,
              },
            },
          }),
          inject: [ConfigService],
        },
      ]),

      // Authentication - Temporarily disabled for E2E testing
      ...(process.env.NODE_ENV !== 'test' ? [AuthCommonModule] : []),

      // HTTP Common Module for service discovery and HTTP utilities
      HttpCommonModule.forRoot(),

      // Monitoring
      MonitoringModule.forRoot(
        process.env.NODE_ENV === 'test' ? testMonitoringConfig : monitoringConfig
      ),

      // Redis Cache
      RedisModule,

      // Feature Modules
      IntegrationsModule,
      SyncModule,
      WebhooksModule,
      HealthModule
    );

    return {
      module: AppModule,
      imports,
      providers: [
        Logger,
        // Global Guards - Skip in test environment to avoid dependency injection issues
        ...(process.env.NODE_ENV !== 'test'
          ? [
              {
                provide: APP_GUARD,
                useClass: JwtAuthGuard,
              },
            ]
          : []),
        // Global Exception Filter
        {
          provide: APP_FILTER,
          useClass: GlobalExceptionFilter,
        },
        // Global Interceptors
        {
          provide: APP_INTERCEPTOR,
          useClass: LoggingInterceptor,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: TransformInterceptor,
        },
      ],
    };
  }
}
