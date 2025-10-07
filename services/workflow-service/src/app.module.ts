import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpCommonModule } from '@soc-compliance/http-common';
import { MonitoringModule } from '@soc-compliance/monitoring';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { LoggerModule } from 'nestjs-pino';
import { bullConfig } from './config/bull.config';
// Configuration
import configuration from './config/configuration';
import { typeOrmConfig } from './config/typeorm.config';
import { HealthModule } from './modules/health/health.module';
import { monitoringConfig, testMonitoringConfig } from './monitoring.config';
import { RedisModule } from './modules/redis/redis.module';
// Modules
import { WorkflowsModule } from './modules/workflows/workflows.module';

@Module({})
export class AppModule {
  static async forRoot(): Promise<DynamicModule> {
    const imports = [];

    imports.push(
      // Configuration
      ConfigModule.forRoot({
        isGlobal: true,
        load: [configuration],
        envFilePath: '.env',
      }),

      // Logging
      LoggerModule.forRoot({
        pinoHttp: {
          level: process.env.LOG_LEVEL || 'info',
          transport:
            process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                  },
                }
              : undefined,
          redact: ['req.headers.authorization'],
          autoLogging: false,
          quietReqLogger: true,
        },
      }),

      // Database
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: typeOrmConfig,
        inject: [ConfigService],
      }),

      // Message Queue
      BullModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: bullConfig,
        inject: [ConfigService],
      }),

      // Event System
      EventEmitterModule.forRoot({
        wildcard: true,
        delimiter: '.',
        maxListeners: 20,
        verboseMemoryLeak: true,
      }),

      // Scheduling
      ScheduleModule.forRoot(),

      // HTTP
      HttpModule.register({
        timeout: 5000,
        maxRedirects: 5,
      }),

      // HTTP Common Module for Inter-Service Communication
      HttpCommonModule.forRoot(),
      MonitoringModule.forRoot(
        process.env.NODE_ENV === 'test' ? testMonitoringConfig : monitoringConfig
      ),

      // Metrics
      PrometheusModule.register({
        defaultMetrics: {
          enabled: true,
        },
        path: '/metrics',
      }),

      // Redis Cache
      RedisModule,

      // Feature Modules
      HealthModule,
      WorkflowsModule
    );

    return {
      module: AppModule,
      imports,
      providers: [],
    };
  }
}
