import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  VIEW = 'view',
  EXPORT = 'export',
  STATUS_CHANGE = 'status_change',
  PERMISSION_CHANGE = 'permission_change',
  LOGIN = 'login',
  LOGOUT = 'logout',
  CONTRACT_SIGNED = 'contract_signed',
  CONTRACT_TERMINATED = 'contract_terminated',
  CONTRACT_RENEWED = 'contract_renewed',
  DOCUMENT_UPLOADED = 'document_uploaded',
  DOCUMENT_DELETED = 'document_deleted',
  AUDIT_STARTED = 'audit_started',
  AUDIT_COMPLETED = 'audit_completed',
  COMPLIANCE_STATUS_CHANGED = 'compliance_status_changed',
}

export enum AuditResourceType {
  CLIENT = 'client',
  CONTRACT = 'contract',
  DOCUMENT = 'document',
  USER = 'user',
  ORGANIZATION = 'organization',
  AUDIT = 'audit',
  EVIDENCE = 'evidence',
  POLICY = 'policy',
  CONTROL = 'control',
  RISK = 'risk',
  FINDING = 'finding',
  REPORT = 'report',
}

@Entity('audit_trails')
@Index(['resourceType', 'resourceId'])
@Index(['userId'])
@Index(['clientId'])
@Index(['action'])
@Index(['timestamp'])
export class AuditTrail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AuditAction, enumName: 'audit_action' })
  action: AuditAction;

  @Column({ type: 'enum', enum: AuditResourceType, enumName: 'audit_resource_type' })
  resourceType: AuditResourceType;

  @Column('uuid')
  resourceId: string;

  @Column({ nullable: true })
  resourceName?: string;

  @Column('uuid')
  userId: string;

  @Column()
  userName: string;

  @Column({ nullable: true })
  userEmail?: string;

  @Column({ nullable: true })
  userRole?: string;

  @Column('uuid', { nullable: true })
  clientId?: string;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client?: Client;

  @Column('uuid', { nullable: true })
  organizationId?: string;

  @Column({ nullable: true })
  organizationName?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
    fields?: string[];
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    requestId?: string;
    method?: string;
    endpoint?: string;
    statusCode?: number;
    duration?: number;
    errorMessage?: string;
    tags?: string[];
  };

  @Column({ nullable: true })
  ipAddress?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column({ nullable: true })
  sessionId?: string;

  @Column({ default: false })
  isSystemAction: boolean;

  @Column({ default: false })
  isSensitive: boolean;

  @Column({ nullable: true })
  complianceFramework?: string;

  @Column({ nullable: true })
  controlId?: string;

  @Column({ nullable: true })
  riskLevel?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  timestamp: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  // Computed properties
  get summary(): string {
    const actionText = this.action.replace(/_/g, ' ');
    return `${this.userName} ${actionText} ${this.resourceType} ${this.resourceName || this.resourceId}`;
  }

  get isHighRisk(): boolean {
    const highRiskActions = [
      AuditAction.DELETE,
      AuditAction.PERMISSION_CHANGE,
      AuditAction.CONTRACT_TERMINATED,
      AuditAction.DOCUMENT_DELETED,
    ];
    return highRiskActions.includes(this.action) || this.riskLevel === 'high';
  }

  get requiresReview(): boolean {
    return this.isHighRisk || this.isSensitive;
  }

  // Methods
  toCompliance(): {
    timestamp: Date;
    user: string;
    action: string;
    resource: string;
    details: string;
    ipAddress?: string;
    changes?: any;
  } {
    return {
      timestamp: this.timestamp,
      user: `${this.userName} (${this.userEmail || this.userId})`,
      action: this.action,
      resource: `${this.resourceType}:${this.resourceId}`,
      details: this.description || this.summary,
      ipAddress: this.ipAddress,
      changes: this.changes,
    };
  }
}
