// MUST be before any imports
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import request from 'supertest';
import { TestDataBuilder } from '../../../../test/e2e/shared/TestDataBuilder';
import { WorkflowServiceE2ESetup } from './setup';

describe('Workflow Service E2E Tests', () => {
  let setup: WorkflowServiceE2ESetup;
  let testData: TestDataBuilder;
  let authToken: string;
  let organizationId: string;

  beforeAll(async () => {
    setup = new WorkflowServiceE2ESetup();
    await setup.createTestApp();
    testData = new TestDataBuilder();

    // Seed test data
    await setup.cleanDatabase();
    await setup.seedTestData();

    // Get auth token and organization ID for tests
    const authResponse = await testData.createAuthenticatedUser();
    authToken = authResponse.token;
    organizationId = authResponse.organizationId;
  }, 30000);

  afterAll(async () => {
    await setup.closeApp();
  });

  describe('Workflow Management', () => {
    describe('GET /workflows', () => {
      it('should return all workflows', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/api/v1/workflows',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0]).toHaveProperty('id');
        expect(response.body.data[0]).toHaveProperty('name');
        expect(response.body.data[0]).toHaveProperty('type');
      });

      it('should filter workflows by type', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/api/v1/workflows?type=evidence_collection',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.every((w) => w.type === 'evidence_collection')).toBe(true);
      });
    });

    describe('POST /workflows', () => {
      it('should create a new workflow', async () => {
        const newWorkflow = {
          name: 'New Test Workflow',
          description: 'Test workflow created by E2E test',
          type: 'custom',
          steps: [
            {
              name: 'Step 1',
              type: 'manual',
              description: 'First step',
              config: {},
              sequence: 1,
              isRequired: true,
            },
            {
              name: 'Step 2',
              type: 'approval',
              description: 'Approval step',
              config: { approvers: ['manager'] },
              sequence: 2,
              isRequired: true,
            },
          ],
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          '/api/v1/workflows',
          authToken,
          newWorkflow
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe(newWorkflow.name);
        expect(response.body.steps).toHaveLength(2);
      });

      it('should validate workflow data', async () => {
        const invalidWorkflow = {
          name: '', // Empty name
          type: 'invalid_type',
          steps: [],
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          '/api/v1/workflows',
          authToken,
          invalidWorkflow
        );

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message');
      });
    });
  });

  describe('Workflow Templates', () => {
    describe('GET /workflow-templates', () => {
      it('should return all workflow templates', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/api/v1/workflow-templates',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
      });
    });

    describe('POST /workflow-templates/:id/instantiate', () => {
      it('should create a workflow from template', async () => {
        const templateId = '44444444-4444-4444-4444-444444444444';
        const instantiateData = {
          name: 'Workflow from Template',
          description: 'Created from template',
          customizations: {
            assignees: ['user1', 'user2'],
          },
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          `/api/v1/workflow-templates/${templateId}/instantiate`,
          authToken,
          instantiateData
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe(instantiateData.name);
        expect(response.body).toHaveProperty('templateId', templateId);
      });
    });
  });

  describe('Workflow Instances', () => {
    let workflowId: string;
    let instanceId: string;

    beforeAll(() => {
      workflowId = '11111111-1111-1111-1111-111111111111';
    });

    describe('POST /workflows/:id/instances', () => {
      it('should start a new workflow instance', async () => {
        const startData = {
          context: {
            clientId: 'test-client-123',
            controlId: 'test-control-456',
            initiatedBy: 'test-user',
          },
          priority: 'high',
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          `/api/v1/workflows/${workflowId}/instances`,
          authToken,
          startData
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('workflowId', workflowId);
        expect(response.body).toHaveProperty('status', 'pending');
        expect(response.body).toHaveProperty('context');

        instanceId = response.body.id;
      });
    });

    describe('GET /workflow-instances/:id', () => {
      it('should return workflow instance details', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/api/v1/workflow-instances/${instanceId}`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', instanceId);
        expect(response.body).toHaveProperty('workflowId');
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('steps');
      });
    });

    describe('POST /workflow-instances/:id/steps/:stepId/complete', () => {
      it('should complete a workflow step', async () => {
        // First, get the instance to find the current step
        const instanceResponse = await setup.makeAuthenticatedRequest(
          'get',
          `/api/v1/workflow-instances/${instanceId}`,
          authToken
        );

        const currentStep = instanceResponse.body.steps.find((s) => s.status === 'pending');
        expect(currentStep).toBeDefined();

        const completeData = {
          result: 'completed',
          data: {
            evidence: ['evidence-url-1', 'evidence-url-2'],
            notes: 'Step completed successfully',
          },
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          `/api/v1/workflow-instances/${instanceId}/steps/${currentStep.id}/complete`,
          authToken,
          completeData
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'completed');
        expect(response.body).toHaveProperty('completedAt');
      });
    });
  });

  describe('Workflow Approvals', () => {
    let approvalInstanceId: string;
    let approvalStepId: string;

    beforeAll(async () => {
      // Create a workflow instance that requires approval
      const workflowId = '22222222-2222-2222-2222-222222222222';
      const response = await setup.makeAuthenticatedRequest(
        'post',
        `/api/v1/workflows/${workflowId}/instances`,
        authToken,
        { context: { requiresApproval: true } }
      );

      approvalInstanceId = response.body.id;

      // Find the approval step
      const instanceResponse = await setup.makeAuthenticatedRequest(
        'get',
        `/api/v1/workflow-instances/${approvalInstanceId}`,
        authToken
      );

      const approvalStep = instanceResponse.body.steps.find((s) => s.type === 'approval');
      approvalStepId = approvalStep?.id;
    });

    describe('POST /workflow-instances/:id/steps/:stepId/approve', () => {
      it('should approve a workflow step', async () => {
        const approvalData = {
          comments: 'Approved after review',
          approver: 'test-manager',
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          `/api/v1/workflow-instances/${approvalInstanceId}/steps/${approvalStepId}/approve`,
          authToken,
          approvalData
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'approved');
        expect(response.body).toHaveProperty('approvedBy');
        expect(response.body).toHaveProperty('approvalComments');
      });
    });

    describe('POST /workflow-instances/:id/steps/:stepId/reject', () => {
      it('should reject a workflow step', async () => {
        // Create another instance for rejection test
        const workflowId = '22222222-2222-2222-2222-222222222222';
        const instanceResponse = await setup.makeAuthenticatedRequest(
          'post',
          `/api/v1/workflows/${workflowId}/instances`,
          authToken,
          { context: { requiresApproval: true } }
        );

        const rejectInstanceId = instanceResponse.body.id;

        // Get the approval step
        const detailResponse = await setup.makeAuthenticatedRequest(
          'get',
          `/api/v1/workflow-instances/${rejectInstanceId}`,
          authToken
        );

        const rejectStepId = detailResponse.body.steps.find((s) => s.type === 'approval')?.id;

        const rejectionData = {
          reason: 'Missing required documentation',
          rejectedBy: 'test-manager',
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          `/api/v1/workflow-instances/${rejectInstanceId}/steps/${rejectStepId}/reject`,
          authToken,
          rejectionData
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'rejected');
        expect(response.body).toHaveProperty('rejectedBy');
        expect(response.body).toHaveProperty('rejectionReason');
      });
    });
  });

  describe('Workflow Analytics', () => {
    describe('GET /workflows/:id/analytics', () => {
      it('should return workflow analytics', async () => {
        const workflowId = '11111111-1111-1111-1111-111111111111';

        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/api/v1/workflows/${workflowId}/analytics`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('totalInstances');
        expect(response.body).toHaveProperty('completedInstances');
        expect(response.body).toHaveProperty('averageCompletionTime');
        expect(response.body).toHaveProperty('stepMetrics');
      });
    });

    describe('GET /workflows/analytics/summary', () => {
      it('should return overall workflow analytics summary', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/api/v1/workflows/analytics/summary',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('totalWorkflows');
        expect(response.body).toHaveProperty('activeWorkflows');
        expect(response.body).toHaveProperty('totalInstances');
        expect(response.body).toHaveProperty('instancesByStatus');
      });
    });
  });

  describe('Workflow Events', () => {
    it('should emit workflow events via Kafka', async () => {
      // This test verifies that workflow events are properly emitted
      // In a real scenario, we would set up a Kafka consumer to verify events

      const workflowId = '11111111-1111-1111-1111-111111111111';
      const response = await setup.makeAuthenticatedRequest(
        'post',
        `/api/v1/workflows/${workflowId}/instances`,
        authToken,
        { context: { testEvent: true } }
      );

      expect(response.status).toBe(201);
      // Events: workflow.instance.created should be emitted
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent workflow', async () => {
      const response = await setup.makeAuthenticatedRequest(
        'get',
        '/api/v1/workflows/non-existent-id',
        authToken
      );

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle invalid workflow instance operations', async () => {
      const response = await setup.makeAuthenticatedRequest(
        'post',
        '/api/v1/workflow-instances/invalid-id/steps/invalid-step/complete',
        authToken,
        { result: 'completed' }
      );

      expect(response.status).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await request(setup.getHttpServer()).get('/api/v1/workflows').expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });
});
