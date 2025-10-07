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

export enum AnalysisType {
  COMPLIANCE_GAP = 'compliance_gap',
  RISK_ASSESSMENT = 'risk_assessment',
  PREDICTIVE = 'predictive',
  TREND = 'trend',
  CONTROL_MAPPING = 'control_mapping',
}

export enum AnalysisStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface ComplianceFindings {
  gaps?: Array<{
    area: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
    controlId?: string;
    recommendation?: string;
  }>;
  score?: number;
  frameworkScores?: Record<string, number>;
  recommendations?: Array<{
    priority: string;
    area: string;
    actions: string[];
  }>;
}

export interface RiskFindings {
  overallRiskScore?: 'high' | 'medium' | 'low';
  risksByCategory?: Record<
    string,
    {
      score: string;
      factors: string[];
    }
  >;
  predictions?: {
    next30Days?: Record<string, string>;
    next90Days?: Record<string, string>;
  };
}

export interface TrendFindings {
  trends?: Record<
    string,
    {
      dataPoints: Array<{ date: string; value: number }>;
      trend: 'improving' | 'declining' | 'stable';
      forecast?: Record<string, number>;
    }
  >;
  insights?: string[];
  anomalies?: Array<{
    date: string;
    metric: string;
    expected: number;
    actual: number;
    severity: string;
    possibleCauses?: string[];
  }>;
}

export interface AnalysisMetadata {
  frameworks?: string[];
  dataPoints?: number;
  processingTime?: number;
  modelVersion?: string;
  confidence?: number;
  methodology?: string;
  [key: string]: any;
}

@Entity('compliance_analyses')
@Index(['organizationId', 'clientId'])
@Index(['type', 'status'])
@Index(['createdAt'])
export class ComplianceAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  organizationId: string;

  @Column('uuid')
  @Index()
  clientId: string;

  @Column({
    type: 'enum',
    enum: AnalysisType,
  })
  type: AnalysisType;

  @Column({
    type: 'enum',
    enum: AnalysisStatus,
    default: AnalysisStatus.PENDING,
  })
  status: AnalysisStatus;

  @Column('jsonb', { nullable: true })
  findings: ComplianceFindings | RiskFindings | TrendFindings | any;

  @Column('jsonb', { nullable: true })
  metadata: AnalysisMetadata;

  @Column('text', { nullable: true })
  description: string;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column('text', { nullable: true })
  notes: string;

  @Column('uuid', { nullable: true })
  createdBy: string;

  @Column('timestamp', { nullable: true })
  startedAt: Date;

  @Column('timestamp', { nullable: true })
  completedAt: Date;

  @Column('text', { nullable: true })
  errorMessage: string;

  @Column('text', { nullable: true })
  errorDetails: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Virtual property for client relation (not implemented in test)
  client?: any;
}
