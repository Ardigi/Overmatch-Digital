import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum RemediationPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum RemediationStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
}

export enum RemediationType {
  TECHNICAL = 'technical',
  PROCESS = 'process',
  POLICY = 'policy',
  TRAINING = 'training',
  DOCUMENTATION = 'documentation',
}

export interface EstimatedEffort {
  hours: number;
  complexity: 'low' | 'medium' | 'high' | 'very_high';
  resources?: number;
  cost?: number;
}

export interface ActualEffort {
  hours: number;
  percentComplete: number;
  startedAt?: Date;
  lastUpdatedAt?: Date;
}

export interface RemediationMetadata {
  category?: string;
  framework?: string;
  controlsAddressed?: string[];
  riskScore?: number;
  confidenceScore?: number;
  automationPossible?: boolean;
  dependencies?: string[];
  [key: string]: any;
}

export interface RemediationStep {
  order: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completedAt?: Date;
  completedBy?: string;
  notes?: string;
}

@Entity('remediations')
@Index(['organizationId', 'clientId'])
@Index(['status', 'priority'])
@Index(['assignedTo'])
@Index(['dueDate'])
@Index(['createdAt'])
export class Remediation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  organizationId: string;

  @Column('uuid')
  @Index()
  clientId: string;

  @Column('uuid', { nullable: true })
  @Index()
  findingId: string;

  @Column('varchar', { length: 255 })
  title: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: RemediationType,
    default: RemediationType.TECHNICAL,
  })
  type: RemediationType;

  @Column({
    type: 'enum',
    enum: RemediationPriority,
  })
  priority: RemediationPriority;

  @Column({
    type: 'enum',
    enum: RemediationStatus,
    default: RemediationStatus.DRAFT,
  })
  status: RemediationStatus;

  @Column('uuid', { nullable: true })
  assignedTo: string;

  @Column('timestamp', { nullable: true })
  dueDate: Date;

  @Column('jsonb', { nullable: true })
  estimatedEffort: EstimatedEffort;

  @Column('jsonb', { nullable: true })
  actualEffort: ActualEffort;

  @Column('jsonb', { nullable: true })
  steps: RemediationStep[];

  @Column('jsonb', { nullable: true })
  metadata: RemediationMetadata;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column('text', { nullable: true })
  notes: string;

  @Column('uuid', { nullable: true })
  createdBy: string;

  @Column('uuid', { nullable: true })
  approvedBy: string;

  @Column('timestamp', { nullable: true })
  approvedAt: Date;

  @Column('timestamp', { nullable: true })
  completedAt: Date;

  @Column('text', { nullable: true })
  completionNotes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
