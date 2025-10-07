import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';

export class E2ETestSetup {
  private app: INestApplication;
  private dataSource: DataSource;
  private moduleRef: TestingModule;

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

  async seedTestUser(data?: {
    email?: string;
    password?: string;
    isEmailVerified?: boolean;
    mfaEnabled?: boolean;
  }): Promise<any> {
    const userRepository = this.dataSource.getRepository('User');
    const organizationRepository = this.dataSource.getRepository('Organization');

    // Create an organization first
    const org = await organizationRepository.save({
      name: 'Test Organization',
      status: 'active',
    });

    const hashedPassword = await bcrypt.hash(data?.password || 'Test123!@#', 10);

    const user = await userRepository.save({
      email: data?.email || 'test@example.com',
      password: hashedPassword,
      emailVerified: data?.isEmailVerified ?? true,
      mfaEnabled: data?.mfaEnabled ?? false,
      firstName: 'Test',
      lastName: 'User',
      organizationId: org.id,
      status: 'active',
    });

    return user;
  }

  async seedApiKey(userId: string, name = 'Test API Key'): Promise<any> {
    const apiKeyRepository = this.dataSource.getRepository('ApiKey');

    const apiKey = await apiKeyRepository.save({
      name,
      key: `test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    return apiKey;
  }

  async login(credentials: { email: string; password: string }): Promise<{
    accessToken: string;
    refreshToken: string;
    user: any;
  }> {
    const response = await request(this.app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(200);

    return response.body;
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
