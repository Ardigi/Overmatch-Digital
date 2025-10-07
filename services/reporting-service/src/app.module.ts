import { BullModule } from '@nestjs/bull';
import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpCommonModule } from '@soc-compliance/http-common';
import { MonitoringModule } from '@soc-compliance/monitoring';
import { HealthModule } from './modules/health/health.module';
import { monitoringConfig, testMonitoringConfig } from './monitoring.config';
import { RedisModule } from './modules/redis/redis.module';
import { Report, ReportSchedule, ReportTemplate } from './modules/reports/entities';
import { ReportsModule } from './modules/reports/reports.module';

@Module({})
export class AppModule {
  static async forRoot(): Promise<DynamicModule> {
    const imports = [];

    imports.push(
      // Configuration
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env',
      }),

      // Database
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          type: 'postgres',
          host: configService.get('DB_HOST', '127.0.0.1'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get('DB_USERNAME', 'soc_user'),
          password: configService.get('DB_PASSWORD', 'soc_pass'),
          database: configService.get('DB_NAME', 'soc_reports'),
          entities: [Report, ReportTemplate, ReportSchedule],
          synchronize: configService.get('NODE_ENV') !== 'production',
          logging: configService.get('NODE_ENV') === 'development',
        }),
        inject: [ConfigService],
      }),

      // Event Emitter
      EventEmitterModule.forRoot({
        wildcard: true,
        delimiter: '.',
        newListener: false,
        removeListener: false,
        maxListeners: 10,
        verboseMemoryLeak: false,
        ignoreErrors: false,
      }),

      // Scheduler
      ScheduleModule.forRoot(),

      // Bull Queue
      BullModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          redis: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
            password: configService.get('REDIS_PASSWORD'),
          },
        }),
        inject: [ConfigService],
      }),

      // HTTP with service discovery
      HttpCommonModule.forRoot({
        global: true,
        defaultTimeout: 30000,
        defaultRetries: 3,
        enableLogging: true,
        enableCorrelationId: true,
      }),

      // Monitoring
      MonitoringModule.forRoot(
        process.env.NODE_ENV === 'test' ? testMonitoringConfig : monitoringConfig
      ),

      // Redis Cache
      RedisModule,

      // Feature Modules
      HealthModule,
      ReportsModule
    );

    return {
      module: AppModule,
      imports,
      providers: [],
    };
  }
}
