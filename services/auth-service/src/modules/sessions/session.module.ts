import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { RedisModule } from '../redis/redis.module';
import { SharedAuthModule } from '../shared-auth/shared-auth.module';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';

@Module({
  imports: [
    RedisModule,
    EventsModule,
    SharedAuthModule, // Use SharedAuthModule for guards and decorators
  ],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
