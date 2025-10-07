import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum AuditAction {
  // Authentication
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  PASSWORD_RESET_REQUEST = 'password_reset_request',
  PASSWORD_RESET_SUCCESS = 'password_reset_success',
  PASSWORD_CHANGED = 'password_changed',

  // MFA
  MFA_ENABLED = 'mfa_enabled',
  MFA_DISABLED = 'mfa_disabled',
  MFA_VERIFIED = 'mfa_verified',
  MFA_FAILED = 'mfa_failed',

  // User Management
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  USER_SUSPENDED = 'user_suspended',
  USER_ACTIVATED = 'user_activated',
  USER_INVITED = 'user_invited',

  // Role Management
  ROLE_ASSIGNED = 'role_assigned',
  ROLE_REMOVED = 'role_removed',
  ROLE_CREATED = 'role_created',
  ROLE_UPDATED = 'role_updated',
  ROLE_DELETED = 'role_deleted',

  // Organization
  ORGANIZATION_CREATED = 'organization_created',
  ORGANIZATION_UPDATED = 'organization_updated',
  ORGANIZATION_DELETED = 'organization_deleted',

  // Security
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  IP_BLOCKED = 'ip_blocked',
  SESSION_EXPIRED = 'session_expired',

  // Token Management
  TOKEN_REFRESH = 'token_refresh',
  TOKEN_REVOKE = 'token_revoke',
  TOKEN_REVOKE_ALL = 'token_revoke_all',
}

@Entity('audit_logs')
@Index(['userId'])
@Index(['action'])
@Index(['createdAt'])
@Index(['ipAddress'])
@Index(['organizationId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(
    () => User,
    (user) => user.auditLogs,
    {
      onDelete: 'SET NULL',
    }
  )
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  organizationId: string;

  @Column({ nullable: true })
  targetUserId: string;

  @Column({ nullable: true })
  targetResourceType: string;

  @Column({ nullable: true })
  targetResourceId: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column({ nullable: true })
  sessionId: string;

  @Column({ type: 'simple-json', nullable: true })
  location: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };

  @Column({ default: 'success' })
  status: 'success' | 'failed' | 'warning';

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;
}
