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
import { WorkflowInstance } from './workflow-instance.entity';

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  WAITING_APPROVAL = 'waiting_approval',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

export interface ApprovalRecord {
  userId: string;
  decision: 'approved' | 'rejected' | 'pending';
  comments?: string;
  timestamp: Date;
  formData?: Record<string, any>;
}

@Entity('workflow_step_executions')
@Index(['instanceId', 'stepId'])
@Index(['instanceId', 'status'])
@Index(['instanceId', 'order'])
export class WorkflowStepExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  instanceId: string;

  @Column()
  stepId: string;

  @Column()
  stepName: string;

  @Column()
  stepType: string;

  @Column({ type: 'int' })
  order: number;

  @Column({
    type: 'enum',
    enum: ExecutionStatus,
    default: ExecutionStatus.PENDING,
  })
  status: ExecutionStatus;

  @Column({ type: 'jsonb', default: {} })
  inputs: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  outputs: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  approvals?: ApprovalRecord[];

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ type: 'jsonb', nullable: true })
  errorDetails?: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'int', default: 0 })
  executionTime: number; // seconds

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastRetryAt?: Date;

  @Column({ nullable: true })
  executedBy?: string;

  @Column({ nullable: true })
  skippedBy?: string;

  @Column({ type: 'text', nullable: true })
  skipReason?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(
    () => WorkflowInstance,
    (instance) => instance.steps,
    { onDelete: 'CASCADE' }
  )
  @JoinColumn({ name: 'instanceId' })
  instance: WorkflowInstance;

  // Helper methods
  isTerminalState(): boolean {
    return [
      ExecutionStatus.COMPLETED,
      ExecutionStatus.FAILED,
      ExecutionStatus.SKIPPED,
      ExecutionStatus.CANCELLED,
      ExecutionStatus.TIMEOUT,
    ].includes(this.status);
  }

  canRetry(): boolean {
    return this.status === ExecutionStatus.FAILED && !this.isMaxRetriesReached();
  }

  isMaxRetriesReached(): boolean {
    // Default max retries - should be configurable
    const maxRetries = 3;
    return this.retryCount >= maxRetries;
  }

  addApproval(approval: ApprovalRecord): void {
    if (!this.approvals) {
      this.approvals = [];
    }
    this.approvals.push(approval);
  }

  getApprovalDecision(): 'approved' | 'rejected' | 'pending' {
    if (!this.approvals || this.approvals.length === 0) {
      return 'pending';
    }

    const decisions = this.approvals.map((a) => a.decision);

    // If any rejection, the step is rejected
    if (decisions.includes('rejected')) {
      return 'rejected';
    }

    // If all approved, the step is approved
    if (decisions.every((d) => d === 'approved')) {
      return 'approved';
    }

    // Otherwise still pending
    return 'pending';
  }

  updateExecutionTime(): void {
    if (this.startedAt) {
      this.executionTime = Math.floor((Date.now() - this.startedAt.getTime()) / 1000);
    }
  }
}
