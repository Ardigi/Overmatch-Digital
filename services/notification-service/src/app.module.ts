import { BullModule } from '@nestjs/bull';
import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@soc-compliance/cache-common';
import { HttpCommonModule } from '@soc-compliance/http-common';
import { MonitoringModule } from '@soc-compliance/monitoring';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import configuration from './config/configuration';
import { monitoringConfig, testMonitoringConfig } from './monitoring.config';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RulesModule } from './modules/rules/rules.module';
import { EventsModule } from './modules/events/events.module';
import { UsersModule } from './modules/users/users.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { KafkaModule } from './modules/kafka/kafka.module';
import { CacheModule as AppCacheModule } from './modules/cache/cache.module';

@Module({})
export class AppModule {
  static async forRoot(): Promise<DynamicModule> {
    const imports: any[] = [];

    // Add ConfigModule - Handle async resolution
    const configModule = await ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    });
    imports.push(configModule);

    imports.push(
      // TypeORM - Only in non-test environments
      ...(process.env.NODE_ENV !== 'test'
        ? [
            TypeOrmModule.forRootAsync({
              imports: [ConfigModule],
              useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get('database.host'),
                port: configService.get('database.port'),
                username: configService.get('database.username'),
                password: configService.get('database.password'),
                database: configService.get('database.name'),
                entities: [__dirname + '/**/*.entity{.ts,.js}'],
                synchronize: configService.get('app.env') === 'development',
                logging: configService.get('app.env') === 'development',
                ssl: configService.get('database.ssl')
                  ? {
                      rejectUnauthorized: false,
                    }
                  : false,
              }),
              inject: [ConfigService],
            }),
          ]
        : []),

      // Bull Queue - Only in non-test environments
      ...(process.env.NODE_ENV !== 'test'
        ? [
            BullModule.forRootAsync({
              imports: [ConfigModule],
              useFactory: (configService: ConfigService) => ({
                redis: {
                  host: configService.get('redis.host'),
                  port: configService.get('redis.port'),
                  password: configService.get('redis.password'),
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
          ]
        : []),

      // HTTP Common Module for inter-service communication
      HttpCommonModule.forRoot({
        global: true,
        enableLogging: process.env.NODE_ENV === 'development',
        enableCorrelationId: true,
        defaultTimeout: 30000,
        defaultRetries: 3,
      }),

      // Cache Module - Only in non-test environments
      ...(process.env.NODE_ENV !== 'test'
        ? [
            CacheModule.forRoot({
              redis: {
                host: process.env.REDIS_HOST || '127.0.0.1',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD,
              },
              keyPrefix: 'notification-service',
              defaultTtl: 300, // 5 minutes
              enabled: true,
              gracefulDegradation: true,
            }),
          ]
        : []),

      // External Monitoring Package
      MonitoringModule.forRoot(
        process.env.NODE_ENV === 'test' ? testMonitoringConfig : monitoringConfig
      ),

      // Feature modules
      HealthModule,
      NotificationsModule,
      RulesModule,
      EventsModule,
      UsersModule,
      ProvidersModule,
      KafkaModule,
      AppCacheModule
    );

    return {
      module: AppModule,
      imports,
      controllers: [],
      providers: [
        {
          provide: APP_FILTER,
          useClass: AllExceptionsFilter,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: LoggingInterceptor,
        },
      ],
    };
  }
}
