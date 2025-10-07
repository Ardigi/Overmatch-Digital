import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { WorkflowInstance } from './workflow-instance.entity';
import { WorkflowStep } from './workflow-step.entity';

export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number; // seconds
  backoffMultiplier?: number;
}

export interface WorkflowTriggers {
  manual?: boolean;
  events?: string[];
  schedule?: string; // cron expression
  webhook?: boolean;
}

@Entity('workflows')
@Index(['organizationId', 'status'])
@Index(['organizationId', 'category'])
@Index(['organizationId', 'name'], { unique: true })
export class Workflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  organizationId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  category?: string;

  @Column({ type: 'int', default: 1 })
  @VersionColumn()
  version: number;

  @Column({
    type: 'enum',
    enum: WorkflowStatus,
    default: WorkflowStatus.DRAFT,
  })
  status: WorkflowStatus;

  @Column({ default: false })
  isDraft: boolean;

  @Column({ default: false })
  isTemplate: boolean;

  @Column({ type: 'int', nullable: true })
  maxExecutionTime?: number; // seconds

  @Column({ type: 'jsonb', nullable: true })
  retryConfig?: RetryConfig;

  @Column({ type: 'jsonb', nullable: true })
  triggers?: WorkflowTriggers;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column()
  createdBy: string;

  @Column({ nullable: true })
  modifiedBy?: string;

  @Column({ nullable: true })
  archivedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  archivedAt?: Date;

  @Column({ type: 'text', nullable: true })
  archiveReason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(
    () => WorkflowStep,
    (step) => step.workflow,
    { cascade: true }
  )
  steps: WorkflowStep[];

  @OneToMany(
    () => WorkflowInstance,
    (instance) => instance.workflow
  )
  instances: WorkflowInstance[];

  // Helper methods
  get canExecute(): boolean {
    return this.status === WorkflowStatus.ACTIVE && !this.isDraft;
  }

  canUserExecute(userId: string, userRoles: string[]): boolean {
    // Implement role-based access control
    // For now, return true - can be extended based on requirements
    return true;
  }

  validateInputs(inputs: Record<string, any>): boolean {
    // Implement input validation logic
    // For now, return true - can be extended based on requirements
    return true;
  }

  validateStep(stepId: string): boolean {
    // Validate if step exists in workflow
    return this.steps?.some((step) => step.id === stepId) || false;
  }
}
