import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Admin, type Consumer, type EachMessagePayload, Kafka, type Producer } from 'kafkajs';

export interface AuthEvent {
  eventType: string;
  userId?: string;
  organizationId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export enum AuthEventType {
  // User events
  USER_CREATED = 'auth.user.created',
  USER_UPDATED = 'auth.user.updated',
  USER_DELETED = 'auth.user.deleted',
  USER_INVITED = 'auth.user.invited',
  USER_SUSPENDED = 'auth.user.suspended',
  USER_ACTIVATED = 'auth.user.activated',

  // Authentication events
  USER_LOGIN = 'auth.user.login',
  USER_LOGOUT = 'auth.user.logout',
  USER_LOGIN_FAILED = 'auth.user.login.failed',
  USER_LOCKED = 'auth.user.locked',
  USER_UNLOCKED = 'auth.user.unlocked',

  // Password events
  PASSWORD_CHANGED = 'auth.password.changed',
  PASSWORD_RESET_REQUESTED = 'auth.password.reset.requested',
  PASSWORD_RESET_COMPLETED = 'auth.password.reset.completed',

  // MFA events
  MFA_ENABLED = 'auth.mfa.enabled',
  MFA_DISABLED = 'auth.mfa.disabled',
  MFA_VERIFIED = 'auth.mfa.verified',
  MFA_FAILED = 'auth.mfa.failed',

  // Token events
  TOKEN_REFRESHED = 'auth.token.refreshed',
  TOKEN_REVOKED = 'auth.token.revoked',
  ALL_TOKENS_REVOKED = 'auth.tokens.revoked.all',

  // Email verification
  EMAIL_VERIFICATION_REQUESTED = 'auth.email.verification.requested',
  EMAIL_VERIFIED = 'auth.email.verified',

  // Role events
  ROLE_ASSIGNED = 'auth.role.assigned',
  ROLE_REMOVED = 'auth.role.removed',
  PERMISSIONS_UPDATED = 'auth.permissions.updated',
}

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private admin: Admin;
  private readonly groupId = 'auth-service';
  private readonly topics = {
    AUTH_EVENTS: 'auth-events',
    NOTIFICATION_REQUESTS: 'notification-requests',
    AUDIT_EVENTS: 'audit-events',
  };

  constructor(private configService: ConfigService) {
    // Skip Kafka initialization if disabled
    if (this.configService.get('DISABLE_KAFKA') === 'true') {
      this.logger.warn('Kafka is disabled - skipping client creation');
      return;
    }

    const brokers = this.configService.get('KAFKA_BROKERS', 'localhost:9092').split(',');

    this.kafka = new Kafka({
      clientId: 'auth-service',
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
        eachMessage: async (payload) => this.handleMessage(payload),
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
        topic: this.topics.AUTH_EVENTS,
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
    // Auth service doesn't need to consume its own events
    // But might consume events from other services in the future
    // For now, we'll just set up the structure
  }

  private async handleMessage(payload: EachMessagePayload) {
    const { topic, partition, message } = payload;
    const value = message.value?.toString();

    if (!value) return;

    try {
      const event = JSON.parse(value);
      this.logger.debug(`Received message from topic ${topic}:`, event);

      // Handle different event types here
      // For now, just log them
    } catch (error) {
      this.logger.error('Failed to process message', error);
    }
  }

  /**
   * Publish an auth event
   */
  async publishAuthEvent(event: AuthEvent): Promise<void> {
    // Skip if Kafka is disabled
    if (
      this.configService.get('DISABLE_KAFKA') === 'true' ||
      !this.configService.get('KAFKA_BROKERS')
    ) {
      this.logger.debug(`Kafka disabled - skipping auth event: ${event.eventType}`);
      return;
    }

    try {
      await this.producer.send({
        topic: this.topics.AUTH_EVENTS,
        messages: [
          {
            key: event.userId || 'system',
            value: JSON.stringify({
              ...event,
              service: 'auth-service',
              timestamp: event.timestamp || new Date(),
            }),
          },
        ],
      });

      this.logger.debug(`Published auth event: ${event.eventType}`);
    } catch (error) {
      this.logger.error(`Failed to publish auth event: ${event.eventType}`, error);
      throw error;
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
              requestedBy: 'auth-service',
              requestedAt: new Date(),
            }),
          },
        ],
      });

      this.logger.debug(`Requested notification: ${notification.type}`);
    } catch (error) {
      this.logger.error(`Failed to request notification: ${notification.type}`, error);
      throw error;
    }
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
    if (!this.producer) {
      this.logger.debug('Kafka disabled - skipping audit event');
      return;
    }

    try {
      await this.producer.send({
        topic: this.topics.AUDIT_EVENTS,
        messages: [
          {
            key: event.userId || 'system',
            value: JSON.stringify({
              ...event,
              service: 'auth-service',
              timestamp: new Date(),
            }),
          },
        ],
      });

      this.logger.debug(`Published audit event: ${event.action}`);
    } catch (error) {
      this.logger.error(`Failed to publish audit event: ${event.action}`, error);
      // Don't throw - audit events should not break the flow
    }
  }

  /**
   * Batch publish events
   */
  async publishBatch(
    events: Array<{
      topic: string;
      key: string;
      value: any;
    }>
  ): Promise<void> {
    const messagesByTopic = events.reduce(
      (acc, event) => {
        if (!acc[event.topic]) {
          acc[event.topic] = [];
        }
        acc[event.topic].push({
          key: event.key,
          value: JSON.stringify(event.value),
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
    } catch (error) {
      this.logger.error('Failed to publish batch events', error);
      throw error;
    }
  }
}
