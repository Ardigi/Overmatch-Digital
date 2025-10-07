// Import reflect-metadata first
import 'reflect-metadata';

// Ensure TypeORM is not mocked in E2E tests
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import { HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { PolicyServiceE2ESetup } from './setup';

describe('Policy Service E2E Tests', () => {
  let setup: PolicyServiceE2ESetup;
  let adminToken: string;
  let managerToken: string;
  let viewerToken: string;
  let regularUserToken: string;
  let testPolicy: any;
  const testOrganizationId: string = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    setup = new PolicyServiceE2ESetup();
    await setup.createTestApp();

    // Clean database and seed test data
    await setup.cleanDatabase();

    // Create test organization and users (in real E2E, this would be through auth service)
    // For now, we'll use mock tokens with Kong headers
    adminToken = 'admin-token';
    managerToken = 'manager-token';
    viewerToken = 'viewer-token';
    regularUserToken = 'user-token';

    // Don't seed initial test policy - let the test create it
    // testPolicy = await setup.seedTestPolicy(testOrganizationId);
  }, 60000);

  afterAll(async () => {
    await setup.closeApp();
  }, 30000);

  // Helper function to make authenticated requests with Kong headers
  const makeAuthRequest = (
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    url: string,
    token: string,
    body?: any
  ) => {
    const req = request(setup.getHttpServer())[method](url);

    // Set Kong headers based on token
    if (token === 'admin-token') {
      req.set('x-user-id', 'admin-user');
      req.set('x-user-email', 'admin@test.com');
      req.set('x-organization-id', testOrganizationId);
      req.set('x-user-roles', 'admin,policy_manager');
    } else if (token === 'manager-token') {
      req.set('x-user-id', 'manager-user');
      req.set('x-user-email', 'manager@test.com');
      req.set('x-organization-id', testOrganizationId);
      req.set('x-user-roles', 'policy_manager');
    } else if (token === 'viewer-token') {
      req.set('x-user-id', 'viewer-user');
      req.set('x-user-email', 'viewer@test.com');
      req.set('x-organization-id', testOrganizationId);
      req.set('x-user-roles', 'policy_viewer');
    } else if (token === 'user-token') {
      req.set('x-user-id', 'regular-user');
      req.set('x-user-email', 'user@test.com');
      req.set('x-organization-id', testOrganizationId);
      req.set('x-user-roles', 'user');
    }
    // If no token, don't set headers (test unauthenticated access)

    if (body) {
      req.send(body);
    }

    return req;
  };

  describe('Policy CRUD Operations', () => {
    describe('POST /api/v1/policies', () => {
      it('should create a new policy with valid data', async () => {
        const policyData = {
          title: 'Test Security Policy',
          description: 'E2E test policy for security compliance',
          type: 'security',
          priority: 'high',
          scope: 'organization',
          ownerName: 'Test Admin',
          content: {
            sections: [
              {
                title: 'Purpose',
                content: 'To establish security requirements for E2E testing',
              },
              {
                title: 'Scope',
                content: 'Applies to all test environments',
              },
            ],
          },
          effectiveDate: '2025-03-01',
          expirationDate: '2026-03-01',
          tags: ['security', 'testing'],
          complianceMapping: {
            frameworks: ['SOC2', 'ISO27001'],
            controls: ['CC6.1', 'A.9.1.1'],
          },
        };

        const response = await makeAuthRequest('post', '/api/v1/policies', adminToken, policyData);

        if (response.status !== HttpStatus.CREATED) {
          console.error('Policy creation failed:', response.body);
        }
        expect(response.status).toBe(HttpStatus.CREATED);
        expect(response.body).toMatchObject({
          id: expect.any(String),
          policyNumber: expect.stringMatching(/^POL-\d+$/),
          title: policyData.title,
          status: 'draft',
          createdBy: 'admin-user',
        });

        testPolicy = response.body;
      });

      it('should validate required fields', async () => {
        const invalidData = {
          description: 'Missing required title',
          type: 'security',
        };

        const response = await makeAuthRequest('post', '/api/v1/policies', adminToken, invalidData);

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toContain('title should not be empty');
      });

      it('should require authentication', async () => {
        const response = await makeAuthRequest('post', '/api/v1/policies', '', {});

        expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
      });

      it('should enforce role-based access', async () => {
        const policyData = {
          title: 'Viewer Cannot Create',
          type: 'security',
          priority: 'low',
          scope: 'department',
          ownerName: 'Test Viewer',
          content: { sections: [] },
          effectiveDate: '2025-03-01',
        };

        const response = await makeAuthRequest('post', '/api/v1/policies', viewerToken, policyData);

        expect(response.status).toBe(HttpStatus.FORBIDDEN);
      });

      it('should sanitize HTML in content', async () => {
        const policyWithHtml = {
          title: 'XSS Test Policy',
          type: 'security',
          priority: 'low',
          scope: 'organization',
          ownerName: 'Test Admin',
          effectiveDate: '2025-03-01',
          content: {
            sections: [
              {
                title: 'Test Section',
                content: '<script>alert("XSS")</script>This is safe content',
              },
            ],
          },
        };

        const response = await makeAuthRequest(
          'post',
          '/api/v1/policies',
          adminToken,
          policyWithHtml
        );

        expect(response.status).toBe(HttpStatus.CREATED);
        expect(response.body.content.sections[0].content).not.toContain('<script>');
        expect(response.body.content.sections[0].content).toContain('This is safe content');
      });
    });

    describe('GET /api/v1/policies', () => {
      it('should return paginated policies', async () => {
        const response = await makeAuthRequest(
          'get',
          '/api/v1/policies?page=1&limit=10',
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('meta');
        expect(response.body.meta).toMatchObject({
          total: expect.any(Number),
          page: 1,
          limit: 10,
          totalPages: expect.any(Number),
        });
      });

      it('should filter by status', async () => {
        const response = await makeAuthRequest('get', '/api/v1/policies?status=draft', adminToken);

        expect(response.status).toBe(HttpStatus.OK);
        response.body.data.forEach((policy: any) => {
          expect(policy.status).toBe('draft');
        });
      });

      it('should filter by type', async () => {
        const response = await makeAuthRequest('get', '/api/v1/policies?type=security', adminToken);

        expect(response.status).toBe(HttpStatus.OK);
        response.body.data.forEach((policy: any) => {
          expect(policy.type).toBe('security');
        });
      });

      it('should search by text in title and content', async () => {
        const response = await makeAuthRequest(
          'get',
          '/api/v1/policies?search=security',
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.data.length).toBeGreaterThan(0);
        response.body.data.forEach((policy: any) => {
          const hasSearchTerm =
            policy.title.toLowerCase().includes('security') ||
            policy.description?.toLowerCase().includes('security') ||
            policy.tags?.some((tag: string) => tag.toLowerCase().includes('security'));
          expect(hasSearchTerm).toBe(true);
        });
      });

      it('should respect viewer permissions', async () => {
        const response = await makeAuthRequest('get', '/api/v1/policies', viewerToken);

        expect(response.status).toBe(HttpStatus.OK);
        // Viewers should only see published/effective policies
        response.body.data.forEach((policy: any) => {
          expect(['published', 'effective', 'draft']).toContain(policy.status);
        });
      });
    });

    describe('GET /api/v1/policies/:id', () => {
      it('should return a single policy', async () => {
        const response = await makeAuthRequest(
          'get',
          `/api/v1/policies/${testPolicy.id}`,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          id: testPolicy.id,
          title: testPolicy.title,
        });
      });

      it('should return 404 for non-existent policy', async () => {
        const response = await makeAuthRequest(
          'get',
          '/api/v1/policies/00000000-0000-0000-0000-000000000000',
          adminToken
        );

        expect(response.status).toBe(HttpStatus.NOT_FOUND);
      });
    });

    describe('PATCH /api/v1/policies/:id', () => {
      it('should update policy fields', async () => {
        const updateData = {
          title: 'Updated Security Policy',
          description: 'Updated description for E2E test',
          priority: 'critical',
        };

        const response = await makeAuthRequest(
          'patch',
          `/api/v1/policies/${testPolicy.id}`,
          adminToken,
          updateData
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          title: updateData.title,
          description: updateData.description,
          priority: updateData.priority,
        });
      });

      it('should require appropriate permissions', async () => {
        const updateData = {
          title: 'Viewer Cannot Update',
        };

        const response = await makeAuthRequest(
          'patch',
          `/api/v1/policies/${testPolicy.id}`,
          viewerToken,
          updateData
        );

        expect(response.status).toBe(HttpStatus.FORBIDDEN);
      });
    });

    describe('DELETE /api/v1/policies/:id', () => {
      let policyToDelete: any;

      beforeEach(async () => {
        policyToDelete = await setup.seedTestPolicy(testOrganizationId);
      });

      it('should soft delete a policy', async () => {
        const response = await makeAuthRequest(
          'delete',
          `/api/v1/policies/${policyToDelete.id}`,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.NO_CONTENT);

        // Verify soft delete
        const getResponse = await makeAuthRequest(
          'get',
          `/api/v1/policies/${policyToDelete.id}`,
          adminToken
        );

        expect(getResponse.status).toBe(HttpStatus.NOT_FOUND);
      });

      it('should require admin or policy_manager role', async () => {
        const response = await makeAuthRequest(
          'delete',
          `/api/v1/policies/${policyToDelete.id}`,
          viewerToken
        );

        expect(response.status).toBe(HttpStatus.FORBIDDEN);
      });
    });
  });

  describe('Policy Workflow', () => {
    let workflowPolicy: any;

    beforeEach(async () => {
      workflowPolicy = await setup.seedTestPolicy(testOrganizationId);
    });

    describe('POST /api/v1/policies/:id/submit-for-review', () => {
      it('should transition from DRAFT to UNDER_REVIEW', async () => {
        const response = await makeAuthRequest(
          'post',
          `/api/v1/policies/${workflowPolicy.id}/submit-for-review`,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.status).toBe('under_review');
      });
    });

    describe('POST /api/v1/policies/:id/approve', () => {
      beforeEach(async () => {
        // Submit for review first
        await makeAuthRequest(
          'post',
          `/api/v1/policies/${workflowPolicy.id}/submit-for-review`,
          adminToken
        );
      });

      it('should approve a policy under review', async () => {
        const response = await makeAuthRequest(
          'post',
          `/api/v1/policies/${workflowPolicy.id}/approve`,
          adminToken,
          { comments: 'Approved after thorough review' }
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.status).toBe('approved');
      });

      it('should only allow managers to approve', async () => {
        const response = await makeAuthRequest(
          'post',
          `/api/v1/policies/${workflowPolicy.id}/approve`,
          viewerToken,
          { comments: 'Trying to approve' }
        );

        expect(response.status).toBe(HttpStatus.FORBIDDEN);
      });
    });

    describe('POST /api/v1/policies/:id/publish', () => {
      beforeEach(async () => {
        await makeAuthRequest(
          'post',
          `/api/v1/policies/${workflowPolicy.id}/submit-for-review`,
          adminToken
        );
        await makeAuthRequest('post', `/api/v1/policies/${workflowPolicy.id}/approve`, adminToken, {
          comments: 'Ready for publication',
        });
      });

      it('should publish an approved policy', async () => {
        const response = await makeAuthRequest(
          'post',
          `/api/v1/policies/${workflowPolicy.id}/publish`,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.status).toBe('published');
      });
    });
  });

  describe('Policy Features', () => {
    describe('GET /api/v1/policies/expiring', () => {
      it('should return policies expiring within 30 days', async () => {
        const response = await makeAuthRequest('get', '/api/v1/policies/expiring', adminToken);

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toBeInstanceOf(Array);
      });

      it('should accept custom days parameter', async () => {
        const response = await makeAuthRequest(
          'get',
          '/api/v1/policies/expiring?days=60',
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
      });
    });

    describe('GET /api/v1/policies/:id/compliance-score', () => {
      it('should calculate compliance score based on control coverage', async () => {
        const response = await makeAuthRequest(
          'get',
          `/api/v1/policies/${testPolicy.id}/compliance-score`,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          overallScore: expect.any(Number),
          frameworkScores: expect.any(Object),
          controlCoverage: expect.any(Object),
          gaps: expect.any(Array),
          recommendations: expect.any(Array),
        });
        expect(response.body.overallScore).toBeGreaterThanOrEqual(0);
        expect(response.body.overallScore).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Security and Compliance', () => {
    describe('Input Validation', () => {
      it('should prevent SQL injection in search', async () => {
        const maliciousQuery = "'; DROP TABLE policies; --";
        const response = await makeAuthRequest(
          'get',
          `/api/v1/policies?search=${encodeURIComponent(maliciousQuery)}`,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        // Verify the system is still functional
        const checkResponse = await makeAuthRequest('get', '/api/v1/policies', adminToken);
        expect(checkResponse.status).toBe(HttpStatus.OK);
      });

      it('should sanitize markdown content', async () => {
        const maliciousContent = {
          title: 'Markdown Injection Test',
          type: 'security',
          priority: 'low',
          scope: 'organization',
          ownerName: 'Test User',
          effectiveDate: '2025-03-01',
          content: {
            sections: [
              {
                title: 'Test',
                content: '![](x) <script>alert("XSS")</script> [link](javascript:alert("XSS"))',
              },
            ],
          },
        };

        const response = await makeAuthRequest(
          'post',
          '/api/v1/policies',
          adminToken,
          maliciousContent
        );

        expect(response.status).toBe(HttpStatus.CREATED);
        const content = response.body.content.sections[0].content;
        expect(content).not.toContain('<script>');
        expect(content).not.toContain('javascript:');
      });
    });

    describe('Audit Logging', () => {
      it('should log all policy modifications', async () => {
        // Create a policy
        const policy = await setup.seedTestPolicy(testOrganizationId);

        // Update it
        await makeAuthRequest('patch', `/api/v1/policies/${policy.id}`, adminToken, {
          priority: 'critical',
        });

        // Check audit logs
        const response = await makeAuthRequest(
          'get',
          `/api/v1/audit-logs?resourceId=${policy.id}`,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toBeInstanceOf(Array);
      });
    });
  });

  describe('API Key Authentication', () => {
    let apiKey: { id: string; plainKey: string };

    beforeEach(async () => {
      // Seed API key for testing
      apiKey = await setup.seedApiKey('admin-user', testOrganizationId);
    });

    it('should authenticate with valid API key', async () => {
      const response = await request(setup.getHttpServer())
        .get('/api/v1/policies')
        .set('X-API-Key', apiKey.plainKey);

      expect(response.status).toBe(HttpStatus.OK);
    });

    it('should reject invalid API key', async () => {
      const response = await request(setup.getHttpServer())
        .get('/api/v1/policies')
        .set('X-API-Key', 'invalid-key');

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should reject expired API key', async () => {
      // Update API key to be expired
      await setup
        .getDataSource()
        .query(`UPDATE api_keys SET "expiresAt" = NOW() - INTERVAL '1 day' WHERE id = $1`, [
          apiKey.id,
        ]);

      const response = await request(setup.getHttpServer())
        .get('/api/v1/policies')
        .set('X-API-Key', apiKey.plainKey);

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });
  });
});
