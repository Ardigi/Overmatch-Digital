import express from 'express';
import request from 'supertest';
import {
  TriggerType,
  type Workflow,
  WorkflowStatus,
} from './modules/workflows/entities/workflow.entity';
import {
  InstanceStatus,
  type WorkflowInstance,
} from './modules/workflows/entities/workflow-instance.entity';
import { StepType, type WorkflowStep } from './modules/workflows/entities/workflow-step.entity';
import {
  ExecutionStatus,
  type WorkflowStepExecution,
} from './modules/workflows/entities/workflow-step-execution.entity';
import type { WorkflowTemplate } from './modules/workflows/entities/workflow-template.entity';
import { WorkflowInstancesController } from './modules/workflows/workflow-instances.controller';
import { WorkflowInstancesService } from './modules/workflows/workflow-instances.service';
import { WorkflowTemplatesController } from './modules/workflows/workflow-templates.controller';
import { WorkflowTemplatesService } from './modules/workflows/workflow-templates.service';
import { WorkflowsController } from './modules/workflows/controllers/workflows.controller';
import { WorkflowsService } from './modules/workflows/services/workflows.service';

describe('Workflow Service Integration Tests', () => {
  let app: express.Application;
  let workflowsService: WorkflowsService;
  let workflowsController: WorkflowsController;
  let instancesService: WorkflowInstancesService;
  let instancesController: WorkflowInstancesController;
  let templatesService: WorkflowTemplatesService;
  let templatesController: WorkflowTemplatesController;

  // Mock repositories
  let mockWorkflowRepository: any;
  let mockInstanceRepository: any;
  let mockStepRepository: any;
  let mockExecutionRepository: any;
  let mockTemplateRepository: any;
  let mockEventEmitter: any;
  let mockQueue: any;
  let mockLogger: any;

  // In-memory databases
  let workflowsDb: Map<string, Workflow>;
  let instancesDb: Map<string, WorkflowInstance>;
  let stepsDb: Map<string, WorkflowStep>;
  let executionsDb: Map<string, WorkflowStepExecution>;
  let templatesDb: Map<string, WorkflowTemplate>;

  let idCounter = 1;

  const mockUser = {
    id: 'user-123',
    email: 'admin@example.com',
    organizationId: 'org-123',
    roles: ['admin', 'workflow_admin'],
  };

  beforeAll(async () => {
    // Initialize in-memory databases
    workflowsDb = new Map();
    instancesDb = new Map();
    stepsDb = new Map();
    executionsDb = new Map();
    templatesDb = new Map();

    // Create mock workflow repository
    mockWorkflowRepository = {
      create: jest.fn((dto) => ({
        id: `workflow-${idCounter++}`,
        ...dto,
        organizationId: mockUser.organizationId,
        createdBy: mockUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: dto.status || WorkflowStatus.DRAFT,
        version: 1,
      })),
      save: jest.fn(async (entity) => {
        workflowsDb.set(entity.id, entity);
        return entity;
      }),
      find: jest.fn(async (options) => {
        let results = Array.from(workflowsDb.values());

        if (options?.where) {
          results = results.filter((workflow) => {
            if (
              options.where.organizationId &&
              workflow.organizationId !== options.where.organizationId
            ) {
              return false;
            }
            if (options.where.status && workflow.status !== options.where.status) {
              return false;
            }
            return true;
          });
        }

        return results;
      }),
      findOne: jest.fn(async (options) => {
        if (options?.where?.id) {
          return workflowsDb.get(options.where.id);
        }
        return null;
      }),
      update: jest.fn(async (id, updateDto) => {
        const workflow = workflowsDb.get(id);
        if (workflow) {
          Object.assign(workflow, updateDto, { updatedAt: new Date() });
          workflowsDb.set(id, workflow);
        }
        return { affected: workflow ? 1 : 0 };
      }),
      remove: jest.fn(async (entity) => {
        workflowsDb.delete(entity.id);
        return entity;
      }),
    };

    // Create mock instance repository
    mockInstanceRepository = {
      create: jest.fn((dto) => ({
        id: `instance-${idCounter++}`,
        ...dto,
        startedAt: new Date(),
        status: InstanceStatus.PENDING,
      })),
      save: jest.fn(async (entity) => {
        instancesDb.set(entity.id, entity);
        return entity;
      }),
      find: jest.fn(async (options) => {
        let results = Array.from(instancesDb.values());

        if (options?.where) {
          results = results.filter((instance) => {
            if (options.where.workflowId && instance.workflowId !== options.where.workflowId) {
              return false;
            }
            if (options.where.status && instance.status !== options.where.status) {
              return false;
            }
            return true;
          });
        }

        return results;
      }),
      findOne: jest.fn(async (options) => {
        if (options?.where?.id) {
          return instancesDb.get(options.where.id);
        }
        return null;
      }),
      update: jest.fn(async (id, updateDto) => {
        const instance = instancesDb.get(id);
        if (instance) {
          Object.assign(instance, updateDto);
          instancesDb.set(id, instance);
        }
        return { affected: instance ? 1 : 0 };
      }),
    };

    // Create mock step repository
    mockStepRepository = {
      create: jest.fn((dto) => ({
        id: `step-${idCounter++}`,
        ...dto,
      })),
      save: jest.fn(async (entity) => {
        if (Array.isArray(entity)) {
          return entity.map((e) => {
            stepsDb.set(e.id, e);
            return e;
          });
        }
        stepsDb.set(entity.id, entity);
        return entity;
      }),
      find: jest.fn(async (options) => {
        let results = Array.from(stepsDb.values());

        if (options?.where?.workflowId) {
          results = results.filter((step) => step.workflowId === options.where.workflowId);
        }

        if (options?.order?.order) {
          results.sort((a, b) => a.order - b.order);
        }

        return results;
      }),
      findOne: jest.fn(async (options) => {
        if (options?.where?.id) {
          return stepsDb.get(options.where.id);
        }
        return null;
      }),
    };

    // Create mock execution repository
    mockExecutionRepository = {
      create: jest.fn((dto) => ({
        id: `execution-${idCounter++}`,
        ...dto,
        startedAt: new Date(),
        status: ExecutionStatus.PENDING,
      })),
      save: jest.fn(async (entity) => {
        executionsDb.set(entity.id, entity);
        return entity;
      }),
      find: jest.fn(async (options) => {
        let results = Array.from(executionsDb.values());

        if (options?.where?.instanceId) {
          results = results.filter((exec) => exec.instanceId === options.where.instanceId);
        }

        return results;
      }),
      update: jest.fn(async (id, updateDto) => {
        const execution = executionsDb.get(id);
        if (execution) {
          Object.assign(execution, updateDto);
          executionsDb.set(id, execution);
        }
        return { affected: execution ? 1 : 0 };
      }),
    };

    // Create mock template repository
    mockTemplateRepository = {
      create: jest.fn((dto) => ({
        id: `template-${idCounter++}`,
        ...dto,
        organizationId: mockUser.organizationId,
        createdBy: mockUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      })),
      save: jest.fn(async (entity) => {
        templatesDb.set(entity.id, entity);
        return entity;
      }),
      find: jest.fn(async (options) => {
        let results = Array.from(templatesDb.values());

        if (options?.where) {
          results = results.filter((template) => {
            if (
              options.where.organizationId &&
              template.organizationId !== options.where.organizationId
            ) {
              return false;
            }
            if (options.where.category && template.category !== options.where.category) {
              return false;
            }
            return true;
          });
        }

        return results;
      }),
      findOne: jest.fn(async (options) => {
        if (options?.where?.id) {
          return templatesDb.get(options.where.id);
        }
        return null;
      }),
    };

    // Create mock event emitter
    mockEventEmitter = {
      emit: jest.fn(),
      emitAsync: jest.fn().mockResolvedValue([]),
    };

    // Create mock queue
    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
      process: jest.fn(),
    };

    // Create mock logger
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Create services
    workflowsService = new WorkflowsService(
      mockWorkflowRepository,
      mockStepRepository,
      mockInstanceRepository,
      mockEventEmitter,
      mockQueue,
      mockLogger
    );

    instancesService = new WorkflowInstancesService(
      mockInstanceRepository,
      mockWorkflowRepository,
      mockStepRepository,
      mockExecutionRepository,
      mockEventEmitter,
      mockQueue,
      mockLogger
    );

    templatesService = new WorkflowTemplatesService(
      mockTemplateRepository,
      mockEventEmitter,
      mockLogger
    );

    // Create controllers
    workflowsController = new WorkflowsController(workflowsService);
    instancesController = new WorkflowInstancesController(instancesService);
    templatesController = new WorkflowTemplatesController(templatesService);

    // Create Express app
    app = express();
    app.use(express.json());

    // Simulate authentication middleware
    app.use((req, res, next) => {
      req['user'] = mockUser;
      next();
    });

    // Workflow routes
    app.post('/workflows', async (req, res) => {
      try {
        const result = await workflowsController.create(req.body, req['user']);
        res.status(201).json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.get('/workflows', async (req, res) => {
      try {
        const result = await workflowsController.findAll(req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.get('/workflows/:id', async (req, res) => {
      try {
        const result = await workflowsController.findOne(req.params.id, req['user']);
        if (!result) {
          return res.status(404).json({ message: 'Workflow not found' });
        }
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.put('/workflows/:id', async (req, res) => {
      try {
        const result = await workflowsController.update(req.params.id, req.body, req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.post('/workflows/:id/activate', async (req, res) => {
      try {
        const result = await workflowsController.activate(req.params.id, req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.post('/workflows/:id/execute', async (req, res) => {
      try {
        const result = await workflowsController.execute(req.params.id, req.body, req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.post('/workflows/:id/clone', async (req, res) => {
      try {
        const result = await workflowsController.clone(req.params.id, req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.delete('/workflows/:id', async (req, res) => {
      try {
        await workflowsController.remove(req.params.id, req['user']);
        res.status(204).send();
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    // Instance routes
    app.get('/instances', async (req, res) => {
      try {
        const result = await instancesController.findAll(req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.get('/instances/:id', async (req, res) => {
      try {
        const result = await instancesController.findOne(req.params.id, req['user']);
        if (!result) {
          return res.status(404).json({ message: 'Instance not found' });
        }
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.post('/instances/:id/cancel', async (req, res) => {
      try {
        const result = await instancesController.cancel(req.params.id, req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.post('/instances/:id/retry', async (req, res) => {
      try {
        const result = await instancesController.retry(req.params.id, req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    // Template routes
    app.post('/templates', async (req, res) => {
      try {
        const result = await templatesController.create(req.body, req['user']);
        res.status(201).json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.get('/templates', async (req, res) => {
      try {
        const result = await templatesController.findAll(req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.get('/templates/:id', async (req, res) => {
      try {
        const result = await templatesController.findOne(req.params.id, req['user']);
        if (!result) {
          return res.status(404).json({ message: 'Template not found' });
        }
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });

    app.post('/templates/:id/apply', async (req, res) => {
      try {
        const result = await templatesController.apply(req.params.id, req.body, req['user']);
        res.json(result);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    });
  });

  afterEach(() => {
    // Clear databases between tests
    workflowsDb.clear();
    instancesDb.clear();
    stepsDb.clear();
    executionsDb.clear();
    templatesDb.clear();
    idCounter = 1;
    jest.clearAllMocks();
  });

  describe('Workflow Creation and Management', () => {
    it('should create a new workflow with steps', async () => {
      const createDto = {
        name: 'SOC 2 Evidence Collection',
        description: 'Automated workflow for collecting SOC 2 evidence',
        triggerType: TriggerType.MANUAL,
        steps: [
          {
            name: 'Collect Screenshots',
            type: StepType.MANUAL,
            config: { assignee: 'user-456' },
            order: 1,
          },
          {
            name: 'Validate Evidence',
            type: StepType.APPROVAL,
            config: { approvers: ['user-789'] },
            order: 2,
          },
        ],
      };

      const response = await request(app).post('/workflows').send(createDto).expect(201);

      expect(response.body).toMatchObject({
        name: createDto.name,
        description: createDto.description,
        triggerType: createDto.triggerType,
        status: WorkflowStatus.DRAFT,
      });

      // Verify steps were created
      const steps = Array.from(stepsDb.values()).filter((s) => s.workflowId === response.body.id);
      expect(steps).toHaveLength(2);
    });

    it('should update workflow', async () => {
      // Create workflow first
      const workflow = mockWorkflowRepository.create({
        name: 'Test Workflow',
        triggerType: TriggerType.MANUAL,
      });
      await mockWorkflowRepository.save(workflow);

      const updateDto = {
        name: 'Updated Workflow',
        description: 'Updated description',
      };

      const response = await request(app)
        .put(`/workflows/${workflow.id}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.name).toBe(updateDto.name);
      expect(response.body.description).toBe(updateDto.description);
    });

    it('should activate workflow', async () => {
      // Create workflow with steps
      const workflow = mockWorkflowRepository.create({
        name: 'Test Workflow',
        triggerType: TriggerType.MANUAL,
        status: WorkflowStatus.DRAFT,
      });
      await mockWorkflowRepository.save(workflow);

      // Add steps
      const steps = [
        mockStepRepository.create({
          workflowId: workflow.id,
          name: 'Step 1',
          type: StepType.MANUAL,
          order: 1,
        }),
      ];
      await mockStepRepository.save(steps);

      const response = await request(app).post(`/workflows/${workflow.id}/activate`).expect(200);

      expect(response.body.status).toBe(WorkflowStatus.ACTIVE);
    });

    it('should execute workflow', async () => {
      // Create active workflow
      const workflow = mockWorkflowRepository.create({
        name: 'Test Workflow',
        triggerType: TriggerType.MANUAL,
        status: WorkflowStatus.ACTIVE,
      });
      await mockWorkflowRepository.save(workflow);

      const response = await request(app)
        .post(`/workflows/${workflow.id}/execute`)
        .send({ input: { test: 'data' } })
        .expect(200);

      expect(response.body).toMatchObject({
        workflowId: workflow.id,
        status: InstanceStatus.PENDING,
      });

      // Verify instance was created
      expect(instancesDb.size).toBe(1);
    });

    it('should clone workflow', async () => {
      // Create workflow with steps
      const workflow = mockWorkflowRepository.create({
        name: 'Original Workflow',
        triggerType: TriggerType.MANUAL,
      });
      await mockWorkflowRepository.save(workflow);

      const steps = [
        mockStepRepository.create({
          workflowId: workflow.id,
          name: 'Step 1',
          type: StepType.MANUAL,
          order: 1,
        }),
      ];
      await mockStepRepository.save(steps);

      const response = await request(app).post(`/workflows/${workflow.id}/clone`).expect(200);

      expect(response.body.name).toBe('Original Workflow (Copy)');
      expect(response.body.id).not.toBe(workflow.id);
    });

    it('should delete workflow', async () => {
      const workflow = mockWorkflowRepository.create({
        name: 'Test Workflow',
        triggerType: TriggerType.MANUAL,
      });
      await mockWorkflowRepository.save(workflow);

      await request(app).delete(`/workflows/${workflow.id}`).expect(204);

      expect(workflowsDb.has(workflow.id)).toBe(false);
    });
  });

  describe('Workflow Instance Management', () => {
    let workflowId: string;
    let instanceId: string;

    beforeEach(async () => {
      // Create a workflow
      const workflow = mockWorkflowRepository.create({
        name: 'Test Workflow',
        triggerType: TriggerType.MANUAL,
        status: WorkflowStatus.ACTIVE,
      });
      await mockWorkflowRepository.save(workflow);
      workflowId = workflow.id;

      // Create an instance
      const instance = mockInstanceRepository.create({
        workflowId,
        input: { test: 'data' },
      });
      await mockInstanceRepository.save(instance);
      instanceId = instance.id;
    });

    it('should list workflow instances', async () => {
      const response = await request(app).get('/instances').expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].workflowId).toBe(workflowId);
    });

    it('should get instance details', async () => {
      const response = await request(app).get(`/instances/${instanceId}`).expect(200);

      expect(response.body).toMatchObject({
        id: instanceId,
        workflowId,
        status: InstanceStatus.PENDING,
      });
    });

    it('should cancel instance', async () => {
      const response = await request(app).post(`/instances/${instanceId}/cancel`).expect(200);

      expect(response.body.status).toBe(InstanceStatus.CANCELLED);
    });

    it('should retry failed instance', async () => {
      // Update instance to failed status
      await mockInstanceRepository.update(instanceId, {
        status: InstanceStatus.FAILED,
      });

      const response = await request(app).post(`/instances/${instanceId}/retry`).expect(200);

      expect(response.body.status).toBe(InstanceStatus.PENDING);
    });
  });

  describe('Workflow Templates', () => {
    it('should create workflow template', async () => {
      const createDto = {
        name: 'SOC 2 Compliance Template',
        description: 'Template for SOC 2 compliance workflows',
        category: 'compliance',
        definition: {
          steps: [
            {
              name: 'Evidence Collection',
              type: StepType.MANUAL,
              config: { description: 'Collect required evidence' },
            },
          ],
        },
      };

      const response = await request(app).post('/templates').send(createDto).expect(201);

      expect(response.body).toMatchObject({
        name: createDto.name,
        category: createDto.category,
      });
    });

    it('should list templates', async () => {
      // Create templates
      const templates = [
        mockTemplateRepository.create({
          name: 'Template 1',
          category: 'compliance',
          definition: {},
        }),
        mockTemplateRepository.create({
          name: 'Template 2',
          category: 'security',
          definition: {},
        }),
      ];
      await Promise.all(templates.map((t) => mockTemplateRepository.save(t)));

      const response = await request(app).get('/templates').expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should apply template to create workflow', async () => {
      // Create template
      const template = mockTemplateRepository.create({
        name: 'Test Template',
        category: 'test',
        definition: {
          steps: [
            {
              name: 'Step from Template',
              type: StepType.MANUAL,
              config: {},
            },
          ],
        },
      });
      await mockTemplateRepository.save(template);

      const response = await request(app)
        .post(`/templates/${template.id}/apply`)
        .send({
          name: 'Workflow from Template',
          customizations: {
            description: 'Custom description',
          },
        })
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Workflow from Template',
        description: 'Custom description',
      });
    });
  });

  describe('Complex Workflow Scenarios', () => {
    it('should handle scheduled workflow execution', async () => {
      const workflow = mockWorkflowRepository.create({
        name: 'Scheduled Workflow',
        triggerType: TriggerType.SCHEDULE,
        triggerConfig: { cron: '0 0 * * *' }, // Daily at midnight
        status: WorkflowStatus.ACTIVE,
      });
      await mockWorkflowRepository.save(workflow);

      // Simulate scheduler trigger
      const instance = mockInstanceRepository.create({
        workflowId: workflow.id,
        triggeredBy: 'scheduler',
      });
      await mockInstanceRepository.save(instance);

      expect(instance.triggeredBy).toBe('scheduler');
    });

    it('should handle conditional workflow execution', async () => {
      const workflow = mockWorkflowRepository.create({
        name: 'Conditional Workflow',
        triggerType: TriggerType.EVENT,
        triggerConfig: {
          eventType: 'evidence.validated',
          conditions: { controlType: 'critical' },
        },
        status: WorkflowStatus.ACTIVE,
      });
      await mockWorkflowRepository.save(workflow);

      // Add conditional steps
      const steps = [
        mockStepRepository.create({
          workflowId: workflow.id,
          name: 'Check Condition',
          type: StepType.CONDITION,
          config: {
            condition: 'input.severity === "high"',
            truePath: 'escalate',
            falsePath: 'normal',
          },
          order: 1,
        }),
        mockStepRepository.create({
          workflowId: workflow.id,
          name: 'Escalate',
          type: StepType.NOTIFICATION,
          config: { recipients: ['manager@example.com'] },
          order: 2,
        }),
      ];
      await mockStepRepository.save(steps);

      const response = await request(app)
        .post(`/workflows/${workflow.id}/execute`)
        .send({ input: { severity: 'high' } })
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should handle parallel step execution', async () => {
      const workflow = mockWorkflowRepository.create({
        name: 'Parallel Workflow',
        triggerType: TriggerType.MANUAL,
        status: WorkflowStatus.ACTIVE,
      });
      await mockWorkflowRepository.save(workflow);

      // Add parallel steps
      const steps = [
        mockStepRepository.create({
          workflowId: workflow.id,
          name: 'Parallel Step 1',
          type: StepType.API_CALL,
          config: { endpoint: '/api/service1' },
          order: 1,
        }),
        mockStepRepository.create({
          workflowId: workflow.id,
          name: 'Parallel Step 2',
          type: StepType.API_CALL,
          config: { endpoint: '/api/service2' },
          order: 1, // Same order = parallel
        }),
        mockStepRepository.create({
          workflowId: workflow.id,
          name: 'Wait for Both',
          type: StepType.WAIT,
          config: { waitFor: ['Parallel Step 1', 'Parallel Step 2'] },
          order: 2,
        }),
      ];
      await mockStepRepository.save(steps);

      const response = await request(app)
        .post(`/workflows/${workflow.id}/execute`)
        .send({})
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle workflow not found', async () => {
      await request(app).get('/workflows/non-existent-id').expect(404);
    });

    it('should validate workflow creation', async () => {
      const invalidDto = {
        // Missing required fields
        description: 'Invalid workflow',
      };

      await request(app).post('/workflows').send(invalidDto).expect(400);
    });

    it('should prevent executing inactive workflow', async () => {
      const workflow = mockWorkflowRepository.create({
        name: 'Inactive Workflow',
        triggerType: TriggerType.MANUAL,
        status: WorkflowStatus.DRAFT,
      });
      await mockWorkflowRepository.save(workflow);

      await request(app).post(`/workflows/${workflow.id}/execute`).send({}).expect(400);
    });

    it('should handle instance not found', async () => {
      await request(app).get('/instances/non-existent-id').expect(404);
    });
  });
});
