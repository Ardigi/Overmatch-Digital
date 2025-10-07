import { Injectable, Logger } from '@nestjs/common';
import type { TemplateParameters } from '../shared/types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Policy, PolicyPriority, PolicyScope, PolicyStatus, PolicyType } from '../policies/entities/policy.entity';
import { PolicyLanguageParser } from './parsers/policy-language.parser';
import { type PolicyTemplate, PolicyTemplates } from './templates/policy-templates';

@Injectable()
export class PolicyTemplateService {
  private readonly logger = new Logger(PolicyTemplateService.name);

  constructor(
    @InjectRepository(Policy)
    private readonly policyRepository: Repository<Policy>,
    private readonly parser: PolicyLanguageParser,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get all available policy templates
   */
  getTemplates(): Record<string, PolicyTemplate> {
    return PolicyTemplates;
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(templateId: string): PolicyTemplate | null {
    return PolicyTemplates[templateId] || null;
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): PolicyTemplate[] {
    return Object.values(PolicyTemplates).filter(
      template => template.category === category
    );
  }

  /**
   * Get templates by framework
   */
  getTemplatesByFramework(framework: string): PolicyTemplate[] {
    return Object.values(PolicyTemplates).filter(
      template => template.frameworks.includes(framework)
    );
  }

  /**
   * Create a policy from a template
   */
  async createPolicyFromTemplate(
    templateId: string,
    customizations: {
      name?: string;
      description?: string;
      parameters?: TemplateParameters;
      organizationId: string;
      createdBy: string;
    }
  ): Promise<Policy> {
    const template = this.getTemplate(templateId);
    
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Apply customizations to template code
    let customizedCode = template.code;
    
    if (customizations.parameters) {
      customizedCode = this.applyParameters(customizedCode, customizations.parameters);
    }

    // Validate the customized policy
    const validationResult = await this.parser.validate(customizedCode);
    if (!validationResult.valid) {
      throw new Error(`Invalid policy: ${validationResult.errors.join(', ')}`);
    }

    // Parse the policy to get structured data
    const parsedPolicy = await this.parser.parse(customizedCode);

    // Create policy entity
    const policy = this.policyRepository.create({
      title: customizations.name || template.name,
      policyNumber: `POL-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      version: '1.0',
      description: customizations.description || template.description,
      purpose: template.description,
      type: PolicyType.OPERATIONAL,
      status: PolicyStatus.DRAFT,
      priority: PolicyPriority.MEDIUM,
      scope: PolicyScope.ORGANIZATION,
      organizationId: customizations.organizationId,
      ownerId: customizations.createdBy,
      ownerName: 'System Generated',
      effectiveDate: new Date(),
      nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      content: {
        sections: [{
          id: '1',
          title: 'Overview',
          content: template.description,
          order: 1
        }],
        definitions: {},
        responsibilities: [],
        procedures: [],
        references: []
      },
      policyAsCode: customizedCode,
      policyAsCodeLanguage: 'rego',
      tags: [...template.frameworks, template.category, 'template-based'],
    });

    const savedPolicies = await this.policyRepository.save(policy);
    const savedPolicy = Array.isArray(savedPolicies) ? savedPolicies[0] : savedPolicies;

    await this.eventEmitter.emit('policy.created.from.template', {
      policyId: savedPolicy.id,
      templateId,
      organizationId: customizations.organizationId,
      createdBy: customizations.createdBy,
      timestamp: new Date(),
    });

    this.logger.log(`Created policy ${savedPolicy.id} from template ${templateId}`);

    return savedPolicy;
  }

  /**
   * Apply parameters to template code
   */
  private applyParameters(code: string, parameters: TemplateParameters): string {
    let customizedCode = code;

    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = `{{${key}}}`;
      const replacement = typeof value === 'string' ? value : JSON.stringify(value);
      customizedCode = customizedCode.replace(new RegExp(placeholder, 'g'), replacement);
    }

    return customizedCode;
  }

  /**
   * Validate a template
   */
  async validateTemplate(templateId: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const template = this.getTemplate(templateId);
    
    if (!template) {
      return {
        valid: false,
        errors: [`Template ${templateId} not found`],
      };
    }

    return await this.parser.validate(template.code);
  }

  /**
   * Get template categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    
    Object.values(PolicyTemplates).forEach(template => {
      categories.add(template.category);
    });

    return Array.from(categories).sort();
  }

  /**
   * Get supported frameworks
   */
  getFrameworks(): string[] {
    const frameworks = new Set<string>();
    
    Object.values(PolicyTemplates).forEach(template => {
      template.frameworks.forEach(framework => frameworks.add(framework));
    });

    return Array.from(frameworks).sort();
  }

  /**
   * Search templates
   */
  searchTemplates(query: {
    keyword?: string;
    category?: string;
    framework?: string;
  }): PolicyTemplate[] {
    let templates = Object.values(PolicyTemplates);

    if (query.category) {
      templates = templates.filter(t => t.category === query.category);
    }

    if (query.framework) {
      templates = templates.filter(t => t.frameworks.includes(query.framework));
    }

    if (query.keyword) {
      const keyword = query.keyword.toLowerCase();
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(keyword) ||
        t.description.toLowerCase().includes(keyword) ||
        t.code.toLowerCase().includes(keyword)
      );
    }

    return templates;
  }
}