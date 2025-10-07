import {
  BeforeInsert,
  BeforeUpdate,
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
import { Contract } from '../../contracts/entities/contract.entity';
import { ClientAudit } from './client-audit.entity';
import { ClientDocument } from './client-document.entity';
import { ClientUser } from './client-user.entity';

export enum ClientStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
  ARCHIVED = 'archived',
}

export enum ClientType {
  DIRECT = 'direct', // Direct client
  PARTNER_REFERRAL = 'partner_referral', // Referred by CPA partner
  MANAGED = 'managed', // Fully managed by MSP
}

export enum CompanySize {
  STARTUP = '1-50',
  SMALL = '51-200',
  MEDIUM = '201-500',
  LARGE = '501-1000',
  ENTERPRISE = '1000+',
}

export enum Industry {
  TECHNOLOGY = 'technology',
  HEALTHCARE = 'healthcare',
  FINANCE = 'finance',
  RETAIL = 'retail',
  MANUFACTURING = 'manufacturing',
  EDUCATION = 'education',
  GOVERNMENT = 'government',
  NONPROFIT = 'nonprofit',
  OTHER = 'other',
}

export enum ComplianceFramework {
  SOC1_TYPE1 = 'soc1_type1',
  SOC1_TYPE2 = 'soc1_type2',
  SOC2_TYPE1 = 'soc2_type1',
  SOC2_TYPE2 = 'soc2_type2',
  ISO27001 = 'iso27001',
  HIPAA = 'hipaa',
  GDPR = 'gdpr',
  PCI_DSS = 'pci_dss',
  NIST = 'nist',
  FEDRAMP = 'fedramp',
}

export enum ComplianceStatus {
  NOT_STARTED = 'not_started',
  ASSESSMENT = 'assessment',
  REMEDIATION = 'remediation',
  IMPLEMENTATION = 'implementation',
  READY_FOR_AUDIT = 'ready_for_audit',
  UNDER_AUDIT = 'under_audit',
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  EXPIRED = 'expired',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('clients')
@Index(['organizationId'])
@Index(['status'])
@Index(['complianceStatus'])
@Index(['slug'], { unique: true })
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  legalName: string;

  @Column({ unique: true })
  slug: string;

  @Column({
    type: 'enum',
    enum: ClientType,
    enumName: 'client_type',
    default: ClientType.DIRECT,
  })
  clientType: ClientType;

  @Column({ nullable: true })
  organizationId: string;

  @Column({ nullable: true })
  parentClientId: string;

  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn({ name: 'parentClientId' })
  parentClient: Client;

  @OneToMany(
    () => Client,
    (client) => client.parentClient
  )
  subsidiaries: Client[];

  @Column({ nullable: true })
  logo: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: Industry,
    enumName: 'industry',
    nullable: true,
  })
  industry: Industry;

  @Column({
    type: 'enum',
    enum: CompanySize,
    enumName: 'company_size',
    nullable: true,
  })
  size: CompanySize;

  @Column({ nullable: true })
  employeeCount: number;

  @Column({ nullable: true })
  annualRevenue: string;

  @Column({
    type: 'enum',
    enum: ClientStatus,
    enumName: 'client_status',
    default: ClientStatus.PENDING,
  })
  status: ClientStatus;

  @Column({
    type: 'enum',
    enum: ComplianceStatus,
    enumName: 'compliance_status',
    default: ComplianceStatus.NOT_STARTED,
  })
  complianceStatus: ComplianceStatus;

  @Column({
    type: 'simple-array',
    nullable: true,
  })
  targetFrameworks: ComplianceFramework[];

  @Column({
    type: 'enum',
    enum: RiskLevel,
    enumName: 'risk_level',
    default: RiskLevel.MEDIUM,
  })
  riskLevel: RiskLevel;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  complianceScore: number;

  @Column({ type: 'simple-json', nullable: true })
  contactInfo: {
    primaryContact?: {
      name?: string;
      title?: string;
      email?: string;
      phone?: string;
    };
    secondaryContact?: {
      name?: string;
      title?: string;
      email?: string;
      phone?: string;
    };
    technicalContact?: {
      name?: string;
      title?: string;
      email?: string;
      phone?: string;
    };
    billingContact?: {
      name?: string;
      title?: string;
      email?: string;
      phone?: string;
    };
  };

  @Column({ type: 'simple-json', nullable: true })
  address: {
    headquarters?: {
      street1?: string;
      street2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    billing?: {
      street1?: string;
      street2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    locations?: Array<{
      name?: string;
      type?: string;
      address?: {
        street1?: string;
        street2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      };
    }>;
  };

  @Column({ type: 'simple-json', nullable: true })
  billingInfo: {
    currency?: string;
    paymentTerms?: string;
    paymentMethod?: string;
    taxId?: string;
    purchaseOrderRequired?: boolean;
    invoicePrefix?: string;
    creditLimit?: number;
  };

  @Column({ nullable: true })
  partnerId: string;

  @Column({ nullable: true })
  partnerReferralDate: Date;

  @Column({ nullable: true })
  salesRepId: string;

  @Column({ nullable: true })
  accountManagerId: string;

  @Column({ nullable: true })
  technicalLeadId: string;

  @Column({ type: 'date', nullable: true })
  onboardingStartDate: Date;

  @Column({ type: 'date', nullable: true })
  onboardingCompleteDate: Date;

  @Column({ type: 'date', nullable: true })
  firstAuditDate: Date;

  @Column({ type: 'date', nullable: true })
  lastAuditDate: Date;

  @Column({ type: 'date', nullable: true })
  nextAuditDate: Date;

  @Column({ type: 'date', nullable: true })
  certificateExpiryDate: Date;

  @Column({ type: 'simple-json', nullable: true })
  auditHistory: Array<{
    date?: Date;
    type?: string;
    framework?: ComplianceFramework;
    auditor?: string;
    result?: string;
    certificateNumber?: string;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  integrations: {
    aws?: {
      accountId?: string;
      regions?: string[];
      lastSync?: Date;
    };
    azure?: {
      tenantId?: string;
      subscriptions?: string[];
      lastSync?: Date;
    };
    gcp?: {
      projectIds?: string[];
      lastSync?: Date;
    };
    jira?: {
      url?: string;
      projectKey?: string;
      lastSync?: Date;
    };
    slack?: {
      workspaceId?: string;
      channels?: string[];
    };
  };

  @Column({ type: 'simple-json', nullable: true })
  settings: {
    timezone?: string;
    dateFormat?: string;
    currency?: string;
    language?: string;
    notifications?: {
      email?: boolean;
      sms?: boolean;
      slack?: boolean;
    };
    security?: {
      ipWhitelist?: string[];
      mfaRequired?: boolean;
      sessionTimeout?: number;
      passwordPolicy?: {
        minLength?: number;
        requireUppercase?: boolean;
        requireLowercase?: boolean;
        requireNumbers?: boolean;
        requireSpecialChars?: boolean;
        expirationDays?: number;
      };
    };
    features?: {
      apiAccess?: boolean;
      customBranding?: boolean;
      advancedReporting?: boolean;
      automatedEvidence?: boolean;
      continuousMonitoring?: boolean;
    };
  };

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  updatedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;

  @Column({ nullable: true })
  deletedBy: string;

  // Relations
  @OneToMany(
    () => Contract,
    (contract) => contract.client
  )
  contracts: Contract[];

  @OneToMany(
    () => ClientUser,
    (clientUser) => clientUser.client
  )
  clientUsers: ClientUser[];

  @OneToMany(
    () => ClientDocument,
    (document) => document.client
  )
  documents: ClientDocument[];

  @OneToMany(
    () => ClientAudit,
    (audit) => audit.client
  )
  audits: ClientAudit[];

  // Hooks
  @BeforeInsert()
  generateSlug() {
    if (!this.slug && this.name) {
      this.slug = this.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Add timestamp to ensure uniqueness
      this.slug = `${this.slug}-${Date.now()}`;
    }
  }

  @BeforeUpdate()
  updateTimestamp() {
    this.updatedAt = new Date();
  }

  // Helper methods
  isActive(): boolean {
    return this.status === ClientStatus.ACTIVE;
  }

  isCompliant(): boolean {
    return this.complianceStatus === ComplianceStatus.COMPLIANT;
  }

  needsAudit(): boolean {
    if (!this.nextAuditDate) return true;
    return new Date() > new Date(this.nextAuditDate);
  }

  getDaysUntilAudit(): number {
    if (!this.nextAuditDate) return -1;
    const diff = new Date(this.nextAuditDate).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  getCertificateDaysRemaining(): number {
    if (!this.certificateExpiryDate) return -1;
    const diff = new Date(this.certificateExpiryDate).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}
