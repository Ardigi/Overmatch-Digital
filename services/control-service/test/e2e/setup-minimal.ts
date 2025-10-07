import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Control } from '../../src/modules/controls/entities/control.entity';
import { ControlImplementation } from '../../src/modules/implementation/entities/control-implementation.entity';
import { ControlTestResult } from '../../src/modules/controls/entities/control-test-result.entity';
import { ControlException } from '../../src/modules/controls/entities/control-exception.entity';
import { ControlAssessment } from '../../src/modules/controls/entities/control-assessment.entity';
import { ControlMapping } from '../../src/modules/controls/entities/control-mapping.entity';
import { ControlTest } from '../../src/modules/control-tests/entities/control-test.entity';
import { ControlsController } from '../../src/modules/controls/controls.controller';
import { ControlsService } from '../../src/modules/controls/controls.service';
import { ImplementationController } from '../../src/modules/implementation/implementation.controller';
import { ImplementationService } from '../../src/modules/implementation/implementation.service';
import { FrameworksService } from '../../src/modules/frameworks/frameworks.service';
import { KafkaService } from '../../src/kafka/kafka.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '../../src/modules/redis/redis.service';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import { LoggingService, MetricsService, TracingService } from '@soc-compliance/monitoring';
import configuration from '../../src/config/configuration';

// Mock guard implementations
const mockAuthGuard = {
  canActivate: (context: any) => {
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

const mockRolesGuard = {
  canActivate: () => true,
};

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
    process.env.DISABLE_KAFKA = 'true';

    // Create a minimal testing module with only essential dependencies
    const moduleBuilder = Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => ({
            type: 'postgres',
            host: configService.get('DB_HOST', '127.0.0.1'),
            port: configService.get('DB_PORT', 5432),
            username: configService.get('DB_USERNAME', 'soc_user'),
            password: configService.get('DB_PASSWORD', 'soc_pass'),
            database: 'soc_controls_test',
            entities: [
              Control,
              ControlImplementation,
              ControlTestResult,
              ControlException,
              ControlAssessment,
              ControlMapping,
              ControlTest,
            ],
            synchronize: true, // Enable for tests to create schema
            logging: false,
          }),
          inject: [ConfigService],
        }),
        TypeOrmModule.forFeature([
          Control,
          ControlImplementation,
          ControlTestResult,
          ControlException,
          ControlAssessment,
          ControlMapping,
          ControlTest,
        ]),
      ],
      controllers: [ControlsController, ImplementationController],
      providers: [
        ControlsService,
        ImplementationService,
        {
          provide: FrameworksService,
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            findAll: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: KafkaService,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: LoggingService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            info: jest.fn(),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            increment: jest.fn(),
            histogram: jest.fn(),
            gauge: jest.fn(),
            timer: jest.fn(),
          },
        },
        {
          provide: TracingService,
          useValue: {
            createSpan: jest.fn(),
            finishSpan: jest.fn(),
            setTag: jest.fn(),
            startSpan: jest.fn(),
          },
        },
        EventEmitter2,
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            exists: jest.fn(),
            expire: jest.fn(),
            ttl: jest.fn(),
            incr: jest.fn(),
            setCache: jest.fn(),
            getCache: jest.fn(),
            delCache: jest.fn(),
            existsCache: jest.fn(),
            expireCache: jest.fn(),
            ttlCache: jest.fn(),
            invalidatePattern: jest.fn(),
            cacheControl: jest.fn(),
            getCachedControl: jest.fn(),
            invalidateControl: jest.fn(),
            cacheControlList: jest.fn(),
            getCachedControlList: jest.fn(),
            invalidateControlList: jest.fn(),
            onModuleInit: jest.fn(),
            onModuleDestroy: jest.fn(),
          },
        },
        {
          provide: ServiceDiscoveryService,
          useValue: {
            getServiceUrl: jest.fn(),
            discoverService: jest.fn(),
          },
        },
      ],
    });

    // Import guard classes for overriding
    const { JwtAuthGuard } = await import('@soc-compliance/auth-common');
    const { KongAuthGuard } = await import('../../src/shared/guards/kong-auth.guard');
    const { KongRolesGuard } = await import('../../src/shared/guards/kong-roles.guard');
    
    // Mock guards using actual guard classes
    moduleBuilder.overrideGuard(KongAuthGuard).useValue(mockAuthGuard);
    moduleBuilder.overrideGuard(KongRolesGuard).useValue(mockRolesGuard);
    moduleBuilder.overrideGuard(JwtAuthGuard).useValue(mockAuthGuard);

    this.moduleRef = await moduleBuilder.compile();

    // Create application
    this.app = this.moduleRef.createNestApplication();

    // Apply global pipes and settings
    this.app.setGlobalPrefix('api/v1');
    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: false,
        transform: true,
        forbidNonWhitelisted: false,
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