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
import { Role } from './role.entity';
import { User } from './user.entity';

export enum OrganizationType {
  MSP = 'msp', // Your company (Managed Service Provider)
  CLIENT = 'client', // Client organizations
  PARTNER = 'partner', // CPA firms
}

export enum OrganizationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  TRIAL = 'trial',
}

@Entity('organizations')
@Index(['name'])
@Index(['type'])
@Index(['status'])
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  legalName: string;

  @Column({
    type: 'enum',
    enum: OrganizationType,
    default: OrganizationType.CLIENT,
  })
  type: OrganizationType;

  @Column({
    type: 'enum',
    enum: OrganizationStatus,
    default: OrganizationStatus.ACTIVE,
  })
  status: OrganizationStatus;

  @Column({ nullable: true })
  logo: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  industry: string;

  @Column({ nullable: true })
  size: string; // e.g., '1-50', '51-200', '201-500', '500+'

  @Column({ type: 'simple-json', nullable: true })
  address: {
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };

  @Column({ nullable: true })
  primaryContactId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'primaryContactId' })
  primaryContact: User;

  @Column({ nullable: true })
  parentOrganizationId: string;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'parentOrganizationId' })
  parentOrganization: Organization;

  @OneToMany(
    () => Organization,
    (org) => org.parentOrganization
  )
  childOrganizations: Organization[];

  @Column({ type: 'simple-json', nullable: true })
  settings: {
    ssoEnabled?: boolean;
    ssoProvider?: string;
    ssoConfig?: any;
    passwordPolicy?: {
      minLength?: number;
      requireUppercase?: boolean;
      requireLowercase?: boolean;
      requireNumbers?: boolean;
      requireSpecialChars?: boolean;
      expirationDays?: number;
    };
    sessionTimeout?: number;
    allowedIpRanges?: string[];
    features?: string[];
  };

  @Column({ type: 'simple-json', nullable: true })
  billing: {
    plan?: string;
    planStartDate?: Date;
    planEndDate?: Date;
    seats?: number;
    billingEmail?: string;
    stripeCustomerId?: string;
  };

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'simple-json', nullable: true })
  passwordPolicy: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
    specialChars?: string;
    preventReuse?: number;
    maxAge?: number;
    minAge?: number;
    preventCommonPasswords?: boolean;
    preventUserInfo?: boolean;
    enablePasswordHistory?: boolean;
    passwordHistoryCount?: number;
  };

  @OneToMany(
    () => User,
    (user) => user.organization
  )
  users: User[];

  @OneToMany(
    () => Role,
    (role) => role.organization
  )
  roles: Role[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;

  // Check if organization is the MSP (your company)
  isMSP(): boolean {
    return this.type === OrganizationType.MSP;
  }

  // Check if organization has active subscription
  hasActiveSubscription(): boolean {
    return (
      this.status === OrganizationStatus.ACTIVE &&
      this.billing?.planEndDate &&
      new Date(this.billing.planEndDate) > new Date()
    );
  }
}
