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

export interface SyncConfig {
  entities: string[];
  mode: 'full' | 'incremental' | 'delta';
  batchSize?: number;
  filters?: Record<string, any>;
  options?: Record<string, any>;
}

export interface ScheduleStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDuration: number;
  lastErrorMessage?: string;
}

@Entity('sync_schedules')
@Index(['integrationId', 'name'], { unique: true })
@Index(['organizationId', 'enabled'])
@Index(['enabled', 'nextRunAt'])
export class SyncSchedule {
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
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column()
  cronExpression: string;

  @Column({ default: 'UTC' })
  timezone: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'jsonb' })
  syncConfig: SyncConfig;

  @Column({ nullable: true })
  lastRunAt?: Date;

  @Column({ nullable: true })
  nextRunAt?: Date;

  @Column({ type: 'jsonb', default: '{}' })
  stats: ScheduleStats;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
