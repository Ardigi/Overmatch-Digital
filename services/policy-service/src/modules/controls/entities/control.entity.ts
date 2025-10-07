import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Policy } from '../../policies/entities/policy.entity';
import type { ControlChanges } from '../../shared/types';

export enum ControlType {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
  COMPENSATING = 'compensating',
  ADMINISTRATIVE = 'administrative',
  TECHNICAL = 'technical',
  PHYSICAL = 'physical',
}

export enum ControlCategory {
  ACCESS_CONTROL = 'access_control',
  AUDIT_LOGGING = 'audit_logging',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_PROTECTION = 'data_protection',
  ENCRYPTION = 'encryption',
  INCIDENT_RESPONSE = 'incident_response',
  MONITORING = 'monitoring',
  NETWORK_SECURITY = 'network_security',
  PHYSICAL_SECURITY = 'physical_security',
  SYSTEM_INTEGRITY = 'system_integrity',
  VULNERABILITY_MANAGEMENT = 'vulnerability_management',
  BUSINESS_CONTINUITY = 'business_continuity',
  CHANGE_MANAGEMENT = 'change_management',
  CONFIGURATION_MANAGEMENT = 'configuration_management',
  CUSTOM = 'custom',
}

export enum ControlStatus {
  NOT_IMPLEMENTED = 'not_implemented',
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  IMPLEMENTED = 'implemented',
  EFFECTIVE = 'effective',
  PARTIALLY_EFFECTIVE = 'partially_effective',
  NOT_EFFECTIVE = 'not_effective',
  NEEDS_IMPROVEMENT = 'needs_improvement',
  DEPRECATED = 'deprecated',
}

export enum ControlFrequency {
  CONTINUOUS = 'continuous',
  REAL_TIME = 'real_time',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMI_ANNUAL = 'semi_annual',
  ANNUAL = 'annual',
  AD_HOC = 'ad_hoc',
  EVENT_DRIVEN = 'event_driven',
}

export enum ControlAutomationLevel {
  MANUAL = 'manual',
  SEMI_AUTOMATED = 'semi_automated',
  FULLY_AUTOMATED = 'fully_automated',
}

@Entity('controls')
@Index(['organizationId', 'status'])
@Index(['type', 'category'])
@Index(['framework', 'controlId'])
export class Control {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ unique: true })
  controlId: string; // e.g., "AC-1", "CC2.1", custom ID

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text' })
  objective: string;

  @Column({ type: 'enum', enum: ControlType, enumName: 'control_type' })
  type: ControlType;

  @Column({ type: 'enum', enum: ControlCategory, enumName: 'control_category' })
  category: ControlCategory;

  @Column({
    type: 'enum',
    enum: ControlStatus,
    enumName: 'control_status',
    default: ControlStatus.NOT_IMPLEMENTED,
  })
  status: ControlStatus;

  @Column({ type: 'enum', enum: ControlFrequency, enumName: 'control_frequency' })
  frequency: ControlFrequency;

  @Column({
    type: 'enum',
    enum: ControlAutomationLevel,
    enumName: 'control_automation_level',
    default: ControlAutomationLevel.MANUAL,
  })
  automationLevel: ControlAutomationLevel;

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
  implementers?: string[]; // User IDs or role names

  // Framework Mapping
  @Column()
  framework: string; // 'SOC2', 'ISO27001', 'NIST', 'Custom', etc.

  @Column({ nullable: true })
  frameworkVersion?: string;

  @Column({ type: 'jsonb', nullable: true })
  frameworkMapping?: {
    // SOC 2 Trust Services Criteria
    soc2?: {
      trustServicesCriteria: string[]; // e.g., ['CC2.1', 'CC2.2']
      points?: string[]; // Points of focus
      illustrativeControls?: string[];
    };
    // ISO 27001
    iso27001?: {
      annexAControls: string[]; // e.g., ['A.5.1.1', 'A.5.1.2']
      clauses?: string[]; // e.g., ['4.1', '4.2']
    };
    // NIST
    nist?: {
      families: string[]; // e.g., ['AC', 'AU', 'SC']
      controls: string[]; // e.g., ['AC-1', 'AC-2']
      enhancements?: string[]; // e.g., ['AC-2(1)', 'AC-2(2)']
    };
    // HIPAA
    hipaa?: {
      safeguards: string[]; // 'Administrative', 'Physical', 'Technical'
      requirements: string[]; // Specific HIPAA requirements
    };
    // PCI DSS
    pciDss?: {
      requirements: string[]; // e.g., ['1.1', '1.2']
      subRequirements?: string[]; // e.g., ['1.1.1', '1.1.2']
    };
    // Custom frameworks
    custom?: Record<string, string[]>;
  };

  @Column({ type: 'simple-array', nullable: true })
  relatedControls?: string[]; // Other control IDs

  @Column({ type: 'simple-array', nullable: true })
  compensatingControls?: string[]; // Control IDs that compensate if this fails

  // Implementation Details
  @Column({ type: 'jsonb' })
  implementation: {
    description: string;
    steps?: Array<{
      order: number;
      description: string;
      responsible?: string;
      completed?: boolean;
      completedDate?: Date;
    }>;
    requirements?: Array<{
      type: 'technical' | 'process' | 'people' | 'documentation';
      description: string;
      fulfilled?: boolean;
    }>;
    technologies?: string[]; // Technologies/tools used
    processes?: string[]; // Related processes
    dependencies?: string[]; // Other controls or systems
    location?: string; // Where control is implemented
    scope?: string[]; // Systems/data/processes covered
  };

  // Testing & Validation
  @Column({ type: 'jsonb', nullable: true })
  testing?: {
    approach: 'inquiry' | 'observation' | 'inspection' | 'reperformance' | 'automated';
    procedures: string[];
    sampleSize?: number;
    frequency: string;
    lastTested?: Date;
    nextTest?: Date;
    testResults?: Array<{
      date: Date;
      tester: string;
      result: 'pass' | 'fail' | 'partial';
      findings?: string[];
      exceptions?: number;
      samplesTested?: number;
      evidenceIds?: string[];
    }>;
  };

  @Column({ type: 'jsonb', nullable: true })
  effectiveness?: {
    score: number; // 0-100
    rating: 'effective' | 'partially_effective' | 'not_effective' | 'not_tested';
    factors?: Record<string, number>;
    lastAssessment?: Date;
    assessedBy?: string;
    findings?: string[];
    recommendations?: string[];
  };

  // Risk & Impact
  @Column({ type: 'jsonb', nullable: true })
  riskAssessment?: {
    inherentRisk: {
      likelihood: number; // 1-5
      impact: number; // 1-5
      score: number;
      level: 'low' | 'medium' | 'high' | 'critical';
    };
    residualRisk: {
      likelihood: number;
      impact: number;
      score: number;
      level: 'low' | 'medium' | 'high' | 'critical';
    };
    risksAddressed?: string[];
    riskScenarios?: Array<{
      scenario: string;
      likelihood: number;
      impact: number;
      mitigation: string;
    }>;
  };

  @Column({ type: 'simple-array', nullable: true })
  threats?: string[]; // Threats this control addresses

  @Column({ type: 'simple-array', nullable: true })
  vulnerabilities?: string[]; // Vulnerabilities this control mitigates

  // Monitoring & Metrics
  @Column({ type: 'jsonb', nullable: true })
  monitoring?: {
    method: 'automated' | 'manual' | 'hybrid';
    tools?: string[];
    frequency: string;
    metrics?: Array<{
      name: string;
      description?: string;
      target: string;
      current?: string;
      unit?: string;
      trending?: 'improving' | 'stable' | 'declining';
    }>;
    alerts?: Array<{
      condition: string;
      threshold?: string;
      recipients?: string[];
      lastTriggered?: Date;
    }>;
    dashboards?: string[]; // URLs or IDs
  };

  @Column({ type: 'jsonb', nullable: true })
  performance?: {
    uptime?: number; // Percentage
    availability?: number; // Percentage
    mtbf?: number; // Mean time between failures (hours)
    mttr?: number; // Mean time to repair (hours)
    falsePositiveRate?: number; // Percentage
    coverage?: number; // Percentage of scope covered
    lastIncident?: Date;
    incidentCount?: number;
  };

  // Evidence & Documentation
  @Column({ type: 'simple-array', nullable: true })
  evidenceRequirements?: string[]; // Types of evidence needed

  @Column({ type: 'simple-array', nullable: true })
  evidenceIds?: string[]; // References to evidence entities

  @Column({ type: 'jsonb', nullable: true })
  documentation?: {
    procedures?: string[]; // URLs or IDs
    workInstructions?: string[]; // URLs or IDs
    diagrams?: string[]; // URLs or IDs
    policies?: string[]; // Policy IDs this control implements
    templates?: string[]; // Template IDs
  };

  // Automation & Integration
  @Column({ type: 'jsonb', nullable: true })
  automation?: {
    scripts?: Array<{
      name: string;
      language: string;
      repository?: string;
      path?: string;
      schedule?: string;
      lastRun?: Date;
      status?: 'active' | 'inactive' | 'error';
    }>;
    workflows?: Array<{
      name: string;
      platform: string; // 'jenkins', 'github-actions', 'ansible', etc.
      trigger: string;
      status?: 'active' | 'inactive';
    }>;
    apis?: Array<{
      name: string;
      endpoint: string;
      method: string;
      authentication?: string;
      frequency?: string;
    }>;
  };

  @Column({ type: 'text', nullable: true })
  controlAsCode?: string; // Policy as code implementation

  @Column({ nullable: true })
  controlAsCodeLanguage?: string; // 'rego', 'python', 'terraform', etc.

  // Cost & Resources
  @Column({ type: 'jsonb', nullable: true })
  cost?: {
    implementation?: {
      amount: number;
      currency: string;
      breakdown?: Record<string, number>;
    };
    operational?: {
      amount: number;
      currency: string;
      period: 'monthly' | 'quarterly' | 'annual';
      breakdown?: Record<string, number>;
    };
    resources?: {
      fte?: number; // Full-time equivalents
      hours?: number; // Hours per period
      skills?: string[];
    };
  };

  // Lifecycle
  @Column({ type: 'timestamptz', nullable: true })
  implementationDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastReviewDate?: Date;

  @Column({ type: 'timestamptz' })
  nextReviewDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deprecationDate?: Date;

  @Column({ nullable: true })
  deprecationReason?: string;

  @Column({ nullable: true })
  replacementControlId?: string;

  // Relationships
  @ManyToMany(() => Policy)
  @JoinTable({
    name: 'control_policies',
    joinColumn: { name: 'controlId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'policyId', referencedColumnName: 'id' },
  })
  policies: Policy[];

  // Metadata
  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ type: 'simple-array', nullable: true })
  keywords?: string[];

  @Column({ default: false })
  isKeyControl: boolean; // Critical for compliance

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  version: number;

  @Column({ type: 'jsonb', nullable: true })
  changeHistory?: Array<{
    version: number;
    changedBy: string;
    changedAt: Date;
    changes: ControlChanges;
    reason?: string;
  }>;

  @Column('uuid')
  createdBy: string;

  @Column('uuid')
  updatedBy: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Computed properties
  get maturityLevel(): number {
    let score = 0;

    // Status (25%)
    const statusScores = {
      [ControlStatus.NOT_IMPLEMENTED]: 0,
      [ControlStatus.PLANNED]: 10,
      [ControlStatus.IN_PROGRESS]: 30,
      [ControlStatus.IMPLEMENTED]: 60,
      [ControlStatus.PARTIALLY_EFFECTIVE]: 70,
      [ControlStatus.EFFECTIVE]: 100,
    };
    score += (statusScores[this.status] || 0) * 0.25;

    // Automation (25%)
    const automationScores = {
      [ControlAutomationLevel.MANUAL]: 30,
      [ControlAutomationLevel.SEMI_AUTOMATED]: 60,
      [ControlAutomationLevel.FULLY_AUTOMATED]: 100,
    };
    score += (automationScores[this.automationLevel] || 0) * 0.25;

    // Testing (25%)
    if (this.testing?.testResults?.length > 0) {
      const recentTests = this.testing.testResults.slice(-3);
      const passRate = recentTests.filter((t) => t.result === 'pass').length / recentTests.length;
      score += passRate * 100 * 0.25;
    }

    // Effectiveness (25%)
    if (this.effectiveness?.score) {
      score += this.effectiveness.score * 0.25;
    }

    return Math.round(score);
  }

  get riskReduction(): number {
    if (!this.riskAssessment) return 0;

    const inherentScore = this.riskAssessment.inherentRisk.score;
    const residualScore = this.riskAssessment.residualRisk.score;

    if (inherentScore === 0) return 0;

    return Math.round(((inherentScore - residualScore) / inherentScore) * 100);
  }

  get needsAttention(): boolean {
    // Check various conditions that require attention
    if (this.status === ControlStatus.NOT_EFFECTIVE) return true;
    if (this.status === ControlStatus.NEEDS_IMPROVEMENT) return true;
    if (this.effectiveness?.rating === 'not_effective') return true;
    if (this.nextReviewDate && new Date() > this.nextReviewDate) return true;
    if (this.testing?.nextTest && new Date() > this.testing.nextTest) return true;

    return false;
  }

  // Methods
  updateEffectiveness(score: number, findings?: string[]): void {
    if (!this.effectiveness) {
      this.effectiveness = {
        score: 0,
        rating: 'not_tested',
        lastAssessment: new Date(),
      };
    }

    this.effectiveness.score = score;
    this.effectiveness.lastAssessment = new Date();

    if (score >= 80) {
      this.effectiveness.rating = 'effective';
    } else if (score >= 60) {
      this.effectiveness.rating = 'partially_effective';
    } else {
      this.effectiveness.rating = 'not_effective';
    }

    if (findings) {
      this.effectiveness.findings = findings;
    }
  }

  addTestResult(result: any): void {
    if (!this.testing) {
      this.testing = {
        approach: 'inspection',
        procedures: [],
        frequency: this.frequency,
      };
    }

    if (!this.testing.testResults) {
      this.testing.testResults = [];
    }

    this.testing.testResults.push({
      ...result,
      date: new Date(),
    });

    this.testing.lastTested = new Date();
  }

  calculateROI(): number {
    if (!this.cost?.implementation || !this.riskAssessment) return 0;

    // Simplified ROI calculation
    const riskReductionValue = this.riskReduction * 1000; // Arbitrary value per percentage point
    const totalCost = this.cost.implementation.amount + (this.cost.operational?.amount || 0) * 12; // Annual operational cost

    return totalCost > 0 ? (riskReductionValue - totalCost) / totalCost : 0;
  }

  canBeImplementedBy(userId: string, userRoles: string[]): boolean {
    // Owner can implement
    if (this.ownerId === userId) return true;

    // Check if user is in implementers list
    if (this.implementers?.includes(userId)) return true;

    // Check role-based permissions
    const allowedRoles = ['admin', 'control_implementer', 'security_engineer'];
    return userRoles.some((role) => allowedRoles.includes(role));
  }
}
