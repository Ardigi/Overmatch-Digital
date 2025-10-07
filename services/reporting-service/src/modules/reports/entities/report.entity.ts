import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ReportTemplate } from './report-template.entity';

export enum ReportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum ReportFormat {
  PDF = 'PDF',
  EXCEL = 'EXCEL',
  WORD = 'WORD',
  CSV = 'CSV',
  JSON = 'JSON',
}

export enum ClassificationLevel {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED',
}

@Entity('reports')
@Index(['organizationId', 'createdAt'])
@Index(['organizationId', 'status'])
@Index(['organizationId', 'reportType'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  @Index()
  organizationId: string;

  @Column({ name: 'template_id', nullable: true })
  templateId?: string;

  @ManyToOne(() => ReportTemplate, { nullable: true })
  @JoinColumn({ name: 'template_id' })
  template?: ReportTemplate;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'report_type' })
  @Index()
  reportType: string;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  @Column({
    type: 'enum',
    enum: ReportFormat,
    default: ReportFormat.PDF,
  })
  format: ReportFormat;

  @Column({ name: 'file_path', nullable: true })
  filePath?: string;

  @Column({ name: 'file_name', nullable: true })
  fileName?: string;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize?: number;

  @Column({ name: 'mime_type', nullable: true })
  mimeType?: string;

  @Column({ nullable: true })
  checksum?: string;

  @Column({ name: 'file_url', nullable: true })
  fileUrl?: string;

  @Column({ name: 'generated_at', type: 'timestamp', nullable: true })
  generatedAt?: Date;

  @Column({ name: 'generated_by', nullable: true })
  generatedBy?: string;

  @Column({ name: 'period_start', type: 'date', nullable: true })
  periodStart?: Date;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  periodEnd?: Date;

  @Column({ name: 'reporting_period_start', type: 'date', nullable: true })
  reportingPeriodStart?: Date;

  @Column({ name: 'reporting_period_end', type: 'date', nullable: true })
  reportingPeriodEnd?: Date;

  @Column({ type: 'jsonb', nullable: true })
  parameters?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  sections?: Array<{
    id: string;
    name: string;
    order: number;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  filters?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  summary?: {
    overallScore: number;
    totalControls: number;
    effectiveControls: number;
    failedControls: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
  };

  @Column({ type: 'text', nullable: true })
  error?: string;

  @Column({ name: 'error_details', type: 'jsonb', nullable: true })
  errorDetails?: any;

  @Column({ name: 'processing_started_at', type: 'timestamp', nullable: true })
  processingStartedAt?: Date;

  @Column({ name: 'processing_completed_at', type: 'timestamp', nullable: true })
  processingCompletedAt?: Date;

  @Column({ name: 'generation_time_ms', type: 'integer', nullable: true })
  generationTimeMs?: number;

  // Security fields
  @Column({ name: 'encryption_enabled', default: false })
  encryptionEnabled: boolean;

  @Column({ name: 'encryption_key_id', nullable: true })
  encryptionKeyId?: string;

  @Column({ name: 'digital_signature', type: 'text', nullable: true })
  digitalSignature?: string;

  @Column({ name: 'signature_verified', nullable: true })
  signatureVerified?: boolean;

  @Column({
    name: 'classification_level',
    type: 'enum',
    enum: ClassificationLevel,
    default: ClassificationLevel.INTERNAL,
  })
  classificationLevel: ClassificationLevel;

  @Column({ name: 'access_control_list', type: 'jsonb', nullable: true })
  accessControlList?: string[]; // User IDs who can access

  @Column({ name: 'data_retention_policy', nullable: true })
  dataRetentionPolicy?: string;

  @Column({ name: 'encrypted_at', type: 'timestamp', nullable: true })
  encryptedAt?: Date;

  @Column({ name: 'signed_at', type: 'timestamp', nullable: true })
  signedAt?: Date;

  @Column({ name: 'watermark_applied', default: false })
  watermarkApplied: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }

  // Business methods
  startGeneration(): void {
    this.status = ReportStatus.PROCESSING;
    this.processingStartedAt = new Date();
  }

  complete(fileUrl: string, metadata: Record<string, any>): void {
    this.status = ReportStatus.COMPLETED;
    this.fileUrl = fileUrl;
    this.metadata = metadata;
    this.processingCompletedAt = new Date();
    this.generatedAt = new Date();

    if (this.processingStartedAt) {
      this.generationTimeMs =
        this.processingCompletedAt.getTime() - this.processingStartedAt.getTime();
    }
  }

  fail(error: string, details?: any): void {
    this.status = ReportStatus.FAILED;
    this.error = error;
    this.errorDetails = details;
    this.processingCompletedAt = new Date();
  }

  cancel(): void {
    this.status = ReportStatus.CANCELLED;
    this.processingCompletedAt = new Date();
  }

  // Security methods
  enableEncryption(keyId: string): void {
    this.encryptionEnabled = true;
    this.encryptionKeyId = keyId;
    this.encryptedAt = new Date();
  }

  setDigitalSignature(signature: string): void {
    this.digitalSignature = signature;
    this.signedAt = new Date();
    this.signatureVerified = false; // Needs verification
  }

  markSignatureVerified(verified: boolean): void {
    this.signatureVerified = verified;
  }

  setClassification(level: ClassificationLevel): void {
    this.classificationLevel = level;
  }

  grantAccess(userId: string): void {
    if (!this.accessControlList) {
      this.accessControlList = [];
    }
    if (!this.accessControlList.includes(userId)) {
      this.accessControlList.push(userId);
    }
  }

  revokeAccess(userId: string): void {
    if (this.accessControlList) {
      this.accessControlList = this.accessControlList.filter((id) => id !== userId);
    }
  }

  hasAccess(userId: string): boolean {
    // If no ACL is set, use default organization-based access
    if (!this.accessControlList || this.accessControlList.length === 0) {
      return true; // Organization-level check would be done elsewhere
    }
    return this.accessControlList.includes(userId);
  }

  isEncrypted(): boolean {
    return this.encryptionEnabled && !!this.encryptionKeyId;
  }

  isSigned(): boolean {
    return !!this.digitalSignature && !!this.signedAt;
  }

  isVerified(): boolean {
    return this.isSigned() && this.signatureVerified === true;
  }
}
