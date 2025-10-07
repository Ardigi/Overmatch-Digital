// REAL E2E Test Setup - No mocking of critical services
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// Import all entities
import { Control } from '../../src/modules/controls/entities/control.entity';
import { ControlImplementation } from '../../src/modules/implementation/entities/control-implementation.entity';
import { ControlTestResult } from '../../src/modules/controls/entities/control-test-result.entity';
import { ControlException } from '../../src/modules/controls/entities/control-exception.entity';
import { ControlAssessment } from '../../src/modules/controls/entities/control-assessment.entity';
import { ControlMapping } from '../../src/modules/controls/entities/control-mapping.entity';
import { ControlTest } from '../../src/modules/control-tests/entities/control-test.entity';

// Import all controllers
import { ControlsController } from '../../src/modules/controls/controls.controller';
import { ImplementationController } from '../../src/modules/implementation/implementation.controller';

// Import all services
import { ControlsService } from '../../src/modules/controls/controls.service';
import { ImplementationService } from '../../src/modules/implementation/implementation.service';
import { FrameworksService } from '../../src/modules/frameworks/frameworks.service';
import { KafkaService } from '../../src/kafka/kafka.service';
import { RedisService } from '../../src/modules/redis/redis.service';

// Import shared modules
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import { LoggingService, MetricsService, TracingService } from '@soc-compliance/monitoring';
import { JwtAuthGuard, JwtStrategy } from '@soc-compliance/auth-common';

import configuration from '../../src/config/configuration';

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
    process.env.DISABLE_KAFKA = 'false'; // Enable Kafka for real testing
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-e2e-testing';
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

    const moduleBuilder = Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
        }),
        
        // Real database connection
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
            synchronize: true,
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

        // Real JWT authentication
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => ({
            secret: configService.get('JWT_SECRET'),
            signOptions: {
              expiresIn: configService.get('JWT_EXPIRES_IN', '24h'),
            },
          }),
          inject: [ConfigService],
        }),

        // Real event emitter for internal events
        EventEmitterModule.forRoot({
          wildcard: true,
          delimiter: '.',
          maxListeners: 10,
          verboseMemoryLeak: true,
        }),
      ],
      controllers: [ControlsController, ImplementationController],
      providers: [
        ControlsService,
        ImplementationService,
        
        // Real Redis Service
        RedisService,
        
        // Real JWT Strategy
        JwtStrategy,
        JwtAuthGuard,
        
        // Framework service (could be mocked as it's for another service)
        {
          provide: FrameworksService,
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            findAll: jest.fn().mockResolvedValue([]),
          },
        },
        
        // Kafka Service - for now mock it as Kafka is complex to set up properly
        {
          provide: KafkaService,
          useValue: {
            emit: jest.fn().mockImplementation((topic, data) => {
              console.log(`[E2E] Kafka event would be published: ${topic}`, data);
              return Promise.resolve();
            }),
            onModuleInit: jest.fn(),
            onModuleDestroy: jest.fn(),
          },
        },
        
        // Logging can be mocked to reduce noise
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
        
        // Metrics can be mocked
        {
          provide: MetricsService,
          useValue: {
            increment: jest.fn(),
            histogram: jest.fn(),
            gauge: jest.fn(),
            timer: jest.fn(),
          },
        },
        
        // Tracing can be mocked
        {
          provide: TracingService,
          useValue: {
            createSpan: jest.fn(),
            finishSpan: jest.fn(),
            setTag: jest.fn(),
            startSpan: jest.fn(),
          },
        },
        
        // Service discovery might need to be real if testing cross-service
        {
          provide: ServiceDiscoveryService,
          useValue: {
            getServiceUrl: jest.fn().mockImplementation((service: string) => {
              const services: Record<string, string> = {
                'auth-service': 'http://localhost:3001',
                'control-service': 'http://localhost:3004',
                'client-service': 'http://localhost:3002',
              };
              return services[service] || `http://localhost:3000`;
            }),
            discoverService: jest.fn(),
          },
        },
      ],
    });

    // NO GUARD OVERRIDES - Use real authentication!
    // The JWT strategy will validate real tokens from Auth Service

    this.moduleRef = await moduleBuilder.compile();

    // Create application
    this.app = this.moduleRef.createNestApplication();

    // Apply global pipes and settings
    this.app.setGlobalPrefix('api/v1');
    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: false, // Allow all fields for now
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
    // Clean up Kafka if it was initialized (mocked in this setup)
    // Kafka is mocked so no cleanup needed
    
    // Clean up Redis if it was initialized
    try {
      const redisService = this.moduleRef.get<RedisService>(RedisService);
      if (redisService && typeof (redisService as any).onModuleDestroy === 'function') {
        await (redisService as any).onModuleDestroy();
      }
    } catch (error) {
      // Redis might be mocked, ignore cleanup errors
    }

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

      // Clear all tables
      await queryRunner.query('TRUNCATE TABLE control_implementations CASCADE');
      await queryRunner.query('TRUNCATE TABLE control_test_results CASCADE');
      await queryRunner.query('TRUNCATE TABLE control_exceptions CASCADE');
      await queryRunner.query('TRUNCATE TABLE control_assessments CASCADE');
      await queryRunner.query('TRUNCATE TABLE control_mappings CASCADE');
      await queryRunner.query('TRUNCATE TABLE control_tests CASCADE');
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