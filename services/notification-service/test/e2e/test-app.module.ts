import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '../../src/common/interceptors/logging.interceptor';
import configuration from '../../src/config/configuration';
import { HealthModule } from '../../src/modules/health/health.module';
import { NotificationsModule } from '../../src/modules/notifications/notifications.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: './test/e2e/test.env',
    }),

    // TypeORM for E2E testing - Use test database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.database') || configService.get('database.name'),
        entities: [__dirname + '/../../src/**/*.entity{.ts,.js}'],
        synchronize: true, // For E2E testing
        logging: false,
        ssl: false,
      }),
      inject: [ConfigService],
    }),

    // Feature modules - simplified for testing
    HealthModule,
    NotificationsModule,
  ],
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
})
export class TestAppModule {}
