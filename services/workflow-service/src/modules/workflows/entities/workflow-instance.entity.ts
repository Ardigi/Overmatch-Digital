import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Workflow } from './workflow.entity';
import { WorkflowStepExecution } from './workflow-step-execution.entity';

export enum InstanceStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

export interface InstanceContext {
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  variables: Record<string, any>;
  metadata: Record<string, any>;
  userId?: string;
  organizationId?: string;
  clientId?: string;
  correlationId?: string;
}

export interface TriggerInfo {
  type: 'manual' | 'event' | 'schedule' | 'webhook';
  user?: string;
  event?: string;
  schedule?: string;
  source?: string;
}

@Entity('workflow_instances')
@Index(['organizationId', 'status'])
@Index(['workflowId', 'status'])
@Index(['organizationId', 'startedAt'])
@Index(['correlationId'])
export class WorkflowInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workflowId: string;

  @Column()
  @Index()
  organizationId: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: InstanceStatus,
    default: InstanceStatus.PENDING,
  })
  @Index()
  status: InstanceStatus;

  @Column({ nullable: true })
  currentStepId?: string;

  @Column({ type: 'jsonb', default: {} })
  context: InstanceContext;

  @Column({ type: 'int', default: 0 })
  totalSteps: number;

  @Column({ type: 'int', default: 0 })
  completedSteps: number;

  @Column({ type: 'jsonb', nullable: true })
  triggerInfo?: TriggerInfo;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  pausedAt?: Date;

  @Column({ nullable: true })
  pausedBy?: string;

  @Column({ type: 'text', nullable: true })
  pauseReason?: string;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date;

  @Column({ nullable: true })
  cancelledBy?: string;

  @Column({ type: 'text', nullable: true })
  cancelReason?: string;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ type: 'int', default: 0 })
  executionTime: number; // seconds

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', nullable: true })
  priority?: number; // 1-10, higher is more important

  @Column({ nullable: true })
  correlationId?: string;

  @Column()
  initiatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(
    () => Workflow,
    (workflow) => workflow.instances
  )
  @JoinColumn({ name: 'workflowId' })
  workflow: Workflow;

  @OneToMany(
    () => WorkflowStepExecution,
    (execution) => execution.instance,
    { cascade: true }
  )
  steps: WorkflowStepExecution[];

  // Helper properties
  get inputs(): Record<string, any> {
    return this.context?.inputs || {};
  }

  get outputs(): Record<string, any> {
    return this.context?.outputs || {};
  }

  get variables(): Record<string, any> {
    return this.context?.variables || {};
  }

  get state(): any {
    return {
      approvals: [],
      variables: this.variables,
    };
  }

  // Helper methods
  isTerminalState(): boolean {
    return [
      InstanceStatus.COMPLETED,
      InstanceStatus.FAILED,
      InstanceStatus.CANCELLED,
      InstanceStatus.TIMEOUT,
    ].includes(this.status);
  }

  canTransitionTo(newStatus: InstanceStatus): boolean {
    if (this.isTerminalState()) {
      return false;
    }

    const validTransitions: Record<InstanceStatus, InstanceStatus[]> = {
      [InstanceStatus.PENDING]: [InstanceStatus.RUNNING, InstanceStatus.CANCELLED],
      [InstanceStatus.RUNNING]: [
        InstanceStatus.PAUSED,
        InstanceStatus.COMPLETED,
        InstanceStatus.FAILED,
        InstanceStatus.CANCELLED,
        InstanceStatus.TIMEOUT,
      ],
      [InstanceStatus.PAUSED]: [InstanceStatus.RUNNING, InstanceStatus.CANCELLED],
      [InstanceStatus.COMPLETED]: [],
      [InstanceStatus.FAILED]: [],
      [InstanceStatus.CANCELLED]: [],
      [InstanceStatus.TIMEOUT]: [],
    };

    return validTransitions[this.status]?.includes(newStatus) || false;
  }

  updateContext(updates: Partial<InstanceContext>): void {
    this.context = {
      ...this.context,
      ...updates,
      inputs: { ...this.context.inputs, ...updates.inputs },
      outputs: { ...this.context.outputs, ...updates.outputs },
      variables: { ...this.context.variables, ...updates.variables },
      metadata: { ...this.context.metadata, ...updates.metadata },
    };
  }
}
