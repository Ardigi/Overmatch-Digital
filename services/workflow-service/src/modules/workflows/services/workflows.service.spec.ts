import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import { LoggingService, MetricsService, TracingService } from '@soc-compliance/monitoring';
import { Repository } from 'typeorm';
import { Workflow, WorkflowStatus } from '../entities/workflow.entity';
import { InstanceStatus, WorkflowInstance } from '../entities/workflow-instance.entity';
import { WorkflowStep } from '../entities/workflow-step.entity';
import { WorkflowTemplate } from '../entities/workflow-template.entity';
import { WorkflowsService } from './workflows.service';

// Mock factories
const createMockRepository = <T = any>(): jest.Mocked<Repository<T>> =>
  ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getMany: jest.fn(),
      getOne: jest.fn(),
    })),
    merge: jest.fn(),
    preload: jest.fn(),
    query: jest.fn(),
    clear: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
  }) as any;

const createMockEventEmitter = (): any => ({
  emit: jest.fn(),
  emitAsync: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  many: jest.fn(),
  off: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  hasListeners: jest.fn(),
  prependListener: jest.fn(),
  prependOnceListener: jest.fn(),
  prependMany: jest.fn(),
  listeners: jest.fn(),
  listenersAny: jest.fn(),
  eventNames: jest.fn(),
  listenerCount: jest.fn(),
  setMaxListeners: jest.fn(),
  getMaxListeners: jest.fn(),
  waitFor: jest.fn(),
});

describe('WorkflowsService', () => {
  let service: WorkflowsService;
  let workflowRepository: any;
  let stepRepository: any;
  let instanceRepository: any;
  let templateRepository: any;
  let eventEmitter: any;
  let serviceDiscovery: any;
  let metricsService: any;
  let tracingService: any;
  let loggingService: any;

  const mockWorkflow = {
    id: 'workflow-123',
    organizationId: 'org-123',
    name: 'Document Approval Workflow',
    description: 'Workflow for document approval process',
    category: 'approval',
    version: 1,
    status: WorkflowStatus.ACTIVE,
    isDraft: false,
    isTemplate: false,
    maxExecutionTime: 86400,
    retryConfig: {
      maxRetries: 3,
      retryDelay: 60,
      backoffMultiplier: 2,
    },
    steps: [],
    triggers: {
      manual: true,
      events: ['document.uploaded'],
    },
    metadata: {
      compliance: ['SOC2'],
      department: 'Finance',
    },
    createdBy: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStep = {
    id: 'step-1',
    workflowId: 'workflow-123',
    name: 'Manager Approval',
    type: 'approval',
    order: 1,
    config: {
      approvers: ['manager'],
      approvalType: 'single',
      timeoutHours: 48,
    },
    nextStepId: 'step-2',
    errorStepIds: ['step-error'],
    retryConfig: {
      maxRetries: 2,
      retryDelay: 30,
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockInstance = {
    id: 'instance-123',
    workflowId: 'workflow-123',
    organizationId: 'org-123',
    status: InstanceStatus.RUNNING,
    currentStepId: 'step-1',
    inputs: {
      document: 'report.pdf',
    },
    outputs: {},
    state: {
      approvals: [],
      variables: {},
    },
    context: {
      userId: 'user-123',
      organizationId: 'org-123',
    },
    startedAt: new Date(),
    completedAt: null,
    error: null,
    executionTime: 0,
    steps: [],
  };

  const mockTemplate: any = {
    id: 'template-123',
    organizationId: 'org-123',
    name: 'Standard Approval Template',
    description: 'Template for standard approval workflows',
    category: 'approval',
    version: 1,
    isPublic: true,
    isActive: true,
    config: {
      steps: [mockStep],
      defaultInputs: {},
      customizable: ['approvers', 'timeouts'],
    },
    usage: {
      count: 10,
      lastUsed: new Date(),
    },
    createdBy: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    canBeUsedBy: jest.fn().mockReturnValue(true),
    validateInputs: jest.fn().mockReturnValue({ valid: true }),
    applyInputs: jest.fn().mockImplementation((inputs) => ({
      steps: [mockStep],
      defaultInputs: { ...inputs },
    })),
    incrementUsage: jest.fn(),
  };

  beforeEach(() => {
    // Create mocks
    workflowRepository = createMockRepository();
    stepRepository = createMockRepository();
    instanceRepository = createMockRepository();
    templateRepository = createMockRepository();
    eventEmitter = createMockEventEmitter();

    serviceDiscovery = {
      callService: jest.fn(),
    };

    metricsService = {
      recordHttpRequest: jest.fn(),
      registerCounter: jest.fn().mockReturnValue({ inc: jest.fn() }),
      registerHistogram: jest.fn().mockReturnValue({ observe: jest.fn() }),
      getMetric: jest.fn(),
    };

    tracingService = {
      withSpan: jest.fn().mockImplementation((name, fn) => fn({ setAttribute: jest.fn() })),
      createSpan: jest.fn().mockReturnValue({ setAttribute: jest.fn(), end: jest.fn() }),
      getActiveSpan: jest.fn().mockReturnValue({ setAttribute: jest.fn() }),
    };

    loggingService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
    };

    // Manual instantiation
    service = new WorkflowsService(
      workflowRepository,
      stepRepository,
      instanceRepository,
      templateRepository,
      eventEmitter,
      serviceDiscovery,
      metricsService,
      tracingService,
      loggingService
    );

    jest.clearAllMocks();
  });

  describe('Constructor and Dependencies', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have monitoring services injected', () => {
      expect(service['metricsService']).toBeDefined();
      expect(service['tracingService']).toBeDefined();
      expect(service['loggingService']).toBeDefined();
    });
  });

  describe('create', () => {
    it('should create workflow with steps', async () => {
      const createData = {
        name: 'New Workflow',
        description: 'Test workflow',
        category: 'approval',
        organizationId: 'org-123',
        createdBy: 'user-123',
        isDraft: false,
        steps: [
          {
            name: 'Step 1',
            type: 'user_task',
            order: 1,
            config: { assignees: ['user-1'] },
          },
          {
            name: 'Step 2',
            type: 'approval',
            order: 2,
            config: { approvers: ['manager'] },
          },
        ],
      };

      workflowRepository.findOne.mockResolvedValue(null);
      workflowRepository.create.mockReturnValue({
        ...createData,
        id: 'workflow-new',
        status: WorkflowStatus.ACTIVE,
      });
      workflowRepository.save.mockResolvedValue({
        ...createData,
        id: 'workflow-new',
        status: WorkflowStatus.ACTIVE,
      });

      const createdSteps = createData.steps.map((step, index) => ({
        ...step,
        id: `step-${index + 1}`,
        workflowId: 'workflow-new',
      }));
      stepRepository.create.mockImplementation((data) => ({
        ...data,
        id: `step-${data.order}`,
      }));
      stepRepository.save.mockResolvedValue(createdSteps);

      const result = await service.create(createData);

      expect(workflowRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: createData.name,
          organizationId: createData.organizationId,
        },
      });
      expect(workflowRepository.create).toHaveBeenCalled();
      expect(workflowRepository.save).toHaveBeenCalled();
      expect(stepRepository.create).toHaveBeenCalledTimes(2);
      expect(stepRepository.save).toHaveBeenCalledTimes(2); // Initial save + relationship update
      expect(eventEmitter.emit).toHaveBeenCalledWith('workflow.created', {
        workflowId: 'workflow-new',
        organizationId: createData.organizationId,
        createdBy: createData.createdBy,
      });
    });

    it('should create draft workflow', async () => {
      const createData = {
        name: 'Draft Workflow',
        organizationId: 'org-123',
        createdBy: 'user-123',
        isDraft: true,
        steps: [],
      };

      workflowRepository.findOne.mockResolvedValue(null);
      workflowRepository.create.mockReturnValue({
        ...createData,
        id: 'workflow-draft',
        status: WorkflowStatus.DRAFT,
      });
      workflowRepository.save.mockResolvedValue({
        ...createData,
        id: 'workflow-draft',
        status: WorkflowStatus.DRAFT,
      });

      const result = await service.create(createData);

      expect(result.status).toBe(WorkflowStatus.DRAFT);
    });

    it('should handle duplicate workflow names', async () => {
      const createData = {
        name: 'Existing Workflow',
        organizationId: 'org-123',
        createdBy: 'user-123',
        steps: [],
      };

      workflowRepository.findOne.mockResolvedValue(mockWorkflow);

      await expect(service.create(createData)).rejects.toThrow(ConflictException);
    });

    it('should set step relationships correctly', async () => {
      const createData = {
        name: 'Workflow with Relations',
        organizationId: 'org-123',
        createdBy: 'user-123',
        steps: [
          {
            name: 'Start',
            type: 'user_task',
            order: 1,
            nextStepId: 'Review', // Using name reference
          },
          {
            name: 'Review',
            type: 'approval',
            order: 2,
            nextStepId: 'Complete',
            errorStepIds: ['Error Handler'],
          },
          {
            name: 'Complete',
            type: 'system_task',
            order: 3,
          },
          {
            name: 'Error Handler',
            type: 'user_task',
            order: 4,
          },
        ],
      };

      workflowRepository.findOne.mockResolvedValue(null);
      workflowRepository.create.mockReturnValue({
        ...createData,
        id: 'workflow-new',
      });
      workflowRepository.save.mockResolvedValue({
        ...createData,
        id: 'workflow-new',
      });

      const stepIds = ['step-1', 'step-2', 'step-3', 'step-4'];
      stepRepository.create.mockImplementation((data, index) => ({
        ...data,
        id: stepIds[data.order - 1],
      }));
      stepRepository.save.mockImplementation((steps) => steps);

      await service.create(createData);

      // Verify step relationships were mapped correctly
      const savedSteps = stepRepository.save.mock.calls[1][0];
      expect(savedSteps[0].nextStepId).toBe('step-2'); // Start -> Review
      expect(savedSteps[1].nextStepId).toBe('step-3'); // Review -> Complete
      expect(savedSteps[1].errorStepIds).toContain('step-4'); // Review -> Error Handler
    });
  });

  describe('findAll', () => {
    it('should find workflows with pagination', async () => {
      const query = {
        organizationId: 'org-123',
        category: 'approval',
        status: WorkflowStatus.ACTIVE,
        page: 1,
        limit: 10,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockWorkflow], 1]),
      };

      workflowRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll(query);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'workflow.organizationId = :organizationId',
        { organizationId: query.organizationId }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('workflow.category = :category', {
        category: query.category,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('workflow.status = :status', {
        status: query.status,
      });
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: [
          {
            ...mockWorkflow,
            type: mockWorkflow.category,
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should search workflows by name', async () => {
      const query = {
        organizationId: 'org-123',
        search: 'approval',
        page: 1,
        limit: 10,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockWorkflow], 1]),
      };

      workflowRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'LOWER(workflow.name) LIKE LOWER(:search) OR LOWER(workflow.description) LIKE LOWER(:search)',
        { search: '%approval%' }
      );
    });
  });

  describe('findOne', () => {
    it('should find workflow by id', async () => {
      workflowRepository.findOne.mockResolvedValue(mockWorkflow);

      const result = await service.findOne('workflow-123', 'org-123');

      expect(workflowRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 'workflow-123',
          organizationId: 'org-123',
        },
        relations: ['steps'],
      });
      expect(result).toEqual(mockWorkflow);
    });

    it('should throw error if workflow not found', async () => {
      workflowRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent', 'org-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update workflow', async () => {
      const updateData = {
        description: 'Updated description',
        metadata: { department: 'HR' },
        modifiedBy: 'user-456',
      };

      workflowRepository.findOne.mockResolvedValue({ ...mockWorkflow });
      workflowRepository.save.mockResolvedValue({
        ...mockWorkflow,
        ...updateData,
        version: mockWorkflow.version + 1,
      });

      const result = await service.update('workflow-123', updateData, 'org-123');

      expect(workflowRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockWorkflow,
          ...updateData,
          version: mockWorkflow.version + 1,
          updatedAt: expect.any(Date),
        })
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('workflow.updated', {
        workflowId: 'workflow-123',
        changes: updateData,
        modifiedBy: updateData.modifiedBy,
      });
    });

    it('should not allow updating archived workflow', async () => {
      const archivedWorkflow = {
        ...mockWorkflow,
        status: WorkflowStatus.ARCHIVED,
      };

      workflowRepository.findOne.mockResolvedValue(archivedWorkflow);

      await expect(
        service.update('workflow-123', { description: 'New' }, 'org-123')
      ).rejects.toThrow(BadRequestException);
    });

    it('should update workflow steps', async () => {
      const updateData = {
        steps: [
          {
            name: 'Updated Step',
            type: 'approval',
            order: 1,
          },
        ],
        modifiedBy: 'user-456',
      };

      workflowRepository.findOne.mockResolvedValue(mockWorkflow);
      stepRepository.find.mockResolvedValue([mockStep]);
      stepRepository.delete.mockResolvedValue({});
      stepRepository.create.mockReturnValue({
        ...updateData.steps[0],
        id: 'step-new',
      });
      stepRepository.save.mockResolvedValue([
        {
          ...updateData.steps[0],
          id: 'step-new',
        },
      ]);

      await service.update('workflow-123', updateData, 'org-123');

      expect(stepRepository.delete).toHaveBeenCalledWith({
        workflowId: 'workflow-123',
      });
      expect(stepRepository.create).toHaveBeenCalled();
      expect(stepRepository.save).toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('should publish draft workflow', async () => {
      const draftWorkflow = {
        ...mockWorkflow,
        status: WorkflowStatus.DRAFT,
      };

      workflowRepository.findOne.mockResolvedValue(draftWorkflow);
      workflowRepository.save.mockResolvedValue({
        ...draftWorkflow,
        status: WorkflowStatus.ACTIVE,
      });

      const result = await service.publish('workflow-123', 'user-123', 'org-123');

      expect(result.status).toBe(WorkflowStatus.ACTIVE);
      expect(eventEmitter.emit).toHaveBeenCalledWith('workflow.published', {
        workflowId: 'workflow-123',
        publishedBy: 'user-123',
      });
    });

    it('should not publish already active workflow', async () => {
      workflowRepository.findOne.mockResolvedValue(mockWorkflow);

      await expect(service.publish('workflow-123', 'user-123', 'org-123')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should validate workflow before publishing', async () => {
      const invalidWorkflow = {
        ...mockWorkflow,
        status: WorkflowStatus.DRAFT,
        steps: [], // No steps
      };

      workflowRepository.findOne.mockResolvedValue(invalidWorkflow);

      await expect(service.publish('workflow-123', 'user-123', 'org-123')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('archive', () => {
    it('should archive active workflow', async () => {
      workflowRepository.findOne.mockResolvedValue(mockWorkflow);
      instanceRepository.count.mockResolvedValue(0);
      workflowRepository.save.mockResolvedValue({
        ...mockWorkflow,
        status: WorkflowStatus.ARCHIVED,
      });

      const result = await service.archive(
        'workflow-123',
        'user-123',
        'Obsolete workflow',
        'org-123'
      );

      expect(result.status).toBe(WorkflowStatus.ARCHIVED);
      expect(eventEmitter.emit).toHaveBeenCalledWith('workflow.archived', {
        workflowId: 'workflow-123',
        archivedBy: 'user-123',
        reason: 'Obsolete workflow',
      });
    });

    it('should not archive workflow with running instances', async () => {
      workflowRepository.findOne.mockResolvedValue(mockWorkflow);
      instanceRepository.count.mockResolvedValue(5);

      await expect(service.archive('workflow-123', 'user-123', null, 'org-123')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('clone', () => {
    it('should clone workflow with new name', async () => {
      workflowRepository.findOne
        .mockResolvedValueOnce({
          ...mockWorkflow,
          steps: [mockStep],
        })
        .mockResolvedValueOnce({
          ...mockWorkflow,
          id: 'workflow-clone',
          name: 'Cloned Workflow',
          steps: [
            {
              ...mockStep,
              id: 'step-clone',
              workflowId: 'workflow-clone',
            },
          ],
        });
      workflowRepository.create.mockReturnValue({
        name: 'Cloned Workflow',
        description: 'Clone of original',
        category: mockWorkflow.category,
        status: WorkflowStatus.DRAFT,
        isDraft: true,
        isTemplate: false,
        maxExecutionTime: mockWorkflow.maxExecutionTime,
        retryConfig: mockWorkflow.retryConfig,
        triggers: mockWorkflow.triggers,
        metadata: { ...mockWorkflow.metadata, clonedFrom: 'workflow-123' },
        version: 1,
        organizationId: 'org-123',
        createdBy: 'user-123',
      });
      workflowRepository.save.mockImplementation((workflow) => ({
        ...workflow,
        id: 'workflow-clone',
      }));
      stepRepository.create.mockImplementation((data) => ({
        ...data,
        id: 'step-clone',
      }));
      stepRepository.save.mockResolvedValue([
        {
          ...mockStep,
          id: 'step-clone',
          workflowId: 'workflow-clone',
        },
      ]);

      const result = await service.clone(
        'workflow-123',
        'Cloned Workflow',
        'Clone of original',
        'user-123',
        'org-123'
      );

      expect(result.id).not.toBe('workflow-123');
      expect(result.name).toBe('Cloned Workflow');
      expect(workflowRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Cloned Workflow',
          description: 'Clone of original',
          status: WorkflowStatus.DRAFT,
          version: 1,
          createdBy: 'user-123',
        })
      );
    });
  });

  describe('getInstances', () => {
    it('should get workflow instances', async () => {
      const query = {
        status: InstanceStatus.RUNNING,
        page: 1,
        limit: 10,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockInstance], 1]),
      };

      instanceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getInstances('workflow-123', query, 'org-123');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'instance.workflowId = :workflowId AND instance.organizationId = :organizationId',
        { workflowId: 'workflow-123', organizationId: 'org-123' }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('instance.status = :status', {
        status: query.status,
      });
      expect(result).toEqual({
        data: [mockInstance],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should filter instances by date range', async () => {
      const query = {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        page: 1,
        limit: 10,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      instanceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getInstances('workflow-123', query, 'org-123');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('instance.startedAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('instance.startedAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    });
  });

  describe('getInstance', () => {
    it('should get instance details', async () => {
      instanceRepository.findOne.mockResolvedValue(mockInstance);

      const result = await service.getInstance('instance-123', 'org-123');

      expect(instanceRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 'instance-123',
          organizationId: 'org-123',
        },
        relations: ['workflow', 'steps'],
      });
      expect(result).toEqual(mockInstance);
    });

    it('should throw error if instance not found', async () => {
      instanceRepository.findOne.mockResolvedValue(null);

      await expect(service.getInstance('non-existent', 'org-123')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('createTemplate', () => {
    it('should create workflow template', async () => {
      const templateData = {
        name: 'New Template',
        description: 'Template description',
        category: 'approval',
        organizationId: 'org-123',
        createdBy: 'user-123',
        isPublic: true,
        config: {
          steps: [mockStep],
          defaultInputs: {},
        },
      };

      templateRepository.create.mockReturnValue({
        ...templateData,
        id: 'template-new',
      });
      templateRepository.save.mockResolvedValue({
        ...templateData,
        id: 'template-new',
      });

      const result = await service.createTemplate(templateData);

      expect(templateRepository.create).toHaveBeenCalledWith(templateData);
      expect(templateRepository.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('workflow.template.created', {
        templateId: 'template-new',
        createdBy: templateData.createdBy,
      });
    });
  });

  describe('createFromTemplate', () => {
    it('should create workflow from template', async () => {
      const body = {
        name: 'Workflow from Template',
        description: 'Created from template',
        inputs: {
          approvers: ['manager', 'director'],
        },
      };

      templateRepository.findOne.mockResolvedValue(mockTemplate);
      workflowRepository.findOne.mockResolvedValue(null); // No duplicate
      workflowRepository.create.mockReturnValue({
        ...body,
        id: 'workflow-from-template',
        organizationId: 'org-123',
        category: mockTemplate.category,
        status: WorkflowStatus.DRAFT,
      });
      workflowRepository.save.mockResolvedValue({
        ...body,
        id: 'workflow-from-template',
      });
      stepRepository.create.mockImplementation((data) => ({
        ...data,
        id: 'step-from-template',
      }));
      stepRepository.save.mockResolvedValue([]);

      const result = await service.createFromTemplate('template-123', body, 'user-123', 'org-123');

      expect(result.name).toBe(body.name);
      expect(result.description).toBe(body.description);
      expect(eventEmitter.emit).toHaveBeenCalledWith('workflow.created.from.template', {
        workflowId: 'workflow-from-template',
        templateId: 'template-123',
        createdBy: 'user-123',
      });
    });

    it('should merge template inputs with provided inputs', async () => {
      const templateWithDefaults = {
        ...mockTemplate,
        config: {
          ...mockTemplate.config,
          defaultInputs: {
            approvalType: 'single',
            timeoutHours: 48,
          },
        },
      };

      const body = {
        name: 'Workflow with Inputs',
        inputs: {
          approvers: ['custom-approver'],
          timeoutHours: 24, // Override default
        },
      };

      templateRepository.findOne.mockResolvedValue(templateWithDefaults);
      workflowRepository.findOne.mockResolvedValue(null);
      workflowRepository.create.mockImplementation((data) => ({
        ...data,
        id: 'workflow-merged',
      }));
      workflowRepository.save.mockImplementation((data) => data);
      stepRepository.create.mockImplementation((data) => data);
      stepRepository.save.mockImplementation((data) => data);

      await service.createFromTemplate('template-123', body, 'user-123', 'org-123');

      const createdWorkflow = workflowRepository.create.mock.calls[0][0];
      expect(createdWorkflow.metadata.templateInputs).toEqual({
        approvalType: 'single', // From template default
        timeoutHours: 24, // Overridden
        approvers: ['custom-approver'], // Provided
      });
    });
  });

  describe('Validation', () => {
    it('should validate workflow has at least one step', async () => {
      const workflowWithoutSteps = {
        ...mockWorkflow,
        status: WorkflowStatus.DRAFT,
        steps: [],
      };

      workflowRepository.findOne.mockResolvedValue(workflowWithoutSteps);

      await expect(service.publish('workflow-123', 'user-123', 'org-123')).rejects.toThrow(
        'Workflow must have at least one step'
      );
    });

    it('should validate step transitions', async () => {
      const workflowWithInvalidSteps = {
        ...mockWorkflow,
        status: WorkflowStatus.DRAFT,
        steps: [
          {
            ...mockStep,
            nextStepId: 'non-existent-step',
          },
        ],
      };

      workflowRepository.findOne.mockResolvedValue(workflowWithInvalidSteps);

      await expect(service.publish('workflow-123', 'user-123', 'org-123')).rejects.toThrow(
        'Invalid step transition'
      );
    });
  });

  describe('Event Emissions', () => {
    it('should emit events for all major operations', async () => {
      // Create
      workflowRepository.findOne.mockResolvedValue(null);
      workflowRepository.create.mockReturnValue({ id: 'new-workflow' });
      workflowRepository.save.mockResolvedValue({ id: 'new-workflow' });

      await service.create({
        name: 'Test',
        organizationId: 'org-123',
        createdBy: 'user-123',
        steps: [],
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('workflow.created', expect.any(Object));

      // Archive first (before update to avoid conflicts)
      jest.clearAllMocks();
      const activeWorkflow = {
        ...mockWorkflow,
        status: WorkflowStatus.ACTIVE,
      };
      workflowRepository.findOne.mockResolvedValue(activeWorkflow);
      workflowRepository.save.mockImplementation((workflow) => ({
        ...workflow,
        archivedAt: new Date(),
        archivedBy: 'user-123',
        archiveReason: 'Reason',
      }));
      instanceRepository.count.mockResolvedValue(0);

      await service.archive('workflow-123', 'user-123', 'Reason', 'org-123');

      expect(eventEmitter.emit).toHaveBeenCalledWith('workflow.archived', expect.any(Object));

      // Update (using a fresh workflow)
      jest.clearAllMocks();
      const freshWorkflow = {
        ...mockWorkflow,
        status: WorkflowStatus.ACTIVE,
      };
      workflowRepository.findOne.mockResolvedValue(freshWorkflow);
      workflowRepository.save.mockImplementation((workflow) => ({
        ...workflow,
        updatedAt: new Date(),
      }));

      await service.update('workflow-123', { description: 'New' }, 'org-123');

      expect(eventEmitter.emit).toHaveBeenCalledWith('workflow.updated', expect.any(Object));
    });
  });
});
