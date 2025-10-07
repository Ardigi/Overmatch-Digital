// CRITICAL: Must unmock TypeORM for E2E tests
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ControlServiceE2ESetup } from './setup-minimal';
import { TestAuthHelper } from './test-auth.helper';

const controlTestSetup = new ControlServiceE2ESetup();

describe('Control Implementation (e2e)', () => {
  let app: INestApplication;
  let testControl: any;
  let testUser: any;

  const testOrganizationId = '123e4567-e89b-12d3-a456-426614174000';

  // Mock user data
  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    email: 'test@example.com',
    organizationId: testOrganizationId,
    roles: ['user'],
  };

  const mockAdmin = {
    id: '123e4567-e89b-12d3-a456-426614174002',
    email: 'admin@example.com',
    organizationId: testOrganizationId,
    roles: ['admin'],
  };

  beforeAll(async () => {
    // Create the app using the test setup
    app = await controlTestSetup.createTestApp();

    // Set test user for auth headers
    testUser = mockUser;

    // Clean database before tests
    await controlTestSetup.cleanDatabase();

    // Create a test control for all tests
    const dataSource = controlTestSetup.getDataSource();
    const result = await dataSource.query(
      `
      INSERT INTO controls (code, name, description, objective, category, type, frequency, frameworks, status, "tenantId", version, "createdAt", "updatedAt")
      VALUES ('AC-1', 'Access Control Policy', 'Establish and maintain access control policies', 'Ensure proper access control', 'ACCESS_CONTROL', 'PREVENTIVE', 'ANNUAL', $1, 'ACTIVE', $2, 1, NOW(), NOW())
      RETURNING *
    `,
      [JSON.stringify(['SOC2', 'ISO27001']), testOrganizationId]
    );

    testControl = result[0];
  });

  afterAll(async () => {
    await controlTestSetup.closeApp();
  });

  beforeEach(async () => {
    // Clean only implementations, keep the test control
    const dataSource = controlTestSetup.getDataSource();
    await dataSource.query('DELETE FROM control_implementations');
  });

  describe('POST /control-implementation', () => {
    const createImplementationDto = {
      controlId: '', // Will be set in tests
      organizationId: testOrganizationId,
      implementationDescription: 'We have documented procedures for this control',
      maturityLevel: 'DEFINED',
      implementedBy: '123e4567-e89b-12d3-a456-426614174001',
      configuration: {
        systems: ['Documentation System', 'Access Control System'],
        processes: ['Access Review Process', 'User Provisioning Process'],
        technologies: ['Active Directory', 'LDAP'],
        responsibleParties: [
          {
            userId: '123e4567-e89b-12d3-a456-426614174001',
            role: 'Security Manager',
            responsibilities: ['Policy maintenance', 'Access review'],
          },
        ],
      },
      documentation: [
        {
          type: 'policy',
          name: 'Access Control Policy',
          url: 'https://example.com/policy.pdf',
          version: '1.0',
        },
      ],
      costBenefit: {
        implementationCost: 5000,
        annualOperatingCost: 1000,
        riskReduction: 80,
        roi: 15.5,
        paybackPeriod: 12,
      },
    };

    it('should create implementation', async () => {
      createImplementationDto.controlId = testControl.id;

      const authHeaders = TestAuthHelper.createAuthHeaders(testUser);

      const response = await request(app.getHttpServer())
        .post('/api/v1/control-implementation')
        .set(authHeaders)
        .send(createImplementationDto);
      
      if (response.status !== 201) {
        console.log('Response status:', response.status);
        console.log('Response body:', JSON.stringify(response.body, null, 2));
      }
      
      expect(response.status).toBe(201);
      
      const responseData = response.body.data || response.body;
      expect(responseData).toHaveProperty('id');
      expect(responseData.controlId).toBe(testControl.id);
      expect(responseData.organizationId).toBe(createImplementationDto.organizationId);
      expect(responseData.implementationDescription).toBe(
        createImplementationDto.implementationDescription
      );
      expect(responseData.maturityLevel).toBe(createImplementationDto.maturityLevel);
      expect(responseData.configuration).toBeDefined();
    });

    it('should validate required fields', () => {
      const invalidDto = {
        organizationId: testOrganizationId,
        // Missing required fields
      };

      const authHeaders = TestAuthHelper.createAuthHeaders(testUser);

      return request(app.getHttpServer())
        .post('/api/v1/control-implementation')
        .set(authHeaders)
        .send(invalidDto)
        .expect(400);
    });

    it('should validate maturity level enum', () => {
      const invalidDto = {
        ...createImplementationDto,
        controlId: testControl.id,
        maturityLevel: 'invalid-level',
      };

      const authHeaders = TestAuthHelper.createAuthHeaders(testUser);

      return request(app.getHttpServer())
        .post('/api/v1/control-implementation')
        .set(authHeaders)
        .send(invalidDto)
        .expect(400);
    });

    it('should prevent duplicate implementations', async () => {
      createImplementationDto.controlId = testControl.id;

      const authHeaders = TestAuthHelper.createAuthHeaders(testUser);

      // Create first implementation
      await request(app.getHttpServer())
        .post('/control-implementation')
        .set(authHeaders)
        .send(createImplementationDto)
        .expect(201);

      // Try to create duplicate
      return request(app.getHttpServer())
        .post('/api/v1/control-implementation')
        .set(authHeaders)
        .send(createImplementationDto)
        .expect(409);
    });
  });

  describe('GET /control-implementation', () => {
    beforeEach(async () => {
      const dataSource = controlTestSetup.getDataSource();

      // Create another control for different organization using raw SQL
      const otherControlResult = await dataSource.query(
        `
        INSERT INTO controls (code, name, description, objective, category, type, frameworks, status, "tenantId", version, "createdAt", "updatedAt")
        VALUES ('AC-2', 'Account Management', 'Manage accounts', 'Manage user accounts properly', 'ACCESS_CONTROL', 'DETECTIVE', $1, 'ACTIVE', $2, 1, NOW(), NOW())
        RETURNING *
      `,
        [JSON.stringify(['SOC2']), testOrganizationId]
      );
      const otherControl = otherControlResult[0];

      // Use raw SQL to insert test implementations
      await dataSource.query(
        `
        INSERT INTO control_implementations ("controlId", "organizationId", status, "maturityLevel", "implementationDescription", "implementedBy", "createdAt", "updatedAt")
        VALUES ($1, '123e4567-e89b-12d3-a456-426614174000', 'IMPLEMENTED', 'OPTIMIZING', 'Fully automated', $2, NOW(), NOW())
      `,
        [testControl.id, mockUser.id]
      );

      await dataSource.query(
        `
        INSERT INTO control_implementations ("controlId", "organizationId", status, "maturityLevel", "implementationDescription", "implementedBy", "createdAt", "updatedAt")
        VALUES ($1, '123e4567-e89b-12d3-a456-426614174000', 'IN_PROGRESS', 'DEFINED', 'In progress', $2, NOW(), NOW())
      `,
        [otherControl.id, mockUser.id]
      );

      await dataSource.query(
        `
        INSERT INTO control_implementations ("controlId", "organizationId", status, "maturityLevel", "implementationDescription", "implementedBy", "createdAt", "updatedAt")
        VALUES ($1, '123e4567-e89b-12d3-a456-426614174002', 'NOT_STARTED', 'INITIAL', 'Not yet started', $2, NOW(), NOW())
      `,
        [testControl.id, mockUser.id]
      );
    });

    it('should get implementations for organization', () => {
      const authHeaders = TestAuthHelper.createAuthHeaders(testUser);

      return request(app.getHttpServer())
        .get('/api/v1/control-implementation')
        .set(authHeaders)
        .query({ organizationId: testOrganizationId })
        .expect(200)
        .expect((res: any) => {
          const responseData = res.body.data || res.body;
          expect(Array.isArray(responseData)).toBe(true);
          expect(responseData).toHaveLength(2);
          expect(responseData.every((impl: any) => impl.organizationId === testOrganizationId)).toBe(true);
        });
    });

    it('should filter by status', () => {
      const authHeaders = TestAuthHelper.createAuthHeaders(testUser);

      return request(app.getHttpServer())
        .get('/api/v1/control-implementation')
        .set(authHeaders)
        .query({ organizationId: testOrganizationId, status: 'IMPLEMENTED' })
        .expect(200)
        .expect((res: any) => {
          const responseData = res.body.data || res.body;
          expect(Array.isArray(responseData)).toBe(true);
          expect(responseData).toHaveLength(1);
          expect(responseData[0].status).toBe('IMPLEMENTED');
        });
    });

    it('should filter by maturity level', () => {
      const authHeaders = TestAuthHelper.createAuthHeaders(testUser);

      return request(app.getHttpServer())
        .get('/api/v1/control-implementation')
        .set(authHeaders)
        .query({ organizationId: testOrganizationId, maturityLevel: 'OPTIMIZING' })
        .expect(200)
        .expect((res: any) => {
          const responseData = res.body.data || res.body;
          expect(Array.isArray(responseData)).toBe(true);
          expect(responseData).toHaveLength(1);
          expect(responseData[0].maturityLevel).toBe('OPTIMIZING');
        });
    });
  });

  describe('PATCH /control-implementation/:id', () => {
    let implementationId: string;

    beforeEach(async () => {
      const dataSource = controlTestSetup.getDataSource();
      
      // Create implementation to update
      const result = await dataSource.query(
        `
        INSERT INTO control_implementations ("controlId", "organizationId", status, "maturityLevel", "implementationDescription", "implementedBy", "createdAt", "updatedAt")
        VALUES ($1, $2, 'IN_PROGRESS', 'INITIAL', 'Initial implementation', $3, NOW(), NOW())
        RETURNING *
      `,
        [testControl.id, testOrganizationId, mockUser.id]
      );

      implementationId = result[0].id;
    });

    it('should update implementation', () => {
      const updateDto = {
        status: 'IMPLEMENTED',
        maturityLevel: 'DEFINED',
        implementationDescription: 'Updated implementation description',
      };

      const authHeaders = TestAuthHelper.createAuthHeaders(testUser);

      return request(app.getHttpServer())
        .patch(`/api/v1/control-implementation/${implementationId}`)
        .set(authHeaders)
        .send(updateDto)
        .expect(200)
        .expect((res: any) => {
          const responseData = res.body.data || res.body;
          expect(responseData.status).toBe(updateDto.status);
          expect(responseData.maturityLevel).toBe(updateDto.maturityLevel);
          expect(responseData.implementationDescription).toBe(updateDto.implementationDescription);
        });
    });

    it('should validate update fields', () => {
      const invalidUpdate = {
        status: 'INVALID_STATUS',
      };

      const authHeaders = TestAuthHelper.createAuthHeaders(testUser);

      return request(app.getHttpServer())
        .patch(`/api/v1/control-implementation/${implementationId}`)
        .set(authHeaders)
        .send(invalidUpdate)
        .expect(400);
    });

    it('should return 404 for non-existent implementation', () => {
      const authHeaders = TestAuthHelper.createAuthHeaders(testUser);

      return request(app.getHttpServer())
        .patch('/api/v1/control-implementation/00000000-0000-0000-0000-000000000000')
        .set(authHeaders)
        .send({ status: 'IMPLEMENTED' })
        .expect(404);
    });
  });

  describe('DELETE /control-implementation/:id', () => {
    let implementationId: string;

    beforeEach(async () => {
      const dataSource = controlTestSetup.getDataSource();
      
      // Create implementation to delete
      const result = await dataSource.query(
        `
        INSERT INTO control_implementations ("controlId", "organizationId", status, "maturityLevel", "implementationDescription", "implementedBy", "createdAt", "updatedAt")
        VALUES ($1, $2, 'IN_PROGRESS', 'INITIAL', 'To be deleted', $3, NOW(), NOW())
        RETURNING *
      `,
        [testControl.id, testOrganizationId, mockAdmin.id]
      );

      implementationId = result[0].id;
    });

    it('should delete implementation as admin', () => {
      const authHeaders = TestAuthHelper.createAuthHeaders(mockAdmin);

      return request(app.getHttpServer())
        .delete(`/api/v1/control-implementation/${implementationId}`)
        .set(authHeaders)
        .expect(200);
    });

    it('should return 404 for non-existent implementation', () => {
      const authHeaders = TestAuthHelper.createAuthHeaders(mockAdmin);

      return request(app.getHttpServer())
        .delete('/api/v1/control-implementation/00000000-0000-0000-0000-000000000000')
        .set(authHeaders)
        .expect(404);
    });
  });
});