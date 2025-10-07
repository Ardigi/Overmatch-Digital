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
import { Workflow } from './workflow.entity';

export interface StepConfig {
  // Common fields
  timeout?: number; // seconds
  skipCondition?: string; // Expression to evaluate

  // User task specific
  assignees?: string[];
  form?: {
    fields: Array<{
      name: string;
      type: string;
      required: boolean;
      label?: string;
      validation?: any;
    }>;
  };

  // Approval specific
  approvers?: string[];
  approvalType?: 'single' | 'all' | 'majority' | 'percentage';
  approvalThreshold?: number; // For percentage type

  // System task specific
  action?: string;
  parameters?: Record<string, any>;

  // Condition specific
  conditions?: Array<{
    expression: string;
    nextStepId: string;
  }>;

  // Email specific
  recipients?: string[];
  template?: string;

  // Parallel execution
  parallel?: boolean;
  parallelGroup?: string;
  waitFor?: string; // Group name to wait for

  // Custom fields
  [key: string]: any;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number; // seconds
  backoffMultiplier?: number;
}

@Entity('workflow_steps')
@Index(['workflowId', 'order'])
@Index(['workflowId', 'name'])
export class WorkflowStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workflowId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column()
  type: string; // user_task, approval, system_task, email, condition, etc.

  @Column({ type: 'int' })
  order: number;

  @Column({ type: 'jsonb', nullable: true })
  config?: StepConfig;

  @Column({ nullable: true })
  nextStepId?: string;

  @Column({ type: 'simple-array', nullable: true })
  errorStepIds?: string[];

  @Column({ type: 'jsonb', nullable: true })
  retryConfig?: RetryConfig;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  parallel?: boolean;

  @Column({ nullable: true })
  parallelGroup?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(
    () => Workflow,
    (workflow) => workflow.steps,
    { onDelete: 'CASCADE' }
  )
  @JoinColumn({ name: 'workflowId' })
  workflow: Workflow;

  // Helper methods
  validateApprover(userId: string, userRoles: string[]): boolean {
    if (this.type !== 'approval' || !this.config?.approvers) {
      return false;
    }

    // Check if user is in approvers list
    // Can be extended to support role-based approvers
    return (
      this.config.approvers.includes(userId) ||
      this.config.approvers.some((approver) => userRoles.includes(approver))
    );
  }

  getNextStepId(outputs?: Record<string, any>): string | null {
    // Handle conditional transitions
    if (this.type === 'condition' && this.config?.conditions && outputs) {
      for (const condition of this.config.conditions) {
        // Simple expression evaluation - can be enhanced with a proper expression engine
        if (this.evaluateCondition(condition.expression, outputs)) {
          return condition.nextStepId;
        }
      }
    }

    return this.nextStepId || null;
  }

  private evaluateCondition(expression: string, context: Record<string, any>): boolean {
    // Simple implementation - should use a proper expression evaluator in production
    try {
      // This is a simplified version - in production, use a safe expression evaluator
      return true; // Placeholder
    } catch {
      return false;
    }
  }
}
