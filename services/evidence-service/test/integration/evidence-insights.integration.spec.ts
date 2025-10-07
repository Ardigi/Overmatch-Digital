import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import type { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Evidence } from '../../src/modules/evidence/entities/evidence.entity';
import { EvidenceModule } from '../../src/modules/evidence/evidence.module';

describe('Evidence Insights Endpoint (Integration)', () => {
  let app: INestApplication;
  let evidenceRepository: Repository<Evidence>;

  const testOrganizationId = uuidv4();
  const testIntegrationId = 'test-integration';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || '127.0.0.1',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USERNAME || 'soc_user',
          password: process.env.DB_PASSWORD || 'soc_pass',
          database: process.env.DB_NAME || 'soc_evidence_test',
          entities: [Evidence],
          synchronize: true,
          dropSchema: true, // Clean database for tests
        }),
        EvidenceModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    evidenceRepository = moduleFixture.get<Repository<Evidence>>('EvidenceRepository');

    // Seed test data
    await seedTestData();
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedTestData() {
    const evidenceTypes = ['DOCUMENT', 'SCREENSHOT', 'LOG', 'CONFIGURATION'];
    const statuses = ['collected', 'approved', 'rejected', 'expired'];

    // Create evidence for the last 7 days
    const promises = [];
    for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);

      // Create 2-5 evidence items per day
      const itemsPerDay = Math.floor(Math.random() * 4) + 2;

      for (let i = 0; i < itemsPerDay; i++) {
        const evidence = evidenceRepository.create({
          title: `Test Evidence ${daysAgo}-${i}`,
          type: evidenceTypes[Math.floor(Math.random() * evidenceTypes.length)],
          status: statuses[Math.floor(Math.random() * statuses.length)],
          source: 'AUTOMATED_COLLECTION',
          clientId: testOrganizationId, // Using clientId as the field name in entity
          collectorType: i % 2 === 0 ? testIntegrationId : 'other-integration',
          collectionDate: date,
          qualityScore: Math.floor(Math.random() * 100),
          version: 1,
          isLatestVersion: true,
          viewCount: 0,
          downloadCount: 0,
          createdBy: 'test-user',
          updatedBy: 'test-user',
        });

        promises.push(evidenceRepository.save(evidence));
      }
    }

    await Promise.all(promises);
  }

  describe('GET /evidence/insights/:organizationId', () => {
    it('should return insights for organization without integration filter', async () => {
      const response = await request(app.getHttpServer())
        .get(`/evidence/insights/${testOrganizationId}`)
        .set('X-Service-Name', 'test-service')
        .set('X-Service-API-Key', 'dev-test-service-api-key')
        .expect(200);

      expect(response.body).toHaveProperty('organizationId', testOrganizationId);
      expect(response.body).toHaveProperty('statistics');
      expect(response.body.statistics).toHaveProperty('total');
      expect(response.body.statistics).toHaveProperty('byStatus');
      expect(response.body.statistics).toHaveProperty('byType');
      expect(response.body.statistics).toHaveProperty('expiringSoon');
      expect(response.body.statistics).toHaveProperty('needsReview');
      expect(response.body.statistics).toHaveProperty('averageQualityScore');

      expect(response.body).toHaveProperty('collectionTrends');
      expect(response.body.collectionTrends).toHaveProperty('daily');
      expect(Array.isArray(response.body.collectionTrends.daily)).toBe(true);
      expect(response.body.collectionTrends.daily.length).toBe(7);

      // Verify daily trends have correct structure
      response.body.collectionTrends.daily.forEach(trend => {
        expect(trend).toHaveProperty('date');
        expect(trend).toHaveProperty('count');
        expect(typeof trend.date).toBe('string');
        expect(typeof trend.count).toBe('number');
      });

      expect(response.body).toHaveProperty('qualityMetrics');
      expect(response.body.qualityMetrics).toHaveProperty('averageQualityScore');
      expect(response.body.qualityMetrics).toHaveProperty('needsReview');
      expect(response.body.qualityMetrics).toHaveProperty('expiringSoon');
    });

    it('should return insights filtered by integration', async () => {
      const response = await request(app.getHttpServer())
        .get(`/evidence/insights/${testOrganizationId}`)
        .query({ integrationId: testIntegrationId })
        .set('X-Service-Name', 'test-service')
        .set('X-Service-API-Key', 'dev-test-service-api-key')
        .expect(200);

      expect(response.body).toHaveProperty('organizationId', testOrganizationId);
      expect(response.body).toHaveProperty('integrationId', testIntegrationId);
      expect(response.body).toHaveProperty('integrationSpecific');

      const integrationMetrics = response.body.integrationSpecific;
      expect(integrationMetrics).toHaveProperty('totalCollected');
      expect(integrationMetrics).toHaveProperty('successRate');
      expect(integrationMetrics).toHaveProperty('averageProcessingTime');
      expect(integrationMetrics).toHaveProperty('lastCollectionDate');
      expect(integrationMetrics).toHaveProperty('collectionsByStatus');
      expect(integrationMetrics).toHaveProperty('recentErrors');

      expect(typeof integrationMetrics.totalCollected).toBe('number');
      expect(typeof integrationMetrics.successRate).toBe('number');
      expect(typeof integrationMetrics.averageProcessingTime).toBe('number');
      expect(Array.isArray(integrationMetrics.recentErrors)).toBe(true);
    });

    it('should handle organization with no evidence', async () => {
      const emptyOrgId = uuidv4();

      const response = await request(app.getHttpServer())
        .get(`/evidence/insights/${emptyOrgId}`)
        .set('X-Service-Name', 'test-service')
        .set('X-Service-API-Key', 'dev-test-service-api-key')
        .expect(200);

      expect(response.body.statistics.total).toBe(0);
      expect(response.body.statistics.averageQualityScore).toBe(0);
      expect(response.body.collectionTrends.daily.every(d => d.count === 0)).toBe(true);
    });

    it('should require service authentication', async () => {
      await request(app.getHttpServer())
        .get(`/evidence/insights/${testOrganizationId}`)
        .expect(401);
    });

    it('should reject invalid service API key', async () => {
      await request(app.getHttpServer())
        .get(`/evidence/insights/${testOrganizationId}`)
        .set('X-Service-Name', 'test-service')
        .set('X-Service-API-Key', 'invalid-key')
        .expect(401);
    });

    it('should handle internal server errors gracefully', async () => {
      // Test with invalid organization ID format
      await request(app.getHttpServer())
        .get('/evidence/insights/invalid-uuid')
        .set('X-Service-Name', 'test-service')
        .set('X-Service-API-Key', 'dev-test-service-api-key')
        .expect(500);
    });
  });

  describe('Daily Collection Trends', () => {
    it('should return accurate daily counts', async () => {
      const response = await request(app.getHttpServer())
        .get(`/evidence/insights/${testOrganizationId}`)
        .set('X-Service-Name', 'test-service')
        .set('X-Service-API-Key', 'dev-test-service-api-key')
        .expect(200);

      const dailyTrends = response.body.collectionTrends.daily;

      // Should have exactly 7 days
      expect(dailyTrends.length).toBe(7);

      // Each day should have some evidence (based on our seed data)
      const totalCount = dailyTrends.reduce((sum, day) => sum + day.count, 0);
      expect(totalCount).toBeGreaterThan(0);

      // Dates should be consecutive
      for (let i = 1; i < dailyTrends.length; i++) {
        const prevDate = new Date(dailyTrends[i - 1].date);
        const currDate = new Date(dailyTrends[i].date);
        const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
        expect(dayDiff).toBe(1);
      }
    });

    it('should include type breakdown for each day', async () => {
      const response = await request(app.getHttpServer())
        .get(`/evidence/insights/${testOrganizationId}`)
        .set('X-Service-Name', 'test-service')
        .set('X-Service-API-Key', 'dev-test-service-api-key')
        .expect(200);

      const dailyTrends = response.body.collectionTrends.daily;

      // At least some days should have type breakdown
      const daysWithTypes = dailyTrends.filter(
        day => day.byType && Object.keys(day.byType).length > 0
      );
      expect(daysWithTypes.length).toBeGreaterThan(0);

      // Type breakdown should have valid evidence types
      daysWithTypes.forEach(day => {
        Object.keys(day.byType).forEach(type => {
          expect(['DOCUMENT', 'SCREENSHOT', 'LOG', 'CONFIGURATION']).toContain(type);
          expect(typeof day.byType[type]).toBe('number');
          expect(day.byType[type]).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });

  describe('Integration Metrics', () => {
    it('should calculate correct success rate', async () => {
      const response = await request(app.getHttpServer())
        .get(`/evidence/insights/${testOrganizationId}`)
        .query({ integrationId: testIntegrationId })
        .set('X-Service-Name', 'test-service')
        .set('X-Service-API-Key', 'dev-test-service-api-key')
        .expect(200);

      const metrics = response.body.integrationSpecific;

      expect(metrics.successRate).toBeGreaterThanOrEqual(0);
      expect(metrics.successRate).toBeLessThanOrEqual(100);

      // Success rate should be based on approved + collected evidence
      const totalCollected = metrics.totalCollected;
      if (totalCollected > 0) {
        const successful =
          (metrics.collectionsByStatus.approved || 0) +
          (metrics.collectionsByStatus.collected || 0);
        const expectedRate = Math.round((successful / totalCollected) * 10000) / 100;
        expect(metrics.successRate).toBe(expectedRate);
      }
    });

    it('should track collections by status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/evidence/insights/${testOrganizationId}`)
        .query({ integrationId: testIntegrationId })
        .set('X-Service-Name', 'test-service')
        .set('X-Service-API-Key', 'dev-test-service-api-key')
        .expect(200);

      const statusBreakdown = response.body.integrationSpecific.collectionsByStatus;

      expect(typeof statusBreakdown).toBe('object');

      // Sum of all statuses should equal total collected
      const sumOfStatuses = Object.values(statusBreakdown).reduce((sum, count) => sum + count, 0);
      expect(sumOfStatuses).toBe(response.body.integrationSpecific.totalCollected);
    });
  });
});
