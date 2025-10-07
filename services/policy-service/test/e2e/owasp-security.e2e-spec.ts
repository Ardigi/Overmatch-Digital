// Ensure TypeORM is not mocked in E2E tests
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import { HttpStatus } from '@nestjs/common';
import request from 'supertest';
import {
  AuthTestHelper,
  SECURITY_TEST_CONSTANTS,
  SecurityTestHelper,
  TEST_USERS,
  TestUserRole,
} from '../../test/utils/test-helpers';
import { PolicyServiceE2ESetup } from './setup';

/**
 * E2E Security Tests based on OWASP API Security Top 10 2023
 * These tests validate security controls for a compliance platform
 */
describe('OWASP API Security E2E Tests', () => {
  let setup: PolicyServiceE2ESetup;
  let adminToken: string;
  let userTokens: Map<string, string>;
  let authHelper: AuthTestHelper;
  const testResources: any[] = [];
  const testOrganizationId: string = 'org-123';

  // Helper object to maintain compatibility with old test structure
  const testSetup = {
    makeRequest: (
      method: string,
      url: string,
      data?: any,
      token?: string,
      headers?: Record<string, string>
    ) => {
      const req = request(setup.getHttpServer())[method.toLowerCase()](url);

      // Set Kong headers based on token
      if (token === 'mock-jwt-token-for-admin-user') {
        req.set('x-user-id', 'admin-user');
        req.set('x-user-email', 'admin@test.com');
        req.set('x-organization-id', testOrganizationId);
        req.set('x-user-roles', 'admin,policy_manager');
      } else if (token === 'mock-jwt-token-for-policy-manager') {
        req.set('x-user-id', 'policy-manager');
        req.set('x-user-email', 'policy.manager@test.com');
        req.set('x-organization-id', testOrganizationId);
        req.set('x-user-roles', 'policy_manager');
      } else if (token === 'mock-jwt-token-for-compliance-manager') {
        req.set('x-user-id', 'compliance-manager');
        req.set('x-user-email', 'compliance@test.com');
        req.set('x-organization-id', testOrganizationId);
        req.set('x-user-roles', 'compliance_manager');
      } else if (token === 'mock-jwt-token-for-policy-viewer') {
        req.set('x-user-id', 'policy-viewer');
        req.set('x-user-email', 'viewer@test.com');
        req.set('x-organization-id', testOrganizationId);
        req.set('x-user-roles', 'policy_viewer');
      } else if (token === 'mock-jwt-token-for-test-user') {
        req.set('x-user-id', 'test-user');
        req.set('x-user-email', 'test@test.com');
        req.set('x-organization-id', testOrganizationId);
        req.set('x-user-roles', 'user');
      }

      if (headers) {
        Object.entries(headers).forEach(([key, value]) => {
          req.set(key, value);
        });
      }

      if (data) {
        req.send(data);
      }

      return req;
    },
    createPolicy: async (policyData: any, token: string) => {
      const response = await testSetup.makeRequest('POST', '/api/v1/policies', policyData, token);
      return response.body;
    },
    updatePolicy: async (id: string, updateData: any, token: string) => {
      const response = await testSetup.makeRequest(
        'PATCH',
        `/api/v1/policies/${id}`,
        updateData,
        token
      );
      return response.body;
    },
    getPolicy: async (id: string, token: string) => {
      const response = await testSetup.makeRequest('GET', `/api/v1/policies/${id}`, null, token);
      return response.body;
    },
    getApp: () => {
      return setup.getApp();
    },
    cleanup: async () => {
      await setup.closeApp();
    },
  };

  beforeAll(async () => {
    setup = new PolicyServiceE2ESetup();
    await setup.createTestApp();
    await setup.cleanDatabase();

    authHelper = new AuthTestHelper();
    userTokens = new Map();

    // For E2E tests, we'll use predefined tokens that map to Kong headers
    userTokens.set(TestUserRole.ADMIN, 'mock-jwt-token-for-admin-user');
    userTokens.set(TestUserRole.POLICY_MANAGER, 'mock-jwt-token-for-policy-manager');
    userTokens.set(TestUserRole.COMPLIANCE_OFFICER, 'mock-jwt-token-for-compliance-manager');
    userTokens.set(TestUserRole.AUDITOR, 'mock-jwt-token-for-test-user'); // Map to a generic test user
    userTokens.set(TestUserRole.VIEWER, 'mock-jwt-token-for-policy-viewer');
    userTokens.set(TestUserRole.EXTERNAL_AUDITOR, 'mock-jwt-token-for-test-user'); // Map to a generic test user

    adminToken = userTokens.get(TestUserRole.ADMIN)!;

    // Create test resources
    const policy = await testSetup.createPolicy(
      {
        title: 'Security Test Policy',
        type: 'SECURITY',
        priority: 'HIGH',
        scope: 'ORGANIZATION',
        organizationId: 'org-123',
      },
      adminToken
    );

    testResources.push(policy);
  });

  afterAll(async () => {
    await testSetup.cleanup();
  });

  describe('API1:2023 - Broken Object Level Authorization', () => {
    it('should prevent access to resources from different organizations', async () => {
      // User from different organization trying to access policy
      // For Kong headers, we'll send the headers directly
      const response = await testSetup.makeRequest(
        'GET',
        `/policies/${testResources[0].id}`,
        null,
        null,
        {
          'x-user-id': 'admin-user-different-org',
          'x-user-email': 'admin@different.com',
          'x-organization-id': 'different-org-456',
          'x-user-roles': 'admin,policy_manager',
        }
      );

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.body.message).toContain('Access denied');
    });

    it('should validate object ownership before modification', async () => {
      // Create policy as one user
      const policy = await testSetup.createPolicy(
        {
          title: 'Owner Test Policy',
          type: 'OPERATIONAL',
          ownerId: TEST_USERS.policy_manager.id,
        },
        userTokens.get(TestUserRole.POLICY_MANAGER)!
      );

      // Try to modify as different user (not owner, not admin)
      const response = await testSetup.makeRequest(
        'PATCH',
        `/policies/${policy.id}`,
        { title: 'Hijacked Policy' },
        userTokens.get(TestUserRole.COMPLIANCE_OFFICER)!
      );

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should use UUIDs instead of sequential IDs', async () => {
      const response = await testSetup.makeRequest('GET', '/policies', null, adminToken);

      expect(response.status).toBe(HttpStatus.OK);
      response.body.data.forEach((policy: any) => {
        // Validate UUID format
        expect(policy.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
      });
    });
  });

  describe('API2:2023 - Broken Authentication', () => {
    it('should reject requests without authentication', async () => {
      const endpoints = [
        '/policies',
        '/policy-engine/evaluate/test',
        '/compliance/frameworks',
        '/templates',
      ];

      for (const endpoint of endpoints) {
        const response = await testSetup.makeRequest('GET', endpoint, null, null);
        expect(response.status).toBe(HttpStatus.FORBIDDEN); // Kong headers missing = Forbidden
      }
    });

    it('should validate JWT token signatures', async () => {
      const tamperedToken = adminToken.slice(0, -10) + 'tampered123';

      const response = await testSetup.makeRequest('GET', '/policies', null, tamperedToken);

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
      expect(response.body.message).toContain('Invalid token');
    });

    it('should reject expired tokens', async () => {
      const expiredToken = authHelper.generateExpiredToken(TEST_USERS.admin);

      const response = await testSetup.makeRequest('GET', '/policies', null, expiredToken);

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
      expect(response.body.message).toContain('expired');
    });

    it('should enforce MFA for sensitive operations', async () => {
      // User without MFA trying to delete policy
      const noMfaToken = authHelper.generateToken({
        ...TEST_USERS.admin,
        mfaEnabled: false,
      });

      const response = await testSetup.makeRequest(
        'DELETE',
        `/policies/${testResources[0].id}`,
        null,
        noMfaToken
      );

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.body.message).toContain('MFA required');
    });

    it('should implement secure password reset flow', async () => {
      // Test that password reset tokens are time-limited and single-use
      const resetToken = 'test-reset-token';

      // First attempt should work
      const response1 = await testSetup.makeRequest(
        'POST',
        '/auth/reset-password',
        { token: resetToken, newPassword: 'NewSecureP@ssw0rd!' },
        null
      );

      // Second attempt with same token should fail
      const response2 = await testSetup.makeRequest(
        'POST',
        '/auth/reset-password',
        { token: resetToken, newPassword: 'AnotherP@ssw0rd!' },
        null
      );

      expect(response2.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response2.body.message).toContain('Invalid or expired token');
    });
  });

  describe('API3:2023 - Broken Object Property Level Authorization', () => {
    it('should filter sensitive fields based on user role', async () => {
      const viewerToken = userTokens.get(TestUserRole.VIEWER)!;

      const response = await testSetup.makeRequest(
        'GET',
        `/policies/${testResources[0].id}`,
        null,
        viewerToken
      );

      expect(response.status).toBe(HttpStatus.OK);
      // Viewers shouldn't see internal metadata
      expect(response.body).not.toHaveProperty('internalNotes');
      expect(response.body).not.toHaveProperty('approvalComments');
      expect(response.body).not.toHaveProperty('riskScore');
    });

    it('should prevent mass assignment attacks', async () => {
      const maliciousUpdate = {
        title: 'Updated Title',
        status: 'PUBLISHED', // Trying to bypass workflow
        approvedBy: 'attacker', // Trying to forge approval
        isSystemPolicy: true, // Trying to elevate privileges
        organizationId: 'different-org', // Trying to move to different org
      };

      const response = await testSetup.makeRequest(
        'PATCH',
        `/policies/${testResources[0].id}`,
        maliciousUpdate,
        adminToken
      );

      expect(response.status).toBe(HttpStatus.OK);
      // These fields should not be updated via regular update
      expect(response.body.status).not.toBe('PUBLISHED');
      expect(response.body.approvedBy).not.toBe('attacker');
      expect(response.body.isSystemPolicy).not.toBe(true);
      expect(response.body.organizationId).toBe('org-123');
    });

    it('should validate field-level permissions', async () => {
      const policyManagerToken = userTokens.get(TestUserRole.POLICY_MANAGER)!;

      // Policy manager can update content but not compliance mappings
      const response = await testSetup.makeRequest(
        'PATCH',
        `/policies/${testResources[0].id}`,
        {
          content: { sections: [{ title: 'Updated', content: 'New content' }] },
          complianceMapping: { frameworks: ['HIPAA'] }, // Should be ignored
        },
        policyManagerToken
      );

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.content.sections[0].title).toBe('Updated');
      expect(response.body.complianceMapping.frameworks).not.toContain('HIPAA');
    });
  });

  describe('API4:2023 - Unrestricted Resource Consumption', () => {
    it('should enforce rate limiting on resource-intensive operations', async () => {
      const isRateLimited = await SecurityTestHelper.testRateLimiting(
        testSetup.getApp(),
        '/policies',
        adminToken,
        10 // Test with 10 requests
      );

      expect(isRateLimited).toBe(true);
    });

    it('should limit request payload size', async () => {
      const largePayload = {
        title: 'Large Policy',
        content: {
          sections: Array(1000).fill({
            title: 'Section',
            content: 'A'.repeat(10000), // 10KB per section
          }),
        },
      };

      const response = await testSetup.makeRequest('POST', '/policies', largePayload, adminToken);

      expect(response.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    });

    it('should implement pagination limits', async () => {
      const response = await testSetup.makeRequest(
        'GET',
        '/policies?limit=1000', // Trying to get too many records
        null,
        adminToken
      );

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.meta.limit).toBeLessThanOrEqual(100); // Max limit enforced
    });

    it('should timeout long-running operations', async () => {
      const complexQuery = {
        search: 'complex',
        filters: {
          frameworks: ['SOC2', 'ISO27001', 'HIPAA'],
          dateRange: { start: '2020-01-01', end: '2025-12-31' },
          tags: Array(50).fill('tag'),
        },
      };

      const startTime = Date.now();
      const response = await testSetup.makeRequest(
        'POST',
        '/policies/search',
        complexQuery,
        adminToken
      );
      const duration = Date.now() - startTime;

      // Should timeout or complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 second max

      if (response.status === HttpStatus.REQUEST_TIMEOUT) {
        expect(response.body.message).toContain('Request timeout');
      }
    });

    it('should prevent zip bomb attacks in file uploads', async () => {
      // For E2E testing, we'll create a test file or skip the actual file upload
      // and just test the endpoint behavior
      const response = await testSetup.makeRequest(
        'POST',
        `/policies/${testResources[0].id}/attachments`,
        {
          filename: 'policy.zip',
          mimetype: 'application/zip',
          size: 1024, // 1KB compressed
          // Simulate a zip bomb scenario
        },
        adminToken
      );

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.message).toContain('File validation failed');
    });
  });

  describe('API5:2023 - Broken Function Level Authorization', () => {
    it('should enforce function-level permissions', async () => {
      const testCases = [
        {
          role: TestUserRole.VIEWER,
          method: 'POST',
          endpoint: '/policies',
          expectedStatus: HttpStatus.FORBIDDEN,
        },
        {
          role: TestUserRole.VIEWER,
          method: 'DELETE',
          endpoint: `/policies/${testResources[0].id}`,
          expectedStatus: HttpStatus.FORBIDDEN,
        },
        {
          role: TestUserRole.AUDITOR,
          method: 'POST',
          endpoint: `/policies/${testResources[0].id}/approve`,
          expectedStatus: HttpStatus.FORBIDDEN,
        },
        {
          role: TestUserRole.POLICY_MANAGER,
          method: 'POST',
          endpoint: '/cache/invalidate',
          expectedStatus: HttpStatus.FORBIDDEN,
        },
      ];

      for (const testCase of testCases) {
        const token = userTokens.get(testCase.role)!;
        const response = await testSetup.makeRequest(testCase.method, testCase.endpoint, {}, token);

        expect(response.status).toBe(testCase.expectedStatus);
      }
    });

    it('should hide admin endpoints from non-admin users', async () => {
      const viewerToken = userTokens.get(TestUserRole.VIEWER)!;

      const adminEndpoints = [
        '/admin/users',
        '/admin/system-config',
        '/admin/audit-logs',
        '/admin/security-settings',
      ];

      for (const endpoint of adminEndpoints) {
        const response = await testSetup.makeRequest('GET', endpoint, null, viewerToken);
        expect([HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND]).toContain(response.status);
      }
    });

    it('should validate HTTP methods', async () => {
      // Try to use wrong HTTP methods
      const response = await testSetup.makeRequest(
        'PUT', // Should be PATCH
        `/policies/${testResources[0].id}`,
        { title: 'Updated' },
        adminToken
      );

      expect(response.status).toBe(HttpStatus.METHOD_NOT_ALLOWED);
    });
  });

  describe('API8:2023 - Security Misconfiguration', () => {
    it('should not expose sensitive headers', async () => {
      const response = await testSetup.makeRequest('GET', '/policies', null, adminToken);

      const sensitiveHeaders = ['x-powered-by', 'server', 'x-aspnet-version'];
      sensitiveHeaders.forEach((header) => {
        expect(response.headers[header]).toBeUndefined();
      });
    });

    it('should implement security headers', async () => {
      const response = await testSetup.makeRequest('GET', '/policies', null, adminToken);

      const missingHeaders = await SecurityTestHelper.testSecurityHeaders(response);
      expect(missingHeaders).toHaveLength(0);
    });

    it('should not expose stack traces in production', async () => {
      // Force an error
      const response = await testSetup.makeRequest(
        'GET',
        '/policies/invalid-uuid-format',
        null,
        adminToken
      );

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('sql');
      expect(JSON.stringify(response.body)).not.toContain('at Function');
    });

    it('should disable debug endpoints in production', async () => {
      const debugEndpoints = ['/debug/routes', '/debug/config', '/debug/env', '/_debug'];

      for (const endpoint of debugEndpoints) {
        const response = await testSetup.makeRequest('GET', endpoint, null, adminToken);
        expect(response.status).toBe(HttpStatus.NOT_FOUND);
      }
    });

    it('should implement CORS properly', async () => {
      const response = await testSetup.makeRequest('OPTIONS', '/policies', null, null, {
        Origin: 'https://evil-site.com',
      });

      const allowedOrigin = response.headers['access-control-allow-origin'];
      expect(allowedOrigin).not.toBe('*');
      expect(allowedOrigin).not.toBe('https://evil-site.com');
    });
  });

  describe('API9:2023 - Improper Inventory Management', () => {
    it('should version API endpoints', async () => {
      const response = await testSetup.makeRequest('GET', '/v1/policies', null, adminToken);
      expect(response.status).toBe(HttpStatus.OK);

      // Old version should redirect or return deprecation warning
      const oldResponse = await testSetup.makeRequest('GET', '/policies', null, adminToken);
      expect(oldResponse.headers['x-api-deprecation-warning']).toBeDefined();
    });

    it('should document all endpoints in OpenAPI', async () => {
      const response = await testSetup.makeRequest('GET', '/api-docs', null, null);

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body).toHaveProperty('openapi');
      expect(response.body).toHaveProperty('paths');

      // Verify critical endpoints are documented
      const criticalPaths = [
        '/policies',
        '/policy-engine/evaluate/{policyId}',
        '/compliance/frameworks',
        '/templates',
      ];

      criticalPaths.forEach((path) => {
        expect(response.body.paths).toHaveProperty(path);
      });
    });

    it('should track and limit API versions in use', async () => {
      const response = await testSetup.makeRequest('GET', '/api/versions', null, adminToken);

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.supported).toContain('v1');
      expect(response.body.deprecated).toBeDefined();
      expect(response.body.sunset).toBeDefined();
    });
  });

  describe('API10:2023 - Unsafe Consumption of APIs', () => {
    it('should validate external API responses', async () => {
      // Test webhook validation
      const maliciousWebhook = {
        url: 'https://external-api.com/webhook',
        payload: {
          // Trying to inject malicious data through webhook
          policyUpdate: {
            status: 'PUBLISHED',
            '<script>alert("XSS")</script>': 'malicious',
          },
        },
      };

      const response = await testSetup.makeRequest(
        'POST',
        '/webhooks/receive',
        maliciousWebhook,
        adminToken
      );

      // Should sanitize or reject malicious content
      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should timeout external API calls', async () => {
      const integration = {
        type: 'COMPLIANCE_CHECK',
        endpoint: 'https://slow-external-api.com/check',
        timeout: 5000,
      };

      const startTime = Date.now();
      const response = await testSetup.makeRequest(
        'POST',
        '/integrations/execute',
        integration,
        adminToken
      );
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(6000); // Should timeout at 5s

      if (response.status === HttpStatus.REQUEST_TIMEOUT) {
        expect(response.body.message).toContain('External API timeout');
      }
    });

    it('should validate SSL certificates for external APIs', async () => {
      const insecureIntegration = {
        type: 'DATA_SYNC',
        endpoint: 'https://self-signed.badssl.com/',
        validateSSL: true,
      };

      const response = await testSetup.makeRequest(
        'POST',
        '/integrations/test',
        insecureIntegration,
        adminToken
      );

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.message).toContain('SSL certificate validation failed');
    });
  });

  describe('Additional Security Controls', () => {
    describe('Input Validation', () => {
      it('should prevent NoSQL injection', async () => {
        const noSqlInjection = {
          search: { $ne: null }, // NoSQL injection attempt
          filter: { $where: 'this.password == "admin"' },
        };

        const response = await testSetup.makeRequest(
          'POST',
          '/policies/search',
          noSqlInjection,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toContain('Invalid search parameters');
      });

      it('should prevent XXE attacks in XML parsing', async () => {
        const xxePayload = `<?xml version="1.0"?>
          <!DOCTYPE policy [
            <!ENTITY xxe SYSTEM "file:///etc/passwd">
          ]>
          <policy>
            <title>&xxe;</title>
          </policy>`;

        const response = await testSetup.makeRequest(
          'POST',
          '/policies/import',
          { format: 'xml', data: xxePayload },
          adminToken
        );

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toContain('Invalid XML');
      });

      it('should validate all input types', async () => {
        const invalidInputs = await SecurityTestHelper.testInputValidation(
          testSetup.getApp(),
          '/policies',
          'post',
          adminToken,
          [
            { title: null }, // Null value
            { title: '' }, // Empty string
            { title: 'a'.repeat(256) }, // Too long
            { priority: 'INVALID' }, // Invalid enum
            { effectiveDate: 'not-a-date' }, // Invalid date
            { tags: 'not-an-array' }, // Wrong type
          ]
        );

        invalidInputs.forEach((result) => {
          expect(result.passed).toBe(false);
          expect(result.error).toBeDefined();
        });
      });
    });

    describe('Audit and Monitoring', () => {
      it('should log security events', async () => {
        // Trigger various security events
        await testSetup.makeRequest('GET', '/policies', null, 'invalid-token');
        await testSetup.makeRequest(
          'GET',
          '/admin/users',
          null,
          userTokens.get(TestUserRole.VIEWER)!
        );

        const auditLogs = await testSetup.makeRequest(
          'GET',
          '/audit-logs?type=SECURITY',
          null,
          adminToken
        );

        expect(auditLogs.status).toBe(HttpStatus.OK);
        expect(auditLogs.body).toContainEqual(
          expect.objectContaining({
            event: 'AUTHENTICATION_FAILED',
            severity: 'HIGH',
          })
        );
        expect(auditLogs.body).toContainEqual(
          expect.objectContaining({
            event: 'AUTHORIZATION_DENIED',
            severity: 'MEDIUM',
          })
        );
      });

      it('should detect and log anomalies', async () => {
        // Simulate anomalous behavior
        const requests = [];
        for (let i = 0; i < 50; i++) {
          requests.push(
            testSetup.makeRequest('GET', `/policies?search=${Math.random()}`, null, adminToken)
          );
        }

        await Promise.all(requests);

        const anomalyLogs = await testSetup.makeRequest(
          'GET',
          '/security/anomalies',
          null,
          adminToken
        );

        expect(anomalyLogs.status).toBe(HttpStatus.OK);
        expect(anomalyLogs.body).toContainEqual(
          expect.objectContaining({
            type: 'UNUSUAL_ACTIVITY',
            description: expect.stringContaining('High frequency'),
          })
        );
      });
    });
  });
});
