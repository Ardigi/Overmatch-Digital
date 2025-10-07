import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Control } from './control.entity';

export enum TestResultStatus {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  PARTIALLY_PASSED = 'PARTIALLY_PASSED',
  NOT_TESTED = 'NOT_TESTED',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export enum TestMethod {
  MANUAL = 'MANUAL',
  AUTOMATED = 'AUTOMATED',
  HYBRID = 'HYBRID',
}

@Entity('control_test_results')
export class ControlTestResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  controlId: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid' })
  testedBy: string;

  @Column({ type: 'uuid' })
  executedBy: string;

  @Column({ type: 'timestamp' })
  testDate: Date;

  @Column({
    type: 'enum',
    enum: TestResultStatus,
  })
  result: TestResultStatus;

  @Column({
    type: 'enum',
    enum: TestResultStatus,
    default: TestResultStatus.NOT_TESTED,
  })
  status: TestResultStatus;

  @Column({
    type: 'enum',
    enum: TestMethod,
    default: TestMethod.MANUAL,
  })
  testMethod: TestMethod;

  @Column({ type: 'integer', nullable: true })
  duration: number; // in minutes

  @Column({ type: 'jsonb', default: [] })
  testProcedures: Array<{
    step: string;
    result: 'pass' | 'fail' | 'skip';
    notes?: string;
    evidence?: string;
  }>;

  @Column({ type: 'jsonb', default: [] })
  findings: Array<{
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    recommendation: string;
    managementResponse?: string;
    targetRemediationDate?: Date;
  }>;

  @Column({ type: 'jsonb', default: [] })
  evidence: string[]; // Array of file paths or URLs

  @Column({ type: 'jsonb', default: {} })
  sampleData: {
    populationSize?: number;
    sampleSize?: number;
    samplingMethod?: string;
    exceptions?: number;
    errorRate?: number;
  };

  @Column({ type: 'text', nullable: true })
  testNotes: string;

  @Column({ type: 'text', nullable: true })
  managementComments: string;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvalDate: Date;

  @Column({ type: 'jsonb', default: {} })
  automationDetails: {
    scriptName?: string;
    scriptVersion?: string;
    executionLog?: string;
    errorLog?: string;
  };

  @Column({ type: 'boolean', default: false })
  isRetest: boolean;

  @Column({ type: 'uuid', nullable: true })
  previousTestId: string; // Reference to previous test if this is a retest

  @Column({ type: 'jsonb', default: {} })
  metrics: {
    coveragePercentage?: number;
    defectDensity?: number;
    testEffectiveness?: number;
  };

  @Column({ type: 'jsonb', default: {} })
  details: Record<string, any>; // Generic details property for additional test result information

  @ManyToOne(
    () => Control,
    (control) => control.testResults
  )
  @JoinColumn({ name: 'controlId' })
  control: Control;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
