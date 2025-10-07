import { Inject, Injectable, Optional } from '@nestjs/common';
import type { ClientKafka } from '@nestjs/microservices';
import type { EventType } from '@soc-compliance/events';

@Injectable()
export class KafkaService {
  constructor(
    @Optional()
    @Inject('KAFKA_CLIENT')
    private kafkaClient: ClientKafka | null,
  ) {}

  async emit(pattern: EventType | string, data: any) {
    if (!this.kafkaClient) {
      console.log(`Kafka disabled - would emit event: ${pattern}`, data);
      return;
    }
    
    return this.kafkaClient.emit(pattern, {
      id: `${pattern}-${Date.now()}`,
      type: pattern,
      timestamp: new Date(),
      payload: data,
    });
  }
}