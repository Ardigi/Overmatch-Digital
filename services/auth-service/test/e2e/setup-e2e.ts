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
process.env.DB_NAME = process.env.DB_NAME || 'soc_auth_test';
process.env.REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6380';
process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'test_redis_pass';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30m';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-google-client-secret';
process.env.GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback';
process.env.MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || 'test-microsoft-client-id';
process.env.MICROSOFT_CLIENT_SECRET =
  process.env.MICROSOFT_CLIENT_SECRET || 'test-microsoft-client-secret';
process.env.MICROSOFT_CALLBACK_URL =
  process.env.MICROSOFT_CALLBACK_URL || 'http://localhost:3001/auth/microsoft/callback';
process.env.SETUP_KEY = process.env.SETUP_KEY || 'test-setup-key';

// Clear any module cache to ensure fresh imports
delete require.cache[require.resolve('typeorm')];
delete require.cache[require.resolve('@nestjs/typeorm')];

import { type INestApplication, ValidationPipe } from '@nestjs/common';
// Now import NestJS and TypeORM modules
import { Test, type TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource } from 'typeorm';

// Import AppModule last to ensure all dependencies are properly loaded
import { AppModule } from '../../src/app.module';

export class E2ETestSetup {
  private app: INestApplication;
  private dataSource: DataSource;
  private moduleRef: TestingModule;

  async createTestApp(): Promise<INestApplication> {
    try {
      console.log('Creating E2E test app...');

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

      console.log('E2E Test App initialized successfully');
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

    const hashedPassword = await bcrypt.hash(data?.password || 'Test123!@', 10);

    const user = await userRepository.save({
      email: data?.email || 'test@example.com',
      password: hashedPassword,
      emailVerified: data?.isEmailVerified ?? true,
      mfaEnabled: data?.mfaEnabled ?? false,
      firstName: 'Test',
      lastName: 'User',
      organizationId: org.id,
      organization: org, // Add the organization relation
      status: 'active',
      roles: ['user'], // Add default role
    });

    return user;
  }

  async seedApiKey(userId: string, name = 'Test API Key'): Promise<any> {
    const apiKeyRepository = this.dataSource.getRepository('ApiKey');

    const plainKey = `om_test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const keyHash = await bcrypt.hash(plainKey, 10);

    // Mask the key for storage (show first 8 and last 4 characters)
    const maskedKey = this.maskApiKey(plainKey);

    const apiKey = await apiKeyRepository.save({
      name,
      key: maskedKey,
      keyHash,
      userId,
      status: 'active',
      scopes: ['read'],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Return the API key with the plain key for testing
    return { ...apiKey, plainKey };
  }

  private maskApiKey(key: string): string {
    // Show first 8 and last 4 characters
    if (key.length <= 12) {
      return key;
    }
    const first = key.substring(0, 8);
    const last = key.substring(key.length - 4);
    const masked = '*'.repeat(key.length - 12);
    return `${first}${masked}${last}`;
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

// Export a singleton instance
export const testSetup = new E2ETestSetup();
