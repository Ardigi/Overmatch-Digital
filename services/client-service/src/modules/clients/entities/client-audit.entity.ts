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
import { Client, ComplianceFramework } from './client.entity';

export enum AuditType {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  READINESS = 'readiness',
  SURVEILLANCE = 'surveillance',
  RECERTIFICATION = 'recertification',
}

export enum AuditStatus {
  PLANNED = 'planned',
  SCHEDULED = 'scheduled',
  IN_PREPARATION = 'in_preparation',
  IN_PROGRESS = 'in_progress',
  FIELD_WORK_COMPLETE = 'field_work_complete',
  PENDING_REPORT = 'pending_report',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum AuditResult {
  PASSED = 'passed',
  PASSED_WITH_CONDITIONS = 'passed_with_conditions',
  FAILED = 'failed',
  PENDING = 'pending',
}

export enum AuditScope {
  FULL = 'full',
  LIMITED = 'limited',
  FOCUSED = 'focused',
}

@Entity('client_audits')
@Index(['clientId'])
@Index(['status'])
@Index(['framework'])
@Index(['scheduledStartDate'])
export class ClientAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @ManyToOne(
    () => Client,
    (client) => client.audits,
    {
      onDelete: 'CASCADE',
    }
  )
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: AuditType,
    enumName: 'audit_type',
  })
  type: AuditType;

  @Column({
    type: 'enum',
    enum: AuditStatus,
    enumName: 'audit_status',
    default: AuditStatus.PLANNED,
  })
  status: AuditStatus;

  @Column({
    type: 'enum',
    enum: ComplianceFramework,
    enumName: 'compliance_framework',
  })
  framework: ComplianceFramework;

  @Column({
    type: 'enum',
    enum: AuditScope,
    enumName: 'audit_scope',
    default: AuditScope.FULL,
  })
  scope: AuditScope;

  @Column({ type: 'date' })
  scheduledStartDate: Date;

  @Column({ type: 'date' })
  scheduledEndDate: Date;

  @Column({ type: 'date', nullable: true })
  actualStartDate: Date;

  @Column({ type: 'date', nullable: true })
  actualEndDate: Date;

  @Column({ type: 'date', nullable: true })
  reportDueDate: Date;

  @Column({ type: 'date', nullable: true })
  reportDeliveredDate: Date;

  @Column({ nullable: true })
  leadAuditorId: string;

  @Column({ type: 'simple-array', nullable: true })
  auditTeamIds: string[];

  @Column({ nullable: true })
  auditFirmId: string;

  @Column({ nullable: true })
  auditFirmName: string;

  @Column({
    type: 'enum',
    enum: AuditResult,
    enumName: 'audit_result',
    nullable: true,
  })
  result: AuditResult;

  @Column({ nullable: true })
  certificateNumber: string;

  @Column({ type: 'date', nullable: true })
  certificateIssueDate: Date;

  @Column({ type: 'date', nullable: true })
  certificateExpiryDate: Date;

  @Column({ type: 'simple-json', nullable: true })
  scopeDetails: {
    locations?: string[];
    departments?: string[];
    systems?: string[];
    processes?: string[];
    exclusions?: string[];
    controlObjectives?: string[];
  };

  @Column({ type: 'simple-json', nullable: true })
  findings: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    observations?: number;
    totalFindings?: number;
  };

  @Column({ type: 'simple-array', nullable: true })
  findingIds: string[];

  @Column({ type: 'simple-json', nullable: true })
  timeline: Array<{
    date?: Date;
    milestone?: string;
    status?: string;
    completedBy?: string;
    notes?: string;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  costBreakdown: {
    auditFee?: number;
    travelExpenses?: number;
    additionalFees?: number;
    totalCost?: number;
    currency?: string;
    invoiceNumber?: string;
    paymentStatus?: string;
  };

  @Column({ type: 'simple-array', nullable: true })
  documentIds: string[];

  @Column({ type: 'simple-array', nullable: true })
  evidenceRequestIds: string[];

  @Column({ type: 'simple-json', nullable: true })
  metrics: {
    controlsTested?: number;
    controlsPassed?: number;
    controlsFailed?: number;
    evidenceCollected?: number;
    hoursSpent?: number;
    remediationItems?: number;
  };

  @Column({ type: 'simple-json', nullable: true })
  feedback: {
    clientSatisfaction?: number;
    auditorNotes?: string;
    improvementAreas?: string[];
    commendations?: string[];
  };

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

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
    return [
      AuditStatus.IN_PREPARATION,
      AuditStatus.IN_PROGRESS,
      AuditStatus.FIELD_WORK_COMPLETE,
      AuditStatus.PENDING_REPORT,
    ].includes(this.status);
  }

  isCompleted(): boolean {
    return this.status === AuditStatus.COMPLETED;
  }

  isPassed(): boolean {
    return [AuditResult.PASSED, AuditResult.PASSED_WITH_CONDITIONS].includes(this.result);
  }

  getDuration(): number {
    if (!this.actualStartDate || !this.actualEndDate) return 0;
    const diff = new Date(this.actualEndDate).getTime() - new Date(this.actualStartDate).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  getCompletionPercentage(): number {
    const statusPercentages = {
      [AuditStatus.PLANNED]: 0,
      [AuditStatus.SCHEDULED]: 10,
      [AuditStatus.IN_PREPARATION]: 25,
      [AuditStatus.IN_PROGRESS]: 50,
      [AuditStatus.FIELD_WORK_COMPLETE]: 75,
      [AuditStatus.PENDING_REPORT]: 90,
      [AuditStatus.COMPLETED]: 100,
      [AuditStatus.CANCELLED]: 0,
    };
    return statusPercentages[this.status] || 0;
  }
}
