import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RolePermission } from './role-permission.entity';

@Entity('permissions')
@Index(['resource', 'action'], { unique: true })
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  resource: string;

  @Column()
  action: string;

  @Column()
  displayName: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  category: string;

  @Column({ type: 'simple-array' })
  actions: string[];

  @Column({ type: 'simple-json', nullable: true })
  conditions: Record<string, any>;

  @OneToMany(
    () => RolePermission,
    (rolePermission) => rolePermission.permission
  )
  rolePermissions: RolePermission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Generate permission code
  get code(): string {
    return `${this.resource}:${this.action}`;
  }
}

// Predefined permissions
export const Permissions = {
  // Organization Management
  ORGANIZATION_VIEW: 'organization:view',
  ORGANIZATION_CREATE: 'organization:create',
  ORGANIZATION_UPDATE: 'organization:update',
  ORGANIZATION_DELETE: 'organization:delete',

  // User Management
  USER_VIEW: 'user:view',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_INVITE: 'user:invite',
  USER_SUSPEND: 'user:suspend',

  // Role Management
  ROLE_VIEW: 'role:view',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  ROLE_ASSIGN: 'role:assign',

  // Client Management
  CLIENT_VIEW: 'client:view',
  CLIENT_CREATE: 'client:create',
  CLIENT_UPDATE: 'client:update',
  CLIENT_DELETE: 'client:delete',

  // Audit Management
  AUDIT_VIEW: 'audit:view',
  AUDIT_CREATE: 'audit:create',
  AUDIT_UPDATE: 'audit:update',
  AUDIT_DELETE: 'audit:delete',
  AUDIT_EXECUTE: 'audit:execute',

  // Evidence Management
  EVIDENCE_VIEW: 'evidence:view',
  EVIDENCE_CREATE: 'evidence:create',
  EVIDENCE_UPDATE: 'evidence:update',
  EVIDENCE_DELETE: 'evidence:delete',
  EVIDENCE_APPROVE: 'evidence:approve',

  // Control Management
  CONTROL_VIEW: 'control:view',
  CONTROL_CREATE: 'control:create',
  CONTROL_UPDATE: 'control:update',
  CONTROL_DELETE: 'control:delete',
  CONTROL_TEST: 'control:test',

  // Policy Management
  POLICY_VIEW: 'policy:view',
  POLICY_CREATE: 'policy:create',
  POLICY_UPDATE: 'policy:update',
  POLICY_DELETE: 'policy:delete',
  POLICY_APPROVE: 'policy:approve',

  // Risk Management
  RISK_VIEW: 'risk:view',
  RISK_CREATE: 'risk:create',
  RISK_UPDATE: 'risk:update',
  RISK_DELETE: 'risk:delete',
  RISK_ASSESS: 'risk:assess',

  // Report Management
  REPORT_VIEW: 'report:view',
  REPORT_CREATE: 'report:create',
  REPORT_EXPORT: 'report:export',
  REPORT_SCHEDULE: 'report:schedule',

  // Billing Management
  BILLING_VIEW: 'billing:view',
  BILLING_MANAGE: 'billing:manage',
  BILLING_EXPORT: 'billing:export',

  // Integration Management
  INTEGRATION_VIEW: 'integration:view',
  INTEGRATION_CREATE: 'integration:create',
  INTEGRATION_UPDATE: 'integration:update',
  INTEGRATION_DELETE: 'integration:delete',

  // Settings Management
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_UPDATE: 'settings:update',

  // Analytics
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_EXPORT: 'analytics:export',

  // Audit Trail
  AUDIT_TRAIL_VIEW: 'audit_trail:view',
  AUDIT_TRAIL_EXPORT: 'audit_trail:export',
};
