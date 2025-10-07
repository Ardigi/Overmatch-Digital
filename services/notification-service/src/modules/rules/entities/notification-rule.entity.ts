import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

export enum NotificationRuleType {
  EVENT_BASED = 'EVENT_BASED',
  SCHEDULED = 'SCHEDULED',
  CONDITIONAL = 'CONDITIONAL',
  THRESHOLD = 'THRESHOLD',
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'gt' | 'gte' | 'lt' | 'lte' | 'regex' | 'exists' | 'not_exists';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface RuleAction {
  type: 'send_notification' | 'trigger_workflow' | 'log_event' | 'webhook';
  templateCode?: string;
  channel?: string;
  priority?: string;
  delay?: number;
  metadata?: Record<string, any>;
}

export interface RateLimit {
  maxPerHour?: number;
  maxPerDay?: number;
  maxPerWeek?: number;
  cooldownMinutes?: number;
}

@Entity('notification_rules')
@Index(['organizationId', 'isActive'])
@Index(['ruleType', 'priority'])
export class NotificationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  organizationId: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  @Index()
  ruleId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({
    type: 'enum',
    enum: NotificationRuleType,
    default: NotificationRuleType.EVENT_BASED,
  })
  ruleType: NotificationRuleType;

  @Column({ type: 'jsonb' })
  conditions: RuleCondition[];

  @Column({ type: 'jsonb' })
  actions: RuleAction[];

  @Column({ type: 'jsonb', nullable: true })
  schedule: {
    cron?: string;
    timezone?: string;
    startDate?: Date;
    endDate?: Date;
  };

  @Column({ type: 'jsonb', nullable: true })
  rateLimits: RateLimit;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'uuid' })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany('NotificationRuleHistory', 'rule')
  history: any[];

  @OneToMany('RuleEvaluationMetrics', 'rule')
  metrics: any[];

  // Additional fields for new rules engine
  @Column({ type: 'varchar', length: 100, nullable: true })
  eventType?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  eventCategory?: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'date', nullable: true })
  startDate?: Date;

  @Column({ type: 'date', nullable: true })
  endDate?: Date;

  @Column({ type: 'int', nullable: true })
  maxTriggers?: number;

  @Column({ type: 'int', nullable: true })
  cooldownMinutes?: number;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  evaluateConditions(data: Record<string, any>): boolean {
    if (!this.conditions || this.conditions.length === 0) {
      return true;
    }

    let result = true;
    let previousLogicalOperator: 'AND' | 'OR' = 'AND';

    for (let i = 0; i < this.conditions.length; i++) {
      const condition = this.conditions[i];
      const conditionResult = this.evaluateCondition(condition, data);

      if (i === 0) {
        result = conditionResult;
      } else {
        if (previousLogicalOperator === 'AND') {
          result = result && conditionResult;
        } else {
          result = result || conditionResult;
        }
      }

      previousLogicalOperator = condition.logicalOperator || 'AND';
    }

    return result;
  }

  private evaluateCondition(condition: RuleCondition, data: Record<string, any>): boolean {
    const fieldValue = this.getNestedValue(data, condition.field);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'not_contains':
        return !String(fieldValue).includes(String(condition.value));
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
      case 'gt':
        return Number(fieldValue) > Number(condition.value);
      case 'gte':
        return Number(fieldValue) >= Number(condition.value);
      case 'lt':
        return Number(fieldValue) < Number(condition.value);
      case 'lte':
        return Number(fieldValue) <= Number(condition.value);
      case 'regex':
        return new RegExp(condition.value).test(String(fieldValue));
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;
      default:
        return false;
    }
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  shouldExecute(lastExecutionTime?: Date): boolean {
    if (!this.isActive) {
      return false;
    }

    if (this.rateLimits && lastExecutionTime) {
      const now = new Date();
      const timeDiff = now.getTime() - lastExecutionTime.getTime();
      const minutesDiff = timeDiff / (1000 * 60);

      if (this.rateLimits.cooldownMinutes && minutesDiff < this.rateLimits.cooldownMinutes) {
        return false;
      }
    }

    return true;
  }

  getApplicableActions(context?: Record<string, any>): RuleAction[] {
    return this.actions.filter(action => {
      // Filter actions based on context if needed
      if (context?.channel && action.channel && action.channel !== context.channel) {
        return false;
      }
      return true;
    });
  }

  clone(): Partial<NotificationRule> {
    return {
      name: `${this.name} (Copy)`,
      description: this.description,
      ruleType: this.ruleType,
      conditions: [...this.conditions],
      actions: [...this.actions],
      schedule: this.schedule ? { ...this.schedule } : null,
      rateLimits: this.rateLimits ? { ...this.rateLimits } : null,
      metadata: this.metadata ? { ...this.metadata } : null,
      priority: this.priority,
      isActive: false, // Start as inactive
    };
  }
}