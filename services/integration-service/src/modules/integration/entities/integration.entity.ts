import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

export enum IntegrationType {
  SALESFORCE = 'salesforce',
  GITHUB = 'github',
  JIRA = 'jira',
  SLACK = 'slack',
  TEAMS = 'teams',
  AWS = 'aws',
  AZURE = 'azure',
  GCP = 'gcp',
  OKTA = 'okta',
  SPLUNK = 'splunk',
  DATADOG = 'datadog',
  WEBHOOK = 'webhook',
  REST_API = 'rest_api',
  GRAPHQL = 'graphql',
  DATABASE = 'database',
  FILE_SYSTEM = 'file_system',
  CUSTOM = 'custom',
}

export enum IntegrationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  ERROR = 'error',
  SUSPENDED = 'suspended',
}

export enum SyncFrequency {
  REALTIME = 'realtime',
  EVERY_5_MINUTES = 'every_5_minutes',
  EVERY_15_MINUTES = 'every_15_minutes',
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  MANUAL = 'manual',
}

export interface IntegrationConfig {
  endpoint?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  authentication?: {
    type: string;
    credentials?: Record<string, any>;
  };
  transformationRules?: Record<string, any>;
  mappingRules?: Record<string, any>;
  filterRules?: Record<string, any>;
  storage?: {
    type: string;
    location?: string;
    format?: string;
  };
  forwarding?: Array<{
    service: string;
    eventTypes?: string[];
    transform?: boolean;
  }>;
  retryPolicy?: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
  rateLimiting?: {
    requestsPerMinute: number;
    requestsPerHour: number;
    concurrentRequests: number;
  };
  customFields?: Record<string, any>;
}

export interface IntegrationMetadata {
  lastSyncAt?: Date;
  lastSyncStatus?: string;
  lastSyncRecords?: number;
  totalRecordsSynced?: number;
  totalErrors?: number;
  averageSyncTime?: number;
  healthScore?: number;
  version?: string;
  tags?: string[];
}

@Entity('integrations')
@Index(['organizationId', 'type'])
@Index(['status'])
@Index(['createdAt'])
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  organizationId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: IntegrationType,
  })
  type: IntegrationType;

  @Column({
    type: 'enum',
    enum: IntegrationStatus,
    default: IntegrationStatus.PENDING,
  })
  status: IntegrationStatus;

  @Column({
    type: 'enum',
    enum: SyncFrequency,
    default: SyncFrequency.MANUAL,
  })
  syncFrequency: SyncFrequency;

  @Column({ type: 'jsonb' })
  config: IntegrationConfig;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: IntegrationMetadata;

  @Column({ type: 'simple-array', nullable: true })
  subscribedEvents?: string[];

  @Column({ type: 'simple-array', nullable: true })
  publishedEvents?: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastHealthCheck?: Date;

  @Column({ nullable: true })
  lastError?: string;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;

  // Validation methods
  isHealthy(): boolean {
    if (this.status !== IntegrationStatus.ACTIVE) return false;
    if (this.lastError) return false;
    if (this.metadata?.healthScore && this.metadata.healthScore < 70) return false;
    return true;
  }

  needsSync(): boolean {
    if (this.syncFrequency === SyncFrequency.MANUAL) return false;
    if (!this.metadata?.lastSyncAt) return true;

    const now = Date.now();
    const lastSync = this.metadata.lastSyncAt.getTime();
    const diff = now - lastSync;

    switch (this.syncFrequency) {
      case SyncFrequency.REALTIME:
        return false; // Handled by webhooks
      case SyncFrequency.EVERY_5_MINUTES:
        return diff > 5 * 60 * 1000;
      case SyncFrequency.EVERY_15_MINUTES:
        return diff > 15 * 60 * 1000;
      case SyncFrequency.HOURLY:
        return diff > 60 * 60 * 1000;
      case SyncFrequency.DAILY:
        return diff > 24 * 60 * 60 * 1000;
      case SyncFrequency.WEEKLY:
        return diff > 7 * 24 * 60 * 60 * 1000;
      case SyncFrequency.MONTHLY:
        return diff > 30 * 24 * 60 * 60 * 1000;
      default:
        return false;
    }
  }

  updateHealthScore(): void {
    let score = 100;

    // Reduce score based on errors
    if (this.metadata?.totalErrors) {
      const errorRate = this.metadata.totalErrors / (this.metadata.totalRecordsSynced || 1);
      score -= Math.min(errorRate * 100, 30);
    }

    // Reduce score based on last sync status
    if (this.metadata?.lastSyncStatus === 'failed') {
      score -= 20;
    } else if (this.metadata?.lastSyncStatus === 'partial') {
      score -= 10;
    }

    // Reduce score if no recent sync
    if (this.needsSync()) {
      score -= 15;
    }

    // Reduce score if last health check is old
    if (this.lastHealthCheck) {
      const hoursSinceCheck = (Date.now() - this.lastHealthCheck.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCheck > 24) {
        score -= 10;
      }
    }

    this.metadata = {
      ...this.metadata,
      healthScore: Math.max(0, Math.min(100, score)),
    };
  }
}