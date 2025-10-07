import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum IntegrationType {
  CRM = 'CRM',
  MARKETING = 'MARKETING',
  SECURITY = 'SECURITY',
  CLOUD = 'CLOUD',
  TICKETING = 'TICKETING',
  COMMUNICATION = 'COMMUNICATION',
  ANALYTICS = 'ANALYTICS',
  COMPLIANCE = 'COMPLIANCE',
  MONITORING = 'MONITORING',
  NOTIFICATION = 'NOTIFICATION',
  LOGGING = 'LOGGING',
  CUSTOM = 'CUSTOM',
}

export enum IntegrationStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
  MAINTENANCE = 'MAINTENANCE',
}

export enum AuthType {
  API_KEY = 'API_KEY',
  OAUTH2 = 'OAUTH2',
  BASIC = 'BASIC',
  TOKEN = 'TOKEN',
  CUSTOM = 'CUSTOM',
}

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scope: string[];
  redirectUri?: string;
}

export interface SyncSettings {
  entities: string[];
  syncInterval: number;
  batchSize: number;
  filters?: Record<string, any>;
}

export interface IntegrationConfiguration {
  apiUrl: string;
  apiVersion?: string;
  apiKey?: string;
  oauth2Config?: OAuth2Config;
  basicAuth?: {
    username: string;
    password: string;
  };
  token?: string;
  syncSettings?: SyncSettings;
  customHeaders?: Record<string, string>;
  customConfig?: Record<string, any>;
  entityMappings?: Record<string, any>;
  webhookSecret?: string;
  endpoint?: string;
  type?: string;
}

export interface HealthCheckConfig {
  endpoint: string;
  interval: number;
  timeout: number;
  successCriteria?: {
    statusCode?: number;
    responseContains?: string;
  };
}

export interface IntegrationMetadata {
  lastSync?: Date;
  syncInterval?: number;
  capabilities?: string[];
  version?: string;
  customMetadata?: Record<string, any>;
}

export interface IntegrationStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastHealthCheckAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  averageResponseTime?: number;
}

@Entity('integrations')
@Index(['organizationId', 'name'], { unique: true })
@Index(['organizationId', 'integrationType'])
@Index(['status'])
@Index(['tags'])
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  organizationId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: IntegrationType,
  })
  integrationType: IntegrationType;

  // Alias for compatibility
  get type(): IntegrationType {
    return this.integrationType;
  }
  
  set type(value: IntegrationType) {
    this.integrationType = value;
  }

  @Column({
    type: 'enum',
    enum: AuthType,
  })
  authType: AuthType;

  @Column({
    type: 'enum',
    enum: IntegrationStatus,
    default: IntegrationStatus.PENDING,
  })
  status: IntegrationStatus;

  @Column({ default: false })
  isHealthy: boolean;

  @Column({ nullable: true })
  healthMessage?: string;

  @Column({ type: 'jsonb' })
  configuration: IntegrationConfiguration;

  @Column({ type: 'jsonb', nullable: true })
  healthCheck?: HealthCheckConfig;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: IntegrationMetadata;

  @Column('text', { array: true, default: '{}' })
  tags: string[];

  @Column({ type: 'jsonb', default: '{}' })
  stats: IntegrationStats;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  @Column({ nullable: true })
  createdBy?: string;
}
