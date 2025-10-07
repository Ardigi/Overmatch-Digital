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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration, IntegrationStatus } from '../integrations/entities/integration.entity';
import { WebhookService } from '../webhooks/webhook.service';
import { ApiConnectorService } from '../connectors/api-connector.service';

export interface IntegrationEvent {
  id?: string;
  eventType: string;
  integrationId?: string;
  organizationId?: string;
  connectionType?: string;
  timestamp?: Date;
  version?: number;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, any>;
  payload?: any;
  retryCount?: number;
  source?: string;
}

export interface WebhookEvent {
  id: string;
  integrationId: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  signature?: string;
  timestamp: Date;
  retryCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface IntegrationSync {
  integrationId: string;
  syncType: 'full' | 'incremental' | 'delta';
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed';
  recordsProcessed: number;
  recordsFailed: number;
  error?: string;
}

export interface IntegrationMetrics {
  totalIntegrations: number;
  activeIntegrations: number;
  syncInProgress: number;
  webhooksReceived: number;
  webhooksFailed: number;
  apiCallsSuccess: number;
  apiCallsFailed: number;
  averageResponseTime: number;
  totalDataVolume: number;
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
  private readonly activeSyncs = new Map<string, IntegrationSync>();
  private readonly integrationMetrics: IntegrationMetrics = {
    totalIntegrations: 0,
    activeIntegrations: 0,
    syncInProgress: 0,
    webhooksReceived: 0,
    webhooksFailed: 0,
    apiCallsSuccess: 0,
    apiCallsFailed: 0,
    averageResponseTime: 0,
    totalDataVolume: 0,
  };
  
  private readonly MESSAGE_DEDUP_TTL = 3600000; // 1 hour
  private readonly groupId = 'integration-service-consumer';
  
  private readonly topics = {
    INTEGRATION_EVENTS: 'integration-events',
    WEBHOOK_EVENTS: 'webhook-events',
    SYNC_EVENTS: 'sync-events',
    
    // Source service events
    AUTH_EVENTS: 'auth-events',
    CLIENT_EVENTS: 'client-events',
    CONTROL_EVENTS: 'control-events',
    POLICY_EVENTS: 'policy-events',
    EVIDENCE_EVENTS: 'evidence-events',
    WORKFLOW_EVENTS: 'workflow-events',
    AUDIT_EVENTS: 'audit-events',
    REPORTING_EVENTS: 'reporting-events',
    
    // External system events
    EXTERNAL_UPDATES: 'external-updates',
    DATA_SYNC: 'data-sync',
    
    // Dead letter queues
    DLQ_INTEGRATION: 'dlq-integration',
    
    // System monitoring
    SYSTEM_METRICS: 'system-metrics',
    SYSTEM_ALERTS: 'system-alerts',
  };

  constructor(
    private configService: ConfigService,
    @InjectRepository(Integration)
    private integrationRepository: Repository<Integration>,
    private webhookService: WebhookService,
    private apiConnectorService: ApiConnectorService,
  ) {
    if (this.configService.get('DISABLE_KAFKA') === 'true') {
      this.logger.warn('Kafka is disabled - skipping client creation');
      return;
    }

    const brokers = this.configService.get('KAFKA_BROKERS', 'kafka:29092').split(',');

    this.kafka = new Kafka({
      clientId: 'integration-service',
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
        mechanism: 'scram-sha-512' as const,
        username: this.configService.get('KAFKA_SASL_USERNAME') || '',
        password: this.configService.get('KAFKA_SASL_PASSWORD') || '',
      } : undefined,
    });

    this.producer = this.kafka.producer({
      idempotent: true,
      maxInFlightRequests: 5,
      transactionalId: `integration-service-${process.env.POD_NAME || 'local'}`,
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
      timeout: 10000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      name: 'integration-kafka-producer',
      fallback: async (event: IntegrationEvent) => {
        this.logger.warn(`Circuit breaker open - event queued: ${event.eventType}`);
        await this.queueEventForRetry(event);
        return { queued: true };
      },
    };

    this.circuitBreaker = new CircuitBreaker(
      async (event: IntegrationEvent) => this.publishEventInternal(event),
      options
    );

    this.circuitBreaker.on('open', () => {
      this.logger.error('Circuit breaker is now open');
      this.publishSystemAlert('CIRCUIT_BREAKER_OPEN', { service: 'integration-service' });
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
      await this.loadActiveIntegrations();
      this.startDeduplicationCleanup();
      this.startMetricsCollection();
      this.startSyncMonitoring();

      this.logger.log('Enhanced Integration Kafka service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Integration Kafka service', error);
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
        topic: this.topics.INTEGRATION_EVENTS,
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '2592000000' }, // 30 days
          { name: 'compression.type', value: 'snappy' },
          { name: 'min.insync.replicas', value: '1' },
        ],
      },
      {
        topic: this.topics.WEBHOOK_EVENTS,
        numPartitions: 5,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '604800000' }, // 7 days
          { name: 'compression.type', value: 'snappy' },
        ],
      },
      {
        topic: this.topics.SYNC_EVENTS,
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '604800000' }, // 7 days
          { name: 'compression.type', value: 'snappy' },
        ],
      },
      {
        topic: this.topics.DLQ_INTEGRATION,
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
      this.logger.log('Integration Kafka topics created/verified');
    } catch (error) {
      this.logger.warn('Topic creation failed (may already exist)', error.message);
    }
  }

  private async subscribeToTopics() {
    const topics = [
      this.topics.WEBHOOK_EVENTS,
      this.topics.AUTH_EVENTS,
      this.topics.CLIENT_EVENTS,
      this.topics.CONTROL_EVENTS,
      this.topics.POLICY_EVENTS,
      this.topics.EVIDENCE_EVENTS,
      this.topics.WORKFLOW_EVENTS,
      this.topics.AUDIT_EVENTS,
      this.topics.REPORTING_EVENTS,
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
      if (topic === this.topics.WEBHOOK_EVENTS) {
        await this.handleWebhookEvent(event);
      } else {
        // Route events to appropriate integrations
        await this.routeEventToIntegrations(topic, event);
      }

      return { success: true, processedAt: new Date() };
    } catch (error) {
      this.logger.error(`Error processing message from ${topic}:`, error);
      throw error;
    }
  }

  private async handleWebhookEvent(event: WebhookEvent) {
    this.integrationMetrics.webhooksReceived++;
    
    try {
      // Verify webhook signature
      const integration = await this.integrationRepository.findOne({
        where: { id: event.integrationId },
      });

      if (!integration) {
        throw new Error(`Integration not found: ${event.integrationId}`);
      }

      const isValid = await this.webhookService.verifySignature(
        event.body,
        event.signature || '',
        integration.configuration.webhookSecret || ''
      );

      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      // Process webhook data
      await this.processWebhookData(integration, event);
      
      // Publish event for other services
      await this.publishEvent({
        eventType: 'webhook.received',
        integrationId: event.integrationId,
        organizationId: integration.organizationId,
        payload: event,
      });

    } catch (error) {
      this.integrationMetrics.webhooksFailed++;
      throw error;
    }
  }

  private async processWebhookData(integration: Integration, event: WebhookEvent) {
    const sync: IntegrationSync = {
      integrationId: integration.id,
      syncType: 'incremental',
      startTime: new Date(),
      status: 'running',
      recordsProcessed: 0,
      recordsFailed: 0,
    };

    this.activeSyncs.set(integration.id, sync);
    this.integrationMetrics.syncInProgress++;

    try {
      // Transform webhook data based on integration type
      const transformedData = await this.transformData(integration, event.body);
      
      // Store or forward data as needed
      await this.storeTransformedData(integration, transformedData);
      
      sync.recordsProcessed++;
      sync.status = 'completed';
      sync.endTime = new Date();
      
    } catch (error) {
      sync.recordsFailed++;
      sync.status = 'failed';
      sync.error = error.message;
      throw error;
    } finally {
      this.activeSyncs.delete(integration.id);
      this.integrationMetrics.syncInProgress--;
    }
  }

  private async transformData(integration: Integration, data: any): Promise<any> {
    // Apply transformation rules based on integration type
    const transformationRules = integration.configuration.customConfig?.transformationRules || {};
    
    // Use the type field in configuration for custom integration types
    const integrationType = integration.configuration.type || integration.type;
    
    if (integrationType === 'salesforce') {
      return this.transformSalesforceData(data, transformationRules);
    } else if (integrationType === 'github') {
      return this.transformGithubData(data, transformationRules);
    } else if (integrationType === 'jira') {
      return this.transformJiraData(data, transformationRules);
    } else if (integrationType === 'slack') {
      return this.transformSlackData(data, transformationRules);
    }
    
    return data;
  }

  private transformSalesforceData(data: any, rules: any): any {
    return {
      id: data.Id,
      type: data.attributes?.type,
      name: data.Name,
      status: data.Status,
      createdDate: data.CreatedDate,
      lastModifiedDate: data.LastModifiedDate,
      customFields: this.extractCustomFields(data, rules),
    };
  }

  private transformGithubData(data: any, rules: any): any {
    return {
      id: data.id,
      type: data.type || 'github_event',
      repository: data.repository?.full_name,
      action: data.action,
      sender: data.sender?.login,
      timestamp: data.created_at || new Date(),
      payload: data,
    };
  }

  private transformJiraData(data: any, rules: any): any {
    return {
      id: data.issue?.id || data.id,
      key: data.issue?.key || data.key,
      type: data.webhookEvent,
      project: data.issue?.fields?.project?.key,
      status: data.issue?.fields?.status?.name,
      summary: data.issue?.fields?.summary,
      timestamp: data.timestamp,
    };
  }

  private transformSlackData(data: any, rules: any): any {
    return {
      id: data.event_id,
      type: data.type,
      channel: data.channel,
      user: data.user,
      text: data.text,
      timestamp: data.ts,
      team: data.team_id,
    };
  }

  private extractCustomFields(data: any, rules: any): Record<string, any> {
    const customFields: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith('Custom_') || rules.customFields?.includes(key)) {
        customFields[key] = value;
      }
    }
    
    return customFields;
  }

  private async storeTransformedData(integration: Integration, data: any) {
    // Store data in appropriate location based on integration config
    const storageConfig = integration.configuration.customConfig?.storage || {};
    
    if (storageConfig && storageConfig.type === 'database') {
      // Store in database
      await this.storeInDatabase(integration, data);
    } else if (storageConfig && storageConfig.type === 's3') {
      // Store in S3
      await this.storeInS3(integration, data);
    }
    
    // Forward to relevant services
    await this.forwardToServices(integration, data);
  }

  private async storeInDatabase(integration: Integration, data: any) {
    // Implementation would store data in database
    this.logger.debug(`Storing data in database for integration: ${integration.id}`);
  }

  private async storeInS3(integration: Integration, data: any) {
    // Implementation would store data in S3
    this.logger.debug(`Storing data in S3 for integration: ${integration.id}`);
  }

  private async forwardToServices(integration: Integration, data: any) {
    const forwardingRules = integration.configuration.customConfig?.forwarding || [];
    
    for (const rule of forwardingRules) {
      if (rule.service === 'audit') {
        await this.publishEvent({
          eventType: 'external.data.received',
          integrationId: integration.id,
          organizationId: integration.organizationId,
          payload: data,
        });
      }
    }
  }

  private async routeEventToIntegrations(topic: string, event: any) {
    // Find integrations that subscribe to this event type
    const integrations = await this.integrationRepository.find({
      where: { 
        status: IntegrationStatus.ACTIVE,
      },
    });

    for (const integration of integrations) {
      try {
        await this.sendToExternalSystem(integration, event);
        this.integrationMetrics.apiCallsSuccess++;
      } catch (error) {
        this.integrationMetrics.apiCallsFailed++;
        this.logger.error(`Failed to send event to integration ${integration.id}`, error);
      }
    }
  }

  private async sendToExternalSystem(integration: Integration, event: any) {
    const startTime = Date.now();
    
    try {
      const response = await this.apiConnectorService.sendEvent(
        integration.configuration.endpoint || integration.configuration.apiUrl,
        event,
        integration.configuration as any
      );
      
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      
      await this.publishEvent({
        eventType: 'integration.data.sent',
        integrationId: integration.id,
        organizationId: integration.organizationId,
        metadata: {
          responseTime,
          statusCode: response.status,
        },
      });
      
    } catch (error) {
      throw error;
    }
  }

  private updateAverageResponseTime(responseTime: number) {
    const totalCalls = this.integrationMetrics.apiCallsSuccess + this.integrationMetrics.apiCallsFailed;
    this.integrationMetrics.averageResponseTime = 
      (this.integrationMetrics.averageResponseTime * (totalCalls - 1) + responseTime) / totalCalls;
  }

  private async loadActiveIntegrations() {
    const integrations = await this.integrationRepository.count({
      where: { status: IntegrationStatus.ACTIVE },
    });
    
    this.integrationMetrics.totalIntegrations = await this.integrationRepository.count();
    this.integrationMetrics.activeIntegrations = integrations;
  }

  async publishEvent(event: IntegrationEvent): Promise<void> {
    if (this.configService.get('DISABLE_KAFKA') === 'true') {
      return;
    }

    const enrichedEvent: IntegrationEvent = {
      ...event,
      id: event.id || uuidv4(),
      timestamp: event.timestamp || new Date(),
      version: event.version || 1,
      correlationId: event.correlationId || uuidv4(),
      source: 'integration-service',
      retryCount: event.retryCount || 0,
    };

    try {
      await this.circuitBreaker.fire(enrichedEvent);
    } catch (error) {
      this.logger.error(`Failed to publish event: ${event.eventType}`, error);
    }
  }

  private async publishEventInternal(event: IntegrationEvent): Promise<RecordMetadata[]> {
    return await this.producer.send({
      topic: this.topics.INTEGRATION_EVENTS,
      messages: [{
        key: event.integrationId || event.id,
        value: JSON.stringify(event),
        headers: this.createMessageHeaders(event),
      }],
    });
  }

  private createMessageHeaders(event: IntegrationEvent): Record<string, string> {
    return {
      'correlation-id': event.correlationId || uuidv4(),
      'causation-id': event.causationId || '',
      'event-type': event.eventType,
      'event-version': String(event.version || 1),
      'source-service': 'integration-service',
      'timestamp': new Date().toISOString(),
    };
  }

  private async sendToDeadLetterQueue(payload: EachMessagePayload): Promise<void> {
    try {
      await this.producer.send({
        topic: this.topics.DLQ_INTEGRATION,
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

  private async queueEventForRetry(event: IntegrationEvent): Promise<void> {
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

  private startMetricsCollection(): void {
    setInterval(async () => {
      await this.publishMetric('integration.metrics', this.integrationMetrics);
    }, 60000);
  }

  private startSyncMonitoring(): void {
    setInterval(() => {
      for (const [id, sync] of this.activeSyncs.entries()) {
        if (sync.status === 'running' && 
            Date.now() - sync.startTime.getTime() > 300000) { // 5 minutes
          this.logger.warn(`Long-running sync detected: ${id}`);
          this.publishSystemAlert('LONG_RUNNING_SYNC', { integrationId: id, sync });
        }
      }
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
            service: 'integration-service',
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
            service: 'integration-service',
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

  getIntegrationMetrics(): IntegrationMetrics {
    return { ...this.integrationMetrics };
  }

  getActiveSyncs(): IntegrationSync[] {
    return Array.from(this.activeSyncs.values());
  }

  async triggerSync(integrationId: string, syncType: 'full' | 'incremental' | 'delta'): Promise<void> {
    await this.producer.send({
      topic: this.topics.SYNC_EVENTS,
      messages: [{
        key: integrationId,
        value: JSON.stringify({
          integrationId,
          syncType,
          timestamp: new Date(),
        }),
      }],
    });
  }
}