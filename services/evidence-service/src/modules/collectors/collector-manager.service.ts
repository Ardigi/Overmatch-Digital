import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import { Repository } from 'typeorm';
import type { CreateEvidenceDto } from '../evidence/dto/create-evidence.dto';
import { Evidence } from '../evidence/entities/evidence.entity';
import type { EvidenceService } from '../evidence/evidence.service';
import { AWSCollector } from './aws/aws.collector';
import { AzureCollector } from './azure/azure.collector';
import {
  type CollectionResult,
  type CollectorConfig,
  CollectorStatus,
  type CollectorType,
  EvidenceData,
  type IEvidenceCollector,
} from './base/collector.interface';
import { GitHubCollector } from './github/github.collector';

interface CollectorRegistration {
  collector: IEvidenceCollector;
  config: CollectorConfig;
  lastRun?: Date;
  nextRun?: Date;
  status: CollectorStatus;
}

@Injectable()
export class CollectorManagerService implements OnModuleInit {
  private readonly logger = new Logger(CollectorManagerService.name);
  private collectors = new Map<string, CollectorRegistration>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly evidenceService: EvidenceService,
    @InjectRepository(Evidence)
    private readonly evidenceRepository: Repository<Evidence>,
    private readonly serviceDiscovery: ServiceDiscoveryService,
  ) {}

  async onModuleInit() {
    // Initialize collectors
    await this.initializeCollectors();

    // Listen for evidence collection events
    this.eventEmitter.on('evidence.collected', async (event) => {
      await this.handleCollectedEvidence(event);
    });

    this.eventEmitter.on('collector.error', async (event) => {
      await this.handleCollectorError(event);
    });
  }

  private async initializeCollectors() {
    this.logger.log('Initializing evidence collectors...');

    // Register available collectors
    const availableCollectors = [
      new AWSCollector(this.eventEmitter),
      new AzureCollector(this.eventEmitter),
      new GitHubCollector(this.eventEmitter),
    ];

    for (const collector of availableCollectors) {
      this.collectors.set(collector.type, {
        collector,
        config: {
          type: collector.type,
          name: collector.name,
          enabled: false,
        },
        status: CollectorStatus.NOT_CONFIGURED,
      });
    }

    this.logger.log(`Registered ${this.collectors.size} collectors`);
  }

  async configureCollector(type: CollectorType, config: CollectorConfig): Promise<void> {
    const registration = this.collectors.get(type);
    if (!registration) {
      throw new Error(`Unknown collector type: ${type}`);
    }

    try {
      await registration.collector.configure(config);
      registration.config = config;
      registration.status = CollectorStatus.CONFIGURED;

      this.logger.log(`Configured ${type} collector successfully`);

      // If scheduled, calculate next run
      if (config.schedule) {
        registration.nextRun = this.calculateNextRun(config.schedule);
      }
    } catch (error) {
      this.logger.error(`Failed to configure ${type} collector:`, error);
      registration.status = CollectorStatus.ERROR;
      throw error;
    }
  }

  async runCollector(type: CollectorType): Promise<CollectionResult> {
    const registration = this.collectors.get(type);
    if (!registration) {
      throw new Error(`Unknown collector type: ${type}`);
    }

    if (registration.status !== CollectorStatus.CONFIGURED &&
        registration.status !== CollectorStatus.ACTIVE) {
      throw new Error(`Collector ${type} is not configured`);
    }

    this.logger.log(`Running ${type} collector...`);

    try {
      const result = await registration.collector.collect();
      registration.lastRun = new Date();
      
      if (registration.config?.schedule) {
        registration.nextRun = this.calculateNextRun(registration.config.schedule);
      }

      this.logger.log(`${type} collector completed: ${result.evidenceCount} items collected`);
      
      // Notify about collection completion
      try {
        await this.notifyCollectionComplete(type, result);
      } catch (error) {
        this.logger.warn('Failed to send collection completion notification:', error.message);
      }
      
      // Trigger workflow if significant collection
      if (result.evidenceCount > 0) {
        try {
          await this.triggerCollectionWorkflow(type, result);
        } catch (error) {
          this.logger.warn('Failed to trigger collection workflow:', error.message);
        }
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Error running ${type} collector:`, error);
      registration.status = CollectorStatus.ERROR;
      throw error;
    }
  }

  async runAllCollectors(): Promise<Map<CollectorType, CollectionResult>> {
    const results = new Map<CollectorType, CollectionResult>();

    for (const [type, registration] of this.collectors) {
      if (registration.status === CollectorStatus.CONFIGURED ||
          registration.status === CollectorStatus.ACTIVE) {
        try {
          const result = await this.runCollector(type as CollectorType);
          results.set(type as CollectorType, result);
        } catch (error) {
          this.logger.error(`Failed to run ${type} collector:`, error);
          results.set(type as CollectorType, {
            success: false,
            evidenceCount: 0,
            errors: [error.message],
          });
        }
      }
    }

    return results;
  }

  async getCollectorStatus(): Promise<any[]> {
    const status = [];

    for (const [type, registration] of this.collectors) {
      status.push({
        type,
        name: registration.collector.name,
        status: registration.status,
        configured: registration.config !== null,
        enabled: registration.config?.enabled || false,
        lastRun: registration.lastRun,
        nextRun: registration.nextRun,
      });
    }

    return status;
  }

  async testCollectorConnection(type: CollectorType): Promise<boolean> {
    const registration = this.collectors.get(type);
    if (!registration) {
      throw new Error(`Unknown collector type: ${type}`);
    }

    return await registration.collector.testConnection();
  }

  // Scheduled collection
  @Cron(CronExpression.EVERY_HOUR)
  async runScheduledCollections() {
    const now = new Date();

    for (const [type, registration] of this.collectors) {
      if (registration.config?.enabled && 
          registration.config?.schedule &&
          registration.nextRun &&
          registration.nextRun <= now) {
        try {
          await this.runCollector(type as CollectorType);
        } catch (error) {
          this.logger.error(`Scheduled collection failed for ${type}:`, error);
        }
      }
    }
  }

  // Event handlers
  private async handleCollectedEvidence(event: any) {
    const { collectorType, collectorName, evidence, timestamp } = event;

    try {
      // Create evidence record with proper typing
      const createEvidenceDto: CreateEvidenceDto & { createdBy: string } = {
        title: evidence.title,
        description: evidence.description,
        type: evidence.type,
        source: evidence.source,
        fileName: evidence.fileName || evidence.title,
        fileSize: evidence.fileSize || 0,
        mimeType: evidence.mimeType || 'application/octet-stream',
        collectedBy: 'system',
        clientId: evidence.clientId || this.getOrganizationId(),
        collectorType,
        metadata: {
          ...evidence.metadata,
          customFields: {
            category: evidence.category,
            sourceSystem: evidence.sourceSystem,
            content: evidence.content,
            collectorType,
            collectorName,
            collectionTimestamp: timestamp,
          },
        },
        tags: evidence.tags,
        expirationDate: evidence.expirationDate,
        createdBy: 'system',
      };
      
      const evidenceEntity = await this.evidenceService.create(createEvidenceDto);

      this.logger.log(`Created evidence: ${evidenceEntity.id} from ${collectorType}`);

      // Emit event for downstream processing
      await this.eventEmitter.emit('evidence.created.from.collector', {
        evidenceId: evidenceEntity.id,
        collectorType,
        timestamp,
      });
      
      // Notify about evidence collection
      try {
        await this.notifyEvidenceCollected(evidenceEntity.id, evidenceEntity.title, collectorType);
      } catch (error) {
        this.logger.warn('Failed to send evidence collection notification:', error.message);
      }
    } catch (error) {
      this.logger.error(`Failed to create evidence from ${collectorType}:`, error);
      
      await this.eventEmitter.emit('evidence.creation.failed', {
        collectorType,
        evidence,
        error: error.message,
        timestamp,
      });
    }
  }

  private async handleCollectorError(event: any) {
    const { type, name, error, context, timestamp } = event;

    this.logger.error(`Collector error from ${type}: ${error} (Context: ${context})`);

    // Update collector status
    const registration = this.collectors.get(type);
    if (registration) {
      registration.status = CollectorStatus.ERROR;
    }

    // Store error for analysis
    await this.eventEmitter.emit('collector.error.logged', {
      type,
      name,
      error,
      context,
      timestamp,
    });
  }

  private calculateNextRun(cronExpression: string): Date {
    // Simple implementation - in production would use cron parser
    const next = new Date();
    
    // Parse common expressions
    switch (cronExpression) {
      case '@daily':
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
        break;
      case '@hourly':
        next.setHours(next.getHours() + 1);
        next.setMinutes(0, 0, 0);
        break;
      case '@weekly':
        next.setDate(next.getDate() + 7);
        next.setHours(0, 0, 0, 0);
        break;
      default:
        // Default to daily
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
    }

    return next;
  }

  private getOrganizationId(): string {
    // In production, would get from context or configuration
    return 'default-org-id';
  }

  // Collector metrics
  async getCollectorMetrics(): Promise<{
    totalCollectors: number;
    configuredCollectors: number;
    activeCollectors: number;
    errorCollectors: number;
    totalEvidenceCollected: number;
    collectionsByType: Record<string, number>;
    recentCollections: Array<{
      collectorType: string;
      timestamp: Date;
      status: string;
      evidenceCount?: number;
    }>;
  }> {
    const metrics = {
      totalCollectors: this.collectors.size,
      configuredCollectors: 0,
      activeCollectors: 0,
      errorCollectors: 0,
      totalEvidenceCollected: 0,
      collectionsByType: {} as Record<string, number>,
      recentCollections: [] as Array<{
        collectorType: string;
        timestamp: Date;
        status: string;
        evidenceCount?: number;
      }>,
    };

    for (const [type, registration] of this.collectors) {
      if (registration.status === CollectorStatus.CONFIGURED) metrics.configuredCollectors++;
      if (registration.status === CollectorStatus.ACTIVE) metrics.activeCollectors++;
      if (registration.status === CollectorStatus.ERROR) metrics.errorCollectors++;

      // Get evidence count by collector type
      const count = await this.evidenceRepository.count({
        where: {
          collectorType: type,
        },
      });
      metrics.collectionsByType[type] = count;
      metrics.totalEvidenceCollected += count;

      // Add recent collection info
      if (registration.lastRun) {
        metrics.recentCollections.push({
          collectorType: type,
          timestamp: registration.lastRun,
          status: registration.status,
          evidenceCount: count,
        });
      }
    }

    // Sort recent collections by timestamp
    metrics.recentCollections.sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );

    return metrics;
  }

  // Service Discovery Methods

  /**
   * Notify about evidence collected by automated collector
   */
  private async notifyEvidenceCollected(evidenceId: string, evidenceTitle: string, collectorType: string): Promise<void> {
    try {
      await this.serviceDiscovery.callService(
        'notification-service',
        'POST',
        '/notifications',
        {
          type: 'evidence.collected',
          title: 'Evidence Collected Automatically',
          message: `Evidence "${evidenceTitle}" was collected by ${collectorType} collector`,
          data: {
            evidenceId,
            evidenceTitle,
            collectorType,
            timestamp: new Date().toISOString()
          },
          priority: 'low',
          channels: ['in-app']
        }
      );
    } catch (error) {
      this.logger.error('Failed to send evidence collection notification:', error);
      throw error;
    }
  }

  /**
   * Notify about collection batch completion
   */
  private async notifyCollectionComplete(collectorType: string, result: CollectionResult): Promise<void> {
    try {
      await this.serviceDiscovery.callService(
        'notification-service',
        'POST',
        '/notifications',
        {
          type: 'collection.completed',
          title: 'Evidence Collection Complete',
          message: `${collectorType} collector completed: ${result.evidenceCount} items collected`,
          data: {
            collectorType,
            evidenceCount: result.evidenceCount,
            success: result.success,
            errors: result.errors || [],
            timestamp: new Date().toISOString()
          },
          priority: result.success ? 'medium' : 'high',
          channels: result.success ? ['in-app'] : ['email', 'in-app']
        }
      );
    } catch (error) {
      this.logger.error('Failed to send collection completion notification:', error);
      throw error;
    }
  }

  /**
   * Trigger workflow for evidence collection processing
   */
  private async triggerCollectionWorkflow(collectorType: string, result: CollectionResult): Promise<void> {
    try {
      await this.serviceDiscovery.callService(
        'workflow-service',
        'POST',
        '/workflows/evidence-collection-processing',
        {
          collectorType,
          evidenceCount: result.evidenceCount,
          collectionSuccess: result.success,
          errors: result.errors || [],
          timestamp: new Date().toISOString(),
          metadata: {
            trigger: 'collection.completed',
            source: 'evidence-service',
            collector: collectorType
          }
        }
      );
    } catch (error) {
      this.logger.error('Failed to trigger collection workflow:', error);
      throw error;
    }
  }
}