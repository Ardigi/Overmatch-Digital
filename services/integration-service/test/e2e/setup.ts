// MUST be before any imports
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { TestAppModule } from './test-app.module';

export class IntegrationServiceE2ESetup {
  private app: INestApplication;
  private dataSource: DataSource;
  private moduleRef: TestingModule;

  async createTestApp(): Promise<INestApplication> {
    // Override environment variables for test environment
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
    process.env.DB_PORT = process.env.DB_PORT || '5433';
    process.env.DB_USERNAME = process.env.DB_USERNAME || 'test_user';
    process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test_pass';
    process.env.DB_NAME = 'soc_integrations_test';
    process.env.REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
    process.env.REDIS_PORT = process.env.REDIS_PORT || '6380';
    process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'test_redis_pass';
    process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9093';
    process.env.DISABLE_KAFKA = 'true';

    // Use the simplified test module to avoid complex dependencies
    const testModule = await TestAppModule.forRoot();

    // Create testing module builder
    const moduleBuilder = Test.createTestingModule({
      imports: [testModule],
    });

    // Compile the module
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

    // Initialize app
    await this.app.init();

    // Get data source
    this.dataSource = this.moduleRef.get<DataSource>(DataSource);

    return this.app;
  }

  async closeApp(): Promise<void> {
    if (this.dataSource) {
      await this.dataSource.destroy();
    }
    if (this.app) {
      await this.app.close();
    }
  }

  async cleanDatabase(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      // Disable foreign key checks
      await queryRunner.query('SET session_replication_role = replica;');

      // Get all table names
      const entities = this.dataSource.entityMetadatas;

      // Clear tables in reverse order to handle dependencies
      for (const entity of entities.reverse()) {
        await queryRunner.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE`);
      }

      // Re-enable foreign key checks
      await queryRunner.query('SET session_replication_role = DEFAULT;');
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

  getModuleRef(): TestingModule {
    return this.moduleRef;
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

  async seedTestData() {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Seed test integration providers
      await queryRunner.query(`
        INSERT INTO integration_providers (id, name, type, description, config_schema, is_active, created_at, updated_at)
        VALUES 
          ('11111111-1111-1111-1111-111111111111', 'Jira', 'issue_tracking', 'Atlassian Jira integration', '{"type": "object"}', true, NOW(), NOW()),
          ('22222222-2222-2222-2222-222222222222', 'Slack', 'communication', 'Slack messaging integration', '{"type": "object"}', true, NOW(), NOW()),
          ('33333333-3333-3333-3333-333333333333', 'AWS', 'cloud_provider', 'Amazon Web Services integration', '{"type": "object"}', true, NOW(), NOW()),
          ('44444444-4444-4444-4444-444444444444', 'GitHub', 'version_control', 'GitHub repository integration', '{"type": "object"}', true, NOW(), NOW()),
          ('55555555-5555-5555-5555-555555555555', 'ServiceNow', 'itsm', 'ServiceNow ITSM integration', '{"type": "object"}', false, NOW(), NOW())
      `);

      // Seed test integrations
      await queryRunner.query(`
        INSERT INTO integrations (id, provider_id, organization_id, name, status, config, last_sync, created_at, updated_at)
        VALUES 
          ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'test-org-123', 'Main Jira Instance', 'active', '{"url": "https://test.atlassian.net", "project": "SOC"}', NOW() - INTERVAL '1 hour', NOW(), NOW()),
          ('77777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', 'test-org-123', 'Team Slack', 'active', '{"webhook": "https://hooks.slack.com/test"}', NOW() - INTERVAL '5 minutes', NOW(), NOW()),
          ('88888888-8888-8888-8888-888888888888', '33333333-3333-3333-3333-333333333333', 'test-org-456', 'AWS Production', 'inactive', '{"region": "us-east-1"}', NULL, NOW(), NOW()),
          ('99999999-9999-9999-9999-999999999999', '44444444-4444-4444-4444-444444444444', 'test-org-123', 'GitHub Enterprise', 'error', '{"org": "test-org"}', NOW() - INTERVAL '2 days', NOW(), NOW())
      `);

      // Seed test webhooks
      await queryRunner.query(`
        INSERT INTO webhooks (id, integration_id, event_type, url, secret, is_active, created_at, updated_at)
        VALUES 
          ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'issue.created', 'https://api.example.com/webhook/jira', 'secret123', true, NOW(), NOW()),
          ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '77777777-7777-7777-7777-777777777777', 'control.updated', 'https://api.example.com/webhook/slack', 'secret456', true, NOW(), NOW())
      `);

      // Seed test sync jobs
      await queryRunner.query(`
        INSERT INTO sync_jobs (id, integration_id, type, status, started_at, completed_at, records_synced, errors, created_at, updated_at)
        VALUES 
          ('cccccccc-cccc-cccc-cccc-cccccccccccc', '66666666-6666-6666-6666-666666666666', 'full', 'completed', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '30 minutes', 150, 0, NOW(), NOW()),
          ('dddddddd-dddd-dddd-dddd-dddddddddddd', '77777777-7777-7777-7777-777777777777', 'incremental', 'completed', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '4 minutes', 5, 0, NOW(), NOW()),
          ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '99999999-9999-9999-9999-999999999999', 'full', 'failed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 0, 1, NOW(), NOW())
      `);
    } finally {
      await queryRunner.release();
    }
  }
}
