import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { NotificationRule } from './notification-rule.entity';

@Entity('notification_rule_history')
export class NotificationRuleHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => NotificationRule, rule => rule.history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rule_id' })
  rule: NotificationRule;

  @Column({ name: 'rule_id', type: 'uuid' })
  ruleId: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'jsonb' })
  changes: Record<string, any>;

  @Column({ name: 'changed_by', type: 'uuid' })
  changedBy: string;

  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}