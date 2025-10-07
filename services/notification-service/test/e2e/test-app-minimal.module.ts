import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '../../src/common/interceptors/logging.interceptor';
import configuration from '../../src/config/configuration';
import { HealthModule } from '../../src/modules/health/health.module';
import { TestNotificationsService } from './test-notifications-minimal.service';
// Import test versions without TypeORM dependencies
import { TestNotificationsController } from './test-notifications-simple.controller';

@Module({
  imports: [
    // Configuration only
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: './test/e2e/test.env',
    }),

    // Health module only (no database dependencies)
    HealthModule,
  ],
  controllers: [TestNotificationsController],
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
})
export class TestAppMinimalModule {}
