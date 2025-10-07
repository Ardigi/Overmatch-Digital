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
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Organization } from './organization.entity';
import { UserRole } from './user-role.entity';

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

export enum UserType {
  INTERNAL = 'internal', // Your company employees
  CLIENT = 'client', // Client organization users
  PARTNER = 'partner', // CPA firm users
  AUDITOR = 'auditor', // External auditors
}

@Entity('users')
@Index(['email'], { unique: true })
@Index(['organizationId'])
@Index(['status'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  title: string;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING,
  })
  status: UserStatus;

  @Column({
    type: 'enum',
    enum: UserType,
    default: UserType.CLIENT,
  })
  userType: UserType;

  @Column({ nullable: true })
  profilePicture: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ type: 'timestamp', nullable: true })
  emailVerifiedAt: Date;

  @Column({ default: false })
  mfaEnabled: boolean;

  @Column({ nullable: true })
  mfaSecret: string;

  @Column({ type: 'text', nullable: true })
  mfaBackupCodes: string;

  @Column('simple-array', { nullable: true })
  roles: string[];

  @Column({ type: 'simple-array', nullable: true })
  permissions: string[];

  @Column({ type: 'simple-array', nullable: true })
  previousPasswords: string[];

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @Column({ nullable: true })
  lastLoginIp: string;

  @Column({ default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil: Date;

  @Column({ type: 'simple-json', nullable: true })
  preferences: {
    theme?: 'light' | 'dark';
    notifications?: {
      email?: boolean;
      inApp?: boolean;
      sms?: boolean;
    };
    timezone?: string;
    language?: string;
  };

  @Column({ nullable: true })
  resetPasswordToken: string;

  @Column({ type: 'timestamp', nullable: true })
  resetPasswordExpires: Date;

  @Column({ nullable: true })
  organizationId: string;

  @ManyToOne(
    () => Organization,
    (organization) => organization.users
  )
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @OneToMany(
    () => UserRole,
    (userRole) => userRole.user
  )
  userRoles: UserRole[];

  @OneToMany(
    () => AuditLog,
    (auditLog) => auditLog.user
  )
  auditLogs: AuditLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  passwordChangedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  disabledAt: Date;

  // Virtual property for full name
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  // Check if user account is locked
  isLocked(): boolean {
    return this.lockedUntil && this.lockedUntil > new Date();
  }

  // Check if password reset token is valid
  isResetTokenValid(): boolean {
    return (
      this.resetPasswordToken && this.resetPasswordExpires && this.resetPasswordExpires > new Date()
    );
  }
}
