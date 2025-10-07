/**
 * Compliance Workflow E2E Tests
 * Tests the complete SOC 1/SOC 2 compliance workflow from client onboarding to audit completion
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Service URLs
const AUTH_SERVICE = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const CLIENT_SERVICE = process.env.CLIENT_SERVICE_URL || 'http://localhost:3002';
const CONTROL_SERVICE = process.env.CONTROL_SERVICE_URL || 'http://localhost:3004';
const POLICY_SERVICE = process.env.POLICY_SERVICE_URL || 'http://localhost:3003';
const EVIDENCE_SERVICE = process.env.EVIDENCE_SERVICE_URL || 'http://localhost:3005';
const AUDIT_SERVICE = process.env.AUDIT_SERVICE_URL || 'http://localhost:3008';

// Test configuration
const TEST_TIMEOUT = 60000; // Longer timeout for complex workflows

describe('SOC Compliance Workflow E2E Tests', () => {
  let adminToken;
  let complianceManagerToken;
  let auditorToken;
  let clientId;
  let controlIds = [];
  const policyIds = [];
  const evidenceIds = [];
  let auditId;

  beforeAll(async () => {
    // Setup test users with different roles
    const adminUser = {
      email: `admin-${uuidv4()}@example.com`,
      password: 'AdminPassword123!',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
    };

    const complianceUser = {
      email: `compliance-${uuidv4()}@example.com`,
      password: 'CompliancePassword123!',
      firstName: 'Compliance',
      lastName: 'Manager',
      role: 'compliance_manager',
    };

    const auditorUser = {
      email: `auditor-${uuidv4()}@example.com`,
      password: 'AuditorPassword123!',
      firstName: 'Auditor',
      lastName: 'User',
      role: 'auditor',
    };

    // Register and login users
    await axios.post(`${AUTH_SERVICE}/auth/register`, adminUser);
    const adminLogin = await axios.post(`${AUTH_SERVICE}/auth/login`, {
      email: adminUser.email,
      password: adminUser.password,
    });
    adminToken = adminLogin.data.accessToken;

    await axios.post(`${AUTH_SERVICE}/auth/register`, complianceUser);
    const complianceLogin = await axios.post(`${AUTH_SERVICE}/auth/login`, {
      email: complianceUser.email,
      password: complianceUser.password,
    });
    complianceManagerToken = complianceLogin.data.accessToken;

    await axios.post(`${AUTH_SERVICE}/auth/register`, auditorUser);
    const auditorLogin = await axios.post(`${AUTH_SERVICE}/auth/login`, {
      email: auditorUser.email,
      password: auditorUser.password,
    });
    auditorToken = auditorLogin.data.accessToken;
  });

  describe('1. Client Onboarding', () => {
    test(
      'should create a new client organization',
      async () => {
        const newClient = {
          name: `Test Client ${Date.now()}`,
          industry: 'Technology',
          size: 'medium',
          primaryContact: {
            name: 'John Doe',
            email: 'john.doe@testclient.com',
            phone: '+1-555-0123',
          },
          complianceFrameworks: ['SOC2_TYPE2', 'ISO_27001'],
        };

        const response = await axios.post(`${CLIENT_SERVICE}/api/v1/clients`, newClient, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        expect(response.status).toBe(201);
        expect(response.data).toMatchObject({
          name: newClient.name,
          status: 'onboarding',
          complianceScore: 0,
        });

        clientId = response.data.id;
      },
      TEST_TIMEOUT
    );

    test(
      'should start client onboarding process',
      async () => {
        const onboardingData = {
          assignedManager: 'manager-123',
          estimatedAuditDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          notes: 'New client onboarding for SOC 2 Type 2 audit',
        };

        const response = await axios.post(
          `${CLIENT_SERVICE}/api/v1/clients/${clientId}/onboarding`,
          onboardingData,
          {
            headers: { Authorization: `Bearer ${complianceManagerToken}` },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data.onboardingStatus).toBe('in_progress');
      },
      TEST_TIMEOUT
    );

    test(
      'should complete client onboarding checklist',
      async () => {
        const checklistItems = [
          'contract_signed',
          'team_assigned',
          'kickoff_meeting_completed',
          'documentation_requested',
          'systems_access_granted',
        ];

        for (const item of checklistItems) {
          await axios.patch(
            `${CLIENT_SERVICE}/api/v1/clients/${clientId}/onboarding/checklist`,
            {
              item,
              completed: true,
              completedBy: 'compliance-manager',
              completedAt: new Date().toISOString(),
            },
            {
              headers: { Authorization: `Bearer ${complianceManagerToken}` },
            }
          );
        }

        const response = await axios.post(
          `${CLIENT_SERVICE}/api/v1/clients/${clientId}/onboarding/complete`,
          {},
          {
            headers: { Authorization: `Bearer ${complianceManagerToken}` },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data.status).toBe('active');
        expect(response.data.onboardingStatus).toBe('completed');
      },
      TEST_TIMEOUT
    );
  });

  describe('2. Control Framework Implementation', () => {
    test(
      'should assign SOC 2 control framework to client',
      async () => {
        const response = await axios.post(
          `${CONTROL_SERVICE}/frameworks/assign`,
          {
            clientId,
            framework: 'SOC2_TYPE2',
            implementationDeadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            headers: { Authorization: `Bearer ${complianceManagerToken}` },
          }
        );

        expect(response.status).toBe(201);
        expect(response.data).toMatchObject({
          framework: 'SOC2_TYPE2',
          status: 'assigned',
          controls: expect.any(Array),
        });

        controlIds = response.data.controls.map((c) => c.id);
        expect(controlIds.length).toBeGreaterThan(0);
      },
      TEST_TIMEOUT
    );

    test(
      'should create control implementations',
      async () => {
        // Implement first 5 controls
        const controlsToImplement = controlIds.slice(0, 5);

        for (const controlId of controlsToImplement) {
          const implementation = {
            controlId,
            clientId,
            description: `Implementation for control ${controlId}`,
            implementationType: 'technical',
            status: 'implemented',
            implementedBy: 'compliance-team',
            implementedDate: new Date().toISOString(),
            testingFrequency: 'quarterly',
          };

          const response = await axios.post(`${CONTROL_SERVICE}/implementations`, implementation, {
            headers: { Authorization: `Bearer ${complianceManagerToken}` },
          });

          expect(response.status).toBe(201);
          expect(response.data.status).toBe('implemented');
        }
      },
      TEST_TIMEOUT
    );

    test(
      'should update control implementation progress',
      async () => {
        const response = await axios.get(
          `${CONTROL_SERVICE}/implementations/progress/${clientId}`,
          {
            headers: { Authorization: `Bearer ${complianceManagerToken}` },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          totalControls: expect.any(Number),
          implementedControls: expect.any(Number),
          progressPercentage: expect.any(Number),
        });
        expect(response.data.progressPercentage).toBeGreaterThan(0);
      },
      TEST_TIMEOUT
    );
  });

  describe('3. Policy Management', () => {
    test(
      'should create security policies',
      async () => {
        const policies = [
          {
            title: 'Information Security Policy',
            type: 'security',
            category: 'governance',
            description: 'Comprehensive information security policy',
            effectiveDate: new Date().toISOString(),
            reviewFrequency: 'annual',
            owner: 'ciso@company.com',
          },
          {
            title: 'Access Control Policy',
            type: 'security',
            category: 'access_control',
            description: 'Policy for managing user access and permissions',
            effectiveDate: new Date().toISOString(),
            reviewFrequency: 'semi-annual',
            owner: 'security@company.com',
          },
          {
            title: 'Data Classification Policy',
            type: 'data_governance',
            category: 'data_protection',
            description: 'Policy for classifying and handling sensitive data',
            effectiveDate: new Date().toISOString(),
            reviewFrequency: 'annual',
            owner: 'dpo@company.com',
          },
        ];

        for (const policy of policies) {
          const response = await axios.post(
            `${POLICY_SERVICE}/policies`,
            {
              ...policy,
              clientId,
              version: '1.0',
              status: 'draft',
            },
            {
              headers: { Authorization: `Bearer ${complianceManagerToken}` },
            }
          );

          expect(response.status).toBe(201);
          policyIds.push(response.data.id);
        }

        expect(policyIds.length).toBe(3);
      },
      TEST_TIMEOUT
    );

    test(
      'should approve and publish policies',
      async () => {
        for (const policyId of policyIds) {
          // Approve policy
          const approveResponse = await axios.post(
            `${POLICY_SERVICE}/policies/${policyId}/approve`,
            {
              approvedBy: 'compliance-manager',
              approvalComments: 'Policy reviewed and approved',
            },
            {
              headers: { Authorization: `Bearer ${complianceManagerToken}` },
            }
          );

          expect(approveResponse.status).toBe(200);
          expect(approveResponse.data.status).toBe('approved');

          // Publish policy
          const publishResponse = await axios.post(
            `${POLICY_SERVICE}/policies/${policyId}/publish`,
            {},
            {
              headers: { Authorization: `Bearer ${complianceManagerToken}` },
            }
          );

          expect(publishResponse.status).toBe(200);
          expect(publishResponse.data.status).toBe('published');
        }
      },
      TEST_TIMEOUT
    );

    test(
      'should map policies to controls',
      async () => {
        // Map Information Security Policy to multiple controls
        const mappings = [
          { policyId: policyIds[0], controlIds: controlIds.slice(0, 3) },
          { policyId: policyIds[1], controlIds: controlIds.slice(3, 6) },
          { policyId: policyIds[2], controlIds: controlIds.slice(6, 9) },
        ];

        for (const mapping of mappings) {
          const response = await axios.post(
            `${POLICY_SERVICE}/policies/${mapping.policyId}/controls`,
            {
              controlIds: mapping.controlIds,
            },
            {
              headers: { Authorization: `Bearer ${complianceManagerToken}` },
            }
          );

          expect(response.status).toBe(200);
          expect(response.data.mappedControls).toEqual(mapping.controlIds);
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('4. Evidence Collection', () => {
    test(
      'should collect evidence for controls',
      async () => {
        const evidenceItems = [
          {
            title: 'Firewall Configuration Screenshot',
            type: 'screenshot',
            controlId: controlIds[0],
            description: 'Current firewall rules and configuration',
            collectedDate: new Date().toISOString(),
          },
          {
            title: 'Access Control Matrix',
            type: 'document',
            controlId: controlIds[1],
            description: 'User access permissions matrix',
            collectedDate: new Date().toISOString(),
          },
          {
            title: 'Security Incident Log',
            type: 'log',
            controlId: controlIds[2],
            description: 'Security incidents from last quarter',
            collectedDate: new Date().toISOString(),
          },
          {
            title: 'Backup Verification Report',
            type: 'report',
            controlId: controlIds[3],
            description: 'Monthly backup verification results',
            collectedDate: new Date().toISOString(),
          },
        ];

        for (const evidence of evidenceItems) {
          const response = await axios.post(
            `${EVIDENCE_SERVICE}/evidence`,
            {
              ...evidence,
              clientId,
              status: 'collected',
            },
            {
              headers: { Authorization: `Bearer ${complianceManagerToken}` },
            }
          );

          expect(response.status).toBe(201);
          expect(response.data.status).toBe('collected');
          evidenceIds.push(response.data.id);
        }

        expect(evidenceIds.length).toBe(4);
      },
      TEST_TIMEOUT
    );

    test(
      'should upload evidence files',
      async () => {
        const FormData = require('form-data');
        const form = new FormData();

        form.append('title', 'Network Diagram');
        form.append('type', 'document');
        form.append('controlId', controlIds[4]);
        form.append('clientId', clientId);
        form.append('description', 'Current network architecture diagram');
        form.append('file', Buffer.from('Mock file content'), 'network-diagram.pdf');

        const response = await axios.post(`${EVIDENCE_SERVICE}/evidence/upload`, form, {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${complianceManagerToken}`,
          },
        });

        expect(response.status).toBe(201);
        expect(response.data.metadata).toMatchObject({
          fileName: 'network-diagram.pdf',
          mimeType: expect.any(String),
        });
        evidenceIds.push(response.data.id);
      },
      TEST_TIMEOUT
    );

    test(
      'should validate evidence',
      async () => {
        // Validate first 3 evidence items
        for (const evidenceId of evidenceIds.slice(0, 3)) {
          const response = await axios.post(
            `${EVIDENCE_SERVICE}/evidence/${evidenceId}/validate`,
            {
              isValid: true,
              validationComments: 'Evidence reviewed and validated',
              validatedBy: 'auditor',
            },
            {
              headers: { Authorization: `Bearer ${auditorToken}` },
            }
          );

          expect(response.status).toBe(200);
          expect(response.data.status).toBe('validated');
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('5. Control Testing', () => {
    test(
      'should create control test plans',
      async () => {
        const testPlans = controlIds.slice(0, 5).map((controlId) => ({
          controlId,
          clientId,
          testName: `Q4 2024 Control Test - ${controlId}`,
          testType: 'operating_effectiveness',
          testProcedure: 'Review evidence and perform testing procedures',
          scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          assignedTo: 'auditor-team',
        }));

        for (const plan of testPlans) {
          const response = await axios.post(`${CONTROL_SERVICE}/control-tests`, plan, {
            headers: { Authorization: `Bearer ${auditorToken}` },
          });

          expect(response.status).toBe(201);
          expect(response.data.status).toBe('scheduled');
        }
      },
      TEST_TIMEOUT
    );

    test(
      'should execute control tests',
      async () => {
        const controlTestsResponse = await axios.get(
          `${CONTROL_SERVICE}/control-tests?clientId=${clientId}&status=scheduled`,
          {
            headers: { Authorization: `Bearer ${auditorToken}` },
          }
        );

        const scheduledTests = controlTestsResponse.data.data;

        for (const test of scheduledTests.slice(0, 3)) {
          const testResult = {
            status: 'passed',
            testDate: new Date().toISOString(),
            testedBy: 'auditor',
            findings: [],
            evidenceReviewed: evidenceIds.slice(0, 2),
            conclusion: 'Control is operating effectively',
          };

          const response = await axios.patch(
            `${CONTROL_SERVICE}/control-tests/${test.id}/execute`,
            testResult,
            {
              headers: { Authorization: `Bearer ${auditorToken}` },
            }
          );

          expect(response.status).toBe(200);
          expect(response.data.status).toBe('completed');
          expect(response.data.result).toBe('passed');
        }
      },
      TEST_TIMEOUT
    );

    test(
      'should handle control test failures',
      async () => {
        const controlTestsResponse = await axios.get(
          `${CONTROL_SERVICE}/control-tests?clientId=${clientId}&status=scheduled`,
          {
            headers: { Authorization: `Bearer ${auditorToken}` },
          }
        );

        const scheduledTests = controlTestsResponse.data.data;

        if (scheduledTests.length > 0) {
          const failedTest = scheduledTests[0];

          const testResult = {
            status: 'failed',
            testDate: new Date().toISOString(),
            testedBy: 'auditor',
            findings: [
              {
                severity: 'high',
                description: 'Access logs not retained for required period',
                recommendation: 'Implement log retention policy of 90 days',
              },
            ],
            evidenceReviewed: [evidenceIds[0]],
            conclusion: 'Control requires remediation',
          };

          const response = await axios.patch(
            `${CONTROL_SERVICE}/control-tests/${failedTest.id}/execute`,
            testResult,
            {
              headers: { Authorization: `Bearer ${auditorToken}` },
            }
          );

          expect(response.status).toBe(200);
          expect(response.data.status).toBe('completed');
          expect(response.data.result).toBe('failed');
          expect(response.data.findings).toHaveLength(1);
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('6. Audit Management', () => {
    test(
      'should create SOC 2 audit',
      async () => {
        const audit = {
          clientId,
          type: 'SOC2_TYPE2',
          auditPeriod: {
            startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date().toISOString(),
          },
          scope: {
            systems: ['Production Environment', 'Corporate Network'],
            locations: ['Primary Data Center', 'DR Site'],
            processes: ['Change Management', 'Access Control', 'Incident Response'],
          },
          leadAuditor: 'lead-auditor-id',
          auditTeam: ['auditor-1', 'auditor-2'],
          status: 'planning',
        };

        const response = await axios.post(`${AUDIT_SERVICE}/audits`, audit, {
          headers: { Authorization: `Bearer ${auditorToken}` },
        });

        expect(response.status).toBe(201);
        expect(response.data).toMatchObject({
          type: 'SOC2_TYPE2',
          status: 'planning',
        });

        auditId = response.data.id;
      },
      TEST_TIMEOUT
    );

    test(
      'should update audit to fieldwork phase',
      async () => {
        const response = await axios.patch(
          `${AUDIT_SERVICE}/audits/${auditId}/phase`,
          {
            phase: 'fieldwork',
            phaseStartDate: new Date().toISOString(),
            plannedCompletion: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            headers: { Authorization: `Bearer ${auditorToken}` },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data.status).toBe('fieldwork');
      },
      TEST_TIMEOUT
    );

    test(
      'should create audit findings',
      async () => {
        const findings = [
          {
            auditId,
            controlId: controlIds[0],
            type: 'deficiency',
            severity: 'medium',
            title: 'Incomplete access reviews',
            description: 'Quarterly access reviews were not completed for Q2 2024',
            impact: 'Potential unauthorized access to systems',
            recommendation: 'Implement automated access review reminders',
            managementResponse: 'Will implement automated system by end of Q1 2025',
            targetRemediationDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            auditId,
            controlId: controlIds[1],
            type: 'observation',
            severity: 'low',
            title: 'Password policy enhancement opportunity',
            description: 'Current password policy could be strengthened',
            impact: 'Minor security improvement opportunity',
            recommendation: 'Increase minimum password length to 14 characters',
            managementResponse: 'Will update policy in next revision cycle',
          },
        ];

        for (const finding of findings) {
          const response = await axios.post(
            `${AUDIT_SERVICE}/audits/${auditId}/findings`,
            finding,
            {
              headers: { Authorization: `Bearer ${auditorToken}` },
            }
          );

          expect(response.status).toBe(201);
          expect(response.data.type).toBe(finding.type);
          expect(response.data.severity).toBe(finding.severity);
        }
      },
      TEST_TIMEOUT
    );

    test(
      'should generate audit report',
      async () => {
        const response = await axios.post(
          `${AUDIT_SERVICE}/audits/${auditId}/report/generate`,
          {
            reportType: 'SOC2_TYPE2',
            includeManagementResponse: true,
            includeAuditorOpinion: true,
            format: 'pdf',
          },
          {
            headers: { Authorization: `Bearer ${auditorToken}` },
          }
        );

        expect(response.status).toBe(202); // Accepted for processing
        expect(response.data).toMatchObject({
          reportId: expect.any(String),
          status: 'generating',
          estimatedCompletion: expect.any(String),
        });
      },
      TEST_TIMEOUT
    );

    test(
      'should complete audit',
      async () => {
        const response = await axios.patch(
          `${AUDIT_SERVICE}/audits/${auditId}/complete`,
          {
            conclusion: 'qualified_opinion',
            auditorOpinion:
              'Controls were suitably designed and operating effectively with exceptions noted',
            completionDate: new Date().toISOString(),
            finalReportUrl: 'https://reports.example.com/soc2-report-2024.pdf',
          },
          {
            headers: { Authorization: `Bearer ${auditorToken}` },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data.status).toBe('completed');
        expect(response.data.conclusion).toBe('qualified_opinion');
      },
      TEST_TIMEOUT
    );
  });

  describe('7. Compliance Dashboard', () => {
    test(
      'should get client compliance overview',
      async () => {
        const response = await axios.get(
          `${CLIENT_SERVICE}/api/v1/clients/${clientId}/compliance/overview`,
          {
            headers: { Authorization: `Bearer ${complianceManagerToken}` },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          complianceScore: expect.any(Number),
          frameworks: expect.arrayContaining(['SOC2_TYPE2']),
          controlImplementation: {
            total: expect.any(Number),
            implemented: expect.any(Number),
            percentage: expect.any(Number),
          },
          evidenceCollection: {
            total: expect.any(Number),
            validated: expect.any(Number),
            percentage: expect.any(Number),
          },
          lastAudit: expect.objectContaining({
            type: 'SOC2_TYPE2',
            status: 'completed',
            conclusion: 'qualified_opinion',
          }),
        });
      },
      TEST_TIMEOUT
    );

    test(
      'should get compliance metrics',
      async () => {
        const response = await axios.get(`${CLIENT_SERVICE}/api/v1/compliance/metrics`, {
          headers: { Authorization: `Bearer ${complianceManagerToken}` },
        });

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          totalClients: expect.any(Number),
          activeAudits: expect.any(Number),
          upcomingAudits: expect.any(Number),
          averageComplianceScore: expect.any(Number),
          controlCoverage: expect.any(Number),
          evidenceValidationRate: expect.any(Number),
        });
      },
      TEST_TIMEOUT
    );

    test(
      'should get action items and remediations',
      async () => {
        const response = await axios.get(
          `${CLIENT_SERVICE}/api/v1/clients/${clientId}/action-items`,
          {
            headers: { Authorization: `Bearer ${complianceManagerToken}` },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          openFindings: expect.any(Number),
          overdueRemediations: expect.any(Number),
          upcomingDeadlines: expect.any(Array),
          priorityActions: expect.any(Array),
        });
      },
      TEST_TIMEOUT
    );
  });

  describe('8. Continuous Monitoring', () => {
    test(
      'should schedule recurring evidence collection',
      async () => {
        const recurringCollection = {
          clientId,
          controlIds: controlIds.slice(0, 3),
          frequency: 'monthly',
          collectionMethod: 'automated',
          startDate: new Date().toISOString(),
          assignedTo: 'automation-system',
          notificationSettings: {
            reminderDays: [7, 3, 1],
            escalationAfterDays: 5,
          },
        };

        const response = await axios.post(
          `${EVIDENCE_SERVICE}/evidence/schedule`,
          recurringCollection,
          {
            headers: { Authorization: `Bearer ${complianceManagerToken}` },
          }
        );

        expect(response.status).toBe(201);
        expect(response.data).toMatchObject({
          frequency: 'monthly',
          status: 'active',
          nextCollection: expect.any(String),
        });
      },
      TEST_TIMEOUT
    );

    test(
      'should monitor control effectiveness',
      async () => {
        const response = await axios.get(
          `${CONTROL_SERVICE}/controls/effectiveness?clientId=${clientId}`,
          {
            headers: { Authorization: `Bearer ${complianceManagerToken}` },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          overallEffectiveness: expect.any(Number),
          controlsByEffectiveness: {
            effective: expect.any(Number),
            partiallyEffective: expect.any(Number),
            ineffective: expect.any(Number),
            notTested: expect.any(Number),
          },
          trendsOverTime: expect.any(Array),
        });
      },
      TEST_TIMEOUT
    );

    test(
      'should generate compliance alerts',
      async () => {
        const response = await axios.get(`${CLIENT_SERVICE}/api/v1/clients/${clientId}/alerts`, {
          headers: { Authorization: `Bearer ${complianceManagerToken}` },
        });

        expect(response.status).toBe(200);
        expect(response.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: expect.any(String),
              severity: expect.any(String),
              message: expect.any(String),
              actionRequired: expect.any(Boolean),
            }),
          ])
        );
      },
      TEST_TIMEOUT
    );
  });

  describe('9. Reporting and Export', () => {
    test(
      'should export compliance documentation',
      async () => {
        const response = await axios.post(
          `${CLIENT_SERVICE}/api/v1/clients/${clientId}/export/compliance-package`,
          {
            includeItems: ['policies', 'controls', 'evidence', 'test_results', 'audit_reports'],
            format: 'zip',
            dateRange: {
              start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString(),
            },
          },
          {
            headers: { Authorization: `Bearer ${complianceManagerToken}` },
          }
        );

        expect(response.status).toBe(202); // Accepted for processing
        expect(response.data).toMatchObject({
          exportId: expect.any(String),
          status: 'processing',
          estimatedSize: expect.any(Number),
          downloadUrl: expect.any(String),
        });
      },
      TEST_TIMEOUT
    );

    test(
      'should generate executive summary report',
      async () => {
        const response = await axios.post(
          `${CLIENT_SERVICE}/api/v1/reports/executive-summary`,
          {
            clientId,
            reportingPeriod: {
              start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString(),
            },
            includeSections: [
              'compliance_overview',
              'control_effectiveness',
              'audit_results',
              'remediation_status',
              'risk_assessment',
            ],
          },
          {
            headers: { Authorization: `Bearer ${complianceManagerToken}` },
          }
        );

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          reportId: expect.any(String),
          generatedAt: expect.any(String),
          sections: expect.any(Object),
        });
      },
      TEST_TIMEOUT
    );
  });

  describe('10. Integration Points', () => {
    test(
      'should sync with external audit tools',
      async () => {
        const response = await axios.post(
          `${CLIENT_SERVICE}/api/v1/integrations/sync`,
          {
            clientId,
            integration: 'audit_tool',
            syncType: 'full',
            includeData: ['controls', 'evidence', 'findings'],
          },
          {
            headers: { Authorization: `Bearer ${adminToken}` },
          }
        );

        expect(response.status).toBe(202);
        expect(response.data).toMatchObject({
          syncId: expect.any(String),
          status: 'in_progress',
          estimatedCompletion: expect.any(String),
        });
      },
      TEST_TIMEOUT
    );

    test(
      'should handle webhook notifications',
      async () => {
        const webhook = {
          url: 'https://example.com/webhooks/compliance',
          events: ['audit.completed', 'finding.created', 'control.failed', 'evidence.expired'],
          secret: 'webhook-secret-key',
          active: true,
        };

        const response = await axios.post(`${CLIENT_SERVICE}/api/v1/webhooks`, webhook, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });

        expect(response.status).toBe(201);
        expect(response.data).toMatchObject({
          id: expect.any(String),
          url: webhook.url,
          events: webhook.events,
          active: true,
        });
      },
      TEST_TIMEOUT
    );
  });

  afterAll(async () => {
    // Cleanup test data if needed
    // This could include deleting test clients, users, etc.
  });
});
