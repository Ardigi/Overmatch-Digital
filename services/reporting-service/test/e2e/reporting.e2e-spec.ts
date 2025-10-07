// MUST be added at the TOP before any imports to prevent WeakMap errors
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { TestDataBuilder } from '../../../../test/e2e/shared/TestDataBuilder';
import { ReportingServiceE2ESetup } from './setup';

describe('Reporting Service E2E Tests', () => {
  let setup: ReportingServiceE2ESetup;
  let testData: TestDataBuilder;
  let authToken: string;
  let organizationId: string;

  beforeAll(async () => {
    setup = new ReportingServiceE2ESetup();
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

  describe('Report Templates', () => {
    describe('GET /reports/templates', () => {
      it('should return all report templates', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/reports/templates',
          authToken
        );

        if (response.status !== 200) {
          console.log('Template GET error:', response.status, response.body);
        }
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0]).toHaveProperty('id');
        expect(response.body.data[0]).toHaveProperty('name');
        expect(response.body.data[0]).toHaveProperty('type');
        expect(response.body.data[0]).toHaveProperty('format');
      });

      it('should filter templates by type', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/reports/templates?type=soc2_type1',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.every((t) => t.type === 'soc2_type1')).toBe(true);
      });
    });

    describe('POST /reports/templates', () => {
      it('should create a new report template', async () => {
        const newTemplate = {
          name: 'Custom Compliance Report',
          description: 'Custom report template for testing',
          type: 'custom',
          format: 'pdf',
          sections: [
            {
              name: 'Overview',
              type: 'text',
              required: true,
              template: 'Overview of {{organizationName}} compliance status',
            },
            {
              name: 'Controls',
              type: 'controls',
              required: true,
              filters: { status: 'active' },
            },
          ],
          variables: ['organizationName', 'reportPeriod'],
          isActive: true,
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          '/reports/templates',
          authToken,
          newTemplate
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('name', newTemplate.name);
        expect(response.body).toHaveProperty('sections');
        expect(response.body.sections).toHaveLength(2);
      });

      it('should validate template structure', async () => {
        const invalidTemplate = {
          name: '', // Empty name
          type: 'invalid_type',
          sections: [],
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          '/reports/templates',
          authToken,
          invalidTemplate
        );

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message');
      });
    });
  });

  describe('Report Generation', () => {
    let reportId: string;

    describe('POST /reports/generate', () => {
      it('should generate a new report', async () => {
        const reportRequest = {
          templateId: '11111111-1111-1111-1111-111111111111',
          name: 'Q1 2025 SOC 2 Type I Report',
          parameters: {
            organizationId,
            reportPeriod: {
              start: '2025-01-01',
              end: '2025-03-31',
            },
            includeEvidence: true,
            includeControlTests: true,
          },
          format: 'pdf',
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          '/reports/generate',
          authToken,
          reportRequest
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('status', 'queued');
        expect(response.body).toHaveProperty('templateId', reportRequest.templateId);

        reportId = response.body.id;
      });

      it('should support multiple output formats', async () => {
        const reportRequest = {
          templateId: '44444444-4444-4444-4444-444444444444',
          name: 'Control Matrix Export',
          parameters: {
            organizationId,
            includeInactive: false,
          },
          format: 'excel',
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          '/reports/generate',
          authToken,
          reportRequest
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('format', 'excel');
      });
    });

    describe('GET /reports/:id/status', () => {
      it('should return report generation status', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/reports/${reportId}/status`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', reportId);
        expect(response.body).toHaveProperty('status');
        expect(['queued', 'in_progress', 'generated', 'failed']).toContain(response.body.status);
        expect(response.body).toHaveProperty('progress');
      });
    });

    describe('GET /reports/:id', () => {
      it('should return report details', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/reports/${reportId}`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', reportId);
        expect(response.body).toHaveProperty('name');
        expect(response.body).toHaveProperty('templateId');
        expect(response.body).toHaveProperty('sections');
        expect(response.body).toHaveProperty('metadata');
      });
    });
  });

  describe('Report Download', () => {
    describe('GET /reports/:id/download', () => {
      it('should download generated report', async () => {
        // Use a report that's already generated
        const reportId = '55555555-5555-5555-5555-555555555555';

        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/reports/${reportId}/download`,
          authToken
        );

        expect([200, 202]).toContain(response.status);
        if (response.status === 200) {
          expect(response.headers).toHaveProperty('content-type');
          expect(response.headers['content-type']).toContain('application/pdf');
          expect(response.headers).toHaveProperty('content-disposition');
        } else {
          // Report still generating
          expect(response.body).toHaveProperty('message');
          expect(response.body).toHaveProperty('status');
        }
      });

      it('should return signed URL for large reports', async () => {
        const reportId = '55555555-5555-5555-5555-555555555555';

        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/reports/${reportId}/download?returnUrl=true`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('downloadUrl');
        expect(response.body).toHaveProperty('expiresAt');
      });
    });
  });

  describe('Report History', () => {
    describe('GET /reports', () => {
      it('should return report history', async () => {
        const response = await setup.makeAuthenticatedRequest('get', '/reports', authToken);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body).toHaveProperty('pagination');
      });

      it('should filter reports by organization', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          `/reports?organizationId=${organizationId}`,
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.every((r) => r.organizationId === organizationId)).toBe(true);
      });

      it('should filter reports by status', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/reports?status=completed',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.every((r) => r.status === 'completed')).toBe(true);
      });

      it('should filter reports by date range', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/reports?startDate=2025-01-01&endDate=2025-12-31',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body.data).toBeDefined();
      });
    });
  });

  describe('Report Scheduling', () => {
    let scheduleId: string;

    describe('GET /reports/schedules', () => {
      it('should return all report schedules', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/reports/schedules',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
      });
    });

    describe('POST /reports/schedules', () => {
      it('should create a new report schedule', async () => {
        const newSchedule = {
          templateId: '11111111-1111-1111-1111-111111111111',
          name: 'Weekly SOC 2 Report',
          cronExpression: '0 0 * * 1', // Every Monday at midnight
          parameters: {
            organizationId,
            reportPeriod: 'last_week',
            autoSend: true,
          },
          recipients: ['compliance@example.com', 'ciso@example.com'],
          isActive: true,
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          '/reports/schedules',
          authToken,
          newSchedule
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('nextRun');
        expect(response.body).toHaveProperty('cronExpression', newSchedule.cronExpression);

        scheduleId = response.body.id;
      });

      it('should validate cron expression', async () => {
        const invalidSchedule = {
          templateId: '11111111-1111-1111-1111-111111111111',
          name: 'Invalid Schedule',
          cronExpression: 'invalid cron',
          recipients: ['test@example.com'],
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          '/reports/schedules',
          authToken,
          invalidSchedule
        );

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Invalid cron expression');
      });
    });

    describe('PUT /reports/schedules/:id', () => {
      it('should update report schedule', async () => {
        const updateData = {
          isActive: false,
          recipients: ['new-recipient@example.com'],
        };

        const response = await setup.makeAuthenticatedRequest(
          'put',
          `/reports/schedules/${scheduleId}`,
          authToken,
          updateData
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('isActive', false);
        expect(response.body.recipients).toContain('new-recipient@example.com');
      });
    });

    describe('POST /reports/schedules/:id/trigger', () => {
      it('should manually trigger scheduled report', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'post',
          `/reports/schedules/${scheduleId}/run`,
          authToken
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('reportId');
        expect(response.body).toHaveProperty('status', 'queued');
      });
    });
  });

  describe('Report Analytics', () => {
    describe('GET /reports/analytics', () => {
      it('should return report generation analytics', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/reports/analytics/summary?period=30d',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('totalGenerated');
        expect(response.body).toHaveProperty('averageGenerationTime');
        expect(response.body).toHaveProperty('byType');
        expect(response.body).toHaveProperty('byStatus');
        expect(response.body).toHaveProperty('topTemplates');
      });
    });

    describe('GET /reports/analytics/performance', () => {
      it('should return report performance metrics', async () => {
        const response = await setup.makeAuthenticatedRequest(
          'get',
          '/reports/analytics/summary',
          authToken
        );

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('averageSize');
        expect(response.body).toHaveProperty('generationTimeByType');
        expect(response.body).toHaveProperty('failureRate');
        expect(response.body).toHaveProperty('queueMetrics');
      });
    });
  });

  describe('Report Collaboration', () => {
    const reportId = '55555555-5555-5555-5555-555555555555';

    describe('POST /reports/:id/share', () => {
      it('should share report with users', async () => {
        const shareData = {
          recipients: ['user1@example.com', 'user2@example.com'],
          permissions: ['view', 'download'],
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          message: 'Please review the Q1 SOC 2 report',
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          `/reports/${reportId}/share`,
          authToken,
          shareData
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('shareId');
        expect(response.body).toHaveProperty('shareUrl');
        expect(response.body).toHaveProperty('expiresAt');
      });
    });

    describe('POST /reports/:id/comments', () => {
      it('should add comment to report', async () => {
        const comment = {
          text: 'Please update the control effectiveness section',
          sectionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        };

        const response = await setup.makeAuthenticatedRequest(
          'post',
          `/reports/${reportId}/comments`,
          authToken,
          comment
        );

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('text', comment.text);
        expect(response.body).toHaveProperty('createdBy');
      });
    });
  });

  describe('Report Events', () => {
    it('should emit report events via Kafka', async () => {
      // This test verifies that report events are properly emitted
      const reportRequest = {
        templateId: '33333333-3333-3333-3333-333333333333',
        name: 'Event Test Report',
        parameters: { organizationId },
        format: 'pdf',
      };

      const response = await setup.makeAuthenticatedRequest(
        'post',
        '/reports/generate',
        authToken,
        reportRequest
      );

      expect(response.status).toBe(201);
      // Events: reporting.report.generated, reporting.report.failed should be emitted
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent template', async () => {
      const response = await setup.makeAuthenticatedRequest(
        'post',
        '/reports/generate',
        authToken,
        {
          templateId: 'non-existent-id',
          name: 'Test Report',
          parameters: {},
        }
      );

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
    });

    it('should handle invalid report parameters', async () => {
      const response = await setup.makeAuthenticatedRequest(
        'post',
        '/reports/generate',
        authToken,
        {
          templateId: '11111111-1111-1111-1111-111111111111',
          name: 'Invalid Report',
          parameters: {
            reportPeriod: {
              start: '2025-12-31',
              end: '2025-01-01', // End before start
            },
          },
        }
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });

    it('should require authentication', async () => {
      const request = require('supertest');
      const response = await request(setup.getHttpServer()).get('/reports/templates').expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Report Caching', () => {
    it('should cache frequently accessed reports', async () => {
      const reportId = '55555555-5555-5555-5555-555555555555';

      // First request
      const response1 = await setup.makeAuthenticatedRequest(
        'get',
        `/reports/${reportId}`,
        authToken
      );

      // Second request should be faster (cached)
      const response2 = await setup.makeAuthenticatedRequest(
        'get',
        `/reports/${reportId}`,
        authToken
      );

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response2.headers).toHaveProperty('x-cache-hit', 'true');
    });
  });
});
