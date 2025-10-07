import { Injectable, Module } from '@nestjs/common';

// Mock Kafka Consumer Service for E2E tests
@Injectable()
export class MockKafkaConsumerService {
  async onModuleInit() {
    // No-op for tests
  }

  async onModuleDestroy() {
    // No-op for tests
  }

  async consumeEvents() {
    // No-op for tests
  }
}

@Module({
  providers: [
    {
      provide: 'KafkaConsumerService',
      useClass: MockKafkaConsumerService,
    },
  ],
  exports: ['KafkaConsumerService'],
})
export class TestEventsModule {}
