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
import { SOCAudit } from './soc-audit.entity';

export enum FindingSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  OBSERVATION = 'OBSERVATION',
}

export enum FindingStatus {
  IDENTIFIED = 'IDENTIFIED',
  CONFIRMED = 'CONFIRMED',
  IN_REMEDIATION = 'IN_REMEDIATION',
  REMEDIATED = 'REMEDIATED',
  ACCEPTED = 'ACCEPTED',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED',
}

export enum FindingType {
  CONTROL_DEFICIENCY = 'CONTROL_DEFICIENCY',
  CONTROL_GAP = 'CONTROL_GAP',
  OPERATING_EFFECTIVENESS = 'OPERATING_EFFECTIVENESS',
  DESIGN_DEFICIENCY = 'DESIGN_DEFICIENCY',
  DOCUMENTATION_GAP = 'DOCUMENTATION_GAP',
  POLICY_VIOLATION = 'POLICY_VIOLATION',
  COMPLIANCE_GAP = 'COMPLIANCE_GAP',
}

@Entity('audit_findings')
@Index('idx_finding_audit', ['auditId'])
@Index('idx_finding_control', ['controlId'])
@Index('idx_finding_status', ['status'])
@Index('idx_finding_severity', ['severity'])
export class AuditFinding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  findingNumber: string;

  @Column()
  auditId: string;

  @ManyToOne(() => SOCAudit)
  @JoinColumn({ name: 'auditId' })
  audit: SOCAudit;

  @Column()
  controlId: string;

  @Column()
  controlCode: string;

  @Column()
  controlName: string;

  @Column({
    type: 'enum',
    enum: FindingType,
  })
  findingType: FindingType;

  @Column({
    type: 'enum',
    enum: FindingSeverity,
  })
  severity: FindingSeverity;

  @Column({
    type: 'enum',
    enum: FindingStatus,
    default: FindingStatus.IDENTIFIED,
  })
  status: FindingStatus;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column('text')
  condition: string;

  @Column('text')
  criteria: string;

  @Column('text')
  cause: string;

  @Column('text')
  effect: string;

  @Column('text')
  recommendation: string;

  // Risk and Impact
  @Column({
    type: 'enum',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM',
  })
  riskRating: string;

  @Column('simple-array', { default: '' })
  affectedTrustServiceCriteria: string[];

  @Column('text', { nullable: true })
  businessImpact: string;

  @Column({ default: false })
  isSystematic: boolean;

  @Column({ default: false })
  isPervasive: boolean;

  @Column({ default: false })
  isCompensatingControlsExist: boolean;

  // Management Response
  @Column('text', { nullable: true })
  managementResponse: string;

  @Column({ nullable: true })
  managementResponseBy: string;

  @Column({ type: 'date', nullable: true })
  managementResponseDate: Date;

  @Column({ type: 'date', nullable: true })
  targetRemediationDate: Date;

  @Column({ nullable: true })
  remediationOwner: string;

  @Column('text', { nullable: true })
  remediationPlan: string;

  // Evidence and Testing
  @Column('simple-array', { default: '' })
  evidenceIds: string[];

  @Column('text', { nullable: true })
  testingProcedures: string;

  @Column({ type: 'date', nullable: true })
  testingDate: Date;

  @Column({ nullable: true })
  testedBy: string;

  @Column({ default: 0 })
  sampleSize: number;

  @Column({ default: 0 })
  exceptionsFound: number;

  // Remediation Tracking
  @Column({ type: 'date', nullable: true })
  remediationStartDate: Date;

  @Column({ type: 'date', nullable: true })
  remediationCompleteDate: Date;

  @Column('text', { nullable: true })
  remediationEvidence: string;

  @Column({ nullable: true })
  remediationValidatedBy: string;

  @Column({ type: 'date', nullable: true })
  remediationValidationDate: Date;

  @Column({ default: false })
  requiresRetest: boolean;

  @Column({ type: 'date', nullable: true })
  retestDate: Date;

  @Column('text', { nullable: true })
  retestResults: string;

  // Related Findings
  @Column('simple-array', { default: '' })
  relatedFindingIds: string[];

  @Column({ nullable: true })
  rootCauseFindingId: string;

  // Prior Year
  @Column({ default: false })
  isPriorYearFinding: boolean;

  @Column({ nullable: true })
  priorYearFindingId: string;

  @Column({ default: false })
  isRecurring: boolean;

  @Column({ default: 0 })
  occurrenceCount: number;

  // Reporting
  @Column({ default: true })
  includeInReport: boolean;

  @Column('text', { nullable: true })
  reportNarrative: string;

  @Column({ nullable: true })
  reportSection: string;

  @Column({ default: 0 })
  reportOrder: number;

  // Workflow
  @Column({ nullable: true })
  assignedTo: string;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({ type: 'date', nullable: true })
  reviewDate: Date;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ type: 'date', nullable: true })
  approvalDate: Date;

  // Communication
  @Column({ default: false })
  communicatedToClient: boolean;

  @Column({ type: 'date', nullable: true })
  clientCommunicationDate: Date;

  @Column('text', { nullable: true })
  clientFeedback: string;

  // Metadata
  @Column('jsonb', { nullable: true })
  customFields: Record<string, any>;

  @Column('simple-array', { default: '' })
  tags: string[];

  @Column('text', { nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  createdBy: string;

  @Column()
  updatedBy: string;
}
