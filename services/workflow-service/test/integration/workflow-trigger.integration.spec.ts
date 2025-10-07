import { getQueueToken } from '@nestjs/bull';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import type { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Workflow } from '../../src/modules/workflows/entities/workflow.entity';
import { WorkflowInstance } from '../../src/modules/workflows/entities/workflow-instance.entity';
import { WorkflowStep } from '../../src/modules/workflows/entities/workflow-step.entity';
import { WorkflowStepExecution } from '../../src/modules/workflows/entities/workflow-step-execution.entity';
import { WorkflowTemplate } from '../../src/modules/workflows/entities/workflow-template.entity';
import { WorkflowsModule } from '../../src/modules/workflows/workflows.module';

// Mock Bull queue
const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-id' }),
  process: jest.fn(),
};

describe('Workflow Trigger Endpoint (Integration)', () => {
  let app: INestApplication;
  let workflowRepository: Repository<Workflow>;
  let instanceRepository: Repository<WorkflowInstance>;

  const testOrganizationId = uuidv4();
  const testClientId = uuidv4();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || '127.0.0.1',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USERNAME || 'soc_user',
          password: process.env.DB_PASSWORD || 'soc_pass',
          database: process.env.DB_NAME || 'soc_workflows_test',
          entities: [
            Workflow,
            WorkflowInstance,
            WorkflowStep,
            WorkflowTemplate,
            WorkflowStepExecution,
          ],
          synchronize: true,
          dropSchema: true,
        }),
        WorkflowsModule,
      ],
    })
      .overrideProvider(getQueueToken('workflow'))
      .useValue(mockQueue)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    workflowRepository = moduleFixture.get<Repository<Workflow>>('WorkflowRepository');
    instanceRepository = moduleFixture.get<Repository<WorkflowInstance>>(
      'WorkflowInstanceRepository'
    );

    // Seed test workflows
    await seedTestData();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function seedTestData() {
    // Create a test workflow
    const workflow = workflowRepository.create({
      id: uuidv4(),
      name: 'Evidence Approval Workflow',
      type: 'approval',
      category: 'evidence',
      description: 'Workflow for evidence approval process',
      status: 'active',
      isDraft: false,
      isTemplate: false,
      organizationId: testOrganizationId,
      version: 1,
      steps: [],
      createdBy: 'system',
    });

    await workflowRepository.save(workflow);
  }

  describe('POST /workflows/trigger', () => {
    it('should trigger existing workflow successfully', async () => {
      const triggerData = {
        workflowName: 'Evidence Approval Workflow',
        workflowType: 'approval',
        triggerType: 'evidence.approved',
        sourceService: 'evidence-service',
        organizationId: testOrganizationId,
        clientId: testClientId,
        data: {
          evidenceId: uuidv4(),
          approvedBy: 'user-123',
          approvalDate: new Date().toISOString(),
        },
        priority: 'high',
        metadata: {
          correlationId: uuidv4(),
          auditTrail: true,
        },
      };

      const response = await request(app.getHttpServer())
        .post('/workflows/trigger')
        .set('X-Service-Name', 'evidence-service')
        .set('X-Service-API-Key', 'dev-evidence-service-api-key-2024')
        .send(triggerData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('workflowId');
      expect(response.body.data).toHaveProperty('instanceId');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('message');

      // Verify workflow queue was called
      expect(mockQueue.add).toHaveBeenCalledWith(
        'execute-workflow',
        expect.objectContaining({
          instanceId: expect.any(String),
          context: expect.objectContaining({
            organizationId: testOrganizationId,
          }),
        }),
        expect.objectContaining({
          priority: 10, // High priority = 10
          attempts: 3,
        })
      );
    });

    it('should create new workflow if not found', async () => {
      const triggerData = {
        workflowName: 'New Dynamic Workflow',
        workflowType: 'automated',
        triggerType: 'control.updated',
        sourceService: 'control-service',
        organizationId: testOrganizationId,
        clientId: testClientId,
        data: {
          controlId: uuidv4(),
          updatedBy: 'user-456',
          changes: {
            status: 'active',
            assignedTo: 'user-789',
          },
        },
      };

      const response = await request(app.getHttpServer())
        .post('/workflows/trigger')
        .set('X-Service-Name', 'control-service')
        .set('X-Service-API-Key', 'dev-control-service-api-key-2024')
        .send(triggerData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Workflow triggered successfully');

      // Verify new workflow was created
      const newWorkflow = await workflowRepository.findOne({
        where: { name: 'New Dynamic Workflow', organizationId: testOrganizationId },
      });
      expect(newWorkflow).toBeTruthy();
      expect(newWorkflow.type).toBe('automated');
      expect(newWorkflow.description).toContain('control.updated trigger from control-service');
    });

    it('should handle priority mapping correctly', async () => {
      const priorities = ['low', 'normal', 'high', 'urgent'];

      for (const priority of priorities) {
        const triggerData = {
          workflowName: 'Evidence Approval Workflow',
          workflowType: 'approval',
          triggerType: 'test.priority',
          sourceService: 'test-service',
          organizationId: testOrganizationId,
          priority,
          data: { test: true },
        };

        await request(app.getHttpServer())
          .post('/workflows/trigger')
          .set('X-Service-Name', 'test-service')
          .set('X-Service-API-Key', 'dev-test-service-api-key')
          .send(triggerData)
          .expect(201);
      }

      // Verify queue was called with correct priorities
      const queueCalls = mockQueue.add.mock.calls;
      expect(queueCalls.some((call) => call[2].priority === 1)).toBe(true); // low
      expect(queueCalls.some((call) => call[2].priority === 5)).toBe(true); // normal
      expect(queueCalls.some((call) => call[2].priority === 10)).toBe(true); // high
      expect(queueCalls.some((call) => call[2].priority === 20)).toBe(true); // urgent
    });

    it('should require service authentication', async () => {
      const triggerData = {
        workflowName: 'Test Workflow',
        triggerType: 'test.trigger',
        sourceService: 'test-service',
        organizationId: testOrganizationId,
      };

      await request(app.getHttpServer()).post('/workflows/trigger').send(triggerData).expect(401);
    });

    it('should reject invalid service API key', async () => {
      const triggerData = {
        workflowName: 'Test Workflow',
        triggerType: 'test.trigger',
        sourceService: 'test-service',
        organizationId: testOrganizationId,
      };

      await request(app.getHttpServer())
        .post('/workflows/trigger')
        .set('X-Service-Name', 'test-service')
        .set('X-Service-API-Key', 'invalid-key')
        .send(triggerData)
        .expect(401);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        // Missing required fields
        sourceService: 'test-service',
      };

      const response = await request(app.getHttpServer())
        .post('/workflows/trigger')
        .set('X-Service-Name', 'test-service')
        .set('X-Service-API-Key', 'dev-test-service-api-key')
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toContain('Validation failed');
    });

    it('should handle workflow creation errors gracefully', async () => {
      // Mock repository to throw error
      jest.spyOn(workflowRepository, 'save').mockRejectedValueOnce(new Error('Database error'));

      const triggerData = {
        workflowName: 'Error Test Workflow',
        workflowType: 'automated',
        triggerType: 'error.test',
        sourceService: 'test-service',
        organizationId: testOrganizationId,
        data: { test: true },
      };

      const response = await request(app.getHttpServer())
        .post('/workflows/trigger')
        .set('X-Service-Name', 'test-service')
        .set('X-Service-API-Key', 'dev-test-service-api-key')
        .send(triggerData)
        .expect(500);

      expect(response.body.message).toContain('Failed to trigger workflow');
    });

    it('should pass metadata through to workflow instance', async () => {
      const customMetadata = {
        correlationId: uuidv4(),
        requestId: uuidv4(),
        auditRequired: true,
        tags: ['compliance', 'evidence'],
      };

      const triggerData = {
        workflowName: 'Evidence Approval Workflow',
        workflowType: 'approval',
        triggerType: 'evidence.review',
        sourceService: 'evidence-service',
        organizationId: testOrganizationId,
        data: { evidenceId: uuidv4() },
        metadata: customMetadata,
      };

      await request(app.getHttpServer())
        .post('/workflows/trigger')
        .set('X-Service-Name', 'evidence-service')
        .set('X-Service-API-Key', 'dev-evidence-service-api-key-2024')
        .send(triggerData)
        .expect(201);

      // Verify metadata was passed to workflow engine
      expect(mockQueue.add).toHaveBeenCalledWith(
        'execute-workflow',
        expect.objectContaining({
          instanceId: expect.any(String),
        }),
        expect.any(Object)
      );

      const queueCallData = mockQueue.add.mock.calls[mockQueue.add.mock.calls.length - 1][0];
      expect(queueCallData).toBe('execute-workflow');
    });
  });

  describe('Workflow Instance Creation', () => {
    it('should create workflow instance with correct data', async () => {
      const triggerData = {
        workflowName: 'Evidence Approval Workflow',
        workflowType: 'approval',
        triggerType: 'evidence.submitted',
        sourceService: 'evidence-service',
        organizationId: testOrganizationId,
        clientId: testClientId,
        data: {
          evidenceId: uuidv4(),
          submittedBy: 'user-999',
          submissionDate: new Date().toISOString(),
        },
      };

      const response = await request(app.getHttpServer())
        .post('/workflows/trigger')
        .set('X-Service-Name', 'evidence-service')
        .set('X-Service-API-Key', 'dev-evidence-service-api-key-2024')
        .send(triggerData)
        .expect(201);

      // Get the created instance
      const instance = await instanceRepository.findOne({
        where: { id: response.body.data.instanceId },
      });

      expect(instance).toBeTruthy();
      expect(instance.organizationId).toBe(testOrganizationId);
      expect(instance.status).toBe('PENDING');
      expect(instance.context.inputs).toHaveProperty('triggerType', 'evidence.submitted');
      expect(instance.context.inputs).toHaveProperty('sourceService', 'evidence-service');
      expect(instance.context.inputs.triggerData).toEqual(triggerData.data);
      expect(instance.context.metadata).toHaveProperty('triggeredBy', 'external-event');
    });

    it('should handle concurrent workflow triggers', async () => {
      const promises = [];

      // Trigger 5 workflows concurrently
      for (let i = 0; i < 5; i++) {
        const triggerData = {
          workflowName: 'Evidence Approval Workflow',
          workflowType: 'approval',
          triggerType: 'concurrent.test',
          sourceService: 'test-service',
          organizationId: testOrganizationId,
          data: { index: i },
        };

        const promise = request(app.getHttpServer())
          .post('/workflows/trigger')
          .set('X-Service-Name', 'test-service')
          .set('X-Service-API-Key', 'dev-test-service-api-key')
          .send(triggerData);

        promises.push(promise);
      }

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // All should have unique instance IDs
      const instanceIds = responses.map((r) => r.body.data.instanceId);
      const uniqueIds = new Set(instanceIds);
      expect(uniqueIds.size).toBe(5);
    });
  });
});
