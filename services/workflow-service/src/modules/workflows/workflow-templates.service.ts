import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowTemplate } from './entities/workflow-template.entity';
import { Workflow, WorkflowStatus } from './entities/workflow.entity';
import { WorkflowsService } from './services/workflows.service';
import type { CreateWorkflowDto } from './dto/create-workflow.dto';

export interface FindTemplatesOptions {
  category?: string;
  isActive?: boolean;
  page: number;
  limit: number;
}

@Injectable()
export class WorkflowTemplatesService {
  private readonly logger = new Logger(WorkflowTemplatesService.name);

  constructor(
    @InjectRepository(WorkflowTemplate)
    private readonly templateRepository: Repository<WorkflowTemplate>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    private readonly workflowsService: WorkflowsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(options: FindTemplatesOptions): Promise<{
    data: WorkflowTemplate[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.templateRepository.createQueryBuilder('template');

    if (options.category) {
      queryBuilder.andWhere('template.category = :category', { 
        category: options.category 
      });
    }

    if (options.isActive !== undefined) {
      queryBuilder.andWhere('template.isActive = :isActive', { 
        isActive: options.isActive 
      });
    }

    queryBuilder.orderBy('template.createdAt', 'DESC');

    const skip = (options.page - 1) * options.limit;
    queryBuilder.skip(skip).take(options.limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page: options.page,
      limit: options.limit,
    };
  }

  async findOne(id: string): Promise<WorkflowTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Workflow template ${id} not found`);
    }

    return template;
  }

  async create(createTemplateDto: any): Promise<WorkflowTemplate> {
    // Check for duplicate name
    const existingTemplate = await this.templateRepository.findOne({
      where: { name: createTemplateDto.name },
    });

    if (existingTemplate) {
      throw new BadRequestException(
        `Template with name "${createTemplateDto.name}" already exists`,
      );
    }

    const template = this.templateRepository.create({
      ...createTemplateDto,
      isActive: true,
      usageCount: 0,
      version: '1.0.0',
    });

    const savedTemplate = await this.templateRepository.save(template);

    await this.eventEmitter.emit('workflow.template.created', {
      templateId: savedTemplate.id,
      name: savedTemplate.name,
      category: savedTemplate.category,
    });

    this.logger.log(`Created workflow template ${savedTemplate.id}`);

    return savedTemplate;
  }

  async update(id: string, updateTemplateDto: any): Promise<WorkflowTemplate> {
    const template = await this.findOne(id);

    // Check for name conflicts if name is being changed
    if (updateTemplateDto.name && updateTemplateDto.name !== template.name) {
      const existingTemplate = await this.templateRepository.findOne({
        where: { name: updateTemplateDto.name },
      });

      if (existingTemplate) {
        throw new BadRequestException(
          `Template with name "${updateTemplateDto.name}" already exists`,
        );
      }
    }

    Object.assign(template, updateTemplateDto);

    // Increment version if significant changes
    if (updateTemplateDto.steps || updateTemplateDto.configuration) {
      const [major, minor, patch] = template.version.split('.').map(Number);
      template.version = `${major}.${minor}.${patch + 1}`;
    }

    const updatedTemplate = await this.templateRepository.save(template);

    await this.eventEmitter.emit('workflow.template.updated', {
      templateId: updatedTemplate.id,
      version: updatedTemplate.version,
    });

    this.logger.log(`Updated workflow template ${id} to version ${updatedTemplate.version}`);

    return updatedTemplate;
  }

  async remove(id: string): Promise<void> {
    const template = await this.findOne(id);

    // Check if template is in use
    const workflowsUsingTemplate = await this.workflowRepository.count({
      where: { templateId: id },
    });

    if (workflowsUsingTemplate > 0) {
      throw new BadRequestException(
        `Cannot delete template that is being used by ${workflowsUsingTemplate} workflow(s)`,
      );
    }

    await this.templateRepository.delete(id);

    await this.eventEmitter.emit('workflow.template.deleted', {
      templateId: id,
      name: template.name,
    });

    this.logger.log(`Deleted workflow template ${id}`);
  }

  async clone(
    id: string,
    cloneOptions: { name: string; description?: string },
  ): Promise<WorkflowTemplate> {
    const sourceTemplate = await this.findOne(id);

    // Check for duplicate name
    const existingTemplate = await this.templateRepository.findOne({
      where: { name: cloneOptions.name },
    });

    if (existingTemplate) {
      throw new BadRequestException(
        `Template with name "${cloneOptions.name}" already exists`,
      );
    }

    const clonedTemplate = this.templateRepository.create({
      ...sourceTemplate,
      id: undefined,
      name: cloneOptions.name,
      description: cloneOptions.description || `Cloned from ${sourceTemplate.name}`,
      usageCount: 0,
      version: '1.0.0',
      createdAt: undefined,
      updatedAt: undefined,
    });

    const savedTemplate = await this.templateRepository.save(clonedTemplate);

    await this.eventEmitter.emit('workflow.template.cloned', {
      sourceTemplateId: id,
      newTemplateId: savedTemplate.id,
      name: savedTemplate.name,
    });

    this.logger.log(`Cloned workflow template ${id} to ${savedTemplate.id}`);

    return savedTemplate;
  }

  async createWorkflowFromTemplate(
    templateId: string,
    createWorkflowDto: CreateWorkflowDto,
  ): Promise<Workflow> {
    const template = await this.findOne(templateId);

    if (!template.isActive) {
      throw new BadRequestException('Cannot create workflow from inactive template');
    }

    // Create workflow with template configuration
    const workflow = await this.workflowsService.create({
      ...createWorkflowDto,
      templateId,
      steps: template.steps,
      configuration: {
        ...template.configuration,
        ...(createWorkflowDto.configuration || {}),
      },
      triggers: template.triggers || [],
      permissions: template.permissions || {},
      metadata: {
        ...template.metadata,
        templateName: template.name,
        templateVersion: template.version,
        createdFromTemplate: true,
      },
    });

    // Increment template usage count
    template.usageCount++;
    template.lastUsedAt = new Date();
    await this.templateRepository.save(template);

    await this.eventEmitter.emit('workflow.created.from.template', {
      workflowId: workflow.id,
      templateId,
      templateName: template.name,
    });

    this.logger.log(`Created workflow ${workflow.id} from template ${templateId}`);

    return workflow;
  }

  async getUsageStatistics(templateId: string): Promise<any> {
    const template = await this.findOne(templateId);

    const workflowsUsingTemplate = await this.workflowRepository.find({
      where: { templateId },
      select: ['id', 'name', 'status', 'organizationId', 'createdAt'],
    });

    const activeWorkflows = workflowsUsingTemplate.filter(
      w => w.status === WorkflowStatus.ACTIVE,
    ).length;

    const organizationsUsing = new Set(
      workflowsUsingTemplate.map(w => w.organizationId),
    ).size;

    return {
      templateId,
      templateName: template.name,
      usageCount: template.usageCount,
      lastUsedAt: template.lastUsedAt,
      totalWorkflows: workflowsUsingTemplate.length,
      activeWorkflows,
      organizationsUsing,
      recentWorkflows: workflowsUsingTemplate
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10)
        .map(w => ({
          id: w.id,
          name: w.name,
          status: w.status,
          createdAt: w.createdAt,
        })),
    };
  }

  async activate(id: string): Promise<WorkflowTemplate> {
    const template = await this.findOne(id);

    if (template.isActive) {
      throw new BadRequestException('Template is already active');
    }

    template.isActive = true;
    const updatedTemplate = await this.templateRepository.save(template);

    await this.eventEmitter.emit('workflow.template.activated', {
      templateId: id,
      name: template.name,
    });

    this.logger.log(`Activated workflow template ${id}`);

    return updatedTemplate;
  }

  async deactivate(id: string): Promise<WorkflowTemplate> {
    const template = await this.findOne(id);

    if (!template.isActive) {
      throw new BadRequestException('Template is already inactive');
    }

    template.isActive = false;
    const updatedTemplate = await this.templateRepository.save(template);

    await this.eventEmitter.emit('workflow.template.deactivated', {
      templateId: id,
      name: template.name,
    });

    this.logger.log(`Deactivated workflow template ${id}`);

    return updatedTemplate;
  }
}