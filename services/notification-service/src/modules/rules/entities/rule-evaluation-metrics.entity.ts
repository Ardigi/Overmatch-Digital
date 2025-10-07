import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { NotificationRule } from './notification-rule.entity';

@Entity('rule_evaluation_metrics')
@Index(['ruleId', 'evaluationDate'])
export class RuleEvaluationMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => NotificationRule, rule => rule.metrics, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rule_id' })
  rule: NotificationRule;

  @Column({ name: 'rule_id', type: 'uuid' })
  ruleId: string;

  @Column({ name: 'evaluation_date', type: 'date' })
  evaluationDate: Date;

  @Column({ name: 'total_evaluations', type: 'int', default: 0 })
  totalEvaluations: number;

  @Column({ name: 'matched_evaluations', type: 'int', default: 0 })
  matchedEvaluations: number;

  @Column({ name: 'failed_evaluations', type: 'int', default: 0 })
  failedEvaluations: number;

  @Column({ name: 'avg_execution_time_ms', type: 'float', default: 0 })
  avgExecutionTimeMs: number;

  @Column({ name: 'notifications_triggered', type: 'int', default: 0 })
  notificationsTriggered: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}