import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PredictionType {
  COMPLIANCE_SCORE = 'compliance_score',
  AUDIT_READINESS = 'audit_readiness',
  RISK_LEVEL = 'risk_level',
  CONTROL_EFFECTIVENESS = 'control_effectiveness',
  INCIDENT_LIKELIHOOD = 'incident_likelihood',
}

export enum PredictionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  SUPERSEDED = 'superseded',
  DRAFT = 'draft',
}

export interface PredictionValue {
  value: number | string;
  confidence: number;
  range?: {
    min: number;
    max: number;
  };
  factors?: string[];
}

export interface PredictionData {
  [timepoint: string]: PredictionValue;
}

export interface PredictionMetadata {
  features?: string[];
  modelType?: string;
  modelVersion?: string;
  trainingDate?: Date;
  accuracy?: number;
  dataPoints?: number;
  [key: string]: any;
}

@Entity('predictions')
@Index(['organizationId', 'clientId'])
@Index(['type', 'status'])
@Index(['createdAt'])
export class Prediction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  organizationId: string;

  @Column('uuid')
  @Index()
  clientId: string;

  @Column({
    type: 'enum',
    enum: PredictionType,
  })
  type: PredictionType;

  @Column('varchar', { length: 50 })
  timeframe: string;

  @Column('jsonb')
  predictions: PredictionData;

  @Column({
    type: 'enum',
    enum: PredictionStatus,
    default: PredictionStatus.ACTIVE,
  })
  status: PredictionStatus;

  @Column('varchar', { length: 50 })
  modelVersion: string;

  @Column('jsonb', { nullable: true })
  metadata: PredictionMetadata;

  @Column('text', { nullable: true })
  description: string;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column('uuid', { nullable: true })
  createdBy: string;

  @Column('timestamp', { nullable: true })
  expiresAt: Date;

  @Column('text', { nullable: true })
  notes: string;

  @Column('decimal', { nullable: true, precision: 5, scale: 2 })
  accuracy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
