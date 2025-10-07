import { BullModule } from '@nestjs/bull';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { AppModule } from './app.module';
import { ReportFormat, ReportStatus } from './modules/reports/entities/report.entity';
import { DeliveryMethod } from './modules/reports/entities/report-schedule.entity';

describe('Reporting Service Integration Tests', () => {
  let app: INestApplication;
  let authToken: string;
  let reportId: string;
  let templateId: string;
  let scheduleId: string;
  let jwtService: JwtService;

  const mockUser = {
    id: 'user-123',
    email: 'admin@example.com',
    organizationId: 'org-123',
    roles: ['admin', 'compliance_manager'],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            type: 'sqlite',
            database: ':memory:',
            entities: ['src/**/*.entity{.ts,.js}'],
            synchronize: true,
            logging: false,
          }),
          inject: [ConfigService],
        }),
        EventEmitterModule.forRoot(),
        ScheduleModule.forRoot(),
        BullModule.forRoot({
          redis: {
            host: 'localhost',
            port: 6379,
          },
        }),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Get JWT service for creating tokens
    jwtService = moduleFixture.get(JwtService);

    // Apply global pipes, filters, etc.
    app.setGlobalPrefix('api/v1');

    await app.init();

    // Generate auth token
    authToken = await jwtService.sign(mockUser);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Report Generation Workflow', () => {
    let templateId: string;
    let reportId: string;

    describe('Template Creation', () => {
      it('should create report template', async () => {
        const createTemplateDto = {
          name: 'SOC 2 Type II Compliance Report',
          description: 'Standard template for SOC 2 Type II compliance reporting',
          reportType: 'SOC2_TYPE_II',
          format: 'PDF',
          templateContent: `
            <html>
              <head>
                <title>{{title}}</title>
              </head>
              <body>
                <h1>{{title}}</h1>
                <h2>Executive Summary</h2>
                <p>{{summary}}</p>
                <h2>Compliance Status</h2>
                <p>Overall Score: {{overallScore}}%</p>
              </body>
            </html>
          `,
          configuration: {
            pageSize: 'A4',
            orientation: 'portrait',
            margins: { top: 20, bottom: 20, left: 15, right: 15 },
            fonts: ['Arial', 'Times New Roman'],
            watermark: true,
            headerTemplate: '<div>{{organizationName}} - Confidential</div>',
            footerTemplate:
              '<div>Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
          },
          parameters: {
            periodStart: {
              type: 'date',
              required: true,
              description: 'Reporting period start date',
            },
            periodEnd: { type: 'date', required: true, description: 'Reporting period end date' },
            includeEvidence: {
              type: 'boolean',
              default: true,
              description: 'Include evidence attachments',
            },
            includeFindings: {
              type: 'boolean',
              default: true,
              description: 'Include detailed findings',
            },
            includeRecommendations: {
              type: 'boolean',
              default: true,
              description: 'Include recommendations',
            },
          },
          defaultSections: [
            { id: 'executive-summary', name: 'Executive Summary', order: 1 },
            { id: 'scope', name: 'Scope and Objectives', order: 2 },
            { id: 'compliance-status', name: 'Compliance Status', order: 3 },
            { id: 'control-assessment', name: 'Control Assessment', order: 4 },
            { id: 'findings', name: 'Findings and Observations', order: 5 },
            { id: 'recommendations', name: 'Recommendations', order: 6 },
            { id: 'appendices', name: 'Appendices', order: 7 },
          ],
        };

        const response = await request(app.getHttpServer())
          .post('/api/v1/reports/templates')
          .set('Authorization', `Bearer ${authToken}`)
          .send(createTemplateDto)
          .expect(201);

        expect(response.body).toMatchObject({
          name: 'SOC 2 Type II Compliance Report',
          reportType: 'SOC2_TYPE_II',
          format: 'PDF',
          isActive: true,
          organizationId: mockUser.organizationId,
          createdBy: mockUser.id,
        });

        templateId = response.body.id;
      });

      it('should list available templates', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/reports/templates')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body[0]).toHaveProperty('id', templateId);
      });

      it('should update template', async () => {
        const updateDto = {
          name: 'SOC 2 Type II Report - Updated',
          configuration: {
            pageSize: 'Letter',
            watermark: false,
          },
        };

        const response = await request(app.getHttpServer())
          .put(`/api/v1/reports/templates/${templateId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateDto)
          .expect(200);

        expect(response.body.name).toBe('SOC 2 Type II Report - Updated');
        expect(response.body.configuration.pageSize).toBe('Letter');
      });
    });

    describe('Report Generation', () => {
      it('should generate report using template', async () => {
        const generateDto = {
          templateId,
          reportType: 'SOC2_TYPE_II',
          title: 'Q4 2023 SOC 2 Type II Compliance Report',
          description: 'Quarterly compliance assessment for SOC 2 controls',
          format: 'PDF',
          parameters: {
            periodStart: '2023-10-01',
            periodEnd: '2023-12-31',
            includeEvidence: true,
            includeFindings: true,
            includeRecommendations: true,
          },
          sections: [
            'executive-summary',
            'compliance-status',
            'control-assessment',
            'findings',
            'recommendations',
          ],
          filters: {
            severity: ['critical', 'high', 'medium'],
            controlFrameworks: ['SOC2'],
            excludeResolved: true,
          },
        };

        const response = await request(app.getHttpServer())
          .post('/api/v1/reports/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send(generateDto)
          .expect(201);

        expect(response.body).toMatchObject({
          reportId: expect.any(String),
          status: expect.stringMatching(/PENDING|PROCESSING|COMPLETED/),
          format: 'PDF',
        });

        reportId = response.body.reportId;

        // In real scenario, report generation would be async
        // For testing, we'll check the report was created
        const reportCheck = await request(app.getHttpServer())
          .get(`/api/v1/reports/${reportId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(reportCheck.body.id).toBe(reportId);
      });

      it('should generate custom report without template', async () => {
        const generateDto = {
          reportType: 'CUSTOM',
          title: 'Custom Security Assessment',
          description: 'Ad-hoc security assessment report',
          format: 'EXCEL',
          sections: [
            { id: 'summary', name: 'Summary', content: 'Executive summary content' },
            {
              id: 'vulnerabilities',
              name: 'Vulnerabilities',
              content: 'Security vulnerabilities found',
            },
            { id: 'recommendations', name: 'Recommendations', content: 'Security recommendations' },
          ],
        };

        const response = await request(app.getHttpServer())
          .post('/api/v1/reports/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send(generateDto)
          .expect(201);

        expect(response.body).toHaveProperty('reportId');
        expect(response.body.format).toBe('EXCEL');
      });
    });

    describe('Report Management', () => {
      it('should list generated reports', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/reports')
          .query({
            status: ReportStatus.COMPLETED,
            reportType: 'SOC2_TYPE_II',
            page: 1,
            limit: 10,
          })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          data: expect.any(Array),
          pagination: {
            page: 1,
            limit: 10,
            total: expect.any(Number),
            pages: expect.any(Number),
          },
        });
      });

      it('should filter reports by date range', async () => {
        const response = await request(app.getHttpServer())
          .get('/api/v1/reports')
          .query({
            startDate: '2023-01-01',
            endDate: '2023-12-31',
          })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.data).toBeInstanceOf(Array);
      });

      it('should get specific report details', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/reports/${reportId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          id: reportId,
          organizationId: mockUser.organizationId,
          title: expect.any(String),
          reportType: expect.any(String),
        });
      });

      it('should handle report download', async () => {
        // Note: This would typically download the actual file
        // For testing, we're checking the endpoint exists
        await request(app.getHttpServer())
          .get(`/api/v1/reports/${reportId}/download`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect((res) => {
            // Either 200 with file or 404 if file not yet generated
            expect([200, 404]).toContain(res.status);
          });
      });
    });
  });

  describe('Report Scheduling', () => {
    let scheduleId: string;

    it('should create report schedule', async () => {
      const createScheduleDto = {
        reportTemplateId: templateId,
        name: 'Monthly SOC 2 Report',
        description: 'Automated monthly SOC 2 compliance report',
        cronExpression: '0 0 1 * *', // First day of each month
        timezone: 'America/New_York',
        recipients: ['compliance@example.com', 'cfo@example.com', 'cto@example.com'],
        format: 'PDF',
        parameters: {
          includeEvidence: true,
          includeFindings: true,
          includeRecommendations: true,
        },
        filters: {
          severity: ['critical', 'high'],
          excludeResolved: false,
        },
        deliveryMethod: 'email',
        deliveryConfig: {
          emailSubject: 'Monthly SOC 2 Compliance Report - {{month}} {{year}}',
          emailBody:
            'Please find attached the monthly SOC 2 compliance report for {{month}} {{year}}.',
          attachReport: true,
          includeExecutiveSummary: true,
        },
        isActive: true,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createScheduleDto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Monthly SOC 2 Report',
        cronExpression: '0 0 1 * *',
        isActive: true,
        organizationId: mockUser.organizationId,
        createdBy: mockUser.id,
      });

      scheduleId = response.body.id;
    });

    it('should list schedules', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should update schedule', async () => {
      const updateDto = {
        cronExpression: '0 0 15 * *', // 15th of each month
        recipients: ['compliance@example.com', 'management@example.com'],
      };

      const response = await request(app.getHttpServer())
        .put(`/api/v1/reports/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto)
        .expect(200);

      expect(response.body.cronExpression).toBe('0 0 15 * *');
      expect(response.body.recipients).toHaveLength(2);
    });

    it('should pause schedule', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/reports/schedules/${scheduleId}/pause`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({ message: 'Schedule paused successfully' });
    });

    it('should resume schedule', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/reports/schedules/${scheduleId}/resume`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({ message: 'Schedule resumed successfully' });
    });

    it('should trigger immediate execution', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/reports/schedules/${scheduleId}/run`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({ message: 'Schedule execution started' });
    });
  });

  describe('Analytics and Insights', () => {
    it('should get reporting summary', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/analytics/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        reportCounts: {
          byStatus: expect.any(Object),
          byType: expect.any(Object),
          total: expect.any(Number),
        },
        storage: {
          totalSize: expect.any(Number),
          reportCount: expect.any(Number),
          averageSize: expect.any(Number),
        },
        schedules: {
          active: expect.any(Number),
        },
      });
    });
  });

  describe('Access Control', () => {
    it('should allow viewers to list and download reports', async () => {
      const viewerUser = { ...mockUser, roles: ['viewer'] };
      const viewerToken = jwtService.sign(viewerUser);

      // List reports
      await request(app.getHttpServer())
        .get('/api/v1/reports')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      // Get report (if exists)
      if (reportId) {
        await request(app.getHttpServer())
          .get(`/api/v1/reports/${reportId}`)
          .set('Authorization', `Bearer ${viewerToken}`)
          .expect(200);
      }
    });

    it('should restrict template creation to admins and managers', async () => {
      const viewerUser = { ...mockUser, roles: ['viewer'] };
      const viewerToken = jwtService.sign(viewerUser);

      await request(app.getHttpServer())
        .post('/api/v1/reports/templates')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Test Template' })
        .expect(403);
    });

    it('should restrict schedule management to admins and managers', async () => {
      const auditorUser = { ...mockUser, roles: ['auditor'] };
      const auditorToken = jwtService.sign(auditorUser);

      await request(app.getHttpServer())
        .post('/api/v1/reports/schedules')
        .set('Authorization', `Bearer ${auditorToken}`)
        .send({ name: 'Test Schedule' })
        .expect(403);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid template ID', async () => {
      const generateDto = {
        templateId: 'non-existent-template',
        reportType: 'SOC2_TYPE_II',
        title: 'Test Report',
        format: 'PDF',
      };

      await request(app.getHttpServer())
        .post('/api/v1/reports/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateDto)
        .expect(404);
    });

    it('should validate cron expression', async () => {
      const createScheduleDto = {
        reportTemplateId: templateId,
        name: 'Invalid Schedule',
        cronExpression: 'invalid-cron',
        recipients: ['test@example.com'],
        format: 'PDF',
      };

      await request(app.getHttpServer())
        .post('/api/v1/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createScheduleDto)
        .expect(400);
    });

    it('should handle missing required parameters', async () => {
      const generateDto = {
        reportType: 'SOC2_TYPE_II',
        // Missing title
        format: 'PDF',
      };

      await request(app.getHttpServer())
        .post('/api/v1/reports/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(generateDto)
        .expect(400);
    });
  });

  describe('Multi-Format Support', () => {
    const formats = ['PDF', 'EXCEL', 'WORD', 'CSV', 'JSON'];

    formats.forEach((format) => {
      it(`should generate report in ${format} format`, async () => {
        const generateDto = {
          reportType: 'CUSTOM',
          title: `Test Report in ${format}`,
          format,
          sections: [{ id: 'test', name: 'Test Section', content: 'Test content' }],
        };

        const response = await request(app.getHttpServer())
          .post('/api/v1/reports/generate')
          .set('Authorization', `Bearer ${authToken}`)
          .send(generateDto)
          .expect(201);

        expect(response.body.format).toBe(format);
      });
    });
  });

  describe('Performance Testing', () => {
    it('should handle concurrent report generation', async () => {
      const generateRequests = Array(5)
        .fill(null)
        .map((_, i) => ({
          reportType: 'CUSTOM',
          title: `Concurrent Report ${i}`,
          format: 'PDF',
          sections: [{ id: 'summary', name: 'Summary', content: `Report ${i} content` }],
        }));

      const responses = await Promise.all(
        generateRequests.map((dto) =>
          request(app.getHttpServer())
            .post('/api/v1/reports/generate')
            .set('Authorization', `Bearer ${authToken}`)
            .send(dto)
        )
      );

      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('reportId');
      });
    });

    it('should paginate large result sets efficiently', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports')
        .query({
          page: 1,
          limit: 100,
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 100,
      });
      expect(response.body.data.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Template Preview', () => {
    it('should preview template with sample data', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/reports/templates/${templateId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'PDF',
          sampleData: true,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        previewUrl: expect.stringContaining('/api/v1/reports/preview/'),
        pageCount: expect.any(Number),
        estimatedSize: expect.any(Number),
      });
    });
  });

  describe('Cleanup Operations', () => {
    it('should delete report', async () => {
      if (reportId) {
        const response = await request(app.getHttpServer())
          .delete(`/api/v1/reports/${reportId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toEqual({ message: 'Report deleted successfully' });
      }
    });

    it('should delete schedule', async () => {
      if (scheduleId) {
        const response = await request(app.getHttpServer())
          .delete(`/api/v1/reports/schedules/${scheduleId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toEqual({ message: 'Schedule deleted successfully' });
      }
    });

    it('should soft delete template', async () => {
      if (templateId) {
        const response = await request(app.getHttpServer())
          .delete(`/api/v1/reports/templates/${templateId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toEqual({ message: 'Template deleted successfully' });

        // Verify template is inactive
        const checkResponse = await request(app.getHttpServer())
          .get(`/api/v1/reports/templates/${templateId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(checkResponse.body.isActive).toBe(false);
      }
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        service: 'reporting-service',
      });
    });
  });
});
