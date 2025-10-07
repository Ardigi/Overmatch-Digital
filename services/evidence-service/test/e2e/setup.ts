// CRITICAL: Must unmock TypeORM for E2E tests
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import { type ExecutionContext, type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import type { Multer } from 'multer';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { BaseE2ETestSetup } from '../../../../test/e2e/shared/BaseE2ETestSetup';
import { KongAuthGuard } from '../../src/shared/guards/kong-auth.guard';
import { KongRolesGuard } from '../../src/shared/guards/kong-roles.guard';
import { TestAppModule } from './test-app.module';

export class EvidenceServiceE2ESetup extends BaseE2ETestSetup {
  private uploadDir: string;
  protected app: INestApplication;
  protected dataSource: DataSource;
  protected moduleRef: TestingModule;

  constructor() {
    super({
      serviceName: 'Evidence Service',
      servicePort: 3005,
      databaseName: 'soc_evidence_test',
      moduleImports: [TestAppModule.forRoot()],
    });

    // Create test upload directory
    this.uploadDir = path.join(process.cwd(), 'test-uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async createTestApp(): Promise<INestApplication> {
    // Override environment variables for test
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = process.env.DB_HOST || 'localhost';
    process.env.DB_PORT = process.env.DB_PORT || '5433';
    process.env.DB_USERNAME = process.env.DB_USERNAME || 'test_user';
    process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test_pass';
    process.env.DB_NAME = this.config.databaseName;
    process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
    process.env.REDIS_PORT = process.env.REDIS_PORT || '6380';
    process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'test_redis_pass';
    process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9093';

    // Get the module
    const testAppModule = await TestAppModule.forRoot();

    // Create testing module with guard overrides
    const moduleBuilder = Test.createTestingModule({
      imports: [testAppModule],
    });

    // Mock guard implementations
    const mockGuard = {
      canActivate: (context: ExecutionContext): boolean => {
        const request = context.switchToHttp().getRequest();
        // Mock user data in request
        request.user = {
          id: '00000000-0000-0000-0000-000000000002',
          email: 'evidence-test@example.com',
          organizationId: '00000000-0000-0000-0000-000000000001',
          roles: ['admin'],
        };
        return true;
      },
    };

    // Override guards
    moduleBuilder.overrideGuard(KongAuthGuard).useValue(mockGuard);
    moduleBuilder.overrideGuard(KongRolesGuard).useValue(mockGuard);

    this.moduleRef = await moduleBuilder.compile();

    // Create application
    this.app = this.moduleRef.createNestApplication();

    // Apply global pipes
    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      })
    );

    // Apply service-specific configuration
    await this.applyServiceSpecificConfig(this.app);

    // Initialize app
    await this.app.init();

    // Get data source and wait for connection
    this.dataSource = this.moduleRef.get(DataSource);
    await this.waitForDatabaseConnection();

    return this.app;
  }

  async waitForDatabaseConnection(): Promise<void> {
    const maxRetries = 10;
    const retryDelay = 2000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        if (this.dataSource && this.dataSource.isInitialized) {
          await this.dataSource.query('SELECT 1');
          console.log(`✅ Database connection established for ${this.config.serviceName}`);
          return;
        }
      } catch (error) {
        console.log(`⏳ Waiting for database connection... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    throw new Error(`Failed to establish database connection after ${maxRetries} retries`);
  }

  getDataSource(): DataSource {
    return this.dataSource;
  }

  async closeApp(): Promise<void> {
    await this.cleanupTestFiles();
    if (this.dataSource) {
      await this.dataSource.destroy();
    }
    if (this.app) {
      await this.app.close();
    }
  }

  protected async applyServiceSpecificConfig(app: INestApplication): Promise<void> {
    // Override auth guards for testing
    const mockGuard = {
      canActivate: (context: ExecutionContext): boolean => {
        const request = context.switchToHttp().getRequest();
        // Mock user data in request
        request.user = {
          id: '00000000-0000-0000-0000-000000000002',
          email: 'evidence-test@example.com',
          organizationId: '00000000-0000-0000-0000-000000000001',
          roles: ['admin'],
        };
        return true;
      },
    };

    app.use((req: any, res: any, next: any) => {
      // Add Kong-style headers for tests
      req.headers['x-consumer-id'] = '00000000-0000-0000-0000-000000000002';
      req.headers['x-consumer-custom-id'] = '00000000-0000-0000-0000-000000000001';
      next();
    });

    // Note: Not configuring multer here as NestJS FileInterceptor handles it
  }

  async seedEvidence(controlId: string, uploadedBy: string): Promise<any> {
    const evidenceData = {
      clientId: '00000000-0000-0000-0000-000000000001', // Using clientId instead of organizationId
      type: 'document', // Use lowercase enum value
      title: `Test Evidence ${Date.now()}`,
      description: 'Test evidence description',
      collectedBy: uploadedBy,
      createdBy: uploadedBy,
      updatedBy: uploadedBy,
      controlId,
      status: 'draft', // Use lowercase enum value
      source: 'manual_upload', // Use lowercase enum value
      confidentialityLevel: 'internal', // Use lowercase enum value
      metadata: {
        testRun: true,
        environment: 'test',
      },
    };

    const result = await this.dataSource.query(
      `INSERT INTO evidence ("clientId", type, title, description, "collectedBy", "createdBy", "updatedBy", "controlId", status, source, "confidentialityLevel", metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        evidenceData.clientId,
        evidenceData.type,
        evidenceData.title,
        evidenceData.description,
        evidenceData.collectedBy,
        evidenceData.createdBy,
        evidenceData.updatedBy,
        evidenceData.controlId,
        evidenceData.status,
        evidenceData.source,
        evidenceData.confidentialityLevel,
        JSON.stringify(evidenceData.metadata),
      ]
    );

    return result[0];
  }

  async updateEvidenceStatus(
    evidenceId: string,
    reviewedBy: string,
    status: string = 'VALIDATED'
  ): Promise<any> {
    const result = await this.dataSource.query(
      `UPDATE evidence 
       SET status = $2, "validated_by" = $3, "validated_at" = $4, "updated_by" = $3
       WHERE id = $1
       RETURNING *`,
      [evidenceId, status, reviewedBy, new Date()]
    );

    return result[0];
  }

  async createTestFile(filename: string, content: string): Promise<string> {
    const filePath = path.join(this.uploadDir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  async cleanupTestFiles(): Promise<void> {
    if (fs.existsSync(this.uploadDir)) {
      fs.rmSync(this.uploadDir, { recursive: true, force: true });
    }
  }

  getUploadDir(): string {
    return this.uploadDir;
  }
}

export const evidenceTestSetup = new EvidenceServiceE2ESetup();
