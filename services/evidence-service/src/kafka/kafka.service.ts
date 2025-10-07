import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { type Admin, type Consumer, type EachMessagePayload, Kafka, type Producer } from 'kafkajs';

export interface EvidenceEvent {
  eventType: string;
  evidenceId?: string;
  controlId?: string;
  organizationId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export enum EvidenceEventType {
  // Evidence lifecycle events
  EVIDENCE_CREATED = 'evidence.created',
  EVIDENCE_UPDATED = 'evidence.updated',
  EVIDENCE_DELETED = 'evidence.deleted',
  EVIDENCE_ARCHIVED = 'evidence.archived',
  EVIDENCE_RESTORED = 'evidence.restored',

  // Collection events
  EVIDENCE_COLLECTED = 'evidence.collected',
  COLLECTION_STARTED = 'evidence.collection.started',
  COLLECTION_COMPLETED = 'evidence.collection.completed',
  COLLECTION_FAILED = 'evidence.collection.failed',

  // Validation events
  VALIDATION_STARTED = 'evidence.validation.started',
  VALIDATION_COMPLETED = 'evidence.validation.completed',
  VALIDATION_FAILED = 'evidence.validation.failed',

  // Review events
  REVIEW_REQUESTED = 'evidence.review.requested',
  REVIEW_COMPLETED = 'evidence.review.completed',
  REVIEW_REJECTED = 'evidence.review.rejected',

  // Expiration events
  EVIDENCE_EXPIRING = 'evidence.expiring',
  EVIDENCE_EXPIRED = 'evidence.expired',
}

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private admin: Admin;
  private readonly groupId = 'evidence-service';
  private readonly topics = {
    EVIDENCE_EVENTS: 'evidence-events',
    CONTROL_EVENTS: 'control-events',
    NOTIFICATION_REQUESTS: 'notification-requests',
    AUDIT_EVENTS: 'audit-events',
  };

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2
  ) {
    const brokers = this.configService.get('KAFKA_BROKERS', 'localhost:9092').split(',');

    this.kafka = new Kafka({
      clientId: 'evidence-service',
      brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: this.groupId });
    this.admin = this.kafka.admin();
  }

  async onModuleInit() {
    // Skip Kafka initialization if disabled
    if (
      this.configService.get('DISABLE_KAFKA') === 'true' ||
      !this.configService.get('KAFKA_BROKERS')
    ) {
      this.logger.warn('Kafka is disabled - using EventEmitter2 fallback');
      return;
    }

    try {
      // Connect admin to create topics
      await this.admin.connect();

      // Create topics if they don't exist
      await this.createTopics();

      // Connect producer
      await this.producer.connect();
      this.logger.log('Kafka producer connected');

      // Connect consumer
      await this.consumer.connect();
      await this.subscribeToTopics();

      // Start consuming messages
      await this.consumer.run({
        eachMessage: async payload => this.handleMessage(payload),
      });

      this.logger.log('Kafka consumer connected and running');
    } catch (error) {
      this.logger.error('Failed to initialize Kafka', error);
    }
  }

  async onModuleDestroy() {
    // Skip if Kafka was disabled
    if (
      this.configService.get('DISABLE_KAFKA') === 'true' ||
      !this.configService.get('KAFKA_BROKERS')
    ) {
      return;
    }

    await this.producer.disconnect();
    await this.consumer.disconnect();
    await this.admin.disconnect();
  }

  private async createTopics() {
    const topics = [
      {
        topic: this.topics.EVIDENCE_EVENTS,
        numPartitions: 3,
        replicationFactor: 1,
      },
      {
        topic: this.topics.CONTROL_EVENTS,
        numPartitions: 3,
        replicationFactor: 1,
      },
      {
        topic: this.topics.NOTIFICATION_REQUESTS,
        numPartitions: 3,
        replicationFactor: 1,
      },
      {
        topic: this.topics.AUDIT_EVENTS,
        numPartitions: 3,
        replicationFactor: 1,
      },
    ];

    try {
      await this.admin.createTopics({
        topics,
        waitForLeaders: true,
      });
      this.logger.log('Kafka topics created/verified');
    } catch (error) {
      this.logger.warn('Topic creation failed (may already exist)', error.message);
    }
  }

  private async subscribeToTopics() {
    // Subscribe to control events to know when controls are updated
    await this.consumer.subscribe({ topic: this.topics.CONTROL_EVENTS, fromBeginning: false });
  }

  private async handleMessage(payload: EachMessagePayload) {
    const { topic, partition, message } = payload;
    const value = message.value?.toString();

    if (!value) return;

    try {
      const event = JSON.parse(value);
      this.logger.debug(`Received message from topic ${topic}:`, event);

      // Re-emit via EventEmitter2 for local handling
      if (topic === this.topics.CONTROL_EVENTS) {
        await this.eventEmitter.emit(event.eventType, event);
      }
    } catch (error) {
      this.logger.error('Failed to process message', error);
    }
  }

  /**
   * Emit an event - publishes to Kafka if enabled, otherwise uses EventEmitter2
   */
  async emit(eventType: string, payload: any): Promise<void> {
    // If Kafka is disabled, fall back to EventEmitter2
    if (
      this.configService.get('DISABLE_KAFKA') === 'true' ||
      !this.configService.get('KAFKA_BROKERS')
    ) {
      await this.eventEmitter.emit(eventType, payload);
      return;
    }

    // Determine topic based on event type
    let topic = this.topics.EVIDENCE_EVENTS;
    if (eventType.includes('notification')) {
      topic = this.topics.NOTIFICATION_REQUESTS;
    } else if (eventType.includes('audit')) {
      topic = this.topics.AUDIT_EVENTS;
    }

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: payload.evidenceId || payload.id || 'system',
            value: JSON.stringify({
              eventType,
              ...payload,
              service: 'evidence-service',
              timestamp: payload.timestamp || new Date(),
            }),
          },
        ],
      });

      this.logger.debug(`Published event: ${eventType}`);

      // Also emit locally for any local listeners
      await this.eventEmitter.emit(eventType, payload);
    } catch (error) {
      this.logger.error(`Failed to publish event: ${eventType}`, error);
      // Fall back to local emission
      await this.eventEmitter.emit(eventType, payload);
    }
  }

  /**
   * Publish an evidence event
   */
  async publishEvidenceEvent(event: EvidenceEvent): Promise<void> {
    await this.emit(event.eventType, event);
  }

  /**
   * Request notification to be sent
   */
  async requestNotification(notification: {
    userId: string;
    organizationId: string;
    type: string;
    channel: string;
    template?: string;
    data: Record<string, any>;
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void> {
    await this.emit('notification.requested', {
      ...notification,
      requestedBy: 'evidence-service',
      requestedAt: new Date(),
    });
  }

  /**
   * Publish audit event
   */
  async publishAuditEvent(event: {
    action: string;
    userId?: string;
    organizationId?: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, any>;
    status: 'success' | 'failed';
    errorMessage?: string;
  }): Promise<void> {
    await this.emit('audit.logged', {
      ...event,
      service: 'evidence-service',
      timestamp: new Date(),
    });
  }

  /**
   * Batch publish events
   */
  async publishBatch(
    events: Array<{
      eventType: string;
      payload: any;
    }>
  ): Promise<void> {
    // If Kafka is disabled, emit all events locally
    if (
      this.configService.get('DISABLE_KAFKA') === 'true' ||
      !this.configService.get('KAFKA_BROKERS')
    ) {
      for (const event of events) {
        await this.eventEmitter.emit(event.eventType, event.payload);
      }
      return;
    }

    const messagesByTopic = events.reduce(
      (acc, event) => {
        let topic = this.topics.EVIDENCE_EVENTS;
        if (event.eventType.includes('notification')) {
          topic = this.topics.NOTIFICATION_REQUESTS;
        } else if (event.eventType.includes('audit')) {
          topic = this.topics.AUDIT_EVENTS;
        }

        if (!acc[topic]) {
          acc[topic] = [];
        }

        acc[topic].push({
          key: event.payload.evidenceId || event.payload.id || 'system',
          value: JSON.stringify({
            eventType: event.eventType,
            ...event.payload,
            service: 'evidence-service',
            timestamp: event.payload.timestamp || new Date(),
          }),
        });

        return acc;
      },
      {} as Record<string, any[]>
    );

    const topicMessages = Object.entries(messagesByTopic).map(([topic, messages]) => ({
      topic,
      messages,
    }));

    try {
      await this.producer.sendBatch({ topicMessages });
      this.logger.debug(`Published batch of ${events.length} events`);

      // Also emit locally
      for (const event of events) {
        await this.eventEmitter.emit(event.eventType, event.payload);
      }
    } catch (error) {
      this.logger.error('Failed to publish batch events', error);
      // Fall back to local emission
      for (const event of events) {
        await this.eventEmitter.emit(event.eventType, event.payload);
      }
    }
  }
}
