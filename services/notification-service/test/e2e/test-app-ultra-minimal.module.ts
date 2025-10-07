import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '../../src/config/configuration';
import { TestNotificationsService } from './test-notifications-minimal.service';
// Import only the test controller and service - no other dependencies
import { TestNotificationsController } from './test-notifications-simple.controller';

@Module({
  imports: [
    // Configuration only
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: './test/e2e/test.env',
    }),
  ],
  controllers: [TestNotificationsController],
  providers: [TestNotificationsService],
})
export class TestAppUltraMinimalModule {}
