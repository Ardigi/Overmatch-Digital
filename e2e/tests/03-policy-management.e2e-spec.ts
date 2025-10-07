import axios from 'axios';
import { waitFor, checkServiceHealth } from '../setup';

describe('E2E: Policy Management Flow', () => {
  const POLICY_SERVICE_URL = 'http://localhost:3003';
  
  let accessToken: string;
  let organizationId: string;
  let policyId: string;
  let templateId: string;

  beforeAll(async () => {
    // Wait for policy service to be healthy
    await waitFor(() => checkServiceHealth(POLICY_SERVICE_URL));

    // Get tokens from context
    if (global.testContext) {
      accessToken = global.testContext.accessToken;
      organizationId = global.testContext.organizationId;
    } else {
      // Create test context
      const authResponse = await axios.post(
        'http://localhost:3001/api/auth/register',
        {
          email: `policy-test-${Date.now()}@soc-platform.com`,
          password: 'PolicyTest123!',
          firstName: 'Policy',
          lastName: 'Test',
          organizationName: 'Policy Test Org'
        }
      );
      
      accessToken = authResponse.data.tokens.accessToken;
      organizationId = authResponse.data.user.organizationId;
    }
  });

  describe('Policy Templates', () => {
    it('should list available policy templates', async () => {
      const response = await axios.get(
        `${POLICY_SERVICE_URL}/api/policies/templates`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
      expect(response.data[0]).toHaveProperty('id');
      expect(response.data[0]).toHaveProperty('name');
      expect(response.data[0]).toHaveProperty('category');
      
      templateId = response.data[0].id;
    });

    it('should get template details', async () => {
      const response = await axios.get(
        `${POLICY_SERVICE_URL}/api/policies/templates/${templateId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('content');
      expect(response.data).toHaveProperty('controls');
    });
  });

  describe('Policy Creation', () => {
    it('should create policy from template', async () => {
      const policyData = {
        templateId: templateId,
        name: 'Information Security Policy',
        description: 'Organization information security policy',
        effectiveDate: new Date().toISOString(),
        reviewFrequency: 'annual',
        owner: 'Security Team',
        customizations: {
          companyName: 'Test Organization',
          dataRetentionPeriod: '7 years'
        }
      };

      const response = await axios.post(
        `${POLICY_SERVICE_URL}/api/policies`,
        policyData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Organization-Id': organizationId
          }
        }
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.name).toBe(policyData.name);
      expect(response.data.status).toBe('draft');
      
      policyId = response.data.id;
    });

    it('should create custom policy', async () => {
      const customPolicyData = {
        name: 'Custom Security Policy',
        description: 'Custom policy for specific requirements',
        content: '# Custom Security Policy\n\n## 1. Purpose\n...',
        category: 'security',
        effectiveDate: new Date().toISOString(),
        reviewFrequency: 'quarterly',
        owner: 'CISO'
      };

      const response = await axios.post(
        `${POLICY_SERVICE_URL}/api/policies`,
        customPolicyData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Organization-Id': organizationId
          }
        }
      );

      expect(response.status).toBe(201);
      expect(response.data.name).toBe(customPolicyData.name);
    });
  });

  describe('Policy Management', () => {
    it('should list organization policies', async () => {
      const response = await axios.get(
        `${POLICY_SERVICE_URL}/api/policies`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Organization-Id': organizationId
          }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
    });

    it('should update policy', async () => {
      const updateData = {
        description: 'Updated information security policy',
        reviewFrequency: 'semi-annual',
        content: '# Updated Information Security Policy\n\n## 1. Purpose\n...'
      };

      const response = await axios.patch(
        `${POLICY_SERVICE_URL}/api/policies/${policyId}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Organization-Id': organizationId
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.description).toBe(updateData.description);
      expect(response.data.reviewFrequency).toBe(updateData.reviewFrequency);
    });

    it('should add policy version', async () => {
      const versionData = {
        version: '2.0',
        changes: 'Updated security requirements and added cloud security section',
        content: '# Information Security Policy v2.0\n\n## 1. Purpose\n...'
      };

      const response = await axios.post(
        `${POLICY_SERVICE_URL}/api/policies/${policyId}/versions`,
        versionData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Organization-Id': organizationId
          }
        }
      );

      expect(response.status).toBe(201);
      expect(response.data.version).toBe(versionData.version);
    });

    it('should get policy versions', async () => {
      const response = await axios.get(
        `${POLICY_SERVICE_URL}/api/policies/${policyId}/versions`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Organization-Id': organizationId
          }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
    });
  });

  describe('Policy Approval Workflow', () => {
    it('should submit policy for approval', async () => {
      const response = await axios.post(
        `${POLICY_SERVICE_URL}/api/policies/${policyId}/submit`,
        {
          reviewers: ['reviewer1@example.com', 'reviewer2@example.com'],
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          notes: 'Please review the updated security policy'
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Organization-Id': organizationId
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('under_review');
    });

    it('should approve policy', async () => {
      const response = await axios.post(
        `${POLICY_SERVICE_URL}/api/policies/${policyId}/approve`,
        {
          comments: 'Policy approved with minor suggestions',
          conditions: []
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Organization-Id': organizationId
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('approved');
    });

    it('should publish policy', async () => {
      const response = await axios.post(
        `${POLICY_SERVICE_URL}/api/policies/${policyId}/publish`,
        {
          notifyEmployees: true,
          requireAcknowledgment: true,
          acknowledgmentDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Organization-Id': organizationId
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('published');
      expect(response.data.publishedAt).toBeDefined();
    });
  });

  describe('Policy Acknowledgments', () => {
    it('should track policy acknowledgment', async () => {
      const response = await axios.post(
        `${POLICY_SERVICE_URL}/api/policies/${policyId}/acknowledge`,
        {
          acknowledged: true,
          comments: 'I have read and understood the policy'
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Organization-Id': organizationId
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('acknowledgedAt');
    });

    it('should get acknowledgment status', async () => {
      const response = await axios.get(
        `${POLICY_SERVICE_URL}/api/policies/${policyId}/acknowledgments`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Organization-Id': organizationId
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('total');
      expect(response.data).toHaveProperty('acknowledged');
      expect(response.data).toHaveProperty('pending');
    });
  });

  describe('Policy Compliance Mapping', () => {
    it('should map policy to controls', async () => {
      const mappingData = {
        controls: [
          {
            frameworkId: 'SOC2',
            controlId: 'CC1.1',
            mappingType: 'primary'
          },
          {
            frameworkId: 'ISO27001',
            controlId: 'A.5.1.1',
            mappingType: 'secondary'
          }
        ]
      };

      const response = await axios.post(
        `${POLICY_SERVICE_URL}/api/policies/${policyId}/mappings`,
        mappingData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Organization-Id': organizationId
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.mappings).toHaveLength(2);
    });

    it('should get policy mappings', async () => {
      const response = await axios.get(
        `${POLICY_SERVICE_URL}/api/policies/${policyId}/mappings`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Organization-Id': organizationId
          }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  describe('Policy Search and Filter', () => {
    it('should search policies by keyword', async () => {
      const response = await axios.get(
        `${POLICY_SERVICE_URL}/api/policies/search?q=security`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Organization-Id': organizationId
          }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should filter policies by status', async () => {
      const response = await axios.get(
        `${POLICY_SERVICE_URL}/api/policies?status=published`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Organization-Id': organizationId
          }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      response.data.forEach(policy => {
        expect(policy.status).toBe('published');
      });
    });

    it('should filter policies by category', async () => {
      const response = await axios.get(
        `${POLICY_SERVICE_URL}/api/policies?category=security`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Organization-Id': organizationId
          }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
    });
  });

  // Export context for next tests
  afterAll(() => {
    global.testContext = {
      ...global.testContext,
      policyId
    };
  });
});