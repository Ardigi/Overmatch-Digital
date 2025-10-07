import axios from 'axios';
import { waitFor, checkServiceHealth } from '../setup';

describe('E2E: Organization Setup Flow', () => {
  const CLIENT_SERVICE_URL = 'http://localhost:3002';
  
  let accessToken: string;
  let organizationId: string;
  let userId: string;

  beforeAll(async () => {
    // Wait for client service to be healthy
    await waitFor(() => checkServiceHealth(CLIENT_SERVICE_URL));

    // Get tokens from previous test or create new ones
    if (global.testContext) {
      accessToken = global.testContext.accessToken;
      organizationId = global.testContext.organizationId;
      userId = global.testContext.userId;
    } else {
      // Register a new user for standalone test
      const authResponse = await axios.post(
        'http://localhost:3001/api/auth/register',
        {
          email: `org-test-${Date.now()}@soc-platform.com`,
          password: 'OrgTest123!',
          firstName: 'Org',
          lastName: 'Test',
          organizationName: 'Test Organization Setup'
        }
      );
      
      accessToken = authResponse.data.tokens.accessToken;
      organizationId = authResponse.data.user.organizationId;
      userId = authResponse.data.user.id;
    }
  });

  describe('Organization Management', () => {
    it('should retrieve organization details', async () => {
      const response = await axios.get(
        `${CLIENT_SERVICE_URL}/api/organizations/${organizationId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('name');
      expect(response.data.id).toBe(organizationId);
    });

    it('should update organization details', async () => {
      const updateData = {
        name: 'Updated Organization Name',
        industry: 'Technology',
        size: 'medium',
        description: 'A technology company focused on compliance',
        website: 'https://example.com'
      };

      const response = await axios.patch(
        `${CLIENT_SERVICE_URL}/api/organizations/${organizationId}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.name).toBe(updateData.name);
      expect(response.data.industry).toBe(updateData.industry);
    });

    it('should configure organization settings', async () => {
      const settings = {
        notifications: {
          email: true,
          sms: false,
          webhook: true
        },
        security: {
          mfaRequired: true,
          sessionTimeout: 3600,
          passwordPolicy: {
            minLength: 12,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true
          }
        },
        compliance: {
          frameworks: ['SOC2', 'ISO27001'],
          auditFrequency: 'quarterly'
        }
      };

      const response = await axios.put(
        `${CLIENT_SERVICE_URL}/api/organizations/${organizationId}/settings`,
        settings,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.notifications.email).toBe(true);
      expect(response.data.security.mfaRequired).toBe(true);
      expect(response.data.compliance.frameworks).toContain('SOC2');
    });
  });

  describe('Team Management', () => {
    let invitationId: string;

    it('should invite team members', async () => {
      const inviteData = {
        email: `team-member-${Date.now()}@example.com`,
        role: 'auditor',
        firstName: 'Team',
        lastName: 'Member',
        permissions: ['read:policies', 'write:evidence']
      };

      const response = await axios.post(
        `${CLIENT_SERVICE_URL}/api/organizations/${organizationId}/invitations`,
        inviteData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.email).toBe(inviteData.email);
      expect(response.data.status).toBe('pending');
      
      invitationId = response.data.id;
    });

    it('should list team members', async () => {
      const response = await axios.get(
        `${CLIENT_SERVICE_URL}/api/organizations/${organizationId}/members`,
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
      expect(response.data[0]).toHaveProperty('email');
      expect(response.data[0]).toHaveProperty('role');
    });

    it('should update team member role', async () => {
      const updateData = {
        role: 'admin',
        permissions: ['read:all', 'write:all']
      };

      const response = await axios.patch(
        `${CLIENT_SERVICE_URL}/api/organizations/${organizationId}/members/${userId}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.role).toBe('admin');
    });

    it('should list pending invitations', async () => {
      const response = await axios.get(
        `${CLIENT_SERVICE_URL}/api/organizations/${organizationId}/invitations`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      const pendingInvites = response.data.filter(inv => inv.status === 'pending');
      expect(pendingInvites.length).toBeGreaterThan(0);
    });

    it('should cancel invitation', async () => {
      if (!invitationId) {
        return; // Skip if no invitation was created
      }

      const response = await axios.delete(
        `${CLIENT_SERVICE_URL}/api/organizations/${organizationId}/invitations/${invitationId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(200);
    });
  });

  describe('Department Management', () => {
    let departmentId: string;

    it('should create department', async () => {
      const departmentData = {
        name: 'Engineering',
        description: 'Engineering and Development',
        managerId: userId,
        members: [userId]
      };

      const response = await axios.post(
        `${CLIENT_SERVICE_URL}/api/organizations/${organizationId}/departments`,
        departmentData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.name).toBe(departmentData.name);
      
      departmentId = response.data.id;
    });

    it('should list departments', async () => {
      const response = await axios.get(
        `${CLIENT_SERVICE_URL}/api/organizations/${organizationId}/departments`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
    });

    it('should update department', async () => {
      const updateData = {
        name: 'Engineering & DevOps',
        description: 'Engineering, Development, and Operations'
      };

      const response = await axios.patch(
        `${CLIENT_SERVICE_URL}/api/organizations/${organizationId}/departments/${departmentId}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.name).toBe(updateData.name);
    });

    it('should delete department', async () => {
      const response = await axios.delete(
        `${CLIENT_SERVICE_URL}/api/organizations/${organizationId}/departments/${departmentId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(200);
    });
  });

  describe('Compliance Framework Selection', () => {
    it('should select compliance frameworks', async () => {
      const frameworkData = {
        frameworks: [
          {
            type: 'SOC2',
            version: '2017',
            trustServiceCriteria: ['CC', 'A', 'C']
          },
          {
            type: 'ISO27001',
            version: '2022'
          }
        ],
        primaryFramework: 'SOC2'
      };

      const response = await axios.post(
        `${CLIENT_SERVICE_URL}/api/organizations/${organizationId}/frameworks`,
        frameworkData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.frameworks).toHaveLength(2);
      expect(response.data.primaryFramework).toBe('SOC2');
    });

    it('should get selected frameworks', async () => {
      const response = await axios.get(
        `${CLIENT_SERVICE_URL}/api/organizations/${organizationId}/frameworks`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('frameworks');
      expect(response.data).toHaveProperty('primaryFramework');
    });
  });

  describe('Organization Onboarding Status', () => {
    it('should get onboarding progress', async () => {
      const response = await axios.get(
        `${CLIENT_SERVICE_URL}/api/organizations/${organizationId}/onboarding`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
      expect(response.data).toHaveProperty('completedSteps');
      expect(response.data).toHaveProperty('totalSteps');
      expect(response.data).toHaveProperty('percentComplete');
    });

    it('should mark onboarding step as complete', async () => {
      const response = await axios.post(
        `${CLIENT_SERVICE_URL}/api/organizations/${organizationId}/onboarding/complete`,
        {
          step: 'organization_details'
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.completedSteps).toContain('organization_details');
    });
  });

  // Export context for next tests
  afterAll(() => {
    global.testContext = {
      ...global.testContext,
      organizationId,
      accessToken,
      userId
    };
  });
});