import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { CacheService } from '../../cache/cache.service';
import { Policy } from '../../policies/entities/policy.entity';
import { ComplianceMappingService } from '../compliance-mapping.service';
import type { BulkMappingDto, CreateMappingDto, QueryMappingDto, UpdateMappingDto } from '../dto';
import { ComplianceMapping } from '../entities/compliance-mapping.entity';
import { Control } from '../entities/control.entity';
import { ComplianceFramework } from '../entities/framework.entity';

describe('ComplianceMappingService', () => {
  let service: ComplianceMappingService;
  let policyRepository: Repository<Policy>;
  let mappingRepository: Repository<ComplianceMapping>;
  let frameworkRepository: Repository<ComplianceFramework>;
  let controlRepository: Repository<Control>;
  let cacheService: CacheService;
  let eventEmitter: EventEmitter2;

  const mockMappingRepository = {
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

  const mockPolicyRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockFrameworkRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockControlRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    deleteByTags: jest.fn(),
    deleteByPattern: jest.fn(),
    buildMappingKey: jest.fn((id) => `mapping:${id}`),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockMetricsService = {
    recordMetric: jest.fn(),
    incrementCounter: jest.fn(),
    recordHistogram: jest.fn(),
  };

  const mockTracingService = {
    startSpan: jest.fn(),
    endSpan: jest.fn(),
    addSpanAttribute: jest.fn(),
  };

  const mockLoggingService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const mockMapping = {
    id: 'mapping-123',
    policyId: 'policy-123',
    controlId: 'control-123',
    frameworkId: 'framework-123',
    organizationId: 'org-123',
    notes: 'Sample mapping notes',
    status: 'draft',
    metadata: {
      createdAt: new Date('2024-12-01'),
      controlIdentifier: 'CC1.1',
      policyNumber: 'SEC-2025-001',
    },
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-15'),
    deletedAt: null,
  };

  const mockPolicy = {
    id: 'policy-123',
    policyNumber: 'SEC-2025-001',
    title: 'Information Security Policy',
    organizationId: 'org-123',
  };

  const mockControl = {
    id: 'control-123',
    identifier: 'CC1.1',
    title: 'Control Environment',
    frameworkId: 'framework-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Manual instantiation pattern - required due to TypeORM/Jest incompatibility
    policyRepository = mockPolicyRepository as any;
    mappingRepository = mockMappingRepository as any;
    frameworkRepository = mockFrameworkRepository as any;
    controlRepository = mockControlRepository as any;
    cacheService = mockCacheService as any;
    eventEmitter = mockEventEmitter as any;
    
    service = new ComplianceMappingService(
      policyRepository,
      controlRepository,
      frameworkRepository,
      mappingRepository,
      cacheService,
      eventEmitter,
      mockMetricsService as any,
      mockTracingService as any,
      mockLoggingService as any
    );
  });

  describe('create', () => {
    const createDto = {
      policyId: 'policy-123',
      controlIds: ['control-123', 'control-456'],
      notes: 'Policy-control mapping notes',
    };

    it('should create policy-control mappings', async () => {
      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy);
      mockControlRepository.find.mockResolvedValue([
        { id: 'control-123', identifier: 'CC1.1', frameworkId: 'framework-123' },
        { id: 'control-456', identifier: 'CC1.2', frameworkId: 'framework-123' }
      ]);
      mockMappingRepository.findOne.mockResolvedValue(null); // No existing mappings
      mockMappingRepository.create.mockImplementation((data) => ({ ...data, id: `mapping-${Math.random()}` }));
      mockMappingRepository.save.mockResolvedValue([mockMapping]);

      const result = await service.create(createDto);

      expect(mockPolicyRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'policy-123' }
      });
      expect(mockControlRepository.find).toHaveBeenCalledWith({
        where: { id: expect.any(Object) },
        relations: ['framework']
      });
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException for invalid policy', async () => {
      mockPolicyRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow('Policy with ID policy-123 not found');
    });

    it('should throw BadRequestException for invalid controls', async () => {
      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy);
      mockControlRepository.find.mockResolvedValue([]);

      await expect(service.create(createDto)).rejects.toThrow('One or more control IDs are invalid');
    });
  });

  describe('service instantiation', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });
});