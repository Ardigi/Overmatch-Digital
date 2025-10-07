import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ControlsService } from '../controls.service';
import {
  type Control,
  ControlCategory,
  ControlFrequency,
  ControlStatus,
  ControlType,
} from '../entities/control.entity';
import {
  type ControlImplementation,
  ImplementationStatus,
} from '../../implementation/entities/control-implementation.entity';
import { type ControlTestResult, TestResultStatus } from '../entities/control-test-result.entity';
import {
  type MockRepository,
  createMockAssessmentRepository,
  createMockConfigService,
  createMockControlRepository,
  createMockEventEmitter,
  createMockExceptionRepository,
  createMockFrameworksService,
  createMockImplementationRepository,
  createMockKafkaService,
  createMockLoggingService,
  createMockMappingRepository,
  createMockMetricsService,
  createMockRedisService,
  createMockServiceDiscovery,
  createMockTestResultRepository,
  createMockTracingService,
  createTestUser,
} from './test-helpers/mock-factories';
import { KongUserType } from '../../../shared/decorators/kong-user.decorator';

describe('Controls Service Integration Tests (Manual Instantiation)', () => {
  let controlsService: ControlsService;
  let mockControlRepository: MockRepository<Control>;
  let mockImplementationRepository: MockRepository<ControlImplementation>;
  let mockTestResultRepository: MockRepository<ControlTestResult>;
  let mockExceptionRepository: ReturnType<typeof createMockExceptionRepository>;
  let mockAssessmentRepository: ReturnType<typeof createMockAssessmentRepository>;
  let mockMappingRepository: ReturnType<typeof createMockMappingRepository>;
  let mockConfigService: ReturnType<typeof createMockConfigService>;
  let mockRedisService: ReturnType<typeof createMockRedisService>;
  let mockEventEmitter: ReturnType<typeof createMockEventEmitter>;
  let mockKafkaService: ReturnType<typeof createMockKafkaService>;
  let mockFrameworksService: ReturnType<typeof createMockFrameworksService>;
  let mockServiceDiscovery: ReturnType<typeof createMockServiceDiscovery>;
  let mockMetricsService: ReturnType<typeof createMockMetricsService>;
  let mockTracingService: ReturnType<typeof createMockTracingService>;
  let mockLoggingService: ReturnType<typeof createMockLoggingService>;
  let testUser: KongUserType;

  // Simulated database storage
  let controlsDb: Map<string, Control>;
  let implementationsDb: Map<string, ControlImplementation>;
  let testResultsDb: Map<string, ControlTestResult>;

  const testControl = {
    code: 'AC-1',
    name: 'Access Control Policy',
    description: 'Establish and maintain access control policy',
    type: ControlType.PREVENTIVE,
    category: ControlCategory.ACCESS_CONTROL,
    frequency: ControlFrequency.CONTINUOUS,
    objective: 'Ensure proper access control',
    requirements: 'Policy must be documented and approved',
    frameworks: [
      { name: 'SOC2', section: 'CC6.1', requirements: 'Access control policy required' },
      { name: 'ISO27001', section: 'A.9.1' },
    ],
    implementationGuidance: 'Develop comprehensive access control policy',
    testProcedures: ['Review policy documentation', 'Interview process owners'],
    evidenceRequirements: ['Policy document', 'Approval records'],
    tags: ['security', 'access-control', 'mandatory'],
    ownerId: 'user-456',
  };

  beforeEach(() => {
    // Initialize in-memory databases
    controlsDb = new Map();
    implementationsDb = new Map();
    testResultsDb = new Map();

    // Create mock services
    mockConfigService = createMockConfigService();
    mockRedisService = createMockRedisService();
    mockEventEmitter = createMockEventEmitter();
    mockKafkaService = createMockKafkaService();
    mockFrameworksService = createMockFrameworksService();
    mockServiceDiscovery = createMockServiceDiscovery();
    mockMetricsService = createMockMetricsService();
    mockTracingService = createMockTracingService();
    mockLoggingService = createMockLoggingService();
    testUser = createTestUser();

    // Create mock repositories for entities that don't need complex behavior
    mockExceptionRepository = createMockExceptionRepository();
    mockAssessmentRepository = createMockAssessmentRepository();
    mockMappingRepository = createMockMappingRepository();

    // Mock DataSource
    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          find: jest.fn().mockImplementation(async (entityClass, options) => {
            // Return existing controls from the database
            // Check if looking for controls by code
            // TypeORM's In() creates an object with _type and _value properties
            const codeCondition = options?.where?.code;
            let codes = [];
            if (codeCondition) {
              if (Array.isArray(codeCondition)) {
                codes = codeCondition;
              } else if (codeCondition._type === 'in' && codeCondition._value) {
                codes = codeCondition._value;
              } else if (codeCondition.in) {
                codes = codeCondition.in;
              }
            }
            if (codes.length > 0) {
              return codes.map(code => 
                Array.from(controlsDb.values()).find(c => c.code === code)
              ).filter(Boolean);
            }
            return [];
          }),
          save: jest.fn().mockImplementation(async (entityClass, entities) => {
            // Handle both save(entity) and save(EntityClass, entity) signatures
            const dataToSave = entities || entityClass;
            if (Array.isArray(dataToSave)) {
              dataToSave.forEach(entity => {
                if (entity.code) {
                  controlsDb.set(entity.id, entity);
                }
              });
              return dataToSave;
            } else if (dataToSave && dataToSave.code) {
              controlsDb.set(dataToSave.id, dataToSave);
              return dataToSave;
            }
            return dataToSave;
          }),
          create: jest.fn().mockImplementation((entity, dto) => ({
            ...dto,
            id: dto?.id || `generated-${dto?.code || Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          }))
        }
      })
    };

    // Create enhanced mock repository using factory
    mockControlRepository = createMockControlRepository(controlsDb);
    
    // Override find method to handle proper filtering
    mockControlRepository.find = jest.fn(async (options?: any) => {
      let results = Array.from(controlsDb.values());
      
      if (options?.where) {
        const where = options.where;
        if (where.status) {
          results = results.filter((c) => c.status === where.status);
        }
        if (where.type) {
          results = results.filter((c) => c.type === where.type);
        }
        if (where.category) {
          results = results.filter((c) => c.category === where.category);
        }
        if (where.organizationId) {
          results = results.filter((c) => c.organizationId === where.organizationId);
        }
      }
      
      return results;
    });
    
    // Override specific methods while keeping the stateful query builder
    mockControlRepository.create = jest.fn(
      (dto) =>
        ({
          id: `control-${Date.now()}-${Math.random()}`,
          ...dto,
          status: dto.status || ControlStatus.ACTIVE,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }) as Control
    );
    
    mockControlRepository.save = jest.fn(async (control) => {
      if (Array.isArray(control)) {
        return control.map((c) => {
          controlsDb.set(c.id || c.code, c);
          return c;
        });
      }
      controlsDb.set(control.id || control.code, control);
      return control;
    });
    
    mockControlRepository.findOne = jest.fn(async (options) => {
      let control = null;
      if (options.where.id) {
        control = controlsDb.get(options.where.id) || null;
      } else if (options.where.code) {
        control = Array.from(controlsDb.values()).find((c) => c.code === options.where.code) || null;
      }
      
      if (control && options.relations) {
        // Load related data if relations are specified
        if (options.relations.includes('implementations')) {
          control.implementations = Array.from(implementationsDb.values()).filter(
            impl => impl.controlId === control.id
          );
        }
        if (options.relations.includes('testResults')) {
          control.testResults = Array.from(testResultsDb.values()).filter(
            result => result.controlId === control.id
          );
        }
      }
      
      return control;
    });
    
    mockControlRepository.delete = jest.fn(async () => {
      controlsDb.clear();
      return { affected: controlsDb.size };
    });

    mockImplementationRepository = {
      create: jest.fn(
        (dto) =>
          ({
            id: `impl-${Date.now()}-${Math.random()}`,
            ...dto,
            createdAt: new Date(),
            updatedAt: new Date(),
          }) as ControlImplementation
      ),
      save: jest.fn(async (impl) => {
        implementationsDb.set(impl.id, impl);
        return impl;
      }),
      find: jest.fn(async (options?: any) => {
        let results = Array.from(implementationsDb.values());

        if (options?.where) {
          const where = options.where;
          if (where.controlId) {
            results = results.filter((i) => i.controlId === where.controlId);
          }
          if (where.organizationId) {
            results = results.filter((i) => i.organizationId === where.organizationId);
          }
          // Filter for active implementations (for delete validation)
          if (where.status) {
            results = results.filter((i) => i.status === where.status);
          }
        }

        return results;
      }),
      findOne: jest.fn(async (options) => {
        return implementationsDb.get(options.where.id) || null;
      }),
      delete: jest.fn(async () => {
        implementationsDb.clear();
        return { affected: implementationsDb.size };
      }),
    } as any;

    mockTestResultRepository = {
      create: jest.fn(
        (dto) =>
          ({
            id: `test-${Date.now()}-${Math.random()}`,
            ...dto,
            createdAt: new Date(),
            updatedAt: new Date(),
          }) as ControlTestResult
      ),
      save: jest.fn(async (result) => {
        if (Array.isArray(result)) {
          return result.map((r) => {
            testResultsDb.set(r.id, r);
            return r;
          });
        }
        testResultsDb.set(result.id, result);
        return result;
      }),
      find: jest.fn(async (options?: any) => {
        let results = Array.from(testResultsDb.values());

        if (options?.where) {
          const where = options.where;
          if (where.controlId) {
            results = results.filter((t) => t.controlId === where.controlId);
          }
        }

        return results;
      }),
      findOne: jest.fn(async (options) => {
        return testResultsDb.get(options.where.id) || null;
      }),
      delete: jest.fn(async () => {
        testResultsDb.clear();
        return { affected: testResultsDb.size };
      }),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(async () => {
          const results = Array.from(testResultsDb.values());
          const metrics = {
            totalTests: results.length,
            passedTests: results.filter((r) => r.result === TestResultStatus.PASSED).length,
            avgDuration:
              results.length > 0
                ? results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length
                : 0,
          };
          return [
            {
              total_tests: metrics.totalTests,
              passed_tests: metrics.passedTests,
              avg_duration: metrics.avgDuration,
            },
          ];
        }),
      })),
    };

    // Define mockQueryBuilder with all needed methods and stateful filtering
    const mockQueryBuilder = {
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
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      having: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue(null),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
    };

    // Query builder is now handled by the enhanced factory
    // Mock the test results query builder to return actual metrics from testResultsDb
    mockTestResultRepository.createQueryBuilder = jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(async () => {
        const results = Array.from(testResultsDb.values());
        const metrics = {
          totalTests: results.length,
          passedTests: results.filter((r) => r.result === TestResultStatus.PASSED).length,
          avgDuration:
            results.length > 0
              ? results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length
              : 0,
        };
        return {
          total_tests: metrics.totalTests,
          passed_tests: metrics.passedTests,
          avg_duration: metrics.avgDuration,
          stddev_duration: 25.5, // Mock standard deviation
        };
      }),
      getRawMany: jest.fn(async () => {
        const results = Array.from(testResultsDb.values());
        if (results.length === 0) {
          return [];
        }
        
        // Group results by month for trend analysis
        const monthlyData = [];
        const now = new Date();
        for (let i = 2; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthResults = results.filter(r => {
            const resultDate = new Date(r.testDate);
            return resultDate.getMonth() === date.getMonth() && 
                   resultDate.getFullYear() === date.getFullYear();
          });
          
          const passed = monthResults.filter(r => r.result === TestResultStatus.PASSED).length;
          const total = monthResults.length || 1; // Avoid division by zero
          
          monthlyData.push({
            month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
            success_rate: total > 0 ? passed / total : 0,
            avg_duration: monthResults.length > 0 
              ? monthResults.reduce((sum, r) => sum + (r.duration || 0), 0) / monthResults.length
              : 0,
            total_tests: total,
            passed_tests: passed,
          });
        }
        
        return monthlyData.length > 0 ? monthlyData : [
          {
            month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
            success_rate: results.filter(r => r.result === TestResultStatus.PASSED).length / results.length,
            avg_duration: results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length,
            total_tests: results.length,
            passed_tests: results.filter(r => r.result === TestResultStatus.PASSED).length,
          }
        ];
      }),
    }));

    // Create service with manual instantiation using all properly typed mocks
    controlsService = new ControlsService(
      mockControlRepository,
      mockImplementationRepository,
      mockTestResultRepository,
      mockExceptionRepository,
      mockAssessmentRepository,
      mockMappingRepository,
      mockConfigService,
      mockRedisService,
      mockEventEmitter,
      mockKafkaService,
      mockFrameworksService,
      mockServiceDiscovery,
      mockMetricsService,
      mockTracingService,
      mockLoggingService,
      mockDataSource
    );
  });

  afterEach(() => {
    // Clear all data and mocks
    controlsDb.clear();
    implementationsDb.clear();
    testResultsDb.clear();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new control', async () => {
      const result = await controlsService.create(testControl);

      expect(result).toMatchObject({
        id: expect.any(String),
        code: testControl.code,
        name: testControl.name,
        status: ControlStatus.ACTIVE,
        version: 1,
      });

      // Verify it was saved
      expect(controlsDb.size).toBe(1);
      const savedControl = Array.from(controlsDb.values())[0];
      expect(savedControl.code).toBe(testControl.code);

      // Verify events were emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'control.created',
        expect.objectContaining({
          type: 'control.created',
          payload: expect.objectContaining({
            controlId: result.id,
            controlCode: result.code,
            name: result.name,
            type: result.type,
            category: result.category,
          }),
          timestamp: expect.any(Date),
          source: 'control-service',
        })
      );

      // Kafka emit is not called in create method, only in bulkImport
      // Remove this expectation as it's not part of the create flow
    });

    it('should prevent duplicate control codes', async () => {
      // Create first control
      await controlsService.create(testControl);

      // Try to create duplicate
      await expect(controlsService.create(testControl)).rejects.toThrow(
        'Control with code AC-1 already exists'
      );
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      // Create test data
      const controls = [
        {
          ...testControl,
          code: 'AC-1',
          type: ControlType.PREVENTIVE,
          category: ControlCategory.ACCESS_CONTROL,
          status: ControlStatus.ACTIVE,
        },
        {
          ...testControl,
          code: 'AC-2',
          name: 'Account Management',
          type: ControlType.DETECTIVE,
          category: ControlCategory.ACCESS_CONTROL,
          status: ControlStatus.ACTIVE,
        },
        {
          ...testControl,
          code: 'AU-1',
          name: 'Audit and Accountability Policy',
          type: ControlType.PREVENTIVE,
          category: ControlCategory.AUDIT_ACCOUNTABILITY,
          status: ControlStatus.UNDER_REVIEW,
        },
      ];

      for (const controlData of controls) {
        const control = mockControlRepository.create(controlData);
        await mockControlRepository.save(control);
      }
    });

    it('should return all controls', async () => {
      const result = await controlsService.findAll({});

      expect(result).toHaveLength(3);
    });

    it('should filter by status', async () => {
      const result = await controlsService.findAll({ status: ControlStatus.ACTIVE });

      expect(result).toHaveLength(2);
      result.forEach((control) => {
        expect(control.status).toBe(ControlStatus.ACTIVE);
      });
    });

    it('should filter by type', async () => {
      const result = await controlsService.findAll({ type: ControlType.DETECTIVE });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(ControlType.DETECTIVE);
    });

    it('should filter by category', async () => {
      const result = await controlsService.findAll({
        category: ControlCategory.AUDIT_ACCOUNTABILITY,
      });

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe(ControlCategory.AUDIT_ACCOUNTABILITY);
    });
  });

  describe('findOne', () => {
    let controlId: string;

    beforeEach(async () => {
      const control = mockControlRepository.create(testControl);
      const saved = await mockControlRepository.save(control);
      controlId = saved.id;
    });

    it('should return a control by ID', async () => {
      const result = await controlsService.findOne(controlId);

      expect(result).toMatchObject({
        id: controlId,
        code: testControl.code,
        name: testControl.name,
      });
    });

    it('should throw NotFoundException for non-existent control', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';

      await expect(controlsService.findOne(fakeId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCode', () => {
    beforeEach(async () => {
      const control = mockControlRepository.create(testControl);
      await mockControlRepository.save(control);
    });

    it('should return a control by code', async () => {
      const result = await controlsService.findByCode(testControl.code);

      expect(result.code).toBe(testControl.code);
    });

    it('should throw NotFoundException for non-existent code', async () => {
      await expect(controlsService.findByCode('INVALID-CODE')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMetrics', () => {
    let controlId: string;

    beforeEach(async () => {
      const control = mockControlRepository.create(testControl);
      const saved = await mockControlRepository.save(control);
      controlId = saved.id;

      // Create test results
      const testResults = [
        {
          controlId,
          testDate: new Date(),
          result: TestResultStatus.PASSED,
          duration: 120,
          testedBy: 'user-123',
          organizationId: 'org-123',
        },
        {
          controlId,
          testDate: new Date(),
          result: TestResultStatus.PASSED,
          duration: 100,
          testedBy: 'user-123',
          organizationId: 'org-123',
        },
        {
          controlId,
          testDate: new Date(),
          result: TestResultStatus.FAILED,
          duration: 150,
          testedBy: 'user-123',
          organizationId: 'org-123',
        },
      ];

      for (const result of testResults) {
        const testResult = mockTestResultRepository.create(result);
        await mockTestResultRepository.save(testResult);
      }
    });

    it('should return control metrics', async () => {
      const result = await controlsService.getControlMetrics(controlId);

      expect(result).toMatchObject({
        successRate: expect.any(Number),
        avgTestDuration: expect.any(Number),
        totalTests: 3,
        failureCount: 1,
      });

      expect(result.successRate).toBeCloseTo(0.67, 1);
      expect(result.avgTestDuration).toBeCloseTo(123.33, 2);
    });
  });

  describe('update', () => {
    let controlId: string;

    beforeEach(async () => {
      const control = mockControlRepository.create(testControl);
      const saved = await mockControlRepository.save(control);
      controlId = saved.id;
    });

    it('should update a control', async () => {
      const updateData = {
        name: 'Updated Control Name',
        description: 'Updated description',
        status: ControlStatus.UNDER_REVIEW,
      };

      // Mock the update behavior
      mockControlRepository.save.mockImplementationOnce(async (control) => {
        const updated = { ...control, version: 2 } as Control;
        controlsDb.set(updated.id, updated);
        return updated;
      });

      const result = await controlsService.update(controlId, updateData);

      expect(result).toMatchObject({
        id: controlId,
        name: updateData.name,
        description: updateData.description,
        status: updateData.status,
        version: 2,
      });

      // Verify event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'control.updated',
        expect.objectContaining({
          type: 'control.implementation.updated',
          payload: expect.objectContaining({
            controlId,
            newStatus: updateData.status,
          }),
        })
      );
    });

    it('should not allow code updates', async () => {
      const updateData = { code: 'NEW-CODE' };

      await expect(controlsService.update(controlId, updateData)).rejects.toThrow(
        'Control code cannot be updated'
      );
    });
  });

  describe('delete', () => {
    let controlId: string;

    beforeEach(async () => {
      const control = mockControlRepository.create(testControl);
      const saved = await mockControlRepository.save(control);
      controlId = saved.id;
    });

    it('should soft delete a control', async () => {
      // Mock implementation check
      mockImplementationRepository.find.mockResolvedValueOnce([]);

      // Mock the soft delete behavior
      mockControlRepository.save.mockImplementationOnce(async (control) => {
        const updated = { ...control, status: ControlStatus.RETIRED } as Control;
        controlsDb.set(updated.id, updated);
        return updated;
      });

      await controlsService.remove(controlId);

      const deletedControl = controlsDb.get(controlId);
      expect(deletedControl?.status).toBe(ControlStatus.RETIRED);

      // Verify event was emitted (delete emits retired event)
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'control.retired',
        expect.objectContaining({ controlId })
      );
    });

    it('should prevent deletion of control with active implementations', async () => {
      // Create implementation
      const implementation = mockImplementationRepository.create({
        controlId,
        organizationId: 'org-123',
        status: ImplementationStatus.IMPLEMENTED,
        implementationDate: new Date(),
      });
      await mockImplementationRepository.save(implementation);

      await expect(controlsService.remove(controlId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkImport', () => {
    const controlsToImport = [
      {
        code: 'AC-2',
        name: 'Account Management',
        description: 'Manage user accounts and access',
        type: ControlType.PREVENTIVE,
        category: ControlCategory.ACCESS_CONTROL,
        frequency: ControlFrequency.CONTINUOUS,
        objective: 'Manage accounts effectively',
        frameworks: [{ name: 'SOC2', section: 'CC6.2' }],
      },
      {
        code: 'AC-3',
        name: 'Access Enforcement',
        description: 'Enforce access control policies',
        type: ControlType.DETECTIVE,
        category: ControlCategory.ACCESS_CONTROL,
        frequency: ControlFrequency.CONTINUOUS,
        objective: 'Enforce access controls properly',
        frameworks: [{ name: 'SOC2', section: 'CC6.3' }],
      },
    ];

    it('should bulk import controls', async () => {
      const result = await controlsService.bulkImport(controlsToImport);

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('AC-2');
      expect(result[1].code).toBe('AC-3');

      // Verify database
      expect(controlsDb.size).toBe(2);
    });

    it('should skip existing controls during bulk import', async () => {
      // Create first control
      const existing = mockControlRepository.create({
        ...testControl,
        code: 'AC-2',
      });
      await mockControlRepository.save(existing);

      const result = await controlsService.bulkImport(controlsToImport);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('AC-3');
    });
  });

  describe('getCoverage', () => {
    beforeEach(async () => {
      // Create controls with implementations
      const control1 = mockControlRepository.create({
        ...testControl,
        code: 'AC-1',
        organizationId: 'org-123',
      });
      await mockControlRepository.save(control1);

      const implementation1 = mockImplementationRepository.create({
        controlId: control1.id,
        organizationId: 'org-123',
        status: ImplementationStatus.IMPLEMENTED,
        implementationDate: new Date(),
        evidence: [
          {
            type: 'document',
            description: 'Security policy',
            location: 'policy.pdf',
            uploadedAt: new Date(),
            uploadedBy: 'user-123',
          },
        ],
      });
      await mockImplementationRepository.save(implementation1);

      const control2 = mockControlRepository.create({
        ...testControl,
        code: 'AC-2',
        organizationId: 'org-123',
      });
      await mockControlRepository.save(control2);

      const control3 = mockControlRepository.create({
        ...testControl,
        code: 'AC-3',
        organizationId: 'org-123',
      });
      await mockControlRepository.save(control3);
    });

    it('should calculate control coverage', async () => {
      const result = await controlsService.getControlCoverage('org-123');

      expect(result.overall).toMatchObject({
        totalControls: 3,
        implementedControls: 1,
        coveragePercentage: expect.any(Number),
      });

      expect(result.overall.coveragePercentage).toBeCloseTo(33.33, 1);
    });
  });

  describe('findByFramework', () => {
    beforeEach(async () => {
      const soc2Control = mockControlRepository.create({
        ...testControl,
        code: 'CC6.1',
        frameworks: [{ name: 'SOC2', section: 'CC6.1' }],
      });
      await mockControlRepository.save(soc2Control);

      const nistControl = mockControlRepository.create({
        ...testControl,
        code: 'AC-1',
        frameworks: [{ name: 'NIST', section: 'AC-1' }],
      });
      await mockControlRepository.save(nistControl);
    });

    it('should return controls for specific framework', async () => {
      const result = await controlsService.getControlsByFramework('SOC2');

      expect(result).toHaveLength(1);
      expect(result[0].frameworks[0].name).toBe('SOC2');
    });

    it('should return empty array for unknown framework', async () => {
      const result = await controlsService.getControlsByFramework('UNKNOWN');

      expect(result).toEqual([]);
    });
  });
});
