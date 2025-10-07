import { HttpModule } from '@nestjs/axios';
import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthCommonModule } from '@soc-compliance/auth-common';
import { AnalyticsModule } from '../../src/modules/analytics/analytics.module';
import { EvidenceModule } from '../../src/modules/evidence/evidence.module';
import { HealthModule } from '../../src/modules/health/health.module';
import { RedisModule } from '../../src/modules/redis/redis.module';
import { RequestsModule } from '../../src/modules/requests/requests.module';
import { StorageModule } from '../../src/modules/storage/storage.module';
import { TemplatesModule } from '../../src/modules/templates/templates.module';
import { ValidationModule } from '../../src/modules/validation/validation.module';
// Note: Excluding CollectorsModule and KafkaModule for E2E testing

@Module({})
export class TestAppModule {
  static async forRoot(): Promise<DynamicModule> {
    const imports = [];

    imports.push(
      // Configuration
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: './test/e2e/test.env',
      }),

      // Event Emitter
      EventEmitterModule.forRoot(),

      // Database
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          type: 'postgres',
          host: configService.get('DB_HOST', '127.0.0.1'),
          port: configService.get('DB_PORT', 5433),
          username: configService.get('DB_USERNAME', 'test_user'),
          password: configService.get('DB_PASSWORD', 'test_pass'),
          database: configService.get('DB_NAME', 'soc_evidence_test'),
          entities: [__dirname + '/../../src/**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/../../src/migrations/*.ts'],
          migrationsRun: true, // Auto-run migrations for E2E tests
          logging: false, // Disable logging for cleaner test output
          synchronize: false, // Use migrations instead
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

      // Redis Cache
      RedisModule,

      // Feature Modules (excluding problematic ones)
      EvidenceModule,
      RequestsModule,
      TemplatesModule,
      ValidationModule,
      StorageModule,
      AnalyticsModule,
      HealthModule
    );

    return {
      module: TestAppModule,
      imports,
      providers: [],
    };
  }
}
