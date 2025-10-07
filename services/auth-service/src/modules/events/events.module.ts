import { Global, Module } from '@nestjs/common';
import { EventHandlerService } from './event-handler.service';
import { EventsService } from './events.service';
import { KafkaService } from './kafka.service';

@Global()
@Module({
  providers: [KafkaService, EventHandlerService, EventsService],
  exports: [KafkaService, EventHandlerService, EventsService],
})
export class EventsModule {}
