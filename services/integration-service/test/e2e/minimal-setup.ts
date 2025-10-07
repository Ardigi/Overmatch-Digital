// MUST be before any imports
jest.unmock('@nestjs/typeorm');
jest.unmock('typeorm');

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { MinimalTestAppModule } from './minimal-test-app.module';

export class MinimalIntegrationServiceE2ESetup {
  private app: INestApplication;
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

    // Use the ultra-simplified test module
    const testModule = await MinimalTestAppModule.forRoot();

    // Create testing module builder
    const moduleBuilder = Test.createTestingModule({
      imports: [testModule],
    });

    // Compile the module
    this.moduleRef = await moduleBuilder.compile();

    // Create application
    this.app = this.moduleRef.createNestApplication();

    // Apply minimal pipes
    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
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

  getApp(): INestApplication {
    return this.app;
  }

  getHttpServer() {
    return this.app.getHttpServer();
  }

  getModuleRef(): TestingModule {
    return this.moduleRef;
  }

  // Helper method to make simple requests
  async makeRequest(method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, body?: any) {
    const req = request(this.app.getHttpServer())[method](url);

    if (body) {
      req.send(body);
    }

    return req;
  }
}
