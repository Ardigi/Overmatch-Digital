import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Control } from '../../compliance/entities/control.entity';
import type { RiskChanges } from '../../shared/types';

export enum RiskCategory {
  STRATEGIC = 'strategic',
  OPERATIONAL = 'operational',
  FINANCIAL = 'financial',
  COMPLIANCE = 'compliance',
  REPUTATIONAL = 'reputational',
  SECURITY = 'security',
  PRIVACY = 'privacy',
  TECHNOLOGY = 'technology',
  THIRD_PARTY = 'third_party',
  ENVIRONMENTAL = 'environmental',
  LEGAL = 'legal',
  PROJECT = 'project',
}

export enum RiskStatus {
  IDENTIFIED = 'identified',
  ASSESSED = 'assessed',
  ACCEPTED = 'accepted',
  MITIGATED = 'mitigated',
  TRANSFERRED = 'transferred',
  AVOIDED = 'avoided',
  MONITORING = 'monitoring',
  CLOSED = 'closed',
  ESCALATED = 'escalated',
}

export enum RiskLikelihood {
  VERY_LOW = 1,
  LOW = 2,
  MEDIUM = 3,
  HIGH = 4,
  VERY_HIGH = 5,
}

export enum RiskImpact {
  VERY_LOW = 1,
  LOW = 2,
  MEDIUM = 3,
  HIGH = 4,
  VERY_HIGH = 5,
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum RiskTreatment {
  ACCEPT = 'accept',
  MITIGATE = 'mitigate',
  TRANSFER = 'transfer',
  AVOID = 'avoid',
}

@Entity('risks')
@Index(['organizationId', 'status'])
@Index(['category', 'status'])
@Index(['ownerId'])
export class Risk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ unique: true })
  riskId: string; // e.g., "RISK-2024-001"

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: RiskCategory, enumName: 'risk_category' })
  category: RiskCategory;

  @Column({
    type: 'enum',
    enum: RiskStatus,
    enumName: 'risk_status',
    default: RiskStatus.IDENTIFIED,
  })
  status: RiskStatus;

  // Organization & Ownership
  @Column('uuid')
  organizationId: string;

  @Column('uuid')
  ownerId: string;

  @Column()
  ownerName: string;

  @Column({ nullable: true })
  ownerEmail?: string;

  @Column({ nullable: true })
  ownerDepartment?: string;

  @Column({ type: 'simple-array', nullable: true })
  stakeholders?: string[];

  // Risk Assessment
  @Column({ type: 'jsonb' })
  assessment: {
    inherentRisk: {
      likelihood: RiskLikelihood;
      impact: RiskImpact;
      score: number; // likelihood * impact
      level: RiskLevel;
      rationale?: string;
    };
    residualRisk?: {
      likelihood: RiskLikelihood;
      impact: RiskImpact;
      score: number;
      level: RiskLevel;
      rationale?: string;
    };
    targetRisk?: {
      likelihood: RiskLikelihood;
      impact: RiskImpact;
      score: number;
      level: RiskLevel;
      targetDate?: Date;
    };
    assessmentDate: Date;
    assessedBy: string;
    methodology?: string;
    assumptions?: string[];
  };

  // Risk Details
  @Column({ type: 'jsonb', nullable: true })
  details?: {
    source?: string; // Where the risk originates
    trigger?: string; // What could cause the risk to occur
    vulnerability?: string; // Weakness being exploited
    threat?: string; // Threat actor or event
    asset?: string; // What is at risk
    consequences?: Array<{
      type: string;
      description: string;
      severity: 'minor' | 'moderate' | 'major' | 'severe';
    }>;
    rootCauses?: string[];
    contributingFactors?: string[];
    earlyWarningIndicators?: string[];
    relatedRisks?: string[]; // Other risk IDs
  };

  // Impact Analysis
  @Column({ type: 'jsonb', nullable: true })
  impactAnalysis?: {
    financial?: {
      minLoss?: number;
      maxLoss?: number;
      expectedLoss?: number;
      currency?: string;
    };
    operational?: {
      downtime?: string;
      affectedProcesses?: string[];
      affectedSystems?: string[];
      recoveryTime?: string;
    };
    compliance?: {
      regulations?: string[];
      potentialFines?: number;
      licenseImpact?: boolean;
    };
    reputational?: {
      stakeholders?: string[];
      mediaExposure?: 'low' | 'medium' | 'high';
      customerImpact?: string;
    };
    strategic?: {
      objectives?: string[];
      projects?: string[];
      timeline?: string;
    };
  };

  // Risk Treatment
  @Column({ type: 'enum', enum: RiskTreatment, enumName: 'risk_treatment', nullable: true })
  treatment?: RiskTreatment;

  @Column({ type: 'jsonb', nullable: true })
  treatmentPlan?: {
    strategy: string;
    actions: Array<{
      id: string;
      action: string;
      responsible: string;
      dueDate: Date;
      status: 'planned' | 'in_progress' | 'completed' | 'overdue';
      completedDate?: Date;
      evidence?: string[];
    }>;
    controls?: string[]; // Control IDs
    costEstimate?: {
      amount: number;
      currency: string;
      breakdown?: Record<string, number>;
    };
    timeline?: {
      startDate: Date;
      endDate: Date;
      milestones?: Array<{
        name: string;
        date: Date;
        status: string;
      }>;
    };
    effectiveness?: {
      expectedReduction: number; // Percentage
      actualReduction?: number;
      measurementMethod?: string;
    };
    acceptanceRationale?: string; // For accepted risks
    transferDetails?: {
      // For transferred risks
      method: string; // 'insurance', 'contract', 'outsourcing'
      party: string;
      terms?: string;
      cost?: number;
    };
  };

  // Monitoring
  @Column({ type: 'jsonb', nullable: true })
  monitoring?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
    method: string;
    responsible: string;
    nextReview: Date;
    metrics?: Array<{
      name: string;
      description?: string;
      target: string;
      current?: string;
      trending?: 'improving' | 'stable' | 'deteriorating';
    }>;
    keyRiskIndicators?: Array<{
      kri: string;
      threshold: string;
      currentValue?: string;
      status?: 'normal' | 'warning' | 'critical';
      lastUpdated?: Date;
    }>;
    reviews?: Array<{
      date: Date;
      reviewer: string;
      findings: string;
      changes?: string[];
      nextSteps?: string[];
    }>;
  };

  // Incidents & Events
  @Column({ type: 'jsonb', nullable: true })
  incidents?: Array<{
    id: string;
    date: Date;
    description: string;
    impact: string;
    response: string;
    lessonsLearned?: string[];
    preventiveMeasures?: string[];
  }>;

  @Column({ type: 'int', default: 0 })
  incidentCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastIncidentDate?: Date;

  // Controls & Mitigation
  @ManyToMany(() => Control)
  @JoinTable({
    name: 'risk_controls',
    joinColumn: { name: 'riskId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'controlId', referencedColumnName: 'id' },
  })
  controls: Control[];

  @Column({ type: 'simple-array', nullable: true })
  mitigationMeasures?: string[];

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  mitigationEffectiveness?: number; // Percentage

  // Reporting & Escalation
  @Column({ type: 'jsonb', nullable: true })
  reporting?: {
    frequency: string;
    recipients: string[];
    format?: string;
    includeInDashboard: boolean;
    escalationThreshold?: {
      scoreAbove?: number;
      levelAbove?: RiskLevel;
      incidentCount?: number;
    };
    escalationPath?: Array<{
      level: number;
      role: string;
      contact?: string;
      criteria: string;
    }>;
    lastReported?: Date;
    reportHistory?: Array<{
      date: Date;
      recipient: string;
      type: string;
      response?: string;
    }>;
  };

  // Documentation
  @Column({ type: 'simple-array', nullable: true })
  attachments?: string[]; // URLs to supporting documents

  @Column({ type: 'jsonb', nullable: true })
  references?: Array<{
    type: 'policy' | 'standard' | 'regulation' | 'incident' | 'audit' | 'other';
    id?: string;
    title: string;
    url?: string;
    relevance?: string;
  }>;

  // Audit Trail
  @Column({ type: 'jsonb', nullable: true })
  auditTrail?: Array<{
    action: string;
    performedBy: string;
    performedAt: Date;
    changes?: RiskChanges;
    comment?: string;
  }>;

  // Lifecycle
  @Column({ type: 'timestamptz' })
  identifiedDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  assessmentDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  treatmentDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  closedDate?: Date;

  @Column({ nullable: true })
  closureReason?: string;

  @Column({ type: 'timestamptz' })
  nextReviewDate: Date;

  // Metadata
  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ type: 'simple-array', nullable: true })
  keywords?: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  version: number;

  @Column('uuid')
  createdBy: string;

  @Column('uuid')
  updatedBy: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Computed properties
  get currentRiskScore(): number {
    if (this.assessment.residualRisk) {
      return this.assessment.residualRisk.score;
    }
    return this.assessment.inherentRisk.score;
  }

  get currentRiskLevel(): RiskLevel {
    if (this.assessment.residualRisk) {
      return this.assessment.residualRisk.level;
    }
    return this.assessment.inherentRisk.level;
  }

  get riskReduction(): number {
    if (!this.assessment.residualRisk) return 0;

    const inherent = this.assessment.inherentRisk.score;
    const residual = this.assessment.residualRisk.score;

    return inherent > 0 ? ((inherent - residual) / inherent) * 100 : 0;
  }

  get isOverdue(): boolean {
    return new Date() > this.nextReviewDate;
  }

  get requiresEscalation(): boolean {
    if (!this.reporting?.escalationThreshold) return false;

    const threshold = this.reporting.escalationThreshold;

    if (threshold.scoreAbove && this.currentRiskScore > threshold.scoreAbove) {
      return true;
    }

    if (threshold.levelAbove) {
      const levels = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL];
      const currentIndex = levels.indexOf(this.currentRiskLevel);
      const thresholdIndex = levels.indexOf(threshold.levelAbove);
      if (currentIndex > thresholdIndex) return true;
    }

    if (threshold.incidentCount && this.incidentCount >= threshold.incidentCount) {
      return true;
    }

    return false;
  }

  get treatmentProgress(): number {
    if (!this.treatmentPlan?.actions) return 0;

    const total = this.treatmentPlan.actions.length;
    const completed = this.treatmentPlan.actions.filter((a) => a.status === 'completed').length;

    return total > 0 ? (completed / total) * 100 : 0;
  }

  // Methods
  calculateRiskScore(likelihood: RiskLikelihood, impact: RiskImpact): number {
    return likelihood * impact;
  }

  calculateRiskLevel(score: number): RiskLevel {
    if (score <= 4) return RiskLevel.LOW;
    if (score <= 9) return RiskLevel.MEDIUM;
    if (score <= 16) return RiskLevel.HIGH;
    return RiskLevel.CRITICAL;
  }

  updateAssessment(
    likelihood: RiskLikelihood,
    impact: RiskImpact,
    type: 'inherent' | 'residual',
    assessedBy: string
  ): void {
    const score = this.calculateRiskScore(likelihood, impact);
    const level = this.calculateRiskLevel(score);

    const assessment = {
      likelihood,
      impact,
      score,
      level,
    };

    if (type === 'inherent') {
      this.assessment.inherentRisk = assessment;
    } else {
      this.assessment.residualRisk = assessment;
    }

    this.assessment.assessmentDate = new Date();
    this.assessment.assessedBy = assessedBy;
  }

  addIncident(incident: any): void {
    if (!this.incidents) this.incidents = [];

    this.incidents.push({
      id: `inc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...incident,
      date: new Date(),
    });

    this.incidentCount++;
    this.lastIncidentDate = new Date();
  }

  addAuditEntry(action: string, performedBy: string, changes?: any): void {
    if (!this.auditTrail) this.auditTrail = [];

    this.auditTrail.push({
      action,
      performedBy,
      performedAt: new Date(),
      changes,
    });
  }

  canBeModifiedBy(userId: string, userRoles: string[]): boolean {
    // Owner can always modify
    if (this.ownerId === userId) return true;

    // Check if user is a stakeholder
    if (this.stakeholders?.includes(userId)) return true;

    // Check role-based permissions
    const allowedRoles = ['admin', 'risk_manager', 'compliance_manager'];
    return userRoles.some((role) => allowedRoles.includes(role));
  }
}
