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

export enum AssessmentType {
  DESIGN = 'DESIGN',
  OPERATIONAL = 'OPERATIONAL',
  COMBINED = 'COMBINED',
}

export enum AssessmentResult {
  EFFECTIVE = 'EFFECTIVE',
  PARTIALLY_EFFECTIVE = 'PARTIALLY_EFFECTIVE',
  INEFFECTIVE = 'INEFFECTIVE',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

@Entity('control_assessments')
export class ControlAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  controlId: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({
    type: 'enum',
    enum: AssessmentType,
  })
  type: AssessmentType;

  @Column({ type: 'date' })
  assessmentDate: Date;

  @Column({ type: 'uuid' })
  assessedBy: string;

  @Column({
    type: 'enum',
    enum: AssessmentResult,
  })
  designEffectiveness: AssessmentResult;

  @Column({
    type: 'enum',
    enum: AssessmentResult,
    nullable: true,
  })
  operationalEffectiveness: AssessmentResult;

  @Column({ type: 'integer' })
  effectivenessScore: number; // 0-100

  @Column({ type: 'jsonb', default: {} })
  designAssessment: {
    criteria: string[];
    findings: string[];
    recommendations: string[];
  };

  @Column({ type: 'jsonb', default: {} })
  operationalAssessment: {
    testingPeriod: {
      startDate: Date;
      endDate: Date;
    };
    sampleSize: number;
    exceptionsFound: number;
    findings: string[];
    recommendations: string[];
  };

  @Column({ type: 'jsonb', default: [] })
  gaps: Array<{
    type: 'design' | 'operational';
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    recommendation: string;
  }>;

  @Column({ type: 'text', nullable: true })
  assessmentNotes: string;

  @Column({ type: 'jsonb', default: [] })
  evidence: string[]; // Array of file paths or URLs

  @Column({ type: 'uuid', nullable: true })
  reviewedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewDate: Date;

  @Column({ type: 'text', nullable: true })
  reviewComments: string;

  @ManyToOne(
    () => Control,
    (control) => control.assessments
  )
  @JoinColumn({ name: 'controlId' })
  control: Control;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
