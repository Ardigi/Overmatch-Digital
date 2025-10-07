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
  type TopicMessages
} from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import * as CircuitBreaker from 'opossum';

export interface EnhancedAuditEvent {
  id?: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  organizationId?: string;
  userId?: string;
  action?: string;
  resource?: string;
  result?: 'success' | 'failure' | 'partial';
  timestamp?: Date;
  version?: number;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, any>;
  payload?: any;
  retryCount?: number;
  source?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  riskScore?: number;
  compliance?: {
    framework?: string;
    requirement?: string;
    control?: string;
  };
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

export interface AuditMetrics {
  eventsProcessed: number;
  eventsStored: number;
  eventsFailed: number;
  averageProcessingTime: number;
  complianceViolations: number;
  highRiskEvents: number;
  lastEventTimestamp?: Date;
}

export interface ComplianceAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedEntity: string;
  framework: string;
  requirement: string;
  timestamp: Date;
  resolved: boolean;
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
  private readonly complianceAlerts = new Map<string, ComplianceAlert>();
  private readonly auditMetrics: AuditMetrics = {
    eventsProcessed: 0,
    eventsStored: 0,
    eventsFailed: 0,
    averageProcessingTime: 0,
    complianceViolations: 0,
    highRiskEvents: 0,
  };
  
  private readonly MESSAGE_DEDUP_TTL = 3600000; // 1 hour
  private readonly groupId = 'audit-service-consumer';
  private readonly HIGH_RISK_THRESHOLD = 70;
  
  private readonly defaultRetryPolicy: RetryPolicy = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    factor: 2,
    jitter: true,
  };
  
  private readonly topics = {
    AUDIT_EVENTS: 'audit-events',
    AUTH_EVENTS: 'auth-events',
    CLIENT_EVENTS: 'client-events',
    CONTROL_EVENTS: 'control-events',
    POLICY_EVENTS: 'policy-events',
    EVIDENCE_EVENTS: 'evidence-events',
    WORKFLOW_EVENTS: 'workflow-events',
    REPORTING_EVENTS: 'reporting-events',
    NOTIFICATION_EVENTS: 'notification-events',
    INTEGRATION_EVENTS: 'integration-events',
    
    // Compliance tracking
    COMPLIANCE_EVENTS: 'compliance-events',
    COMPLIANCE_VIOLATIONS: 'compliance-violations',
    COMPLIANCE_ALERTS: 'compliance-alerts',
    
    // Security events
    SECURITY_EVENTS: 'security-events',
    ACCESS_LOGS: 'access-logs',
    
    // Dead letter queues
    DLQ_AUDIT: 'dlq-audit',
    
    // System monitoring
    SYSTEM_METRICS: 'system-metrics',
    SYSTEM_ALERTS: 'system-alerts',
  };

  // Compliance frameworks
  private readonly complianceFrameworks = {
    SOC2: ['CC1', 'CC2', 'CC3', 'CC4', 'CC5', 'CC6', 'CC7', 'CC8', 'CC9'],
    SOC1: ['Control Activities', 'Information & Communication', 'Risk Assessment'],
    ISO27001: ['A.5', 'A.6', 'A.7', 'A.8', 'A.9', 'A.10', 'A.11', 'A.12'],
    HIPAA: ['Administrative', 'Physical', 'Technical'],
    GDPR: ['Lawfulness', 'Purpose Limitation', 'Data Minimization', 'Accuracy'],
  };

  constructor(private configService: ConfigService) {
    // Skip Kafka initialization if disabled
    if (this.configService.get('DISABLE_KAFKA') === 'true') {
      this.logger.warn('Kafka is disabled - skipping client creation');
      return;
    }

    const brokers = this.configService.get('KAFKA_BROKERS', 'kafka:29092').split(',');

    this.kafka = new Kafka({
      clientId: 'audit-service',
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
      compression: CompressionTypes.Snappy,
      transactionalId: `audit-service-${process.env.POD_NAME || 'local'}`,
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
      name: 'audit-kafka-producer',
      fallback: async (event: EnhancedAuditEvent) => {
        this.logger.warn(`Circuit breaker open - event queued: ${event.eventType}`);
        // Queue event for later processing
        await this.queueEventForRetry(event);
        return { queued: true };
      },
    };

    this.circuitBreaker = new CircuitBreaker(
      async (event: EnhancedAuditEvent) => this.publishEventInternal(event),
      options
    );

    this.circuitBreaker.on('open', () => {
      this.logger.error('Circuit breaker is now open');
      this.publishSystemAlert('CIRCUIT_BREAKER_OPEN', { service: 'audit-service' });
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
      if (this.configService.get('KAFKA_TRANSACTIONS_ENABLED') === 'true') {
        await this.producer.initTransactions();
      }

      // Create topics if they don't exist
      await this.createTopics();

      // Subscribe to relevant topics
      await this.subscribeToTopics();

      // Start message deduplication cleanup
      this.startDeduplicationCleanup();

      // Start metrics collection
      this.startMetricsCollection();

      // Start compliance monitoring
      this.startComplianceMonitoring();

      this.logger.log('Enhanced Audit Kafka service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Audit Kafka service', error);
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
        topic: this.topics.AUDIT_EVENTS,
        numPartitions: 5,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '31536000000' }, // 365 days for compliance
          { name: 'compression.type', value: 'snappy' },
          { name: 'min.insync.replicas', value: '1' },
          { name: 'segment.ms', value: '86400000' }, // Daily segments
        ],
      },
      {
        topic: this.topics.COMPLIANCE_EVENTS,
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '63072000000' }, // 2 years for compliance
          { name: 'compression.type', value: 'snappy' },
        ],
      },
      {
        topic: this.topics.COMPLIANCE_VIOLATIONS,
        numPartitions: 2,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '94608000000' }, // 3 years for violations
          { name: 'compression.type', value: 'snappy' },
        ],
      },
      {
        topic: this.topics.SECURITY_EVENTS,
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '15552000000' }, // 180 days
          { name: 'compression.type', value: 'snappy' },
        ],
      },
      {
        topic: this.topics.DLQ_AUDIT,
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
      this.logger.log('Audit Kafka topics created/verified');
    } catch (error) {
      this.logger.warn('Topic creation failed (may already exist)', error.message);
    }
  }

  private async subscribeToTopics() {
    // Subscribe to all service events for audit logging
    const topics = [
      this.topics.AUTH_EVENTS,
      this.topics.CLIENT_EVENTS,
      this.topics.CONTROL_EVENTS,
      this.topics.POLICY_EVENTS,
      this.topics.EVIDENCE_EVENTS,
      this.topics.WORKFLOW_EVENTS,
      this.topics.REPORTING_EVENTS,
      this.topics.NOTIFICATION_EVENTS,
      this.topics.INTEGRATION_EVENTS,
      this.topics.SECURITY_EVENTS,
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

    const startTime = Date.now();

    try {
      const event = JSON.parse(value);
      
      // Check for duplicate messages
      if (this.isDuplicateMessage(event.id || message.key?.toString())) {
        this.logger.debug(`Duplicate message detected: ${event.id}`);
        return { success: true, processedAt: new Date() };
      }

      // Add distributed tracing
      const spanContext = this.extractSpanContext(message.headers);
      
      // Process and audit the event
      const result = await this.processAndAuditEvent(topic, event, spanContext);
      
      // Update metrics
      this.auditMetrics.eventsProcessed++;
      const processingTime = Date.now() - startTime;
      this.auditMetrics.averageProcessingTime = 
        (this.auditMetrics.averageProcessingTime * (this.auditMetrics.eventsProcessed - 1) + processingTime) / 
        this.auditMetrics.eventsProcessed;
      
      // Mark message as processed for deduplication
      if (event.id) {
        this.markMessageAsProcessed(event.id);
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to process message from ${topic}`, error);
      this.auditMetrics.eventsFailed++;
      
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

  private async processAndAuditEvent(
    topic: string,
    event: any,
    spanContext?: any,
  ): Promise<MessageProcessingResult> {
    try {
      this.logger.debug(`Processing audit event from topic ${topic}:`, event);

      // Create audit entry
      const auditEntry: EnhancedAuditEvent = {
        id: uuidv4(),
        eventType: event.eventType || topic,
        entityType: this.extractEntityType(topic, event),
        entityId: event.entityId || event.id,
        organizationId: event.organizationId,
        userId: event.userId,
        action: event.action || this.extractAction(event.eventType),
        resource: event.resource || topic.replace('-events', ''),
        result: event.success !== false ? 'success' : 'failure',
        timestamp: new Date(event.timestamp || Date.now()),
        correlationId: event.correlationId || spanContext?.traceId,
        causationId: event.causationId,
        metadata: event.metadata,
        payload: this.sanitizePayload(event),
        source: event.source || topic,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        sessionId: event.sessionId,
      };

      // Calculate risk score
      auditEntry.riskScore = this.calculateRiskScore(auditEntry);

      // Check compliance implications
      const complianceCheck = this.checkCompliance(auditEntry);
      if (complianceCheck) {
        auditEntry.compliance = complianceCheck;
        
        if (complianceCheck.violation) {
          await this.handleComplianceViolation(auditEntry, complianceCheck);
        }
      }

      // Store audit entry (would normally go to database)
      await this.storeAuditEntry(auditEntry);

      // Check for high-risk events
      if (auditEntry.riskScore && auditEntry.riskScore > this.HIGH_RISK_THRESHOLD) {
        this.auditMetrics.highRiskEvents++;
        await this.handleHighRiskEvent(auditEntry);
      }

      // Publish audit event
      await this.publishAuditEvent(auditEntry);

      this.auditMetrics.eventsStored++;
      this.auditMetrics.lastEventTimestamp = new Date();

      return { success: true, processedAt: new Date() };
    } catch (error) {
      this.logger.error(`Failed to process audit event from ${topic}`, error);
      throw error;
    }
  }

  private extractEntityType(topic: string, event: any): string {
    if (event.entityType) return event.entityType;
    
    const topicMap: Record<string, string> = {
      'auth-events': 'user',
      'client-events': 'organization',
      'control-events': 'control',
      'policy-events': 'policy',
      'evidence-events': 'evidence',
      'workflow-events': 'workflow',
      'reporting-events': 'report',
    };
    
    return topicMap[topic] || 'unknown';
  }

  private extractAction(eventType: string): string {
    if (!eventType) return 'unknown';
    
    const parts = eventType.split('.');
    return parts[parts.length - 1] || 'unknown';
  }

  private sanitizePayload(event: any): any {
    // Remove sensitive data from payload
    const sanitized = { ...event };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'ssn', 'creditCard'];
    
    const removeSensitive = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      
      const cleaned = Array.isArray(obj) ? [...obj] : { ...obj };
      
      for (const key in cleaned) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          cleaned[key] = '[REDACTED]';
        } else if (typeof cleaned[key] === 'object') {
          cleaned[key] = removeSensitive(cleaned[key]);
        }
      }
      
      return cleaned;
    };
    
    return removeSensitive(sanitized);
  }

  private calculateRiskScore(event: EnhancedAuditEvent): number {
    let score = 0;
    
    // Base score by action type
    const actionScores: Record<string, number> = {
      'delete': 30,
      'update': 20,
      'create': 10,
      'read': 5,
      'login': 15,
      'logout': 5,
      'permission_change': 40,
      'export': 25,
      'import': 20,
    };
    
    score += actionScores[event.action || ''] || 10;
    
    // Resource sensitivity
    const sensitiveResources = ['user', 'auth', 'permission', 'audit', 'compliance'];
    if (sensitiveResources.includes(event.resource || '')) {
      score += 20;
    }
    
    // Failed actions are higher risk
    if (event.result === 'failure') {
      score += 30;
    }
    
    // Time-based risk (after hours)
    const hour = new Date(event.timestamp || Date.now()).getHours();
    if (hour < 6 || hour > 20) {
      score += 15;
    }
    
    // Unusual IP or new session
    if (event.metadata?.unusualLocation || event.metadata?.newDevice) {
      score += 25;
    }
    
    return Math.min(score, 100);
  }

  private checkCompliance(event: EnhancedAuditEvent): any {
    const compliance: any = {};
    
    // Check SOC 2 compliance
    if (event.resource === 'auth' || event.resource === 'user') {
      compliance.framework = 'SOC2';
      compliance.requirement = 'CC6.1';
      compliance.control = 'Logical and Physical Access Controls';
    }
    
    // Check GDPR compliance for data operations
    if (event.action === 'export' || event.action === 'delete') {
      compliance.framework = 'GDPR';
      compliance.requirement = event.action === 'export' ? 'Data Portability' : 'Right to Erasure';
    }
    
    // Check for violations
    if (event.result === 'failure' && event.riskScore && event.riskScore > 50) {
      compliance.violation = true;
      compliance.severity = event.riskScore > 75 ? 'high' : 'medium';
    }
    
    return Object.keys(compliance).length > 0 ? compliance : null;
  }

  private async handleComplianceViolation(event: EnhancedAuditEvent, compliance: any): Promise<void> {
    this.auditMetrics.complianceViolations++;
    
    const alert: ComplianceAlert = {
      id: uuidv4(),
      type: 'compliance_violation',
      severity: compliance.severity || 'medium',
      description: `Compliance violation detected for ${compliance.framework} - ${compliance.requirement}`,
      affectedEntity: event.entityId || 'unknown',
      framework: compliance.framework,
      requirement: compliance.requirement,
      timestamp: new Date(),
      resolved: false,
    };
    
    this.complianceAlerts.set(alert.id, alert);
    
    // Publish violation event
    await this.producer.send({
      topic: this.topics.COMPLIANCE_VIOLATIONS,
      messages: [{
        key: alert.id,
        value: JSON.stringify({
          alert,
          event,
        }),
      }],
    });
    
    this.logger.warn(`Compliance violation: ${alert.description}`);
  }

  private async handleHighRiskEvent(event: EnhancedAuditEvent): Promise<void> {
    // Publish high-risk alert
    await this.publishSystemAlert('HIGH_RISK_EVENT', {
      eventId: event.id,
      riskScore: event.riskScore,
      action: event.action,
      resource: event.resource,
      userId: event.userId,
      organizationId: event.organizationId,
    });
    
    this.logger.warn(`High-risk event detected: ${event.id} (score: ${event.riskScore})`);
  }

  private async storeAuditEntry(entry: EnhancedAuditEvent): Promise<void> {
    // This would normally store to database
    // For now, just log it
    this.logger.debug(`Storing audit entry: ${entry.id}`);
  }

  private async publishAuditEvent(event: EnhancedAuditEvent): Promise<void> {
    await this.producer.send({
      topic: this.topics.AUDIT_EVENTS,
      messages: [{
        key: event.id,
        value: JSON.stringify(event),
        headers: this.createMessageHeaders(event),
      }],
    });
  }

  /**
   * Publish an audit event with circuit breaker protection
   */
  async publishEvent(event: EnhancedAuditEvent): Promise<void> {
    // Skip if Kafka is disabled
    if (this.configService.get('DISABLE_KAFKA') === 'true') {
      this.logger.debug(`Kafka disabled - skipping event: ${event.eventType}`);
      return;
    }

    // Add event metadata
    const enrichedEvent: EnhancedAuditEvent = {
      ...event,
      id: event.id || uuidv4(),
      timestamp: event.timestamp || new Date(),
      version: event.version || 1,
      correlationId: event.correlationId || uuidv4(),
      source: 'audit-service',
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

  private async publishEventInternal(event: EnhancedAuditEvent): Promise<RecordMetadata[]> {
    return await this.producer.send({
      topic: this.topics.AUDIT_EVENTS,
      messages: [{
        key: event.entityId || event.id,
        value: JSON.stringify(event),
        headers: this.createMessageHeaders(event),
      }],
    });
  }

  private createMessageHeaders(event: EnhancedAuditEvent): Record<string, string> {
    return {
      'correlation-id': event.correlationId || uuidv4(),
      'causation-id': event.causationId || '',
      'event-type': event.eventType,
      'event-version': String(event.version || 1),
      'source-service': 'audit-service',
      'timestamp': new Date().toISOString(),
      'entity-type': event.entityType || '',
      'organization-id': event.organizationId || '',
      'user-id': event.userId || '',
    };
  }

  private extractSpanContext(headers?: any): any {
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
        topic: this.topics.DLQ_AUDIT,
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
    } catch (error) {
      this.logger.error('Failed to send message to DLQ', error);
    }
  }

  private async queueEventForRetry(event: EnhancedAuditEvent): Promise<void> {
    this.logger.warn(`Event queued for retry: ${event.eventType}`);
  }

  private calculateRetryDelay(retryCount: number): number {
    const { initialDelay, maxDelay, factor, jitter } = this.defaultRetryPolicy;
    let delay = Math.min(initialDelay * Math.pow(factor, retryCount), maxDelay);
    
    if (jitter) {
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
    setInterval(() => {
      const cutoffTime = Date.now() - this.MESSAGE_DEDUP_TTL;
      for (const [id, timestamp] of this.processedMessages.entries()) {
        if (timestamp.getTime() < cutoffTime) {
          this.processedMessages.delete(id);
        }
      }
    }, this.MESSAGE_DEDUP_TTL / 4);
  }

  private startMetricsCollection(): void {
    setInterval(async () => {
      await this.publishMetric('audit.metrics', this.auditMetrics);
    }, 60000);
  }

  private startComplianceMonitoring(): void {
    setInterval(() => {
      // Check for unresolved compliance alerts
      const unresolvedAlerts = Array.from(this.complianceAlerts.values())
        .filter(alert => !alert.resolved);
      
      if (unresolvedAlerts.length > 0) {
        this.logger.warn(`${unresolvedAlerts.length} unresolved compliance alerts`);
      }
      
      // Clean up old resolved alerts
      const cutoffTime = Date.now() - 86400000; // 24 hours
      for (const [id, alert] of this.complianceAlerts.entries()) {
        if (alert.resolved && alert.timestamp.getTime() < cutoffTime) {
          this.complianceAlerts.delete(id);
        }
      }
    }, 300000); // Every 5 minutes
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
            service: 'audit-service',
            timestamp: new Date(),
            data,
          }),
        }],
      });
    } catch (error) {
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
            service: 'audit-service',
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

  getAuditMetrics(): AuditMetrics {
    return { ...this.auditMetrics };
  }

  getComplianceAlerts(): ComplianceAlert[] {
    return Array.from(this.complianceAlerts.values());
  }

  resolveComplianceAlert(alertId: string): boolean {
    const alert = this.complianceAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }
}