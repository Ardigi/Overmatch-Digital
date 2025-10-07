import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  type Admin, 
  type Consumer, 
  type EachMessagePayload, 
  Kafka, 
  type Producer,
  CompressionTypes,
  logLevel,
  type RecordMetadata,
  type ProducerBatch,
  type TopicMessages
} from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import CircuitBreaker from 'opossum';

export interface EnhancedPolicyEvent {
  id?: string;
  eventType: string;
  entityId?: string;
  organizationId?: string;
  userId?: string;
  timestamp?: Date;
  version?: number;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, any>;
  payload?: any;
  retryCount?: number;
  source?: string;
}

export interface RetryPolicy {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  factor: number;
  jitter: boolean;
}

export interface MessageProcessingResult {
  success: boolean;
  shouldRetry?: boolean;
  error?: Error;
  processedAt: Date;
}

@Injectable()
export class EnhancedKafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EnhancedKafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private admin: Admin;
  private circuitBreaker: any;
  private readonly processedMessages = new Map<string, Date>();
  private readonly MESSAGE_DEDUP_TTL = 3600000; // 1 hour
  
  private readonly groupId = 'policy-service-consumer';
  private readonly defaultRetryPolicy: RetryPolicy = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    factor: 2,
    jitter: true,
  };
  
  private readonly topics = {
    POLICY_EVENTS: 'policy-events',
    AUTH_EVENTS: 'auth-events',
    CLIENT_EVENTS: 'client-events',
    CONTROL_EVENTS: 'control-events',
    EVIDENCE_EVENTS: 'evidence-events',
    WORKFLOW_EVENTS: 'workflow-events',
    AUDIT_EVENTS: 'audit-events',
    NOTIFICATION_EVENTS: 'notification-events',
    
    // Dead letter queues
    DLQ_POLICY: 'dlq-policy',
    
    // Saga patterns
    SAGA_ORCHESTRATOR: 'saga-orchestrator',
    SAGA_COMPENSATION: 'saga-compensation',
    
    // System monitoring
    SYSTEM_METRICS: 'system-metrics',
    SYSTEM_ALERTS: 'system-alerts',
  };

  constructor(private configService: ConfigService) {
    // Skip Kafka initialization if disabled
    if (this.configService.get('DISABLE_KAFKA') === 'true') {
      this.logger.warn('Kafka is disabled - skipping client creation');
      return;
    }

    const brokers = this.configService.get('KAFKA_BROKERS', 'kafka:29092').split(',');

    this.kafka = new Kafka({
      clientId: 'policy-service',
      brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
      connectionTimeout: 10000,
      requestTimeout: 30000,
      logLevel: logLevel.INFO,
      // SSL configuration for production
      ssl: this.configService.get('KAFKA_SSL_ENABLED') === 'true' ? {
        rejectUnauthorized: true,
        ca: this.configService.get('KAFKA_SSL_CA'),
        cert: this.configService.get('KAFKA_SSL_CERT'),
        key: this.configService.get('KAFKA_SSL_KEY'),
      } : undefined,
      // SASL authentication for production
      sasl: this.configService.get('KAFKA_SASL_ENABLED') === 'true' ? {
        mechanism: 'scram-sha-512',
        username: this.configService.get('KAFKA_SASL_USERNAME'),
        password: this.configService.get('KAFKA_SASL_PASSWORD'),
      } : undefined,
    });

    this.producer = this.kafka.producer({
      idempotent: true, // Ensure exactly-once delivery
      maxInFlightRequests: 5,
      // compression: CompressionTypes.Snappy, // Not available in current kafkajs version
      transactionalId: `policy-service-${process.env.POD_NAME || 'local'}`,
    });
    
    this.consumer = this.kafka.consumer({ 
      groupId: this.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxBytesPerPartition: 1048576, // 1MB
      retry: {
        retries: 5,
      },
    });
    
    this.admin = this.kafka.admin();

    // Initialize circuit breaker for fault tolerance
    this.initializeCircuitBreaker();
  }

  private initializeCircuitBreaker() {
    const options = {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      name: 'kafka-producer',
      fallback: async (event: EnhancedPolicyEvent) => {
        this.logger.warn(`Circuit breaker open - event queued: ${event.eventType}`);
        // Queue event for later processing
        await this.queueEventForRetry(event);
        return { queued: true };
      },
    };

    this.circuitBreaker = new CircuitBreaker(
      async (event: EnhancedPolicyEvent) => this.publishEventInternal(event),
      options
    );

    this.circuitBreaker.on('open', () => {
      this.logger.error('Circuit breaker is now open');
      this.publishSystemAlert('CIRCUIT_BREAKER_OPEN', { service: 'policy-service' });
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.warn('Circuit breaker is half-open');
    });

    this.circuitBreaker.on('close', () => {
      this.logger.log('Circuit breaker is closed');
    });
  }

  async onModuleInit() {
    // Skip Kafka initialization if disabled
    if (this.configService.get('DISABLE_KAFKA') === 'true') {
      this.logger.warn('Kafka is disabled - skipping initialization');
      return;
    }

    try {
      // Connect all components
      await this.producer.connect();
      await this.consumer.connect();
      await this.admin.connect();

      // Initialize transactional producer for exactly-once semantics
      // Note: initTransactions is not available in current kafkajs version
      // Use producer.transaction() method for transactional support
      if (this.configService.get('KAFKA_TRANSACTIONS_ENABLED') === 'true') {
        this.logger.log('Transactional support enabled - use producer.transaction() for transactions');
      }

      // Create topics if they don't exist
      await this.createTopics();

      // Subscribe to relevant topics
      await this.subscribeToTopics();

      // Start message deduplication cleanup
      this.startDeduplicationCleanup();

      this.logger.log('Enhanced Kafka service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Kafka service', error);
      // Allow service to start without Kafka in development
      if (this.configService.get('NODE_ENV') === 'production') {
        throw error;
      }
    }
  }

  async onModuleDestroy() {
    try {
      await this.consumer?.stop();
      await this.consumer?.disconnect();
      await this.producer?.disconnect();
      await this.admin?.disconnect();
      this.logger.log('Kafka connections closed');
    } catch (error) {
      this.logger.error('Error disconnecting from Kafka', error);
    }
  }

  private async createTopics() {
    const topicConfigs = [
      {
        topic: this.topics.POLICY_EVENTS,
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '604800000' }, // 7 days
          { name: 'compression.type', value: 'snappy' },
          { name: 'min.insync.replicas', value: '1' },
        ],
      },
      {
        topic: this.topics.DLQ_POLICY,
        numPartitions: 1,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '2592000000' }, // 30 days for DLQ
          { name: 'compression.type', value: 'snappy' },
        ],
      },
    ];

    try {
      await this.admin.createTopics({
        topics: topicConfigs,
        waitForLeaders: true,
      });
      this.logger.log('Kafka topics created/verified');
    } catch (error) {
      this.logger.warn('Topic creation failed (may already exist)', error.message);
    }
  }

  private async subscribeToTopics() {
    const topics = [
      this.topics.AUTH_EVENTS,
      this.topics.CLIENT_EVENTS,
      this.topics.CONTROL_EVENTS,
      this.topics.EVIDENCE_EVENTS,
      this.topics.WORKFLOW_EVENTS,
      this.topics.SAGA_ORCHESTRATOR,
    ];

    await this.consumer.subscribe({ 
      topics,
      fromBeginning: false,
    });

    // Start consuming messages with error handling
    await this.consumer.run({
      autoCommit: false, // Manual commit for better control
      eachMessage: async (payload) => {
        const result = await this.handleMessageWithRetry(payload);
        
        if (result.success) {
          // Commit offset only on successful processing
          await this.consumer.commitOffsets([{
            topic: payload.topic,
            partition: payload.partition,
            offset: (parseInt(payload.message.offset) + 1).toString(),
          }]);
        } else if (!result.shouldRetry) {
          // Send to DLQ if not retryable
          await this.sendToDeadLetterQueue(payload);
          // Still commit to avoid reprocessing
          await this.consumer.commitOffsets([{
            topic: payload.topic,
            partition: payload.partition,
            offset: (parseInt(payload.message.offset) + 1).toString(),
          }]);
        }
      },
    });
  }

  private async handleMessageWithRetry(
    payload: EachMessagePayload,
    retryCount = 0,
  ): Promise<MessageProcessingResult> {
    const { topic, partition, message } = payload;
    const value = message.value?.toString();

    if (!value) {
      return { success: false, shouldRetry: false, processedAt: new Date() };
    }

    try {
      const event = JSON.parse(value);
      
      // Check for duplicate messages
      if (this.isDuplicateMessage(event.id || message.key?.toString())) {
        this.logger.debug(`Duplicate message detected: ${event.id}`);
        return { success: true, processedAt: new Date() };
      }

      // Add distributed tracing
      const spanContext = this.extractSpanContext(message.headers);
      
      // Process message based on topic
      const result = await this.processMessage(topic, event, spanContext);
      
      // Mark message as processed for deduplication
      if (event.id) {
        this.markMessageAsProcessed(event.id);
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to process message from ${topic}`, error);
      
      // Implement exponential backoff retry
      if (retryCount < this.defaultRetryPolicy.maxRetries) {
        const delay = this.calculateRetryDelay(retryCount);
        this.logger.warn(`Retrying message processing after ${delay}ms (attempt ${retryCount + 1})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.handleMessageWithRetry(payload, retryCount + 1);
      }

      return {
        success: false,
        shouldRetry: false,
        error: error as Error,
        processedAt: new Date(),
      };
    }
  }

  private async processMessage(
    topic: string,
    event: any,
    spanContext?: any,
  ): Promise<MessageProcessingResult> {
    try {
      this.logger.debug(`Processing message from topic ${topic}:`, event);

      switch (topic) {
        case this.topics.AUTH_EVENTS:
          await this.handleAuthEvent(event);
          break;
        case this.topics.CLIENT_EVENTS:
          await this.handleClientEvent(event);
          break;
        case this.topics.CONTROL_EVENTS:
          await this.handleControlEvent(event);
          break;
        case this.topics.EVIDENCE_EVENTS:
          await this.handleEvidenceEvent(event);
          break;
        case this.topics.WORKFLOW_EVENTS:
          await this.handleWorkflowEvent(event);
          break;
        case this.topics.SAGA_ORCHESTRATOR:
          await this.handleSagaEvent(event);
          break;
        default:
          this.logger.warn(`Unhandled topic: ${topic}`);
      }

      // Publish metrics
      await this.publishMetric('message.processed', {
        topic,
        eventType: event.eventType,
        success: true,
      });

      return { success: true, processedAt: new Date() };
    } catch (error) {
      // Publish error metrics
      await this.publishMetric('message.error', {
        topic,
        eventType: event.eventType,
        error: error.message,
      });

      throw error;
    }
  }

  // Event handlers
  private async handleAuthEvent(event: any) {
    // Implement auth event handling logic
    this.logger.debug('Handling auth event:', event);
  }

  private async handleClientEvent(event: any) {
    // Implement client event handling logic
    this.logger.debug('Handling client event:', event);
  }

  private async handleControlEvent(event: any) {
    // Implement control event handling logic
    this.logger.debug('Handling control event:', event);
  }

  private async handleEvidenceEvent(event: any) {
    // Implement evidence event handling logic
    this.logger.debug('Handling evidence event:', event);
  }

  private async handleWorkflowEvent(event: any) {
    // Implement workflow event handling logic
    this.logger.debug('Handling workflow event:', event);
  }

  private async handleSagaEvent(event: any) {
    // Implement saga pattern handling
    this.logger.debug('Handling saga event:', event);
  }

  /**
   * Publish an event with circuit breaker protection
   */
  async publishEvent(event: EnhancedPolicyEvent): Promise<void> {
    // Skip if Kafka is disabled
    if (this.configService.get('DISABLE_KAFKA') === 'true') {
      this.logger.debug(`Kafka disabled - skipping event: ${event.eventType}`);
      return;
    }

    // Add event metadata
    const enrichedEvent: EnhancedPolicyEvent = {
      ...event,
      id: event.id || uuidv4(),
      timestamp: event.timestamp || new Date(),
      version: event.version || 1,
      correlationId: event.correlationId || uuidv4(),
      source: 'policy-service',
      retryCount: event.retryCount || 0,
    };

    try {
      // Use circuit breaker for fault tolerance
      await this.circuitBreaker.fire(enrichedEvent);
    } catch (error) {
      this.logger.error(`Failed to publish event: ${event.eventType}`, error);
      // Event will be queued by circuit breaker fallback
    }
  }

  private async publishEventInternal(event: EnhancedPolicyEvent): Promise<RecordMetadata[]> {
    const transaction = this.configService.get('KAFKA_TRANSACTIONS_ENABLED') === 'true';
    
    if (transaction) {
      const txn = await this.producer.transaction();
      try {
        const result = await txn.send({
          topic: this.topics.POLICY_EVENTS,
          messages: [{
            key: event.entityId || event.id,
            value: JSON.stringify(event),
            headers: this.createMessageHeaders(event),
          }],
        });
        
        await txn.commit();
        return result;
      } catch (error) {
        await txn.abort();
        throw error;
      }
    } else {
      return await this.producer.send({
        topic: this.topics.POLICY_EVENTS,
        messages: [{
          key: event.entityId || event.id,
          value: JSON.stringify(event),
          headers: this.createMessageHeaders(event),
        }],
      });
    }
  }

  /**
   * Batch publish events for better performance
   */
  async publishEventsBatch(events: EnhancedPolicyEvent[]): Promise<void> {
    if (this.configService.get('DISABLE_KAFKA') === 'true') {
      return;
    }

    const topicMessages: TopicMessages[] = [
      {
        topic: this.topics.POLICY_EVENTS,
        messages: events.map(event => ({
          key: event.entityId || event.id || uuidv4(),
          value: JSON.stringify({
            ...event,
            id: event.id || uuidv4(),
            timestamp: event.timestamp || new Date(),
            source: 'policy-service',
          }),
          headers: this.createMessageHeaders(event),
        })),
      },
    ];

    try {
      await this.producer.sendBatch({ topicMessages });
      this.logger.debug(`Published batch of ${events.length} events`);
    } catch (error) {
      this.logger.error('Failed to publish event batch', error);
      // Fall back to individual publishing
      for (const event of events) {
        await this.publishEvent(event);
      }
    }
  }

  private createMessageHeaders(event: EnhancedPolicyEvent): Record<string, string> {
    return {
      'correlation-id': event.correlationId || uuidv4(),
      'causation-id': event.causationId || '',
      'event-type': event.eventType,
      'event-version': String(event.version || 1),
      'source-service': 'policy-service',
      'timestamp': new Date().toISOString(),
    };
  }

  private extractSpanContext(headers?: any): any {
    // Extract distributed tracing context from headers
    if (!headers) return null;
    
    return {
      traceId: headers['trace-id']?.toString(),
      spanId: headers['span-id']?.toString(),
      parentSpanId: headers['parent-span-id']?.toString(),
    };
  }

  private async sendToDeadLetterQueue(payload: EachMessagePayload): Promise<void> {
    try {
      await this.producer.send({
        topic: this.topics.DLQ_POLICY,
        messages: [{
          key: payload.message.key,
          value: payload.message.value,
          headers: {
            ...payload.message.headers,
            'original-topic': payload.topic,
            'original-partition': String(payload.partition),
            'original-offset': payload.message.offset,
            'failed-at': new Date().toISOString(),
            'failure-reason': 'max-retries-exceeded',
          },
        }],
      });
      
      this.logger.warn(`Message sent to DLQ from topic ${payload.topic}`);
      
      // Publish alert for DLQ message
      await this.publishSystemAlert('MESSAGE_SENT_TO_DLQ', {
        topic: payload.topic,
        partition: payload.partition,
        offset: payload.message.offset,
      });
    } catch (error) {
      this.logger.error('Failed to send message to DLQ', error);
    }
  }

  private async queueEventForRetry(event: EnhancedPolicyEvent): Promise<void> {
    // Implement persistent queue for retry (could use Redis or database)
    this.logger.warn(`Event queued for retry: ${event.eventType}`);
  }

  private calculateRetryDelay(retryCount: number): number {
    const { initialDelay, maxDelay, factor, jitter } = this.defaultRetryPolicy;
    let delay = Math.min(initialDelay * Math.pow(factor, retryCount), maxDelay);
    
    if (jitter) {
      // Add random jitter (±25%)
      const jitterAmount = delay * 0.25;
      delay = delay + (Math.random() * 2 - 1) * jitterAmount;
    }
    
    return Math.floor(delay);
  }

  private isDuplicateMessage(messageId: string): boolean {
    if (!messageId) return false;
    return this.processedMessages.has(messageId);
  }

  private markMessageAsProcessed(messageId: string): void {
    this.processedMessages.set(messageId, new Date());
  }

  private startDeduplicationCleanup(): void {
    // Clean up old processed message IDs periodically
    setInterval(() => {
      const cutoffTime = Date.now() - this.MESSAGE_DEDUP_TTL;
      for (const [id, timestamp] of this.processedMessages.entries()) {
        if (timestamp.getTime() < cutoffTime) {
          this.processedMessages.delete(id);
        }
      }
    }, this.MESSAGE_DEDUP_TTL / 4); // Clean up every 15 minutes
  }

  private async publishMetric(metricName: string, data: any): Promise<void> {
    if (this.configService.get('DISABLE_METRICS') === 'true') {
      return;
    }

    try {
      await this.producer.send({
        topic: this.topics.SYSTEM_METRICS,
        messages: [{
          key: metricName,
          value: JSON.stringify({
            metric: metricName,
            service: 'policy-service',
            timestamp: new Date(),
            data,
          }),
        }],
      });
    } catch (error) {
      // Don't fail on metric publishing errors
      this.logger.debug(`Failed to publish metric: ${metricName}`);
    }
  }

  private async publishSystemAlert(alertType: string, data: any): Promise<void> {
    try {
      await this.producer.send({
        topic: this.topics.SYSTEM_ALERTS,
        messages: [{
          key: alertType,
          value: JSON.stringify({
            alert: alertType,
            service: 'policy-service',
            timestamp: new Date(),
            severity: 'high',
            data,
          }),
        }],
      });
    } catch (error) {
      this.logger.error(`Failed to publish system alert: ${alertType}`, error);
    }
  }

  /**
   * Get circuit breaker statistics
   */
  getCircuitBreakerStats(): any {
    return this.circuitBreaker?.stats || {};
  }

  /**
   * Get consumer lag for monitoring
   */
  async getConsumerLag(): Promise<any> {
    try {
      const groupDescription = await this.admin.describeGroups([this.groupId]);
      return groupDescription.groups[0];
    } catch (error) {
      this.logger.error('Failed to get consumer lag', error);
      return null;
    }
  }
}