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
import { Client } from './client.entity';

export enum DocumentType {
  CONTRACT = 'contract',
  POLICY = 'policy',
  PROCEDURE = 'procedure',
  EVIDENCE = 'evidence',
  REPORT = 'report',
  CERTIFICATE = 'certificate',
  AUDIT_REPORT = 'audit_report',
  ASSESSMENT = 'assessment',
  OTHER = 'other',
}

export enum DocumentStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  ARCHIVED = 'archived',
}

export enum DocumentConfidentiality {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  HIGHLY_CONFIDENTIAL = 'highly_confidential',
}

@Entity('client_documents')
@Index(['clientId'])
@Index(['type'])
@Index(['status'])
export class ClientDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientId: string;

  @ManyToOne(
    () => Client,
    (client) => client.documents,
    {
      onDelete: 'CASCADE',
    }
  )
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: DocumentType,
    enumName: 'document_type',
  })
  type: DocumentType;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    enumName: 'document_status',
    default: DocumentStatus.DRAFT,
  })
  status: DocumentStatus;

  @Column({
    type: 'enum',
    enum: DocumentConfidentiality,
    enumName: 'document_confidentiality',
    default: DocumentConfidentiality.INTERNAL,
  })
  confidentiality: DocumentConfidentiality;

  @Column()
  fileUrl: string;

  @Column({ nullable: true })
  fileName: string;

  @Column({ nullable: true })
  mimeType: string;

  @Column({ nullable: true })
  fileSize: number;

  @Column({ nullable: true })
  checksum: string;

  @Column({ nullable: true })
  version: string;

  @Column({ default: 1 })
  versionNumber: number;

  @Column({ nullable: true })
  parentDocumentId: string;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[];

  @Column({ type: 'simple-json', nullable: true })
  metadata: {
    framework?: string;
    controlIds?: string[];
    projectId?: string;
    auditId?: string;
    author?: string;
    reviewer?: string;
    approver?: string;
    keywords?: string[];
  };

  @Column({ type: 'date', nullable: true })
  effectiveDate: Date;

  @Column({ type: 'date', nullable: true })
  expiryDate: Date;

  @Column({ type: 'date', nullable: true })
  reviewDate: Date;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({ type: 'date', nullable: true })
  approvedDate: Date;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ type: 'simple-json', nullable: true })
  approvalHistory: Array<{
    date?: Date;
    userId?: string;
    action?: string;
    comments?: string;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  accessControl: {
    allowedUsers?: string[];
    allowedRoles?: string[];
    deniedUsers?: string[];
    publicAccess?: boolean;
    requiresMfa?: boolean;
    expiresAt?: Date;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  updatedBy: string;

  // Helper methods
  isExpired(): boolean {
    if (!this.expiryDate) return false;
    return new Date() > new Date(this.expiryDate);
  }

  needsReview(): boolean {
    if (!this.reviewDate) return false;
    return new Date() > new Date(this.reviewDate);
  }

  isApproved(): boolean {
    return this.status === DocumentStatus.APPROVED;
  }

  canAccess(userId: string, userRoles: string[]): boolean {
    if (this.accessControl?.publicAccess) return true;

    if (this.accessControl?.deniedUsers?.includes(userId)) return false;

    if (this.accessControl?.allowedUsers?.includes(userId)) return true;

    if (this.accessControl?.allowedRoles?.some((role) => userRoles.includes(role))) return true;

    return false;
  }
}
