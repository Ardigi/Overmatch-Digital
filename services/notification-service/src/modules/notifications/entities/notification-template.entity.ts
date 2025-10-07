import * as Handlebars from 'handlebars';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationCategory, NotificationChannel, NotificationType } from './notification.entity';

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required: boolean;
  description?: string;
  default?: any;
  example?: any;
}

export interface TemplateContent {
  subject?: string;
  body: string;
  htmlBody?: string;
  smsBody?: string;
  slackBlocks?: any[];
  teamsCard?: any;
  variables: Record<string, TemplateVariable>;
}

export interface TemplateMetadata {
  tags?: string[];
  category?: string;
  author?: string;
  lastModifiedBy?: string;
  approvedBy?: string;
  approvalDate?: Date;
  expiresAt?: Date;
}

export interface TemplatePerformance {
  usageCount: number;
  lastUsedAt?: Date;
  deliveryRate?: number;
  openRate?: number;
  clickRate?: number;
  unsubscribeRate?: number;
}

@Entity('notification_templates')
@Unique(['organizationId', 'code'])
@Index(['organizationId', 'channel', 'type'])
@Index(['organizationId', 'isActive'])
@Index(['category'])
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', length: 100 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: NotificationChannel,
    enumName: 'notification_channel',
  })
  channel: NotificationChannel;

  @Column({
    type: 'enum',
    enum: NotificationType,
    enumName: 'notification_type',
  })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationCategory,
    enumName: 'notification_category',
    default: NotificationCategory.SYSTEM,
  })
  category: NotificationCategory;

  @Column({ type: 'jsonb' })
  content: TemplateContent;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: TemplateMetadata;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isSystem: boolean;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @Column({ type: 'integer', default: 100 })
  priority: number;

  @Column({ type: 'boolean', default: false })
  isTransactional: boolean;

  @Column({ type: 'jsonb', default: {} })
  performance: TemplatePerformance;

  @Column({ type: 'jsonb', nullable: true })
  defaultVariables?: Record<string, any>;

  @Column({ type: 'simple-array', nullable: true })
  supportedLocales?: string[];

  @Column({ type: 'varchar', length: 10, default: 'en' })
  defaultLocale: string;

  @Column({ type: 'uuid' })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Compiled templates cache (not persisted)
  private compiledTemplates: Map<string, Handlebars.TemplateDelegate> = new Map();

  // Methods
  validateVariables(providedVariables: Record<string, any>): {
    valid: boolean;
    errors?: string[];
    warnings?: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.content.variables) {
      return { valid: true };
    }

    // Check required variables
    Object.entries(this.content.variables).forEach(([varName, varDef]) => {
      if (varDef.required && !(varName in providedVariables)) {
        if (varDef.default !== undefined) {
          warnings.push(`Variable '${varName}' is missing but has a default value`);
        } else {
          errors.push(`Required variable '${varName}' is missing`);
        }
      }

      // Type validation
      if (varName in providedVariables) {
        const value = providedVariables[varName];
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (actualType !== varDef.type && value !== null && value !== undefined) {
          errors.push(
            `Variable '${varName}' should be of type '${varDef.type}' but got '${actualType}'`
          );
        }
      }
    });

    // Check for unknown variables
    Object.keys(providedVariables).forEach((varName) => {
      if (!this.content.variables[varName]) {
        warnings.push(`Unknown variable '${varName}' provided`);
      }
    });

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  interpolate(variables: Record<string, any>): {
    subject?: string;
    body: string;
    htmlBody?: string;
    smsBody?: string;
  } {
    // Merge with defaults
    const mergedVariables = {
      ...this.defaultVariables,
      ...variables,
    };

    // Add default values for missing required variables
    Object.entries(this.content.variables || {}).forEach(([varName, varDef]) => {
      if (!(varName in mergedVariables) && varDef.default !== undefined) {
        mergedVariables[varName] = varDef.default;
      }
    });

    const result: any = {};

    // Compile and interpolate each content field
    if (this.content.subject) {
      result.subject = this.compileAndRender('subject', this.content.subject, mergedVariables);
    }

    if (this.content.body) {
      result.body = this.compileAndRender('body', this.content.body, mergedVariables);
    }

    if (this.content.htmlBody) {
      result.htmlBody = this.compileAndRender('htmlBody', this.content.htmlBody, mergedVariables);
    }

    if (this.content.smsBody) {
      result.smsBody = this.compileAndRender('smsBody', this.content.smsBody, mergedVariables);
    }

    return result;
  }

  private compileAndRender(key: string, template: string, variables: Record<string, any>): string {
    try {
      // Check cache
      const cacheKey = `${key}_${this.version}`;
      let compiledTemplate = this.compiledTemplates.get(cacheKey);

      if (!compiledTemplate) {
        compiledTemplate = Handlebars.compile(template);
        this.compiledTemplates.set(cacheKey, compiledTemplate);
      }

      return compiledTemplate(variables);
    } catch (error) {
      throw new Error(`Failed to render template ${key}: ${error.message}`);
    }
  }

  recordUsage(): void {
    if (!this.performance) {
      this.performance = {
        usageCount: 0,
      };
    }

    this.performance.usageCount++;
    this.performance.lastUsedAt = new Date();
  }

  updatePerformanceMetrics(metrics: {
    delivered?: number;
    opened?: number;
    clicked?: number;
    unsubscribed?: number;
    total?: number;
  }): void {
    if (!this.performance) {
      this.performance = {
        usageCount: 0,
      };
    }

    if (metrics.total && metrics.total > 0) {
      if (metrics.delivered !== undefined) {
        this.performance.deliveryRate = (metrics.delivered / metrics.total) * 100;
      }
      if (metrics.opened !== undefined) {
        this.performance.openRate = (metrics.opened / metrics.total) * 100;
      }
      if (metrics.clicked !== undefined) {
        this.performance.clickRate = (metrics.clicked / metrics.total) * 100;
      }
      if (metrics.unsubscribed !== undefined) {
        this.performance.unsubscribeRate = (metrics.unsubscribed / metrics.total) * 100;
      }
    }
  }

  @BeforeInsert()
  @BeforeUpdate()
  validateContent() {
    // Ensure required fields based on channel
    switch (this.channel) {
      case NotificationChannel.EMAIL:
        if (!this.content.subject || !this.content.body) {
          throw new Error('Email templates must have subject and body');
        }
        break;
      case NotificationChannel.SMS:
        if (!this.content.smsBody && !this.content.body) {
          throw new Error('SMS templates must have smsBody or body');
        }
        break;
      case NotificationChannel.SLACK:
        if (!this.content.body && !this.content.slackBlocks) {
          throw new Error('Slack templates must have body or slackBlocks');
        }
        break;
    }

    // Validate template syntax
    try {
      const testVars = {};
      Object.entries(this.content.variables || {}).forEach(([varName, varDef]) => {
        testVars[varName] = varDef.example || varDef.default || `test_${varName}`;
      });

      this.interpolate(testVars);
    } catch (error) {
      throw new Error(`Invalid template syntax: ${error.message}`);
    }
  }

  clone(): Partial<NotificationTemplate> {
    return {
      code: `${this.code}_copy`,
      name: `${this.name} (Copy)`,
      description: this.description,
      channel: this.channel,
      type: this.type,
      category: this.category,
      content: JSON.parse(JSON.stringify(this.content)),
      metadata: this.metadata ? JSON.parse(JSON.stringify(this.metadata)) : undefined,
      defaultVariables: this.defaultVariables
        ? JSON.parse(JSON.stringify(this.defaultVariables))
        : undefined,
      supportedLocales: this.supportedLocales ? [...this.supportedLocales] : undefined,
      defaultLocale: this.defaultLocale,
      priority: this.priority,
      isTransactional: this.isTransactional,
      isActive: false, // Clone starts as inactive
      version: 1,
    };
  }
}
