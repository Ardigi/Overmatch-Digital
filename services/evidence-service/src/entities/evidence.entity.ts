import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Enums
export enum EvidenceType {
  DOCUMENT = 'DOCUMENT',
  LOG = 'LOG',
  SCREENSHOT = 'SCREENSHOT',
  REPORT = 'REPORT',
  OTHER = 'OTHER',
}

export enum EvidenceStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}

export enum EvidenceSource {
  MANUAL = 'MANUAL',
  AUTOMATED = 'AUTOMATED',
  INTEGRATION = 'INTEGRATION',
  API = 'API',
  SYSTEM = 'SYSTEM',
}

export enum ConfidentialityLevel {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED',
}

// Retention policy interface
interface RetentionPolicy {
  policy: string;
  expiresAt: Date;
}

@Entity('evidence')
@Index(['organizationId'])
@Index(['status'])
@Index(['collectedAt'])
@Index(['type'])
@Index(['auditId'])
@Index(['controlId'])
@Index(['organizationId', 'status', 'type'])
@Index(['organizationId', 'collectedAt'])
export class Evidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({
    type: 'enum',
    enum: EvidenceType,
  })
  type: EvidenceType;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'file_path', nullable: true })
  filePath?: string;

  @Column({ name: 'file_name', nullable: true })
  fileName?: string;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize?: number;

  @Column({ name: 'mime_type', nullable: true })
  mimeType?: string;

  @Column({ nullable: true })
  hash?: string;

  @Column({ name: 'collected_at', type: 'timestamp' })
  collectedAt: Date;

  @Column({ name: 'collected_by' })
  collectedBy: string;

  @Column({
    type: 'enum',
    enum: EvidenceSource,
    default: EvidenceSource.MANUAL,
  })
  source: EvidenceSource;

  @Column({
    type: 'enum',
    enum: EvidenceStatus,
    default: EvidenceStatus.PENDING,
  })
  status: EvidenceStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column('simple-array', { nullable: true })
  tags?: string[];

  @Column({ name: 'audit_id', nullable: true })
  auditId?: string;

  @Column({ name: 'control_id', nullable: true })
  controlId?: string;

  @Column({ name: 'validated_at', type: 'timestamp', nullable: true })
  validatedAt?: Date;

  @Column({ name: 'validated_by', nullable: true })
  validatedBy?: string;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string;

  @Column({ type: 'jsonb', nullable: true })
  retention?: RetentionPolicy;

  // Additional fields from DTOs
  @Column({ name: 'client_id', nullable: true })
  clientId?: string;

  @Column({ name: 'request_id', nullable: true })
  requestId?: string;

  @Column({ name: 'collector_id', nullable: true })
  collectorId?: string;

  @Column({ name: 'collector_type', nullable: true })
  collectorType?: string;

  @Column({
    type: 'enum',
    enum: ConfidentialityLevel,
    default: ConfidentialityLevel.INTERNAL,
  })
  confidentialityLevel: ConfidentialityLevel;

  @Column({ name: 'storage_url', nullable: true })
  storageUrl?: string;

  @Column({ name: 'storage_provider', nullable: true })
  storageProvider?: string;

  @Column({ name: 'storage_path', nullable: true })
  storagePath?: string;

  @Column({ name: 'thumbnail_url', nullable: true })
  thumbnailUrl?: string;

  @Column({ name: 'preview_url', nullable: true })
  previewUrl?: string;

  @Column({ name: 'collection_date', type: 'timestamp', nullable: true })
  collectionDate?: Date;

  @Column({ name: 'effective_date', type: 'timestamp', nullable: true })
  effectiveDate?: Date;

  @Column({ name: 'expiration_date', type: 'timestamp', nullable: true })
  expirationDate?: Date;

  @Column({ type: 'jsonb', nullable: true })
  complianceMapping?: {
    frameworks?: Array<{
      name: string;
      controls: string[];
      requirements?: string[];
      score?: number;
    }>;
    trustServicesCriteria?: string[];
    assertions?: string[];
    clauses?: string[];
    safeguards?: string[];
  };

  @Column('simple-array', { nullable: true })
  keywords?: string[];

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

  @Column({ name: 'is_encrypted', default: false })
  isEncrypted: boolean;

  @Column({ name: 'is_sensitive', default: false })
  isSensitive: boolean;

  @Column({ name: 'parent_evidence_id', nullable: true })
  parentEvidenceId?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  // Lifecycle hooks
  @BeforeInsert()
  setDefaults() {
    if (!this.collectedAt) {
      this.collectedAt = new Date();
    }
    if (!this.collectedBy && this.createdBy) {
      this.collectedBy = this.createdBy;
    }
  }

  @BeforeUpdate()
  updateTimestamps() {
    if (this.status === EvidenceStatus.VALIDATED && !this.validatedAt) {
      this.validatedAt = new Date();
    }
  }
}
