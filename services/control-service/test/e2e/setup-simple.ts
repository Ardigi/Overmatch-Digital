import { type INestApplication, ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { KongAuthGuard } from '../../src/shared/guards/kong-auth.guard';
import { RolesGuard } from '@soc-compliance/auth-common';

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

    // Create testing module WITHOUT guard overrides
    // We'll handle authentication via headers instead
    const moduleBuilder = Test.createTestingModule({
      imports: [appModule],
    });

    // Override guards to pass through but still process headers
    const mockAuthGuard = {
      canActivate: (context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest();
        const headers = request.headers;
        
        // Process authentication headers if present
        if (headers['x-user-id']) {
          request.user = {
            id: headers['x-user-id'],
            email: headers['x-user-email'] || 'test@example.com',
            organizationId: headers['x-organization-id'],
            roles: headers['x-user-roles']?.split(',') || [],
          };
        }
        
        return true;
      },
    };

    // Override guards using the actual class references
    moduleBuilder.overrideGuard(KongAuthGuard).useValue(mockAuthGuard);
    moduleBuilder.overrideGuard(RolesGuard).useValue({ canActivate: () => true });

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
}