import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppUltraMinimalModule } from './test-app-ultra-minimal.module';

export class NotificationServiceE2ESetup {
  protected app: INestApplication;
  protected moduleRef: TestingModule;

  async createTestApp(): Promise<INestApplication> {
    // Override environment variables for test
    process.env.NODE_ENV = 'test';
    process.env.DISABLE_KAFKA = 'true';
    process.env.DISABLE_ACTUAL_SENDING = 'true';
    process.env.ENABLE_TEST_MODE = 'true';

    // Create testing module - no guard overrides needed
    this.moduleRef = await Test.createTestingModule({
      imports: [TestAppUltraMinimalModule],
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

    return this.app;
  }

  async closeApp(): Promise<void> {
    if (this.app) {
      await this.app.close();
    }
  }

  async cleanDatabase(): Promise<void> {
    // No database to clean in minimal setup
  }

  async seedTestData() {
    // No database to seed in minimal setup
  }

  getApp(): INestApplication {
    return this.app;
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

  // Helper method to extract error message from response
  extractErrorMessage(response: any): string {
    if (response.body?.message) {
      return Array.isArray(response.body.message)
        ? response.body.message.join(', ')
        : response.body.message;
    }
    return 'Unknown error';
  }
}
