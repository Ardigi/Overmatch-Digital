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
import { AIAnalyticsService } from '../analytics/ai-analytics.service';
import { PredictionService } from '../prediction/prediction.service';
import { AnomalyDetectionService } from '../anomaly/anomaly-detection.service';

export interface AIEvent {
  id?: string;
  eventType: string;
  modelId?: string;
  organizationId?: string;
  timestamp?: Date;
  version?: number;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, any>;
  payload?: any;
  retryCount?: number;
  source?: string;
}

export interface PredictionRequest {
  id: string;
  modelType: 'risk' | 'compliance' | 'fraud' | 'performance' | 'cost' | 'custom';
  inputData: Record<string, any>;
  features?: string[];
  parameters?: {
    threshold?: number;
    confidence?: number;
    timeHorizon?: number;
  };
}

export interface PredictionResult {
  id: string;
  prediction: any;
  confidence: number;
  explanation?: string[];
  features?: Array<{
    name: string;
    importance: number;
    value: any;
  }>;
  metadata?: Record<string, any>;
}

export interface AnomalyReport {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  description: string;
  affectedEntities: string[];
  detectedAt: Date;
  context: Record<string, any>;
  recommendations?: string[];
}

export interface AIMetrics {
  totalPredictions: number;
  successfulPredictions: number;
  failedPredictions: number;
  averageConfidence: number;
  anomaliesDetected: number;
  modelsActive: number;
  averageResponseTime: number;
  dataPointsProcessed: number;
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
  private readonly activePredictions = new Map<string, PredictionRequest>();
  private readonly modelCache = new Map<string, { model: any; loadedAt: Date }>();
  private readonly aiMetrics: AIMetrics = {
    totalPredictions: 0,
    successfulPredictions: 0,
    failedPredictions: 0,
    averageConfidence: 0,
    anomaliesDetected: 0,
    modelsActive: 0,
    averageResponseTime: 0,
    dataPointsProcessed: 0,
  };
  
  private readonly MESSAGE_DEDUP_TTL = 3600000; // 1 hour
  private readonly MODEL_CACHE_TTL = 1800000; // 30 minutes
  private readonly groupId = 'ai-service-consumer';
  
  private readonly topics = {
    AI_EVENTS: 'ai-events',
    PREDICTION_REQUESTS: 'prediction-requests',
    PREDICTION_RESULTS: 'prediction-results',
    ANOMALY_DETECTION: 'anomaly-detection',
    
    // Source service events for analysis
    AUTH_EVENTS: 'auth-events',
    CLIENT_EVENTS: 'client-events',
    CONTROL_EVENTS: 'control-events',
    POLICY_EVENTS: 'policy-events',
    EVIDENCE_EVENTS: 'evidence-events',
    WORKFLOW_EVENTS: 'workflow-events',
    AUDIT_EVENTS: 'audit-events',
    REPORTING_EVENTS: 'reporting-events',
    INTEGRATION_EVENTS: 'integration-events',
    
    // Analytics and insights
    ANALYTICS_EVENTS: 'analytics-events',
    INSIGHTS_EVENTS: 'insights-events',
    RECOMMENDATIONS: 'ai-recommendations',
    
    // Dead letter queues
    DLQ_AI: 'dlq-ai',
    
    // System monitoring
    SYSTEM_METRICS: 'system-metrics',
    SYSTEM_ALERTS: 'system-alerts',
  };

  constructor(
    private configService: ConfigService,
    private aiAnalyticsService: AIAnalyticsService,
    private predictionService: PredictionService,
    private anomalyDetectionService: AnomalyDetectionService,
  ) {
    if (this.configService.get('DISABLE_KAFKA') === 'true') {
      this.logger.warn('Kafka is disabled - skipping client creation');
      return;
    }

    const brokers = this.configService.get('KAFKA_BROKERS', 'kafka:29092').split(',');

    this.kafka = new Kafka({
      clientId: 'ai-service',
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
      compression: CompressionTypes.Snappy,
      transactionalId: `ai-service-${process.env.POD_NAME || 'local'}`,
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
      timeout: 60000, // Longer timeout for AI predictions
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      name: 'ai-kafka-producer',
      fallback: async (event: AIEvent) => {
        this.logger.warn(`Circuit breaker open - event queued: ${event.eventType}`);
        await this.queueEventForRetry(event);
        return { queued: true };
      },
    };

    this.circuitBreaker = new CircuitBreaker(
      async (event: AIEvent) => this.publishEventInternal(event),
      options
    );

    this.circuitBreaker.on('open', () => {
      this.logger.error('Circuit breaker is now open');
      this.publishSystemAlert('CIRCUIT_BREAKER_OPEN', { service: 'ai-service' });
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

      if (this.configService.get('KAFKA_TRANSACTIONS_ENABLED') === 'true') {
        await this.producer.initTransactions();
      }

      await this.createTopics();
      await this.subscribeToTopics();
      await this.loadAIModels();
      this.startDeduplicationCleanup();
      this.startModelCacheCleanup();
      this.startMetricsCollection();
      this.startAnomalyDetection();

      this.logger.log('Enhanced AI Kafka service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize AI Kafka service', error);
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
        topic: this.topics.AI_EVENTS,
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '2592000000' }, // 30 days
          { name: 'compression.type', value: 'snappy' },
          { name: 'min.insync.replicas', value: '1' },
        ],
      },
      {
        topic: this.topics.PREDICTION_REQUESTS,
        numPartitions: 5,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '604800000' }, // 7 days
          { name: 'compression.type', value: 'snappy' },
        ],
      },
      {
        topic: this.topics.ANOMALY_DETECTION,
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '1209600000' }, // 14 days
          { name: 'compression.type', value: 'snappy' },
        ],
      },
      {
        topic: this.topics.INSIGHTS_EVENTS,
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'retention.ms', value: '7776000000' }, // 90 days
          { name: 'compression.type', value: 'snappy' },
        ],
      },
      {
        topic: this.topics.DLQ_AI,
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
      this.logger.log('AI Kafka topics created/verified');
    } catch (error) {
      this.logger.warn('Topic creation failed (may already exist)', error.message);
    }
  }

  private async subscribeToTopics() {
    const topics = [
      this.topics.PREDICTION_REQUESTS,
      this.topics.AUTH_EVENTS,
      this.topics.CLIENT_EVENTS,
      this.topics.CONTROL_EVENTS,
      this.topics.POLICY_EVENTS,
      this.topics.EVIDENCE_EVENTS,
      this.topics.WORKFLOW_EVENTS,
      this.topics.AUDIT_EVENTS,
      this.topics.REPORTING_EVENTS,
      this.topics.INTEGRATION_EVENTS,
      this.topics.ANALYTICS_EVENTS,
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
      if (topic === this.topics.PREDICTION_REQUESTS) {
        await this.handlePredictionRequest(event);
      } else if (topic === this.topics.ANALYTICS_EVENTS) {
        await this.processAnalyticsEvent(event);
      } else {
        // Process events for anomaly detection and insights
        await this.analyzeEvent(topic, event);
      }

      this.aiMetrics.dataPointsProcessed++;
      return { success: true, processedAt: new Date() };
    } catch (error) {
      this.logger.error(`Error processing message from ${topic}:`, error);
      throw error;
    }
  }

  private async handlePredictionRequest(request: PredictionRequest) {
    const startTime = Date.now();
    this.activePredictions.set(request.id, request);
    this.aiMetrics.totalPredictions++;

    try {
      // Get or load the appropriate model
      const model = await this.getModel(request.modelType);
      
      // Perform prediction
      const result = await this.predictionService.predict(
        model,
        request.inputData,
        request.parameters
      );

      // Calculate feature importance if requested
      if (request.features) {
        result.features = await this.predictionService.calculateFeatureImportance(
          model,
          request.inputData,
          request.features
        );
      }

      // Update metrics
      this.aiMetrics.successfulPredictions++;
      this.updateAverageConfidence(result.confidence);
      this.updateAverageResponseTime(Date.now() - startTime);

      // Publish result
      await this.publishPredictionResult(request.id, result);

      // Check for anomalies in prediction
      if (result.confidence < 0.5) {
        await this.reportAnomaly({
          id: uuidv4(),
          type: 'low_confidence_prediction',
          severity: 'medium',
          score: 1 - result.confidence,
          description: `Low confidence prediction for ${request.modelType}`,
          affectedEntities: [request.id],
          detectedAt: new Date(),
          context: { request, result },
        });
      }

    } catch (error) {
      this.aiMetrics.failedPredictions++;
      this.logger.error(`Prediction failed for request ${request.id}`, error);
      
      await this.publishPredictionResult(request.id, {
        id: request.id,
        prediction: null,
        confidence: 0,
        explanation: [`Error: ${error.message}`],
      });
      
      throw error;
    } finally {
      this.activePredictions.delete(request.id);
    }
  }

  private async processAnalyticsEvent(event: any) {
    try {
      // Perform analytics
      const insights = await this.aiAnalyticsService.generateInsights(event);
      
      if (insights && insights.length > 0) {
        await this.publishEvent({
          eventType: 'insights.generated',
          payload: insights,
          metadata: {
            sourceEvent: event.id,
            generatedAt: new Date(),
          },
        });
      }

      // Generate recommendations if applicable
      const recommendations = await this.aiAnalyticsService.generateRecommendations(event);
      
      if (recommendations && recommendations.length > 0) {
        await this.producer.send({
          topic: this.topics.RECOMMENDATIONS,
          messages: [{
            key: event.organizationId || uuidv4(),
            value: JSON.stringify({
              organizationId: event.organizationId,
              recommendations,
              context: event,
              timestamp: new Date(),
            }),
          }],
        });
      }
    } catch (error) {
      this.logger.error('Failed to process analytics event', error);
      throw error;
    }
  }

  private async analyzeEvent(topic: string, event: any) {
    try {
      // Check for anomalies
      const anomaly = await this.anomalyDetectionService.detectAnomaly(topic, event);
      
      if (anomaly) {
        this.aiMetrics.anomaliesDetected++;
        await this.reportAnomaly(anomaly);
      }

      // Extract patterns and trends
      const patterns = await this.aiAnalyticsService.extractPatterns(topic, event);
      
      if (patterns && patterns.length > 0) {
        await this.publishEvent({
          eventType: 'patterns.detected',
          payload: patterns,
          metadata: {
            source: topic,
            eventId: event.id,
          },
        });
      }

      // Update time series data for forecasting
      await this.aiAnalyticsService.updateTimeSeries(topic, event);

    } catch (error) {
      this.logger.error(`Failed to analyze event from ${topic}`, error);
      throw error;
    }
  }

  private async getModel(modelType: string): Promise<any> {
    const cached = this.modelCache.get(modelType);
    
    if (cached && Date.now() - cached.loadedAt.getTime() < this.MODEL_CACHE_TTL) {
      return cached.model;
    }

    const model = await this.predictionService.loadModel(modelType);
    this.modelCache.set(modelType, {
      model,
      loadedAt: new Date(),
    });

    return model;
  }

  private async loadAIModels() {
    try {
      const modelTypes = ['risk', 'compliance', 'fraud', 'performance', 'cost'];
      
      for (const modelType of modelTypes) {
        try {
          await this.getModel(modelType);
          this.aiMetrics.modelsActive++;
        } catch (error) {
          this.logger.warn(`Failed to load model: ${modelType}`, error.message);
        }
      }
      
      this.logger.log(`Loaded ${this.aiMetrics.modelsActive} AI models`);
    } catch (error) {
      this.logger.error('Failed to load AI models', error);
    }
  }

  private async reportAnomaly(anomaly: AnomalyReport) {
    await this.producer.send({
      topic: this.topics.ANOMALY_DETECTION,
      messages: [{
        key: anomaly.id,
        value: JSON.stringify(anomaly),
      }],
    });

    // Send alert for high severity anomalies
    if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
      await this.publishSystemAlert('ANOMALY_DETECTED', anomaly);
    }
  }

  private async publishPredictionResult(requestId: string, result: PredictionResult) {
    await this.producer.send({
      topic: this.topics.PREDICTION_RESULTS,
      messages: [{
        key: requestId,
        value: JSON.stringify({
          ...result,
          timestamp: new Date(),
        }),
      }],
    });
  }

  private updateAverageConfidence(confidence: number) {
    const total = this.aiMetrics.successfulPredictions;
    this.aiMetrics.averageConfidence = 
      (this.aiMetrics.averageConfidence * (total - 1) + confidence) / total;
  }

  private updateAverageResponseTime(responseTime: number) {
    const total = this.aiMetrics.totalPredictions;
    this.aiMetrics.averageResponseTime = 
      (this.aiMetrics.averageResponseTime * (total - 1) + responseTime) / total;
  }

  async publishEvent(event: AIEvent): Promise<void> {
    if (this.configService.get('DISABLE_KAFKA') === 'true') {
      return;
    }

    const enrichedEvent: AIEvent = {
      ...event,
      id: event.id || uuidv4(),
      timestamp: event.timestamp || new Date(),
      version: event.version || 1,
      correlationId: event.correlationId || uuidv4(),
      source: 'ai-service',
      retryCount: event.retryCount || 0,
    };

    try {
      await this.circuitBreaker.fire(enrichedEvent);
    } catch (error) {
      this.logger.error(`Failed to publish event: ${event.eventType}`, error);
    }
  }

  private async publishEventInternal(event: AIEvent): Promise<RecordMetadata[]> {
    return await this.producer.send({
      topic: this.topics.AI_EVENTS,
      messages: [{
        key: event.modelId || event.id,
        value: JSON.stringify(event),
        headers: this.createMessageHeaders(event),
      }],
    });
  }

  private createMessageHeaders(event: AIEvent): Record<string, string> {
    return {
      'correlation-id': event.correlationId || uuidv4(),
      'causation-id': event.causationId || '',
      'event-type': event.eventType,
      'event-version': String(event.version || 1),
      'source-service': 'ai-service',
      'timestamp': new Date().toISOString(),
    };
  }

  private async sendToDeadLetterQueue(payload: EachMessagePayload): Promise<void> {
    try {
      await this.producer.send({
        topic: this.topics.DLQ_AI,
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

  private async queueEventForRetry(event: AIEvent): Promise<void> {
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

  private startModelCacheCleanup(): void {
    setInterval(() => {
      const cutoffTime = Date.now() - this.MODEL_CACHE_TTL;
      for (const [type, cached] of this.modelCache.entries()) {
        if (cached.loadedAt.getTime() < cutoffTime) {
          this.modelCache.delete(type);
          this.aiMetrics.modelsActive--;
        }
      }
    }, this.MODEL_CACHE_TTL / 2);
  }

  private startMetricsCollection(): void {
    setInterval(async () => {
      await this.publishMetric('ai.metrics', this.aiMetrics);
    }, 60000);
  }

  private startAnomalyDetection(): void {
    setInterval(async () => {
      // Perform periodic anomaly detection on metrics
      const metricsAnomaly = await this.anomalyDetectionService.analyzeMetrics(this.aiMetrics);
      
      if (metricsAnomaly) {
        await this.reportAnomaly(metricsAnomaly);
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
            service: 'ai-service',
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
            service: 'ai-service',
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

  getAIMetrics(): AIMetrics {
    return { ...this.aiMetrics };
  }

  getActivePredictions(): PredictionRequest[] {
    return Array.from(this.activePredictions.values());
  }

  async requestPrediction(request: PredictionRequest): Promise<string> {
    const requestId = request.id || uuidv4();
    
    await this.producer.send({
      topic: this.topics.PREDICTION_REQUESTS,
      messages: [{
        key: requestId,
        value: JSON.stringify({
          ...request,
          id: requestId,
          timestamp: new Date(),
        }),
      }],
    });

    return requestId;
  }
}