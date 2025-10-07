import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthCommonModule } from '@soc-compliance/auth-common';
import { HttpCommonModule } from '@soc-compliance/http-common';
import { MonitoringModule } from '@soc-compliance/monitoring';
import configuration from './config/configuration';
import { ControlTestsModule } from './modules/control-tests/control-tests.module';
import { ControlsModule } from './modules/controls/controls.module';
import { FrameworksModule } from './modules/frameworks/frameworks.module';
import { HealthModule } from './modules/health/health.module';
import { ImplementationModule } from './modules/implementation/implementation.module';
import { MappingModule } from './modules/mapping/mapping.module';
import { RedisModule } from './modules/redis/redis.module';
import { TestAuthModule } from './modules/test-auth/test-auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { EncryptionModule } from './modules/encryption/encryption.module';
import { AccessControlModule } from './modules/access-control/access-control.module';
import { RiskModule } from './modules/risk/risk.module';
import { FinancialModule } from './modules/financial/financial.module';
import { monitoringConfig, testMonitoringConfig } from './monitoring.config';

@Module({})
export class AppModule {
  static async forRoot(): Promise<DynamicModule> {
    const imports = [];

    // ConfigModule.forRoot is synchronous, no need to await
    imports.push(
      ConfigModule.forRoot({
        isGlobal: true,
        load: [configuration],
      }),
      EventEmitterModule.forRoot(),
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService) => ({
          type: 'postgres',
          host: configService.get('database.host'),
          port: configService.get('database.port'),
          username: configService.get('database.username'),
          password: configService.get('database.password'),
          database: configService.get('database.name'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: false, // Temporarily disabled to avoid schema sync issues
          logging: true,
        }),
        inject: [ConfigService],
      }),
      BullModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService) => ({
          redis: {
            host: configService.get('redis.host'),
            port: configService.get('redis.port'),
            password: configService.get('redis.password'),
          },
        }),
        inject: [ConfigService],
      }),
      ScheduleModule.forRoot(),
      HttpModule.register({
        timeout: 5000,
        maxRedirects: 5,
      }),
      AuthCommonModule,
      HttpCommonModule.forRoot(),
      MonitoringModule.forRoot(
        process.env.NODE_ENV === 'test' ? testMonitoringConfig : monitoringConfig
      ),
      RedisModule,
      ControlsModule,
      ControlTestsModule,
      ImplementationModule,
      MappingModule,
      FrameworksModule,
      HealthModule,
      TestAuthModule,
      TenantModule,
      EncryptionModule,
      AccessControlModule,
      RiskModule,
      FinancialModule
    );

    return {
      module: AppModule,
      imports,
      providers: [],
    };
  }
}
