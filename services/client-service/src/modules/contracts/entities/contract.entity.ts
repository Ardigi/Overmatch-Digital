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
import { Client } from '../../clients/entities/client.entity';
import { ContractLineItem } from './contract-line-item.entity';

export enum ContractType {
  MSA = 'msa', // Master Service Agreement
  SOW = 'sow', // Statement of Work
  NDA = 'nda', // Non-Disclosure Agreement
  SUBSCRIPTION = 'subscription',
  PROJECT = 'project',
  RETAINER = 'retainer',
  AMENDMENT = 'amendment',
}

export enum ContractStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  NEGOTIATION = 'negotiation',
  SIGNED = 'signed',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  TERMINATED = 'terminated',
  RENEWED = 'renewed',
}

export enum BillingFrequency {
  ONE_TIME = 'one_time',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMI_ANNUAL = 'semi_annual',
  ANNUAL = 'annual',
  CUSTOM = 'custom',
}

export enum PaymentTerms {
  NET_0 = 'net_0',
  NET_15 = 'net_15',
  NET_30 = 'net_30',
  NET_45 = 'net_45',
  NET_60 = 'net_60',
  NET_90 = 'net_90',
  CUSTOM = 'custom',
}

@Entity('contracts')
@Index(['clientId'])
@Index(['status'])
@Index(['contractNumber'], { unique: true })
@Index(['startDate'])
@Index(['endDate'])
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  contractNumber: string;

  @Column()
  clientId: string;

  @ManyToOne(
    () => Client,
    (client) => client.contracts,
    {
      onDelete: 'CASCADE',
    }
  )
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({ nullable: true })
  parentContractId: string;

  @ManyToOne(() => Contract, { nullable: true })
  @JoinColumn({ name: 'parentContractId' })
  parentContract: Contract;

  @OneToMany(
    () => Contract,
    (contract) => contract.parentContract
  )
  amendments: Contract[];

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ContractType,
  })
  type: ContractType;

  @Column({
    type: 'enum',
    enum: ContractStatus,
    default: ContractStatus.DRAFT,
  })
  status: ContractStatus;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'date', nullable: true })
  signedDate: Date;

  @Column({ nullable: true })
  signedBy: string;

  @Column({ nullable: true })
  clientSignatory: string;

  @Column({ nullable: true })
  clientSignatoryTitle: string;

  @Column({ nullable: true })
  clientSignatoryEmail: string;

  @Column({ nullable: true })
  mspSignatory: string;

  @Column({ nullable: true })
  mspSignatoryTitle: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalValue: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  monthlyValue: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: BillingFrequency,
    default: BillingFrequency.MONTHLY,
  })
  billingFrequency: BillingFrequency;

  @Column({
    type: 'enum',
    enum: PaymentTerms,
    default: PaymentTerms.NET_30,
  })
  paymentTerms: PaymentTerms;

  @Column({ nullable: true })
  customPaymentTerms: string;

  @Column({ default: false })
  autoRenew: boolean;

  @Column({ nullable: true })
  renewalNoticePeriod: number; // Days

  @Column({ nullable: true })
  terminationNoticePeriod: number; // Days

  @Column({ type: 'simple-json', nullable: true })
  services: {
    soc1?: boolean;
    soc2?: boolean;
    iso27001?: boolean;
    hipaa?: boolean;
    penetrationTesting?: boolean;
    vulnerabilityScanning?: boolean;
    continuousMonitoring?: boolean;
    incidentResponse?: boolean;
    consulting?: boolean;
    training?: boolean;
    other?: string[];
  };

  @Column({ type: 'simple-json', nullable: true })
  deliverables: Array<{
    name?: string;
    description?: string;
    dueDate?: Date;
    completed?: boolean;
    completedDate?: Date;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  pricing: {
    basePrice?: number;
    setupFee?: number;
    discount?: {
      type?: 'percentage' | 'fixed';
      value?: number;
      reason?: string;
    };
    additionalFees?: Array<{
      name?: string;
      amount?: number;
      frequency?: string;
    }>;
    priceAdjustments?: Array<{
      date?: Date;
      oldPrice?: number;
      newPrice?: number;
      reason?: string;
      approvedBy?: string;
    }>;
  };

  @Column({ type: 'simple-json', nullable: true })
  sla: {
    responseTime?: string;
    resolutionTime?: string;
    uptime?: number;
    supportHours?: string;
    escalationProcess?: string;
    penalties?: Array<{
      condition?: string;
      penalty?: string;
    }>;
  };

  @Column({ type: 'simple-json', nullable: true })
  terms: {
    confidentiality?: boolean;
    liability?: string;
    indemnification?: string;
    governingLaw?: string;
    disputeResolution?: string;
    customTerms?: string[];
  };

  @Column({ type: 'simple-array', nullable: true })
  attachmentUrls: string[];

  @Column({ nullable: true })
  documentUrl: string;

  @Column({ nullable: true })
  signedDocumentUrl: string;

  @Column({ type: 'simple-json', nullable: true })
  renewalHistory: Array<{
    date?: Date;
    previousEndDate?: Date;
    newEndDate?: Date;
    renewedBy?: string;
    changes?: string;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  updatedBy: string;

  // Relations
  @OneToMany(
    () => ContractLineItem,
    (lineItem) => lineItem.contract
  )
  lineItems: ContractLineItem[];

  // Helper methods
  isActive(): boolean {
    return this.status === ContractStatus.ACTIVE;
  }

  isSigned(): boolean {
    return [ContractStatus.SIGNED, ContractStatus.ACTIVE].includes(this.status);
  }

  isExpired(): boolean {
    return new Date() > new Date(this.endDate);
  }

  isExpiringSoon(days: number = 90): boolean {
    const expiryDate = new Date(this.endDate);
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + days);
    return expiryDate <= warningDate;
  }

  getDaysRemaining(): number {
    const diff = new Date(this.endDate).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  getContractDuration(): number {
    const diff = new Date(this.endDate).getTime() - new Date(this.startDate).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  calculateAnnualValue(): number {
    switch (this.billingFrequency) {
      case BillingFrequency.MONTHLY:
        return this.monthlyValue * 12;
      case BillingFrequency.QUARTERLY:
        return this.monthlyValue * 4;
      case BillingFrequency.SEMI_ANNUAL:
        return this.monthlyValue * 2;
      case BillingFrequency.ANNUAL:
        return Number(this.totalValue);
      default:
        return Number(this.totalValue);
    }
  }
}
