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
import { SOCAudit } from './soc-audit.entity';

export enum ProgramStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum ProcedureStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  DEFERRED = 'DEFERRED',
}

@Entity('audit_programs')
@Index('idx_program_audit', ['auditId'])
@Index('idx_program_framework', ['frameworkId'])
export class AuditProgram {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  programId: string;

  @Column()
  auditId: string;

  @ManyToOne(() => SOCAudit)
  @JoinColumn({ name: 'auditId' })
  audit: SOCAudit;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: ProgramStatus,
    default: ProgramStatus.DRAFT,
  })
  status: ProgramStatus;

  // Framework and Standards
  @Column()
  frameworkId: string;

  @Column()
  frameworkName: string;

  @Column()
  frameworkVersion: string;

  @Column('simple-array', { default: '' })
  applicableStandards: string[]; // ['AICPA TSC', 'COSO', 'COBIT', etc.]

  @Column('simple-array', { default: '' })
  trustServiceCriteria: string[];

  // Program Structure
  @Column('jsonb')
  sections: Array<{
    id: string;
    name: string;
    description: string;
    order: number;
    procedures: Array<{
      id: string;
      procedureNumber: string;
      title: string;
      objective: string;
      steps: string[];
      estimatedHours: number;
      assignedTo: string;
      status: ProcedureStatus;
      completionDate?: Date;
      workpaperRef?: string;
    }>;
  }>;

  // Risk Assessment Integration
  @Column('jsonb', { nullable: true })
  riskAssessment: {
    performedDate: Date;
    performedBy: string;
    overallRiskLevel: string;
    keyRisks: Array<{
      riskId: string;
      description: string;
      level: string;
      mitigatingControls: string[];
    }>;
  };

  // Control Selection
  @Column({ default: 0 })
  totalControls: number;

  @Column({ default: 0 })
  selectedControls: number;

  @Column('simple-array', { default: '' })
  selectedControlIds: string[];

  @Column('jsonb', { nullable: true })
  controlSelectionCriteria: {
    keyControls: boolean;
    automatedControls: boolean;
    manualControls: boolean;
    preventiveControls: boolean;
    detectiveControls: boolean;
    customCriteria: string[];
  };

  // Testing Approach
  @Column('jsonb')
  testingStrategy: {
    approach: string; // 'RISK_BASED', 'FULL_SCOPE', 'ROTATIONAL'
    samplingMethodology: string;
    testingPeriod: {
      start: Date;
      end: Date;
    };
    interimTesting: boolean;
    rollforwardProcedures: boolean;
  };

  // Resource Planning
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  estimatedHours: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  actualHours: number;

  @Column('jsonb')
  resourceAllocation: Array<{
    roleId: string;
    roleName: string;
    userId: string;
    userName: string;
    estimatedHours: number;
    actualHours: number;
  }>;

  // Timeline
  @Column({ type: 'date' })
  plannedStartDate: Date;

  @Column({ type: 'date' })
  plannedEndDate: Date;

  @Column({ type: 'date', nullable: true })
  actualStartDate: Date;

  @Column({ type: 'date', nullable: true })
  actualEndDate: Date;

  @Column('jsonb')
  milestones: Array<{
    id: string;
    name: string;
    targetDate: Date;
    completedDate?: Date;
    status: string;
    responsible: string;
  }>;

  // Materiality and Scoping
  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  materialityThreshold: number;

  @Column('text', { nullable: true })
  materialityBasis: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  tolerableErrorRate: number;

  @Column('jsonb', { nullable: true })
  scopingConsiderations: {
    significantProcesses: string[];
    significantAccounts: string[];
    keyApplications: string[];
    criticalVendors: string[];
    locations: string[];
  };

  // Prior Year Considerations
  @Column({ default: false })
  hasPriorYearProgram: boolean;

  @Column({ nullable: true })
  priorYearProgramId: string;

  @Column('jsonb', { nullable: true })
  priorYearConsiderations: {
    significantFindings: string[];
    remediatedControls: string[];
    changedProcesses: string[];
    carryforwardTests: string[];
  };

  // Review and Approval
  @Column({ nullable: true })
  preparedBy: string;

  @Column({ type: 'date', nullable: true })
  preparedDate: Date;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({ type: 'date', nullable: true })
  reviewDate: Date;

  @Column('text', { nullable: true })
  reviewComments: string;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ type: 'date', nullable: true })
  approvalDate: Date;

  // Quality Control
  @Column('jsonb', { nullable: true })
  qualityControlChecklist: {
    independenceConfirmed: boolean;
    competenceAssessed: boolean;
    professionalSkepticism: boolean;
    documentationStandards: boolean;
    supervisionAdequate: boolean;
    timelyReview: boolean;
    checkedBy: string;
    checkedDate: Date;
  };

  // Documentation References
  @Column('simple-array', { default: '' })
  templateIds: string[];

  @Column('simple-array', { default: '' })
  workpaperTemplates: string[];

  @Column('jsonb', { nullable: true })
  referenceDocuments: Array<{
    name: string;
    type: string;
    url: string;
    version: string;
  }>;

  // Progress Tracking
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  completionPercentage: number;

  @Column({ default: 0 })
  totalProcedures: number;

  @Column({ default: 0 })
  completedProcedures: number;

  @Column({ default: 0 })
  inProgressProcedures: number;

  @Column({ default: 0 })
  notStartedProcedures: number;

  // Integration Points
  @Column('simple-array', { default: '' })
  linkedWorkflowIds: string[];

  @Column('simple-array', { default: '' })
  linkedProjectIds: string[];

  @Column({ nullable: true })
  masterProgramId: string; // For multi-location audits

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
