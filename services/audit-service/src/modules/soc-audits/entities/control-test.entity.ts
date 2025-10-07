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

export enum TestStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REVIEW = 'REVIEW',
  APPROVED = 'APPROVED',
  REQUIRES_RETEST = 'REQUIRES_RETEST',
}

export enum TestResult {
  NOT_TESTED = 'NOT_TESTED',
  EFFECTIVE = 'EFFECTIVE',
  PARTIALLY_EFFECTIVE = 'PARTIALLY_EFFECTIVE',
  NOT_EFFECTIVE = 'NOT_EFFECTIVE',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export enum TestType {
  INQUIRY = 'INQUIRY',
  OBSERVATION = 'OBSERVATION',
  INSPECTION = 'INSPECTION',
  REPERFORMANCE = 'REPERFORMANCE',
  RECALCULATION = 'RECALCULATION',
  CONFIRMATION = 'CONFIRMATION',
  ANALYTICAL = 'ANALYTICAL',
}

@Entity('control_tests')
@Index('idx_test_audit', ['auditId'])
@Index('idx_test_control', ['controlId'])
@Index('idx_test_status', ['status'])
export class ControlTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  testId: string;

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
    enum: TestStatus,
    default: TestStatus.NOT_STARTED,
  })
  status: TestStatus;

  @Column({
    type: 'enum',
    enum: TestResult,
    default: TestResult.NOT_TESTED,
  })
  result: TestResult;

  // Test Design
  @Column('text')
  controlObjective: string;

  @Column('text')
  testObjective: string;

  @Column('simple-array')
  testTypes: TestType[];

  @Column('text')
  testProcedures: string;

  @Column('simple-array', { default: '' })
  trustServiceCriteria: string[];

  // Sampling
  @Column()
  populationSize: number;

  @Column()
  sampleSize: number;

  @Column({
    type: 'enum',
    enum: ['STATISTICAL', 'JUDGMENTAL', 'FULL_POPULATION'],
    default: 'JUDGMENTAL',
  })
  samplingMethod: string;

  @Column('text', { nullable: true })
  sampleSelectionCriteria: string;

  @Column('simple-array', { default: '' })
  sampleItemIds: string[];

  // Test Execution
  @Column({ nullable: true })
  testerId: string;

  @Column({ nullable: true })
  testerName: string;

  @Column({ type: 'date', nullable: true })
  testStartDate: Date;

  @Column({ type: 'date', nullable: true })
  testEndDate: Date;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  hoursSpent: number;

  // Test Evidence
  @Column('simple-array', { default: '' })
  evidenceIds: string[];

  @Column('text', { nullable: true })
  evidenceDescription: string;

  @Column('simple-array', { default: '' })
  workpaperReferences: string[];

  // Test Results
  @Column({ default: 0 })
  exceptionsFound: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  errorRate: number;

  @Column('text', { nullable: true })
  testObservations: string;

  @Column('jsonb', { nullable: true })
  exceptionDetails: Array<{
    sampleItem: string;
    description: string;
    impact: string;
    rootCause: string;
  }>;

  @Column({ default: false })
  hasCompensatingControls: boolean;

  @Column('text', { nullable: true })
  compensatingControlsDescription: string;

  // Test Conclusion
  @Column('text', { nullable: true })
  conclusion: string;

  @Column('text', { nullable: true })
  recommendations: string;

  @Column({ default: false })
  requiresManagementAttention: boolean;

  @Column({ default: false })
  identifiedDeficiency: boolean;

  @Column({ nullable: true })
  deficiencyFindingId: string;

  // Review and Approval
  @Column({ nullable: true })
  reviewerId: string;

  @Column({ nullable: true })
  reviewerName: string;

  @Column({ type: 'date', nullable: true })
  reviewDate: Date;

  @Column('text', { nullable: true })
  reviewComments: string;

  @Column({ nullable: true })
  approverId: string;

  @Column({ nullable: true })
  approverName: string;

  @Column({ type: 'date', nullable: true })
  approvalDate: Date;

  // Retest Information
  @Column({ default: false })
  isRetest: boolean;

  @Column({ nullable: true })
  originalTestId: string;

  @Column({ default: 0 })
  retestCount: number;

  @Column('text', { nullable: true })
  retestReason: string;

  // Timing and Frequency
  @Column({
    type: 'enum',
    enum: ['ANNUAL', 'QUARTERLY', 'MONTHLY', 'WEEKLY', 'DAILY', 'CONTINUOUS', 'AD_HOC'],
    nullable: true,
  })
  controlFrequency: string;

  @Column({ type: 'date' })
  testPeriodStart: Date;

  @Column({ type: 'date' })
  testPeriodEnd: Date;

  // Risk Assessment
  @Column({
    type: 'enum',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM',
  })
  inherentRisk: string;

  @Column({
    type: 'enum',
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    nullable: true,
  })
  residualRisk: string;

  @Column({ default: false })
  isKeyControl: boolean;

  @Column({ default: false })
  isAutomated: boolean;

  @Column({ default: false })
  isITGC: boolean; // IT General Control

  // Dependencies
  @Column('simple-array', { default: '' })
  dependentControlIds: string[];

  @Column('simple-array', { default: '' })
  prerequisiteTestIds: string[];

  // Documentation
  @Column({ nullable: true })
  testPlanDocument: string;

  @Column({ nullable: true })
  testResultsDocument: string;

  @Column('jsonb', { nullable: true })
  supportingDocuments: Array<{
    name: string;
    url: string;
    uploadedAt: Date;
    uploadedBy: string;
  }>;

  // Quality Assurance
  @Column({ default: false })
  qaReviewRequired: boolean;

  @Column({ default: false })
  qaReviewCompleted: boolean;

  @Column({ nullable: true })
  qaReviewerId: string;

  @Column({ type: 'date', nullable: true })
  qaReviewDate: Date;

  @Column('text', { nullable: true })
  qaComments: string;

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
