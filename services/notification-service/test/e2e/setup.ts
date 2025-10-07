import type { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BaseE2ETestSetup, E2ETestConfig } from '../../../../test/e2e/shared/BaseE2ETestSetup';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { TestAppModule } from './test-app-simple.module';

export class NotificationServiceE2ESetup extends BaseE2ETestSetup {
  constructor() {
    super({
      serviceName: 'notification-service',
      servicePort: 3010,
      databaseName: 'soc_notifications_test',
      moduleImports: [TestAppModule],
    });
  }

  async createTestApp(): Promise<INestApplication> {
    // Override environment variables for test
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
    process.env.DB_PORT = process.env.DB_PORT || '5433';
    process.env.DB_USERNAME = process.env.DB_USERNAME || 'soc_user';
    process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'soc_pass';
    process.env.DB_NAME = this.config.databaseName;
    process.env.REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
    process.env.REDIS_PORT = process.env.REDIS_PORT || '6380';
    process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'test_redis_pass';
    process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS || '127.0.0.1:9093';
    process.env.DISABLE_KAFKA = 'true';

    // Create testing module with guard overrides
    const appModule = await TestAppModule.forRoot();
    const moduleBuilder = Test.createTestingModule({
      imports: [appModule],
    });

    // Override ALL guards to bypass authentication in tests
    // Use the exact guards from the notification service
    moduleBuilder.overrideGuard(JwtAuthGuard).useValue({
      canActivate: () => true,
    });

    moduleBuilder.overrideGuard(RolesGuard).useValue({
      canActivate: () => true,
    });

    this.moduleRef = await moduleBuilder.compile();

    // Create application
    this.app = this.moduleRef.createNestApplication();

    // Apply global pipes and settings
    this.app.useGlobalPipes(
      new (await import('@nestjs/common')).ValidationPipe({
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
    const { DataSource } = await import('typeorm');
    this.dataSource = this.moduleRef.get(DataSource);

    // Wait for database connection
    await this.waitForDatabaseConnection();

    return this.app;
  }

  protected async applyServiceSpecificConfig(app: INestApplication): Promise<void> {
    // Add any notification-specific configuration here
    // For example, custom interceptors, filters, etc.
  }

  async seedTestData() {
    // Since notification service uses Redis, we'll seed data differently
    // This would typically involve creating test notification templates and preferences
    // Note: In a real implementation, you would:
    // 1. Connect to Redis
    // 2. Set up test notification templates
    // 3. Create test user preferences
    // 4. Set up test notification queues
  }

  async seedNotificationTemplates() {
    // This would be implemented to seed notification templates in Redis
    const templates = [
      {
        id: 'welcome-email',
        name: 'Welcome Email',
        type: 'email',
        subject: 'Welcome to SOC Compliance Platform',
        body: 'Hello {{userName}}, welcome to our platform!',
        variables: ['userName'],
      },
      {
        id: 'control-assigned',
        name: 'Control Assigned',
        type: 'email',
        subject: 'New Control Assigned: {{controlName}}',
        body: 'You have been assigned to control: {{controlName}}',
        variables: ['controlName', 'assignedBy'],
      },
      {
        id: 'evidence-due',
        name: 'Evidence Due Reminder',
        type: 'email',
        subject: 'Evidence Due Soon: {{evidenceName}}',
        body: 'Evidence {{evidenceName}} is due in {{daysUntilDue}} days.',
        variables: ['evidenceName', 'daysUntilDue', 'dueDate'],
      },
      {
        id: 'report-generated',
        name: 'Report Generated',
        type: 'email',
        subject: 'Report Ready: {{reportName}}',
        body: 'Your report {{reportName}} has been generated and is ready for download.',
        variables: ['reportName', 'downloadUrl'],
      },
    ];

    // In a real implementation, save these to Redis
  }

  async seedUserPreferences() {
    // This would be implemented to seed user notification preferences
    const preferences = [
      {
        userId: '11111111-1111-1111-1111-111111111111',
        email: 'test1@example.com',
        channels: {
          email: true,
          inApp: true,
          sms: false,
        },
        preferences: {
          controlAssigned: { email: true, inApp: true },
          evidenceDue: { email: true, inApp: true },
          reportGenerated: { email: false, inApp: true },
        },
      },
      {
        userId: '22222222-2222-2222-2222-222222222222',
        email: 'test2@example.com',
        channels: {
          email: false,
          inApp: true,
          sms: false,
        },
        preferences: {
          controlAssigned: { email: false, inApp: true },
          evidenceDue: { email: false, inApp: true },
          reportGenerated: { email: false, inApp: true },
        },
      },
    ];

    // In a real implementation, save these to Redis
  }
}
