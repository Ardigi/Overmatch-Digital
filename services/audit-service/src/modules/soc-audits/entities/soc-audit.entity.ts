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

export enum AuditType {
  SOC1_TYPE1 = 'SOC1_TYPE1',
  SOC1_TYPE2 = 'SOC1_TYPE2',
  SOC2_TYPE1 = 'SOC2_TYPE1',
  SOC2_TYPE2 = 'SOC2_TYPE2',
  SOC3 = 'SOC3',
  SOCPS = 'SOCPS',
}

export enum AuditStatus {
  PLANNING = 'PLANNING',
  IN_FIELDWORK = 'IN_FIELDWORK',
  REVIEW = 'REVIEW',
  DRAFT_REPORT = 'DRAFT_REPORT',
  FINAL_REVIEW = 'FINAL_REVIEW',
  COMPLETED = 'COMPLETED',
  ON_HOLD = 'ON_HOLD',
  CANCELLED = 'CANCELLED',
}

export enum AuditPhase {
  KICKOFF = 'KICKOFF',
  RISK_ASSESSMENT = 'RISK_ASSESSMENT',
  CONTROL_DESIGN = 'CONTROL_DESIGN',
  CONTROL_TESTING = 'CONTROL_TESTING',
  DEFICIENCY_REMEDIATION = 'DEFICIENCY_REMEDIATION',
  REPORT_PREPARATION = 'REPORT_PREPARATION',
  QUALITY_REVIEW = 'QUALITY_REVIEW',
  ISSUANCE = 'ISSUANCE',
}

@Entity('soc_audits')
@Index('idx_audit_client', ['clientId'])
@Index('idx_audit_status', ['status'])
@Index('idx_audit_dates', ['auditPeriodStart', 'auditPeriodEnd'])
export class SOCAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index('idx_audit_number')
  auditNumber: string;

  @Column()
  clientId: string;

  @Column()
  organizationId: string;

  @Column({
    type: 'enum',
    enum: AuditType,
  })
  auditType: AuditType;

  @Column({
    type: 'enum',
    enum: AuditStatus,
    default: AuditStatus.PLANNING,
  })
  status: AuditStatus;

  @Column({
    type: 'enum',
    enum: AuditPhase,
    default: AuditPhase.KICKOFF,
  })
  currentPhase: AuditPhase;

  @Column({ type: 'date' })
  auditPeriodStart: Date;

  @Column({ type: 'date' })
  auditPeriodEnd: Date;

  @Column({ type: 'date', nullable: true })
  reportDate: Date;

  @Column({ type: 'date', nullable: true })
  plannedCompletionDate: Date;

  @Column({ type: 'date', nullable: true })
  actualCompletionDate: Date;

  // Trust Services Criteria
  @Column('simple-array', { default: '' })
  trustServiceCriteria: string[]; // ['SECURITY', 'AVAILABILITY', 'PROCESSING_INTEGRITY', 'CONFIDENTIALITY', 'PRIVACY']

  // Audit Team
  @Column()
  leadAuditorId: string;

  @Column()
  engagementPartnerId: string;

  @Column('simple-array', { default: '' })
  auditTeamIds: string[];

  @Column({ nullable: true })
  qualityReviewerId: string;

  // CPA Firm Information
  @Column()
  cpaFirmId: string;

  @Column()
  cpaFirmName: string;

  @Column({ nullable: true })
  cpaEngagementLetter: string;

  // Scope and Objectives
  @Column('text')
  auditObjectives: string;

  @Column('text')
  scopeDescription: string;

  @Column('simple-array', { default: '' })
  inScopeServices: string[];

  @Column('simple-array', { default: '' })
  inScopeLocations: string[];

  @Column('simple-array', { default: '' })
  outOfScopeItems: string[];

  // Control Framework
  @Column({ nullable: true })
  controlFrameworkId: string;

  @Column({ default: 0 })
  totalControls: number;

  @Column({ default: 0 })
  testedControls: number;

  @Column({ default: 0 })
  effectiveControls: number;

  @Column({ default: 0 })
  deficientControls: number;

  // Risk Assessment
  @Column({
    type: 'enum',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM',
  })
  overallRiskRating: string;

  @Column('jsonb', { nullable: true })
  riskFactors: Record<string, any>;

  // Report Details
  @Column({ nullable: true })
  reportTemplateId: string;

  @Column({ nullable: true })
  draftReportUrl: string;

  @Column({ nullable: true })
  finalReportUrl: string;

  @Column({ type: 'date', nullable: true })
  reportIssuedDate: Date;

  @Column({ default: false })
  hasQualifiedOpinion: boolean;

  @Column('text', { nullable: true })
  opinionModifications: string;

  // Management Assertions
  @Column({ default: false })
  managementAssertionReceived: boolean;

  @Column({ type: 'date', nullable: true })
  managementAssertionDate: Date;

  @Column({ nullable: true })
  managementAssertionDocument: string;

  // Compliance
  @Column('jsonb', { nullable: true })
  complianceRequirements: Record<string, any>;

  @Column('simple-array', { default: '' })
  regulatoryFrameworks: string[]; // ['HIPAA', 'PCI', 'GDPR', etc.]

  // Metrics
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  completionPercentage: number;

  @Column({ default: 0 })
  totalFindings: number;

  @Column({ default: 0 })
  criticalFindings: number;

  @Column({ default: 0 })
  majorFindings: number;

  @Column({ default: 0 })
  minorFindings: number;

  @Column({ default: 0 })
  remediatedFindings: number;

  // Budget and Timeline
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  budgetedHours: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  actualHours: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  budgetedCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  actualCost: number;

  // Communication
  @Column({ default: 0 })
  clientMeetingsHeld: number;

  @Column({ type: 'date', nullable: true })
  lastClientCommunication: Date;

  @Column({ type: 'date', nullable: true })
  nextScheduledMeeting: Date;

  // Quality Assurance
  @Column({ default: false })
  peerReviewCompleted: boolean;

  @Column({ type: 'date', nullable: true })
  peerReviewDate: Date;

  @Column('text', { nullable: true })
  peerReviewComments: string;

  @Column({ default: false })
  qualityReviewPassed: boolean;

  @Column({ type: 'date', nullable: true })
  qualityReviewDate: Date;

  // Archive
  @Column({ default: false })
  isArchived: boolean;

  @Column({ type: 'date', nullable: true })
  archiveDate: Date;

  @Column({ nullable: true })
  archiveLocation: string;

  // Metadata
  @Column('jsonb', { nullable: true })
  customFields: Record<string, any>;

  @Column('simple-array', { default: '' })
  tags: string[];

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  createdBy: string;

  @Column()
  updatedBy: string;

  // Relations will be added as we create other entities
}
