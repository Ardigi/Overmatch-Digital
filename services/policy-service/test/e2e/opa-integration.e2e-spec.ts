// Ensure TypeORM is not mocked in E2E tests
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import { HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { PolicyServiceE2ESetup } from './setup';

describe('OPA Integration E2E Tests', () => {
  let setup: PolicyServiceE2ESetup;
  let adminToken: string;
  let testPolicy: any;
  let opaPolicy: any;
  const testOrganizationId: string = 'test-org-1';

  // Helper object to maintain compatibility with old test structure
  const testSetup = {
    makeRequest: (method: string, url: string, data?: any, token?: string) => {
      const req = request(setup.getHttpServer())[method.toLowerCase()](url);

      // Set Kong headers based on token
      if (token === 'admin-token') {
        req.set('x-user-id', 'admin-user');
        req.set('x-user-email', 'admin@test.com');
        req.set('x-organization-id', testOrganizationId);
        req.set('x-user-roles', 'admin,policy_manager');
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
    uploadFile: (
      endpoint: string,
      filePath: string,
      fieldName: string,
      token: string,
      additionalFields?: any
    ) => {
      const req = request(setup.getHttpServer()).post(endpoint).attach(fieldName, filePath);

      if (token === 'admin-token') {
        req.set('x-user-id', 'admin-user');
        req.set('x-user-email', 'admin@test.com');
        req.set('x-organization-id', testOrganizationId);
        req.set('x-user-roles', 'admin,policy_manager');
      }

      if (additionalFields) {
        Object.entries(additionalFields).forEach(([key, value]) => {
          req.field(key, value as any);
        });
      }

      return req;
    },
    evaluatePolicy: async (policyId: string, context: any, token: string) => {
      const response = await testSetup.makeRequest(
        'POST',
        `/api/v1/policies/${policyId}/evaluate`,
        context,
        token
      );
      return response.body;
    },
    cleanup: async () => {
      await setup.closeApp();
    },
  };

  beforeAll(async () => {
    setup = new PolicyServiceE2ESetup();
    await setup.createTestApp();
    await setup.cleanDatabase();

    // For E2E tests, we use mock tokens with Kong headers
    adminToken = 'admin-token';

    // Create a test policy with OPA rules
    testPolicy = await testSetup.createPolicy(
      {
        title: 'Data Access Control Policy',
        type: 'SECURITY',
        priority: 'HIGH',
        scope: 'ORGANIZATION',
        content: {
          sections: [
            {
              title: 'Access Rules',
              content: 'Defines data access based on classification and user roles',
            },
          ],
        },
        opaPolicy: {
          package: 'data.access.control',
          rules: [
            {
              name: 'allow_read',
              description: 'Allow read access based on data classification',
              rego: `
                allow_read {
                  input.action == "read"
                  input.user.clearance_level >= data.classifications[input.resource.classification].required_level
                }
              `,
            },
            {
              name: 'allow_write',
              description: 'Allow write access for data owners',
              rego: `
                allow_write {
                  input.action == "write"
                  input.user.id == input.resource.owner_id
                }
              `,
            },
          ],
        },
      },
      adminToken
    );
  });

  describe('OPA Policy Management', () => {
    describe('POST /policies/:id/opa-policy', () => {
      it('should compile and upload Rego policy to OPA', async () => {
        const regoPolicy = {
          package: 'soc2.data.protection',
          description: 'SOC 2 data protection controls',
          rules: `
            package soc2.data.protection

            default allow = false

            # CC6.1 - Logical Access Controls
            allow {
              input.action in ["read", "write"]
              input.user.authenticated == true
              input.user.roles[_] in data.allowed_roles[input.resource.type]
            }

            # CC6.7 - Data Transmission Security
            require_encryption {
              input.resource.classification in ["confidential", "restricted"]
              input.transmission_method != "encrypted"
            }

            # CC9.1 - Data Confidentiality
            data_classification[resource_id] = level {
              resource := data.resources[resource_id]
              level := resource.classification
            }

            # Compliance score calculation
            compliance_score = score {
              total_controls := count(data.soc2_controls)
              implemented := count([c | c := data.soc2_controls[_]; c.status == "implemented"])
              score := implemented / total_controls
            }
          `,
        };

        const response = await testSetup.makeRequest(
          'POST',
          `/policies/${testPolicy.id}/opa-policy`,
          regoPolicy,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.CREATED);
        expect(response.body).toMatchObject({
          policyId: testPolicy.id,
          package: regoPolicy.package,
          status: 'active',
          compiledAt: expect.any(String),
          version: expect.any(String),
        });

        opaPolicy = response.body;
      });

      it('should validate Rego syntax before upload', async () => {
        const invalidRego = {
          package: 'invalid.policy',
          rules: `
            package invalid.policy
            
            # Missing closing brace
            allow {
              input.user.authenticated == true
          `,
        };

        const response = await testSetup.makeRequest(
          'POST',
          `/policies/${testPolicy.id}/opa-policy`,
          invalidRego,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toContain('syntax error');
        expect(response.body.details).toHaveProperty('line');
        expect(response.body.details).toHaveProperty('column');
      });

      it('should version OPA policies', async () => {
        const updatedRego = {
          package: 'soc2.data.protection',
          rules: `
            package soc2.data.protection
            
            default allow = false
            
            # Updated rule with additional check
            allow {
              input.action in ["read", "write"]
              input.user.authenticated == true
              input.user.mfa_verified == true  # New requirement
              input.user.roles[_] in data.allowed_roles[input.resource.type]
            }
          `,
        };

        const response = await testSetup.makeRequest(
          'POST',
          `/policies/${testPolicy.id}/opa-policy`,
          updatedRego,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.CREATED);
        expect(response.body.version).not.toBe(opaPolicy.version);
        expect(response.body.previousVersion).toBe(opaPolicy.version);
      });
    });

    describe('GET /policies/:id/opa-policy', () => {
      it('should retrieve current OPA policy', async () => {
        const response = await testSetup.makeRequest(
          'GET',
          `/policies/${testPolicy.id}/opa-policy`,
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toHaveProperty('package');
        expect(response.body).toHaveProperty('rules');
        expect(response.body).toHaveProperty('version');
        expect(response.body).toHaveProperty('compiledAt');
      });

      it('should include policy metadata', async () => {
        const response = await testSetup.makeRequest(
          'GET',
          `/policies/${testPolicy.id}/opa-policy?include=metadata`,
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.metadata).toMatchObject({
          author: expect.any(String),
          lastModified: expect.any(String),
          dependencies: expect.any(Array),
          dataRequirements: expect.any(Array),
        });
      });
    });

    describe('GET /policies/:id/opa-policy/versions', () => {
      it('should list all OPA policy versions', async () => {
        const response = await testSetup.makeRequest(
          'GET',
          `/policies/${testPolicy.id}/opa-policy/versions`,
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body[0]).toMatchObject({
          version: expect.any(String),
          createdAt: expect.any(String),
          createdBy: expect.any(String),
          changeDescription: expect.any(String),
        });
      });
    });

    describe('POST /policies/:id/opa-policy/rollback', () => {
      it('should rollback to a previous OPA policy version', async () => {
        const versions = await testSetup.makeRequest(
          'GET',
          `/policies/${testPolicy.id}/opa-policy/versions`,
          null,
          adminToken
        );

        const previousVersion = versions.body[1]; // Second most recent

        const response = await testSetup.makeRequest(
          'POST',
          `/policies/${testPolicy.id}/opa-policy/rollback`,
          {
            version: previousVersion.version,
            reason: 'New version causing false positives',
          },
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.version).toBe(previousVersion.version);
        expect(response.body.rollbackReason).toBe('New version causing false positives');
      });
    });
  });

  describe('Policy Evaluation', () => {
    describe('POST /policy-engine/evaluate', () => {
      it('should evaluate policy decision with context', async () => {
        const context = {
          user: {
            id: 'user-123',
            roles: ['employee', 'data_analyst'],
            clearance_level: 2,
            authenticated: true,
            mfa_verified: true,
          },
          resource: {
            id: 'doc-456',
            type: 'document',
            classification: 'confidential',
            owner_id: 'user-789',
          },
          action: 'read',
          environment: {
            ip_address: '10.0.0.1',
            time: new Date().toISOString(),
            location: 'office',
          },
        };

        const response = await testSetup.makeRequest(
          'POST',
          '/policy-engine/evaluate',
          {
            policyId: testPolicy.id,
            context,
          },
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          decision: expect.stringMatching(/^(allow|deny)$/),
          reasons: expect.any(Array),
          appliedRules: expect.any(Array),
          evaluationTime: expect.any(Number),
          policyVersion: expect.any(String),
        });
      });

      it('should include compliance requirements in decision', async () => {
        const context = {
          user: {
            id: 'user-123',
            roles: ['employee'],
            authenticated: true,
          },
          resource: {
            type: 'pii_data',
            classification: 'restricted',
            regulations: ['GDPR', 'CCPA'],
          },
          action: 'export',
        };

        const response = await testSetup.makeRequest(
          'POST',
          '/policy-engine/evaluate',
          {
            policyId: testPolicy.id,
            context,
            includeCompliance: true,
          },
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.complianceRequirements).toMatchObject({
          GDPR: expect.any(Object),
          CCPA: expect.any(Object),
        });
        expect(['compliant', 'non_compliant']).toContain(response.body.complianceStatus);
      });

      it('should handle partial policy evaluation', async () => {
        const context = {
          user: {
            id: 'user-123',
            roles: ['employee'],
          },
          action: 'read',
          // Missing resource information
        };

        const response = await testSetup.makeRequest(
          'POST',
          '/policy-engine/evaluate',
          {
            policyId: testPolicy.id,
            context,
            partial: true,
          },
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          decision: 'unknown',
          missingData: expect.arrayContaining(['resource']),
          partialResult: expect.any(Object),
        });
      });

      it('should support batch evaluation', async () => {
        const contexts = [
          {
            user: { id: 'user-1', roles: ['admin'] },
            resource: { type: 'document', classification: 'public' },
            action: 'read',
          },
          {
            user: { id: 'user-2', roles: ['viewer'] },
            resource: { type: 'document', classification: 'confidential' },
            action: 'write',
          },
          {
            user: { id: 'user-3', roles: ['editor'] },
            resource: { type: 'document', classification: 'internal' },
            action: 'update',
          },
        ];

        const response = await testSetup.makeRequest(
          'POST',
          '/policy-engine/evaluate/batch',
          {
            policyId: testPolicy.id,
            contexts,
          },
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.results).toHaveLength(3);
        expect(response.body.summary).toMatchObject({
          total: 3,
          allowed: expect.any(Number),
          denied: expect.any(Number),
          errors: expect.any(Number),
        });
      });
    });

    describe('POST /policy-engine/test', () => {
      it('should test policy with predefined scenarios', async () => {
        const testScenarios = {
          scenarios: [
            {
              name: 'Admin can read all documents',
              context: {
                user: { roles: ['admin'], authenticated: true },
                resource: { type: 'document', classification: 'restricted' },
                action: 'read',
              },
              expectedDecision: 'allow',
            },
            {
              name: 'Guest cannot access confidential data',
              context: {
                user: { roles: ['guest'], authenticated: false },
                resource: { type: 'document', classification: 'confidential' },
                action: 'read',
              },
              expectedDecision: 'deny',
            },
            {
              name: 'Data owner can modify their data',
              context: {
                user: { id: 'user-123', roles: ['employee'], authenticated: true },
                resource: { type: 'document', owner_id: 'user-123' },
                action: 'write',
              },
              expectedDecision: 'allow',
            },
          ],
        };

        const response = await testSetup.makeRequest(
          'POST',
          `/policy-engine/test/${testPolicy.id}`,
          testScenarios,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          totalScenarios: 3,
          passed: expect.any(Number),
          failed: expect.any(Number),
          results: expect.arrayContaining([
            expect.objectContaining({
              scenario: expect.any(String),
              passed: expect.any(Boolean),
              actualDecision: expect.any(String),
              expectedDecision: expect.any(String),
            }),
          ]),
        });
      });
    });

    describe('GET /policy-engine/explain/:policyId', () => {
      it('should explain policy logic in human-readable format', async () => {
        const response = await testSetup.makeRequest(
          'GET',
          `/policy-engine/explain/${testPolicy.id}`,
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          policyId: testPolicy.id,
          description: expect.any(String),
          rules: expect.arrayContaining([
            expect.objectContaining({
              name: expect.any(String),
              description: expect.any(String),
              conditions: expect.any(Array),
              effect: expect.stringMatching(/^(allow|deny)$/),
            }),
          ]),
          dataRequirements: expect.any(Array),
          examples: expect.any(Array),
        });
      });
    });
  });

  describe('OPA Data Management', () => {
    describe('POST /policy-engine/data', () => {
      it('should push data to OPA for policy evaluation', async () => {
        const data = {
          path: 'soc2_controls',
          value: {
            'CC6.1': {
              name: 'Logical Access Controls',
              status: 'implemented',
              evidence: ['access-logs', 'rbac-config'],
            },
            'CC6.7': {
              name: 'Data Transmission Security',
              status: 'implemented',
              evidence: ['tls-config', 'encryption-audit'],
            },
            'CC9.1': {
              name: 'Data Confidentiality',
              status: 'partial',
              evidence: ['classification-policy'],
            },
          },
        };

        const response = await testSetup.makeRequest(
          'POST',
          '/policy-engine/data',
          data,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.CREATED);
        expect(response.body).toMatchObject({
          path: data.path,
          version: expect.any(String),
          timestamp: expect.any(String),
        });
      });

      it('should support bulk data updates', async () => {
        const bulkData = [
          {
            path: 'users',
            value: {
              'user-123': { roles: ['admin'], clearance: 3 },
              'user-456': { roles: ['employee'], clearance: 1 },
            },
          },
          {
            path: 'resources',
            value: {
              'doc-789': { classification: 'confidential', owner: 'user-123' },
              'doc-101': { classification: 'public', owner: 'user-456' },
            },
          },
        ];

        const response = await testSetup.makeRequest(
          'POST',
          '/policy-engine/data/bulk',
          { updates: bulkData },
          adminToken
        );

        expect(response.status).toBe(HttpStatus.CREATED);
        expect(response.body.results).toHaveLength(2);
        expect(response.body.results[0].status).toBe('success');
      });
    });

    describe('GET /policy-engine/data/:path', () => {
      it('should retrieve data from OPA', async () => {
        const response = await testSetup.makeRequest(
          'GET',
          '/policy-engine/data/soc2_controls',
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toHaveProperty('result');
        expect(response.body.result).toHaveProperty('CC6.1');
      });
    });

    describe('DELETE /policy-engine/data/:path', () => {
      it('should remove data from OPA', async () => {
        // First add test data
        await testSetup.makeRequest(
          'POST',
          '/policy-engine/data',
          {
            path: 'test_data',
            value: { temp: 'data' },
          },
          adminToken
        );

        // Then delete it
        const response = await testSetup.makeRequest(
          'DELETE',
          '/policy-engine/data/test_data',
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.NO_CONTENT);

        // Verify it's gone
        const getResponse = await testSetup.makeRequest(
          'GET',
          '/policy-engine/data/test_data',
          null,
          adminToken
        );

        expect(getResponse.status).toBe(HttpStatus.NOT_FOUND);
      });
    });
  });

  describe('Policy Decision Logging', () => {
    describe('GET /policy-engine/decisions', () => {
      it('should retrieve policy decision history', async () => {
        // Make some policy evaluations first
        const contexts = [
          {
            user: { id: 'user-1', roles: ['admin'] },
            resource: { type: 'document' },
            action: 'read',
          },
          {
            user: { id: 'user-2', roles: ['guest'] },
            resource: { type: 'document' },
            action: 'write',
          },
        ];

        for (const context of contexts) {
          await testSetup.makeRequest(
            'POST',
            '/policy-engine/evaluate',
            { policyId: testPolicy.id, context },
            adminToken
          );
        }

        const response = await testSetup.makeRequest(
          'GET',
          `/policy-engine/decisions?policyId=${testPolicy.id}`,
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data[0]).toMatchObject({
          id: expect.any(String),
          policyId: testPolicy.id,
          decision: expect.stringMatching(/^(allow|deny)$/),
          context: expect.any(Object),
          timestamp: expect.any(String),
          evaluationTime: expect.any(Number),
        });
      });

      it('should filter decisions by outcome', async () => {
        const response = await testSetup.makeRequest(
          'GET',
          '/policy-engine/decisions?decision=deny',
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        response.body.data.forEach((decision: any) => {
          expect(decision.decision).toBe('deny');
        });
      });

      it('should provide decision analytics', async () => {
        const response = await testSetup.makeRequest(
          'GET',
          `/policy-engine/decisions/analytics?policyId=${testPolicy.id}`,
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          totalDecisions: expect.any(Number),
          allowCount: expect.any(Number),
          denyCount: expect.any(Number),
          averageEvaluationTime: expect.any(Number),
          topDenyReasons: expect.any(Array),
          decisionsByHour: expect.any(Object),
          decisionsByUser: expect.any(Object),
        });
      });
    });
  });

  describe('Policy Templates', () => {
    describe('GET /policy-engine/templates', () => {
      it('should list available OPA policy templates', async () => {
        const response = await testSetup.makeRequest(
          'GET',
          '/policy-engine/templates',
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body).toContainEqual(
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            description: expect.any(String),
            category: expect.any(String),
            compliance: expect.any(Array),
            parameters: expect.any(Array),
          })
        );
      });
    });

    describe('POST /policy-engine/templates/:templateId/generate', () => {
      it('should generate OPA policy from template', async () => {
        const parameters = {
          allowedRoles: ['admin', 'security_officer'],
          requiredClearanceLevel: 2,
          allowedActions: ['read', 'audit'],
          dataClassifications: ['public', 'internal', 'confidential'],
        };

        const response = await testSetup.makeRequest(
          'POST',
          '/policy-engine/templates/soc2-access-control/generate',
          parameters,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          package: expect.any(String),
          rules: expect.any(String),
          metadata: expect.any(Object),
        });
        expect(response.body.rules).toContain('allowedRoles');
        expect(response.body.rules).toContain('requiredClearanceLevel');
      });
    });
  });

  describe('Performance and Optimization', () => {
    it('should evaluate policies within performance SLA', async () => {
      const context = {
        user: { id: 'perf-test', roles: ['employee'] },
        resource: { type: 'document', classification: 'internal' },
        action: 'read',
      };

      const times: number[] = [];

      // Warm up
      for (let i = 0; i < 10; i++) {
        await testSetup.evaluatePolicy(testPolicy.id, context, adminToken);
      }

      // Measure
      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        await testSetup.evaluatePolicy(testPolicy.id, context, adminToken);
        const end = Date.now();
        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

      expect(avgTime).toBeLessThan(10); // Average under 10ms
      expect(p95Time).toBeLessThan(20); // 95th percentile under 20ms
    });

    it('should handle concurrent policy evaluations', async () => {
      const contexts = [];
      for (let i = 0; i < 50; i++) {
        contexts.push({
          user: { id: `user-${i}`, roles: ['employee'] },
          resource: { type: 'document', classification: 'internal' },
          action: 'read',
        });
      }

      const start = Date.now();
      const promises = contexts.map((ctx) =>
        testSetup.evaluatePolicy(testPolicy.id, ctx, adminToken)
      );

      const results = await Promise.all(promises);
      const end = Date.now();

      expect(results).toHaveLength(50);
      expect(end - start).toBeLessThan(1000); // All 50 in under 1 second

      // All should succeed
      results.forEach((result) => {
        expect(result).toHaveProperty('decision');
      });
    });

    it('should cache policy compilation results', async () => {
      // First evaluation (cold)
      const start1 = Date.now();
      await testSetup.evaluatePolicy(testPolicy.id, { user: {}, action: 'read' }, adminToken);
      const time1 = Date.now() - start1;

      // Second evaluation (should be cached)
      const start2 = Date.now();
      await testSetup.evaluatePolicy(testPolicy.id, { user: {}, action: 'read' }, adminToken);
      const time2 = Date.now() - start2;

      // Cached should be significantly faster
      expect(time2).toBeLessThan(time1 * 0.5);
    });
  });

  describe('Integration with Policy Service', () => {
    it('should sync policy status with OPA availability', async () => {
      const response = await testSetup.makeRequest(
        'GET',
        `/policies/${testPolicy.id}/opa-status`,
        null,
        adminToken
      );

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body).toMatchObject({
        policyId: testPolicy.id,
        opaStatus: 'active',
        lastSync: expect.any(String),
        evaluationEndpoint: expect.any(String),
        metrics: {
          totalEvaluations: expect.any(Number),
          averageLatency: expect.any(Number),
          errorRate: expect.any(Number),
        },
      });
    });

    it('should handle OPA service failures gracefully', async () => {
      // Simulate OPA being unavailable
      // In real test, this would stop OPA service temporarily

      const context = {
        user: { id: 'test', roles: ['admin'] },
        action: 'read',
      };

      const response = await testSetup.makeRequest(
        'POST',
        '/policy-engine/evaluate',
        {
          policyId: testPolicy.id,
          context,
          fallbackMode: true,
        },
        adminToken
      );

      // Should fallback to default decision or cached result
      expect([HttpStatus.OK, HttpStatus.SERVICE_UNAVAILABLE]).toContain(response.status);

      if (response.status === HttpStatus.OK) {
        expect(response.body.fallbackUsed).toBe(true);
        expect(response.body.decision).toBe('deny'); // Conservative default
      }
    });
  });

  afterAll(async () => {
    await testSetup.cleanup();
  });
});
