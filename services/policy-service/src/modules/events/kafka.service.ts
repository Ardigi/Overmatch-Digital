import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Admin, type Consumer, type EachMessagePayload, Kafka, type Producer } from 'kafkajs';

export interface PolicyEvent {
  eventType: string;
  policyId?: string;
  organizationId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export enum PolicyEventType {
  // Policy events
  POLICY_CREATED = 'policy.policy.created',
  POLICY_UPDATED = 'policy.policy.updated',
  POLICY_DELETED = 'policy.policy.deleted',
  POLICY_PUBLISHED = 'policy.policy.published',
  POLICY_ARCHIVED = 'policy.policy.archived',
  POLICY_APPROVED = 'policy.policy.approved',
  POLICY_REJECTED = 'policy.policy.rejected',
  
  // Control events
  CONTROL_CREATED = 'policy.control.created',
  CONTROL_UPDATED = 'policy.control.updated',
  CONTROL_DELETED = 'policy.control.deleted',
  CONTROL_TESTED = 'policy.control.tested',
  CONTROL_ASSESSMENT_COMPLETED = 'policy.control.assessment.completed',
  
  // Framework events
  FRAMEWORK_CREATED = 'policy.framework.created',
  FRAMEWORK_UPDATED = 'policy.framework.updated',
  FRAMEWORK_DELETED = 'policy.framework.deleted',
  FRAMEWORK_MAPPED = 'policy.framework.mapped',
  
  // Compliance events
  COMPLIANCE_STATUS_CHANGED = 'policy.compliance.status.changed',
  COMPLIANCE_ASSESSMENT_STARTED = 'policy.compliance.assessment.started',
  COMPLIANCE_ASSESSMENT_COMPLETED = 'policy.compliance.assessment.completed',
}

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private admin: Admin;
  private readonly groupId = 'policy-service';
  private readonly topics = {
    POLICY_EVENTS: 'policy-events',
    AUTH_EVENTS: 'auth-events',
    CLIENT_EVENTS: 'client-events',
    AUDIT_EVENTS: 'audit-events',
    NOTIFICATION_REQUESTS: 'notification-requests',
  };

  constructor(private configService: ConfigService) {
    // Skip Kafka initialization if disabled
    if (this.configService.get('DISABLE_KAFKA') === 'true') {
      this.logger.warn('Kafka is disabled - skipping client creation');
      return;
    }

    const brokers = this.configService.get('KAFKA_BROKERS', 'localhost:9092').split(',');

    this.kafka = new Kafka({
      clientId: 'policy-service',
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
      this.logger.warn('Kafka is disabled - skipping initialization');
      return;
    }

    try {
      // Connect producer and consumer
      await this.producer.connect();
      await this.consumer.connect();
      await this.admin.connect();

      // Create topics if they don't exist
      await this.createTopics();

      // Subscribe to relevant topics
      await this.subscribeToTopics();

      this.logger.log('Kafka service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Kafka service', error);
      // Don't throw - allow service to start without Kafka
    }
  }

  async onModuleDestroy() {
    try {
      await this.producer?.disconnect();
      await this.consumer?.disconnect();
      await this.admin?.disconnect();
    } catch (error) {
      this.logger.error('Error disconnecting from Kafka', error);
    }
  }

  private async createTopics() {
    const topics = [
      {
        topic: this.topics.POLICY_EVENTS,
        numPartitions: 3,
        replicationFactor: 1,
      },
      {
        topic: this.topics.AUDIT_EVENTS,
        numPartitions: 3,
        replicationFactor: 1,
      },
      {
        topic: this.topics.NOTIFICATION_REQUESTS,
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
    // Subscribe to auth events for organization/user updates
    await this.consumer.subscribe({ topic: this.topics.AUTH_EVENTS, fromBeginning: false });
    
    // Subscribe to client events for organization changes
    await this.consumer.subscribe({ topic: this.topics.CLIENT_EVENTS, fromBeginning: false });

    // Start consuming messages
    await this.consumer.run({
      eachMessage: async (payload) => this.handleMessage(payload),
    });
  }

  private async handleMessage(payload: EachMessagePayload) {
    const { topic, partition, message } = payload;
    const value = message.value?.toString();

    if (!value) return;

    try {
      const event = JSON.parse(value);
      this.logger.debug(`Received message from topic ${topic}:`, event);

      // Handle different event types based on topic
      switch (topic) {
        case this.topics.AUTH_EVENTS:
          // Handle auth events (user updates, role changes, etc.)
          break;
        case this.topics.CLIENT_EVENTS:
          // Handle client events (organization updates, etc.)
          break;
        default:
          this.logger.warn(`Unhandled topic: ${topic}`);
      }
    } catch (error) {
      this.logger.error('Failed to process message', error);
    }
  }

  /**
   * Publish a policy event
   */
  async publishPolicyEvent(event: PolicyEvent): Promise<void> {
    // Skip if Kafka is disabled
    if (
      this.configService.get('DISABLE_KAFKA') === 'true' ||
      !this.configService.get('KAFKA_BROKERS')
    ) {
      this.logger.debug(`Kafka disabled - skipping policy event: ${event.eventType}`);
      return;
    }

    try {
      await this.producer.send({
        topic: this.topics.POLICY_EVENTS,
        messages: [
          {
            key: event.policyId || 'system',
            value: JSON.stringify({
              ...event,
              service: 'policy-service',
              timestamp: event.timestamp || new Date(),
            }),
          },
        ],
      });

      this.logger.debug(`Published policy event: ${event.eventType}`);
    } catch (error) {
      this.logger.error(`Failed to publish policy event: ${event.eventType}`, error);
      // Don't throw - allow operation to continue
    }
  }

  /**
   * Publish an audit event
   */
  async publishAuditEvent(event: {
    action: string;
    entityType: string;
    entityId: string;
    userId: string;
    organizationId: string;
    changes?: Record<string, any>;
    metadata?: Record<string, any>;
  }): Promise<void> {
    if (!this.producer) {
      this.logger.debug('Kafka disabled - skipping audit event');
      return;
    }

    try {
      await this.producer.send({
        topic: this.topics.AUDIT_EVENTS,
        messages: [
          {
            key: event.entityId,
            value: JSON.stringify({
              ...event,
              service: 'policy-service',
              timestamp: new Date(),
            }),
          },
        ],
      });

      this.logger.debug(`Published audit event: ${event.action}`);
    } catch (error) {
      this.logger.error(`Failed to publish audit event: ${event.action}`, error);
    }
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
    if (!this.producer) {
      this.logger.debug('Kafka disabled - skipping notification request');
      return;
    }

    try {
      await this.producer.send({
        topic: this.topics.NOTIFICATION_REQUESTS,
        messages: [
          {
            key: notification.userId,
            value: JSON.stringify({
              ...notification,
              service: 'policy-service',
              timestamp: new Date(),
            }),
          },
        ],
      });

      this.logger.debug(`Requested notification: ${notification.type}`);
    } catch (error) {
      this.logger.error(`Failed to request notification: ${notification.type}`, error);
    }
  }
}