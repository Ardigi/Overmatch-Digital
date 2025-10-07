import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '../../src/common/interceptors/logging.interceptor';
import configuration from '../../src/config/configuration';
import { HealthModule } from '../../src/modules/health/health.module';

// Import entities directly
import { Notification } from '../../src/modules/notifications/entities/notification.entity';
import { NotificationPreference } from '../../src/modules/notifications/entities/notification-preference.entity';
import { NotificationTemplate } from '../../src/modules/notifications/entities/notification-template.entity';

// Import controllers and services (simplified versions for testing)
import { NotificationsController } from './test-notifications.controller';
import { TestNotificationsService } from './test-notifications.service';

@Module({})
export class TestAppModule {
  static async forRoot(): Promise<DynamicModule> {
    const imports: any[] = [];

    // Add ConfigModule
    const configModule = await ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: './test/e2e/test.env',
    });
    imports.push(configModule);

    // Add TypeORM with minimal configuration
    imports.push(
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          type: 'postgres',
          host: configService.get('database.host') || '127.0.0.1',
          port: configService.get('database.port') || 5433,
          username: configService.get('database.username') || 'soc_user',
          password: configService.get('database.password') || 'soc_pass',
          database:
            configService.get('database.database') ||
            configService.get('database.name') ||
            'soc_notifications_test',
          entities: [Notification, NotificationTemplate, NotificationPreference],
          synchronize: true,
          logging: false,
          ssl: false,
          autoLoadEntities: true,
        }),
        inject: [ConfigService],
      }),

      // Register entities for repository injection
      TypeOrmModule.forFeature([Notification, NotificationTemplate, NotificationPreference]),

      // Health module
      HealthModule
    );

    return {
      module: TestAppModule,
      imports,
      controllers: [NotificationsController],
      providers: [
        TestNotificationsService,
        {
          provide: APP_FILTER,
          useClass: AllExceptionsFilter,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: LoggingInterceptor,
        },
      ],
    };
  }
}
