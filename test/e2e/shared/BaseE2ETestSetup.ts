import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '@soc-compliance/auth-common';
import request from 'supertest';
import { DataSource } from 'typeorm';

export interface E2ETestConfig {
  serviceName: string;
  servicePort: number;
  databaseName: string;
  moduleImports: any[];
}

export abstract class BaseE2ETestSetup {
  protected app: INestApplication;
  protected dataSource: DataSource;
  protected moduleRef: TestingModule;
  protected config: E2ETestConfig;

  constructor(config: E2ETestConfig) {
    this.config = config;
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

    // Create testing module with guard overrides
    const moduleBuilder = Test.createTestingModule({
      imports: this.config.moduleImports,
    });

    // Override guards to bypass authentication in tests
    moduleBuilder.overrideGuard(JwtAuthGuard).useValue({
      canActivate: () => true,
    });

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
    await this.applyServiceSpecificConfig(this.app);

    // Initialize app
    await this.app.init();

    // Get data source
    this.dataSource = this.moduleRef.get<DataSource>(DataSource);

    // Wait for database connection
    await this.waitForDatabaseConnection();

    return this.app;
  }

  protected abstract applyServiceSpecificConfig(app: INestApplication): Promise<void>;

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
    await queryRunner.connect();

    try {
      // Disable foreign key checks
      await queryRunner.query('SET session_replication_role = replica;');

      // Get all tables
      const tables = await queryRunner.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'typeorm_%'
      `);

      // Truncate all tables
      for (const { tablename } of tables) {
        await queryRunner.query(`TRUNCATE TABLE "${tablename}" CASCADE`);
      }

      // Re-enable foreign key checks
      await queryRunner.query('SET session_replication_role = DEFAULT;');
    } finally {
      await queryRunner.release();
    }
  }

  async seedDatabase(seedData: any): Promise<void> {
    // Override in service-specific setup classes
  }

  async waitForDatabaseConnection(maxRetries = 30): Promise<void> {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        await this.dataSource.query('SELECT 1');
        console.log(`✅ Database connection established for ${this.config.serviceName}`);
        return;
      } catch (error) {
        retries++;
        if (retries === maxRetries) {
          throw new Error(`Failed to connect to database after ${maxRetries} attempts`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  async waitForServiceHealth(maxRetries = 30): Promise<void> {
    let retries = 0;
    const healthUrl = `http://localhost:${this.config.servicePort}/health`;

    while (retries < maxRetries) {
      try {
        const response = await request(this.app.getHttpServer()).get('/health').expect(200);

        console.log(`✅ ${this.config.serviceName} is healthy`);
        return;
      } catch (error) {
        retries++;
        if (retries === maxRetries) {
          throw new Error(
            `${this.config.serviceName} failed health check after ${maxRetries} attempts`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
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
