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
  type RecordMetadata
} from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import * as CircuitBreaker from 'opossum';

export interface ReportGenerationRequest {
  reportId: string;
  reportType: string;
  organizationId: string;
  userId: string;
  parameters: Record<string, any>;
  format: 'pdf' | 'excel' | 'csv' | 'json' | 'html';
  scheduledAt?: Date;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface ReportMetadata {
  reportId: string;
  name: string;
  description: string;
  type: string;
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  generatedAt?: Date;
  completedAt?: Date;
  size?: number;
  location?: string;
  error?: string;
  executionTime?: number;
  dataPoints?: number;
}

export interface EnhancedReportingEvent {
  id?: string;
  eventType: string;
  reportId?: string;
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

export interface ReportingMetrics {
  reportsGenerated: number;
  reportsFailed: number;
  averageGenerationTime: number;
  totalDataPoints: number;
  cacheHitRate: number;
  activeGenerations: number;
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
  private readonly activeReports = new Map<string, ReportMetadata>();
  private readonly reportCache = new Map<string, { data: any; timestamp: Date }>();
  private readonly reportingMetrics: ReportingMetrics = {
    reportsGenerated: 0,
    reportsFailed: 0,
    averageGenerationTime: 0,
    totalDataPoints: 0,
    cacheHitRate: 0,
    activeGenerations: 0,
  };
  
  private readonly MESSAGE_DEDUP_TTL = 3600000; // 1 hour
  private readonly CACHE_TTL = 900000; // 15 minutes
  private readonly groupId = 'reporting-service-consumer';
  
  private readonly topics = {
    REPORTING_EVENTS: 'reporting-events',
    REPORT_REQUESTS: 'report-requests',
    REPORT_COMPLETIONS: 'report-completions',
    REPORT_FAILURES: 'report-failures',
    
    // Source data events
    AUTH_EVENTS: 'auth-events',
    CLIENT_EVENTS: 'client-events',
    CONTROL_EVENTS: 'control-events',
    POLICY_EVENTS: 'policy-events',
    EVIDENCE_EVENTS: 'evidence-events',
    WORKFLOW_EVENTS: 'workflow-events',
    AUDIT_EVENTS: 'audit-events',
    
    // Analytics
    ANALYTICS_EVENTS: 'analytics-events',
    BUSINESS_METRICS: 'business-metrics',
    
    // Dead letter queues
    DLQ_REPORTING: 'dlq-reporting',
    
    // System monitoring
    SYSTEM_METRICS: 'system-metrics',
    SYSTEM_ALERTS: 'system-alerts',
  };

  constructor(private configService: ConfigService) {
    if (this.configService.get('DISABLE_KAFKA') === 'true') {
      this.logger.warn('Kafka is disabled - skipping client creation');
      return;
    }

    const brokers = this.configService.get('KAFKA_BROKERS', 'kafka:29092').split(',');

    this.kafka = new Kafka({
      clientId: 'reporting-service',
      brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
      connectionTimeout: 10000,
      requestTimeout: 30000,
      logLevel: logLevel.INFO,
      ssl: this.configService.get('KAFKA_SSL_ENABLED') === 'true' ? {
        rejectUnauthorized: true,
        ca: this.configService.get('KAFKA_SSL_CA'),
        cert: this.configService.get('KAFKA_SSL_CERT'),
        key: this.configService.get('KAFKA_SSL_KEY'),
      } : undefined,
      sasl: this.configService.get('KAFKA_SASL_ENABLED') === 'true' ? {
        mechanism: 'scram-sha-512',
        username: this.configService.get('KAFKA_SASL_USERNAME'),
        password: this.configService.get('KAFKA_SASL_PASSWORD'),
      } : undefined,
    });

    this.producer = this.kafka.producer({
      idempotent: true,
      maxInFlightRequests: 5,
      transactionalId: `reporting-service-${process.env.POD_NAME || 'local'}`,
    });
    
    this.consumer = this.kafka.consumer({ 
      groupId: this.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      maxBytesPerPartition: 1048576,
      retry: {
        retries: 5,
      },
    });
    
    this.admin = this.kafka.admin();
    this.initializeCircuitBreaker();
  }

  private initializeCircuitBreaker() {
    const options = {
      timeout: 30000, // Longer timeout for report generation
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      name: 'reporting-kafka-producer',
      fallback: async (event: EnhancedReportingEvent) => {
        this.logger.warn(`Circuit breaker open - event queued: ${event.eventType}`);
        await this.queueEventForRetry(event);
        return { queued: true };
      },
    };

    this.circuitBreaker = new CircuitBreaker(
      async (event: EnhancedReportingEvent) => this.publishEventInternal(event),
      options
    );

    this.circuitBreaker.on('open', () => {
      this.logger.error('Circuit breaker is now open');
      this.publishSystemAlert('CIRCUIT_BREAKER_OPEN', { service: 'reporting-service' });
    });
  }

  async onModuleInit() {
    if (this.configService.get('DISABLE_KAFKA') === 'true') {
      this.logger.warn('Kafka is disabled - skipping initialization');
      return;
    }

    try {
      await this.producer.connect();
      await this.consumer.connect();
      await this.admin.connect();

      // KafkaJS doesn't require explicit transaction initialization
      // Transactions are started with producer.transaction() when needed

      await this.createTopics();
      await this.subscribeToTopics();
      this.startDeduplicationCleanup();
      this.startCacheCleanup();
      this.startMetricsCollection();

      this.logger.log('Enhanced Reporting Kafka service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Reporting Kafka service', error);
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
        topic: this.topics.REPORTING_EVENTS,
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '2592000000' }, // 30 days
          { name: 'compression.type', value: 'snappy' },
          { name: 'min.insync.replicas', value: '1' },
        ],
      },
      {
        topic: this.topics.REPORT_REQUESTS,
        numPartitions: 5,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '604800000' }, // 7 days
          { name: 'compression.type', value: 'snappy' },
        ],
      },
      {
        topic: this.topics.ANALYTICS_EVENTS,
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '7776000000' }, // 90 days
          { name: 'compression.type', value: 'snappy' },
        ],
      },
      {
        topic: this.topics.DLQ_REPORTING,
        numPartitions: 1,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '2592000000' }, // 30 days
          { name: 'compression.type', value: 'snappy' },
        ],
      },
    ];

    try {
      await this.admin.createTopics({
        topics: topicConfigs,
        waitForLeaders: true,
      });
      this.logger.log('Reporting Kafka topics created/verified');
    } catch (error) {
      this.logger.warn('Topic creation failed (may already exist)', error.message);
    }
  }

  private async subscribeToTopics() {
    const topics = [
      this.topics.REPORT_REQUESTS,
      this.topics.AUTH_EVENTS,
      this.topics.CLIENT_EVENTS,
      this.topics.CONTROL_EVENTS,
      this.topics.POLICY_EVENTS,
      this.topics.EVIDENCE_EVENTS,
      this.topics.WORKFLOW_EVENTS,
      this.topics.AUDIT_EVENTS,
    ];

    await this.consumer.subscribe({ 
      topics,
      fromBeginning: false,
    });

    await this.consumer.run({
      autoCommit: false,
      eachMessage: async (payload) => {
        const result = await this.handleMessageWithRetry(payload);
        
        if (result.success) {
          await this.consumer.commitOffsets([{
            topic: payload.topic,
            partition: payload.partition,
            offset: (parseInt(payload.message.offset) + 1).toString(),
          }]);
        } else if (!result.shouldRetry) {
          await this.sendToDeadLetterQueue(payload);
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
  ): Promise<{ success: boolean; shouldRetry?: boolean; error?: Error; processedAt: Date }> {
    const { topic, message } = payload;
    const value = message.value?.toString();

    if (!value) {
      return { success: false, shouldRetry: false, processedAt: new Date() };
    }

    try {
      const event = JSON.parse(value);
      
      if (this.isDuplicateMessage(event.id || message.key?.toString())) {
        this.logger.debug(`Duplicate message detected: ${event.id}`);
        return { success: true, processedAt: new Date() };
      }

      const result = await this.processMessage(topic, event);
      
      if (event.id) {
        this.markMessageAsProcessed(event.id);
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to process message from ${topic}`, error);
      
      if (retryCount < 3) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
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
  ): Promise<{ success: boolean; shouldRetry?: boolean; error?: Error; processedAt: Date }> {
    try {
      if (topic === this.topics.REPORT_REQUESTS) {
        await this.handleReportRequest(event);
      } else {
        // Collect data for analytics
        await this.collectAnalyticsData(topic, event);
      }

      return { success: true, processedAt: new Date() };
    } catch (error) {
      this.logger.error(`Error processing message from ${topic}:`, error);
      throw error;
    }
  }

  private async handleReportRequest(request: ReportGenerationRequest) {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = this.generateCacheKey(request);
    const cached = this.reportCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_TTL) {
      this.reportingMetrics.cacheHitRate++;
      this.logger.debug(`Cache hit for report: ${request.reportId}`);
      
      await this.publishReportCompletion(request.reportId, cached.data);
      return;
    }

    // Create report metadata
    const metadata: ReportMetadata = {
      reportId: request.reportId,
      name: `${request.reportType}_${new Date().toISOString()}`,
      description: `Generated ${request.reportType} report`,
      type: request.reportType,
      status: 'generating',
      progress: 0,
      generatedAt: new Date(),
    };

    this.activeReports.set(request.reportId, metadata);
    this.reportingMetrics.activeGenerations++;

    try {
      // Simulate report generation with progress updates
      for (let progress = 0; progress <= 100; progress += 20) {
        metadata.progress = progress;
        await this.publishProgressUpdate(request.reportId, progress);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Generate report (simplified)
      const reportData = await this.generateReport(request);
      
      metadata.status = 'completed';
      metadata.completedAt = new Date();
      metadata.executionTime = Date.now() - startTime;
      metadata.dataPoints = reportData.dataPoints || 0;
      metadata.size = JSON.stringify(reportData).length;

      // Cache the report
      this.reportCache.set(cacheKey, {
        data: reportData,
        timestamp: new Date(),
      });

      // Update metrics
      this.reportingMetrics.reportsGenerated++;
      this.reportingMetrics.totalDataPoints += metadata.dataPoints;
      this.reportingMetrics.averageGenerationTime = 
        (this.reportingMetrics.averageGenerationTime * (this.reportingMetrics.reportsGenerated - 1) + 
         metadata.executionTime) / this.reportingMetrics.reportsGenerated;

      await this.publishReportCompletion(request.reportId, reportData);
      
    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error.message;
      this.reportingMetrics.reportsFailed++;
      
      await this.publishReportFailure(request.reportId, error.message);
      throw error;
    } finally {
      this.reportingMetrics.activeGenerations--;
      this.activeReports.delete(request.reportId);
    }
  }

  private async generateReport(request: ReportGenerationRequest): Promise<any> {
    // Simplified report generation logic
    const report = {
      reportId: request.reportId,
      type: request.reportType,
      generatedAt: new Date(),
      organizationId: request.organizationId,
      parameters: request.parameters,
      format: request.format,
      dataPoints: Math.floor(Math.random() * 10000),
      sections: [],
    };

    // Generate different report types
    switch (request.reportType) {
      case 'compliance-summary':
        report.sections = [
          { name: 'Executive Summary', data: {} },
          { name: 'Control Assessment', data: {} },
          { name: 'Evidence Status', data: {} },
          { name: 'Recommendations', data: {} },
        ];
        break;
      case 'audit-trail':
        report.sections = [
          { name: 'Activity Log', data: {} },
          { name: 'User Actions', data: {} },
          { name: 'System Events', data: {} },
        ];
        break;
      case 'risk-assessment':
        report.sections = [
          { name: 'Risk Matrix', data: {} },
          { name: 'Vulnerabilities', data: {} },
          { name: 'Mitigation Strategies', data: {} },
        ];
        break;
      default:
        report.sections = [{ name: 'Data', data: {} }];
    }

    return report;
  }

  private async collectAnalyticsData(topic: string, event: any) {
    // Collect and aggregate data for analytics
    const analyticsEvent = {
      id: uuidv4(),
      source: topic,
      eventType: event.eventType,
      timestamp: new Date(),
      organizationId: event.organizationId,
      data: event,
    };

    await this.producer.send({
      topic: this.topics.ANALYTICS_EVENTS,
      compression: CompressionTypes.Snappy,
      messages: [{
        key: analyticsEvent.id,
        value: JSON.stringify(analyticsEvent),
      }],
    });
  }

  private generateCacheKey(request: ReportGenerationRequest): string {
    return `${request.reportType}_${request.organizationId}_${JSON.stringify(request.parameters)}`;
  }

  async publishEvent(event: EnhancedReportingEvent): Promise<void> {
    if (this.configService.get('DISABLE_KAFKA') === 'true') {
      return;
    }

    const enrichedEvent: EnhancedReportingEvent = {
      ...event,
      id: event.id || uuidv4(),
      timestamp: event.timestamp || new Date(),
      version: event.version || 1,
      correlationId: event.correlationId || uuidv4(),
      source: 'reporting-service',
      retryCount: event.retryCount || 0,
    };

    try {
      await this.circuitBreaker.fire(enrichedEvent);
    } catch (error) {
      this.logger.error(`Failed to publish event: ${event.eventType}`, error);
    }
  }

  private async publishEventInternal(event: EnhancedReportingEvent): Promise<RecordMetadata[]> {
    return await this.producer.send({
      topic: this.topics.REPORTING_EVENTS,
      compression: CompressionTypes.Snappy,
      messages: [{
        key: event.reportId || event.id,
        value: JSON.stringify(event),
        headers: this.createMessageHeaders(event),
      }],
    });
  }

  private async publishProgressUpdate(reportId: string, progress: number) {
    await this.producer.send({
      topic: this.topics.REPORTING_EVENTS,
      messages: [{
        key: reportId,
        value: JSON.stringify({
          eventType: 'report.progress',
          reportId,
          progress,
          timestamp: new Date(),
        }),
      }],
    });
  }

  private async publishReportCompletion(reportId: string, data: any) {
    await this.producer.send({
      topic: this.topics.REPORT_COMPLETIONS,
      messages: [{
        key: reportId,
        value: JSON.stringify({
          reportId,
          status: 'completed',
          data,
          timestamp: new Date(),
        }),
      }],
    });
  }

  private async publishReportFailure(reportId: string, error: string) {
    await this.producer.send({
      topic: this.topics.REPORT_FAILURES,
      messages: [{
        key: reportId,
        value: JSON.stringify({
          reportId,
          status: 'failed',
          error,
          timestamp: new Date(),
        }),
      }],
    });
  }

  private createMessageHeaders(event: EnhancedReportingEvent): Record<string, string> {
    return {
      'correlation-id': event.correlationId || uuidv4(),
      'causation-id': event.causationId || '',
      'event-type': event.eventType,
      'event-version': String(event.version || 1),
      'source-service': 'reporting-service',
      'timestamp': new Date().toISOString(),
    };
  }

  private async sendToDeadLetterQueue(payload: EachMessagePayload): Promise<void> {
    try {
      await this.producer.send({
        topic: this.topics.DLQ_REPORTING,
        messages: [{
          key: payload.message.key,
          value: payload.message.value,
          headers: {
            ...payload.message.headers,
            'original-topic': payload.topic,
            'original-partition': String(payload.partition),
            'original-offset': payload.message.offset,
            'failed-at': new Date().toISOString(),
          },
        }],
      });
    } catch (error) {
      this.logger.error('Failed to send message to DLQ', error);
    }
  }

  private async queueEventForRetry(event: EnhancedReportingEvent): Promise<void> {
    this.logger.warn(`Event queued for retry: ${event.eventType}`);
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

  private startCacheCleanup(): void {
    setInterval(() => {
      const cutoffTime = Date.now() - this.CACHE_TTL;
      for (const [key, cached] of this.reportCache.entries()) {
        if (cached.timestamp.getTime() < cutoffTime) {
          this.reportCache.delete(key);
        }
      }
    }, this.CACHE_TTL / 2);
  }

  private startMetricsCollection(): void {
    setInterval(async () => {
      await this.publishMetric('reporting.metrics', this.reportingMetrics);
    }, 60000);
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
            service: 'reporting-service',
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
            service: 'reporting-service',
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

  getReportingMetrics(): ReportingMetrics {
    return { ...this.reportingMetrics };
  }

  getActiveReports(): ReportMetadata[] {
    return Array.from(this.activeReports.values());
  }

  async requestReport(request: ReportGenerationRequest): Promise<string> {
    const reportId = request.reportId || uuidv4();
    
    await this.producer.send({
      topic: this.topics.REPORT_REQUESTS,
      messages: [{
        key: reportId,
        value: JSON.stringify({
          ...request,
          reportId,
          timestamp: new Date(),
        }),
      }],
    });

    return reportId;
  }
}