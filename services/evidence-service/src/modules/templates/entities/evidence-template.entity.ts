import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EvidenceType } from '../../evidence/entities/evidence.entity';

export enum TemplateCategory {
  POLICY = 'policy',
  PROCEDURE = 'procedure',
  FORM = 'form',
  CHECKLIST = 'checklist',
  REPORT = 'report',
  ASSESSMENT = 'assessment',
  DOCUMENTATION = 'documentation',
  QUESTIONNAIRE = 'questionnaire',
  MATRIX = 'matrix',
  DIAGRAM = 'diagram',
}

export enum TemplateStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived',
}

// Supported compliance frameworks for type safety
export enum ComplianceFramework {
  SOC2 = 'soc2',
  SOC1 = 'soc1',
  ISO27001 = 'iso27001',
  HIPAA = 'hipaa',
  PCI = 'pci',
  CUSTOM = 'custom',
}

// Type for template field structure
export interface TemplateField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect' | 'file' | 'table' | 'rich_text';
  label: string;
  description?: string;
  required: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    options?: Array<{ value: string; label: string }>;
    fileTypes?: string[];
    maxFileSize?: number;
  };
  defaultValue?: any;
  placeholder?: string;
  helpText?: string;
  conditions?: Array<{
    dependsOn: string;
    value: any;
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
  }>;
  order: number;
}

@Entity('evidence_templates')
@Index(['category', 'status'])
@Index(['framework'])
@Index(['controlIds'])
export class EvidenceTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: TemplateCategory, enumName: 'template_category' })
  category: TemplateCategory;

  @Column({
    type: 'enum',
    enum: TemplateStatus,
    enumName: 'template_status',
    default: TemplateStatus.DRAFT,
  })
  status: TemplateStatus;

  @Column({ type: 'enum', enum: EvidenceType, enumName: 'evidence_type' })
  evidenceType: EvidenceType;

  @Column({ nullable: true })
  version?: string;

  // Template Content
  @Column({ type: 'jsonb' })
  structure: {
    sections: Array<{
      id: string;
      title: string;
      description?: string;
      required: boolean;
      order: number;
      fields: Array<{
        id: string;
        name: string;
        type:
          | 'text'
          | 'number'
          | 'date'
          | 'boolean'
          | 'select'
          | 'multiselect'
          | 'file'
          | 'table'
          | 'rich_text';
        label: string;
        description?: string;
        required: boolean;
        validation?: {
          pattern?: string;
          min?: number;
          max?: number;
          minLength?: number;
          maxLength?: number;
          options?: Array<{ value: string; label: string }>;
          fileTypes?: string[];
          maxFileSize?: number;
        };
        defaultValue?: any;
        placeholder?: string;
        helpText?: string;
        conditions?: Array<{
          field: string;
          operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
          value: any;
          action: 'show' | 'hide' | 'require' | 'disable';
        }>;
      }>;
      subSections?: Array<any>; // Recursive structure
    }>;
    metadata?: {
      estimatedCompletionTime?: number; // in minutes
      requiredRoles?: string[];
      requiredApprovals?: number;
      reviewCycle?: number; // in days
    };
  };

  @Column({ type: 'jsonb', nullable: true })
  sampleData?: Record<string, any>;

  @Column({ nullable: true })
  templateUrl?: string;

  @Column({ nullable: true })
  previewUrl?: string;

  // Compliance Mapping
  @Column({ nullable: true })
  framework?: string;

  @Column({ type: 'simple-array', nullable: true })
  controlIds?: string[];

  @Column({ type: 'simple-array', nullable: true })
  requirementIds?: string[];

  @Column({ type: 'jsonb', nullable: true })
  complianceMapping?: {
    soc2?: {
      trustServicesCriteria: string[];
      commonCriteria?: string[];
    };
    soc1?: {
      controlObjectives: string[];
      assertions?: string[];
    };
    iso27001?: {
      clauses: string[];
      annexA?: string[];
    };
    hipaa?: {
      safeguards: string[];
      requirements?: string[];
    };
    pci?: {
      requirements: string[];
      subRequirements?: string[];
    };
    custom?: Record<string, string[]>;
  };

  // Usage & Analytics
  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  averageCompletionTime?: number; // in minutes

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  successRate?: number; // percentage of approved evidence using this template

  @Column({ type: 'jsonb', nullable: true })
  usageStats?: {
    lastUsed?: Date;
    totalUses: number;
    byClient?: Record<string, number>;
    byFramework?: Record<string, number>;
    completionTimes?: number[];
    feedbackScores?: number[];
  };

  // Instructions & Guidance
  @Column({ type: 'text', nullable: true })
  instructions?: string;

  @Column({ type: 'jsonb', nullable: true })
  guidance?: {
    general?: string;
    sections?: Record<string, string>;
    fields?: Record<string, string>;
    examples?: Array<{
      field: string;
      example: any;
      explanation?: string;
    }>;
    commonMistakes?: string[];
    bestPractices?: string[];
    references?: Array<{
      title: string;
      url?: string;
      description?: string;
    }>;
  };

  // Automation
  @Column({ type: 'jsonb', nullable: true })
  automationRules?: Array<{
    id: string;
    trigger: 'on_create' | 'on_submit' | 'on_field_change' | 'scheduled';
    conditions?: Array<{
      field: string;
      operator: string;
      value: any;
    }>;
    actions: Array<{
      type: 'populate_field' | 'call_api' | 'run_validation' | 'send_notification';
      config: Record<string, any>;
    }>;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  integrations?: Array<{
    type: string; // 'aws', 'azure', 'jira', etc.
    config: Record<string, any>;
    fieldMappings?: Record<string, string>;
  }>;

  // Validation Rules
  @Column({ type: 'jsonb', nullable: true })
  validationRules?: Array<{
    id: string;
    name: string;
    type: 'required' | 'format' | 'business_rule' | 'cross_field' | 'external';
    fields: string[];
    rule: string | Record<string, any>;
    errorMessage: string;
    severity: 'error' | 'warning' | 'info';
  }>;

  // Access Control
  @Column({ type: 'simple-array', nullable: true })
  allowedRoles?: string[];

  @Column({ type: 'simple-array', nullable: true })
  allowedClients?: string[];

  @Column({ default: false })
  isPublic: boolean;

  @Column({ default: true })
  isReusable: boolean;

  // Metadata
  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ type: 'simple-array', nullable: true })
  keywords?: string[];

  @Column({ nullable: true })
  industry?: string;

  @Column({ nullable: true })
  department?: string;

  @Column('uuid')
  createdBy: string;

  @Column('uuid')
  updatedBy: string;

  @Column('uuid', { nullable: true })
  approvedBy?: string;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deprecatedAt?: Date;

  // Methods
  incrementUsage(): void {
    this.usageCount++;
    if (!this.usageStats) {
      this.usageStats = {
        totalUses: 0,
        byClient: {},
        byFramework: {},
        completionTimes: [],
        feedbackScores: [],
      };
    }
    this.usageStats.totalUses++;
    this.usageStats.lastUsed = new Date();
  }

  recordCompletion(clientId: string, framework: string, completionTime: number): void {
    if (!this.usageStats) {
      this.usageStats = {
        totalUses: 0,
        byClient: {},
        byFramework: {},
        completionTimes: [],
        feedbackScores: [],
      };
    }

    if (this.usageStats && this.usageStats.byClient && this.usageStats.byFramework && this.usageStats.completionTimes) {
      this.usageStats.byClient[clientId] = (this.usageStats.byClient[clientId] || 0) + 1;
      this.usageStats.byFramework[framework] = (this.usageStats.byFramework[framework] || 0) + 1;
      this.usageStats.completionTimes.push(completionTime);
    }

    // Update average completion time
    if (this.usageStats?.completionTimes?.length) {
      const times = this.usageStats.completionTimes;
      this.averageCompletionTime = times.reduce((a, b) => a + b, 0) / times.length;
    }
  }

  recordFeedback(score: number): void {
    if (!this.usageStats) {
      this.usageStats = {
        totalUses: 0,
        byClient: {},
        byFramework: {},
        completionTimes: [],
        feedbackScores: [],
      };
    }

    if (this.usageStats && this.usageStats.feedbackScores) {
      this.usageStats.feedbackScores.push(score);
    }
  }

  calculateSuccessRate(approvedCount: number): void {
    if (this.usageCount > 0) {
      this.successRate = (approvedCount / this.usageCount) * 100;
    }
  }

  isApplicableForFramework(framework: string): boolean {
    if (!this.framework && !this.complianceMapping) return true;
    if (this.framework === framework) return true;
    
    // Type-safe framework mapping check
    const normalizedFramework = framework.toLowerCase() as keyof typeof this.complianceMapping;
    return this.isValidFrameworkKey(normalizedFramework) && 
           !!(this.complianceMapping?.[normalizedFramework]);
  }
  
  private isValidFrameworkKey(key: string): key is keyof NonNullable<typeof this.complianceMapping> {
    const validFrameworks = new Set<string>(['soc2', 'soc1', 'iso27001', 'hipaa', 'pci', 'custom']);
    return validFrameworks.has(key);
  }

  getFieldById(fieldId: string): TemplateField | null {
    for (const section of this.structure.sections) {
      const field = section.fields.find(f => f.id === fieldId);
      if (field) return field as TemplateField;
    }
    return null;
  }
}
