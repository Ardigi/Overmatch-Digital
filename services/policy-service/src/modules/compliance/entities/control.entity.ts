import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Policy } from '../../policies/entities/policy.entity';
import { ComplianceFramework } from './framework.entity';
import type { ControlCustomFields } from '../../policies/types/policy.types';
import type {
  AutomationResults,
  EvidenceInput,
  AssessmentInput,
} from '../interfaces/control-automation.interface';

interface ControlAuditDetails {
  auditor?: string;
  findings?: string[];
  recommendations?: string[];
  [key: string]: unknown;
}

// Evidence type definition
type EvidenceType = 'document' | 'screenshot' | 'log' | 'report' | 'attestation' | 'other';

export enum ControlPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum ControlCategory {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
  COMPENSATING = 'compensating',
  ADMINISTRATIVE = 'administrative',
  TECHNICAL = 'technical',
  PHYSICAL = 'physical',
}

export enum ImplementationStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  PARTIAL = 'partial',
  IMPLEMENTED = 'implemented',
  NOT_IMPLEMENTED = 'not_implemented',
  NOT_APPLICABLE = 'not_applicable',
}

export enum EvidenceStatus {
  PENDING_COLLECTION = 'pending_collection',
  PENDING_REVIEW = 'pending_review',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum ControlType {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
  COMPENSATING = 'compensating',
  DIRECTIVE = 'directive',
}

export enum ControlFrequency {
  CONTINUOUS = 'continuous',
  PERIODIC = 'periodic',
  ON_DEMAND = 'on_demand',
  ANNUAL = 'annual',
  QUARTERLY = 'quarterly',
  MONTHLY = 'monthly',
  WEEKLY = 'weekly',
  DAILY = 'daily',
}

export enum ControlStatus {
  NOT_IMPLEMENTED = 'not_implemented',
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  IMPLEMENTED = 'implemented',
  PARTIALLY_EFFECTIVE = 'partially_effective',
  EFFECTIVE = 'effective',
  NOT_EFFECTIVE = 'not_effective',
  NEEDS_IMPROVEMENT = 'needs_improvement',
  UNDER_REVIEW = 'under_review',
  RETIRED = 'retired',
  NOT_APPLICABLE = 'not_applicable',
}

@Entity('compliance_controls')
@Index(['frameworkId', 'controlId'])
@Index(['organizationId', 'implementationStatus'])
@Index(['category', 'priority'])
export class Control {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  controlId: string; // e.g., 'CC6.1', 'A.9.1.1', 'AC-1'

  @Column()
  identifier: string; // Framework-specific identifier

  @Column('uuid')
  frameworkId: string;

  @ManyToOne(
    () => ComplianceFramework,
    (framework) => framework.controls
  )
  @JoinColumn({ name: 'frameworkId' })
  framework: ComplianceFramework;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: ControlCategory })
  category: ControlCategory;

  @Column({ type: 'enum', enum: ControlType })
  type: ControlType;

  @Column({ type: 'enum', enum: ControlPriority, default: ControlPriority.MEDIUM })
  priority: ControlPriority;

  @Column({ type: 'enum', enum: ControlFrequency, default: ControlFrequency.PERIODIC })
  frequency: ControlFrequency;

  @Column('uuid')
  organizationId: string;

  // Owner information
  @Column('uuid')
  ownerId: string;

  @Column()
  ownerName: string;

  @Column({ nullable: true })
  ownerEmail?: string;

  // Control details
  @Column({ type: 'jsonb', nullable: true })
  requirements?: string[];

  @Column({ type: 'text', nullable: true })
  objective?: string;

  @Column({ type: 'text', nullable: true })
  rationale?: string;

  @Column({ type: 'text', nullable: true })
  implementationGuidance?: string;

  @Column({ type: 'simple-array', nullable: true })
  assessmentCriteria?: string[];

  @Column({ type: 'simple-array', nullable: true })
  references?: string[];

  @Column({ type: 'jsonb', nullable: true })
  testingGuidance?: {
    procedures?: string[];
    frequency?: string;
    sampleSize?: string;
    keyAttributes?: string[];
    expectedEvidence?: string[];
  };

  // Implementation
  @Column({ type: 'enum', enum: ImplementationStatus, default: ImplementationStatus.NOT_STARTED })
  implementationStatus: ImplementationStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  implementationScore: number; // 0-100

  @Column({ type: 'text', nullable: true })
  implementationNotes?: string;

  @Column({ type: 'timestamptz', nullable: true })
  implementationDate?: Date;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'jsonb', nullable: true })
  implementationDetails?: {
    approach?: string;
    tools?: string[];
    responsible?: string;
    timeline?: {
      plannedStart?: Date;
      plannedEnd?: Date;
      actualStart?: Date;
      actualEnd?: Date;
    };
    milestones?: Array<{
      name: string;
      targetDate: Date;
      completedDate?: Date;
      status: string;
    }>;
  };

  @Column({ type: 'jsonb', nullable: true })
  gaps?: Array<{
    id: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    identifiedDate: Date;
    targetResolutionDate?: Date;
    resolvedDate?: Date;
    remediationPlan?: string;
    status: 'open' | 'in_progress' | 'resolved' | 'accepted';
  }>;

  // Evidence
  @Column({ type: 'jsonb', nullable: true })
  evidence?: Array<{
    id: string;
    type: 'document' | 'screenshot' | 'log' | 'report' | 'attestation' | 'other';
    title: string;
    description?: string;
    location: string; // URL or path
    collectedDate: Date;
    collectedBy: string;
    validUntil?: Date;
    status: EvidenceStatus;
    reviewedBy?: string;
    reviewedDate?: Date;
    reviewComments?: string;
    tags?: string[];
  }>;

  // Evidence requirements from DTOs
  @Column({ type: 'jsonb', nullable: true })
  evidenceRequirements?: Array<{
    type: string;
    description: string;
    frequency?: string;
    retentionPeriod?: string;
  }>;

  // Evidence IDs for linking to evidence service
  @Column({ type: 'simple-array', nullable: true })
  evidenceIds?: string[];

  // Relationships
  @Column({ type: 'simple-array', nullable: true })
  relatedPolicies?: string[]; // Policy IDs

  @Column({ type: 'jsonb', nullable: true })
  crossFrameworkMappings?: Array<{
    frameworkId: string;
    controlId: string;
    mappingType: 'equivalent' | 'partial' | 'related';
    mappingStrength: number; // 0-100
    notes?: string;
  }>;

  @Column({ type: 'simple-array', nullable: true })
  compensatingControls?: string[]; // Control IDs

  @Column({ type: 'simple-array', nullable: true })
  dependencies?: string[]; // Control IDs that must be implemented first

  // Assessment
  @Column({ type: 'timestamptz', nullable: true })
  lastAssessmentDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  nextAssessmentDate?: Date;

  @Column({ type: 'jsonb', nullable: true })
  assessmentHistory?: Array<{
    date: Date;
    assessor: string;
    score: number;
    findings?: string[];
    recommendations?: string[];
    status: 'passed' | 'failed' | 'partial';
  }>;

  // Risk
  @Column({ type: 'jsonb', nullable: true })
  riskAssessment?: {
    inherentRisk?: {
      likelihood: number; // 1-5
      impact: number; // 1-5
      score: number;
      level: 'low' | 'medium' | 'high' | 'critical';
    };
    residualRisk?: {
      likelihood: number;
      impact: number;
      score: number;
      level: 'low' | 'medium' | 'high' | 'critical';
    };
    riskAppetite?: 'low' | 'medium' | 'high';
    riskTreatment?: 'accept' | 'mitigate' | 'transfer' | 'avoid';
    risksAddressed?: string[];
  };

  // Automation
  @Column({ type: 'boolean', default: false })
  isAutomated: boolean;

  @Column({ type: 'jsonb', nullable: true })
  automationConfig?: {
    tool?: string;
    script?: string;
    schedule?: string;
    lastRun?: Date;
    nextRun?: Date;
    status?: 'active' | 'inactive' | 'error';
    results?: AutomationResults;
  };

  // Metadata
  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ type: 'simple-array', nullable: true })
  keywords?: string[];

  @Column({ type: 'jsonb', nullable: true })
  customFields?: ControlCustomFields;

  // Change history for tracking modifications
  @Column({ type: 'jsonb', nullable: true })
  changeHistory?: Array<{
    version: number;
    changedBy: string;
    changedAt: Date;
    changes: {
      summary: string;
      details?: ControlAuditDetails;
      fields?: string[];
    };
    approved?: boolean;
    approvedBy?: string;
  }>;

  @Column('uuid')
  createdBy: string;

  @Column('uuid')
  updatedBy: string;

  // Additional fields for testing and risk
  @Column({ type: 'enum', enum: ControlStatus, nullable: true })
  status?: ControlStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  riskScore?: number;

  @Column({ type: 'jsonb', nullable: true })
  testResults?: Array<{
    id: string;
    date: Date;
    result: string;
    findings: string[];
    tester: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  testHistory?: Array<{
    id: string;
    date: Date;
    result: string;
    findings: string[];
    tester: string;
  }>;

  @Column({ type: 'timestamptz', nullable: true })
  lastTestDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  nextTestDate?: Date;

  @Column({ type: 'enum', enum: ControlFrequency, nullable: true })
  testFrequency?: ControlFrequency;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Policy relationship
  @ManyToMany(
    () => Policy,
    (policy) => policy.controls
  )
  policies?: Policy[];

  // Methods
  calculateImplementationScore(): void {
    let score = 0;
    let factors = 0;

    // Base score from status
    const statusScores = {
      [ImplementationStatus.IMPLEMENTED]: 100,
      [ImplementationStatus.PARTIAL]: 50,
      [ImplementationStatus.IN_PROGRESS]: 25,
      [ImplementationStatus.NOT_STARTED]: 0,
      [ImplementationStatus.NOT_APPLICABLE]: 100,
    };
    score += statusScores[this.implementationStatus];
    factors++;

    // Evidence completeness
    if (this.evidence && this.evidence.length > 0) {
      const approvedEvidence = this.evidence.filter((e) => e.status === EvidenceStatus.APPROVED);
      const evidenceScore = (approvedEvidence.length / this.evidence.length) * 100;
      score += evidenceScore;
      factors++;
    }

    // Gap remediation
    if (this.gaps && this.gaps.length > 0) {
      const resolvedGaps = this.gaps.filter((g) => g.status === 'resolved');
      const gapScore = (resolvedGaps.length / this.gaps.length) * 100;
      score += gapScore;
      factors++;
    }

    this.implementationScore = factors > 0 ? score / factors : 0;
  }

  addEvidence(evidence: EvidenceInput): void {
    if (!this.evidence) this.evidence = [];
    // Map EvidenceInput to the entity's evidence structure
    const evidenceEntry = {
      id: `evidence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: (evidence.type?.toLowerCase() || 'document') as 'document' | 'screenshot' | 'log' | 'report' | 'attestation' | 'other',
      title: evidence.title,
      description: evidence.description,
      location: evidence.url || evidence.filePath || '',
      collectedDate: evidence.collectedAt,
      collectedBy: evidence.collectedBy,
      validUntil: evidence.validity?.to,
      status: EvidenceStatus.PENDING_REVIEW,
      reviewedBy: evidence.review?.reviewedBy,
      reviewedDate: evidence.review?.reviewedAt,
      reviewComments: evidence.review?.comments,
      tags: evidence.metadata?.relationships?.controls,
    };
    this.evidence.push(evidenceEntry);
  }

  updateAssessment(assessment: AssessmentInput): void {
    if (!this.assessmentHistory) this.assessmentHistory = [];
    // Map AssessmentInput to the entity's assessmentHistory structure
    const assessmentEntry = {
      date: assessment.assessmentDate,
      assessor: assessment.assessorId,
      score: assessment.score || 0,
      findings: assessment.findings?.map(f => f.description),
      recommendations: assessment.recommendations?.map(r => r.description),
      status: assessment.status === 'compliant' ? 'passed' as const : 
              assessment.status === 'non-compliant' ? 'failed' as const : 
              'partial' as const,
    };
    this.assessmentHistory.push(assessmentEntry);
    this.lastAssessmentDate = assessment.assessmentDate;

    // Calculate next assessment date based on risk and priority
    const months =
      this.priority === ControlPriority.CRITICAL
        ? 3
        : this.priority === ControlPriority.HIGH
          ? 6
          : this.priority === ControlPriority.MEDIUM
            ? 12
            : 18;

    const nextDate = new Date(assessment.assessmentDate);
    nextDate.setMonth(nextDate.getMonth() + months);
    this.nextAssessmentDate = nextDate;
  }

  isExpiredEvidence(): boolean {
    if (!this.evidence || this.evidence.length === 0) return true;

    const now = new Date();
    const validEvidence = this.evidence.filter(
      (e) => e.status === EvidenceStatus.APPROVED && (!e.validUntil || e.validUntil > now)
    );

    return validEvidence.length === 0;
  }

  addTestResult(result: {
    date: Date;
    passed: boolean;
    score?: number;
    findings?: string[];
    tester: string;
  }): void {
    if (!this.assessmentHistory) this.assessmentHistory = [];

    this.assessmentHistory.push({
      date: result.date,
      assessor: result.tester,
      score: result.score || (result.passed ? 100 : 0),
      findings: result.findings || [],
      recommendations: [],
      status: result.passed ? 'passed' : 'failed',
    });

    this.lastAssessmentDate = result.date;
    this.calculateImplementationScore();
  }

  updateEffectiveness(score: number, findings?: string[]): void {
    this.implementationScore = score;

    if (findings && findings.length > 0) {
      if (!this.gaps) this.gaps = [];

      findings.forEach((finding) => {
        this.gaps.push({
          id: `gap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          description: finding,
          identifiedDate: new Date(),
          severity: score < 50 ? 'critical' : score < 70 ? 'high' : 'medium',
          status: 'open',
        });
      });
    }

    this.calculateImplementationScore();
  }
}
