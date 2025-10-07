import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Control } from './control.entity';

export enum ExceptionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

@Entity('control_exceptions')
export class ControlException {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  controlId: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text' })
  justification: string;

  @Column({
    type: 'enum',
    enum: ExceptionStatus,
    default: ExceptionStatus.PENDING,
  })
  status: ExceptionStatus;

  @Column({ type: 'uuid' })
  requestedBy: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'jsonb', default: {} })
  riskAssessment: {
    impact: 'critical' | 'high' | 'medium' | 'low';
    likelihood: 'certain' | 'likely' | 'possible' | 'unlikely' | 'rare';
    residualRisk: 'high' | 'medium' | 'low';
    mitigations: string[];
  };

  @Column({ type: 'jsonb', default: [] })
  compensatingControls: string[]; // Array of control IDs

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvalDate: Date;

  @Column({ type: 'text', nullable: true })
  approvalComments: string;

  @Column({ type: 'jsonb', default: [] })
  conditions: string[]; // Conditions that must be met

  @Column({ type: 'jsonb', default: [] })
  reviewHistory: Array<{
    reviewedBy: string;
    reviewDate: Date;
    decision: 'approved' | 'rejected' | 'needs_info';
    comments: string;
  }>;

  @ManyToOne(
    () => Control,
    (control) => control.exceptions
  )
  @JoinColumn({ name: 'controlId' })
  control: Control;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
