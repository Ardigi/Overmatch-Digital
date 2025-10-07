// Ensure TypeORM is not mocked in E2E tests
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

// Set up environment variables for E2E tests
process.env.NODE_ENV = 'test';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '5433';
process.env.DB_USERNAME = 'test_user';
process.env.DB_PASSWORD = 'test_pass';
process.env.DB_NAME = 'soc_clients_test';
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '6380';
process.env.REDIS_PASSWORD = 'test_redis_pass';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.DISABLE_KAFKA = 'true'; // Disable Kafka for E2E tests

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  ClientStatus,
  ClientType,
  CompanySize,
  ComplianceFramework,
  ComplianceStatus,
  Industry,
  RiskLevel,
} from '../../src/modules/clients/entities/client.entity';

export class E2ETestSetup {
  private app: INestApplication;
  private dataSource: DataSource;
  private moduleRef: TestingModule;
  private jwtService: JwtService;

  async createTestApp(): Promise<INestApplication> {
    // Use the async forRoot method to get the properly configured module
    const appModule = await AppModule.forRoot();

    // Create testing module
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

    // Get data source and services
    this.dataSource = this.moduleRef.get<DataSource>(DataSource);
    this.jwtService = this.moduleRef.get<JwtService>(JwtService);

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
    const entities = this.dataSource.entityMetadatas;

    // Delete in reverse order to handle foreign key constraints
    const orderedEntities = ['ClientAudit', 'ClientDocument', 'ClientUser', 'Client'];

    for (const entityName of orderedEntities) {
      const entity = entities.find((e) => e.name === entityName);
      if (entity) {
        const repository = this.dataSource.getRepository(entity.name);
        // Use query builder to delete all records without criteria restriction
        await repository.createQueryBuilder().delete().execute();
      }
    }
  }

  async seedTestClient(data?: {
    name?: string;
    clientType?: ClientType;
    status?: ClientStatus;
    complianceStatus?: ComplianceStatus;
    organizationId?: string;
    createdBy?: string;
  }): Promise<any> {
    const clientRepository = this.dataSource.getRepository('Client');

    const client = await clientRepository.save({
      name: data?.name || 'Test Client',
      slug:
        data?.name?.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now() ||
        'test-client-' + Date.now(),
      clientType: data?.clientType || ClientType.DIRECT,
      status: data?.status || ClientStatus.PENDING,
      complianceStatus: data?.complianceStatus || ComplianceStatus.NOT_STARTED,
      organizationId: data?.organizationId || 'org-123',
      createdBy: data?.createdBy || 'user-123',
      updatedBy: data?.createdBy || 'user-123',
      industry: Industry.TECHNOLOGY,
      size: CompanySize.MEDIUM,
      targetFrameworks: [ComplianceFramework.SOC2_TYPE2],
      contactInfo: {
        primaryContact: {
          name: 'John Doe',
          email: 'john@testclient.com',
          phone: '+1234567890',
          title: 'CTO',
        },
      },
      address: {
        headquarters: {
          street1: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'US',
        },
      },
    });

    return client;
  }

  async seedClientUser(clientId: string, userId: string, role = 'admin'): Promise<any> {
    const clientUserRepository = this.dataSource.getRepository('ClientUser');

    const clientUser = await clientUserRepository.save({
      clientId,
      userId,
      role,
      permissions: ['read', 'write', 'delete'],
      isActive: true,
    });

    return clientUser;
  }

  async seedClientAudit(
    clientId: string,
    data?: {
      framework?: ComplianceFramework;
      status?: string;
      scheduledDate?: Date;
    }
  ): Promise<any> {
    const auditRepository = this.dataSource.getRepository('ClientAudit');

    const audit = await auditRepository.save({
      clientId,
      auditType: 'COMPLIANCE',
      framework: data?.framework || ComplianceFramework.SOC2_TYPE2,
      status: data?.status || 'SCHEDULED',
      scheduledDate: data?.scheduledDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdBy: 'user-123',
      updatedBy: 'user-123',
    });

    return audit;
  }

  generateAuthToken(userId = 'user-123', roles = ['admin'], organizationId = 'org-123'): string {
    const payload = {
      sub: userId,
      email: 'test@example.com',
      roles,
      organizationId,
    };

    return this.jwtService.sign(payload);
  }

  generateKongHeaders(
    userId = 'user-123',
    email = 'test@example.com',
    organizationId = 'org-123',
    roles = ['admin']
  ) {
    return {
      'x-user-id': userId,
      'x-user-email': email,
      'x-organization-id': organizationId,
      'x-user-roles': roles.join(','),
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

export const testSetup = new E2ETestSetup();
