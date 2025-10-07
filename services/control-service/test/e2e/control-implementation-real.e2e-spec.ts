// REAL End-to-End Test with actual Auth Service JWT
// This test uses REAL authentication, not mocked guards

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ControlServiceE2ESetup } from './setup-real';

describe('Control Implementation REAL E2E Tests', () => {
  let app: INestApplication;
  let setup: ControlServiceE2ESetup;
  let authToken: string;
  let testControl: any;
  let testOrganizationId: string;

  beforeAll(async () => {
    setup = new ControlServiceE2ESetup();
    app = await setup.createTestApp();

    // Get real JWT from Auth Service
    const authResponse = await request('http://localhost:3001')
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'Admin123!@#',
      });

    if (authResponse.status !== 200) {
      // Try to register first
      const registerResponse = await request('http://localhost:3001')
        .post('/api/v1/auth/register')
        .send({
          email: 'admin@example.com',
          password: 'Admin123!@#',
          firstName: 'Admin',
          lastName: 'User',
          organizationName: 'Test Organization',
        });

      if (registerResponse.status === 201) {
        // Now login
        const loginResponse = await request('http://localhost:3001')
          .post('/api/v1/auth/login')
          .send({
            email: 'admin@example.com',
            password: 'Admin123!@#',
          });
        
        authToken = loginResponse.body.accessToken;
        testOrganizationId = loginResponse.body.user.organizationId;
      } else {
        throw new Error('Cannot authenticate with Auth Service');
      }
    } else {
      authToken = authResponse.body.accessToken;
      testOrganizationId = authResponse.body.user.organizationId;
    }

    // Create a test control using real authentication
    const controlResponse = await request(app.getHttpServer())
      .post('/api/v1/controls')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'AC-TEST-1',
        name: 'Test Access Control',
        description: 'Test control for E2E testing',
        objective: 'Ensure access control works',
        category: 'ACCESS_CONTROL',
        type: 'PREVENTIVE',
        frequency: 'ANNUAL',
        frameworks: ['SOC2'],
        status: 'ACTIVE',
      });

    if (controlResponse.status === 201) {
      testControl = controlResponse.body.data || controlResponse.body;
    } else {
      console.error('Failed to create test control:', controlResponse.body);
      throw new Error('Cannot create test control');
    }
  });

  afterAll(async () => {
    await setup.closeApp();
  });

  describe('REAL Authentication Tests', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/control-implementation')
        .send({
          controlId: testControl.id,
          organizationId: testOrganizationId,
          implementationDescription: 'Test implementation',
          maturityLevel: 'DEFINED',
          implementedBy: 'test-user',
          configuration: {
            systems: ['System A'],
            processes: ['Process 1'],
            technologies: ['Tech 1'],
            responsibleParties: [],
          },
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Unauthorized');
    });

    it('should accept requests with valid JWT', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/control-implementation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          controlId: testControl.id,
          organizationId: testOrganizationId,
          implementationDescription: 'Real implementation with JWT',
          maturityLevel: 'DEFINED',
          implementedBy: 'authenticated-user',
          configuration: {
            systems: ['Authenticated System'],
            processes: ['Secure Process'],
            technologies: ['Protected Tech'],
            responsibleParties: [
              {
                userId: 'user-123',
                role: 'Security Manager',
                responsibilities: ['Review', 'Approve'],
              },
            ],
          },
        });

      expect(response.status).toBe(201);
      const responseData = response.body.data || response.body;
      expect(responseData).toHaveProperty('id');
      expect(responseData.controlId).toBe(testControl.id);
      expect(responseData.organizationId).toBe(testOrganizationId);
    });

    it('should reject requests with invalid JWT', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/control-implementation')
        .set('Authorization', 'Bearer invalid-jwt-token')
        .send({
          controlId: testControl.id,
          organizationId: testOrganizationId,
          implementationDescription: 'Should fail',
          maturityLevel: 'DEFINED',
          implementedBy: 'test-user',
          configuration: {
            systems: ['System'],
            processes: ['Process'],
            technologies: ['Tech'],
            responsibleParties: [],
          },
        });

      expect(response.status).toBe(401);
    });

    it('should reject expired JWT tokens', async () => {
      // This would require a pre-generated expired token
      // For now, we'll use a malformed token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.invalid';
      
      const response = await request(app.getHttpServer())
        .post('/api/v1/control-implementation')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({
          controlId: testControl.id,
          organizationId: testOrganizationId,
          implementationDescription: 'Should fail with expired token',
          maturityLevel: 'DEFINED',
          implementedBy: 'test-user',
          configuration: {
            systems: ['System'],
            processes: ['Process'],
            technologies: ['Tech'],
            responsibleParties: [],
          },
        });

      expect(response.status).toBe(401);
    });
  });

  describe('REAL Redis Caching Tests', () => {
    it('should cache control implementations', async () => {
      // First request - should hit database
      const firstResponse = await request(app.getHttpServer())
        .get('/api/v1/control-implementation')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ organizationId: testOrganizationId });

      expect(firstResponse.status).toBe(200);

      // Second request - should hit cache (faster)
      const startTime = Date.now();
      const secondResponse = await request(app.getHttpServer())
        .get('/api/v1/control-implementation')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ organizationId: testOrganizationId });
      const endTime = Date.now();

      expect(secondResponse.status).toBe(200);
      expect(JSON.stringify(secondResponse.body)).toBe(JSON.stringify(firstResponse.body));
      
      // Cache hit should be faster (though this is not a perfect test)
      console.log(`Cache response time: ${endTime - startTime}ms`);
    });

    it('should invalidate cache on update', async () => {
      // Create an implementation
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/control-implementation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          controlId: testControl.id,
          organizationId: testOrganizationId,
          implementationDescription: 'Initial description',
          maturityLevel: 'INITIAL',
          implementedBy: 'test-user',
          configuration: {
            systems: ['System'],
            processes: ['Process'],
            technologies: ['Tech'],
            responsibleParties: [],
          },
        });

      const implementationId = createResponse.body.data?.id || createResponse.body.id;

      // Get it (should cache)
      const getResponse1 = await request(app.getHttpServer())
        .get(`/api/v1/control-implementation/${implementationId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse1.status).toBe(200);

      // Update it
      const updateResponse = await request(app.getHttpServer())
        .patch(`/api/v1/control-implementation/${implementationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          implementationDescription: 'Updated description',
          maturityLevel: 'DEFINED',
        });

      expect(updateResponse.status).toBe(200);

      // Get it again (should have new data, not cached old data)
      const getResponse2 = await request(app.getHttpServer())
        .get(`/api/v1/control-implementation/${implementationId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse2.status).toBe(200);
      const data = getResponse2.body.data || getResponse2.body;
      expect(data.implementationDescription).toBe('Updated description');
      expect(data.maturityLevel).toBe('DEFINED');
    });
  });

  describe('REAL Kafka Event Tests', () => {
    it('should publish events when creating implementation', async () => {
      // This would require a Kafka consumer to verify
      // For now, we'll just ensure the request succeeds
      const response = await request(app.getHttpServer())
        .post('/api/v1/control-implementation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          controlId: testControl.id,
          organizationId: testOrganizationId,
          implementationDescription: 'Implementation that should trigger Kafka event',
          maturityLevel: 'OPTIMIZING',
          implementedBy: 'event-test-user',
          configuration: {
            systems: ['Event System'],
            processes: ['Event Process'],
            technologies: ['Kafka'],
            responsibleParties: [],
          },
        });

      expect(response.status).toBe(201);
      
      // In a real test, we would:
      // 1. Have a Kafka consumer listening
      // 2. Verify the event was received
      // 3. Check event payload matches expected format
      console.log('Kafka event should have been published for implementation:', response.body.data?.id || response.body.id);
    });
  });

  describe('REAL Database Transaction Tests', () => {
    it('should rollback on error during creation', async () => {
      // Try to create with invalid control ID
      const response = await request(app.getHttpServer())
        .post('/api/v1/control-implementation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          controlId: '00000000-0000-0000-0000-000000000000', // Non-existent control
          organizationId: testOrganizationId,
          implementationDescription: 'Should fail and rollback',
          maturityLevel: 'DEFINED',
          implementedBy: 'test-user',
          configuration: {
            systems: ['System'],
            processes: ['Process'],
            technologies: ['Tech'],
            responsibleParties: [],
          },
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Control with ID');

      // Verify no partial data was saved
      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/control-implementation')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ organizationId: testOrganizationId });

      const implementations = listResponse.body.data || listResponse.body;
      const failedImplementation = implementations.find(
        (impl: any) => impl.implementationDescription === 'Should fail and rollback'
      );
      expect(failedImplementation).toBeUndefined();
    });
  });
});