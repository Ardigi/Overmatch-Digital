import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Control } from '../../controls/entities/control.entity';

export enum ImplementationStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  IMPLEMENTED = 'IMPLEMENTED',
  PARTIALLY_IMPLEMENTED = 'PARTIALLY_IMPLEMENTED',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  REMEDIATION = 'REMEDIATION',
  OVERDUE = 'OVERDUE',
}

export enum ImplementationMaturity {
  INITIAL = 'INITIAL',
  MANAGED = 'MANAGED',
  DEFINED = 'DEFINED',
  QUANTITATIVELY_MANAGED = 'QUANTITATIVELY_MANAGED',
  OPTIMIZING = 'OPTIMIZING',
}

@Entity('control_implementations')
export class ControlImplementation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  controlId: string;

  @ManyToOne(
    () => Control,
    (control) => control.implementations
  )
  @JoinColumn({ name: 'controlId' })
  control: Control;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({
    type: 'enum',
    enum: ImplementationStatus,
    default: ImplementationStatus.NOT_STARTED,
  })
  status: ImplementationStatus;

  @Column({
    type: 'enum',
    enum: ImplementationMaturity,
    default: ImplementationMaturity.INITIAL,
  })
  maturityLevel: ImplementationMaturity;

  @Column({ type: 'text' })
  implementationDescription: string;

  @Column({ type: 'jsonb', default: {} })
  configuration: {
    systems: string[];
    processes: string[];
    technologies: string[];
    responsibleParties: Array<{
      userId: string;
      role: string;
      responsibilities: string[];
    }>;
  };

  @Column({ type: 'jsonb', default: [] })
  documentation: Array<{
    id: string;
    type: string;
    name: string;
    url: string;
    version: string;
    lastUpdated: Date;
  }>;

  @Column({ type: 'jsonb', default: {} })
  effectiveness: {
    score: number; // 0-100
    lastAssessmentDate: Date;
    assessmentMethod: string;
    strengths: string[];
    weaknesses: string[];
    improvements: string[];
  };

  @Column({ type: 'jsonb', default: [] })
  gaps: Array<{
    id: string;
    description: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    remediationPlan: string;
    targetDate: Date;
    status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
    assignedTo: string;
  }>;

  @Column({ type: 'jsonb', default: {} })
  monitoring: {
    kpis: Array<{
      name: string;
      target: number;
      current: number;
      unit: string;
    }>;
    alerts: Array<{
      type: string;
      threshold: number;
      enabled: boolean;
    }>;
    dashboardUrl?: string;
  };

  @Column({ type: 'jsonb', default: [] })
  changeHistory: Array<{
    changeId: string;
    changeType: string;
    description: string;
    changedBy: string;
    changedAt: Date;
    approvedBy?: string;
    impact: string;
  }>;

  @Column({ type: 'date', nullable: true })
  implementationDate: Date;

  @Column({ type: 'date', nullable: true })
  plannedDate: Date;

  @Column({ type: 'date', nullable: true })
  lastReviewDate: Date;

  @Column({ type: 'date', nullable: true })
  nextReviewDate: Date;

  @Column({ type: 'uuid' })
  implementedBy: string;

  @Column({ type: 'uuid', nullable: true })
  responsibleParty: string;

  @Column({ type: 'jsonb', default: [] })
  evidence: Array<{
    type: string;
    description: string;
    location: string;
    uploadedAt: Date;
    uploadedBy: string;
  }>;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', default: {} })
  costBenefit: {
    implementationCost: number;
    annualOperatingCost: number;
    riskReduction: number;
    roi: number;
    paybackPeriod: number;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
