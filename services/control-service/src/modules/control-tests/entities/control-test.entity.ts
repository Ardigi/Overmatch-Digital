import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Control } from '../../controls/entities/control.entity';

/**
 * Selected item interface for test samples
 */
interface SelectedItem {
  id: string;
  type: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * API response structure for automation results
 */
interface ApiResponse {
  endpoint: string;
  method: string;
  statusCode: number;
  headers?: Record<string, string>;
  body?: unknown;
  timestamp: Date;
}

export enum TestStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  PARTIALLY_PASSED = 'PARTIALLY_PASSED',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  ERROR = 'ERROR',
  COMPLETED = 'COMPLETED',
}

export enum TestMethod {
  MANUAL = 'MANUAL',
  AUTOMATED = 'AUTOMATED',
  HYBRID = 'HYBRID',
}

@Entity('control_tests')
export class ControlTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  controlId: string;

  @ManyToOne(
    () => Control,
    (control) => control.tests
  )
  @JoinColumn({ name: 'controlId' })
  control: Control;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid', nullable: true })
  auditId: string;

  @Column({
    type: 'enum',
    enum: TestStatus,
    default: TestStatus.SCHEDULED,
  })
  status: TestStatus;

  @Column({
    type: 'enum',
    enum: TestMethod,
  })
  method: TestMethod;

  @Column({ type: 'uuid' })
  testerId: string; // User who performed the test

  @Column({ type: 'timestamp' })
  scheduledDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'integer', nullable: true })
  durationMs: number;

  @Column({ type: 'jsonb', default: {} })
  testResults: {
    overallResult: 'PASS' | 'FAIL' | 'PARTIAL';
    steps: Array<{
      stepNumber: number;
      description: string;
      result: 'PASS' | 'FAIL' | 'SKIP';
      evidence?: string[];
      notes?: string;
      timestamp: Date;
    }>;
    exceptions: Array<{
      type: string;
      description: string;
      impact: string;
      approved: boolean;
      approvedBy?: string;
    }>;
  };

  @Column({ type: 'jsonb', default: {} })
  sample: {
    populationSize: number;
    sampleSize: number;
    selectionMethod: string;
    selectedItems: SelectedItem[];
  };

  @Column({ type: 'jsonb', default: [] })
  findings: Array<{
    id: string;
    title: string;
    description: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    rootCause: string;
    impact: string;
    recommendation: string;
    managementResponse?: string;
    targetRemediationDate?: Date;
    status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  }>;

  @Column({ type: 'jsonb', default: [] })
  evidence: Array<{
    id: string;
    type: string;
    name: string;
    description: string;
    url: string;
    hash: string;
    collectedAt: Date;
    collectedBy: string;
    verified: boolean;
  }>;

  @Column({ type: 'text', nullable: true })
  testNotes: string;

  @Column({ type: 'text', nullable: true })
  reviewerNotes: string;

  @Column({ type: 'uuid', nullable: true })
  reviewedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'jsonb', default: {} })
  automationResults: {
    scriptOutput?: Record<string, unknown>;
    apiResponses?: ApiResponse[];
    logs?: string[];
    metrics?: Record<string, number>;
  };

  @Column({ type: 'jsonb', default: {} })
  performanceMetrics: {
    cpuUsage?: number;
    memoryUsage?: number;
    networkLatency?: number;
    customMetrics?: Record<string, number>;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
