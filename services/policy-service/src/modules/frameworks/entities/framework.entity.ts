import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Control } from '../../compliance/entities/control.entity';

export enum FrameworkType {
  COMPLIANCE = 'compliance',
  SECURITY = 'security',
  PRIVACY = 'privacy',
  QUALITY = 'quality',
  RISK = 'risk',
  GOVERNANCE = 'governance',
  CUSTOM = 'custom',
}

export enum FrameworkStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  SUPERSEDED = 'superseded',
}

@Entity('frameworks')
@Index(['name', 'version'])
@Index(['type', 'status'])
export class Framework {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // 'SOC 2', 'ISO 27001', 'NIST CSF', etc.

  @Column()
  fullName: string; // Full official name

  @Column({ nullable: true })
  acronym?: string; // 'SOC', 'ISO', 'NIST', etc.

  @Column()
  version: string; // '2017', '2013', '1.1', etc.

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: FrameworkType, enumName: 'framework_type' })
  type: FrameworkType;

  @Column({
    type: 'enum',
    enum: FrameworkStatus,
    enumName: 'framework_status',
    default: FrameworkStatus.ACTIVE,
  })
  status: FrameworkStatus;

  // Framework Details
  @Column({ type: 'jsonb' })
  structure: {
    // Hierarchical structure of the framework
    domains?: Array<{
      id: string;
      name: string;
      description?: string;
      objectives?: string[];
      categories?: Array<{
        id: string;
        name: string;
        description?: string;
        subcategories?: Array<{
          id: string;
          name: string;
          description?: string;
          requirements?: string[];
        }>;
      }>;
    }>;
    // For SOC 2
    trustServicesCriteria?: Array<{
      id: string; // 'CC1.1', 'CC1.2', etc.
      category: string; // 'Common Criteria', 'Availability', etc.
      name: string;
      description: string;
      points?: Array<{
        id: string;
        description: string;
      }>;
      illustrativeControls?: string[];
    }>;
    // For ISO
    clauses?: Array<{
      id: string; // '4', '5', etc.
      title: string;
      requirements?: Array<{
        id: string; // '4.1', '4.2', etc.
        title: string;
        description: string;
      }>;
    }>;
    annexes?: Array<{
      id: string; // 'A', 'B', etc.
      title: string;
      controls?: Array<{
        id: string; // 'A.5.1.1', etc.
        title: string;
        objective: string;
        guidance?: string;
      }>;
    }>;
    // For NIST
    functions?: Array<{
      id: string; // 'ID', 'PR', 'DE', 'RS', 'RC'
      name: string; // 'Identify', 'Protect', etc.
      categories?: Array<{
        id: string; // 'ID.AM', 'PR.AC', etc.
        name: string;
        subcategories?: Array<{
          id: string; // 'ID.AM-1', etc.
          description: string;
          references?: string[];
        }>;
      }>;
    }>;
    // For HIPAA
    safeguards?: Array<{
      type: 'administrative' | 'physical' | 'technical';
      name: string;
      requirements?: Array<{
        id: string;
        name: string;
        description: string;
        required: boolean;
        addressable?: boolean;
      }>;
    }>;
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata?: {
    publisher?: string;
    publicationDate?: Date;
    effectiveDate?: Date;
    scope?: string[];
    applicability?: string[];
    recognizedBy?: string[]; // Organizations that recognize this framework
    industries?: string[];
    regions?: string[]; // Geographic applicability
    certificationAvailable?: boolean;
    certificationBody?: string;
    auditRequirements?: {
      frequency?: string;
      type?: string; // 'Type I', 'Type II', 'Certification', etc.
      duration?: string;
      samplePeriod?: string;
    };
    references?: Array<{
      title: string;
      url?: string;
      type: 'standard' | 'guidance' | 'tool' | 'training';
    }>;
    updates?: Array<{
      version: string;
      date: Date;
      changes: string[];
      migrationGuide?: string;
    }>;
  };

  // Mapping to Other Frameworks
  @Column({ type: 'jsonb', nullable: true })
  crosswalks?: Array<{
    framework: string;
    version: string;
    mappings: Array<{
      sourceId: string; // ID in this framework
      targetId: string; // ID in target framework
      relationship: 'equivalent' | 'partial' | 'related' | 'subset' | 'superset';
      notes?: string;
    }>;
  }>;

  // Implementation Guidance
  @Column({ type: 'jsonb', nullable: true })
  implementation?: {
    phases?: Array<{
      name: string;
      description: string;
      duration?: string;
      activities: string[];
      deliverables: string[];
      prerequisites?: string[];
    }>;
    maturityModel?: {
      levels: Array<{
        level: number;
        name: string;
        description: string;
        characteristics: string[];
        requirements?: string[];
      }>;
    };
    roles?: Array<{
      title: string;
      responsibilities: string[];
      qualifications?: string[];
    }>;
    tools?: Array<{
      category: string;
      name: string;
      purpose: string;
      vendor?: string;
      url?: string;
    }>;
    templates?: string[]; // Template IDs
    bestPractices?: string[];
    commonChallenges?: Array<{
      challenge: string;
      solution: string;
    }>;
  };

  // Assessment & Scoring
  @Column({ type: 'jsonb', nullable: true })
  assessment?: {
    scoringMethod?: {
      type: 'percentage' | 'maturity' | 'risk-based' | 'custom';
      scale?: string; // '0-100', '1-5', etc.
      calculation?: string; // Formula or method
    };
    criteria?: Array<{
      id: string;
      name: string;
      weight?: number;
      description?: string;
    }>;
    benchmarks?: {
      industry?: Record<string, number>;
      size?: Record<string, number>; // By company size
      maturity?: Record<string, number>; // By maturity level
    };
    certificationRequirements?: {
      minimumScore?: number;
      requiredControls?: string[];
      mandatoryEvidence?: string[];
    };
  };

  // Control Requirements
  @Column({ type: 'jsonb', nullable: true })
  controlRequirements?: {
    total: number;
    byCategory?: Record<string, number>;
    mandatory?: string[]; // Control IDs that are mandatory
    riskBased?: boolean; // Whether controls can be selected based on risk
    compensatingControlsAllowed?: boolean;
    implementationGuidance?: Record<string, string>; // Control ID to guidance
  };

  // Resources & Support
  @Column({ type: 'jsonb', nullable: true })
  resources?: {
    officialWebsite?: string;
    documentation?: Array<{
      title: string;
      url: string;
      type: 'standard' | 'guide' | 'faq' | 'training';
    }>;
    training?: Array<{
      provider: string;
      title: string;
      url?: string;
      cost?: string;
      certification?: boolean;
    }>;
    community?: {
      forums?: string[];
      userGroups?: string[];
      conferences?: string[];
    };
    vendors?: Array<{
      name: string;
      services: string[]; // 'consulting', 'audit', 'tools', etc.
      url?: string;
    }>;
  };

  // Automation Support
  @Column({ type: 'jsonb', nullable: true })
  automation?: {
    apiAvailable?: boolean;
    apiEndpoint?: string;
    machineReadableFormat?: string; // 'JSON', 'XML', 'YAML', etc.
    schemaUrl?: string;
    integrations?: Array<{
      platform: string;
      type: 'import' | 'export' | 'sync' | 'monitor';
      url?: string;
    }>;
    mappingRules?: Array<{
      source: string;
      target: string;
      transformation?: string;
    }>;
  };

  // Statistics & Analytics
  @Column({ type: 'int', default: 0 })
  adoptionCount: number; // Number of organizations using this

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  averageImplementationTime?: number; // In months

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  averageComplianceScore?: number;

  @Column({ type: 'jsonb', nullable: true })
  statistics?: {
    adoptionByIndustry?: Record<string, number>;
    adoptionBySize?: Record<string, number>;
    commonFailures?: Array<{
      controlId: string;
      failureRate: number;
      reasons?: string[];
    }>;
    implementationCosts?: {
      small: { min: number; max: number; average: number };
      medium: { min: number; max: number; average: number };
      large: { min: number; max: number; average: number };
    };
  };

  // Metadata
  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ type: 'simple-array', nullable: true })
  keywords?: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isCustom: boolean;

  @Column('uuid', { nullable: true })
  parentFrameworkId?: string; // For custom frameworks based on standard ones

  @Column('uuid')
  createdBy: string;

  @Column('uuid')
  updatedBy: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Relationships
  @OneToMany(
    () => Control,
    (control) => control.framework
  )
  controls: Control[];

  // Methods
  getControlCount(): number {
    let count = 0;

    if (this.structure.domains) {
      this.structure.domains.forEach((domain) => {
        domain.categories?.forEach((category) => {
          count += category.subcategories?.length || 0;
        });
      });
    }

    if (this.structure.trustServicesCriteria) {
      count += this.structure.trustServicesCriteria.length;
    }

    if (this.structure.annexes) {
      this.structure.annexes.forEach((annex) => {
        count += annex.controls?.length || 0;
      });
    }

    return count;
  }

  getRequiredControlIds(): string[] {
    const required: string[] = [];

    // Extract required controls based on framework type
    if (this.name === 'SOC 2' && this.structure.trustServicesCriteria) {
      this.structure.trustServicesCriteria.forEach((criteria) => {
        required.push(criteria.id);
      });
    }

    if (this.controlRequirements?.mandatory) {
      required.push(...this.controlRequirements.mandatory);
    }

    return required;
  }

  getMappingTo(targetFramework: string): any {
    return this.crosswalks?.find((crosswalk) => crosswalk.framework === targetFramework);
  }

  calculateImplementationEffort(): {
    controls: number;
    estimatedHours: number;
    estimatedCost: number;
    complexity: 'low' | 'medium' | 'high';
  } {
    const controlCount = this.getControlCount();
    const hoursPerControl = 40; // Average estimate
    const hourlyRate = 150; // Average consultant rate

    const estimatedHours = controlCount * hoursPerControl;
    const estimatedCost = estimatedHours * hourlyRate;

    let complexity: 'low' | 'medium' | 'high';
    if (controlCount < 50) complexity = 'low';
    else if (controlCount < 150) complexity = 'medium';
    else complexity = 'high';

    return {
      controls: controlCount,
      estimatedHours,
      estimatedCost,
      complexity,
    };
  }

  isApplicableTo(industry?: string, region?: string, size?: string): boolean {
    if (!this.metadata) return true;

    if (industry && this.metadata.industries) {
      if (!this.metadata.industries.includes(industry)) return false;
    }

    if (region && this.metadata.regions) {
      if (!this.metadata.regions.includes(region)) return false;
    }

    // Additional applicability logic based on size, etc.

    return true;
  }
}
