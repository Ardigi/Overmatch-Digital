import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Integration } from '../../integrations/entities/integration.entity';

export enum WebhookStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  ERROR = 'ERROR',
}

export interface WebhookRetryPolicy {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  maxRetryDelay?: number;
}

export interface WebhookAuthentication {
  type: 'none' | 'api_key' | 'bearer' | 'signature' | 'custom';
  secret?: string;
  algorithm?: string;
  headerName?: string;
  customConfig?: Record<string, any>;
}

export interface WebhookTransformations {
  excludeFields?: string[];
  includeFields?: string[];
  fieldMappings?: Record<string, string>;
  customTransform?: string; // JavaScript code for custom transformation
}

export interface WebhookConfig {
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  events: string[];
  retryPolicy: WebhookRetryPolicy;
  authentication?: WebhookAuthentication;
  filters?: Record<string, any>;
  transformations?: WebhookTransformations;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  processWithServices?: boolean;
}

export interface WebhookStats {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageResponseTime: number;
  lastDeliveryAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
}

@Entity('webhook_endpoints')
@Index(['organizationId', 'name'], { unique: true })
@Index(['organizationId', 'status'])
@Index(['integrationId'])
@Index(['tags'])
export class WebhookEndpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  organizationId: string;

  @Column({ nullable: true })
  integrationId?: string;

  @ManyToOne(() => Integration, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'integrationId' })
  integration?: Integration;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column()
  url: string;

  @Column({
    type: 'enum',
    enum: WebhookStatus,
    default: WebhookStatus.ACTIVE,
  })
  status: WebhookStatus;

  @Column({ type: 'jsonb' })
  config: WebhookConfig;

  @Column({ default: true })
  sslVerification: boolean;

  @Column({ default: 30 })
  timeoutSeconds: number;

  @Column('text', { array: true, default: '{}' })
  tags: string[];

  @Column({ type: 'jsonb', default: '{}' })
  stats: WebhookStats;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
