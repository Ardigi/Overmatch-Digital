import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  type CollectionResult,
  type CollectorConfig,
  CollectorStatus,
  type CollectorType,
  type EvidenceData,
  type IEvidenceCollector,
} from './collector.interface';

export abstract class BaseEvidenceCollector implements IEvidenceCollector {
  protected readonly logger: Logger;
  protected config: CollectorConfig;
  protected status: CollectorStatus = CollectorStatus.NOT_CONFIGURED;
  protected lastRun: Date | null = null;
  protected nextRun: Date | null = null;

  constructor(
    public readonly type: CollectorType,
    public readonly name: string,
    protected readonly eventEmitter: EventEmitter2
  ) {
    this.logger = new Logger(`${this.constructor.name}`);
  }

  async configure(config: CollectorConfig): Promise<void> {
    this.config = config;

    // Validate configuration
    const isValid = await this.validateConfig(config);
    if (!isValid) {
      this.status = CollectorStatus.ERROR;
      throw new Error(`Invalid configuration for ${this.name} collector`);
    }

    // Test connection
    const canConnect = await this.testConnection();
    if (!canConnect) {
      this.status = CollectorStatus.ERROR;
      throw new Error(`Cannot connect to ${this.name}`);
    }

    this.status = CollectorStatus.CONFIGURED;
    this.logger.log(`${this.name} collector configured successfully`);

    await this.eventEmitter.emit('collector.configured', {
      type: this.type,
      name: this.name,
      config: this.sanitizeConfig(config),
    });
  }

  async validate(): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    return await this.validateConfig(this.config);
  }

  async collect(): Promise<CollectionResult> {
    if (this.status !== CollectorStatus.CONFIGURED && this.status !== CollectorStatus.ACTIVE) {
      throw new Error(`${this.name} collector is not properly configured`);
    }

    this.status = CollectorStatus.ACTIVE;
    const startTime = Date.now();
    const result: CollectionResult = {
      success: false,
      evidenceCount: 0,
      errors: [],
      warnings: [],
      metadata: {},
    };

    try {
      this.logger.log(`Starting evidence collection for ${this.name}`);

      await this.eventEmitter.emit('collector.started', {
        type: this.type,
        name: this.name,
        startTime: new Date(),
      });

      // Perform the actual collection
      const evidence = await this.performCollection();
      result.evidenceCount = evidence.length;
      result.success = true;

      // Process each piece of evidence
      for (const item of evidence) {
        await this.processEvidence(item);
      }

      this.lastRun = new Date();

      // Calculate next run if scheduled
      if (this.config.schedule) {
        this.nextRun = this.calculateNextRun(this.config.schedule);
        result.nextRun = this.nextRun;
      }
    } catch (error) {
      this.logger.error(`Error collecting evidence from ${this.name}:`, error);
      result.success = false;
      result.errors?.push(error.message);
      this.status = CollectorStatus.ERROR;
    } finally {
      result.duration = Date.now() - startTime;

      await this.eventEmitter.emit('collector.completed', {
        type: this.type,
        name: this.name,
        result,
        endTime: new Date(),
      });
    }

    return result;
  }

  getStatus(): CollectorStatus {
    return this.status;
  }

  getLastRun(): Date | null {
    return this.lastRun;
  }

  getNextRun(): Date | null {
    return this.nextRun;
  }

  // Abstract methods to be implemented by specific collectors
  protected abstract validateConfig(config: CollectorConfig): Promise<boolean>;
  protected abstract performCollection(): Promise<EvidenceData[]>;
  abstract testConnection(): Promise<boolean>;

  // Helper methods
  protected sanitizeConfig(config: CollectorConfig): CollectorConfig {
    const sanitized = { ...config };

    // Remove sensitive credentials
    if (sanitized.credentials) {
      sanitized.credentials = Object.keys(sanitized.credentials).reduce(
        (acc, key) => {
          acc[key] = '***REDACTED***';
          return acc;
        },
        {} as Record<string, any>
      );
    }

    return sanitized;
  }

  protected async processEvidence(evidence: EvidenceData): Promise<void> {
    await this.eventEmitter.emit('evidence.collected', {
      collectorType: this.type,
      collectorName: this.name,
      evidence,
      timestamp: new Date(),
    });
  }

  protected calculateNextRun(cronExpression: string): Date {
    // Simple implementation - in production would use a cron parser
    // For now, assume daily collection
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  protected async handleError(error: Error, context: string): Promise<void> {
    this.logger.error(`Error in ${context}:`, error);

    await this.eventEmitter.emit('collector.error', {
      type: this.type,
      name: this.name,
      error: error.message,
      context,
      timestamp: new Date(),
    });
  }
}
