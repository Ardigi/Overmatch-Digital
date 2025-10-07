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
import { Client } from './client.entity';

export enum ClientUserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
  VIEWER = 'viewer',
  AUDITOR = 'auditor',
}

export enum ClientUserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
}

@Entity('client_users')
@Index(['clientId', 'userId'], { unique: true })
@Index(['clientId'])
@Index(['userId'])
@Index(['status'])
export class ClientUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @ManyToOne(
    () => Client,
    (client) => client.clientUsers,
    {
      onDelete: 'CASCADE',
    }
  )
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  userId: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({
    type: 'enum',
    enum: ClientUserRole,
    enumName: 'client_user_role',
    default: ClientUserRole.USER,
  })
  role: ClientUserRole;

  @Column({
    type: 'enum',
    enum: ClientUserStatus,
    enumName: 'client_user_status',
    default: ClientUserStatus.ACTIVE,
  })
  status: ClientUserStatus;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true })
  department: string;

  @Column({ default: false })
  isPrimaryContact: boolean;

  @Column({ default: false })
  isBillingContact: boolean;

  @Column({ default: false })
  isTechnicalContact: boolean;

  @Column({ default: false })
  isSecurityContact: boolean;

  @Column({ type: 'simple-array', nullable: true })
  permissions: string[];

  @Column({ type: 'simple-json', nullable: true })
  preferences: {
    notifications?: {
      email?: boolean;
      sms?: boolean;
      inApp?: boolean;
    };
    dashboardLayout?: string;
    defaultView?: string;
  };

  @Column({ type: 'date', nullable: true })
  lastLoginAt: Date;

  @Column({ type: 'date', nullable: true })
  invitedAt: Date;

  @Column({ nullable: true })
  invitedBy: string;

  @Column({ type: 'date', nullable: true })
  acceptedAt: Date;

  @Column({ nullable: true })
  invitationToken: string;

  @Column({ type: 'date', nullable: true })
  invitationExpiresAt: Date;

  @Column({ type: 'date', nullable: true })
  deactivatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  updatedBy: string;

  // Helper methods
  isActive(): boolean {
    return this.status === ClientUserStatus.ACTIVE;
  }

  hasAdminAccess(): boolean {
    return [ClientUserRole.OWNER, ClientUserRole.ADMIN].includes(this.role);
  }

  canManageUsers(): boolean {
    return [ClientUserRole.OWNER, ClientUserRole.ADMIN, ClientUserRole.MANAGER].includes(this.role);
  }

  canViewOnly(): boolean {
    return this.role === ClientUserRole.VIEWER;
  }
}
