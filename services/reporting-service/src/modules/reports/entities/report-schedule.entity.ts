import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ReportTemplate } from './report-template.entity';

export enum DeliveryMethod {
  EMAIL = 'email',
  WEBHOOK = 'webhook',
  STORAGE = 'storage',
}

@Entity('report_schedules')
@Index(['organizationId', 'isActive'])
export class ReportSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  @Index()
  organizationId: string;

  @Column({ name: 'report_template_id' })
  reportTemplateId: string;

  @ManyToOne(() => ReportTemplate)
  @JoinColumn({ name: 'report_template_id' })
  reportTemplate: ReportTemplate;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'cron_expression' })
  cronExpression: string;

  @Column({ default: 'UTC' })
  timezone: string;

  @Column({ type: 'jsonb', default: [] })
  recipients: string[];

  @Column({ default: 'PDF' })
  format: string;

  @Column({ type: 'jsonb', nullable: true })
  parameters?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  filters?: Record<string, any>;

  @Column({
    name: 'delivery_method',
    type: 'enum',
    enum: DeliveryMethod,
    default: DeliveryMethod.EMAIL,
  })
  deliveryMethod: DeliveryMethod;

  @Column({ name: 'delivery_config', type: 'jsonb', nullable: true })
  deliveryConfig?: {
    emailSubject?: string;
    emailBody?: string;
    attachReport?: boolean;
    includeExecutiveSummary?: boolean;
    webhookUrl?: string;
    webhookHeaders?: Record<string, string>;
    storageLocation?: string;
    priority?: string;
    webhookPayload?: Record<string, any>;
    webhookAuth?: {
      type: 'bearer' | 'api-key' | 'basic';
      token?: string;
      key?: string;
      headerName?: string;
      username?: string;
      password?: string;
    };
    webhookTimeout?: number;
  };

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_run_at', type: 'timestamp', nullable: true })
  lastRunAt?: Date;

  @Column({ name: 'next_run_at', type: 'timestamp', nullable: true })
  nextRunAt?: Date;

  @Column({ name: 'execution_count', default: 0 })
  executionCount: number;

  @Column({ name: 'success_count', default: 0 })
  successCount: number;

  @Column({ name: 'failure_count', default: 0 })
  failureCount: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string;

  @Column({ name: 'last_error_at', type: 'timestamp', nullable: true })
  lastErrorAt?: Date;

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
}
