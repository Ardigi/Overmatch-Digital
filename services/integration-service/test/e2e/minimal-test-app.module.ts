// MUST be before any imports
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import { Controller, type DynamicModule, Get, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

// Create a simple mock controller for basic testing
@Controller()
export class TestController {
  @Get('/health')
  getHealth() {
    return { status: 'ok' };
  }

  @Get('/providers')
  getProviders() {
    return { data: [] };
  }

  @Get('/integrations')
  getIntegrations() {
    return { data: [] };
  }
}

@Module({})
export class MinimalTestAppModule {
  static async forRoot(): Promise<DynamicModule> {
    const imports = [];

    imports.push(
      // Configuration for test environment
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: './test/e2e/test.env',
        ignoreEnvFile: false,
      }),

      // Database with minimal configuration (no entities for now)
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          type: 'postgres',
          host: configService.get('DB_HOST', '127.0.0.1'),
          port: configService.get('DB_PORT', 5433),
          username: configService.get('DB_USERNAME', 'test_user'),
          password: configService.get('DB_PASSWORD', 'test_pass'),
          database: configService.get('DB_NAME', 'soc_integrations_test'),
          // Empty entities array to avoid loading any entities for now
          entities: [],
          synchronize: false, // Don't try to sync any schema
          logging: false, // Disable logging
          extra: {
            max: 2, // Minimal connection pool
            connectionTimeoutMillis: 5000,
          },
        }),
        inject: [ConfigService],
      })
    );

    return {
      module: MinimalTestAppModule,
      imports,
      controllers: [TestController], // Simple controller for basic endpoint testing
      providers: [],
    };
  }
}
