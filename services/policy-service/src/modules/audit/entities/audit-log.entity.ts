import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { AuditChanges } from '../../shared/types';

export enum AuditAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  APPROVE = 'APPROVE',
  PUBLISH = 'PUBLISH',
  DOWNLOAD = 'DOWNLOAD',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  FAILED_AUTH = 'FAILED_AUTH',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_ROTATED = 'API_KEY_ROTATED',
  API_KEY_REVOKED = 'API_KEY_REVOKED',
}

export enum AuditResourceType {
  POLICY = 'POLICY',
  CONTROL = 'CONTROL',
  FRAMEWORK = 'FRAMEWORK',
  ASSESSMENT = 'ASSESSMENT',
  RISK = 'RISK',
  USER = 'USER',
  API_KEY = 'API_KEY',
  COMPLIANCE_MAPPING = 'COMPLIANCE_MAPPING',
  SYSTEM = 'SYSTEM',
}

export interface AuditMetadata {
  ip?: string;
  userAgent?: string;
  correlationId?: string;
  apiKeyId?: string;
  changes?: AuditChanges;
  previousValues?: AuditChanges;
  errorMessage?: string;
  stackTrace?: string;
  [key: string]: unknown;
}

@Entity('audit_logs')
@Index(['userId', 'createdAt'])
@Index(['resourceType', 'resourceId'])
@Index(['action', 'createdAt'])
@Index(['organizationId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', nullable: true })
  @Index()
  userId: string;

  @Column({ name: 'user_email', nullable: true })
  userEmail: string;

  @Column({ name: 'organization_id' })
  @Index()
  organizationId: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  @Index()
  action: AuditAction;

  @Column({
    name: 'resource_type',
    type: 'enum',
    enum: AuditResourceType,
  })
  @Index()
  resourceType: AuditResourceType;

  @Column({ name: 'resource_id', nullable: true })
  resourceId: string;

  @Column({ name: 'resource_name', nullable: true })
  resourceName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: AuditMetadata;

  @Column({ default: true })
  success: boolean;

  @Column({ name: 'status_code', nullable: true })
  statusCode: number;

  @Column({ name: 'duration_ms', nullable: true })
  durationMs: number;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;

  // Virtual properties for reporting
  get isSecurityEvent(): boolean {
    return [
      AuditAction.FAILED_AUTH,
      AuditAction.RATE_LIMIT_EXCEEDED,
      AuditAction.PERMISSION_DENIED,
    ].includes(this.action);
  }

  get requiresNotification(): boolean {
    return this.isSecurityEvent || !this.success;
  }
}
