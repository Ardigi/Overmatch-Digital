import { Global, Module } from '@nestjs/common';
import { KafkaProducerService } from '../../../src/modules/events/kafka-producer.service';
import { MockKafkaProducerService } from './kafka-producer.mock';

@Global()
@Module({
  providers: [
    {
      provide: KafkaProducerService,
      useClass: MockKafkaProducerService,
    },
  ],
  exports: [KafkaProducerService],
})
export class MockEventsModule {}
