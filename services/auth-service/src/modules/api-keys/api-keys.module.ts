import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyStrategy } from '../auth/strategies/api-key.strategy';
import { EventsModule } from '../events/events.module';
import { SharedAuthModule } from '../shared-auth/shared-auth.module';
import { UsersModule } from '../users/users.module';
import { ApiKeyRateLimiterService } from './api-key-rate-limiter.service';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeyUsage } from './entities/api-key-usage.entity';
import { ApiKeyRateLimitGuard } from './guards/api-key-rate-limit.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, ApiKeyUsage]),
    EventsModule,
    SharedAuthModule, // Use SharedAuthModule for guards and decorators
    UsersModule, // Import UsersModule for ApiKeyStrategy
  ],
  controllers: [ApiKeysController],
  providers: [
    ApiKeysService,
    ApiKeyRateLimiterService,
    ApiKeyRateLimitGuard,
    ApiKeyStrategy, // Provide ApiKeyStrategy here
  ],
  exports: [
    ApiKeysService,
    ApiKeyRateLimiterService,
    ApiKeyStrategy, // Export for other modules to use
  ],
})
export class ApiKeysModule {}
