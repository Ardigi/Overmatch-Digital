import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MappingStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  APPROVED = 'approved',
  DEPRECATED = 'deprecated',
}

export enum MappingType {
  DIRECT = 'direct',
  PARTIAL = 'partial',
  INDIRECT = 'indirect',
  NONE = 'none',
}

export interface ControlMapping {
  sourceControl: string;
  targetControl: string;
  similarity?: number;
  mappingType: MappingType | string;
  confidence?: number;
  notes?: string;
  rationale?: string;
}

export interface MappingCoverage {
  sourceToTarget: number;
  targetToSource: number;
  bidirectional: number;
  unmappedSource?: string[];
  unmappedTarget?: string[];
}

export interface MappingMetadata {
  version?: string;
  methodology?: string;
  lastReviewDate?: Date;
  reviewedBy?: string;
  aiModelVersion?: string;
  confidence?: number;
  [key: string]: any;
}

@Entity('framework_mappings')
@Index(['organizationId', 'sourceFramework', 'targetFramework'], { unique: true })
@Index(['status'])
@Index(['createdAt'])
export class FrameworkMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  organizationId: string;

  @Column('varchar', { length: 100 })
  @Index()
  sourceFramework: string;

  @Column('varchar', { length: 100 })
  @Index()
  targetFramework: string;

  @Column('jsonb')
  mappings: ControlMapping[];

  @Column('jsonb', { nullable: true })
  coverage: MappingCoverage;

  @Column({
    type: 'enum',
    enum: MappingStatus,
    default: MappingStatus.DRAFT,
  })
  status: MappingStatus;

  @Column('jsonb', { nullable: true })
  metadata: MappingMetadata;

  @Column('text', { nullable: true })
  description: string;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column('uuid', { nullable: true })
  createdBy: string;

  @Column('uuid', { nullable: true })
  approvedBy: string;

  @Column('timestamp', { nullable: true })
  approvedAt: Date;

  @Column('text', { nullable: true })
  approvalNotes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
