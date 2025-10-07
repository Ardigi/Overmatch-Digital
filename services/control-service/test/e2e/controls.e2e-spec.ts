// CRITICAL: Must unmock TypeORM for E2E tests
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ControlServiceE2ESetup } from './setup-minimal';
import { TestAuthHelper } from './test-auth.helper';

const controlTestSetup = new ControlServiceE2ESetup();

import { RolesGuard } from '@soc-compliance/auth-common';
import {
  Control,
  ControlCategory,
  ControlStatus,
  ControlType,
} from '../../src/modules/controls/entities/control.entity';
import { ControlImplementation } from '../../src/modules/implementation/entities/control-implementation.entity';
import { KongAuthGuard } from '../../src/shared/guards';

describe('Controls (e2e)', () => {
  let app: INestApplication;
  const mockUsers = TestAuthHelper.getMockUsers();

  beforeAll(async () => {
    // Create the app using the test setup
    app = await controlTestSetup.createTestApp();

    // Clean database before tests
    await controlTestSetup.cleanDatabase();
  });

  afterAll(async () => {
    await controlTestSetup.closeApp();
  });

  beforeEach(async () => {
    await controlTestSetup.cleanDatabase();
  });

  describe('POST /controls', () => {
    const createControlDto = {
      code: 'AC-1',
      name: 'Access Control Policy',
      description: 'Establish and maintain access control policies',
      category: 'Access Control',
      type: 'administrative',
      frequency: 'annual',
      objective: 'Ensure proper access control',
      requirements: ['Document access control policy', 'Review annually'],
      testingProcedures: ['Review policy documentation', 'Interview stakeholders'],
      evidenceRequirements: ['Policy document', 'Review records'],
      frameworks: ['SOC2', 'ISO27001'],
      tags: ['access', 'policy'],
      automationCapable: false,
      criticality: 'high',
    };

    it('should create a control with admin role', () => {
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        '/controls',
        mockUsers.admin
      )
        .send(createControlDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.code).toBe(createControlDto.code);
          expect(res.body.name).toBe(createControlDto.name);
          expect(res.body.frameworks).toEqual(createControlDto.frameworks);
        });
    });

    it('should create a control with compliance_manager role', () => {
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        '/controls',
        mockUsers.complianceManager
      )
        .send(createControlDto)
        .expect(201);
    });

    it('should reject control creation with user role', () => {
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        '/controls',
        mockUsers.user
      )
        .send(createControlDto)
        .expect(403);
    });

    it('should reject control creation with invalid data', () => {
      const invalidDto = {
        code: '', // Invalid: empty code
        name: 'Test Control',
      };

      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        '/controls',
        mockUsers.admin
      )
        .send(invalidDto)
        .expect(400);
    });

    it('should reject duplicate control codes', async () => {
      // First create a control
      await TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        '/controls',
        mockUsers.admin
      )
        .send(createControlDto)
        .expect(201);

      // Try to create another with the same code
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        '/controls',
        mockUsers.admin
      )
        .send(createControlDto)
        .expect(409);
    });
  });

  describe('GET /controls', () => {
    beforeEach(async () => {
      // Seed some test controls
      const controls = [
        {
          code: 'AC-1',
          name: 'Access Control Policy',
          description: 'Test description',
          category: 'Access Control',
          type: 'administrative',
          frequency: 'annual',
        },
        {
          code: 'AC-2',
          name: 'Account Management',
          description: 'Test description',
          category: 'Access Control',
          type: 'technical',
          frequency: 'continuous',
        },
      ];

      for (const control of controls) {
        await TestAuthHelper.createAuthenticatedRequest(
          app,
          'post',
          '/controls',
          mockUsers.admin
        )
          .send(control)
          .expect(201);
      }
    });

    it('should retrieve all controls', () => {
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'get',
        '/controls',
        mockUsers.user
      )
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('should filter controls by framework', () => {
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'get',
        '/controls?framework=SOC2',
        mockUsers.user
      )
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should filter controls by category', () => {
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'get',
        '/controls?category=Access Control',
        mockUsers.user
      )
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          res.body.forEach((control: any) => {
            expect(control.category).toBe('Access Control');
          });
        });
    });

    it('should filter controls by type', () => {
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'get',
        '/controls?type=administrative',
        mockUsers.user
      )
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          res.body.forEach((control: any) => {
            expect(control.type).toBe('administrative');
          });
        });
    });

    it('should search controls by text', () => {
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'get',
        '/controls?search=Policy',
        mockUsers.user
      )
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(1);
        });
    });
  });

  describe('GET /controls/:id', () => {
    let controlId: string;

    beforeEach(async () => {
      const response = await TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        '/controls',
        mockUsers.admin
      )
        .send({
          code: 'AC-TEST',
          name: 'Test Control',
          description: 'Test description',
          category: 'Access Control',
          type: 'administrative',
          frequency: 'annual',
        })
        .expect(201);

      controlId = response.body.id;
    });

    it('should retrieve a specific control', () => {
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'get',
        `/controls/${controlId}`,
        mockUsers.user
      )
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(controlId);
          expect(res.body.code).toBe('AC-TEST');
        });
    });

    it('should return 404 for non-existent control', () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174999';
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'get',
        `/controls/${fakeId}`,
        mockUsers.user
      )
        .expect(404);
    });
  });

  describe('PUT /controls/:id', () => {
    let controlId: string;

    beforeEach(async () => {
      const response = await TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        '/controls',
        mockUsers.admin
      )
        .send({
          code: 'AC-UPDATE',
          name: 'Original Control',
          description: 'Original description',
          category: 'Access Control',
          type: 'administrative',
          frequency: 'annual',
        })
        .expect(201);

      controlId = response.body.id;
    });

    it('should update a control with admin role', () => {
      const updateDto = {
        name: 'Updated Control',
        description: 'Updated description',
        frequency: 'quarterly',
      };

      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'put',
        `/controls/${controlId}`,
        mockUsers.admin
      )
        .send(updateDto)
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe(updateDto.name);
          expect(res.body.description).toBe(updateDto.description);
          expect(res.body.frequency).toBe(updateDto.frequency);
        });
    });

    it('should update a control with compliance_manager role', () => {
      const updateDto = {
        name: 'CM Updated Control',
      };

      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'put',
        `/controls/${controlId}`,
        mockUsers.complianceManager
      )
        .send(updateDto)
        .expect(200);
    });

    it('should reject update with user role', () => {
      const updateDto = {
        name: 'User Updated Control',
      };

      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'put',
        `/controls/${controlId}`,
        mockUsers.user
      )
        .send(updateDto)
        .expect(403);
    });
  });

  describe('DELETE /controls/:id', () => {
    let controlId: string;

    beforeEach(async () => {
      const response = await TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        '/controls',
        mockUsers.admin
      )
        .send({
          code: 'AC-DELETE',
          name: 'Control to Delete',
          description: 'Will be deleted',
          category: 'Access Control',
          type: 'administrative',
          frequency: 'annual',
        })
        .expect(201);

      controlId = response.body.id;
    });

    it('should delete a control with admin role', () => {
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'delete',
        `/controls/${controlId}`,
        mockUsers.admin
      )
        .expect(200);
    });

    it('should reject delete with user role', () => {
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'delete',
        `/controls/${controlId}`,
        mockUsers.user
      )
        .expect(403);
    });

    it('should return 404 when deleting non-existent control', () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174999';
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'delete',
        `/controls/${fakeId}`,
        mockUsers.admin
      )
        .expect(404);
    });
  });

  describe('POST /controls/:id/implementation', () => {
    let controlId: string;

    beforeEach(async () => {
      const response = await TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        '/controls',
        mockUsers.admin
      )
        .send({
          code: 'AC-IMPL',
          name: 'Control with Implementation',
          description: 'Will have implementation',
          category: 'Access Control',
          type: 'administrative',
          frequency: 'annual',
        })
        .expect(201);

      controlId = response.body.id;
    });

    it('should create control implementation', () => {
      const implementationDto = {
        organizationId: mockUsers.admin.organizationId,
        status: 'not_started',
        assignedTo: mockUsers.admin.id,
        notes: 'Implementation notes',
      };

      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        `/controls/${controlId}/implementation`,
        mockUsers.admin
      )
        .send(implementationDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.status).toBe(implementationDto.status);
          expect(res.body.notes).toBe(implementationDto.notes);
        });
    });
  });

  describe('PUT /controls/:id/implementation', () => {
    let controlId: string;

    beforeEach(async () => {
      const controlResponse = await TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        '/controls',
        mockUsers.admin
      )
        .send({
          code: 'AC-IMPL-UPDATE',
          name: 'Control with Implementation',
          description: 'Will have implementation',
          category: 'Access Control',
          type: 'administrative',
          frequency: 'annual',
        })
        .expect(201);

      controlId = controlResponse.body.id;

      // Create initial implementation
      await TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        `/controls/${controlId}/implementation`,
        mockUsers.admin
      )
        .send({
          organizationId: mockUsers.admin.organizationId,
          status: 'not_started',
          assignedTo: mockUsers.admin.id,
        })
        .expect(201);
    });

    it('should update control implementation status', () => {
      const updateDto = {
        status: 'in_progress',
        progress: 50,
        notes: 'Halfway done',
      };

      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'put',
        `/controls/${controlId}/implementation`,
        mockUsers.admin
      )
        .send(updateDto)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(updateDto.status);
          expect(res.body.progress).toBe(updateDto.progress);
          expect(res.body.notes).toBe(updateDto.notes);
        });
    });

    it('should update with compliance_manager role', () => {
      const updateDto = {
        status: 'under_review',
      };

      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'put',
        `/controls/${controlId}/implementation`,
        mockUsers.complianceManager
      )
        .send(updateDto)
        .expect(200);
    });

    it('should reject update with user role', () => {
      const updateDto = {
        status: 'completed',
      };

      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'put',
        `/controls/${controlId}/implementation`,
        mockUsers.user
      )
        .expect(403);
    });
  });

  describe('POST /controls/:id/test', () => {
    let controlId: string;

    beforeEach(async () => {
      const response = await TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        '/controls',
        mockUsers.admin
      )
        .send({
          code: 'AC-TEST-CTRL',
          name: 'Control to Test',
          description: 'Will be tested',
          category: 'Access Control',
          type: 'administrative',
          frequency: 'annual',
        })
        .expect(201);

      controlId = response.body.id;
    });

    it('should create a control test', () => {
      const testDto = {
        organizationId: mockUsers.admin.organizationId,
        testDate: new Date().toISOString(),
        testedBy: mockUsers.admin.id,
        result: 'pass',
        findings: [],
        evidence: ['Evidence 1', 'Evidence 2'],
      };

      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        `/controls/${controlId}/test`,
        mockUsers.admin
      )
        .send(testDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.result).toBe(testDto.result);
          expect(res.body.evidence).toEqual(testDto.evidence);
        });
    });
  });

  describe('GET /controls/:id/history', () => {
    let controlId: string;

    beforeEach(async () => {
      const response = await TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        '/controls',
        mockUsers.admin
      )
        .send({
          code: 'AC-HISTORY',
          name: 'Control with History',
          description: 'Has audit history',
          category: 'Access Control',
          type: 'administrative',
          frequency: 'annual',
        })
        .expect(201);

      controlId = response.body.id;

      // Make some changes to create history
      await TestAuthHelper.createAuthenticatedRequest(
        app,
        'put',
        `/controls/${controlId}`,
        mockUsers.admin
      )
        .send({
          name: 'Updated Name',
        })
        .expect(200);
    });

    it('should retrieve control history', () => {
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'get',
        `/controls/${controlId}/history`,
        mockUsers.user
      )
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('POST /controls/bulk', () => {
    it('should create multiple controls', () => {
      const bulkDto = {
        controls: [
          {
            code: 'BULK-1',
            name: 'Bulk Control 1',
            description: 'First bulk control',
            category: 'Access Control',
            type: 'administrative',
            frequency: 'annual',
          },
          {
            code: 'BULK-2',
            name: 'Bulk Control 2',
            description: 'Second bulk control',
            category: 'Access Control',
            type: 'technical',
            frequency: 'quarterly',
          },
        ],
      };

      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        '/controls/bulk',
        mockUsers.admin
      )
        .send(bulkDto)
        .expect(201)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBe(2);
        });
    });

    it('should reject bulk creation with user role', () => {
      const bulkDto = {
        controls: [
          {
            code: 'BULK-FAIL',
            name: 'Should Fail',
            description: 'Should not be created',
            category: 'Access Control',
            type: 'administrative',
            frequency: 'annual',
          },
        ],
      };

      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        '/controls/bulk',
        mockUsers.user
      )
        .send(bulkDto)
        .expect(403);
    });
  });

  describe('GET /controls/export', () => {
    beforeEach(async () => {
      // Create some controls for export
      const controls = [
        {
          code: 'EXPORT-1',
          name: 'Export Control 1',
          description: 'First export control',
          category: 'Access Control',
          type: 'administrative',
          frequency: 'annual',
        },
        {
          code: 'EXPORT-2',
          name: 'Export Control 2',
          description: 'Second export control',
          category: 'Access Control',
          type: 'technical',
          frequency: 'quarterly',
        },
      ];

      for (const control of controls) {
        await TestAuthHelper.createAuthenticatedRequest(
          app,
          'post',
          '/controls',
          mockUsers.admin
        )
          .send(control)
          .expect(201);
      }
    });

    it('should export controls to CSV', () => {
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'get',
        '/controls/export?format=csv',
        mockUsers.user
      )
        .expect(200)
        .expect('Content-Type', /text\/csv/);
    });

    it('should export controls to JSON', () => {
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'get',
        '/controls/export?format=json',
        mockUsers.user
      )
        .expect(200)
        .expect('Content-Type', /application\/json/);
    });

    it('should export controls to Excel', () => {
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'get',
        '/controls/export?format=xlsx',
        mockUsers.user
      )
        .expect(200)
        .expect(
          'Content-Type',
          /application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/
        );
    });
  });

  describe('Control Access Control', () => {
    it('should enforce organization isolation', async () => {
      // Create a control as admin from org 1
      const response = await TestAuthHelper.createAuthenticatedRequest(
        app,
        'post',
        '/controls',
        mockUsers.admin
      )
        .send({
          code: 'ORG-ISO-1',
          name: 'Organization Isolated Control',
          description: 'Should only be visible to same org',
          category: 'Access Control',
          type: 'administrative',
          frequency: 'annual',
        })
        .expect(201);

      const controlId = response.body.id;

      // Try to access from different organization (simulated)
      const differentOrgUser = {
        id: '999e4567-e89b-12d3-a456-426614174999',
        email: 'other@different.com',
        organizationId: '999e4567-e89b-12d3-a456-426614174000', // Different org
        roles: ['admin'],
      };

      // Should not be able to update control from different org
      return TestAuthHelper.createAuthenticatedRequest(
        app,
        'put',
        `/controls/${controlId}`,
        differentOrgUser
      )
        .send({
          name: 'Hacked Name',
        })
        .expect(403);
    });
  });
});