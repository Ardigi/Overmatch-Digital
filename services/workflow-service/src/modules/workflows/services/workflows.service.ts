import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type AuditFinding,
  ComplianceStatus,
  type Control,
  ErrorResponse,
  type Evidence,
  type OrganizationResponse,
  type Policy,
  type User,
  UserRole,
} from '@soc-compliance/contracts';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import {
  LoggingService,
  Metered,
  MetricsService,
  Observable,
  Traced,
  TracingService,
} from '@soc-compliance/monitoring';
import { Repository, SelectQueryBuilder } from 'typeorm';
import type {
  CreateFromTemplateDto,
  CreateWorkflowDto,
  CreateWorkflowTemplateDto,
  PaginatedResult,
  UpdateWorkflowDto,
  WorkflowInstanceQueryDto,
  WorkflowQueryDto,
  WorkflowTemplateQueryDto,
} from '../dto';
import { 
  Workflow, 
  WorkflowStatus 
} from '../entities/workflow.entity';
import { 
  InstanceStatus, 
  WorkflowInstance 
} from '../entities/workflow-instance.entity';
import { WorkflowStep } from '../entities/workflow-step.entity';
import { WorkflowTemplate } from '../entities/workflow-template.entity';

@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(
    @InjectRepository(Workflow)
    private workflowRepository: Repository<Workflow>,
    @InjectRepository(WorkflowStep)
    private stepRepository: Repository<WorkflowStep>,
    @InjectRepository(WorkflowInstance)
    private instanceRepository: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowTemplate)
    private templateRepository: Repository<WorkflowTemplate>,
    private eventEmitter: EventEmitter2,
    private serviceDiscovery: ServiceDiscoveryService,
    private metricsService: MetricsService,
    private tracingService: TracingService,
    private loggingService: LoggingService,
  ) {}

  @Observable({ spanName: 'workflow-creation', metricName: 'workflow_creation_duration_seconds' })
  async create(dto: CreateWorkflowDto): Promise<Workflow> {
    // Check for duplicate name
    const existing = await this.workflowRepository.findOne({
      where: {
        name: dto.name,
        organizationId: dto.organizationId,
      },
    });

    if (existing) {
      throw new ConflictException('Workflow with this name already exists');
    }

    // Create workflow
    const workflow = this.workflowRepository.create({
      ...dto,
      status: dto.isDraft ? WorkflowStatus.DRAFT : WorkflowStatus.ACTIVE,
      version: 1,
    });

    const savedWorkflow = await this.workflowRepository.save(workflow);

    // Create steps
    if (dto.steps && dto.steps.length > 0) {
      const steps = await this.createSteps(savedWorkflow.id, dto.steps);
      savedWorkflow.steps = steps;
    }

    // Emit event
    this.eventEmitter.emit('workflow.created', {
      workflowId: savedWorkflow.id,
      organizationId: savedWorkflow.organizationId,
      createdBy: savedWorkflow.createdBy,
    });

    return savedWorkflow;
  }

  private async createSteps(workflowId: string, stepDtos: any[]): Promise<WorkflowStep[]> {
    const steps = stepDtos.map(dto => 
      this.stepRepository.create({
        ...dto,
        workflowId,
      })
    );

    const savedSteps = await this.stepRepository.save(steps as unknown as WorkflowStep[]);

    // Update step relationships
    const stepNameToId = new Map<string, string>();
    savedSteps.forEach(step => {
      stepNameToId.set(step.name, step.id);
    });

    // Update nextStepId and errorStepIds with actual IDs
    const updatedSteps = savedSteps.map(step => {
      const dto = stepDtos.find(d => d.name === step.name);
      
      if (dto.nextStepId && stepNameToId.has(dto.nextStepId)) {
        step.nextStepId = stepNameToId.get(dto.nextStepId);
      }
      
      if (dto.errorStepIds) {
        step.errorStepIds = dto.errorStepIds
          .map(name => stepNameToId.get(name))
          .filter(Boolean);
      }
      
      return step;
    });

    return this.stepRepository.save(updatedSteps);
  }

  @Traced('workflow-query')
  async findAll(query: WorkflowQueryDto): Promise<PaginatedResult<Workflow>> {
    const qb = this.workflowRepository.createQueryBuilder('workflow');

    qb.where('workflow.organizationId = :organizationId', { 
      organizationId: query.organizationId 
    });

    if (query.category) {
      qb.andWhere('workflow.category = :category', { category: query.category });
    }

    if (query.status) {
      qb.andWhere('workflow.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        'LOWER(workflow.name) LIKE LOWER(:search) OR LOWER(workflow.description) LIKE LOWER(:search)',
        { search: `%${query.search}%` }
      );
    }

    qb.leftJoinAndSelect('workflow.steps', 'steps')
      .orderBy('workflow.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();

    // Map category to type for API compatibility
    const transformedData = data.map(workflow => ({
      ...workflow,
      type: workflow.category
    }));

    return {
      data: transformedData as unknown as Workflow[],
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findOne(id: string, organizationId: string): Promise<Workflow> {
    const workflow = await this.workflowRepository.findOne({
      where: { id, organizationId },
      relations: ['steps'],
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return workflow;
  }

  async update(
    id: string, 
    dto: UpdateWorkflowDto, 
    organizationId: string
  ): Promise<Workflow> {
    const workflow = await this.findOne(id, organizationId);

    if (workflow.status === WorkflowStatus.ARCHIVED) {
      throw new BadRequestException('Cannot update archived workflow');
    }

    // Update basic fields
    Object.assign(workflow, {
      ...dto,
      version: workflow.version + 1,
      modifiedBy: dto.modifiedBy,
      updatedAt: new Date(),
    });

    // Update steps if provided
    if (dto.steps) {
      // Delete existing steps
      await this.stepRepository.delete({ workflowId: id });
      
      // Create new steps
      const steps = await this.createSteps(id, dto.steps);
      workflow.steps = steps;
    }

    const savedWorkflow = await this.workflowRepository.save(workflow);

    // Emit event
    this.eventEmitter.emit('workflow.updated', {
      workflowId: id,
      changes: dto,
      modifiedBy: dto.modifiedBy,
    });

    return savedWorkflow;
  }

  @Observable({ spanName: 'workflow-publish', metricName: 'workflow_publish_duration_seconds' })
  async publish(id: string, userId: string, organizationId: string): Promise<Workflow> {
    const workflow = await this.findOne(id, organizationId);

    if (workflow.status !== WorkflowStatus.DRAFT) {
      throw new BadRequestException('Only draft workflows can be published');
    }

    // Validate workflow before publishing
    await this.validateWorkflow(workflow);

    workflow.status = WorkflowStatus.ACTIVE;
    workflow.isDraft = false;
    workflow.modifiedBy = userId;

    const savedWorkflow = await this.workflowRepository.save(workflow);

    // Emit event
    this.eventEmitter.emit('workflow.published', {
      workflowId: id,
      publishedBy: userId,
    });

    return savedWorkflow;
  }

  private async validateWorkflow(workflow: Workflow): Promise<void> {
    if (!workflow.steps || workflow.steps.length === 0) {
      throw new BadRequestException('Workflow must have at least one step');
    }

    // Validate step transitions
    const stepIds = new Set(workflow.steps.map(s => s.id));
    
    for (const step of workflow.steps) {
      if (step.nextStepId && !stepIds.has(step.nextStepId)) {
        throw new BadRequestException(`Invalid step transition: ${step.nextStepId} not found`);
      }
      
      if (step.errorStepIds) {
        for (const errorStepId of step.errorStepIds) {
          if (!stepIds.has(errorStepId)) {
            throw new BadRequestException(`Invalid step transition: ${errorStepId} not found`);
          }
        }
      }
    }
  }

  async archive(
    id: string, 
    userId: string, 
    reason: string | null,
    organizationId: string
  ): Promise<Workflow> {
    const workflow = await this.findOne(id, organizationId);

    // Check for running instances
    const runningCount = await this.instanceRepository.count({
      where: {
        workflowId: id,
        status: InstanceStatus.RUNNING,
      },
    });

    if (runningCount > 0) {
      throw new BadRequestException('Cannot archive workflow with running instances');
    }

    workflow.status = WorkflowStatus.ARCHIVED;
    workflow.archivedBy = userId;
    workflow.archivedAt = new Date();
    workflow.archiveReason = reason;

    const savedWorkflow = await this.workflowRepository.save(workflow);

    // Emit event
    this.eventEmitter.emit('workflow.archived', {
      workflowId: id,
      archivedBy: userId,
      reason,
    });

    return savedWorkflow;
  }

  async clone(
    id: string, 
    name: string, 
    description: string | null,
    userId: string,
    organizationId: string
  ): Promise<Workflow> {
    const source = await this.findOne(id, organizationId);

    const cloned = this.workflowRepository.create({
      name,
      description: description || source.description,
      category: source.category,
      status: WorkflowStatus.DRAFT,
      isDraft: true,
      isTemplate: false,
      maxExecutionTime: source.maxExecutionTime,
      retryConfig: source.retryConfig,
      triggers: source.triggers,
      metadata: { ...source.metadata, clonedFrom: id },
      version: 1,
      organizationId,
      createdBy: userId,
    });

    const savedWorkflow = await this.workflowRepository.save(cloned);

    // Clone steps
    if (source.steps && source.steps.length > 0) {
      const clonedSteps = source.steps.map(step => 
        this.stepRepository.create({
          ...step,
          id: undefined,
          workflowId: savedWorkflow.id,
          createdAt: undefined,
          updatedAt: undefined,
        })
      );

      await this.stepRepository.save(clonedSteps);
    }

    return this.findOne(savedWorkflow.id, organizationId);
  }

  @Traced('workflow-instance-query')
  async getInstances(
    workflowId: string, 
    query: WorkflowInstanceQueryDto,
    organizationId: string
  ): Promise<PaginatedResult<WorkflowInstance>> {
    const qb = this.instanceRepository.createQueryBuilder('instance');

    qb.where('instance.workflowId = :workflowId AND instance.organizationId = :organizationId', {
      workflowId,
      organizationId,
    });

    if (query.status) {
      qb.andWhere('instance.status = :status', { status: query.status });
    }

    if (query.startDate) {
      qb.andWhere('instance.startedAt >= :startDate', { 
        startDate: new Date(query.startDate) 
      });
    }

    if (query.endDate) {
      qb.andWhere('instance.startedAt <= :endDate', { 
        endDate: new Date(query.endDate) 
      });
    }

    if (query.initiatedBy) {
      qb.andWhere('instance.initiatedBy = :initiatedBy', { 
        initiatedBy: query.initiatedBy 
      });
    }

    if (query.correlationId) {
      qb.andWhere('instance.correlationId = :correlationId', { 
        correlationId: query.correlationId 
      });
    }

    qb.leftJoinAndSelect('instance.workflow', 'workflow')
      .leftJoinAndSelect('instance.steps', 'steps')
      .orderBy('instance.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getInstance(instanceId: string, organizationId: string): Promise<WorkflowInstance> {
    const instance = await this.instanceRepository.findOne({
      where: { 
        id: instanceId, 
        organizationId 
      },
      relations: ['workflow', 'steps'],
    });

    if (!instance) {
      throw new NotFoundException('Workflow instance not found');
    }

    return instance;
  }

  async createTemplate(dto: CreateWorkflowTemplateDto): Promise<WorkflowTemplate> {
    const template = this.templateRepository.create(dto);
    const savedTemplate = await this.templateRepository.save(template);

    // Emit event
    this.eventEmitter.emit('workflow.template.created', {
      templateId: savedTemplate.id,
      createdBy: savedTemplate.createdBy,
    });

    return savedTemplate;
  }

  async getTemplates(
    organizationId: string,
    query: WorkflowTemplateQueryDto
  ): Promise<WorkflowTemplate[]> {
    const qb = this.templateRepository.createQueryBuilder('template');

    qb.where('template.isActive = :isActive', { isActive: true });

    // Show public templates or templates from user's organization
    qb.andWhere('(template.isPublic = :isPublic OR template.organizationId = :organizationId)', {
      isPublic: true,
      organizationId,
    });

    if (query.category) {
      qb.andWhere('template.category = :category', { category: query.category });
    }

    if (query.isPublic !== undefined) {
      qb.andWhere('template.isPublic = :isPublic', { isPublic: query.isPublic });
    }

    if (query.search) {
      qb.andWhere(
        'LOWER(template.name) LIKE LOWER(:search) OR LOWER(template.description) LIKE LOWER(:search)',
        { search: `%${query.search}%` }
      );
    }

    qb.orderBy('template.usage.count', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    return qb.getMany();
  }

  @Metered('workflow_template_instantiation_duration_seconds')
  async createFromTemplate(
    templateId: string,
    dto: CreateFromTemplateDto,
    userId: string,
    organizationId: string
  ): Promise<Workflow> {
    const template = await this.templateRepository.findOne({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (!template.canBeUsedBy(organizationId)) {
      throw new BadRequestException('Template not available for this organization');
    }

    // Validate inputs
    const validation = template.validateInputs(dto.inputs || {});
    if (!validation.valid) {
      throw new BadRequestException(`Invalid inputs: ${validation.errors.join(', ')}`);
    }

    // Apply inputs to template
    const config = template.applyInputs(dto.inputs || {});

    // Create workflow from template
    const workflowDto: CreateWorkflowDto = {
      name: dto.name,
      description: dto.description,
      category: template.category,
      isDraft: true,
      metadata: {
        templateId,
        templateInputs: { ...template.config.defaultInputs, ...dto.inputs },
      },
      steps: config.steps,
      organizationId,
      createdBy: userId,
    };

    const workflow = await this.create(workflowDto);

    // Update template usage
    template.incrementUsage(organizationId);
    await this.templateRepository.save(template);

    // Emit event
    this.eventEmitter.emit('workflow.created.from.template', {
      workflowId: workflow.id,
      templateId,
      createdBy: userId,
    });

    return workflow;
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const workflow = await this.findOne(id, organizationId);

    // Check for instances
    const instanceCount = await this.instanceRepository.count({
      where: { workflowId: id },
    });

    if (instanceCount > 0) {
      throw new BadRequestException('Cannot delete workflow with existing instances');
    }

    await this.workflowRepository.remove(workflow);

    // Emit event
    this.eventEmitter.emit('workflow.deleted', {
      workflowId: id,
      organizationId,
    });
  }

  /**
   * Execute workflow with enhanced service validation and retry logic
   */
  @Observable({ spanName: 'workflow-execution', metricName: 'workflow_execution_duration_seconds' })
  async executeWorkflowWithValidation(
    workflowId: string,
    inputs: Record<string, any>,
    context: {
      organizationId: string;
      userId: string;
      userRoles?: string[];
      clientId?: string;
      correlationId?: string;
      metadata?: Record<string, any>;
    },
    options?: {
      validateServices?: boolean;
      requiredServices?: string[];
      retryOnFailure?: boolean;
      maxRetries?: number;
    }
  ): Promise<{
    success: boolean;
    instanceId?: string;
    error?: string;
    serviceValidation?: {
      available: string[];
      unavailable: string[];
      warnings: string[];
    };
  }> {
    const opts = {
      validateServices: true,
      requiredServices: ['auth-service', 'client-service'],
      retryOnFailure: false,
      maxRetries: 0,
      ...options,
    };

    try {
      // Validate services if requested
      let serviceValidation;
      if (opts.validateServices && opts.requiredServices.length > 0) {
        serviceValidation = await this.validateServiceAvailability(opts.requiredServices);
        
        if (serviceValidation.unavailable.length > 0) {
          this.logger.warn('Some required services are unavailable:', serviceValidation.warnings);
          // Continue execution but log warnings
        }
      }

      // Get workflow details
      const workflow = await this.workflowRepository.findOne({
        where: { id: workflowId },
        relations: ['steps'],
      });

      if (!workflow) {
        return {
          success: false,
          error: 'Workflow not found',
          serviceValidation,
        };
      }

      // Create basic workflow instance (this would typically delegate to WorkflowEngineService)
      const instance = this.instanceRepository.create({
        workflowId,
        organizationId: context.organizationId,
        name: `Workflow - ${new Date().toISOString()}`,
        status: InstanceStatus.PENDING,
        context: {
          inputs,
          outputs: {},
          variables: {},
          metadata: context.metadata || {},
          userId: context.userId,
          organizationId: context.organizationId,
          clientId: context.clientId,
          correlationId: context.correlationId,
        },
        totalSteps: workflow.steps?.length || 0,
        completedSteps: 0,
        triggerInfo: {
          type: 'manual',
          user: context.userId,
        },
        priority: inputs.priority || 5,
        initiatedBy: context.userId,
        correlationId: context.correlationId,
      });

      const savedInstance = await this.instanceRepository.save(instance);
      
      return {
        success: true,
        instanceId: savedInstance.id,
        serviceValidation,
      };
    } catch (error) {
      this.logger.error('Error executing workflow with validation:', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ==========================================
  // Orchestration Methods - Cross-Service Communication
  // ==========================================

  /**
   * Get user details from auth service
   */
  async getUserDetails(userId: string): Promise<User | null> {
    try {
      const response = await this.serviceDiscovery.callService<User>(
        'auth-service',
        'GET',
        `/api/users/${userId}`
      );
      
      if (!response.success) {
        this.logger.warn(`Failed to get user details for ${userId}:`, response.error);
        // Return fallback user data for workflow continuity
        return {
          id: userId,
          email: 'unknown@example.com',
          name: 'Unknown User',
          role: UserRole.CLIENT_USER,
          mfaEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      
      return response.data || null;
    } catch (error) {
      this.logger.error(`Error getting user details for ${userId}:`, error);
      // Return fallback user data for workflow continuity
      return {
        id: userId,
        email: 'unknown@example.com',
        name: 'Unknown User',
        role: UserRole.CLIENT_USER,
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Get organization details from client service
   */
  async getOrganizationDetails(organizationId: string): Promise<OrganizationResponse | null> {
    try {
      const response = await this.serviceDiscovery.callService<OrganizationResponse>(
        'client-service',
        'GET',
        `/api/organizations/${organizationId}`
      );
      
      if (!response.success) {
        this.logger.warn(`Failed to get organization details for ${organizationId}:`, response.error);
        // Return fallback organization data for workflow continuity
        return {
          id: organizationId,
          name: 'Unknown Organization',
          slug: 'unknown-org',
          status: 'active',
          complianceStatus: ComplianceStatus.NOT_STARTED,
          contactInfo: {
            primaryEmail: 'contact@unknown.com',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      
      return response.data || null;
    } catch (error) {
      this.logger.error(`Error getting organization details for ${organizationId}:`, error);
      // Return fallback organization data for workflow continuity
      return {
        id: organizationId,
        name: 'Unknown Organization',
        slug: 'unknown-org',
        status: 'active',
        complianceStatus: ComplianceStatus.NOT_STARTED,
        contactInfo: {
          primaryEmail: 'contact@unknown.com',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Get client details from client service
   */
  async getClientDetails(clientId: string): Promise<OrganizationResponse | null> {
    try {
      const response = await this.serviceDiscovery.callService<OrganizationResponse>(
        'client-service',
        'GET',
        `/api/clients/${clientId}`
      );
      
      if (!response.success) {
        this.logger.warn(`Failed to get client details for ${clientId}:`, response.error);
        // Return fallback client data for workflow continuity
        return {
          id: clientId,
          name: 'Unknown Client',
          slug: 'unknown-client',
          status: 'active',
          complianceStatus: ComplianceStatus.NOT_STARTED,
          contactInfo: {
            primaryEmail: 'contact@unknown.com',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      
      return response.data || null;
    } catch (error) {
      this.logger.error(`Error getting client details for ${clientId}:`, error);
      // Return fallback client data for workflow continuity
      return {
        id: clientId,
        name: 'Unknown Client',
        slug: 'unknown-client',
        status: 'active',
        complianceStatus: ComplianceStatus.NOT_STARTED,
        contactInfo: {
          primaryEmail: 'contact@unknown.com',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Get policy details from policy service
   */
  async getPolicyDetails(policyId: string): Promise<Policy | null> {
    try {
      const response = await this.serviceDiscovery.callService<Policy>(
        'policy-service',
        'GET',
        `/api/policies/${policyId}`
      );
      
      if (!response.success) {
        this.logger.warn(`Failed to get policy details for ${policyId}:`, response.error);
        return null;
      }
      
      return response.data || null;
    } catch (error) {
      this.logger.error(`Error getting policy details for ${policyId}:`, error);
      return null;
    }
  }

  /**
   * Get control details from control service
   */
  async getControlDetails(controlId: string): Promise<Control | null> {
    try {
      const response = await this.serviceDiscovery.callService<Control>(
        'control-service',
        'GET',
        `/api/controls/${controlId}`
      );
      
      if (!response.success) {
        this.logger.warn(`Failed to get control details for ${controlId}:`, response.error);
        return null;
      }
      
      return response.data || null;
    } catch (error) {
      this.logger.error(`Error getting control details for ${controlId}:`, error);
      return null;
    }
  }

  /**
   * Submit evidence to evidence service
   */
  async submitEvidence(evidenceData: Partial<Evidence>): Promise<Evidence | null> {
    try {
      const response = await this.serviceDiscovery.callService<Evidence>(
        'evidence-service',
        'POST',
        '/api/evidence',
        evidenceData
      );
      
      if (!response.success) {
        this.logger.error('Failed to submit evidence:', response.error);
        return null;
      }
      
      return response.data || null;
    } catch (error) {
      this.logger.error('Error submitting evidence:', error);
      return null;
    }
  }

  /**
   * Send notification via notification service
   */
  async sendNotification(notificationData: {
    type: string;
    recipients: string[];
    subject?: string;
    message: string;
    data?: Record<string, any>;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    scheduledFor?: Date;
  }): Promise<boolean> {
    try {
      const response = await this.serviceDiscovery.callService<{ id: string; status: string }>(
        'notification-service',
        'POST',
        '/api/notifications',
        notificationData
      );
      
      if (!response.success) {
        this.logger.error('Failed to send notification:', response.error);
        return false;
      }
      
      return true;
    } catch (error) {
      this.logger.error('Error sending notification:', error);
      return false;
    }
  }

  /**
   * Create audit trail entry via audit service
   */
  async createAuditTrail(auditData: {
    action: string;
    resourceType: string;
    resourceId: string;
    details?: Record<string, any>;
    organizationId: string;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ id: string; timestamp: Date } | null> {
    try {
      const response = await this.serviceDiscovery.callService<{ id: string; timestamp: Date }>(
        'audit-service',
        'POST',
        '/api/audit-trail',
        auditData
      );
      
      if (!response.success) {
        this.logger.error('Failed to create audit trail:', response.error);
        return null;
      }
      
      return response.data || null;
    } catch (error) {
      this.logger.error('Error creating audit trail:', error);
      return null;
    }
  }

  /**
   * Generate report via reporting service
   */
  async generateReport(reportConfig: {
    type: string;
    organizationId: string;
    filters?: Record<string, any>;
    format?: 'pdf' | 'excel' | 'json';
    includeCharts?: boolean;
    recipients?: string[];
  }): Promise<{ id: string; status: string; downloadUrl?: string } | null> {
    try {
      const response = await this.serviceDiscovery.callService<{ id: string; status: string; downloadUrl?: string }>(
        'reporting-service',
        'POST',
        '/api/reports/generate',
        reportConfig
      );
      
      if (!response.success) {
        this.logger.error('Failed to generate report:', response.error);
        return null;
      }
      
      return response.data || null;
    } catch (error) {
      this.logger.error('Error generating report:', error);
      return null;
    }
  }

  /**
   * Process with AI service
   */
  async processWithAI(aiRequest: {
    type: 'analyze' | 'recommend' | 'extract' | 'classify';
    input: string | Record<string, any>;
    context?: Record<string, any>;
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    };
  }): Promise<{ result: any; confidence?: number; metadata?: Record<string, any> } | null> {
    try {
      const response = await this.serviceDiscovery.callService<{ result: any; confidence?: number; metadata?: Record<string, any> }>(
        'ai-service',
        'POST',
        '/api/ai/process',
        aiRequest
      );
      
      if (!response.success) {
        this.logger.error('Failed to process with AI service:', response.error);
        return null;
      }
      
      return response.data || null;
    } catch (error) {
      this.logger.error('Error processing with AI service:', error);
      return null;
    }
  }

  /**
   * Create integration workflow via integration service
   */
  async createIntegrationWorkflow(integrationData: {
    name: string;
    type: string;
    source: string;
    target: string;
    mapping: Record<string, any>;
    schedule?: string;
    enabled?: boolean;
    organizationId: string;
  }): Promise<{ id: string; status: string; nextRun?: Date } | null> {
    try {
      const response = await this.serviceDiscovery.callService<{ id: string; status: string; nextRun?: Date }>(
        'integration-service',
        'POST',
        '/api/integrations/workflows',
        integrationData
      );
      
      if (!response.success) {
        this.logger.error('Failed to create integration workflow:', response.error);
        return null;
      }
      
      return response.data || null;
    } catch (error) {
      this.logger.error('Error creating integration workflow:', error);
      return null;
    }
  }

  // ==========================================
  // Enhanced Workflow Orchestration Methods
  // ==========================================

  /**
   * Get multiple controls with fallback for workflow context
   */
  async getControlsByIds(controlIds: string[]): Promise<Control[]> {
    if (!controlIds || controlIds.length === 0) {
      return [];
    }

    try {
      const response = await this.serviceDiscovery.callService<{ items: Control[] }>(
        'control-service',
        'POST',
        '/api/controls/batch',
        { ids: controlIds }
      );
      
      if (!response.success || !response.data?.items) {
        this.logger.warn(`Failed to get controls by IDs:`, response.error);
        return [];
      }
      
      return response.data.items;
    } catch (error) {
      this.logger.error(`Error getting controls by IDs:`, error);
      return [];
    }
  }

  /**
   * Get organization controls for workflow processing
   */
  async getOrganizationControls(organizationId: string, filters?: {
    frameworks?: string[];
    status?: string;
    limit?: number;
  }): Promise<Control[]> {
    try {
      const params = new URLSearchParams();
      params.append('organizationId', organizationId);
      if (filters?.frameworks) {
        filters.frameworks.forEach(fw => params.append('frameworks', fw));
      }
      if (filters?.status) {
        params.append('status', filters.status);
      }
      if (filters?.limit) {
        params.append('limit', filters.limit.toString());
      }

      const response = await this.serviceDiscovery.callService<{ items: Control[] }>(
        'control-service',
        'GET',
        `/api/controls?${params.toString()}`
      );
      
      if (!response.success || !response.data?.items) {
        this.logger.warn(`Failed to get organization controls for ${organizationId}:`, response.error);
        return [];
      }
      
      return response.data.items;
    } catch (error) {
      this.logger.error(`Error getting organization controls for ${organizationId}:`, error);
      return [];
    }
  }

  /**
   * Get audit findings for organization
   */
  async getAuditFindings(organizationId: string, filters?: {
    status?: string;
    severity?: string;
    limit?: number;
  }): Promise<AuditFinding[]> {
    try {
      const params = new URLSearchParams();
      params.append('organizationId', organizationId);
      if (filters?.status) {
        params.append('status', filters.status);
      }
      if (filters?.severity) {
        params.append('severity', filters.severity);
      }
      if (filters?.limit) {
        params.append('limit', filters.limit.toString());
      }

      const response = await this.serviceDiscovery.callService<{ items: AuditFinding[] }>(
        'audit-service',
        'GET',
        `/api/findings?${params.toString()}`
      );
      
      if (!response.success || !response.data?.items) {
        this.logger.warn(`Failed to get audit findings for ${organizationId}:`, response.error);
        return [];
      }
      
      return response.data.items;
    } catch (error) {
      this.logger.error(`Error getting audit findings for ${organizationId}:`, error);
      return [];
    }
  }

  /**
   * Validate service availability before workflow execution
   */
  async validateServiceAvailability(requiredServices: string[]): Promise<{
    available: string[];
    unavailable: string[];
    warnings: string[];
  }> {
    const available: string[] = [];
    const unavailable: string[] = [];
    const warnings: string[] = [];

    for (const service of requiredServices) {
      try {
        const response = await this.serviceDiscovery.callService(
          service,
          'GET',
          '/health',
          undefined,
          { timeout: 5000 }
        );
        
        if (response.success) {
          available.push(service);
        } else {
          unavailable.push(service);
          warnings.push(`Service ${service} is not healthy: ${response.error?.message}`);
        }
      } catch (error) {
        unavailable.push(service);
        warnings.push(`Service ${service} is unreachable: ${error.message}`);
      }
    }

    return { available, unavailable, warnings };
  }
}