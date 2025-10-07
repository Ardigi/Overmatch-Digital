// CRITICAL: Import reflect-metadata at the absolute beginning
import 'reflect-metadata';

// Ensure TypeORM is not mocked in E2E tests
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

// Load environment variables before any other imports
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment file
dotenv.config({
  path: path.join(__dirname, 'test.env'),
  override: true,
});

// Set critical environment variables before any module imports
process.env.NODE_ENV = 'test';

// Ensure all required environment variables are set
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '5433';
process.env.DB_USERNAME = process.env.DB_USERNAME || 'test_user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test_pass';
process.env.DB_NAME = process.env.DB_NAME || 'soc_policies_test';
process.env.REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6380';
process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'test_redis_pass';

// Clear any module cache to ensure fresh imports
delete require.cache[require.resolve('typeorm')];
delete require.cache[require.resolve('@nestjs/typeorm')];

import { type INestApplication, ValidationPipe } from '@nestjs/common';
// Now import NestJS and TypeORM modules
import { Test, type TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RolesGuard } from '@soc-compliance/auth-common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AuthorizationGuard } from '../../src/shared/guards/authorization.guard';
// Import guards that need to be overridden
import { KongAuthGuard } from '../../src/shared/guards/kong-auth.guard';

// Import pipes that need to be overridden
import {
  PolicyContentSanitizationPipe,
  SanitizationPipe,
} from '../../src/shared/pipes/sanitization.pipe';
import {
  TestPolicyContentSanitizationPipe,
  TestSanitizationPipe,
} from './pipes/test-sanitization.pipe';

// Import TestAppModule for E2E tests
import { TestAppModule } from './test-app.module';

export class PolicyServiceE2ESetup {
  private app: INestApplication;
  private dataSource: DataSource;
  private moduleRef: TestingModule;

  async createTestApp(): Promise<INestApplication> {
    try {
      console.log('Creating Policy Service E2E test app...');

      // Use the TestAppModule for E2E tests
      const appModule = await TestAppModule.forRoot();

      // Debug: Log the module structure
      console.log(
        'AppModule structure:',
        JSON.stringify(
          {
            module: appModule.module?.name,
            importsCount: appModule.imports?.length,
            imports: appModule.imports?.map((m: any, i: number) => {
              if (typeof m === 'function') return `[${i}] ${m.name}`;
              if (m?.module) return `[${i}] DynamicModule: ${m.module.name || m.module}`;
              if (m?.constructor) return `[${i}] Instance: ${m.constructor.name}`;
              return `[${i}] ${typeof m}: ${m}`;
            }),
          },
          null,
          2
        )
      );

      // Create testing module using the async module configuration
      const moduleBuilder = Test.createTestingModule({
        imports: [appModule],
      });

      // Override guards for E2E testing
      // This is the accepted NestJS pattern for E2E tests
      moduleBuilder.overrideGuard(KongAuthGuard).useValue({
        canActivate: (context) => {
          console.log('Mock KongAuthGuard activated');
          const request = context.switchToHttp().getRequest();
          // Allow API key authentication or set test user
          if (request.headers['x-api-key']) {
            return true;
          }
          // Set default test user for authenticated requests
          request.user = {
            id: '11111111-1111-1111-1111-111111111111', // Controller expects 'id'
            userId: '11111111-1111-1111-1111-111111111111', // Keep for compatibility
            organizationId: '22222222-2222-2222-2222-222222222222',
            email: 'test@example.com',
            roles: ['admin'],
          };
          console.log('Mock KongAuthGuard set user:', request.user);
          return true;
        },
      });

      // Override RolesGuard from auth-common package
      moduleBuilder.overrideGuard(RolesGuard).useValue({
        canActivate: () => true,
      });

      moduleBuilder.overrideGuard(AuthorizationGuard).useValue({
        canActivate: () => true,
      });

      // Disable rate limiting for E2E tests
      moduleBuilder.overrideGuard(ThrottlerGuard).useValue({
        canActivate: () => true,
      });

      // Override pipes to prevent UUID sanitization in E2E tests
      moduleBuilder.overridePipe(SanitizationPipe).useClass(TestSanitizationPipe);
      moduleBuilder
        .overridePipe(PolicyContentSanitizationPipe)
        .useClass(TestPolicyContentSanitizationPipe);

      this.moduleRef = await moduleBuilder.compile();

      // Create application
      this.app = this.moduleRef.createNestApplication();

      // Apply global pipes and settings
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
      this.app.setGlobalPrefix('api/v1');

      // Initialize app
      await this.app.init();

      // Get data source after app is initialized
      this.dataSource = this.moduleRef.get<DataSource>(DataSource);

      console.log('Policy Service E2E Test App initialized successfully');
      return this.app;
    } catch (error) {
      console.error('Failed to create test app:', error);
      throw error;
    }
  }

  async closeApp(): Promise<void> {
    try {
      if (this.dataSource && this.dataSource.isInitialized) {
        await this.dataSource.destroy();
      }
      if (this.app) {
        await this.app.close();
      }
    } catch (error) {
      console.error('Error closing test app:', error);
    }
  }

  async cleanDatabase(): Promise<void> {
    if (!this.dataSource || !this.dataSource.isInitialized) {
      console.warn('DataSource not initialized, skipping database cleanup');
      return;
    }

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      // Disable foreign key checks
      await queryRunner.query('SET session_replication_role = replica;');

      // Get all table names
      const entities = this.dataSource.entityMetadatas;

      // Clear tables in reverse order to handle dependencies
      for (const entity of entities.reverse()) {
        try {
          await queryRunner.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE`);
        } catch (error) {
          console.warn(`Failed to truncate ${entity.tableName}:`, error.message);
        }
      }

      // Re-enable foreign key checks
      await queryRunner.query('SET session_replication_role = DEFAULT;');
    } catch (error) {
      console.error('Database cleanup error:', error);
    } finally {
      await queryRunner.release();
    }
  }

  getApp(): INestApplication {
    return this.app;
  }

  getDataSource(): DataSource {
    return this.dataSource;
  }

  getHttpServer() {
    return this.app.getHttpServer();
  }

  // Helper method to make authenticated requests
  async makeAuthenticatedRequest(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    url: string,
    token: string,
    body?: any
  ) {
    const req = request(this.app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${token}`);

    if (body) {
      req.send(body);
    }

    return req;
  }

  protected async applyServiceSpecificConfig(app: INestApplication): Promise<void> {
    // Apply policy service specific configuration
    app.setGlobalPrefix('api/v1');
  }

  async seedPolicyData(organizationId: string): Promise<{
    framework: any;
    policyDocument: any;
    policyVersion: any;
  }> {
    // Create framework
    const frameworkData = {
      name: 'Test Framework',
      version: '1.0',
      description: 'Test framework for E2E tests',
      organizationId,
      status: 'active',
      metadata: {},
    };

    const frameworkResult = await this.dataSource.query(
      `INSERT INTO frameworks (name, version, description, "organizationId", status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      Object.values(frameworkData)
    );

    const framework = frameworkResult[0];

    // Create policy document
    const policyDocumentData = {
      title: 'Test Policy',
      organizationId,
      frameworkId: framework.id,
      status: 'draft',
      metadata: {},
    };

    const policyDocumentResult = await this.dataSource.query(
      `INSERT INTO policy_documents (title, "organizationId", "frameworkId", status, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      Object.values(policyDocumentData)
    );

    const policyDocument = policyDocumentResult[0];

    // Create policy version
    const policyVersionData = {
      policyDocumentId: policyDocument.id,
      version: '1.0.0',
      content: 'Test policy content',
      status: 'draft',
      createdBy: '11111111-1111-1111-1111-111111111111',
      metadata: {},
    };

    const policyVersionResult = await this.dataSource.query(
      `INSERT INTO policy_versions ("policyDocumentId", version, content, status, "createdBy", metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      Object.values(policyVersionData)
    );

    return {
      framework,
      policyDocument,
      policyVersion: policyVersionResult[0],
    };
  }

  async seedControlMapping(policyId: string, controlId: string): Promise<any> {
    const mappingData = {
      policyId,
      controlId,
      mappingType: 'primary',
      metadata: {},
    };

    const result = await this.dataSource.query(
      `INSERT INTO policy_control_mappings ("policyId", "controlId", "mappingType", metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      Object.values(mappingData)
    );

    return result[0];
  }

  async seedTestPolicy(organizationId: string): Promise<any> {
    const policyData = {
      policyNumber: `POL-${Date.now()}`,
      title: 'Test Policy',
      description: 'Test policy for E2E tests',
      purpose: 'Test policy purpose for E2E testing',
      type: 'security',
      status: 'draft',
      organizationId,
      ownerId: '11111111-1111-1111-1111-111111111111',
      ownerName: 'Test User',
      content: JSON.stringify({
        sections: [
          {
            id: '1',
            title: 'Purpose',
            content: 'Test content',
            order: 1,
          },
        ],
      }),
      effectiveDate: new Date().toISOString(),
      nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
      createdBy: '11111111-1111-1111-1111-111111111111',
      updatedBy: '11111111-1111-1111-1111-111111111111',
    };

    const result = await this.dataSource.query(
      `INSERT INTO policies ("policyNumber", title, description, purpose, type, status, "organizationId", 
        "ownerId", "ownerName", content, "effectiveDate", "nextReviewDate", "createdBy", "updatedBy")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      Object.values(policyData)
    );

    return result[0];
  }

  async seedApiKey(
    userId: string,
    organizationId: string
  ): Promise<{ id: string; plainKey: string }> {
    // Generate a test API key
    const plainKey = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const maskedKey = `test_****${plainKey.slice(-4)}`;

    const apiKeyData = {
      name: 'Test API Key',
      key: maskedKey,
      userId,
      organizationId,
      expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
      lastUsedAt: null,
      scopes: ['read', 'write'],
    };

    const result = await this.dataSource.query(
      `INSERT INTO api_keys (name, key, "userId", "organizationId", "expiresAt", "lastUsedAt", scopes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      Object.values(apiKeyData)
    );

    return {
      id: result[0].id,
      plainKey, // Return the plain key for testing
    };
  }
}

export const policyTestSetup = new PolicyServiceE2ESetup();
