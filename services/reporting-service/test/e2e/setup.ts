// MUST be at the TOP before any imports to prevent WeakMap errors
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import {
  Controller,
  type DynamicModule,
  Get,
  type INestApplication,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard, RolesGuard } from '@soc-compliance/auth-common';
import { DataSource } from 'typeorm';
import { BaseE2ETestSetup, E2ETestConfig } from '../../../../test/e2e/shared/BaseE2ETestSetup';
import { RedisModule } from '../../src/modules/redis/redis.module';
import { Report, ReportSchedule, ReportTemplate } from '../../src/modules/reports/entities';
import { ReportsController } from '../../src/modules/reports/reports.controller';
import { ReportsModule } from '../../src/modules/reports/reports.module';
import { ReportGeneratorService } from '../../src/modules/reports/services/report-generator.service';
import { ReportSchedulerService } from '../../src/modules/reports/services/report-scheduler.service';
import { ReportStorageService } from '../../src/modules/reports/services/report-storage.service';

// Simple health controller for E2E tests
@Controller('health')
class TestHealthController {
  @Get()
  async check() {
    return {
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    };
  }

  @Get('simple')
  async simpleCheck() {
    return {
      status: 'ok',
      service: 'reporting-service',
      timestamp: new Date().toISOString(),
    };
  }
}

// Test-specific AppModule without problematic health indicators
@Module({
  controllers: [TestHealthController],
})
class TestHealthModule {}

@Module({})
class TestAppModule {
  static async forRoot(): Promise<DynamicModule> {
    const imports = [];

    imports.push(
      // Configuration
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env',
      }),

      // Database
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          type: 'postgres',
          host: configService.get('DB_HOST', '127.0.0.1'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get('DB_USERNAME', 'soc_user'),
          password: configService.get('DB_PASSWORD', 'soc_pass'),
          database: configService.get('DB_NAME', 'soc_reporting'),
          entities: [Report, ReportTemplate, ReportSchedule],
          synchronize: configService.get('NODE_ENV') !== 'production',
          logging: configService.get('NODE_ENV') === 'development',
        }),
        inject: [ConfigService],
      }),

      // Event Emitter
      EventEmitterModule.forRoot({
        wildcard: true,
        delimiter: '.',
        newListener: false,
        removeListener: false,
        maxListeners: 10,
        verboseMemoryLeak: false,
        ignoreErrors: false,
      }),

      // Scheduler
      ScheduleModule.forRoot(),

      // Bull Queue - Use mock for E2E tests
      // BullModule.forRootAsync({
      //   imports: [ConfigModule],
      //   useFactory: (configService: ConfigService) => ({
      //     redis: {
      //       host: configService.get('REDIS_HOST', 'localhost'),
      //       port: configService.get<number>('REDIS_PORT', 6379),
      //       password: configService.get('REDIS_PASSWORD'),
      //     },
      //   }),
      //   inject: [ConfigService],
      // }),

      // HTTP
      HttpModule.register({
        timeout: 30000,
        maxRedirects: 5,
      }),

      // Redis Cache - Use mock for E2E tests
      // RedisModule, // Disabled for E2E tests to avoid connection issues

      // Feature Modules
      TestHealthModule,
      TypeOrmModule.forFeature([Report, ReportTemplate, ReportSchedule])
    );

    return {
      module: TestAppModule,
      imports,
      providers: [
        // Mock services for E2E tests
        {
          provide: ReportGeneratorService,
          useValue: {
            generate: jest.fn().mockResolvedValue({ id: 'mock-report-id', status: 'queued' }),
            preview: jest.fn().mockResolvedValue({ previewUrl: 'http://mock-preview-url' }),
          },
        },
        {
          provide: ReportStorageService,
          useValue: {
            store: jest.fn().mockResolvedValue('/mock/path/report.pdf'),
            retrieve: jest.fn().mockResolvedValue(Buffer.from('mock pdf content')),
            delete: jest.fn().mockResolvedValue(true),
            getSignedUrl: jest.fn().mockResolvedValue('http://mock-signed-url'),
            getStorageStats: jest.fn().mockResolvedValue({
              totalSize: 1024000,
              totalFiles: 10,
            }),
          },
        },
        {
          provide: ReportSchedulerService,
          useValue: {
            createSchedule: jest.fn().mockImplementation((dto) => ({
              id: 'mock-schedule-id',
              ...dto,
              nextRun: new Date(Date.now() + 86400000).toISOString(),
            })),
            updateSchedule: jest.fn().mockImplementation((id, orgId, dto) => ({
              id,
              ...dto,
            })),
            deleteSchedule: jest.fn().mockResolvedValue(true),
            runScheduleNow: jest.fn().mockResolvedValue(true),
          },
        },
      ],
      controllers: [ReportsController],
    };
  }
}

export class ReportingServiceE2ESetup extends BaseE2ETestSetup {
  constructor() {
    super({
      serviceName: 'reporting-service',
      servicePort: 3007,
      databaseName: 'soc_reporting_test',
      moduleImports: [],
    });
  }

  async createTestApp(): Promise<INestApplication> {
    // Override environment variables for test
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
    process.env.DB_PORT = process.env.DB_PORT || '5433';
    process.env.DB_USERNAME = process.env.DB_USERNAME || 'test_user';
    process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test_pass';
    process.env.DB_NAME = this.config.databaseName;
    process.env.REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
    process.env.REDIS_PORT = process.env.REDIS_PORT || '6380';
    process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'test_redis_pass';
    process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9093';

    // Create module builder with test-specific module
    const moduleBuilder = Test.createTestingModule({
      imports: [await TestAppModule.forRoot()],
    });

    // Override guards to prevent dependency injection issues and set user context
    moduleBuilder.overrideGuard(RolesGuard).useValue({
      canActivate: () => true,
    });
    moduleBuilder.overrideGuard(JwtAuthGuard).useValue({
      canActivate: (context) => {
        const request = context.switchToHttp().getRequest();

        // Check if Authorization header is present
        const authHeader = request.headers.authorization;
        if (!authHeader) {
          return false; // Return false for unauthenticated requests
        }

        // Mock user context for authenticated E2E tests
        request.user = {
          id: 'test-user-123',
          email: 'test@example.com',
          organizationId: 'test-org-123',
          roles: ['admin'],
          sub: 'test-user-123',
        };
        return true;
      },
    });

    this.moduleRef = await moduleBuilder.compile();
    this.app = this.moduleRef.createNestApplication();

    // Apply service-specific configuration
    await this.applyServiceSpecificConfig(this.app);

    await this.app.init();

    // Get data source
    this.dataSource = this.moduleRef.get<DataSource>(DataSource);

    // Wait for database connection
    await this.waitForDatabaseConnection();

    return this.app;
  }

  protected async applyServiceSpecificConfig(app: INestApplication): Promise<void> {
    // Apply global pipes and settings - Use lenient validation for E2E tests
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false, // More lenient for E2E tests
        skipMissingProperties: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      })
    );
  }

  // Override makeAuthenticatedRequest to fix supertest module issue and add user context
  async makeAuthenticatedRequest(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    url: string,
    token: string,
    body?: any
  ) {
    const request = require('supertest');
    let req = request(this.app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${token}`)
      .set('x-consumer-id', 'test-user-123')
      .set('x-consumer-custom-id', 'test-org-123');

    if (body) {
      req = req.send(body);
    }

    return req;
  }

  getHttpServer() {
    return this.app.getHttpServer();
  }

  async seedTestData() {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Seed test report templates
      await queryRunner.query(`
        INSERT INTO report_templates (id, organization_id, name, description, report_type, sections, format, is_active, created_by, created_at, updated_at)
        VALUES 
          ('11111111-1111-1111-1111-111111111111', 'test-org-123', 'SOC 2 Type I Report', 'System and Organization Controls Type I Report', 'soc2_type1', '[]', 'PDF', true, 'test-user-123', NOW(), NOW()),
          ('22222222-2222-2222-2222-222222222222', 'test-org-123', 'SOC 2 Type II Report', 'System and Organization Controls Type II Report', 'soc2_type2', '[]', 'PDF', true, 'test-user-123', NOW(), NOW()),
          ('33333333-3333-3333-3333-333333333333', 'test-org-123', 'Risk Assessment Report', 'Comprehensive risk assessment report', 'risk_assessment', '[]', 'PDF', true, 'test-user-123', NOW(), NOW()),
          ('44444444-4444-4444-4444-444444444444', 'test-org-123', 'Control Matrix Report', 'Control implementation matrix', 'control_matrix', '[]', 'EXCEL', true, 'test-user-123', NOW(), NOW())
      `);

      // Seed test reports
      await queryRunner.query(`
        INSERT INTO reports (id, template_id, title, report_type, status, format, organization_id, created_at, updated_at)
        VALUES 
          ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Q1 2025 SOC 2 Report', 'soc2_type1', 'completed', 'PDF', 'test-org-123', NOW(), NOW()),
          ('66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', 'Annual SOC 2 Type II Report', 'soc2_type2', 'processing', 'PDF', 'test-org-123', NOW(), NOW()),
          ('77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333', 'Q4 2024 Risk Assessment', 'risk_assessment', 'failed', 'PDF', 'test-org-456', NOW() - INTERVAL '1 day', NOW())
      `);

      // Seed test report schedules
      await queryRunner.query(`
        INSERT INTO report_schedules (id, organization_id, report_template_id, name, cron_expression, is_active, recipients, last_run_at, next_run_at, created_by, created_at, updated_at)
        VALUES 
          ('88888888-8888-8888-8888-888888888888', 'test-org-123', '11111111-1111-1111-1111-111111111111', 'Monthly SOC 2 Report', '0 0 1 * *', true, '["admin@example.com"]', NULL, NOW() + INTERVAL '30 days', 'test-user-123', NOW(), NOW()),
          ('99999999-9999-9999-9999-999999999999', 'test-org-123', '44444444-4444-4444-4444-444444444444', 'Weekly Control Matrix', '0 0 * * 1', true, '["compliance@example.com"]', NOW() - INTERVAL '7 days', NOW() + INTERVAL '7 days', 'test-user-123', NOW(), NOW())
      `);
    } finally {
      await queryRunner.release();
    }
  }
}
