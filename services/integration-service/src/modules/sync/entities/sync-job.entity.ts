import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Integration } from '../../integrations/entities/integration.entity';

export type SyncJobType = 'full_sync' | 'incremental_sync' | 'delta_sync' | 'custom';
export type SyncJobStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export interface SyncProgress {
  current: number;
  total: number;
  percentage: number;
}

export interface EntitySyncStatus {
  entityType: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  processed: number;
  created?: number;
  updated?: number;
  deleted?: number;
  errors?: number;
  errorDetails?: string[];
}

export interface SyncJobConfig {
  batchSize?: number;
  parallel?: boolean;
  retryFailures?: boolean;
  continueOnError?: boolean;
  filters?: Record<string, any>;
  customOptions?: Record<string, any>;
}

export interface SyncJobMetadata {
  triggeredBy?: string;
  scheduleId?: string;
  reason?: string;
  version?: string;
  retriedFrom?: string;
  customMetadata?: Record<string, any>;
}

@Entity('sync_jobs')
@Index(['integrationId', 'createdAt'])
@Index(['organizationId', 'status'])
@Index(['status', 'nextRunAt'])
@Index(['scheduleId'])
export class SyncJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  integrationId: string;

  @ManyToOne(() => Integration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'integrationId' })
  integration: Integration;

  @Column()
  @Index()
  organizationId: string;

  @Column()
  jobType: SyncJobType;

  @Column({
    type: 'enum',
    enum: ['pending', 'queued', 'running', 'completed', 'failed', 'cancelled', 'paused'],
    default: 'pending',
  })
  status: SyncJobStatus;

  @Column({ nullable: true })
  startedAt?: Date;

  @Column({ nullable: true })
  completedAt?: Date;

  @Column({ nullable: true })
  duration?: number; // in milliseconds

  @Column({ type: 'jsonb', default: '{"current": 0, "total": 0, "percentage": 0}' })
  progress: SyncProgress;

  @Column({ type: 'jsonb', default: '[]' })
  entities: EntitySyncStatus[];

  @Column({ type: 'jsonb', nullable: true })
  config?: SyncJobConfig;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: SyncJobMetadata;

  @Column({ nullable: true })
  nextRunAt?: Date;

  @Column({ nullable: true })
  scheduleId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  syncType?: string;

  @Column({ default: 0 })
  entitiesSynced: number;
}
