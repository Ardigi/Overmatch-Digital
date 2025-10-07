import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class KafkaService {
  private readonly logger = new Logger(KafkaService.name);

  constructor(
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    const topics = [
      'user.created',
      'user.updated',
      'policy.created',
      'policy.updated',
      'control.status.changed',
      'evidence.uploaded',
      'audit.completed',
      'workflow.step.completed',
      'report.generated',
    ];

    topics.forEach((topic) => {
      this.kafkaClient.subscribeToResponseOf(topic);
    });

    await this.kafkaClient.connect();
    this.logger.log('Kafka client connected');
  }

  async emit(pattern: string, data: any) {
    try {
      const result = await lastValueFrom(
        this.kafkaClient.emit(pattern, {
          key: data.id || data.organizationId,
          value: data,
          headers: {
            'x-service': 'notification-service',
            'x-timestamp': new Date().toISOString(),
          },
        }),
      );
      
      this.logger.debug(`Event emitted: ${pattern}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to emit event ${pattern}:`, error);
      throw error;
    }
  }
}