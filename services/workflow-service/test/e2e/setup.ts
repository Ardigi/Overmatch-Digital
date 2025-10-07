import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BaseE2ETestSetup, E2ETestConfig } from '../../../../test/e2e/shared/BaseE2ETestSetup';
import { AppModule } from '../../src/app.module';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';

export class WorkflowServiceE2ESetup extends BaseE2ETestSetup {
  constructor() {
    super({
      serviceName: 'workflow-service',
      servicePort: 3006,
      databaseName: 'soc_workflows_test',
      moduleImports: [AppModule.forRoot()],
    });
  }

  async createTestApp(): Promise<INestApplication> {
    // Override environment variables for test - FORCE overrides
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_PORT = '5433';
    process.env.DB_USERNAME = 'test_user';
    process.env.DB_PASSWORD = 'test_pass';
    process.env.DB_NAME = this.config.databaseName;
    process.env.REDIS_HOST = '127.0.0.1';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_PASSWORD = 'test_redis_pass';
    process.env.KAFKA_BROKERS = '127.0.0.1:9093';
    process.env.DISABLE_KAFKA = 'true';

    console.log('🐛 Force set env vars:', {
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_USERNAME: process.env.DB_USERNAME,
      DB_NAME: process.env.DB_NAME,
    });

    // Create testing module with guard overrides
    const moduleBuilder = Test.createTestingModule({
      imports: this.config.moduleImports,
    });

    // Override guards to avoid authentication in E2E tests (except for auth tests)
    moduleBuilder.overrideGuard(JwtAuthGuard).useValue({
      canActivate: (context) => {
        const request = context.switchToHttp().getRequest();
        // For direct requests without auth headers, throw UnauthorizedException to get 401
        if (!request.headers.authorization && !request.headers['x-auth-token']) {
          const { UnauthorizedException } = require('@nestjs/common');
          throw new UnauthorizedException('Authentication required');
        }
        // For authenticated requests in tests, allow through
        return true;
      },
    });

    moduleBuilder.overrideGuard(RolesGuard).useValue({
      canActivate: () => true,
    });

    this.moduleRef = await moduleBuilder.compile();

    // Create application
    this.app = this.moduleRef.createNestApplication();

    // Apply global pipes and settings
    const { ValidationPipe } = await import('@nestjs/common');
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

    // Get data source
    const { DataSource } = await import('typeorm');
    this.dataSource = this.moduleRef.get(DataSource);

    // Wait for database connection
    await this.waitForDatabaseConnection();

    return this.app;
  }

  protected async applyServiceSpecificConfig(app: INestApplication): Promise<void> {
    // Add any workflow-specific configuration here
    // For example, custom interceptors, filters, etc.
  }

  async seedTestData() {
    const pgOptions = this.dataSource.options as any;
    console.log('🔍 DataSource config:', {
      database: pgOptions.database,
      host: pgOptions.host,
      port: pgOptions.port,
      username: pgOptions.username,
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    // Verify we're in the right database
    const dbResult = await queryRunner.query('SELECT current_database()');
    console.log('📋 Current database:', dbResult[0].current_database);

    try {
      // Seed test workflows
      await queryRunner.query(`
        INSERT INTO workflows (id, "organizationId", name, description, category, status, version, "createdBy", "createdAt", "updatedAt")
        VALUES 
          ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Evidence Collection Workflow', 'Standard evidence collection process', 'evidence_collection', 'active', 1, 'test-user', NOW(), NOW()),
          ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'Control Assessment Workflow', 'Control effectiveness assessment process', 'control_assessment', 'active', 1, 'test-user', NOW(), NOW()),
          ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', 'Incident Response Workflow', 'Incident response and remediation process', 'incident_response', 'inactive', 1, 'test-user', NOW(), NOW())
      `);

      // Create a complete workflow_templates table for E2E testing
      try {
        // Drop existing table to recreate with correct schema
        await queryRunner.query(`DROP TABLE IF EXISTS workflow_templates CASCADE;`);

        await queryRunner.query(`
          CREATE TABLE workflow_templates (
            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
            "organizationId" uuid NOT NULL,
            name varchar(255) NOT NULL,
            description text,
            category varchar(100),
            version integer DEFAULT 1,
            "isPublic" boolean DEFAULT false,
            "isActive" boolean DEFAULT true,
            config jsonb DEFAULT '{}',
            usage jsonb DEFAULT '{"count": 0}',
            tags text[],
            icon varchar(255),
            "previewImage" varchar(255),
            metadata jsonb,
            "createdBy" varchar(255) NOT NULL,
            "modifiedBy" varchar(255),
            "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
          )
        `);
      } catch (error) {
        // Table might already exist, continue
      }

      // Seed test workflow templates
      await queryRunner.query(`
        INSERT INTO workflow_templates (id, "organizationId", name, description, category, version, "isActive", "isPublic", config, usage, "createdBy", "createdAt", "updatedAt")
        VALUES 
          ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', 'Standard Evidence Template', 'Template for evidence collection', 'evidence_collection', 1, true, false, '{"steps": []}', '{"count": 0}', 'test-user', NOW(), NOW()),
          ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001', 'Risk Assessment Template', 'Template for risk assessment', 'risk_assessment', 1, true, false, '{"steps": []}', '{"count": 0}', 'test-user', NOW(), NOW())
      `);

      // Seed test workflow instances
      await queryRunner.query(`
        INSERT INTO workflow_instances (id, "workflowId", "organizationId", name, status, "initiatedBy", "startedAt", "createdAt", "updatedAt")
        VALUES 
          ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Evidence Collection Instance', 'running', 'test-user', NOW(), NOW(), NOW()),
          ('77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'Control Assessment Instance', 'completed', 'test-user', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW())
      `);

      // Seed test workflow steps
      await queryRunner.query(`
        INSERT INTO workflow_steps (id, "workflowId", name, description, type, "order", config, "isActive", "createdAt", "updatedAt")
        VALUES 
          ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'Upload Evidence', 'Upload required evidence documents', 'manual', 1, '{}', true, NOW(), NOW()),
          ('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'Review Evidence', 'Review uploaded evidence', 'approval', 2, '{}', true, NOW(), NOW())
      `);
    } finally {
      await queryRunner.release();
    }
  }
}
