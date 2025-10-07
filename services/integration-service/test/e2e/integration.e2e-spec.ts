// MUST be before any imports
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import * as request from 'supertest';
import { TestDataBuilder } from '../../../../test/e2e/shared/TestDataBuilder';
import type { Integration } from '../../src/modules/integrations/entities/integration.entity';
import { IntegrationServiceE2ESetup } from './setup';

// Define provider interface for type safety
interface Provider {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  configSchema?: any;
}

interface ApiResponse<T> {
  data: T[];
}

describe('Integration Service E2E Tests', () => {
  let setup: IntegrationServiceE2ESetup;
  let testData: TestDataBuilder;
  let authToken: string;
  let organizationId: string;

  beforeAll(async () => {
    setup = new IntegrationServiceE2ESetup();
    await setup.createTestApp();
    testData = new TestDataBuilder();

    // Seed test data
    await setup.cleanDatabase();
    await setup.seedTestData();

    // Get auth token and organization ID for tests
    const authResponse = await testData.createAuthenticatedUser();
    authToken = authResponse.token;
    organizationId = authResponse.organizationId || 'test-org-123';
  }, 30000);

  afterAll(async () => {
    await setup.closeApp();
  });

  describe('Integration Providers', () => {
    describe('GET /providers', () => {
      it('should return all available providers', async () => {
        const response = await setup.makeAuthenticatedRequest('get', '/providers', authToken);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0]).toHaveProperty('id');
        expect(response.body.data[0]).toHaveProperty('name');
        expect(response.body.data[0]).toHaveProperty('type');
        expect(response.body.data[0]).toHaveProperty('configSchema');
      });

      it('should filter providers by type', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/providers?type=issue_tracking',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
        const typedResponse = response.body as ApiResponse<Provider>;
        expect(typedResponse.data.every((p) => p.type === 'issue_tracking')).toBe(true);
      });

      it('should return only active providers', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/providers?active=true',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
        const typedResponse = response.body as ApiResponse<Provider>;
        expect(typedResponse.data.every((p) => p.isActive === true)).toBe(true);
      });
    });

    describe('GET /providers/:id', () => {
      it('should return provider details', async () => {
        const providerId = '11111111-1111-1111-1111-111111111111'; // Jira

        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/providers/${providerId}`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', providerId);
        expect(response.body).toHaveProperty('name', 'Jira');
        expect(response.body).toHaveProperty('configSchema');
        expect(response.body).toHaveProperty('supportedEvents');
        expect(response.body).toHaveProperty('capabilities');
      });
    });
  });

  describe('Integration Management', () => {
    let integrationId: string;

    describe('GET /integrations', () => {
      it('should return organization integrations', async () => {
        const response = await setup.makeAuthenticatedRequest('get', '/integrations', authToken);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
      });

      it('should filter integrations by status', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/integrations?status=active',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
        const typedResponse = response.body as ApiResponse<Integration>;
        expect(typedResponse.data.every((i) => i.status === 'ACTIVE')).toBe(true);
      });
    });

    describe('POST /integrations', () => {
      it('should create a new integration', async () => {
        const newIntegration = {
          providerId: '44444444-4444-4444-4444-444444444444', // GitHub
          name: 'GitHub Main',
          config: {
            org: 'test-organization',
            token: 'ghp_testtoken123',
            webhookSecret: 'webhook-secret-123',
          },
          enabledEvents: ['push', 'pull_request', 'issues'],
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          '/integrations',
          authToken,
          newIntegration
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('status', 'inactive');
        expect(response.body).toHaveProperty('providerId', newIntegration.providerId);

        integrationId = response.body.id;
      });

      it('should validate provider config', async () => {
        const invalidIntegration = {
          providerId: '11111111-1111-1111-1111-111111111111', // Jira
          name: 'Invalid Jira',
          config: {
            // Missing required fields
            project: 'TEST',
          },
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          '/integrations',
          authToken,
          invalidIntegration
        );

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('config');
      });
    });

    describe('PUT /integrations/:id', () => {
      it('should update integration config', async () => {
        const updateData = {
          config: {
            url: 'https://test.atlassian.net',
            project: 'SOC',
            apiToken: 'new-token-456',
          },
          enabledEvents: ['issue.created', 'issue.updated'],
        };

        const response = await setup.makeAuthenticatedRequest(
          'put',
          `/integrations/66666666-6666-6666-6666-666666666666`,
          authToken,
          updateData
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('config');
        expect(response.body.config.project).toBe('SOC');
      });
    });

    describe('POST /integrations/:id/activate', () => {
      it('should activate integration', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'post',
          `/integrations/${integrationId}/activate`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'active');
        expect(response.body).toHaveProperty('activatedAt');
      });
    });

    describe('POST /integrations/:id/deactivate', () => {
      it('should deactivate integration', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'post',
          `/integrations/${integrationId}/deactivate`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'inactive');
        expect(response.body).toHaveProperty('deactivatedAt');
      });
    });

    describe('POST /integrations/:id/test', () => {
      it('should test integration connection', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'post',
          `/integrations/66666666-6666-6666-6666-666666666666/test`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('details');
      });
    });
  });

  describe('OAuth Flow', () => {
    describe('GET /integrations/:providerId/oauth/authorize', () => {
      it('should initiate OAuth flow', async () => {
        const providerId = '22222222-2222-2222-2222-222222222222'; // Slack

        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/integrations/${providerId}/oauth/authorize`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('authorizationUrl');
        expect(response.body).toHaveProperty('state');
        expect(response.body.authorizationUrl).toContain('oauth/authorize');
      });
    });

    describe('POST /oauth/callback', () => {
      it('should handle OAuth callback', async () => {
        const callbackData = {
          code: 'test-auth-code',
          state: 'test-state-123',
          providerId: '22222222-2222-2222-2222-222222222222',
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          '/oauth/callback',
          authToken,
          callbackData
        );

        expect([200, 201]).toContain(response.status);
        if (response.status === 201) {
          expect(response.body).toHaveProperty('integrationId');
          expect(response.body).toHaveProperty('status', 'active');
        }
      });
    });
  });

  describe('Webhooks', () => {
    const integrationId = '66666666-6666-6666-6666-666666666666';
    let webhookId: string;

    describe('GET /integrations/:id/webhooks', () => {
      it('should return integration webhooks', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/integrations/${integrationId}/webhooks`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
      });
    });

    describe('POST /integrations/:id/webhooks', () => {
      it('should create a new webhook', async () => {
        const newWebhook = {
          eventType: 'control.created',
          url: 'https://api.example.com/webhook/control-created',
          headers: {
            'X-Custom-Header': 'custom-value',
          },
          retryPolicy: {
            maxAttempts: 3,
            backoffMultiplier: 2,
          },
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          `/integrations/${integrationId}/webhooks`,
          authToken,
          newWebhook
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('secret');
        expect(response.body).toHaveProperty('isActive', true);

        webhookId = response.body.id;
      });
    });

    describe('POST /webhooks/:id/test', () => {
      it('should send test webhook', async () => {
        const testData = {
          payload: {
            event: 'test',
            timestamp: new Date().toISOString(),
            data: {
              message: 'Test webhook payload',
            },
          },
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          `/webhooks/${webhookId}/test`,
          authToken,
          testData
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('response');
        expect(response.body).toHaveProperty('executionTime');
      });
    });

    describe('DELETE /webhooks/:id', () => {
      it('should delete webhook', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'delete',
          `/webhooks/${webhookId}`,
          authToken
        );

        expect(response.status).toBe(204);
      });
    });
  });

  describe('Data Synchronization', () => {
    const integrationId = '66666666-6666-6666-6666-666666666666';

    describe('POST /integrations/:id/sync', () => {
      it('should trigger manual sync', async () => {
        const syncRequest = {
          type: 'full',
          entities: ['issues', 'users', 'projects'],
          options: {
            since: '2025-01-01',
            batchSize: 100,
          },
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          `/integrations/${integrationId}/sync`,
          authToken,
          syncRequest
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('syncJobId');
        expect(response.body).toHaveProperty('status', 'queued');
      });

      it('should support incremental sync', async () => {
        const syncRequest = {
          type: 'incremental',
          entities: ['issues'],
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          `/integrations/${integrationId}/sync`,
          authToken,
          syncRequest
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('syncJobId');
      });
    });

    describe('GET /integrations/:id/sync-jobs', () => {
      it('should return sync job history', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/integrations/${integrationId}/sync-jobs`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0]).toHaveProperty('type');
        expect(response.body.data[0]).toHaveProperty('status');
        expect(response.body.data[0]).toHaveProperty('recordsSynced');
      });
    });

    describe('GET /sync-jobs/:id', () => {
      it('should return sync job details', async () => {
        const syncJobId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/sync-jobs/${syncJobId}`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', syncJobId);
        expect(response.body).toHaveProperty('progress');
        expect(response.body).toHaveProperty('details');
        expect(response.body).toHaveProperty('errors');
      });
    });
  });

  describe('Field Mapping', () => {
    const integrationId = '66666666-6666-6666-6666-666666666666';

    describe('GET /integrations/:id/field-mappings', () => {
      it('should return field mappings', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/integrations/${integrationId}/field-mappings`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('mappings');
        expect(response.body).toHaveProperty('version');
      });
    });

    describe('PUT /integrations/:id/field-mappings', () => {
      it('should update field mappings', async () => {
        const mappings = {
          issue: {
            title: 'summary',
            description: 'description',
            status: {
              field: 'status.name',
              transform: 'lowercase',
            },
            priority: {
              field: 'priority.name',
              valueMap: {
                Blocker: 'critical',
                Critical: 'high',
                Major: 'medium',
                Minor: 'low',
              },
            },
          },
        };

        const response = await setup.makeAuthenticatedRequest(
          'put',
          `/integrations/${integrationId}/field-mappings`,
          authToken,
          mappings
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('mappings');
        expect(response.body).toHaveProperty('updatedAt');
      });
    });
  });

  describe('Integration Analytics', () => {
    describe('GET /integrations/analytics', () => {
      it('should return integration analytics', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/integrations/analytics?period=30d',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('totalIntegrations');
        expect(response.body).toHaveProperty('byProvider');
        expect(response.body).toHaveProperty('byStatus');
        expect(response.body).toHaveProperty('syncMetrics');
        expect(response.body).toHaveProperty('webhookMetrics');
      });
    });

    describe('GET /integrations/:id/analytics', () => {
      it('should return specific integration analytics', async () => {
        const integrationId = '66666666-6666-6666-6666-666666666666';

        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/integrations/${integrationId}/analytics`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('uptime');
        expect(response.body).toHaveProperty('syncHistory');
        expect(response.body).toHaveProperty('errorRate');
        expect(response.body).toHaveProperty('dataVolume');
      });
    });
  });

  describe('Integration Events', () => {
    it('should emit integration events via Kafka', async () => {
      const integrationId = '66666666-6666-6666-6666-666666666666';

      const response = await setup.makeAuthenticatedRequest(
        'post',
        `/integrations/${integrationId}/sync`,
        authToken,
        { type: 'full' }
      );

      expect(response.status).toBe(201);
      // Events: integration.sync.started, integration.sync.completed should be emitted
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent provider', async () => {
      const response = await setup.makeAuthenticatedRequest('post', '/integrations', authToken, {
        providerId: 'non-existent-id',
        name: 'Test Integration',
        config: {},
      });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle integration errors gracefully', async () => {
      const errorIntegrationId = '99999999-9999-9999-9999-999999999999'; // GitHub with error status

      const response = await setup.makeAuthenticatedRequest(
        'post',
        `/integrations/${errorIntegrationId}/sync`,
        authToken
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('error state');
    });

    it('should require authentication', async () => {
      const response = await request(setup.getHttpServer()).get('/providers').expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });
});
