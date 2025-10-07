import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { RolePermission } from './role-permission.entity';
import { UserRole } from './user-role.entity';

export enum RoleType {
  SYSTEM = 'system', // Built-in roles that can't be modified
  CUSTOM = 'custom', // Organization-specific custom roles
}

@Entity('roles')
@Index(['name', 'organizationId'], { unique: true })
@Index(['type'])
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  displayName: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: RoleType,
    default: RoleType.CUSTOM,
  })
  type: RoleType;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  organizationId: string;

  @ManyToOne(
    () => Organization,
    (organization) => organization.roles,
    {
      nullable: true,
    }
  )
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @OneToMany(
    () => UserRole,
    (userRole) => userRole.role
  )
  userRoles: UserRole[];

  @OneToMany(
    () => RolePermission,
    (rolePermission) => rolePermission.role
  )
  rolePermissions: RolePermission[];

  @Column({ type: 'simple-json', nullable: true })
  metadata: {
    color?: string;
    icon?: string;
    priority?: number;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Predefined system roles
export const SystemRoles = {
  // MSP Roles (Your company)
  SUPER_ADMIN: 'super_admin',
  MSP_ADMIN: 'msp_admin',
  MSP_ANALYST: 'msp_analyst',
  MSP_SUPPORT: 'msp_support',

  // Client Organization Roles
  CLIENT_ADMIN: 'client_admin',
  CLIENT_MANAGER: 'client_manager',
  CLIENT_USER: 'client_user',
  CLIENT_VIEWER: 'client_viewer',

  // Partner (CPA) Roles
  PARTNER_ADMIN: 'partner_admin',
  PARTNER_AUDITOR: 'partner_auditor',
  PARTNER_REVIEWER: 'partner_reviewer',

  // External Auditor Role
  EXTERNAL_AUDITOR: 'external_auditor',
};
