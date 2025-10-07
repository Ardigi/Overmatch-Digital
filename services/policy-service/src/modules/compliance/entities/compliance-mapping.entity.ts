import {
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
import { Policy } from '../../policies/entities/policy.entity';
import { Control } from './control.entity';
import { ComplianceFramework } from './framework.entity';
import type { ComplianceMappingMetadata } from '../../shared/types';

export enum MappingStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DEPRECATED = 'deprecated',
}

@Entity('compliance_mappings')
@Index(['policyId', 'controlId'], { unique: true })
@Index(['frameworkId'])
@Index(['status'])
@Index(['organizationId'])
export class ComplianceMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  @Index()
  organizationId: string;

  @Column({ name: 'policy_id' })
  policyId: string;

  @Column({ name: 'control_id' })
  controlId: string;

  @Column({ name: 'framework_id' })
  frameworkId: string;

  @Column({
    type: 'enum',
    enum: MappingStatus,
    default: MappingStatus.DRAFT,
  })
  status: MappingStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: ComplianceMappingMetadata;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'rejected_by', nullable: true })
  rejectedBy: string;

  @Column({ name: 'rejected_at', type: 'timestamp', nullable: true })
  rejectedAt: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  // Relations
  @ManyToOne(() => Policy, { eager: false })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy;

  @ManyToOne(() => Control, { eager: false })
  @JoinColumn({ name: 'control_id' })
  control: Control;

  @ManyToOne(() => ComplianceFramework, { eager: false })
  @JoinColumn({ name: 'framework_id' })
  framework: ComplianceFramework;
}
