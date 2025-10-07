import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Control } from './control.entity';

export enum FrameworkType {
  REGULATORY = 'regulatory',
  STANDARD = 'standard',
  BEST_PRACTICE = 'best_practice',
  CUSTOM = 'custom',
}

export enum FrameworkStatus {
  ACTIVE = 'active',
  DRAFT = 'draft',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived',
}

@Entity('compliance_frameworks')
@Index(['organizationId', 'status'])
@Index(['type', 'status'])
export class ComplianceFramework {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  frameworkId: string; // e.g., 'soc2-2022', 'iso27001-2022'

  @Column()
  identifier: string; // Framework-specific identifier

  @Column()
  name: string;

  @Column()
  version: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: FrameworkType })
  type: FrameworkType;

  @Column({ type: 'enum', enum: FrameworkStatus, default: FrameworkStatus.ACTIVE })
  status: FrameworkStatus;

  @Column({ nullable: true })
  category?: string;

  @Column({ nullable: true })
  jurisdiction?: string;

  @Column({ nullable: true })
  regulatoryBody?: string;

  @Column({ type: 'date', nullable: true })
  effectiveDate?: Date;

  @Column({ type: 'date', nullable: true })
  lastUpdated?: Date;

  @Column({ nullable: true })
  officialReference?: string;

  @Column({ nullable: true })
  documentationUrl?: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column('uuid')
  organizationId: string;

  // Owner information
  @Column('uuid')
  ownerId: string;

  // Framework-specific metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    // SOC 2 specific
    trustServicesCriteria?: Record<string, string>;
    socCategories?: string[];

    // ISO 27001 specific
    clauses?: string[];
    annexes?: string[];

    // NIST specific
    functions?: string[];
    nistCategories?: Record<string, string[]>;

    // GDPR specific
    articles?: string[];
    chapters?: string[];

    // Common fields
    officialUrl?: string;
    lastUpdated?: Date;
    nextReview?: Date;
    authority?: string;
    geography?: string[];
    industry?: string[];
    applicability?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  mappings?: {
    // Cross-framework mappings
    relatedFrameworks?: Array<{
      frameworkId: string;
      relationship: 'equivalent' | 'subset' | 'superset' | 'overlapping';
      mappingStrength: number; // 0-100
      notes?: string;
    }>;
  };

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ type: 'simple-array', nullable: true })
  keywords?: string[];

  @Column({ type: 'boolean', default: false })
  isCustom: boolean;

  @Column({ type: 'boolean', default: true })
  isPublic: boolean;

  @Column({ type: 'int', default: 0 })
  controlCount: number;

  @Column({ type: 'int', default: 0 })
  implementedControlCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  implementationPercentage?: number;

  @Column({ type: 'jsonb', nullable: true })
  statistics?: {
    totalControls: number;
    implementedControls: number;
    partiallyImplementedControls: number;
    notImplementedControls: number;
    avgImplementationScore: number;
    lastAssessment: Date;
    criticalGaps: number;
    highPriorityGaps: number;
  };

  @OneToMany(
    () => Control,
    (control) => control.framework
  )
  controls: Control[];

  @Column('uuid')
  createdBy: string;

  @Column('uuid')
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt?: Date;

  // Methods
  calculateImplementationPercentage(): void {
    if (this.controlCount === 0) {
      this.implementationPercentage = 0;
    } else {
      this.implementationPercentage = (this.implementedControlCount / this.controlCount) * 100;
    }
  }

  updateStatistics(controls: Control[]): void {
    const stats = {
      totalControls: controls.length,
      implementedControls: 0,
      partiallyImplementedControls: 0,
      notImplementedControls: 0,
      avgImplementationScore: 0,
      lastAssessment: new Date(),
      criticalGaps: 0,
      highPriorityGaps: 0,
    };

    let totalScore = 0;

    controls.forEach((control) => {
      if (control.implementationStatus === 'implemented') {
        stats.implementedControls++;
      } else if (control.implementationStatus === 'partial') {
        stats.partiallyImplementedControls++;
      } else {
        stats.notImplementedControls++;

        if (control.priority === 'critical') {
          stats.criticalGaps++;
        } else if (control.priority === 'high') {
          stats.highPriorityGaps++;
        }
      }

      totalScore += control.implementationScore || 0;
    });

    stats.avgImplementationScore = controls.length > 0 ? totalScore / controls.length : 0;

    this.statistics = stats;
    this.controlCount = stats.totalControls;
    this.implementedControlCount = stats.implementedControls;
    this.calculateImplementationPercentage();
  }
}
