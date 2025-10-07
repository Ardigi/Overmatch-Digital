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
import { Control } from '../../compliance/entities/control.entity';
import type {
  PolicyCustomFields,
} from '../types/policy.types';
import type {
  AutomationParameters,
  AuthenticationConfig,
  AuditChanges,
  AuditMetadata,
} from '../interfaces/automation.interface';

// Type definitions for policy entity fields
interface PolicyTermDefinitions {
  [term: string]: string;
}

// Section structure for policy content
interface PolicySection {
  id?: string;
  title: string;
  content: string;
  order?: number;
  subsections?: Array<{
    id: string;
    title: string;
    content: string;
    order: number;
  }>;
}

interface FrameworkMappingDetails {
  [controlId: string]: {
    implementation: string;
    strength: 'strong' | 'moderate' | 'weak';
    notes?: string;
    gaps?: string[];
    evidence?: string[];
  };
}

interface CostBreakdown {
  [category: string]: number;
}

interface ViolationsByLevel {
  minor?: number;
  major?: number;
  critical?: number;
}

// Enterprise-grade transformation parameters
interface TransformationParameters {
  /** Source field name for mapping operations */
  sourceField?: string;
  /** Target field name for mapping operations */
  targetField?: string;
  /** Default value to use if source is null/undefined */
  defaultValue?: string | number | boolean;
  /** Regular expression pattern for filtering/validation */
  pattern?: string;
  /** Format string for formatting operations */
  format?: string;
  /** Data type conversion target */
  convertTo?: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  /** Validation rules */
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    allowedValues?: (string | number)[];
  };
  /** Transformation options */
  options?: {
    caseSensitive?: boolean;
    trim?: boolean;
    removeEmpty?: boolean;
    preserveNull?: boolean;
  };
}

// Enterprise-grade effectiveness factors with defined metrics
interface EffectivenessFactors {
  compliance?: number;
  adoption?: number;
  violations?: number;
  training?: number;
  /** Implementation effectiveness score (0-100) */
  implementation?: number;
  /** User satisfaction score (0-100) */
  satisfaction?: number;
  /** Policy coverage percentage (0-100) */
  coverage?: number;
  /** Audit readiness score (0-100) */
  auditReadiness?: number;
  /** Risk mitigation effectiveness (0-100) */
  riskMitigation?: number;
  /** Cost efficiency ratio (0-100) */
  costEfficiency?: number;
}

// Strong-typed policy evaluation context
export interface PolicyEvaluationContext {
  userId: string;
  organizationId: string;
  resource?: string;
  action?: string;
  timestamp: Date;
  /** Request metadata */
  request?: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path?: string;
    headers?: { [key: string]: string };
    query?: { [key: string]: string };
    body?: unknown;
  };
  /** User context */
  user?: {
    roles?: string[];
    permissions?: string[];
    department?: string;
    manager?: string;
  };
  /** System context */
  system?: {
    environment?: 'development' | 'staging' | 'production';
    version?: string;
    region?: string;
  };
  /** Risk factors */
  risk?: {
    score?: number;
    factors?: string[];
    level?: 'low' | 'medium' | 'high' | 'critical';
  };
}

// Strong-typed automation conditions
interface AutomationConditions {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan' | 'in' | 'notIn' | 'matches';
  value: string | number | boolean | string[] | Date;
  /** Logical operator for chaining conditions */
  logicalOperator?: 'AND' | 'OR' | 'NOT';
  /** Case sensitivity for string operations */
  caseSensitive?: boolean;
  /** Negation flag */
  negate?: boolean;
  /** Description of the condition */
  description?: string;
}

// Strong-typed automation action configuration  
interface AutomationActionConfig {
  type: 'notify' | 'enforce' | 'report' | 'escalate' | 'audit' | 'remediate' | 'approve' | 'reject';
  target?: string;
  parameters?: AutomationParameters;
  /** Action priority (1-10, 10 being highest) */
  priority?: number;
  /** Whether action is enabled */
  enabled?: boolean;
  /** Timeout for action execution (milliseconds) */
  timeout?: number;
  /** Retry configuration */
  retry?: {
    count?: number;
    delay?: number;
    backoffMultiplier?: number;
  };
  /** Success criteria */
  successCriteria?: {
    httpStatus?: number[];
    responseContains?: string;
    executionTime?: number;
  };
}

// Strong-typed integration provider configuration
interface IntegrationProviderConfig {
  provider: string;
  endpoint?: string;
  authentication?: AuthenticationConfig;
  /** Field mapping between systems */
  mapping?: { [sourceField: string]: string };
  /** Integration configuration */
  config?: {
    timeout?: number;
    retryCount?: number;
    rateLimitPerMinute?: number;
    batchSize?: number;
    compression?: boolean;
  };
  /** Data transformation rules */
  transforms?: Array<{
    field: string;
    operation: 'map' | 'filter' | 'format' | 'validate';
    parameters?: TransformationParameters;
  }>;
  /** Health check configuration */
  healthCheck?: {
    enabled?: boolean;
    interval?: number;
    path?: string;
    expectedStatus?: number;
  };
}

// Strong-typed audit log details
export interface AuditLogDetails {
  action: string;
  changes?: AuditChanges;
  metadata?: AuditMetadata;
  /** Action category */
  category?: 'create' | 'update' | 'delete' | 'view' | 'export' | 'import' | 'approve' | 'reject';
  /** Action severity */
  severity?: 'info' | 'warning' | 'error' | 'critical';
  /** Action outcome */
  outcome?: 'success' | 'failure' | 'partial' | 'pending';
  /** Resource type affected */
  resourceType?: string;
  /** Resource identifier */
  resourceId?: string;
  /** Business justification */
  businessJustification?: string;
}

export enum PolicyType {
  SECURITY = 'security',
  PRIVACY = 'privacy',
  ACCESS_CONTROL = 'access_control',
  DATA_GOVERNANCE = 'data_governance',
  INCIDENT_RESPONSE = 'incident_response',
  BUSINESS_CONTINUITY = 'business_continuity',
  COMPLIANCE = 'compliance',
  OPERATIONAL = 'operational',
  ADMINISTRATIVE = 'administrative',
  TECHNICAL = 'technical',
  PHYSICAL = 'physical',
  CUSTOM = 'custom',
}

export enum PolicyStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  EFFECTIVE = 'effective',
  SUSPENDED = 'suspended',
  RETIRED = 'retired',
  SUPERSEDED = 'superseded',
}

export enum WorkflowState {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  IN_REVIEW = 'in_review',
  CHANGES_REQUESTED = 'changes_requested',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum PolicyPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum PolicyScope {
  GLOBAL = 'global',
  ORGANIZATION = 'organization',
  DEPARTMENT = 'department',
  TEAM = 'team',
  SYSTEM = 'system',
  PROCESS = 'process',
  ROLE = 'role',
}

@Entity('policies')
@Index(['organizationId', 'status'])
@Index(['type', 'status'])
@Index(['effectiveDate'])
@Index(['nextReviewDate'])
@Index(['policyNumber'])
@Index(['organizationId', 'policyNumber'])
@Index(['organizationId', 'type', 'status'])
@Index(['expirationDate'])
@Index(['organizationId', 'nextReviewDate'])
@Index(['status', 'effectiveDate'])
@Index(['archivedAt'])
export class Policy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ unique: true })
  policyNumber: string;

  @Column({ nullable: true })
  version: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text' })
  purpose: string;

  @Column({ type: 'enum', enum: PolicyType, enumName: 'policy_type' })
  type: PolicyType;

  @Column({
    type: 'enum',
    enum: PolicyStatus,
    enumName: 'policy_status',
    default: PolicyStatus.DRAFT,
  })
  status: PolicyStatus;

  @Column({
    type: 'enum',
    enum: PolicyPriority,
    enumName: 'policy_priority',
    default: PolicyPriority.MEDIUM,
  })
  priority: PolicyPriority;

  @Column({
    type: 'enum',
    enum: PolicyScope,
    enumName: 'policy_scope',
    default: PolicyScope.ORGANIZATION,
  })
  scope: PolicyScope;

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

  @Column('uuid', { nullable: true })
  delegateOwnerId?: string;

  @Column({ type: 'simple-array', nullable: true })
  stakeholders?: string[];

  // Policy Content
  @Column({ type: 'jsonb' })
  content: {
    sections: Array<{
      id: string;
      title: string;
      content: string;
      order: number;
      subsections?: Array<{
        id: string;
        title: string;
        content: string;
        order: number;
      }>;
    }>;
    definitions?: PolicyTermDefinitions;
    responsibilities?: Array<{
      role: string;
      responsibilities: string[];
    }>;
    procedures?: Array<{
      id: string;
      name: string;
      description: string;
      steps: Array<{
        order: number;
        description: string;
        responsible?: string;
      }>;
    }>;
    references?: Array<{
      title: string;
      url?: string;
      description?: string;
      type: 'internal' | 'external' | 'regulation' | 'standard';
    }>;
  };

  @Column({ type: 'jsonb', nullable: true })
  requirements?: Array<{
    id: string;
    requirement: string;
    description?: string;
    mandatory: boolean;
    verificationMethod?: string;
    frequency?: string;
    responsible?: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  exceptions?: Array<{
    id: string;
    description: string;
    justification: string;
    approvedBy: string;
    approvalDate: Date;
    expirationDate?: Date;
    conditions?: string[];
  }>;

  // Compliance & Frameworks
  @Column({ type: 'jsonb', nullable: true })
  complianceMapping?: {
    frameworks?: string[]; // Framework IDs
    controls?: string[]; // Control IDs
    mappingDetails?: FrameworkMappingDetails;
    requirements?: Array<{
      id: string;
      framework: string;
      control: string;
      description: string;
      implemented: boolean;
      evidence?: string[];
      gaps?: string[];
    }>;
    lastMappingUpdate?: Date;
    mappedBy?: string;
  };

  // Additional compliance metadata for mapping service
  @Column({ type: 'jsonb', nullable: true })
  complianceMetadata?: {
    categories?: string[];
    frameworks?: string[];
    controls?: string[];
    mappingStrength?: number;
    lastAnalysis?: Date;
    lastMappingUpdate?: Date;
    mappedControlsCount?: number;
    analysisResults?: {
      score: number;
      gaps: string[];
      recommendations: string[];
    };
    autoMappingEnabled?: boolean;
    customMappings?: PolicyCustomFields;
  };

  @Column({ type: 'simple-array', nullable: true })
  relatedPolicies?: string[];

  @Column({ type: 'simple-array', nullable: true })
  supersededPolicies?: string[];

  // Implementation & Enforcement
  @Column({ type: 'jsonb', nullable: true })
  implementation?: {
    steps?: Array<{
      phase: string;
      activities: string[];
      timeline?: string;
      responsible?: string;
      status?: 'pending' | 'in_progress' | 'completed';
    }>;
    training?: {
      required: boolean;
      frequency?: string;
      targetAudience?: string[];
      completionRate?: number;
    };
    monitoring?: {
      method: string;
      frequency: string;
      responsible?: string;
      metrics?: Array<{
        name: string;
        description?: string;
        target?: string;
        current?: string;
      }>;
    };
    enforcement?: {
      violations?: Array<{
        level: 'minor' | 'major' | 'critical';
        description: string;
        consequence: string;
      }>;
      escalationPath?: string[];
    };
  };

  // Dates
  @Column({ type: 'timestamptz' })
  effectiveDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expirationDate?: Date;

  @Column({ type: 'timestamptz' })
  nextReviewDate: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastReviewDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  approvalDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  publishedDate?: Date;

  // Review & Approval
  @Column({ type: 'jsonb', nullable: true })
  reviewCycle?: {
    frequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | 'biennial';
    lastReview?: {
      date: Date;
      reviewedBy: string;
      changes?: string[];
      approved: boolean;
    };
    upcomingReview?: {
      date: Date;
      assignedTo?: string;
      remindersSent?: number;
    };
    history?: Array<{
      date: Date;
      reviewedBy: string;
      version: string;
      changes?: string[];
      approved: boolean;
      comments?: string;
    }>;
  };

  @Column({ type: 'jsonb', nullable: true })
  approvalWorkflow?: {
    steps: Array<{
      order: number;
      role: string;
      approver?: string;
      status: 'pending' | 'approved' | 'rejected';
      date?: Date;
      comments?: string;
    }>;
    currentStep?: number;
    requiredApprovals?: number;
    receivedApprovals?: number;
  };

  // Risk & Impact
  @Column({ type: 'jsonb', nullable: true })
  riskAssessment?: {
    inherentRisk?: {
      likelihood: number; // 1-5
      impact: number; // 1-5
      score: number; // likelihood * impact
      level: 'low' | 'medium' | 'high' | 'critical';
    };
    residualRisk?: {
      likelihood: number;
      impact: number;
      score: number;
      level: 'low' | 'medium' | 'high' | 'critical';
    };
    riskFactors?: string[];
    mitigationMeasures?: string[];
  };

  @Column({ type: 'jsonb', nullable: true })
  impactAnalysis?: {
    scope?: string[];
    affectedSystems?: string[];
    affectedProcesses?: string[];
    affectedRoles?: string[];
    estimatedUsers?: number;
    implementationCost?: {
      estimated: number;
      currency: string;
      breakdown?: CostBreakdown;
    };
    benefits?: string[];
    challenges?: string[];
  };

  // Metrics & Analytics
  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'int', default: 0 })
  downloadCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  complianceScore?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  adoptionRate?: number;

  @Column({ type: 'jsonb', nullable: true })
  metrics?: {
    attestations?: {
      required: number;
      completed: number;
      percentage: number;
      overdue?: number;
    };
    violations?: {
      total: number;
      byLevel?: ViolationsByLevel;
      trending?: 'increasing' | 'stable' | 'decreasing';
    };
    training?: {
      required: number;
      completed: number;
      percentage: number;
      averageScore?: number;
    };
    effectiveness?: {
      score: number; // 0-100
      factors?: EffectivenessFactors;
      lastAssessment?: Date;
    };
  };

  // Workflow State
  @Column({
    type: 'enum',
    enum: WorkflowState,
    enumName: 'workflow_state',
    default: WorkflowState.DRAFT,
  })
  workflowState: WorkflowState;

  // OPA Integration
  @Column({ type: 'text', nullable: true })
  regoPolicy?: string; // OPA Rego policy code

  @Column({ type: 'jsonb', nullable: true })
  opaMetadata?: {
    package?: string;
    imports?: string[];
    compiledAt?: Date;
    version?: string;
    lastCompilationError?: string;
  };

  @Column({ type: 'boolean', default: false })
  isEvaluatable: boolean;

  @Column({ type: 'text', nullable: true })
  evaluationError?: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastEvaluated?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastComplianceCheck?: Date;

  // Policy Evaluation History
  @Column({ type: 'jsonb', nullable: true })
  evaluationHistory?: Array<{
    id: string;
    evaluatedAt: Date;
    evaluatedBy: string;
    context: PolicyEvaluationContext;
    result: {
      allowed: boolean;
      reasons: string[];
      appliedRules: string[];
      evaluationTime: number;
    };
  }>;

  // Automation & Integration
  @Column({ type: 'jsonb', nullable: true })
  automationRules?: Array<{
    id: string;
    trigger: 'schedule' | 'event' | 'condition';
    conditions?: AutomationConditions;
    actions: Array<{
      type: 'notify' | 'enforce' | 'report' | 'escalate';
      config: AutomationActionConfig;
    }>;
    enabled: boolean;
  }>;

  @Column({ type: 'text', nullable: true })
  policyAsCode?: string; // Legacy field for backward compatibility

  @Column({ nullable: true })
  policyAsCodeLanguage?: string; // 'rego', 'sentinel', 'cedar', etc.

  @Column({ type: 'jsonb', nullable: true })
  integrations?: Array<{
    system: string;
    type: 'monitor' | 'enforce' | 'report';
    config: AutomationActionConfig;
    status: 'active' | 'inactive' | 'error';
    lastSync?: Date;
  }>;

  // Documentation
  @Column({ type: 'simple-array', nullable: true })
  attachments?: string[]; // URLs to supporting documents

  @Column({ type: 'simple-array', nullable: true })
  templates?: string[]; // Associated template IDs

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ type: 'simple-array', nullable: true })
  keywords?: string[];

  @Column({ type: 'boolean', default: false })
  isTemplate: boolean;

  // Audit Trail
  @Column({ type: 'jsonb', nullable: true })
  changeHistory?: Array<{
    version: string;
    changedBy: string;
    changedAt: Date;
    changes: {
      summary: string;
      details?: AuditLogDetails;
      sections?: string[];
    };
    approved?: boolean;
    approvedBy?: string;
  }>;

  @Column('uuid')
  createdBy: string;

  @Column('uuid')
  updatedBy: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt?: Date;

  // Computed properties
  get isActive(): boolean {
    const now = new Date();
    return (
      this.status === PolicyStatus.EFFECTIVE &&
      this.effectiveDate <= now &&
      (!this.expirationDate || this.expirationDate > now)
    );
  }

  get isExpiringSoon(): boolean {
    if (!this.expirationDate) return false;
    const daysUntilExpiration = Math.ceil(
      (this.expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiration <= 30 && daysUntilExpiration > 0;
  }

  get needsReview(): boolean {
    return new Date() >= this.nextReviewDate;
  }

  get completionPercentage(): number {
    let score = 0;
    const weights = {
      content: 40,
      requirements: 15,
      complianceMapping: 15,
      implementation: 10,
      reviewCycle: 10,
      approvalWorkflow: 10,
    };

    if (this.content?.sections?.length > 0) score += weights.content;
    if (this.requirements?.length > 0) score += weights.requirements;
    if (this.complianceMapping?.frameworks?.length > 0) score += weights.complianceMapping;
    if (this.implementation?.steps?.length > 0) score += weights.implementation;
    if (this.reviewCycle) score += weights.reviewCycle;
    if (this.approvalWorkflow) score += weights.approvalWorkflow;

    return score;
  }

  // Relationships
  @ManyToMany(
    () => Control,
    (control) => control.policies
  )
  @JoinTable({
    name: 'policy_control_mapping',
    joinColumn: {
      name: 'policyId',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'controlId',
      referencedColumnName: 'id',
    },
  })
  controls?: Control[];

  // Methods
  addSection(section: PolicySection): void {
    if (!this.content.sections) this.content.sections = [];
    const sectionWithId = {
      ...section,
      id: section.id || `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      order: section.order ?? this.content.sections.length
    };
    this.content.sections.push(sectionWithId);
  }

  recordEvaluation(evaluation: {
    evaluatedAt: Date;
    evaluatedBy: string;
    context: PolicyEvaluationContext;
    result: {
      allowed: boolean;
      reasons: string[];
      appliedRules: string[];
      evaluationTime: number;
    };
  }): void {
    if (!this.evaluationHistory) this.evaluationHistory = [];
    this.evaluationHistory.push({
      id: `eval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...evaluation,
    });
    this.lastEvaluated = evaluation.evaluatedAt;
  }

  updateMetrics(metric: string, value: string | number | boolean | Record<string, any>): void {
    if (!this.metrics) {
      this.metrics = {
        attestations: { required: 0, completed: 0, percentage: 0 },
        violations: { total: 0 },
        training: { required: 0, completed: 0, percentage: 0 },
        effectiveness: { score: 0 },
      };
    }

    if (metric in this.metrics) {
      if (typeof value === 'object' && value !== null) {
        this.metrics[metric] = { ...this.metrics[metric], ...value };
      } else {
        // For primitive values, update a default property
        this.metrics[metric] = { ...this.metrics[metric], value };
      }
    }
  }

  recordView(userId: string): void {
    this.viewCount++;
    // Additional tracking logic could be added here
  }

  recordDownload(userId: string): void {
    this.downloadCount++;
    // Additional tracking logic could be added here
  }

  calculateComplianceScore(): number {
    let score = 0;
    let factors = 0;

    // Attestation compliance
    if (this.metrics?.attestations) {
      score += this.metrics.attestations.percentage;
      factors++;
    }

    // Training compliance
    if (this.metrics?.training) {
      score += this.metrics.training.percentage;
      factors++;
    }

    // Effectiveness score
    if (this.metrics?.effectiveness) {
      score += this.metrics.effectiveness.score;
      factors++;
    }

    // Violation impact (inverse)
    if (this.metrics?.violations) {
      const violationScore = Math.max(0, 100 - this.metrics.violations.total * 5);
      score += violationScore;
      factors++;
    }

    this.complianceScore = factors > 0 ? score / factors : 0;
    return this.complianceScore;
  }

  canBeEditedBy(userId: string, userRoles: string[]): boolean {
    // Owner can always edit
    if (this.ownerId === userId || this.delegateOwnerId === userId) return true;

    // Check if policy is in editable status
    const editableStatuses = [
      PolicyStatus.DRAFT,
      PolicyStatus.PENDING_REVIEW,
      PolicyStatus.UNDER_REVIEW,
    ];

    if (!editableStatuses.includes(this.status)) return false;

    // Check role-based permissions
    const allowedRoles = ['admin', 'policy_manager', 'compliance_manager'];
    return userRoles.some((role) => allowedRoles.includes(role));
  }
}