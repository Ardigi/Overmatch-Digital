// MUST be before any imports
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
// Import all entities explicitly to avoid TypeORM auto-discovery issues
import {
  Integration,
  IntegrationCredential,
  IntegrationLog,
  SyncJob,
  SyncSchedule,
  WebhookEndpoint,
  WebhookEvent,
} from '../../src/entities';
import { HealthModule } from '../../src/modules/health/health.module';
// Core Feature Modules - simplified for E2E testing
import { IntegrationsModule } from '../../src/modules/integrations/integrations.module';
import { SyncModule } from '../../src/modules/sync/sync.module';
import { WebhooksModule } from '../../src/modules/webhooks/webhooks.module';

@Module({})
export class TestAppModule {
  static async forRoot(): Promise<DynamicModule> {
    const imports = [];

    imports.push(
      // Configuration for test environment
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: './test/e2e/test.env',
        ignoreEnvFile: false,
      }),

      // Event Emitter for internal events (simplified)
      EventEmitterModule.forRoot({
        wildcard: true,
        delimiter: '.',
        maxListeners: 5,
      }),

      // Database with explicit entity list to avoid auto-discovery issues
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          type: 'postgres',
          host: configService.get('DB_HOST', '127.0.0.1'),
          port: configService.get('DB_PORT', 5433),
          username: configService.get('DB_USERNAME', 'test_user'),
          password: configService.get('DB_PASSWORD', 'test_pass'),
          database: configService.get('DB_NAME', 'soc_integrations_test'),
          // Use explicit entity list instead of auto-discovery
          entities: [
            Integration,
            IntegrationCredential,
            IntegrationLog,
            SyncJob,
            SyncSchedule,
            WebhookEndpoint,
            WebhookEvent,
          ],
          synchronize: true, // Use synchronize for E2E tests
          logging: false, // Disable logging for cleaner test output
          dropSchema: false, // Don't drop schema automatically
          extra: {
            max: 5, // Reduced connection pool for tests
            connectionTimeoutMillis: 5000,
          },
        }),
        inject: [ConfigService],
      }),

      // Feature Modules (core functionality only)
      IntegrationsModule,
      SyncModule,
      WebhooksModule,
      HealthModule
    );

    return {
      module: TestAppModule,
      imports,
      providers: [],
    };
  }
}
