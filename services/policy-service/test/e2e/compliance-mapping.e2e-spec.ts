// Ensure TypeORM is not mocked in E2E tests
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import { HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { PolicyServiceE2ESetup } from './setup';

describe('Compliance Mapping E2E Tests', () => {
  let setup: PolicyServiceE2ESetup;
  let adminToken: string;
  let complianceManagerToken: string;
  let testPolicy: any;
  let frameworks: any;
  let controls: any;
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
      } else if (token === 'compliance-token') {
        req.set('x-user-id', 'compliance-user');
        req.set('x-user-email', 'compliance@test.com');
        req.set('x-organization-id', testOrganizationId);
        req.set('x-user-roles', 'compliance_manager');
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
    complianceManagerToken = 'compliance-token';

    // Set up compliance frameworks and controls
    await setupComplianceFrameworks();
    await setupComplianceControls();

    // Create a test policy for mapping
    testPolicy = await createTestPolicyWithMapping();
  });

  async function setupComplianceFrameworks() {
    frameworks = {
      SOC2: {
        id: 'soc2-2022',
        name: 'SOC 2 Type II',
        version: '2022',
        description: 'Service Organization Control 2',
        categories: ['CC', 'A', 'C', 'P', 'PI'],
        trustServicesCriteria: {
          CC: 'Common Criteria',
          A: 'Availability',
          C: 'Confidentiality',
          P: 'Privacy',
          PI: 'Processing Integrity',
        },
      },
      ISO27001: {
        id: 'iso27001-2022',
        name: 'ISO/IEC 27001:2022',
        version: '2022',
        description: 'Information Security Management Systems',
        clauses: ['A.5', 'A.6', 'A.7', 'A.8', 'A.9', 'A.10', 'A.11', 'A.12', 'A.13', 'A.14'],
      },
      NIST: {
        id: 'nist-csf-2.0',
        name: 'NIST Cybersecurity Framework',
        version: '2.0',
        description: 'Framework for Improving Critical Infrastructure Cybersecurity',
        functions: ['Identify', 'Protect', 'Detect', 'Respond', 'Recover'],
      },
      GDPR: {
        id: 'gdpr-2016',
        name: 'General Data Protection Regulation',
        version: '2016/679',
        description: 'EU data protection and privacy regulation',
        articles: Array.from({ length: 99 }, (_, i) => `Article ${i + 1}`),
      },
    };

    // Create frameworks via API
    for (const [key, framework] of Object.entries(frameworks)) {
      const response = await testSetup.makeRequest('POST', '/frameworks', framework, adminToken);
      frameworks[key] = response.body;
    }
  }

  async function setupComplianceControls() {
    controls = {
      // SOC 2 Controls
      'CC6.1': {
        frameworkId: frameworks.SOC2.id,
        controlId: 'CC6.1',
        title: 'Logical Access Controls',
        description: 'The entity implements logical access security measures',
        category: 'CC',
        requirements: [
          'Unique user identification',
          'Authentication before access',
          'Authorization based on roles',
          'Prevention of unauthorized access',
        ],
        testingGuidance: 'Review access control lists and test authentication',
      },
      'CC6.6': {
        frameworkId: frameworks.SOC2.id,
        controlId: 'CC6.6',
        title: 'Logical Access Security Measures',
        description: 'The entity implements logical access security software',
        category: 'CC',
        requirements: ['Password policies', 'Account lockout', 'Session management'],
      },
      'CC7.1': {
        frameworkId: frameworks.SOC2.id,
        controlId: 'CC7.1',
        title: 'Security Event Logging and Monitoring',
        description: 'System security events are logged and monitored',
        category: 'CC',
        requirements: ['Comprehensive logging', 'Log protection', 'Regular review'],
      },
      // ISO 27001 Controls
      'A.9.1.1': {
        frameworkId: frameworks.ISO27001.id,
        controlId: 'A.9.1.1',
        title: 'Access control policy',
        description: 'An access control policy should be established',
        clause: 'A.9',
        requirements: ['Documented policy', 'Business requirements', 'Regular review'],
      },
      'A.9.2.1': {
        frameworkId: frameworks.ISO27001.id,
        controlId: 'A.9.2.1',
        title: 'User registration and de-registration',
        description: 'Formal user registration and de-registration procedure',
        clause: 'A.9',
      },
      // NIST Controls
      'AC-1': {
        frameworkId: frameworks.NIST.id,
        controlId: 'AC-1',
        title: 'Access Control Policy and Procedures',
        description: 'Develop, document, and disseminate access control policy',
        function: 'Protect',
        subcategory: 'PR.AC',
      },
      'AC-2': {
        frameworkId: frameworks.NIST.id,
        controlId: 'AC-2',
        title: 'Account Management',
        description: 'Manage information system accounts',
        function: 'Protect',
        subcategory: 'PR.AC',
      },
    };

    // Create controls via API
    for (const [key, control] of Object.entries(controls)) {
      const response = await testSetup.makeRequest('POST', '/controls', control, adminToken);
      controls[key] = response.body;
    }
  }

  async function createTestPolicyWithMapping() {
    return await testSetup.createPolicy(
      {
        title: 'Access Control Policy',
        type: 'SECURITY',
        priority: 'HIGH',
        scope: 'ORGANIZATION',
        content: {
          sections: [
            {
              title: 'Purpose',
              content: 'To establish access control requirements for all systems',
            },
            {
              title: 'User Access Management',
              content: 'All users must be uniquely identified and authenticated',
            },
            {
              title: 'Access Reviews',
              content: 'User access rights must be reviewed quarterly',
            },
          ],
        },
        complianceMapping: {
          frameworks: ['SOC2', 'ISO27001', 'NIST'],
          controls: ['CC6.1', 'CC6.6', 'A.9.1.1', 'AC-1', 'AC-2'],
        },
      },
      adminToken
    );
  }

  describe('Framework Management', () => {
    describe('GET /frameworks', () => {
      it('should list all compliance frameworks', async () => {
        const response = await testSetup.makeRequest('GET', '/frameworks', null, adminToken);

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body).toContainEqual(
          expect.objectContaining({
            id: expect.any(String),
            name: 'SOC 2 Type II',
            version: '2022',
          })
        );
      });

      it('should include control counts', async () => {
        const response = await testSetup.makeRequest(
          'GET',
          '/frameworks?includeControlCount=true',
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        response.body.forEach((framework: any) => {
          expect(framework).toHaveProperty('controlCount');
          expect(framework.controlCount).toBeGreaterThanOrEqual(0);
        });
      });
    });

    describe('GET /frameworks/:id', () => {
      it('should get framework details with controls', async () => {
        const response = await testSetup.makeRequest(
          'GET',
          `/frameworks/${frameworks.SOC2.id}?includeControls=true`,
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          id: frameworks.SOC2.id,
          name: 'SOC 2 Type II',
          controls: expect.arrayContaining([
            expect.objectContaining({
              controlId: 'CC6.1',
              title: 'Logical Access Controls',
            }),
          ]),
        });
      });
    });

    describe('POST /frameworks/:id/import', () => {
      it('should import framework controls from standard library', async () => {
        const response = await testSetup.makeRequest(
          'POST',
          `/frameworks/${frameworks.SOC2.id}/import`,
          {
            source: 'official',
            includeGuidance: true,
            overwriteExisting: false,
          },
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          frameworkId: frameworks.SOC2.id,
          imported: expect.any(Number),
          updated: expect.any(Number),
          skipped: expect.any(Number),
          errors: expect.any(Array),
        });
      });
    });
  });

  describe('Control Management', () => {
    describe('GET /controls', () => {
      it('should list controls with filtering', async () => {
        const response = await testSetup.makeRequest(
          'GET',
          '/controls?framework=SOC2&category=CC',
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.data).toBeInstanceOf(Array);
        response.body.data.forEach((control: any) => {
          expect(control.frameworkId).toBe(frameworks.SOC2.id);
          expect(control.category).toBe('CC');
        });
      });

      it('should search controls by keyword', async () => {
        const response = await testSetup.makeRequest(
          'GET',
          '/controls?search=access',
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.data.length).toBeGreaterThan(0);
        response.body.data.forEach((control: any) => {
          const hasKeyword =
            control.title.toLowerCase().includes('access') ||
            control.description.toLowerCase().includes('access');
          expect(hasKeyword).toBe(true);
        });
      });
    });

    describe('POST /controls/:id/evidence', () => {
      it('should link evidence to a control', async () => {
        const evidence = {
          type: 'document',
          title: 'Access Control Matrix',
          description: 'Current access control configuration',
          location: 's3://evidence/access-control-matrix.xlsx',
          collectedDate: new Date().toISOString(),
          validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        };

        const response = await testSetup.makeRequest(
          'POST',
          `/controls/${controls['CC6.1'].id}/evidence`,
          evidence,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.CREATED);
        expect(response.body).toMatchObject({
          controlId: controls['CC6.1'].id,
          evidence: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              title: evidence.title,
              status: 'pending_review',
            }),
          ]),
        });
      });
    });
  });

  describe('Policy Compliance Mapping', () => {
    describe('GET /policies/:id/compliance-mapping', () => {
      it('should return detailed compliance mapping', async () => {
        const response = await testSetup.makeRequest(
          'GET',
          `/policies/${testPolicy.id}/compliance-mapping`,
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          policyId: testPolicy.id,
          frameworks: expect.arrayContaining([
            expect.objectContaining({
              id: frameworks.SOC2.id,
              name: 'SOC 2 Type II',
              controlCount: expect.any(Number),
              mappedControls: expect.any(Number),
            }),
          ]),
          controls: expect.arrayContaining([
            expect.objectContaining({
              controlId: 'CC6.1',
              framework: 'SOC2',
              mappingStrength: expect.stringMatching(/^(strong|moderate|weak)$/),
              gaps: expect.any(Array),
            }),
          ]),
          overallCoverage: expect.any(Number),
          unmappedRequirements: expect.any(Array),
        });
      });
    });

    describe('POST /policies/:id/compliance-mapping', () => {
      it('should update policy compliance mapping', async () => {
        const newMapping = {
          frameworks: ['SOC2', 'ISO27001', 'NIST', 'GDPR'],
          controls: ['CC6.1', 'CC7.1', 'A.9.1.1', 'A.9.2.1', 'AC-1', 'AC-2'],
          mappingDetails: {
            'CC6.1': {
              implementation: 'Section 2 covers user access management',
              strength: 'strong',
              notes: 'Fully addresses all requirements',
            },
            'CC7.1': {
              implementation: 'Logging requirements in Appendix A',
              strength: 'moderate',
              notes: 'Need to add log retention policy',
            },
          },
        };

        const response = await testSetup.makeRequest(
          'PATCH',
          `/policies/${testPolicy.id}/compliance-mapping`,
          newMapping,
          complianceManagerToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.complianceMapping).toMatchObject({
          frameworks: expect.arrayContaining(newMapping.frameworks),
          controls: expect.arrayContaining(newMapping.controls),
        });
      });

      it('should validate control-framework relationships', async () => {
        const invalidMapping = {
          frameworks: ['SOC2'],
          controls: ['A.9.1.1'], // ISO control, not SOC2
        };

        const response = await testSetup.makeRequest(
          'PATCH',
          `/policies/${testPolicy.id}/compliance-mapping`,
          invalidMapping,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toContain(
          'Control A.9.1.1 does not belong to framework SOC2'
        );
      });
    });

    describe('POST /policies/:id/compliance-mapping/analyze', () => {
      it('should analyze policy content for compliance mapping suggestions', async () => {
        const response = await testSetup.makeRequest(
          'POST',
          `/policies/${testPolicy.id}/compliance-mapping/analyze`,
          {
            frameworks: ['SOC2', 'ISO27001'],
            useAI: true,
          },
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          policyId: testPolicy.id,
          suggestions: expect.arrayContaining([
            expect.objectContaining({
              control: expect.any(String),
              framework: expect.any(String),
              confidence: expect.any(Number),
              reasoning: expect.any(String),
              relevantSections: expect.any(Array),
            }),
          ]),
          unmappedContent: expect.any(Array),
          coverageAnalysis: {
            currentCoverage: expect.any(Number),
            potentialCoverage: expect.any(Number),
            gaps: expect.any(Array),
          },
        });
      });
    });

    describe('GET /policies/:id/compliance-mapping/matrix', () => {
      it('should generate compliance mapping matrix', async () => {
        const response = await testSetup.makeRequest(
          'GET',
          `/policies/${testPolicy.id}/compliance-mapping/matrix`,
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          policyId: testPolicy.id,
          matrix: expect.any(Array),
          format: 'json',
        });

        // Verify matrix structure
        expect(response.body.matrix[0]).toMatchObject({
          control: expect.any(String),
          framework: expect.any(String),
          requirement: expect.any(String),
          policySection: expect.any(String),
          implementationStatus: expect.any(String),
          evidence: expect.any(Array),
        });
      });

      it('should export matrix in different formats', async () => {
        const formats = ['csv', 'excel', 'pdf'];

        for (const format of formats) {
          const response = await testSetup.makeRequest(
            'GET',
            `/policies/${testPolicy.id}/compliance-mapping/matrix?format=${format}`,
            null,
            adminToken
          );

          expect(response.status).toBe(HttpStatus.OK);

          const contentType = {
            csv: 'text/csv',
            excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            pdf: 'application/pdf',
          }[format];

          expect(response.headers['content-type']).toContain(contentType);
        }
      });
    });
  });

  describe('Cross-Framework Mapping', () => {
    describe('GET /compliance-mapping/cross-reference', () => {
      it('should show control mappings across frameworks', async () => {
        const response = await testSetup.makeRequest(
          'GET',
          '/compliance-mapping/cross-reference?frameworks=SOC2,ISO27001,NIST',
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          mappings: expect.arrayContaining([
            expect.objectContaining({
              concept: 'Access Control',
              controls: expect.objectContaining({
                SOC2: expect.arrayContaining(['CC6.1']),
                ISO27001: expect.arrayContaining(['A.9.1.1']),
                NIST: expect.arrayContaining(['AC-1', 'AC-2']),
              }),
            }),
          ]),
          commonRequirements: expect.any(Array),
          frameworkSpecific: expect.any(Object),
        });
      });
    });

    describe('POST /compliance-mapping/harmonize', () => {
      it('should create harmonized control set from multiple frameworks', async () => {
        const response = await testSetup.makeRequest(
          'POST',
          '/compliance-mapping/harmonize',
          {
            frameworks: ['SOC2', 'ISO27001'],
            strategy: 'union', // or 'intersection'
            includeMappingRationale: true,
          },
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          harmonizedControls: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              title: expect.any(String),
              requirements: expect.any(Array),
              sourceMappings: expect.objectContaining({
                SOC2: expect.any(Array),
                ISO27001: expect.any(Array),
              }),
            }),
          ]),
          statistics: {
            totalControls: expect.any(Number),
            uniqueRequirements: expect.any(Number),
            overlapPercentage: expect.any(Number),
          },
        });
      });
    });
  });

  describe('Compliance Assessment', () => {
    describe('POST /policies/:id/compliance-assessment', () => {
      it('should perform compliance assessment against frameworks', async () => {
        const response = await testSetup.makeRequest(
          'POST',
          `/policies/${testPolicy.id}/compliance-assessment`,
          {
            frameworks: ['SOC2'],
            includeEvidence: true,
            assessmentType: 'gap_analysis',
          },
          complianceManagerToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          policyId: testPolicy.id,
          assessmentId: expect.any(String),
          timestamp: expect.any(String),
          results: expect.objectContaining({
            SOC2: expect.objectContaining({
              overallScore: expect.any(Number),
              controlScores: expect.any(Object),
              gaps: expect.arrayContaining([
                expect.objectContaining({
                  control: expect.any(String),
                  requirement: expect.any(String),
                  gap: expect.any(String),
                  severity: expect.stringMatching(/^(critical|high|medium|low)$/),
                  remediation: expect.any(String),
                }),
              ]),
              strengths: expect.any(Array),
            }),
          }),
          recommendations: expect.any(Array),
          nextSteps: expect.any(Array),
        });
      });
    });

    describe('GET /policies/:id/compliance-history', () => {
      it('should track compliance assessment history', async () => {
        const response = await testSetup.makeRequest(
          'GET',
          `/policies/${testPolicy.id}/compliance-history`,
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body[0]).toMatchObject({
          assessmentId: expect.any(String),
          timestamp: expect.any(String),
          frameworks: expect.any(Array),
          overallScore: expect.any(Number),
          changes: expect.any(Object),
          assessedBy: expect.any(String),
        });
      });
    });

    describe('POST /policies/:id/compliance-certification', () => {
      it('should generate compliance certification report', async () => {
        const response = await testSetup.makeRequest(
          'POST',
          `/policies/${testPolicy.id}/compliance-certification`,
          {
            framework: 'SOC2',
            period: {
              start: '2025-01-01',
              end: '2025-12-31',
            },
            includeEvidence: true,
            signoff: {
              preparedBy: 'compliance@test.com',
              reviewedBy: 'admin@test.com',
            },
          },
          complianceManagerToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          certificationId: expect.any(String),
          policyId: testPolicy.id,
          framework: 'SOC2',
          status: 'draft',
          complianceStatement: expect.any(String),
          controlsAssessed: expect.any(Number),
          controlsPassed: expect.any(Number),
          exceptions: expect.any(Array),
          evidence: expect.any(Array),
        });
      });
    });
  });

  describe('Bulk Operations', () => {
    describe('POST /compliance-mapping/bulk-map', () => {
      it('should map multiple policies to frameworks in bulk', async () => {
        // Create additional test policies
        const policies = [];
        for (let i = 0; i < 5; i++) {
          const policy = await testSetup.createPolicy(
            {
              title: `Bulk Test Policy ${i}`,
              type: 'OPERATIONAL',
              priority: 'MEDIUM',
              scope: 'DEPARTMENT',
            },
            adminToken
          );
          policies.push(policy.id);
        }

        const response = await testSetup.makeRequest(
          'POST',
          '/compliance-mapping/bulk-map',
          {
            policyIds: policies,
            frameworks: ['SOC2', 'ISO27001'],
            autoDetect: true,
            mappingStrategy: 'conservative', // or 'aggressive'
          },
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          processed: 5,
          successful: expect.any(Number),
          failed: expect.any(Number),
          results: expect.arrayContaining([
            expect.objectContaining({
              policyId: expect.any(String),
              status: expect.stringMatching(/^(success|failed)$/),
              mappedControls: expect.any(Number),
              confidence: expect.any(Number),
            }),
          ]),
        });
      });
    });

    describe('POST /compliance-mapping/bulk-assess', () => {
      it('should assess multiple policies for compliance', async () => {
        const response = await testSetup.makeRequest(
          'POST',
          '/compliance-mapping/bulk-assess',
          {
            scope: 'organization', // or specific policy IDs
            frameworks: ['SOC2'],
            assessmentDate: new Date().toISOString(),
            generateReport: true,
          },
          complianceManagerToken
        );

        expect(response.status).toBe(HttpStatus.ACCEPTED); // Async operation
        expect(response.body).toMatchObject({
          jobId: expect.any(String),
          status: 'queued',
          estimatedCompletion: expect.any(String),
          trackingUrl: expect.any(String),
        });
      });
    });
  });

  describe('Compliance Reporting', () => {
    describe('GET /compliance-mapping/dashboard', () => {
      it('should provide compliance dashboard data', async () => {
        const response = await testSetup.makeRequest(
          'GET',
          '/compliance-mapping/dashboard',
          null,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toMatchObject({
          summary: {
            totalPolicies: expect.any(Number),
            mappedPolicies: expect.any(Number),
            averageComplianceScore: expect.any(Number),
            criticalGaps: expect.any(Number),
          },
          byFramework: expect.objectContaining({
            SOC2: expect.objectContaining({
              policies: expect.any(Number),
              avgScore: expect.any(Number),
              topGaps: expect.any(Array),
            }),
          }),
          trends: expect.arrayContaining([
            expect.objectContaining({
              date: expect.any(String),
              scores: expect.any(Object),
            }),
          ]),
          upcomingReviews: expect.any(Array),
          recentChanges: expect.any(Array),
        });
      });
    });

    describe('POST /compliance-mapping/reports/executive-summary', () => {
      it('should generate executive compliance summary', async () => {
        const response = await testSetup.makeRequest(
          'POST',
          '/compliance-mapping/reports/executive-summary',
          {
            period: {
              start: '2025-01-01',
              end: '2025-03-31',
            },
            frameworks: ['SOC2', 'ISO27001'],
            format: 'pdf',
            includeCharts: true,
            recipients: ['executive@company.com'],
          },
          complianceManagerToken
        );

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.headers['content-type']).toContain('application/pdf');
        expect(response.headers['content-disposition']).toContain('Executive_Compliance_Summary');
      });
    });
  });

  describe('Integration and Automation', () => {
    describe('POST /compliance-mapping/webhooks', () => {
      it('should register webhook for compliance events', async () => {
        const webhook = {
          url: 'https://example.com/compliance-webhook',
          events: ['mapping.updated', 'assessment.completed', 'gap.identified'],
          secret: 'webhook-secret-key',
          active: true,
        };

        const response = await testSetup.makeRequest(
          'POST',
          '/compliance-mapping/webhooks',
          webhook,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.CREATED);
        expect(response.body).toMatchObject({
          id: expect.any(String),
          ...webhook,
          createdAt: expect.any(String),
        });
      });
    });

    describe('POST /compliance-mapping/automation-rules', () => {
      it('should create automation rule for compliance mapping', async () => {
        const rule = {
          name: 'Auto-map security policies',
          trigger: {
            event: 'policy.created',
            conditions: {
              type: 'SECURITY',
              priority: ['HIGH', 'CRITICAL'],
            },
          },
          actions: [
            {
              type: 'map_to_frameworks',
              parameters: {
                frameworks: ['SOC2', 'ISO27001'],
                strategy: 'auto_detect',
              },
            },
            {
              type: 'schedule_assessment',
              parameters: {
                delay: '7d',
                assignTo: 'compliance-team',
              },
            },
          ],
          enabled: true,
        };

        const response = await testSetup.makeRequest(
          'POST',
          '/compliance-mapping/automation-rules',
          rule,
          adminToken
        );

        expect(response.status).toBe(HttpStatus.CREATED);
        expect(response.body).toMatchObject({
          id: expect.any(String),
          ...rule,
          lastTriggered: null,
          executionCount: 0,
        });
      });
    });
  });

  describe('Performance and Optimization', () => {
    it('should efficiently handle large compliance matrices', async () => {
      const start = Date.now();

      const response = await testSetup.makeRequest(
        'GET',
        '/compliance-mapping/matrix?frameworks=SOC2,ISO27001,NIST&limit=1000',
        null,
        adminToken
      );

      const duration = Date.now() - start;

      expect(response.status).toBe(HttpStatus.OK);
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
      expect(response.body.matrix.length).toBeGreaterThan(0);
    });

    it('should cache compliance assessments', async () => {
      // First assessment (cold)
      const start1 = Date.now();
      await testSetup.makeRequest(
        'POST',
        `/policies/${testPolicy.id}/compliance-assessment`,
        { frameworks: ['SOC2'] },
        adminToken
      );
      const time1 = Date.now() - start1;

      // Second assessment (should be cached)
      const start2 = Date.now();
      const response = await testSetup.makeRequest(
        'POST',
        `/policies/${testPolicy.id}/compliance-assessment`,
        { frameworks: ['SOC2'], useCache: true },
        adminToken
      );
      const time2 = Date.now() - start2;

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.cached).toBe(true);
      expect(time2).toBeLessThan(time1 * 0.2); // Cached should be 80% faster
    });
  });

  afterAll(async () => {
    await testSetup.cleanup();
  });
});
