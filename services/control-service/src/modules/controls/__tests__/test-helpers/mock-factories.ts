import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { KafkaService } from '../../../../kafka/kafka.service';
import { RedisService } from '../../../redis/redis.service';
import type { Control } from '../../entities/control.entity';
import type { ControlAssessment } from '../../entities/control-assessment.entity';
import type { ControlException } from '../../entities/control-exception.entity';
import type { ControlImplementation } from '../../../implementation/entities/control-implementation.entity';
import type { ControlMapping } from '../../entities/control-mapping.entity';
import type { ControlTestResult } from '../../entities/control-test-result.entity';
import { KongUserType } from '../../../../shared/decorators/kong-user.decorator';

// Mock Logger interface
interface MockLogger {
  error: jest.MockedFunction<(...args: any[]) => void>;
  warn: jest.MockedFunction<(...args: any[]) => void>;
  log: jest.MockedFunction<(...args: any[]) => void>;
  debug: jest.MockedFunction<(...args: any[]) => void>;
  verbose: jest.MockedFunction<(...args: any[]) => void>;
  info: jest.MockedFunction<(...args: any[]) => void>;
}

// Mock ConfigService interface
interface MockConfigService extends Partial<ConfigService> {
  get: jest.MockedFunction<(key: string, defaultValue?: any) => any>;
}

// Mock Service Discovery interface
interface MockServiceDiscovery {
  callService: jest.MockedFunction<(serviceName: string, endpoint: string, options?: any) => Promise<any>>;
  configService: MockConfigService;
  httpClient: Record<string, any>;
  logger: MockLogger;
  serviceRegistry: Map<string, any>;
}

// Mock Metrics Service interface
interface MockMetricsService {
  recordMetric: jest.MockedFunction<(name: string, value: number, tags?: Record<string, string>) => void>;
  incrementCounter: jest.MockedFunction<(name: string, tags?: Record<string, string>) => void>;
  recordHistogram: jest.MockedFunction<(name: string, value: number, tags?: Record<string, string>) => void>;
  recordGauge: jest.MockedFunction<(name: string, value: number, tags?: Record<string, string>) => void>;
}

// Mock Tracing Service interface
interface MockTracingService {
  startSpan: jest.MockedFunction<(name: string, options?: any) => any>;
  finishSpan: jest.MockedFunction<(span: any) => void>;
  addTags: jest.MockedFunction<(span: any, tags: Record<string, any>) => void>;
  logError: jest.MockedFunction<(span: any, error: Error) => void>;
}

// Mock Logging Service interface
interface MockLoggingService extends MockLogger {
  createLogger: jest.MockedFunction<(context: string) => MockLogger>;
  setContext: jest.MockedFunction<(context: string) => void>;
}

// Mock Frameworks Service interface
interface MockFrameworksService {
  getFrameworks: jest.MockedFunction<() => Promise<any[]>>;
  getFrameworkById: jest.MockedFunction<(id: string) => Promise<any>>;
  validateFramework: jest.MockedFunction<(frameworkId: string) => Promise<boolean>>;
  getControlMappings: jest.MockedFunction<(controlId: string) => Promise<any[]>>;
}

export function createMockLogger(): MockLogger {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    info: jest.fn(),
  };
}

export function createMockConfigService(): MockConfigService {
  return {
    get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        'REDIS_HOST': '127.0.0.1',
        'REDIS_PORT': 6379,
        'REDIS_PASSWORD': 'test-password',
        'REDIS_DB': 0,
        'DATABASE_URL': 'postgresql://test:test@127.0.0.1:5432/test',
      };
      return config[key] || defaultValue;
    }),
  };
}

// Mock RedisService with proper Jest typing
type MockRedisService = {
  [K in keyof RedisService]: K extends keyof MockLogger | keyof MockConfigService
    ? RedisService[K]
    : jest.MockedFunction<RedisService[K]>;
};

export function createMockRedisService(): MockRedisService {
  const mockLogger = createMockLogger();
  const mockConfigService = createMockConfigService();

  return {
    // Core properties
    client: null,
    prefix: 'control:',
    configService: mockConfigService,
    logger: mockLogger,

    // Lifecycle methods with proper Jest typing
    onModuleInit: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<RedisService['onModuleInit']>,
    onModuleDestroy: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<RedisService['onModuleDestroy']>,

    // Cache operations with proper Jest typing
    setCache: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<RedisService['setCache']>,
    getCache: jest.fn().mockResolvedValue(null) as jest.MockedFunction<RedisService['getCache']>,
    delCache: jest.fn().mockResolvedValue(0) as jest.MockedFunction<RedisService['delCache']>,
    existsCache: jest.fn().mockResolvedValue(false) as jest.MockedFunction<RedisService['existsCache']>,
    expireCache: jest.fn().mockResolvedValue(true) as jest.MockedFunction<RedisService['expireCache']>,
    ttlCache: jest.fn().mockResolvedValue(-1) as jest.MockedFunction<RedisService['ttlCache']>,
    invalidatePattern: jest.fn().mockResolvedValue(0) as jest.MockedFunction<RedisService['invalidatePattern']>,

    // Control-specific methods with proper Jest typing
    cacheControl: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<RedisService['cacheControl']>,
    getCachedControl: jest.fn().mockResolvedValue(null) as jest.MockedFunction<RedisService['getCachedControl']>,
    invalidateControl: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<RedisService['invalidateControl']>,
    cacheControlList: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<RedisService['cacheControlList']>,
    getCachedControlList: jest.fn().mockResolvedValue(null) as jest.MockedFunction<RedisService['getCachedControlList']>,
    invalidateControlList: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<RedisService['invalidateControlList']>,

    // Category methods with proper Jest typing
    cacheCategory: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<RedisService['cacheCategory']>,
    getCachedCategory: jest.fn().mockResolvedValue(null) as jest.MockedFunction<RedisService['getCachedCategory']>,
    invalidateCategory: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<RedisService['invalidateCategory']>,

    // Implementation methods with proper Jest typing
    cacheImplementation: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<RedisService['cacheImplementation']>,
    getCachedImplementation: jest.fn().mockResolvedValue(null) as jest.MockedFunction<RedisService['getCachedImplementation']>,
    invalidateImplementation: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<RedisService['invalidateImplementation']>,

    // Test result methods with proper Jest typing
    cacheTestResult: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<RedisService['cacheTestResult']>,
    getCachedTestResult: jest.fn().mockResolvedValue(null) as jest.MockedFunction<RedisService['getCachedTestResult']>,
    invalidateTestResults: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<RedisService['invalidateTestResults']>,

    // Coverage methods with proper Jest typing
    cacheCoverage: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<RedisService['cacheCoverage']>,
    getCachedCoverage: jest.fn().mockResolvedValue(null) as jest.MockedFunction<RedisService['getCachedCoverage']>,
    invalidateCoverage: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<RedisService['invalidateCoverage']>,

    // Lock methods with proper Jest typing
    acquireLock: jest.fn().mockResolvedValue('mock-lock-id') as jest.MockedFunction<RedisService['acquireLock']>,
    releaseLock: jest.fn().mockResolvedValue(true) as jest.MockedFunction<RedisService['releaseLock']>,
    
    // Generic Redis operations (added for compatibility)
    get: jest.fn().mockResolvedValue(null) as jest.MockedFunction<RedisService['get']>,
    set: jest.fn().mockResolvedValue('OK') as jest.MockedFunction<RedisService['set']>,
    incr: jest.fn().mockResolvedValue(1) as jest.MockedFunction<RedisService['incr']>,
    del: jest.fn().mockResolvedValue(1) as jest.MockedFunction<RedisService['del']>,
    exists: jest.fn().mockResolvedValue(1) as jest.MockedFunction<RedisService['exists']>,
    expire: jest.fn().mockResolvedValue(1) as jest.MockedFunction<RedisService['expire']>,
    ttl: jest.fn().mockResolvedValue(-1) as jest.MockedFunction<RedisService['ttl']>,
  } as MockRedisService;
}

// Mock KafkaService with proper Jest typing
type MockKafkaService = {
  [K in keyof KafkaService]: K extends 'kafkaClient'
    ? KafkaService[K]
    : jest.MockedFunction<KafkaService[K]>;
};

export function createMockKafkaService(): MockKafkaService {
  return {
    kafkaClient: {}, // Empty object is sufficient for mocking
    emit: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<KafkaService['emit']>,
  } as MockKafkaService;
}

// Mock EventEmitter2 with proper Jest typing
type MockEventEmitter2 = {
  [K in keyof EventEmitter2]: jest.MockedFunction<EventEmitter2[K]>;
};

export function createMockEventEmitter(): MockEventEmitter2 {
  const mockEventEmitter: any = {
    emit: jest.fn().mockReturnValue(true),
    on: jest.fn().mockReturnThis(),
    once: jest.fn().mockReturnThis(), 
    off: jest.fn().mockReturnThis(),
    removeListener: jest.fn().mockReturnThis(),
    removeAllListeners: jest.fn().mockReturnThis(),
    listeners: jest.fn().mockReturnValue([]),
    listenerCount: jest.fn().mockReturnValue(0),
    setMaxListeners: jest.fn().mockReturnThis(),
    getMaxListeners: jest.fn().mockReturnValue(10),
    eventNames: jest.fn().mockReturnValue([]),
    prependListener: jest.fn().mockReturnThis(),
    prependOnceListener: jest.fn().mockReturnThis(),
    addListener: jest.fn().mockReturnThis(),
    emitAsync: jest.fn().mockResolvedValue([]),
    waitFor: jest.fn().mockResolvedValue(undefined),
    // Additional EventEmitter2 methods
    many: jest.fn().mockReturnThis(),
    prependMany: jest.fn().mockReturnThis(),
    onAny: jest.fn().mockReturnThis(),
    prependAny: jest.fn().mockReturnThis(),
    offAny: jest.fn().mockReturnThis(),
    listenersAny: jest.fn().mockReturnValue([]),
  };
  
  // Set up mockReturnThis to return the mock object itself
  Object.keys(mockEventEmitter).forEach(key => {
    if (typeof mockEventEmitter[key].mockReturnThis === 'function') {
      mockEventEmitter[key].mockReturnThis = () => mockEventEmitter[key].mockReturnValue(mockEventEmitter);
    }
  });
  
  return mockEventEmitter as MockEventEmitter2;
}

export function createMockServiceDiscovery(): MockServiceDiscovery {
  return {
    callService: jest.fn().mockResolvedValue({ success: true, data: {} }),
    configService: createMockConfigService(),
    httpClient: {},
    logger: createMockLogger(),
    serviceRegistry: new Map(),
  };
}

export function createMockMetricsService(): MockMetricsService {
  return {
    recordMetric: jest.fn(),
    incrementCounter: jest.fn(),
    recordHistogram: jest.fn(),
    recordGauge: jest.fn(),
  };
}

export function createMockTracingService(): MockTracingService {
  return {
    startSpan: jest.fn().mockReturnValue({ id: 'mock-span-id' }),
    finishSpan: jest.fn(),
    addTags: jest.fn(),
    logError: jest.fn(),
  };
}

export function createMockLoggingService(): MockLoggingService {
  const baseLogger = createMockLogger();
  return {
    ...baseLogger,
    createLogger: jest.fn().mockReturnValue(baseLogger),
    setContext: jest.fn(),
  };
}

export function createMockFrameworksService(): MockFrameworksService {
  return {
    getFrameworks: jest.fn().mockResolvedValue([]),
    getFrameworkById: jest.fn().mockResolvedValue({ id: 'framework-1', name: 'Test Framework' }),
    validateFramework: jest.fn().mockResolvedValue(true),
    getControlMappings: jest.fn().mockResolvedValue([]),
  };
}

// Helper function to create test user objects
export function createTestUser(overrides: Partial<KongUserType> = {}): KongUserType {
  return {
    id: 'user-123',
    email: 'test@example.com',
    roles: ['admin', 'compliance_manager'],
    organizationId: 'org-123',
    ...overrides,
  };
}

// Mock Repository Type with proper Jest typing  
export type MockRepository<T extends Record<string, any> = any> = {
  [K in keyof Repository<T>]: Repository<T>[K] extends (...args: any[]) => any
    ? jest.MockedFunction<Repository<T>[K]>
    : Repository<T>[K];
};

export function createMockRepository<T extends Record<string, any> = any>(): MockRepository<T> {
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndMapOne: jest.fn().mockReturnThis(),
    leftJoinAndMapMany: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoinAndMapOne: jest.fn().mockReturnThis(),
    innerJoinAndMapMany: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
    getCount: jest.fn().mockResolvedValue(0),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawOne: jest.fn().mockResolvedValue(null),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnThis(),
  };

  return {
    target: {}, // Repository target object
    manager: {}, // EntityManager object
    metadata: {}, // EntityMetadata object
    queryRunner: undefined,
    
    // Repository methods with proper Jest typing
    create: jest.fn().mockImplementation((entityLike: any) => ({ ...entityLike, id: 'generated-id' })) as jest.MockedFunction<Repository<T>['create']>,
    merge: jest.fn().mockImplementation((entity: any, ...rest: any[]) => ({ ...entity, ...Object.assign({}, ...rest) })) as jest.MockedFunction<Repository<T>['merge']>,
    preload: jest.fn().mockResolvedValue(null) as jest.MockedFunction<Repository<T>['preload']>,
    save: jest.fn().mockImplementation(async (entity) => Array.isArray(entity) ? entity : entity) as jest.MockedFunction<Repository<T>['save']>,
    remove: jest.fn().mockImplementation(async (entity) => Array.isArray(entity) ? entity : entity) as jest.MockedFunction<Repository<T>['remove']>,
    softRemove: jest.fn().mockImplementation(async (entity) => Array.isArray(entity) ? entity : entity) as jest.MockedFunction<Repository<T>['softRemove']>,
    recover: jest.fn().mockImplementation(async (entity) => Array.isArray(entity) ? entity : entity) as jest.MockedFunction<Repository<T>['recover']>,
    insert: jest.fn().mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] }) as jest.MockedFunction<Repository<T>['insert']>,
    update: jest.fn().mockResolvedValue({ affected: 0, generatedMaps: [], raw: [] }) as jest.MockedFunction<Repository<T>['update']>,
    upsert: jest.fn().mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] }) as jest.MockedFunction<Repository<T>['upsert']>,
    delete: jest.fn().mockResolvedValue({ affected: 0, raw: [] }) as jest.MockedFunction<Repository<T>['delete']>,
    softDelete: jest.fn().mockResolvedValue({ affected: 0, generatedMaps: [], raw: [] }) as jest.MockedFunction<Repository<T>['softDelete']>,
    restore: jest.fn().mockResolvedValue({ affected: 0, generatedMaps: [], raw: [] }) as jest.MockedFunction<Repository<T>['restore']>,
    
    // Find methods with proper Jest typing
    find: jest.fn().mockResolvedValue([]) as jest.MockedFunction<Repository<T>['find']>,
    findBy: jest.fn().mockResolvedValue([]) as jest.MockedFunction<Repository<T>['findBy']>,
    findAndCount: jest.fn().mockResolvedValue([[], 0]) as jest.MockedFunction<Repository<T>['findAndCount']>,
    findAndCountBy: jest.fn().mockResolvedValue([[], 0]) as jest.MockedFunction<Repository<T>['findAndCountBy']>,
    findOne: jest.fn().mockResolvedValue(null) as jest.MockedFunction<Repository<T>['findOne']>,
    findOneBy: jest.fn().mockResolvedValue(null) as jest.MockedFunction<Repository<T>['findOneBy']>,
    findOneOrFail: jest.fn().mockRejectedValue(new Error('Entity not found')) as jest.MockedFunction<Repository<T>['findOneOrFail']>,
    findOneByOrFail: jest.fn().mockRejectedValue(new Error('Entity not found')) as jest.MockedFunction<Repository<T>['findOneByOrFail']>,
    
    // Count methods with proper Jest typing
    count: jest.fn().mockResolvedValue(0) as jest.MockedFunction<Repository<T>['count']>,
    countBy: jest.fn().mockResolvedValue(0) as jest.MockedFunction<Repository<T>['countBy']>,
    sum: jest.fn().mockResolvedValue(0) as jest.MockedFunction<Repository<T>['sum']>,
    average: jest.fn().mockResolvedValue(0) as jest.MockedFunction<Repository<T>['average']>,
    minimum: jest.fn().mockResolvedValue(0) as jest.MockedFunction<Repository<T>['minimum']>,
    maximum: jest.fn().mockResolvedValue(0) as jest.MockedFunction<Repository<T>['maximum']>,
    
    // Query builder with proper Jest typing
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder) as jest.MockedFunction<Repository<T>['createQueryBuilder']>,
    
    // Others with proper Jest typing
    exist: jest.fn().mockResolvedValue(false) as jest.MockedFunction<Repository<T>['exist']>,
    existsBy: jest.fn().mockResolvedValue(false) as jest.MockedFunction<Repository<T>['existsBy']>,
    increment: jest.fn().mockResolvedValue({ affected: 0, generatedMaps: [], raw: [] }) as jest.MockedFunction<Repository<T>['increment']>,
    decrement: jest.fn().mockResolvedValue({ affected: 0, generatedMaps: [], raw: [] }) as jest.MockedFunction<Repository<T>['decrement']>,
    clear: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<Repository<T>['clear']>,
    
    // Extensions
    extend: jest.fn().mockReturnValue({}) as jest.MockedFunction<Repository<T>['extend']>,
  } as MockRepository<T>;
}

// Specialized repository factories with proper typing
export function createMockControlRepository(controlsDb?: Map<string, Control>): MockRepository<Control> {
  const baseRepo = createMockRepository<Control>();
  
  // If controlsDb is provided, enhance the repository with stateful query builder
  if (controlsDb) {
    baseRepo.createQueryBuilder = jest.fn().mockImplementation(() => ({
      _filters: {} as any, // Store filter conditions
      andWhere: jest.fn().mockImplementation(function(condition: string, params?: any) {
        // Parse common filter conditions
        if (condition.includes('control.status = :status') && params?.status) {
          this._filters.status = params.status;
        }
        if (condition.includes('control.type = :type') && params?.type) {
          this._filters.type = params.type;
        }
        if (condition.includes('control.category = :category') && params?.category) {
          this._filters.category = params.category;
        }
        return this;
      }),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndMapOne: jest.fn().mockReturnThis(),
      leftJoinAndMapMany: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoinAndMapOne: jest.fn().mockReturnThis(),
      innerJoinAndMapMany: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      having: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockImplementation(async function() {
        let controls = Array.from(controlsDb.values());
        
        // Apply filters
        if (this._filters.status) {
          controls = controls.filter((c) => c.status === this._filters.status);
        }
        if (this._filters.type) {
          controls = controls.filter((c) => c.type === this._filters.type);
        }
        if (this._filters.category) {
          controls = controls.filter((c) => c.category === this._filters.category);
        }
        
        return [controls, controls.length];
      }),
      getMany: jest.fn().mockImplementation(async function() {
        let controls = Array.from(controlsDb.values());
        
        // Apply filters
        if (this._filters.status) {
          controls = controls.filter((c) => c.status === this._filters.status);
        }
        if (this._filters.type) {
          controls = controls.filter((c) => c.type === this._filters.type);
        }
        if (this._filters.category) {
          controls = controls.filter((c) => c.category === this._filters.category);
        }
        
        return controls;
      }),
      getOne: jest.fn().mockImplementation(async function() {
        let controls = Array.from(controlsDb.values());
        
        // Apply filters
        if (this._filters.status) {
          controls = controls.filter((c) => c.status === this._filters.status);
        }
        if (this._filters.type) {
          controls = controls.filter((c) => c.type === this._filters.type);
        }
        if (this._filters.category) {
          controls = controls.filter((c) => c.category === this._filters.category);
        }
        
        return controls[0] || null;
      }),
      getRawMany: jest.fn().mockImplementation(async function() {
        // Detect coverage queries by checking for COUNT and SELECT patterns
        const selectCalls = this.select && this.select.mock ? this.select.mock.calls : [];
        const addSelectCalls = this.addSelect && this.addSelect.mock ? this.addSelect.mock.calls : [];
        
        // Check if this looks like a coverage query
        const allSelectParams = [...selectCalls, ...addSelectCalls].flat().join(' ');
        const isCoverageQuery = allSelectParams.includes('COUNT') || 
                               allSelectParams.includes('total_controls') ||
                               allSelectParams.includes('implemented_controls');
        
        if (isCoverageQuery || this._isCoverageQuery) {
          // Return category-wise coverage data for the coverage calculation
          return [
            {
              category: 'ACCESS_CONTROL',
              type: 'PREVENTIVE',
              total_controls: 2,
              implemented_controls: 1,
              fully_implemented: 1,
            },
            {
              category: 'AUDIT_ACCOUNTABILITY', 
              type: 'PREVENTIVE',
              total_controls: 1,
              implemented_controls: 0,
              fully_implemented: 0,
            }
          ];
        }
        return [];
      }),
      getRawOne: jest.fn().mockImplementation(async function() {
        // Detect coverage queries by checking for COUNT and SELECT patterns
        const selectCalls = this.select && this.select.mock ? this.select.mock.calls : [];
        const addSelectCalls = this.addSelect && this.addSelect.mock ? this.addSelect.mock.calls : [];
        
        // Check if this looks like a coverage query
        const allSelectParams = [...selectCalls, ...addSelectCalls].flat().join(' ');
        const isCoverageQuery = allSelectParams.includes('COUNT') || 
                               allSelectParams.includes('total_controls') ||
                               allSelectParams.includes('implemented_controls');
        
        if (isCoverageQuery || this._isCoverageQuery) {
          return {
            total_controls: 3,
            implemented_controls: 1,
            fully_implemented: 1,
          };
        }
        return null;
      }),
      getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
    }));
  }
  
  return baseRepo;
}

export function createMockImplementationRepository(): MockRepository<ControlImplementation> {
  return createMockRepository<ControlImplementation>();
}

export function createMockTestResultRepository(): MockRepository<ControlTestResult> {
  return createMockRepository<ControlTestResult>();
}

export function createMockExceptionRepository(): MockRepository<ControlException> {
  return createMockRepository<ControlException>();
}

export function createMockAssessmentRepository(): MockRepository<ControlAssessment> {
  return createMockRepository<ControlAssessment>();
}

export function createMockMappingRepository(): MockRepository<ControlMapping> {
  return createMockRepository<ControlMapping>();
}

// Mock Control Entity Factory
export function createMockControl(overrides: Partial<Control> = {}): Control {
  return {
    id: 'control-123',
    code: 'AC-1',
    name: 'Access Control Policy',
    description: 'Establish access control policy',
    type: 'PREVENTIVE',
    category: 'ACCESS_CONTROL',
    status: 'ACTIVE',
    frequency: 'CONTINUOUS',
    objective: 'Ensure proper access control',
    requirements: 'Policy must be documented and approved',
    frameworks: [
      { name: 'SOC2', section: 'CC6.1', requirements: 'Access control policy required' },
      { name: 'ISO27001', section: 'A.9.1', requirements: 'Access control policy' },
    ],
    implementationGuidance: 'Develop comprehensive access control policy',
    testProcedures: ['Review policy documentation', 'Interview process owners'],
    evidenceRequirements: ['Policy document', 'Approval records'],
    metrics: {
      successRate: 0.95,
      avgTestDuration: 120,
      lastTestDate: new Date('2024-12-01'),
      totalTests: 25,
      failureCount: 1,
    },
    automationCapable: true,
    automationImplemented: false,
    automationDetails: {
      tool: 'Custom Script',
      schedule: '0 0 * * *',
      lastRun: new Date('2024-12-15'),
    },
    automationConfig: {
      isAutomated: false,
      automationType: 'manual',
    },
    relatedControls: ['AC-2', 'AC-3'],
    compensatingControls: ['AC-4'],
    tags: ['security', 'access-control', 'mandatory'],
    ownerId: 'user-456',
    organizationId: 'org-123',
    riskRating: 'high',
    costOfImplementation: 50000,
    costOfTesting: 5000,
    regulatoryRequirement: true,
    dataClassification: 'confidential',
    businessProcesses: ['user-access', 'authentication'],
    systemComponents: ['identity-provider', 'access-gateway'],
    riskFactors: [],
    stakeholders: [],
    customFields: {},
    version: 1,
    createdBy: 'user-789',
    updatedBy: 'user-789',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-12-15'),
    effectiveness: {
      score: 85,
      lastAssessmentDate: new Date('2024-12-01'),
      assessmentMethod: 'automated',
      strengths: ['Well documented', 'Automated monitoring'],
      weaknesses: ['Manual testing required'],
      improvements: ['Implement automated testing']
    },
    // Relations
    implementations: [],
    testResults: [],
    exceptions: [],
    assessments: [],
    mappings: [],
    tests: [],
    priority: 'medium',
    ...overrides,
  } as Control;
}
