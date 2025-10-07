import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { JwtAuthGuard, RolesGuard } from '@soc-compliance/auth-common';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { KongAuthGuard } from '../../src/shared/guards/kong-auth.guard';

export class ControlServiceE2ESetup {
  private app: INestApplication;
  private dataSource: DataSource;
  private moduleRef: TestingModule;

  async createTestApp(): Promise<INestApplication> {
    // Override environment variables for test
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
    process.env.DB_PORT = process.env.DB_PORT || '5432';
    process.env.DB_USERNAME = process.env.DB_USERNAME || 'soc_user';
    process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'soc_pass';
    process.env.DB_NAME = 'soc_controls_test';
    process.env.REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
    process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
    process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'soc_redis_pass';
    process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS || '127.0.0.1:9093';
    process.env.DISABLE_KAFKA = 'true';

    // Use the async forRoot method to get the properly configured module
    const appModule = await AppModule.forRoot();

    // Create testing module with guard overrides
    const moduleBuilder = Test.createTestingModule({
      imports: [appModule],
    });

    // Override guards to mock authentication for E2E tests
    // Keep Kong Auth Guard active but mock the headers in tests
    moduleBuilder.overrideGuard(RolesGuard).useValue({
      canActivate: () => true,
    });

    // Don't override KongAuthGuard - let it process our mock headers
    // moduleBuilder.overrideGuard(KongAuthGuard).useValue({
    //   canActivate: () => true,
    // });

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

      // Clear the main tables used in tests
      await queryRunner.query('TRUNCATE TABLE control_implementations CASCADE');
      await queryRunner.query('TRUNCATE TABLE controls CASCADE');

      // Re-enable foreign key checks
      await queryRunner.query('SET session_replication_role = DEFAULT;');
    } catch (error) {
      console.log('Database cleanup error (might be expected for initial run):', error.message);
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

  protected async applyServiceSpecificConfig(app: INestApplication): Promise<void> {
    // Apply any control service specific configuration
    app.setGlobalPrefix('api/v1');
  }

  async seedControlData(frameworkId: string): Promise<{
    category: any;
    control: any;
  }> {
    const categoryData = {
      name: 'Access Control',
      description: 'Controls for managing access',
      frameworkId,
      parentId: null,
      order: 1,
      metadata: {},
    };

    const categoryResult = await this.dataSource.query(
      `INSERT INTO control_categories (name, description, "frameworkId", "parentId", "order", metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      Object.values(categoryData)
    );

    const category = categoryResult[0];

    const controlData = {
      categoryId: category.id,
      frameworkId,
      code: `TC-${Date.now()}`,
      name: 'Test Control',
      description: 'Test control description',
      type: 'preventive',
      frequency: 'quarterly',
      evidenceRequirements: ['Test evidence'],
      metadata: {},
    };

    const controlResult = await this.dataSource.query(
      `INSERT INTO controls ("categoryId", "frameworkId", code, name, description, type, frequency, "evidenceRequirements", metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      Object.values(controlData)
    );

    return {
      category,
      control: controlResult[0],
    };
  }

  async seedControlImplementation(controlId: string, organizationId: string): Promise<any> {
    const implementationData = {
      controlId,
      organizationId,
      status: 'not_started',
      assignedTo: null,
      implementationDetails: {},
      lastTestedAt: null,
      nextTestDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
    };

    const result = await this.dataSource.query(
      `INSERT INTO control_implementations ("controlId", "organizationId", status, "assignedTo", "implementationDetails", "lastTestedAt", "nextTestDate")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      Object.values(implementationData)
    );

    return result[0];
  }

  async seedControlTest(controlId: string, organizationId: string, testedBy: string): Promise<any> {
    const testData = {
      controlId,
      organizationId,
      testDate: new Date(),
      testedBy,
      status: 'passed',
      findings: [],
      evidence: [],
      notes: 'Test passed successfully',
    };

    const result = await this.dataSource.query(
      `INSERT INTO control_tests ("controlId", "organizationId", "testDate", "testedBy", status, findings, evidence, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      Object.values(testData)
    );

    return result[0];
  }
}
