// Ensure TypeORM is not mocked in E2E tests
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditsModule } from '../../src/modules/audits/audits.module';
import { BillingModule } from '../../src/modules/billing/billing.module';
import { ClientsModule } from '../../src/modules/clients/clients.module';
import { ContractsModule } from '../../src/modules/contracts/contracts.module';
import { OrganizationsModule } from '../../src/modules/organizations/organizations.module';
import { RedisModule } from '../../src/modules/redis/redis.module';
import { SharedClientModule } from '../../src/modules/shared-client/shared-client.module';
import { TestModule } from '../../src/modules/test/test.module';
import { AuthCommonModule } from '../../src/shared/auth-common/auth.module';
import { JwtAuthGuard } from '../../src/shared/guards/jwt-auth.guard';
import { KongAuthGuard } from '../../src/shared/guards/kong-auth.guard';
import { KongRolesGuard } from '../../src/shared/guards/kong-roles.guard';
import { RolesGuard } from '../../src/shared/guards/roles.guard';
import { MockEventsModule } from './mocks/events.module.mock';

@Module({})
export class TestAppModule {
  static async forRoot(): Promise<DynamicModule> {
    const imports: any[] = [];

    // Configuration - ConfigModule.forRoot() is now async
    const configModule = await ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.test', '.env'],
    });
    imports.push(configModule);

    // Event Emitter
    imports.push(EventEmitterModule.forRoot());

    // Scheduler
    imports.push(ScheduleModule.forRoot());

    // Database
    imports.push(
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          type: 'postgres',
          host: configService.get('DB_HOST', '127.0.0.1'),
          port: configService.get('DB_PORT', 5433),
          username: configService.get('DB_USERNAME', 'test_user'),
          password: configService.get('DB_PASSWORD', 'test_pass'),
          database: configService.get('DB_NAME', 'soc_clients_test'),
          entities: [__dirname + '/../../src/**/*.entity{.ts,.js}'],
          synchronize: false, // Disable synchronize to avoid enum issues
          logging: false,
        }),
        inject: [ConfigService],
      })
    );

    // Redis Cache
    imports.push(RedisModule);

    // Authentication
    imports.push(AuthCommonModule);

    // Shared Modules
    imports.push(SharedClientModule);

    // Mock Events Module (provides KafkaProducerService)
    imports.push(MockEventsModule);

    // Feature Modules
    imports.push(
      ClientsModule,
      OrganizationsModule,
      BillingModule,
      ContractsModule,
      AuditsModule,
      TestModule
    );

    // Mock Guards for E2E Testing
    const providers = [
      {
        provide: KongAuthGuard,
        useValue: {
          canActivate: () => true,
        },
      },
      {
        provide: KongRolesGuard,
        useValue: {
          canActivate: () => true,
        },
      },
      {
        provide: JwtAuthGuard,
        useValue: {
          canActivate: () => true,
        },
      },
      {
        provide: RolesGuard,
        useValue: {
          canActivate: () => true,
        },
      },
    ];

    return {
      module: TestAppModule,
      imports,
      providers,
    };
  }
}
