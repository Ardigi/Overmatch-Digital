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
import { WebhookEndpoint } from './webhook-endpoint.entity';

export enum EventStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  EXPIRED = 'EXPIRED',
}

export interface WebhookResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: any;
  responseTime?: number;
  error?: string;
}

export interface EventMetadata {
  correlationId?: string;
  priority?: number;
  source?: string;
  version?: string;
  customMetadata?: Record<string, any>;
  processingResult?: {
    actionsTriggered: string[];
    errors: string[];
  };
  processingError?: string;
}

@Entity('webhook_events')
@Index(['webhookId', 'createdAt'])
@Index(['webhookId', 'status'])
@Index(['webhookId', 'eventType'])
@Index(['status', 'nextRetryAt'])
@Index(['createdAt'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  webhookId: string;

  @ManyToOne(() => WebhookEndpoint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'webhookId' })
  webhook: WebhookEndpoint;

  @Column()
  eventType: string;

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.PENDING,
  })
  status: EventStatus;

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({ default: 0 })
  deliveryAttempts: number;

  @Column({ nullable: true })
  lastAttemptAt?: Date;

  @Column({ nullable: true })
  nextRetryAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  response?: WebhookResponse;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: EventMetadata;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
