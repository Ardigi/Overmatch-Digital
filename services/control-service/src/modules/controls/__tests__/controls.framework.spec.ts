import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { KafkaService } from '../../../kafka/kafka.service';
import { FrameworksService } from '../../frameworks/frameworks.service';
import { ControlsService } from '../controls.service';
import {
  type Control,
  ControlCategory,
  ControlFrequency,
  ControlStatus,
  ControlType,
} from '../entities/control.entity';
import { ControlAssessment } from '../entities/control-assessment.entity';
import { ControlException } from '../entities/control-exception.entity';
import {
  ControlImplementation,
  ImplementationStatus,
} from '../../implementation/entities/control-implementation.entity';
import { ControlMapping } from '../entities/control-mapping.entity';
import { ControlTestResult } from '../entities/control-test-result.entity';

describe('Controls Framework Mapping Tests', () => {
  let service: ControlsService;
  let controlRepository: any;
  let implementationRepository: any;
  let testResultRepository: any;
  let exceptionRepository: any;
  let assessmentRepository: any;
  let mappingRepository: any;
  let eventEmitter: any;
  let kafkaService: any;
  let frameworksService: any;
  let configService: any;

  const mockControlRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
  };

  const mockImplementationRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTestResultRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getManyAndCount: jest.fn(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn(),
    having: jest.fn().mockReturnThis(),
  };

  const createMockControl = (overrides = {}): Control =>
    ({
      id: 'control-123',
      code: 'AC-1',
      name: 'Access Control Policy',
      description: 'Establish access control policy',
      type: ControlType.PREVENTIVE,
      category: ControlCategory.ACCESS_CONTROL,
      status: ControlStatus.ACTIVE,
      frequency: ControlFrequency.CONTINUOUS,
      objective: 'Ensure proper access control',
      frameworks: [],
      requirements: [],
      testProcedure: 'Manual review',
      version: 1,
      organizationId: 'org-123',
      owner: 'system',
      priority: 'high',
      tags: [],
      rationale: 'Security requirement',
      operationalImpact: 'High',
      cost: 1000,
      businessJustification: 'Required for compliance',
      automation: {
        isAutomated: false,
        toolName: '',
        frequency: ControlFrequency.ANNUAL,
        schedule: '',
        parameters: {},
        lastRunDate: null,
        nextRunDate: null,
      },
      mitigationStrategies: [],
      metrics: {
        successRate: 0,
        avgTestDuration: 0,
        lastTestDate: null,
        totalTests: 0,
        failureCount: 0,
      },
      remediation: {
        steps: [],
        timeline: '',
        resources: [],
        cost: 0,
      },
      integration: {
        systems: [],
        apis: [],
        dataFlow: [],
      },
      reviewHistory: [],
      auditTrail: [],
      dependencies: [],
      exceptions: [],
      implementations: [],
      testResults: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastReviewDate: new Date(),
      nextReviewDate: new Date(),
      isActive: true,
      effectiveDate: new Date(),
      createdBy: 'system',
      updatedBy: 'system',
      ...overrides,
    } as Control);

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up repository mocks
    controlRepository = mockControlRepository;
    implementationRepository = mockImplementationRepository;
    testResultRepository = mockTestResultRepository;
    exceptionRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    assessmentRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    mappingRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    eventEmitter = { emit: jest.fn() };
    kafkaService = {
      emit: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
    };
    frameworksService = {
      getFramework: jest.fn().mockResolvedValue({
        name: 'SOC2',
        version: '2017',
        description: 'SOC 2 Framework',
      }),
    };
    configService = { get: jest.fn() };
    const redisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      getCachedControlList: jest.fn(),
      cacheControlList: jest.fn(),
      invalidateControlCache: jest.fn(),
      getControlMetrics: jest.fn(),
      cacheControlMetrics: jest.fn(),
      logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      client: {},
      prefix: 'test',
      configService: { get: jest.fn() },
    } as any;

    // Set up query builder mocks
    controlRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    implementationRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    testResultRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    // Mock missing services
    const serviceDiscovery = { 
      callService: jest.fn(),
      configService: { get: jest.fn() },
      httpClient: {},
      logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      serviceRegistry: new Map(),
    } as any;
    const metricsService = { recordMetric: jest.fn(), incrementCounter: jest.fn() } as any;
    const tracingService = { startSpan: jest.fn(), finishSpan: jest.fn() } as any;
    const loggingService = { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() } as any;

    // Manually instantiate the service with all dependencies
    service = new ControlsService(
      controlRepository,
      implementationRepository,
      testResultRepository,
      exceptionRepository,
      assessmentRepository,
      mappingRepository,
      configService,
      redisService,
      eventEmitter,
      kafkaService,
      frameworksService,
      serviceDiscovery,
      metricsService,
      tracingService,
      loggingService,
      { query: jest.fn() } as any,
    );
  });

  describe('Framework Validation and Mapping', () => {
    it('should validate framework names correctly', async () => {
      const mockControl = createMockControl({
        frameworks: [{ name: 'SOC2', version: '2017', priority: 'high' }],
      });
      controlRepository.findOne.mockResolvedValue(null);
      controlRepository.create.mockReturnValue(mockControl);
      controlRepository.save.mockResolvedValue(mockControl);

      const result = await service.create({
        code: 'AC-1',
        name: 'Access Control Policy',
        description: 'Test control',
        type: ControlType.PREVENTIVE,
        category: ControlCategory.ACCESS_CONTROL,
        organizationId: 'org-123',
        owner: 'system',
        frameworks: [{ name: 'SOC2', version: '2017', priority: 'high' }],
      } as any);

      expect(result.frameworks[0].name).toBe('SOC2');
    });

    it('should reject invalid framework names', async () => {
      controlRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          code: 'AC-1',
          name: 'Access Control Policy',
          description: 'Test control',
          type: ControlType.PREVENTIVE,
          category: ControlCategory.ACCESS_CONTROL,
          organizationId: 'org-123',
          owner: 'system',
          frameworks: [{ name: 'INVALID_FRAMEWORK', version: '1.0', priority: 'high' }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent duplicate framework mappings', async () => {
      controlRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          code: 'AC-1',
          name: 'Access Control Policy',
          description: 'Test control',
          type: ControlType.PREVENTIVE,
          category: ControlCategory.ACCESS_CONTROL,
          organizationId: 'org-123',
          owner: 'system',
          frameworks: [
            { name: 'SOC2', version: '2017', priority: 'high' },
            { name: 'SOC2', version: '2017', priority: 'medium' },
          ],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should retrieve controls by framework', async () => {
      const mockFrameworkControls = [
        createMockControl({
          id: 'control-1',
          frameworks: [{ name: 'SOC2', version: '2017', priority: 'high' }],
        }),
        createMockControl({
          id: 'control-2',
          frameworks: [{ name: 'SOC2', version: '2017', priority: 'medium' }],
        }),
      ];

      controlRepository.find.mockResolvedValue(mockFrameworkControls);

      const result = await service.getControlsByFramework('SOC2');

      expect(result).toHaveLength(2);
      expect(result[0].frameworks[0].name).toBe('SOC2');
    });

    it('should handle framework compatibility mapping', async () => {
      const frameworkMapping = {
        SOC2: ['CC1.1', 'CC1.2'],
        ISO27001: ['A.5.1', 'A.6.1'],
        NIST: ['AC-1', 'AC-2'],
      };

      const result = await service.getCompatibilityMapping('SOC2', 'ISO27001');

      expect(result).toBeDefined();
      expect(result.sourceFramework).toBe('SOC2');
      expect(result.targetFramework).toBe('ISO27001');
      expect(result.mappings).toBeDefined();
    });

    it('should calculate framework implementation coverage', async () => {
      // Mock controls for framework
      controlRepository.find.mockResolvedValue([
        createMockControl({
          id: 'ctrl-1',
          frameworks: [{ name: 'SOC2', version: '2017' }],
        }),
        createMockControl({
          id: 'ctrl-2',
          frameworks: [{ name: 'SOC2', version: '2017' }],
        }),
      ]);

      // Mock framework coverage
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { id: 'ctrl-1', implementationStatus: 'IMPLEMENTED' },
        { id: 'ctrl-2', implementationStatus: null },
      ]);

      const coverage = await service.getFrameworkCoverage('org-123', 'SOC2');

      expect(coverage).toBeDefined();
      expect(coverage.framework).toBe('SOC2');
      expect(coverage.totalControls).toBe(2);
      expect(coverage.implementedControls).toBe(1);
      expect(coverage.coverage).toBeCloseTo(50, 1);
    });

    it('should analyze control overlaps between frameworks', async () => {
      const controls = [
        createMockControl({
          id: 'ctrl-1',
          code: 'AC-1',
          frameworks: [
            { name: 'SOC2', version: '2017' },
            { name: 'ISO27001', version: '2013' },
          ],
        }),
      ];

      controlRepository.find.mockResolvedValue(controls);

      const overlaps = await service.analyzeControlOverlaps(['SOC2', 'ISO27001']);

      expect(overlaps).toBeDefined();
      expect(overlaps.frameworks).toContain('SOC2');
      expect(overlaps.frameworks).toContain('ISO27001');
      expect(overlaps.sharedControls).toBeDefined();
    });

    it('should prioritize controls by framework requirements', async () => {
      const controls = [
        createMockControl({
          id: 'ctrl-1',
          frameworks: [{ name: 'SOC2', version: '2017', priority: 'critical' }],
        }),
        createMockControl({
          id: 'ctrl-2',
          frameworks: [{ name: 'SOC2', version: '2017', priority: 'high' }],
        }),
        createMockControl({
          id: 'ctrl-3',
          frameworks: [{ name: 'SOC2', version: '2017', priority: 'medium' }],
        }),
      ];

      controlRepository.find.mockResolvedValue(controls);

      const prioritized = await service.prioritizeControlsByFramework('org-123', 'SOC2');

      expect(prioritized).toHaveLength(3);
      expect(prioritized[0].priority).toBe(4); // Critical = 4
      expect(prioritized[1].priority).toBe(3); // High = 3
      expect(prioritized[2].priority).toBe(2); // Medium = 2
    });

    it('should validate framework compliance requirements', async () => {
      const requirements = {
        SOC2: {
          requiredControls: ['CC1.1', 'CC1.2', 'CC2.1'],
          optionalControls: ['CC3.1'],
          evidenceRequired: true,
          auditSupport: true,
        },
      };

      const validation = await service.validateFrameworkRequirements('org-123', 'SOC2');

      expect(validation).toBeDefined();
      expect(validation.framework).toBe('SOC2');
      expect(validation.isCompliant).toBeDefined();
      expect(validation.missingControls).toBeDefined();
      expect(validation.recommendations).toBeDefined();
    });

    it('should handle framework version compatibility', async () => {
      const versionCompatibility = await service.checkFrameworkVersionCompatibility('SOC2', '2017', '2022');

      expect(versionCompatibility).toBeDefined();
      expect(versionCompatibility.framework).toBe('SOC2');
      expect(versionCompatibility.sourceVersion).toBe('2017');
      expect(versionCompatibility.targetVersion).toBe('2022');
      expect(versionCompatibility.isCompatible).toBeDefined();
      expect(versionCompatibility.migrationRequired).toBeDefined();
    });
  });

  describe('Framework Report Generation', () => {
    it('should generate comprehensive framework report', async () => {
      // Mock controls for framework
      controlRepository.find.mockResolvedValue([
        createMockControl({
          id: 'ctrl-1',
          frameworks: [{ name: 'SOC2', version: '2017' }],
        }),
        createMockControl({
          id: 'ctrl-2',
          frameworks: [{ name: 'SOC2', version: '2017' }],
        }),
      ]);

      // Mock framework coverage
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { id: 'ctrl-1', implementationStatus: 'IMPLEMENTED' },
        { id: 'ctrl-2', implementationStatus: null },
      ]);

      const report = await service.generateFrameworkReport('org-123', 'SOC2');

      expect(report).toBeDefined();
      expect(report.framework).toBe('SOC2');
      expect(report.organizationId).toBe('org-123');
      expect(report.summary).toBeDefined();
      expect(report.controlDetails).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it('should generate audit package with evidence and test results', async () => {
      // Mock controls for framework
      controlRepository.find.mockResolvedValue([
        createMockControl({
          id: 'ctrl-1',
          frameworks: [{ name: 'SOC2', version: '2017' }],
        }),
        createMockControl({
          id: 'ctrl-2',
          frameworks: [{ name: 'SOC2', version: '2017' }],
        }),
      ]);

      // Mock implementations
      mockQueryBuilder.getMany.mockResolvedValue([
        {
          controlId: 'ctrl-1',
          control: {
            code: 'A.1.1',
            frameworks: [{ name: 'SOC2' }],
          },
          status: 'IMPLEMENTED',
          evidence: ['doc1.pdf'],
          lastReviewDate: new Date(),
        },
      ]);

      // Mock framework coverage
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { id: 'ctrl-1', implementationStatus: 'IMPLEMENTED' },
        { id: 'ctrl-2', implementationStatus: null },
      ]);

      const auditPackage = await service.generateAuditPackage('org-123', 'SOC2', {
        includeEvidence: true,
        includeTestResults: true,
        period: { start: new Date('2024-01-01'), end: new Date('2024-12-31') },
      });

      expect(auditPackage.framework).toBe('SOC2');
      expect(auditPackage.controls).toBeDefined();
      expect(auditPackage.evidence).toBeDefined();
      expect(auditPackage.testResults).toBeDefined();
    });

    it('should validate audit trail completeness', async () => {
      // Mock framework coverage
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { id: 'ctrl-1', implementationStatus: 'IMPLEMENTED' },
        { id: 'ctrl-2', implementationStatus: null },
      ]);

      // Mock implementations
      implementationRepository.find.mockResolvedValue([
        {
          controlId: 'ctrl-1',
          control: {
            code: 'A.1.1',
            frameworks: [{ name: 'ISO27001' }],
          },
          status: 'IMPLEMENTED',
          evidence: ['doc1.pdf'],
          lastReviewDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        },
      ]);

      const auditValidation = await service.validateAuditCompleteness('org-123', 'ISO27001');

      expect(auditValidation.isComplete).toBeDefined();
      expect(auditValidation.missingElements).toBeDefined();
      expect(auditValidation.recommendations).toBeDefined();
    });
  });
});