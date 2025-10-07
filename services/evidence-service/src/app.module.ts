import { HttpModule } from '@nestjs/axios';
import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthCommonModule } from '@soc-compliance/auth-common';
import { HttpCommonModule } from '@soc-compliance/http-common';
import { MonitoringModule } from '@soc-compliance/monitoring';
import { KafkaModule } from './kafka/kafka.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CollectorsModule } from './modules/collectors/collectors.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { HealthModule } from './modules/health/health.module';
import { RedisModule } from './modules/redis/redis.module';
import { RequestsModule } from './modules/requests/requests.module';
import { StorageModule } from './modules/storage/storage.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { ValidationModule } from './modules/validation/validation.module';
import { monitoringConfig, testMonitoringConfig } from './monitoring.config';

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

      // Event Emitter
      EventEmitterModule.forRoot(),

      // Database
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          type: 'postgres',
          host: configService.get('DB_HOST', '127.0.0.1'),
          port: configService.get('DB_PORT', 5432),
          username: configService.get('DB_USERNAME', 'soc_user'),
          password: configService.get('DB_PASSWORD', 'soc_pass'),
          database: configService.get('DB_NAME', 'soc_evidence'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: process.env.NODE_ENV === 'development', // Enable sync in development only
          logging: true,
        }),
        inject: [ConfigService],
      }),

      // HTTP
      HttpModule.register({
        timeout: 5000,
        maxRedirects: 5,
      }),

      // Authentication
      AuthCommonModule,

      // Service Discovery
      HttpCommonModule.forRoot(),
      MonitoringModule.forRoot(
        process.env.NODE_ENV === 'test' ? testMonitoringConfig : monitoringConfig
      ),

      // Redis Cache
      RedisModule,

      // Kafka
      KafkaModule,

      // Feature Modules
      EvidenceModule,
      RequestsModule,
      TemplatesModule,
      ValidationModule,
      StorageModule,
      AnalyticsModule,
      CollectorsModule,
      HealthModule
    );

    return {
      module: AppModule,
      imports,
      providers: [],
    };
  }
}
