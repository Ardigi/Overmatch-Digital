// MUST be before any imports - Critical for E2E tests
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  ClientStatus,
  ClientType,
  CompanySize,
  ComplianceFramework,
  ComplianceStatus,
  Industry,
} from '../../src/modules/clients/entities/client.entity';
import { testSetup } from './setup';

describe('Clients E2E Tests', () => {
  let app: INestApplication;
  let authToken: string;
  let kongHeaders: any;

  beforeAll(async () => {
    app = await testSetup.createTestApp();
    authToken = testSetup.generateAuthToken();
    kongHeaders = testSetup.generateKongHeaders();
  });

  afterAll(async () => {
    await testSetup.closeApp();
  });

  beforeEach(async () => {
    await testSetup.cleanDatabase();
  });

  describe('/clients (POST)', () => {
    it('should create a new client', async () => {
      const createData = {
        name: 'New Client Inc',
        clientType: ClientType.DIRECT,
        industry: Industry.TECHNOLOGY,
        size: CompanySize.MEDIUM,
        targetFrameworks: [ComplianceFramework.SOC2_TYPE2],
        contactInfo: {
          primaryContact: {
            name: 'Jane Doe',
            email: 'jane@newclient.com',
            phone: '+1234567890',
            title: 'CEO',
          },
        },
        address: {
          headquarters: {
            street1: '456 Business Ave',
            city: 'Tech City',
            state: 'CA',
            postalCode: '94000',
            country: 'US',
          },
        },
      };

      const response = await request(app.getHttpServer())
        .post('/clients')
        .set(kongHeaders)
        .send(createData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(createData.name);
      expect(response.body.slug).toMatch(/^new-client-inc/); // Slug may include timestamp
      expect(response.body.clientType).toBe(createData.clientType);
      expect(response.body.status).toBe(ClientStatus.PENDING);
      expect(response.body.complianceStatus).toBe(ComplianceStatus.NOT_STARTED);
    });

    it('should reject duplicate client names', async () => {
      await testSetup.seedTestClient({ name: 'Existing Client' });

      const createData = {
        name: 'Existing Client',
        clientType: ClientType.DIRECT,
        industry: Industry.TECHNOLOGY,
      };

      await request(app.getHttpServer())
        .post('/clients')
        .set(kongHeaders)
        .send(createData)
        .expect(409);
    });

    it('should validate required fields', async () => {
      const createData = {
        // Missing required name field
        clientType: ClientType.DIRECT,
      };

      await request(app.getHttpServer())
        .post('/clients')
        .set(kongHeaders)
        .send(createData)
        .expect(400);
    });

    it('should reject without authentication', async () => {
      const createData = {
        name: 'Test Client',
        clientType: ClientType.DIRECT,
      };

      await request(app.getHttpServer()).post('/clients').send(createData).expect(403); // KongAuthGuard returns 403 when headers are missing
    });
  });

  describe('/clients (GET)', () => {
    it('should return paginated list of clients', async () => {
      // Seed multiple clients
      await testSetup.seedTestClient({ name: 'Client 1' });
      await testSetup.seedTestClient({ name: 'Client 2' });
      await testSetup.seedTestClient({ name: 'Client 3' });

      const response = await request(app.getHttpServer())
        .get('/clients')
        .set(kongHeaders)
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.total).toBe(3);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(2);
      expect(response.body.meta.totalPages).toBe(2);
    });

    it('should filter by status', async () => {
      await testSetup.seedTestClient({
        name: 'Active Client',
        status: ClientStatus.ACTIVE,
      });
      await testSetup.seedTestClient({
        name: 'Inactive Client',
        status: ClientStatus.INACTIVE,
      });

      const response = await request(app.getHttpServer())
        .get('/clients')
        .set(kongHeaders)
        .query({ status: ClientStatus.ACTIVE })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe(ClientStatus.ACTIVE);
    });

    it('should filter by compliance status', async () => {
      await testSetup.seedTestClient({
        name: 'Compliant Client',
        complianceStatus: ComplianceStatus.COMPLIANT,
      });
      await testSetup.seedTestClient({
        name: 'Non-Compliant Client',
        complianceStatus: ComplianceStatus.NON_COMPLIANT,
      });

      const response = await request(app.getHttpServer())
        .get('/clients')
        .set(kongHeaders)
        .query({ complianceStatus: ComplianceStatus.COMPLIANT })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].complianceStatus).toBe(ComplianceStatus.COMPLIANT);
    });

    it('should search by name', async () => {
      await testSetup.seedTestClient({ name: 'Acme Corporation' });
      await testSetup.seedTestClient({ name: 'Tech Innovations' });
      await testSetup.seedTestClient({ name: 'Global Solutions' });

      const response = await request(app.getHttpServer())
        .get('/clients')
        .set(kongHeaders)
        .query({ search: 'Tech' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toContain('Tech');
    });

    it('should sort results', async () => {
      await testSetup.seedTestClient({ name: 'Alpha Corp' });
      await testSetup.seedTestClient({ name: 'Beta Inc' });
      await testSetup.seedTestClient({ name: 'Gamma LLC' });

      const response = await request(app.getHttpServer())
        .get('/clients')
        .set(kongHeaders)
        .query({ sortBy: 'name', sortOrder: 'ASC' })
        .expect(200);

      expect(response.body.data[0].name).toBe('Alpha Corp');
      expect(response.body.data[1].name).toBe('Beta Inc');
      expect(response.body.data[2].name).toBe('Gamma LLC');
    });
  });

  describe('/clients/:id (GET)', () => {
    it('should return client by ID', async () => {
      const client = await testSetup.seedTestClient({ name: 'Test Client' });

      const response = await request(app.getHttpServer())
        .get(`/clients/${client.id}`)
        .set(kongHeaders)
        .expect(200);

      expect(response.body.id).toBe(client.id);
      expect(response.body.name).toBe('Test Client');
    });

    it('should return 404 for non-existent client', async () => {
      await request(app.getHttpServer())
        .get('/clients/00000000-0000-0000-0000-000000000000')
        .set(kongHeaders)
        .expect(404);
    });
  });

  describe('/clients/slug/:slug (GET)', () => {
    it('should return client by slug', async () => {
      const client = await testSetup.seedTestClient({ name: 'Test Client' });

      const response = await request(app.getHttpServer())
        .get(`/clients/by-slug/${client.slug}`)
        .set(kongHeaders)
        .expect(200);

      expect(response.body.id).toBe(client.id);
      expect(response.body.slug).toBe(client.slug);
    });
  });

  describe('/clients/:id (PUT)', () => {
    it('should update client details', async () => {
      const client = await testSetup.seedTestClient({ name: 'Original Name' });

      const updateData = {
        name: 'Updated Name',
        industry: Industry.FINANCE,
        employeeCount: 500,
      };

      const response = await request(app.getHttpServer())
        .put(`/clients/${client.id}`)
        .set(kongHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
      expect(response.body.industry).toBe(Industry.FINANCE);
      expect(response.body.employeeCount).toBe(500);
    });

    it('should validate update data', async () => {
      const client = await testSetup.seedTestClient();

      const updateData = {
        email: 'invalid-email', // Invalid email format
        employeeCount: -100, // Invalid negative number
      };

      await request(app.getHttpServer())
        .put(`/clients/${client.id}`)
        .set(kongHeaders)
        .send(updateData)
        .expect(400);
    });
  });

  describe('/clients/:id/compliance-status (PUT)', () => {
    it('should update compliance status', async () => {
      const client = await testSetup.seedTestClient({
        complianceStatus: ComplianceStatus.NOT_STARTED,
      });

      const updateData = {
        status: ComplianceStatus.IMPLEMENTATION,
        notes: 'Started implementation phase',
      };

      const response = await request(app.getHttpServer())
        .put(`/clients/${client.id}/compliance-status`)
        .set(kongHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.complianceStatus).toBe(ComplianceStatus.IMPLEMENTATION);
      expect(response.body.complianceScore).toBeGreaterThan(0);
    });
  });

  describe('/clients/:id/archive (DELETE)', () => {
    it('should archive client', async () => {
      const client = await testSetup.seedTestClient();

      await request(app.getHttpServer())
        .delete(`/clients/${client.id}`)
        .set(kongHeaders)
        .expect(204);

      // Verify client is archived
      await request(app.getHttpServer()).get(`/clients/${client.id}`).set(kongHeaders).expect(404);
    });
  });

  describe('/clients/:id/restore (POST)', () => {
    it('should restore archived client', async () => {
      const client = await testSetup.seedTestClient();

      // Archive first
      await request(app.getHttpServer())
        .delete(`/clients/${client.id}`)
        .set(kongHeaders)
        .expect(204);

      // Then restore
      const response = await request(app.getHttpServer())
        .post(`/clients/${client.id}/restore`)
        .set(kongHeaders)
        .expect(201); // POST returns 201

      expect(response.body.status).toBe(ClientStatus.INACTIVE);
      expect(response.body.isDeleted).toBe(false);
    });
  });

  describe('/clients/dashboard/stats (GET)', () => {
    it('should return dashboard statistics', async () => {
      // Seed various clients
      await testSetup.seedTestClient({
        status: ClientStatus.ACTIVE,
        complianceStatus: ComplianceStatus.COMPLIANT,
      });
      await testSetup.seedTestClient({
        status: ClientStatus.ACTIVE,
        complianceStatus: ComplianceStatus.IMPLEMENTATION,
      });
      await testSetup.seedTestClient({
        status: ClientStatus.INACTIVE,
        complianceStatus: ComplianceStatus.NOT_STARTED,
      });

      const response = await request(app.getHttpServer())
        .get('/clients/dashboard/stats')
        .set(kongHeaders)
        .expect(200);

      expect(response.body).toHaveProperty('totalClients', 3);
      expect(response.body).toHaveProperty('activeClients', 2);
      expect(response.body).toHaveProperty('clientsByStatus');
      expect(response.body).toHaveProperty('clientsByCompliance');
      expect(response.body).toHaveProperty('averageComplianceScore');
    });
  });

  describe('/clients/upcoming-audits (GET)', () => {
    it('should return clients with upcoming audits', async () => {
      const client1 = await testSetup.seedTestClient({
        name: 'Client 1',
        status: ClientStatus.ACTIVE,
      });
      const client2 = await testSetup.seedTestClient({
        name: 'Client 2',
        status: ClientStatus.ACTIVE,
      });

      // Set audit dates
      const dataSource = testSetup.getDataSource();
      const clientRepo = dataSource.getRepository('Client');

      await clientRepo.update(client1.id, {
        nextAuditDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });
      await clientRepo.update(client2.id, {
        nextAuditDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 120 days
      });

      const response = await request(app.getHttpServer())
        .get('/clients/upcoming-audits')
        .set(kongHeaders)
        .query({ days: 90 })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(client1.id);
      expect(response.body.meta.daysAhead).toBe(90);
    });
  });

  describe('/clients/:id/onboarding/start (POST)', () => {
    it('should start client onboarding', async () => {
      const client = await testSetup.seedTestClient({
        status: ClientStatus.PENDING,
      });

      const startData = {
        clientId: client.id,
        projectManagerId: '123e4567-e89b-12d3-a456-426614174000',
        customTasks: ['Setup initial meeting', 'Review requirements'],
      };

      const response = await request(app.getHttpServer())
        .post('/clients/onboarding/start')
        .set(kongHeaders)
        .send(startData)
        .expect(201); // POST typically returns 201

      expect(response.body.status).toBe(ClientStatus.ACTIVE);
      expect(response.body.onboardingStartDate).toBeTruthy();
    });

    it('should reject if onboarding already started', async () => {
      const client = await testSetup.seedTestClient();

      // Update to have onboarding start date
      const dataSource = testSetup.getDataSource();
      await dataSource.getRepository('Client').update(client.id, {
        onboardingStartDate: new Date(),
      });

      const startData = {
        clientId: client.id,
      };

      await request(app.getHttpServer())
        .post('/clients/onboarding/start')
        .set(kongHeaders)
        .send(startData)
        .expect(400);
    });
  });

  describe('Authorization Tests', () => {
    it('should reject requests without authentication', async () => {
      await request(app.getHttpServer()).get('/clients').expect(403); // KongAuthGuard returns 403 when headers are missing

      await request(app.getHttpServer())
        .post('/clients')
        .send({ name: 'Test', clientType: ClientType.DIRECT })
        .expect(403); // KongAuthGuard returns 403 when headers are missing
    });

    it('should handle role-based access control', async () => {
      const viewerHeaders = testSetup.generateKongHeaders(
        'viewer-123',
        'viewer@example.com',
        'org-123',
        ['auditor']
      );

      // Viewers/auditors should be able to read
      await request(app.getHttpServer()).get('/clients').set(viewerHeaders).expect(200);

      // But not create (not in allowed roles)
      await request(app.getHttpServer())
        .post('/clients')
        .set(viewerHeaders)
        .send({ name: 'Test', clientType: ClientType.DIRECT })
        .expect(403);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      await request(app.getHttpServer())
        .post('/clients')
        .set(kongHeaders)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });

    it('should handle invalid UUIDs', async () => {
      await request(app.getHttpServer()).get('/clients/invalid-uuid').set(kongHeaders).expect(400);
    });
  });
});
