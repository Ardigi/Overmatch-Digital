import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { CacheService } from '../../cache/cache.service';
import { SearchService } from '../../search/search.service';
import { ControlsService } from '../controls.service';
import type { CreateControlDto, QueryControlDto, UpdateControlDto } from '../dto';
import {
  Control,
  ControlCategory,
  ControlFrequency,
  ControlPriority,
  ControlStatus,
  ControlType,
  EvidenceStatus,
  ImplementationStatus,
} from '../entities/control.entity';
import { ComplianceFramework } from '../entities/framework.entity';

describe('ControlsService', () => {
  let service: ControlsService;
  let controlRepository: Repository<Control>;
  let frameworkRepository: Repository<ComplianceFramework>;
  let cacheService: CacheService;
  let searchService: SearchService;
  let eventEmitter: EventEmitter2;

  const mockControlRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockFrameworkRepository = {
    findOne: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    deleteByTags: jest.fn(),
    buildKey: jest.fn((...parts) => parts.join(':')),
    remember: jest.fn((key, fn, ttl, tags) => fn()),
  };

  const mockSearchService = {
    indexControl: jest.fn(),
    removeControl: jest.fn(),
    searchControls: jest.fn(),
    findSimilarControls: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getCount: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };

  const mockControl = {
    id: 'control-123',
    controlId: 'AC-1',
    title: 'Access Control Policy and Procedures',
    description: 'The organization develops, documents, and disseminates an access control policy',
    category: ControlCategory.ADMINISTRATIVE,
    priority: ControlPriority.HIGH,
    frameworkId: 'framework-123',
    organizationId: 'org-123',
    implementationStatus: ImplementationStatus.IMPLEMENTED,
    implementationScore: 85,
    implementationDetails: {
      approach: 'Policy documented and approved',
      responsible: 'Security Team',
      timeline: {
        plannedStart: new Date('2024-01-01'),
        actualStart: new Date('2024-01-15'),
        plannedEnd: new Date('2024-06-01'),
        actualEnd: new Date('2024-05-15'),
      },
    },
    testingGuidance: {
      procedures: [
        'Review access control policy document',
        'Verify approval signatures',
        'Check dissemination records',
      ],
      frequency: 'annual',
      expectedEvidence: ['Policy document', 'Approval records'],
    },
    evidence: [],
    gaps: [],
    relatedPolicies: [],
    crossFrameworkMappings: [],
    compensatingControls: [],
    dependencies: [],
    tags: ['access-control', 'policy'],
    lastAssessmentDate: new Date('2024-06-01'),
    nextAssessmentDate: new Date('2025-06-01'),
    assessmentHistory: [],
    riskAssessment: {
      inherentRisk: {
        likelihood: 4,
        impact: 5,
        score: 20,
        level: 'high',
      },
      residualRisk: {
        likelihood: 2,
        impact: 5,
        score: 10,
        level: 'medium',
      },
    },
    isAutomated: false,
    createdBy: 'user-123',
    updatedBy: 'user-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
    calculateImplementationScore: jest.fn(),
    addEvidence: jest.fn(),
    updateAssessment: jest.fn(),
    isExpiredEvidence: jest.fn().mockReturnValue(false),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockControl], 1]);
    mockControlRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    // Manual instantiation pattern - required due to TypeORM/Jest incompatibility
    controlRepository = mockControlRepository as any;
    frameworkRepository = mockFrameworkRepository as any;
    cacheService = mockCacheService as any;
    searchService = mockSearchService as any;
    eventEmitter = mockEventEmitter as any;
    
    service = new ControlsService(
      controlRepository,
      frameworkRepository,
      cacheService,
      searchService,
      eventEmitter
    );
  });

  describe('create', () => {
    const createDto: CreateControlDto = {
      controlId: 'AC-2',
      identifier: 'AC-2',
      title: 'Account Management',
      description: 'The organization manages information system accounts',
      type: ControlType.PREVENTIVE,
      priority: ControlPriority.HIGH,
      frequency: ControlFrequency.CONTINUOUS,
      frameworkId: 'framework-123',
      category: 'Access Control',
    };

    it('should create a new control', async () => {
      const mockFramework = { id: 'framework-123', identifier: 'SOC2', organizationId: 'org-123' };
      const mockUser = { userId: 'user-123', email: 'test@example.com', roles: ['admin'], permissions: [] };
      const expectedControl = {
        ...mockControl,
        ...createDto,
        id: 'new-control-id',
        implementationStatus: ImplementationStatus.NOT_STARTED,
        implementationScore: 0,
      };

      mockFrameworkRepository.findOne.mockResolvedValue(mockFramework);
      mockControlRepository.findOne.mockResolvedValue(null);
      mockControlRepository.create.mockReturnValue(expectedControl);
      mockControlRepository.save.mockResolvedValue(expectedControl);

      const result = await service.create(createDto, mockUser);

      expect(result).toEqual(expectedControl);
      expect(frameworkRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'framework-123' },
      });
      expect(controlRepository.create).toHaveBeenCalledWith({
        ...createDto,
        implementationStatus: ImplementationStatus.NOT_STARTED,
        implementationScore: 0,
        organizationId: mockFramework.organizationId,
      });
      expect(searchService.indexControl).toHaveBeenCalledWith(expectedControl);
      expect(cacheService.deleteByTags).toHaveBeenCalledWith([
        'controls',
        'framework:framework-123',
      ]);
      expect(eventEmitter.emit).toHaveBeenCalledWith('control.created', {
        control: expectedControl,
        timestamp: expect.any(Date),
      });
    });

    it('should throw BadRequestException for invalid framework', async () => {
      const mockUser = { userId: 'user-123', email: 'test@example.com', roles: ['admin'], permissions: [] };
      mockFrameworkRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto, mockUser)).rejects.toThrow(BadRequestException);
      expect(controlRepository.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for duplicate control ID', async () => {
      const mockUser = { userId: 'user-123', email: 'test@example.com', roles: ['admin'], permissions: [] };
      const mockFramework = { id: 'framework-123', name: 'SOC2', organizationId: 'org-123' };
      mockFrameworkRepository.findOne.mockResolvedValue(mockFramework);
      mockControlRepository.findOne.mockResolvedValue(mockControl);

      await expect(service.create(createDto, mockUser)).rejects.toThrow(BadRequestException);
    });

    it('should set default values', async () => {
      const mockUser = { userId: 'user-123', email: 'test@example.com', roles: ['admin'], permissions: [] };
      const mockFramework = { id: 'framework-123', organizationId: 'org-123' };
      mockFrameworkRepository.findOne.mockResolvedValue(mockFramework);
      mockControlRepository.findOne.mockResolvedValue(null);
      mockControlRepository.create.mockImplementation((data) => ({
        ...mockControl,
        ...data,
      }));
      mockControlRepository.save.mockImplementation((control) => Promise.resolve(control));

      await service.create(createDto, mockUser);

      const createdCall = mockControlRepository.create.mock.calls[0][0];
      expect(createdCall.implementationStatus).toBe(ImplementationStatus.NOT_STARTED);
      expect(createdCall.implementationScore).toBe(0);
      expect(createdCall.isAutomated).toBe(false);
    });
  });

  describe('findAll', () => {
    it('should return paginated controls', async () => {
      const query: QueryControlDto = { page: 1, limit: 20 };

      const result = await service.findAll(query);

      expect(result).toEqual({
        data: [mockControl],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      });
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    });

    it('should filter by framework', async () => {
      const query: QueryControlDto = { frameworkId: 'framework-123' };

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('control.frameworkId = :frameworkId', {
        frameworkId: 'framework-123',
      });
    });

    it('should filter by type', async () => {
      const query: QueryControlDto = { type: ControlType.PREVENTIVE };

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('control.type = :type', {
        type: ControlType.PREVENTIVE,
      });
    });

    it('should filter by status', async () => {
      const query: QueryControlDto = { status: ControlStatus.IMPLEMENTED };

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('control.status = :status', {
        status: ControlStatus.IMPLEMENTED,
      });
    });

    it('should filter by category', async () => {
      const query: QueryControlDto = { category: 'Access Control' };

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('control.category = :category', {
        category: 'Access Control',
      });
    });

    it('should filter by priority', async () => {
      const query: QueryControlDto = { priority: ControlPriority.HIGH };

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('control.priority = :priority', {
        priority: ControlPriority.HIGH,
      });
    });

    it('should filter by automation capability', async () => {
      const query: QueryControlDto = { automationCapable: true };

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('control.isAutomated = :isAutomated', {
        isAutomated: true,
      });
    });

    it('should filter by testing due status', async () => {
      const query: QueryControlDto = { testingDue: true };

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('control.nextAssessmentDate <= :now', {
        now: expect.any(Date),
      });
    });

    it('should filter by risk score range', async () => {
      const query: QueryControlDto = { minRiskScore: 5, maxRiskScore: 15 };

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "control.riskAssessment->>'inherentRisk'->>'score' BETWEEN :minRiskScore AND :maxRiskScore",
        { minRiskScore: 5, maxRiskScore: 15 }
      );
    });

    it('should search by text', async () => {
      const query: QueryControlDto = { search: 'access' };

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(control.title ILIKE :search OR control.description ILIKE :search OR control.controlId ILIKE :search)',
        { search: '%access%' }
      );
    });

    it('should include statistics when requested', async () => {
      const query: QueryControlDto = { includeStats: true };

      mockQueryBuilder.getMany.mockResolvedValue([
        { ...mockControl, implementationStatus: ImplementationStatus.IMPLEMENTED },
        { ...mockControl, implementationStatus: ImplementationStatus.PARTIAL },
      ]);

      const result = await service.findAll(query);

      expect(result.meta).toHaveProperty('statistics');
      expect(result.meta.statistics).toHaveProperty('total');
      expect(result.meta.statistics).toHaveProperty('byStatus');
      expect(result.meta.statistics).toHaveProperty('byType');
      expect(result.meta.statistics).toHaveProperty('automationRate');
    });
  });

  describe('findOne', () => {
    it('should return a control by ID', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockControlRepository.findOne.mockResolvedValue(mockControl);

      const result = await service.findOne('control-123');

      expect(result).toEqual(mockControl);
      expect(cacheService.set).toHaveBeenCalledWith(
        'control:control-123',
        mockControl,
        expect.objectContaining({
          ttl: 3600,
          tags: ['controls', 'control:control-123', 'framework:framework-123'],
        })
      );
    });

    it('should return cached control if available', async () => {
      mockCacheService.get.mockResolvedValue(mockControl);

      const result = await service.findOne('control-123');

      expect(result).toEqual(mockControl);
      expect(controlRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when not found', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockControlRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByControlId', () => {
    it('should return a control by control ID', async () => {
      mockControlRepository.findOne.mockResolvedValue(mockControl);

      const result = await service.findByControlId('AC-1', 'org-123');

      expect(result).toEqual(mockControl);
      expect(controlRepository.findOne).toHaveBeenCalledWith({
        where: { controlId: 'AC-1' },
        relations: ['framework', 'policies'],
      });
    });

    it('should throw NotFoundException when not found', async () => {
      mockControlRepository.findOne.mockResolvedValue(null);

      await expect(service.findByControlId('INVALID', 'org-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateControlDto = {
      title: 'Access Control Policy (Updated)',
      description: 'Updated description',
      priority: ControlPriority.CRITICAL,
    };

    it('should update a control', async () => {
      const updatedControl = { ...mockControl, ...updateDto };

      mockControlRepository.findOne.mockResolvedValue(mockControl);
      mockControlRepository.save.mockResolvedValue(updatedControl);

      const mockUser = { userId: 'user-123', email: 'test@example.com', roles: ['admin'], permissions: [] };
      const result = await service.update('control-123', updateDto, mockUser);

      expect(result).toEqual(updatedControl);
      expect(controlRepository.save).toHaveBeenCalled();
      expect(searchService.indexControl).toHaveBeenCalledWith(updatedControl);
      expect(cacheService.delete).toHaveBeenCalledWith('control:control-123');
      expect(eventEmitter.emit).toHaveBeenCalledWith('control.updated', {
        control: updatedControl,
        changes: expect.any(Object),
        timestamp: expect.any(Date),
      });
    });

    it('should validate status transitions', async () => {
      mockControlRepository.findOne.mockResolvedValue({
        ...mockControl,
        implementationStatus: ImplementationStatus.NOT_STARTED,
      });

      const mockUser = { userId: 'user-123', email: 'test@example.com', roles: ['admin'], permissions: [] };
      await expect(
        service.update('control-123', { implementationStatus: ImplementationStatus.NOT_APPLICABLE }, mockUser)
      ).rejects.toThrow(BadRequestException);
    });

    it('should recalculate implementation score', async () => {
      mockControlRepository.findOne.mockResolvedValue(mockControl);
      mockControlRepository.save.mockImplementation((control) => Promise.resolve(control));

      const mockUser = { userId: 'user-123', email: 'test@example.com', roles: ['admin'], permissions: [] };
      await service.update('control-123', updateDto, mockUser);

      expect(mockControl.calculateImplementationScore).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete a control', async () => {
      mockControlRepository.findOne.mockResolvedValue(mockControl);
      mockControlRepository.save.mockResolvedValue({
        ...mockControl,
        deletedAt: new Date(),
      });

      const mockUser = { userId: 'user-123', email: 'test@example.com', roles: ['admin'], permissions: [] };
      await service.remove('control-123', mockUser);

      expect(controlRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
        })
      );
      expect(searchService.removeControl).toHaveBeenCalledWith('control-123');
      expect(cacheService.delete).toHaveBeenCalledWith('control:control-123');
      expect(eventEmitter.emit).toHaveBeenCalledWith('control.removed', {
        controlId: 'control-123',
        timestamp: expect.any(Date),
      });
    });

    it('should prevent deletion with active test schedules', async () => {
      const controlWithSchedules = {
        ...mockControl,
        nextAssessmentDate: new Date(Date.now() + 86400000), // Tomorrow
      };
      mockControlRepository.findOne.mockResolvedValue(controlWithSchedules);

      const mockUser = { userId: 'user-123', email: 'test@example.com', roles: ['admin'], permissions: [] };
      await expect(service.remove('control-123', mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getControlStatistics', () => {
    it('should return control statistics', async () => {
      const controlWithHistory = {
        ...mockControl,
        assessmentHistory: [
          { status: 'passed', date: new Date('2024-01-01') },
          { status: 'passed', date: new Date('2024-04-01') },
          { status: 'failed', date: new Date('2024-07-01') },
        ],
        evidence: [
          { status: EvidenceStatus.APPROVED },
          { status: EvidenceStatus.APPROVED },
          { status: EvidenceStatus.PENDING_REVIEW },
        ],
      };
      mockControlRepository.findOne.mockResolvedValue(controlWithHistory);

      const result = await service.getControlStatistics('control-123');

      expect(result).toHaveProperty('controlId', 'AC-1');
      expect(result).toHaveProperty('implementationStatus');
      expect(result).toHaveProperty('complianceScore');
      expect(result).toHaveProperty('testHistory');
      expect(result.testHistory).toMatchObject({
        totalTests: 3,
        passedTests: 2,
        failedTests: 1,
        successRate: 0.67,
      });
      expect(result).toHaveProperty('evidenceStatus');
      expect(result.evidenceStatus).toMatchObject({
        required: 2,
        collected: 3,
        verified: 2,
        completeness: 1,
      });
    });
  });

  describe('getImplementationStatus', () => {
    it('should return implementation status details', async () => {
      mockControlRepository.findOne.mockResolvedValue(mockControl);

      const result = await service.getImplementationStatus('control-123');

      expect(result).toHaveProperty('control');
      expect(result).toHaveProperty('implementationProgress');
      expect(result.implementationProgress).toHaveProperty('status');
      expect(result.implementationProgress).toHaveProperty('percentComplete');
      expect(result).toHaveProperty('dependencies');
      expect(result).toHaveProperty('timeline');
      expect(result).toHaveProperty('nextActions');
    });
  });

  describe('getControlTestResults', () => {
    it('should return test results', async () => {
      const controlWithTests = {
        ...mockControl,
        assessmentHistory: [
          {
            date: new Date('2024-06-01'),
            assessor: 'auditor-123',
            score: 90,
            status: 'passed',
            findings: [],
          },
          {
            date: new Date('2024-03-01'),
            assessor: 'auditor-456',
            score: 60,
            status: 'failed',
            findings: ['Finding 1', 'Finding 2'],
          },
        ],
      };
      mockControlRepository.findOne.mockResolvedValue(controlWithTests);

      const result = await service.getControlTestResults('control-123');

      expect(result).toHaveProperty('control');
      expect(result).toHaveProperty('results');
      expect(result.results).toHaveLength(2);
      expect(result).toHaveProperty('summary');
      expect(result.summary).toMatchObject({
        totalTests: 2,
        passed: 1,
        failed: 1,
        successRate: 0.5,
      });
    });
  });

  describe('scheduleTest', () => {
    it('should schedule a control test', async () => {
      const scheduleDto = {
        testDate: new Date('2025-01-01'),
        tester: 'auditor-123',
        notes: 'Annual test',
      };

      mockControlRepository.findOne.mockResolvedValue(mockControl);
      mockControlRepository.save.mockResolvedValue({
        ...mockControl,
        nextAssessmentDate: scheduleDto.testDate,
      });

      const mockUser = { userId: 'user-123', email: 'test@example.com', roles: ['admin'], permissions: [] };
      const result = await service.scheduleTest('control-123', scheduleDto, mockUser);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('controlId', 'control-123');
      expect(result).toHaveProperty('testDate', scheduleDto.testDate);
      expect(result).toHaveProperty('status', 'Scheduled');
      expect(eventEmitter.emit).toHaveBeenCalledWith('control.test.scheduled', {
        controlId: 'control-123',
        schedule: expect.any(Object),
        timestamp: expect.any(Date),
      });
    });

    it('should validate test date is in the future', async () => {
      const pastDate = new Date('2020-01-01');
      const scheduleDto = {
        testDate: pastDate,
        tester: 'auditor-123',
      };

      mockControlRepository.findOne.mockResolvedValue(mockControl);

      const mockUser = { userId: 'user-123', email: 'test@example.com', roles: ['admin'], permissions: [] };
      await expect(service.scheduleTest('control-123', scheduleDto, mockUser)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('recordTestResult', () => {
    it('should record test result', async () => {
      const testResultDto = {
        testDate: new Date('2024-06-01'),
        tester: 'auditor-123',
        result: 'Pass',
        findings: [],
        evidence: ['evidence-001'],
        notes: 'Control operating effectively',
      };

      mockControlRepository.findOne.mockResolvedValue(mockControl);
      mockControlRepository.save.mockImplementation((control) => Promise.resolve(control));

      const mockUser = { userId: 'user-123', email: 'test@example.com', roles: ['admin'], permissions: [] };
      const result = await service.recordTestResult('control-123', testResultDto, mockUser);

      expect(mockControl.updateAssessment).toHaveBeenCalledWith(
        expect.objectContaining({
          date: testResultDto.testDate,
          assessor: testResultDto.tester,
          status: 'passed',
        })
      );
      expect(controlRepository.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('control.test.completed', {
        control: expect.any(Object),
        result: expect.any(Object),
        timestamp: expect.any(Date),
      });
    });
  });

  describe('getControlEvidence', () => {
    it('should return control evidence details', async () => {
      const controlWithEvidence = {
        ...mockControl,
        evidence: [
          {
            id: 'evidence-001',
            type: 'document',
            title: 'Access Control Policy',
            status: EvidenceStatus.APPROVED,
          },
        ],
        testingGuidance: {
          expectedEvidence: ['Policy document', 'Approval records'],
        },
      };
      mockControlRepository.findOne.mockResolvedValue(controlWithEvidence);

      const result = await service.getControlEvidence('control-123');

      expect(result).toHaveProperty('control');
      expect(result).toHaveProperty('evidence');
      expect(result.evidence).toHaveLength(1);
      expect(result).toHaveProperty('requirements');
      expect(result.requirements).toHaveLength(2);
      expect(result).toHaveProperty('completeness');
      expect(result.completeness).toMatchObject({
        required: 2,
        collected: 1,
        percentage: 50,
      });
    });
  });

  describe('attachEvidence', () => {
    it('should attach evidence to control', async () => {
      const evidenceDto = {
        type: 'Document',
        name: 'Approval Records',
        description: 'Management approval for policy',
        fileId: 'file-123',
      };

      mockControlRepository.findOne.mockResolvedValue(mockControl);
      mockControlRepository.save.mockImplementation((control) => Promise.resolve(control));

      const result = await service.attachEvidence('control-123', evidenceDto);

      expect(mockControl.addEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'document',
          title: evidenceDto.name,
          description: evidenceDto.description,
          location: evidenceDto.fileId,
        })
      );
      expect(controlRepository.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('control.evidence.attached', {
        controlId: 'control-123',
        evidence: expect.any(Object),
        timestamp: expect.any(Date),
      });
    });
  });

  describe('removeEvidence', () => {
    it('should remove evidence from control', async () => {
      const controlWithEvidence = {
        ...mockControl,
        evidence: [
          { id: 'evidence-001', title: 'Policy Document' },
          { id: 'evidence-002', title: 'Approval Records' },
        ],
      };
      mockControlRepository.findOne.mockResolvedValue(controlWithEvidence);
      mockControlRepository.save.mockImplementation((control) => Promise.resolve(control));

      const result = await service.removeEvidence('control-123', 'evidence-001');

      const savedControl = mockControlRepository.save.mock.calls[0][0];
      expect(savedControl.evidence).toHaveLength(1);
      expect(savedControl.evidence[0].id).toBe('evidence-002');
    });

    it('should throw NotFoundException for invalid evidence ID', async () => {
      mockControlRepository.findOne.mockResolvedValue(mockControl);

      await expect(service.removeEvidence('control-123', 'invalid-evidence')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('bulkOperation', () => {
    it('should perform bulk update operations', async () => {
      const bulkDto = {
        controlIds: ['control-1', 'control-2', 'control-3'],
        operation: 'updateStatus',
        data: { status: ControlStatus.UNDER_REVIEW },
      };

      mockControlRepository.findOne
        .mockResolvedValueOnce(mockControl)
        .mockResolvedValueOnce(mockControl)
        .mockResolvedValueOnce(mockControl);
      mockControlRepository.save.mockResolvedValue(mockControl);

      const result = await service.bulkOperation(bulkDto);

      expect(result).toMatchObject({
        success: 3,
        failed: 0,
        results: [
          { id: 'control-1', success: true },
          { id: 'control-2', success: true },
          { id: 'control-3', success: true },
        ],
      });
    });

    it('should handle partial failures', async () => {
      const bulkDto = {
        controlIds: ['control-1', 'control-2', 'control-3'],
        operation: 'updateStatus',
        data: { status: ControlStatus.UNDER_REVIEW },
      };

      mockControlRepository.findOne
        .mockResolvedValueOnce(mockControl)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockControl);
      mockControlRepository.save.mockResolvedValue(mockControl);

      const result = await service.bulkOperation(bulkDto);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results[1]).toMatchObject({
        id: 'control-2',
        success: false,
        error: expect.any(String),
      });
    });
  });

  describe('exportControls', () => {
    it('should export controls data', async () => {
      mockControlRepository.find.mockResolvedValue([mockControl]);
      mockFrameworkRepository.findOne.mockResolvedValue({
        id: 'framework-123',
        name: 'SOC2',
      });

      const result = await service.exportControls({
        frameworkId: 'framework-123',
        format: 'json',
      });

      expect(result).toHaveProperty('framework', 'SOC2');
      expect(result).toHaveProperty('controls');
      expect(result.controls).toHaveLength(1);
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('exportDate');
      expect(result.metadata).toHaveProperty('format', 'json');
    });
  });

  describe('importControls', () => {
    it('should import controls data', async () => {
      const importData = {
        framework: 'NIST 800-53',
        controls: [
          {
            controlId: 'AC-2',
            title: 'Account Management',
            description: 'The organization manages information system accounts',
            type: ControlType.PREVENTIVE,
          },
        ],
      };

      mockFrameworkRepository.findOne.mockResolvedValue({
        id: 'framework-123',
      });
      mockControlRepository.findOne.mockResolvedValue(null);
      mockControlRepository.create.mockReturnValue(mockControl);
      mockControlRepository.save.mockResolvedValue(mockControl);

      const result = await service.importControls(importData);

      expect(result).toMatchObject({
        imported: 1,
        updated: 0,
        failed: 0,
        results: [{ controlId: 'AC-2', action: 'created', success: true }],
      });
    });

    it('should update existing controls on import', async () => {
      const importData = {
        framework: 'NIST 800-53',
        controls: [
          {
            controlId: 'AC-1',
            title: 'Updated Title',
            description: 'Updated description',
          },
        ],
      };

      mockFrameworkRepository.findOne.mockResolvedValue({
        id: 'framework-123',
      });
      mockControlRepository.findOne.mockResolvedValue(mockControl);
      mockControlRepository.save.mockResolvedValue({
        ...mockControl,
        title: 'Updated Title',
      });

      const result = await service.importControls(importData);

      expect(result.updated).toBe(1);
      expect(result.imported).toBe(0);
    });
  });

  describe('validateControl', () => {
    it('should validate control configuration', async () => {
      mockControlRepository.findOne.mockResolvedValue(mockControl);

      const result = await service.validateControl('control-123');

      expect(result).toHaveProperty('valid', true);
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('recommendations');
    });

    it('should return validation errors', async () => {
      const invalidControl = {
        ...mockControl,
        testingGuidance: null,
        evidence: [],
        nextAssessmentDate: null,
      };
      mockControlRepository.findOne.mockResolvedValue(invalidControl);

      const result = await service.validateControl('control-123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing testing procedure');
      expect(result.errors).toContain('No evidence collected');
    });
  });

  describe('getControlGaps', () => {
    it('should return control gaps analysis', async () => {
      const controlWithGaps = {
        ...mockControl,
        gaps: [
          {
            id: 'gap-1',
            description: 'SIEM integration not completed',
            severity: 'medium',
            status: 'open',
          },
        ],
        implementationStatus: ImplementationStatus.PARTIAL,
      };
      mockControlRepository.findOne.mockResolvedValue(controlWithGaps);

      const result = await service.getControlGaps('control-123');

      expect(result).toHaveProperty('control');
      expect(result).toHaveProperty('gaps');
      expect(result.gaps).toHaveLength(1);
      expect(result).toHaveProperty('maturityLevel');
      expect(result).toHaveProperty('recommendations');
    });
  });

  describe('getControlRiskAssessment', () => {
    it('should return control risk assessment', async () => {
      mockControlRepository.findOne.mockResolvedValue(mockControl);

      const result = await service.getControlRiskAssessment('control-123');

      expect(result).toHaveProperty('control');
      expect(result).toHaveProperty('inherentRisk');
      expect(result).toHaveProperty('controlEffectiveness');
      expect(result).toHaveProperty('residualRisk');
      expect(result).toHaveProperty('riskReduction');
      expect(result.riskReduction).toMatchObject({
        percentage: 50,
        category: 'Significant',
      });
      expect(result).toHaveProperty('recommendations');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockControlRepository.findOne.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.findOne('control-123')).rejects.toThrow('Database connection failed');
    });

    it('should handle search service errors', async () => {
      mockFrameworkRepository.findOne.mockResolvedValue({ id: 'framework-123' });
      mockControlRepository.findOne.mockResolvedValue(null);
      mockControlRepository.create.mockReturnValue(mockControl);
      mockControlRepository.save.mockResolvedValue(mockControl);
      mockSearchService.indexControl.mockRejectedValue(new Error('Search service unavailable'));

      // Should not throw - search errors are logged but don't fail the operation
      const mockUser = { userId: 'user-123', email: 'test@example.com', roles: ['admin'], permissions: [] };
      const result = await service.create({} as CreateControlDto, mockUser);
      expect(result).toBeDefined();
    });
  });
});
