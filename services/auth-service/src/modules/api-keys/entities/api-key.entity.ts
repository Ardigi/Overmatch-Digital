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
import { Organization } from '../../users/entities/organization.entity';
import { User } from '../../users/entities/user.entity';

export enum ApiKeyStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export enum ApiKeyScope {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin',
}

export interface ApiKeyMetadata {
  environment?: 'development' | 'staging' | 'production';
  applicationName?: string;
  teamId?: string;
  contactEmail?: string;
  notes?: string;
  tags?: string[];
  integrationId?: string;
  webhookEndpoints?: string[];
}

@Entity('api_keys')
@Index(['key'], { unique: true })
@Index(['userId'])
@Index(['organizationId'])
@Index(['status'])
@Index(['expiresAt'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ unique: true })
  key: string;

  @Column({ select: false })
  keyHash: string;

  @Column({
    type: 'enum',
    enum: ApiKeyStatus,
    default: ApiKeyStatus.ACTIVE,
  })
  status: ApiKeyStatus;

  @Column({
    type: 'simple-array',
    default: 'read',
  })
  scopes: ApiKeyScope[];

  @Column({ type: 'simple-json', nullable: true })
  permissions: {
    resources?: string[];
    actions?: string[];
    endpoints?: string[];
  };

  @Column({ type: 'simple-json', nullable: true })
  ipWhitelist: string[];

  @Column({ type: 'simple-json', nullable: true })
  metadata: ApiKeyMetadata;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date;

  @Column({ nullable: true })
  lastUsedIp: string;

  @Column({ default: 0 })
  usageCount: number;

  @Column({ nullable: true })
  rateLimit: number;

  @Column({ nullable: true })
  rateLimitWindow: number; // in seconds

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  revokedAt: Date;

  @Column({ nullable: true })
  revokedBy: string;

  @Column({ nullable: true })
  revokedReason: string;

  // Check if API key is valid
  isValid(): boolean {
    if (this.status !== ApiKeyStatus.ACTIVE) {
      return false;
    }
    if (this.expiresAt && this.expiresAt < new Date()) {
      return false;
    }
    return true;
  }

  // Check if IP is allowed
  isIpAllowed(ip: string): boolean {
    if (!this.ipWhitelist || this.ipWhitelist.length === 0) {
      return true;
    }
    return this.ipWhitelist.includes(ip);
  }

  // Check if scope is allowed
  hasScope(scope: ApiKeyScope): boolean {
    return this.scopes.includes(scope);
  }

  // Check if has any of the required scopes
  hasAnyScope(scopes: ApiKeyScope[]): boolean {
    return scopes.some((scope) => this.hasScope(scope));
  }

  // Check if has all required scopes
  hasAllScopes(scopes: ApiKeyScope[]): boolean {
    return scopes.every((scope) => this.hasScope(scope));
  }
}
