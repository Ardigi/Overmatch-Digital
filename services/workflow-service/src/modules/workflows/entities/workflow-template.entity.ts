import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface TemplateConfig {
  steps: Array<{
    name: string;
    type: string;
    order: number;
    config: Record<string, any>;
    nextStepId?: string;
    errorStepIds?: string[];
  }>;
  defaultInputs?: Record<string, any>;
  customizable?: string[]; // Fields that can be customized when creating from template
  requiredInputs?: string[];
  validations?: Record<string, any>;
}

export interface TemplateUsage {
  count: number;
  lastUsed?: Date;
  organizations?: string[];
}

@Entity('workflow_templates')
@Index(['organizationId', 'category'])
@Index(['organizationId', 'isPublic'])
@Index(['name'])
export class WorkflowTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  organizationId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  category?: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ default: false })
  isPublic: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb' })
  config: TemplateConfig;

  @Column({ type: 'jsonb', default: { count: 0 } })
  usage: TemplateUsage;

  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @Column({ nullable: true })
  icon?: string;

  @Column({ nullable: true })
  previewImage?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column()
  createdBy: string;

  @Column({ nullable: true })
  modifiedBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  incrementUsage(organizationId?: string): void {
    this.usage.count++;
    this.usage.lastUsed = new Date();

    if (organizationId && !this.usage.organizations?.includes(organizationId)) {
      if (!this.usage.organizations) {
        this.usage.organizations = [];
      }
      this.usage.organizations.push(organizationId);
    }
  }

  canBeUsedBy(organizationId: string): boolean {
    return this.isActive && (this.isPublic || this.organizationId === organizationId);
  }

  getCustomizableFields(): string[] {
    return this.config.customizable || [];
  }

  validateInputs(inputs: Record<string, any>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Check required inputs
    if (this.config.requiredInputs) {
      for (const required of this.config.requiredInputs) {
        if (!inputs[required]) {
          errors.push(`Missing required input: ${required}`);
        }
      }
    }

    // Apply validations
    if (this.config.validations) {
      // Implement validation logic based on config
      // This is a placeholder - implement actual validation
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  applyInputs(inputs: Record<string, any>): TemplateConfig {
    const config = JSON.parse(JSON.stringify(this.config)); // Deep clone

    // Merge default inputs with provided inputs
    const mergedInputs = {
      ...this.config.defaultInputs,
      ...inputs,
    };

    // Apply inputs to steps
    config.steps = config.steps.map((step) => {
      const processedStep = { ...step };

      // Replace template variables in config
      if (processedStep.config) {
        processedStep.config = this.replaceTemplateVariables(processedStep.config, mergedInputs);
      }

      return processedStep;
    });

    return config;
  }

  private replaceTemplateVariables(obj: any, inputs: Record<string, any>): any {
    if (typeof obj === 'string') {
      // Replace {{variable}} with actual values
      return obj.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return inputs[key] !== undefined ? inputs[key] : match;
      });
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.replaceTemplateVariables(item, inputs));
    }

    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const key in obj) {
        result[key] = this.replaceTemplateVariables(obj[key], inputs);
      }
      return result;
    }

    return obj;
  }
}
