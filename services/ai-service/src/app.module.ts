import { CacheModule } from '@nestjs/cache-manager';
import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpCommonModule } from '@soc-compliance/http-common';
import { MonitoringModule } from '@soc-compliance/monitoring';
import { HealthModule } from './health/health.module';
import { monitoringConfig, testMonitoringConfig } from './monitoring.config';
import { AIModule } from './modules/ai/ai.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { MappingsModule } from './modules/mappings/mappings.module';
import { PredictionsModule } from './modules/predictions/predictions.module';
import { RedisModule } from './modules/redis/redis.module';
import { RemediationModule } from './modules/remediation/remediation.module';

@Module({})
export class AppModule {
  static async forRoot(): Promise<DynamicModule> {
    const imports = [];

    // Environment file paths
    const envFilePath = process.env.NODE_ENV === 'test' ? ['test/e2e/test.env', '.env'] : '.env';

    // Add ConfigModule with proper async handling
    imports.push(
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath,
      }),
      HttpCommonModule.forRoot({
        global: true,
        enableLogging: true,
        enableCorrelationId: true,
      }),
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          type: 'postgres',
          host: configService.get('DB_HOST', '127.0.0.1'),
          port: parseInt(configService.get('DB_PORT', '5432'), 10),
          username: configService.get('DB_USERNAME', 'soc_user'),
          password: configService.get('DB_PASSWORD', 'soc_pass'),
          database: configService.get('DB_NAME', 'soc_ai'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: configService.get('NODE_ENV') === 'development',
          logging: configService.get('NODE_ENV') === 'development',
        }),
        inject: [ConfigService],
      }),
      CacheModule.register({
        isGlobal: true,
        ttl: 3600, // 1 hour default
      }),
      EventEmitterModule.forRoot({
        wildcard: false,
        delimiter: '.',
        newListener: false,
        removeListener: false,
        maxListeners: 10,
        verboseMemoryLeak: false,
        ignoreErrors: false,
      }),
      // Monitoring
      MonitoringModule.forRoot(
        process.env.NODE_ENV === 'test' ? testMonitoringConfig : monitoringConfig
      ),
      RedisModule,
      AnalysisModule,
      MappingsModule,
      PredictionsModule,
      RemediationModule,
      AIModule,
      HealthModule
    );

    return {
      module: AppModule,
      imports,
      controllers: [],
      providers: [],
    };
  }
}
