// CRITICAL: Import reflect-metadata at the absolute beginning
import 'reflect-metadata';

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
process.env.DB_NAME = process.env.DB_NAME || 'soc_audits_test';
process.env.REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6380';
process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'test_redis_pass';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30m';

// Clear any module cache to ensure fresh imports
delete require.cache[require.resolve('typeorm')];
delete require.cache[require.resolve('@nestjs/typeorm')];

import { type INestApplication, ValidationPipe } from '@nestjs/common';
// Now import NestJS and TypeORM modules
import { Test, type TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';

// Import AppModule last to ensure all dependencies are properly loaded
import { AppModule } from '../../src/app.module';

export class AuditE2ETestSetup {
  private app: INestApplication;
  private dataSource: DataSource;
  private moduleRef: TestingModule;

  async createTestApp(): Promise<INestApplication> {
    try {
      console.log('Creating Audit E2E test app...');

      // Use the async forRoot method to get the properly configured module
      const appModule = await AppModule.forRoot();

      // Create testing module using the async module configuration
      this.moduleRef = await Test.createTestingModule({
        imports: [appModule],
      }).compile();

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

      // Get data source after app is initialized
      this.dataSource = this.moduleRef.get<DataSource>(DataSource);

      console.log('Audit E2E Test App initialized successfully');
      return this.app;
    } catch (error) {
      console.error('Failed to create audit test app:', error);
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
      console.error('Error closing audit test app:', error);
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

  async seedTestData(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Seed test audits
      await queryRunner.query(`
        INSERT INTO soc_audits (
          id, "auditNumber", "clientId", "organizationId", "auditType", status, "currentPhase", 
          "auditPeriodStart", "auditPeriodEnd", "leadAuditorId", "engagementPartnerId", 
          "cpaFirmId", "cpaFirmName", "auditObjectives", "scopeDescription", 
          "createdAt", "updatedAt", "createdBy", "updatedBy"
        )
        VALUES 
          (
            '11111111-1111-1111-1111-111111111111', 'AUDIT-2025-001', 'client-123', 'test-org-123', 
            'SOC2_TYPE2', 'IN_FIELDWORK', 'CONTROL_TESTING', '2025-01-01', '2025-03-31', 
            'auditor-123', 'partner-123', 'cpa-firm-123', 'Test CPA Firm', 
            'Verify SOC 2 compliance controls', 'Full scope SOC 2 Type II audit', 
            NOW(), NOW(), 'system-test', 'system-test'
          ),
          (
            '22222222-2222-2222-2222-222222222222', 'AUDIT-2024-015', 'client-456', 'test-org-123', 
            'SOC2_TYPE2', 'COMPLETED', 'ISSUANCE', '2024-10-01', '2024-10-15', 
            'auditor-456', 'partner-456', 'cpa-firm-123', 'Test CPA Firm', 
            'Annual compliance audit', 'ISO 27001 certification audit', 
            NOW() - INTERVAL '3 months', NOW(), 'system-test', 'system-test'
          ),
          (
            '33333333-3333-3333-3333-333333333333', 'AUDIT-2025-002', 'client-789', 'test-org-456', 
            'SOC1_TYPE1', 'PLANNING', 'KICKOFF', '2025-04-01', '2025-04-30', 
            'auditor-789', 'partner-789', 'cpa-firm-456', 'Another CPA Firm', 
            'Internal security controls review', 'Security controls assessment', 
            NOW(), NOW(), 'system-test', 'system-test'
          )
      `);

      // Seed test audit findings
      await queryRunner.query(`
        INSERT INTO audit_findings (
          id, "findingNumber", "auditId", "controlId", "controlCode", "controlName", 
          "findingType", severity, status, title, description, condition, criteria, cause, effect, recommendation,
          "createdAt", "updatedAt", "createdBy", "updatedBy"
        )
        VALUES 
          (
            '44444444-4444-4444-4444-444444444444', 'F-2025-001', '11111111-1111-1111-1111-111111111111', 
            'control-123', 'CC1.1', 'Control Environment', 'CONTROL_DEFICIENCY', 'HIGH', 'IDENTIFIED',
            'Missing MFA for Admin Users', 'Some admin accounts lack multi-factor authentication',
            'Admin users can access systems without MFA', 'All admin accounts must have MFA enabled',
            'Insufficient access control policies', 'Increased risk of unauthorized access',
            'Implement MFA for all administrative accounts',
            NOW(), NOW(), 'system-test', 'system-test'
          ),
          (
            '55555555-5555-5555-5555-555555555555', 'F-2025-002', '11111111-1111-1111-1111-111111111111', 
            'control-456', 'CC2.1', 'Communication and Information', 'DOCUMENTATION_GAP', 'MEDIUM', 'REMEDIATED',
            'Outdated Security Policy', 'Security policy document has not been updated recently',
            'Current policy is dated 2023', 'Policies must be reviewed annually',
            'Lack of regular policy review process', 'Outdated security requirements',
            'Establish annual policy review process',
            NOW(), NOW(), 'system-test', 'system-test'
          ),
          (
            '66666666-6666-6666-6666-666666666666', 'F-2024-015', '22222222-2222-2222-2222-222222222222', 
            'control-789', 'CC3.1', 'Risk Assessment', 'OPERATING_EFFECTIVENESS', 'LOW', 'CLOSED',
            'Incomplete Access Reviews', 'Quarterly access reviews were not completed on time',
            'Q3 2024 access review completed 2 weeks late', 'Access reviews must be completed quarterly',
            'Resource constraints in security team', 'Delayed identification of inappropriate access',
            'Establish dedicated resources for access reviews',
            NOW() - INTERVAL '3 months', NOW(), 'system-test', 'system-test'
          )
      `);

      // Seed test audit programs
      await queryRunner.query(`
        INSERT INTO audit_programs (
          id, "auditId", "programName", description, version, "isActive", 
          sections, milestones, "riskAssessment", "testingStrategy", timeline, resources,
          "createdAt", "updatedAt", "createdBy", "updatedBy"
        )
        VALUES 
          (
            '99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 
            'SOC 2 Type II Audit Program', 'Comprehensive SOC 2 audit program', '1.0', true,
            '{}', '{}', '{"overall": "moderate"}', '{"approach": "risk-based"}', 
            '{"phases": ["planning", "fieldwork", "reporting"]}', '{"team": ["Lead auditor", "2 specialists"]}',
            NOW(), NOW(), 'system-test', 'system-test'
          ),
          (
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 
            'Internal Security Audit Program', 'Internal security controls assessment', '1.0', true,
            '{}', '{}', '{"overall": "low"}', '{"approach": "control-based"}', 
            '{"duration": "4 weeks"}', '{"team": ["Internal audit team"]}',
            NOW(), NOW(), 'system-test', 'system-test'
          )
      `);
    } catch (error) {
      console.error('Error seeding audit test data:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createAuthenticatedUser(): Promise<{
    token: string;
    organizationId: string;
    userId: string;
  }> {
    // For testing purposes, create a mock JWT token
    // In a real setup, this would interact with the auth service
    const mockToken = 'test-jwt-token-for-audit-service';
    return {
      token: mockToken,
      organizationId: 'test-org-123',
      userId: 'test-user-123',
    };
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
}

// Export a singleton instance
export const auditTestSetup = new AuditE2ETestSetup();
