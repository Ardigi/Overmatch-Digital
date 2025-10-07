import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EvidenceType {
  DOCUMENT = 'document',
  SCREENSHOT = 'screenshot',
  LOG_FILE = 'log_file',
  CONFIGURATION = 'configuration',
  REPORT = 'report',
  ATTESTATION = 'attestation',
  SYSTEM_EXPORT = 'system_export',
  API_RESPONSE = 'api_response',
  DATABASE_QUERY = 'database_query',
  INTERVIEW = 'interview',
  OBSERVATION = 'observation',
  POLICY = 'policy',
  PROCEDURE = 'procedure',
  DIAGRAM = 'diagram',
  VIDEO = 'video',
  CODE_SNIPPET = 'code_snippet',
  SECURITY_SCAN = 'security_scan',
  AUDIT_LOG = 'audit_log',
  // Azure specific
  AZURE_ACTIVITY_LOGS = 'azure_activity_logs',
  AZURE_SECURITY_ALERTS = 'azure_security_alerts',
  AZURE_POLICY_COMPLIANCE = 'azure_policy_compliance',
  AZURE_SECURITY_RECOMMENDATIONS = 'azure_security_recommendations',
  AZURE_LOG_ANALYTICS = 'azure_log_analytics',
  AZURE_NSG_FLOW_LOGS = 'azure_nsg_flow_logs',
  AZURE_ROLE_ASSIGNMENTS = 'azure_role_assignments',
  // GCP specific
  GCP_AUDIT_LOGS = 'gcp_audit_logs',
  GCP_SECURITY_FINDINGS = 'gcp_security_findings',
  GCP_ASSET_INVENTORY = 'gcp_asset_inventory',
  GCP_IAM_POLICIES = 'gcp_iam_policies',
  GCP_VPC_FLOW_LOGS = 'gcp_vpc_flow_logs',
  GCP_ACCESS_APPROVALS = 'gcp_access_approvals',
  GCP_SECURITY_HEALTH_ANALYTICS = 'gcp_security_health_analytics',
  GCP_BILLING_ALERTS = 'gcp_billing_alerts',
  // AWS specific
  AWS_CLOUDTRAIL_LOGS = 'aws_cloudtrail_logs',
  AWS_CONFIG_SNAPSHOTS = 'aws_config_snapshots',
  AWS_GUARDDUTY_FINDINGS = 'aws_guardduty_findings',
  AWS_SECURITY_HUB_FINDINGS = 'aws_security_hub_findings',
  AWS_MACIE_FINDINGS = 'aws_macie_findings',
  AWS_VPC_FLOW_LOGS = 'aws_vpc_flow_logs',
  AWS_IAM_POLICIES = 'aws_iam_policies',
  AWS_ACCESS_ANALYZER_FINDINGS = 'aws_access_analyzer_findings',
  OTHER = 'other',
}

export enum EvidenceStatus {
  DRAFT = 'draft',
  PENDING_COLLECTION = 'pending_collection',
  COLLECTING = 'collecting',
  COLLECTED = 'collected',
  PENDING_REVIEW = 'pending_review',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  NEEDS_UPDATE = 'needs_update',
  ARCHIVED = 'archived',
  EXPIRED = 'expired',
}

export enum EvidenceSource {
  MANUAL_UPLOAD = 'manual_upload',
  API_INTEGRATION = 'api_integration',
  AUTOMATED_COLLECTION = 'automated_collection',
  SYSTEM_GENERATED = 'system_generated',
  THIRD_PARTY = 'third_party',
  AUDITOR_PROVIDED = 'auditor_provided',
  CLIENT_PROVIDED = 'client_provided',
  AZURE = 'azure',
  GCP = 'gcp',
  AWS = 'aws',
}

export enum ConfidentialityLevel {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  HIGHLY_CONFIDENTIAL = 'highly_confidential',
  RESTRICTED = 'restricted',
}

@Entity('evidence')
@Index(['clientId', 'status'])
@Index(['auditId', 'controlId'])
@Index(['type', 'status'])
@Index(['collectionDate'])
@Index(['expirationDate'])
export class Evidence {
  // Allow dynamic property access for field iteration
  [key: string]: any;
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: EvidenceType, enumName: 'evidence_type' })
  type: EvidenceType;

  @Column({
    type: 'enum',
    enum: EvidenceStatus,
    enumName: 'evidence_status',
    default: EvidenceStatus.DRAFT,
  })
  status: EvidenceStatus;

  @Column({ type: 'enum', enum: EvidenceSource, enumName: 'evidence_source' })
  source: EvidenceSource;

  @Column({
    type: 'enum',
    enum: ConfidentialityLevel,
    enumName: 'confidentiality_level',
    default: ConfidentialityLevel.INTERNAL,
  })
  confidentialityLevel: ConfidentialityLevel;

  // Relationships
  @Column('uuid')
  clientId: string;

  @Column('uuid', { nullable: true })
  auditId?: string;

  @Column('uuid', { nullable: true })
  controlId?: string;

  @Column('uuid', { nullable: true })
  requestId?: string;

  @Column('uuid', { nullable: true })
  collectorId?: string;

  @Column({ nullable: true })
  collectorType?: string; // 'aws', 'azure', 'gcp', 'manual', etc.

  // Evidence Details
  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    checksum?: string;
    encoding?: string;
    dimensions?: { width: number; height: number };
    duration?: number; // for videos
    pageCount?: number; // for documents
    systemInfo?: {
      hostname?: string;
      ipAddress?: string;
      operatingSystem?: string;
      timestamp?: Date;
    };
    collectionMethod?: string;
    collectionParameters?: Record<string, any>;
    processingHistory?: Array<{
      action: string;
      timestamp: Date;
      userId: string;
      details?: any;
    }>;
    customFields?: Record<string, any>;
  };

  @Column({ nullable: true })
  storageUrl?: string;

  @Column({ nullable: true })
  storageProvider?: string; // 's3', 'azure-blob', 'gcs', 'local'

  @Column({ nullable: true })
  storagePath?: string;

  @Column({ nullable: true })
  thumbnailUrl?: string;

  @Column({ nullable: true })
  previewUrl?: string;

  // Dates
  @Column({ type: 'timestamptz', nullable: true })
  collectionDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  effectiveDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expirationDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedDate?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  approvedDate?: Date;

  // People
  @Column('uuid', { nullable: true })
  collectedBy?: string;

  @Column('uuid', { nullable: true })
  reviewedBy?: string;

  @Column('uuid', { nullable: true })
  approvedBy?: string;

  @Column('uuid')
  createdBy: string;

  @Column('uuid')
  updatedBy: string;

  @Column('uuid', { nullable: true })
  validatedBy?: string;

  @Column({ type: 'timestamptz', nullable: true })
  validatedAt?: Date;

  @Column({ type: 'text', nullable: true })
  validationComments?: string;

  // Quality & Validation
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  qualityScore?: number;

  @Column({ type: 'jsonb', nullable: true })
  validationResults?: {
    passed: boolean;
    checks: Array<{
      name: string;
      result: 'pass' | 'fail' | 'warning' | 'skipped';
      message?: string;
      severity?: 'critical' | 'high' | 'medium' | 'low';
      timestamp: Date;
    }>;
    summary?: {
      totalChecks: number;
      passedChecks: number;
      failedChecks: number;
      warnings: number;
    };
  };

  @Column({ type: 'jsonb', nullable: true })
  reviewComments?: Array<{
    id: string;
    userId: string;
    userName: string;
    comment: string;
    timestamp: Date;
    type: 'question' | 'concern' | 'suggestion' | 'approval' | 'rejection';
    resolved?: boolean;
    resolvedBy?: string;
    resolvedAt?: Date;
  }>;

  // Compliance Mapping
  @Column({ type: 'jsonb', nullable: true })
  complianceMapping?: {
    frameworks?: Array<{
      name: string; // 'SOC2', 'ISO27001', 'HIPAA', etc.
      controls: string[];
      requirements?: string[];
      score?: number;
    }>;
    trustServicesCriteria?: string[]; // For SOC 2
    assertions?: string[]; // For SOC 1
    clauses?: string[]; // For ISO
    safeguards?: string[]; // For HIPAA
  };

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ type: 'simple-array', nullable: true })
  keywords?: string[];

  // Version Control
  @Column({ default: 1 })
  version: number;

  @Column('uuid', { nullable: true })
  parentEvidenceId?: string;

  @Column({ default: true })
  isLatestVersion: boolean;

  @Column({ type: 'jsonb', nullable: true })
  versionHistory?: Array<{
    version: number;
    evidenceId: string;
    changedBy: string;
    changedAt: Date;
    changeDescription?: string;
  }>;

  // Security & Access
  @Column({ type: 'jsonb', nullable: true })
  accessControl?: {
    allowedUsers?: string[];
    allowedRoles?: string[];
    deniedUsers?: string[];
    deniedRoles?: string[];
    externalAccess?: {
      auditorAccess: boolean;
      clientAccess: boolean;
      publicAccess: boolean;
    };
  };

  @Column({ type: 'text', nullable: true })
  encryptionKey?: string;

  @Column({ default: false })
  isEncrypted: boolean;

  @Column({ default: false })
  isSensitive: boolean;

  // Analytics
  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'int', default: 0 })
  downloadCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastAccessedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  usageMetrics?: {
    views: Array<{ userId: string; timestamp: Date }>;
    downloads: Array<{ userId: string; timestamp: Date }>;
    shares: Array<{ userId: string; sharedWith: string; timestamp: Date }>;
  };

  // Audit Trail
  @Column({ type: 'jsonb', nullable: true })
  auditTrail?: Array<{
    action: string;
    userId: string;
    userName: string;
    timestamp: Date;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
  }>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt?: Date;

  // Computed properties
  get isExpired(): boolean {
    return this.expirationDate ? new Date() > this.expirationDate : false;
  }

  get needsReview(): boolean {
    return [
      EvidenceStatus.PENDING_REVIEW,
      EvidenceStatus.UNDER_REVIEW,
      EvidenceStatus.NEEDS_UPDATE,
    ].includes(this.status);
  }

  get isActive(): boolean {
    return (
      ![EvidenceStatus.ARCHIVED, EvidenceStatus.EXPIRED, EvidenceStatus.REJECTED].includes(
        this.status
      ) && !this.deletedAt
    );
  }

  get completionPercentage(): number {
    const requiredFields = ['title', 'type', 'source', 'storageUrl'];
    const optionalFields = ['description', 'metadata', 'complianceMapping', 'validationResults'];

    let completed = 0;
    const total = requiredFields.length + optionalFields.length;

    requiredFields.forEach((field: string) => {
      if (this[field as keyof this]) completed++;
    });

    optionalFields.forEach((field: string) => {
      if (this[field as keyof this]) completed++;
    });

    return Math.round((completed / total) * 100);
  }

  // Methods
  canBeEditedBy(userId: string, userRoles: string[]): boolean {
    if (this.createdBy === userId) return true;
    if (this.status === EvidenceStatus.APPROVED) return false;
    if (this.accessControl?.allowedUsers?.includes(userId)) return true;
    if (userRoles.some(role => this.accessControl?.allowedRoles?.includes(role))) return true;
    return false;
  }

  canBeViewedBy(userId: string, userRoles: string[]): boolean {
    if (this.accessControl?.deniedUsers?.includes(userId)) return false;
    if (userRoles.some(role => this.accessControl?.deniedRoles?.includes(role))) return false;
    if (this.accessControl?.allowedUsers?.includes(userId)) return true;
    if (userRoles.some(role => this.accessControl?.allowedRoles?.includes(role))) return true;
    return this.confidentialityLevel === ConfidentialityLevel.PUBLIC;
  }

  addReviewComment(comment: {
    userId: string;
    userName: string;
    comment: string;
    type: 'question' | 'concern' | 'suggestion' | 'approval' | 'rejection';
  }): void {
    if (!this.reviewComments) this.reviewComments = [];
    this.reviewComments.push({
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...comment,
      timestamp: new Date(),
      resolved: false,
    });
  }

  updateValidationResults(results: any): void {
    this.validationResults = results;

    // Update quality score based on validation
    if (results.summary) {
      const { totalChecks, passedChecks } = results.summary;
      this.qualityScore = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;
    }
  }

  recordAccess(userId: string, action: 'view' | 'download'): void {
    if (!this.usageMetrics) {
      this.usageMetrics = { views: [], downloads: [], shares: [] };
    }

    if (action === 'view') {
      this.viewCount++;
      this.usageMetrics.views.push({ userId, timestamp: new Date() });
    } else if (action === 'download') {
      this.downloadCount++;
      this.usageMetrics.downloads.push({ userId, timestamp: new Date() });
    }

    this.lastAccessedAt = new Date();
  }
}
