import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EvidenceType } from '../../evidence/entities/evidence.entity';

export enum ValidationRuleType {
  REQUIRED_FIELD = 'required_field',
  DATA_FORMAT = 'data_format',
  FILE_TYPE = 'file_type',
  FILE_SIZE = 'file_size',
  DATE_RANGE = 'date_range',
  CONTENT_ANALYSIS = 'content_analysis',
  METADATA_CHECK = 'metadata_check',
  SIGNATURE_VERIFICATION = 'signature_verification',
  COMPLETENESS_CHECK = 'completeness_check',
  CONSISTENCY_CHECK = 'consistency_check',
  COMPLIANCE_CHECK = 'compliance_check',
  SECURITY_SCAN = 'security_scan',
  CUSTOM = 'custom',
}

export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

export enum ValidationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TESTING = 'testing',
  DEPRECATED = 'deprecated',
}

@Entity('validation_rules')
@Index(['evidenceType', 'status'])
@Index(['framework'])
@Index(['controlId'])
export class ValidationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: ValidationRuleType, enumName: 'validation_rule_type' })
  type: ValidationRuleType;

  @Column({
    type: 'enum',
    enum: ValidationSeverity,
    enumName: 'validation_severity',
    default: ValidationSeverity.ERROR,
  })
  severity: ValidationSeverity;

  @Column({
    type: 'enum',
    enum: ValidationStatus,
    enumName: 'validation_status',
    default: ValidationStatus.ACTIVE,
  })
  status: ValidationStatus;

  // Applicability
  @Column({ type: 'enum', enum: EvidenceType, enumName: 'evidence_type', nullable: true })
  evidenceType?: EvidenceType;

  @Column({ type: 'simple-array', nullable: true })
  evidenceTypes?: EvidenceType[];

  @Column({ nullable: true })
  framework?: string;

  @Column({ type: 'simple-array', nullable: true })
  frameworks?: string[];

  @Column({ nullable: true })
  controlId?: string;

  @Column({ type: 'simple-array', nullable: true })
  controlIds?: string[];

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  // Rule Configuration
  @Column({ type: 'jsonb' })
  configuration: {
    // For required field checks
    requiredFields?: Array<{
      fieldName: string;
      fieldPath?: string; // JSONPath for nested fields
      dataType?: string;
      allowEmpty?: boolean;
    }>;

    // For data format checks
    formatRules?: Array<{
      field: string;
      pattern?: string; // regex
      format?: 'email' | 'url' | 'date' | 'uuid' | 'json' | 'custom';
      customValidator?: string; // function name or code
    }>;

    // For file validation
    fileRules?: {
      allowedTypes?: string[]; // mime types
      allowedExtensions?: string[];
      minSize?: number; // bytes
      maxSize?: number; // bytes
      requireSignature?: boolean;
      scanForVirus?: boolean;
      checkImageDimensions?: {
        minWidth?: number;
        minHeight?: number;
        maxWidth?: number;
        maxHeight?: number;
      };
    };

    // For date validation
    dateRules?: {
      field: string;
      minDate?: string; // ISO date or relative like '-30d'
      maxDate?: string;
      allowFuture?: boolean;
      allowPast?: boolean;
      businessDaysOnly?: boolean;
      timezone?: string;
    };

    // For content analysis
    contentRules?: {
      checkForPII?: boolean;
      checkForConfidential?: boolean;
      requiredKeywords?: string[];
      prohibitedKeywords?: string[];
      minWordCount?: number;
      maxWordCount?: number;
      language?: string;
      readabilityScore?: number;
    };

    // For metadata validation
    metadataRules?: {
      requiredFields?: string[];
      allowedValues?: Record<string, string[]>;
      customChecks?: Array<{
        field: string;
        operator: string;
        value: any;
      }>;
    };

    // For compliance checks
    complianceRules?: {
      requireSignature?: boolean;
      requireTimestamp?: boolean;
      requireApproval?: boolean;
      checkRetentionPolicy?: boolean;
      checkAccessControl?: boolean;
      verifyAgainstTemplate?: string; // template ID
    };

    // Custom validation
    customRules?: {
      validator?: string; // JavaScript function as string
      endpoint?: string; // External API endpoint
      parameters?: Record<string, any>;
      timeout?: number;
      retryCount?: number;
    };
  };

  // Error Messages
  @Column({ type: 'jsonb' })
  errorMessages: {
    default: string;
    byLanguage?: Record<string, string>;
    byCondition?: Array<{
      condition: string;
      message: string;
    }>;
  };

  @Column({ type: 'text', nullable: true })
  remediationGuidance?: string;

  @Column({ type: 'jsonb', nullable: true })
  remediationSteps?: Array<{
    step: number;
    action: string;
    description?: string;
    resources?: string[];
  }>;

  // Execution Settings
  @Column({ default: true })
  isAutomatic: boolean;

  @Column({ default: false })
  isBlocking: boolean; // Prevents evidence submission if failed

  @Column({ type: 'int', default: 0 })
  executionOrder: number;

  @Column({ type: 'simple-array', nullable: true })
  dependencies?: string[]; // Other rule IDs that must pass first

  @Column({ type: 'jsonb', nullable: true })
  executionConditions?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;

  @Column({ type: 'int', nullable: true })
  timeoutSeconds?: number;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  // Performance & Analytics
  @Column({ type: 'int', default: 0 })
  executionCount: number;

  @Column({ type: 'int', default: 0 })
  passCount: number;

  @Column({ type: 'int', default: 0 })
  failCount: number;

  @Column({ type: 'int', default: 0 })
  skipCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  averageExecutionTime?: number; // in seconds

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  successRate?: number;

  @Column({ type: 'jsonb', nullable: true })
  performanceStats?: {
    lastExecuted?: Date;
    executionTimes?: number[];
    failureReasons?: Record<string, number>;
    affectedEvidence?: string[];
  };

  // Exception Handling
  @Column({ type: 'jsonb', nullable: true })
  exceptions?: Array<{
    id: string;
    clientId?: string;
    evidenceId?: string;
    reason: string;
    approvedBy: string;
    approvedAt: Date;
    expiresAt?: Date;
    conditions?: Record<string, any>;
  }>;

  @Column({ default: false })
  allowExceptions: boolean;

  @Column({ type: 'simple-array', nullable: true })
  exceptionApprovers?: string[]; // Role names or user IDs

  // Audit & Compliance
  @Column({ type: 'jsonb', nullable: true })
  complianceMapping?: {
    requirements?: Array<{
      framework: string;
      requirementId: string;
      description?: string;
    }>;
    evidence?: string;
    references?: string[];
  };

  @Column({ type: 'jsonb', nullable: true })
  changeHistory?: Array<{
    version: number;
    changedBy: string;
    changedAt: Date;
    changes: Record<string, any>;
    reason?: string;
  }>;

  @Column({ default: 1 })
  version: number;

  @Column('uuid')
  createdBy: string;

  @Column('uuid')
  updatedBy: string;

  @Column('uuid', { nullable: true })
  approvedBy?: string;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deprecatedAt?: Date;

  // Methods
  recordExecution(passed: boolean, executionTime: number, reason?: string): void {
    this.executionCount++;
    if (passed) {
      this.passCount++;
    } else {
      this.failCount++;
      if (reason && this.performanceStats?.failureReasons) {
        this.performanceStats.failureReasons[reason] =
          (this.performanceStats.failureReasons[reason] || 0) + 1;
      }
    }

    if (!this.performanceStats) {
      this.performanceStats = {
        executionTimes: [],
        failureReasons: {},
        affectedEvidence: [],
      };
    }

    if (this.performanceStats && this.performanceStats.executionTimes) {
      this.performanceStats.lastExecuted = new Date();
      this.performanceStats.executionTimes.push(executionTime);
    }

    // Update average execution time
    if (this.performanceStats?.executionTimes?.length) {
      const times = this.performanceStats.executionTimes;
      this.averageExecutionTime = times.reduce((a, b) => a + b, 0) / times.length;
    }

    // Update success rate
    this.successRate = this.executionCount > 0 ? (this.passCount / this.executionCount) * 100 : 0;
  }

  hasException(clientId?: string, evidenceId?: string): boolean {
    if (!this.exceptions || this.exceptions.length === 0) return false;

    return this.exceptions.some(exception => {
      // Check if exception is still valid
      if (exception.expiresAt && new Date() > new Date(exception.expiresAt)) {
        return false;
      }

      // Check if exception applies
      if (exception.clientId && exception.clientId !== clientId) return false;
      if (exception.evidenceId && exception.evidenceId !== evidenceId) return false;

      return true;
    });
  }

  addException(exception: any): void {
    if (!this.exceptions) this.exceptions = [];

    this.exceptions.push({
      id: `exc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...exception,
      approvedAt: new Date(),
    });
  }

  isApplicable(evidence: any): boolean {
    // Check evidence type
    if (this.evidenceType && evidence.type !== this.evidenceType) return false;
    if (this.evidenceTypes && !this.evidenceTypes.includes(evidence.type)) return false;

    // Check framework
    if (this.framework && evidence.framework !== this.framework) return false;
    if (this.frameworks && !this.frameworks.some(f => evidence.frameworks?.includes(f)))
      return false;

    // Check execution conditions
    if (this.executionConditions) {
      for (const condition of this.executionConditions) {
        const fieldValue = evidence[condition.field];
        // Simple condition evaluation - can be extended
        if (condition.operator === 'equals' && fieldValue !== condition.value) return false;
        if (condition.operator === 'not_equals' && fieldValue === condition.value) return false;
      }
    }

    return true;
  }

  updateVersion(changes: Record<string, any>, changedBy: string, reason?: string): void {
    this.version++;

    if (!this.changeHistory) this.changeHistory = [];

    this.changeHistory.push({
      version: this.version,
      changedBy,
      changedAt: new Date(),
      changes,
      reason,
    });
  }
}
