import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import { LoggingService, MetricsService, TracingService } from '@soc-compliance/monitoring';
import { RedisService } from '../redis/redis.service';
import type { CreateEvidenceDto, QueryEvidenceDto, UpdateEvidenceDto } from './dto';
import { Evidence, EvidenceType, EvidenceSource } from './entities/evidence.entity';
import { EvidenceService } from './evidence.service';

describe('EvidenceService', () => {
  let service: EvidenceService;
  let mockRepository: any;
  let mockEventEmitter: any;
  let mockRedisService: any;
  let mockServiceDiscovery: any;
  let mockMetricsService: any;
  let mockTracingService: any;
  let mockLoggingService: any;

  const createMockEvidence = () => ({
    id: 'evidence-123',
    title: 'Test Evidence',
    description: 'Test evidence description',
    type: 'document',
    controlId: 'control-123',
    status: 'collected',
    clientId: 'client-123',
    metadata: {
      fileName: 'test.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
    },
    createdBy: 'user-123',
    updatedBy: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    canBeEditedBy: jest.fn().mockReturnValue(true),
    canBeViewedBy: jest.fn().mockReturnValue(true),
    needsReview: false,
    isExpired: false,
    addReviewComment: jest.fn(),
    updateValidationResults: jest.fn(),
    recordAccess: jest.fn(),
  });

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset mockQueryBuilder methods
    Object.keys(mockQueryBuilder).forEach(key => {
      if (typeof mockQueryBuilder[key] === 'function') {
        mockQueryBuilder[key].mockClear();
        if (
          key === 'where' ||
          key === 'andWhere' ||
          key === 'leftJoinAndSelect' ||
          key === 'orderBy' ||
          key === 'skip' ||
          key === 'take' ||
          key === 'select' ||
          key === 'addSelect' ||
          key === 'update' ||
          key === 'set'
        ) {
          mockQueryBuilder[key].mockReturnThis();
        }
      }
    });

    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      getCachedClientList: jest.fn(),
    };

    mockServiceDiscovery = {
      callService: jest.fn(),
    };

    mockMetricsService = {
      recordHttpRequest: jest.fn(),
      registerCounter: jest.fn().mockReturnValue({ inc: jest.fn() }),
      registerHistogram: jest.fn().mockReturnValue({ observe: jest.fn() }),
      getMetric: jest.fn(),
      config: { serviceName: 'evidence-service-test' },
    };

    mockTracingService = {
      withSpan: jest.fn().mockImplementation((name, fn) => fn({ setAttribute: jest.fn() })),
      createSpan: jest.fn().mockReturnValue({ setAttribute: jest.fn(), end: jest.fn() }),
      getActiveSpan: jest.fn().mockReturnValue({ setAttribute: jest.fn() }),
    };

    mockLoggingService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
    };

    // Create service with manual instantiation including monitoring services
    service = new EvidenceService(
      mockRepository,
      mockEventEmitter,
      mockRedisService,
      mockServiceDiscovery,
      mockMetricsService,
      mockTracingService,
      mockLoggingService
    );
  });

  describe('Constructor and Dependencies', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have monitoring services injected', () => {
      expect(service['metricsService']).toBeDefined();
      expect(service['tracingService']).toBeDefined();
      expect(service['loggingService']).toBeDefined();
    });
  });

  describe('create', () => {
    it('should create new evidence', async () => {
      const createDto: CreateEvidenceDto = {
        title: 'New Evidence',
        description: 'New evidence description',
        type: EvidenceType.DOCUMENT,
        controlId: 'control-123',
        source: EvidenceSource.MANUAL_UPLOAD,
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        collectedBy: 'user-123',
        clientId: 'client-123',
        createdBy: 'user-123',
      };

      const mockEvidence = createMockEvidence();
      mockRepository.create.mockReturnValue(mockEvidence);
      mockRepository.save.mockResolvedValue(mockEvidence);

      const result = await service.create(createDto);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createDto,
          status: 'collected',
        })
      );
      expect(mockRepository.save).toHaveBeenCalledWith(mockEvidence);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'evidence.collected',
        expect.objectContaining({
          type: 'evidence.collected',
          organizationId: 'client-123',
          userId: 'user-123',
          source: 'evidence-service',
          payload: expect.objectContaining({
            evidenceId: mockEvidence.id,
            controlId: mockEvidence.controlId,
            type: 'DOCUMENT',
            collectedBy: 'user-123',
            collectionMethod: 'MANUAL',
          }),
        })
      );
      expect(result).toEqual(mockEvidence);
    });

    it('should validate evidence type', async () => {
      const createDto: CreateEvidenceDto = {
        title: 'Invalid Type',
        type: 'invalid' as any as EvidenceType, // Intentionally invalid for error test
        source: EvidenceSource.MANUAL_UPLOAD,
        clientId: 'client-123',
        createdBy: 'user-123',
      };

      await expect(service.create({ ...createDto, createdBy: 'user-123' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('should handle duplicate evidence', async () => {
      const createDto: CreateEvidenceDto = {
        title: 'Duplicate Evidence',
        description: 'Test',
        type: EvidenceType.DOCUMENT,
        controlId: 'control-123',
        clientId: 'org-123',
        source: EvidenceSource.MANUAL_UPLOAD,
        fileName: 'test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        collectedBy: 'user-123',
        clientId: 'client-123',
        createdBy: 'user-123',
      };

      const mockEvidence = createMockEvidence();
      mockRepository.create.mockReturnValue(mockEvidence);
      mockRepository.save.mockRejectedValue({
        code: '23505', // PostgreSQL unique violation
      });

      await expect(service.create(createDto)).rejects.toThrow();
    });
  });

  describe('findAll', () => {
    it('should return paginated evidence list', async () => {
      const query: QueryEvidenceDto = {
        page: 1,
        limit: 10,
      };

      const expectedEvidence = createMockEvidence();
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[expectedEvidence], 1]),
        getMany: jest.fn(),
        getOne: jest.fn(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn(),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll(query);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
      expect(result).toEqual({
        data: [expectedEvidence],
        total: 1,
        page: 1,
        limit: 10,
      });
    });

    it('should filter by status', async () => {
      const query: QueryEvidenceDto = {
        status: 'collected',
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[createMockEvidence()], 1]),
        getMany: jest.fn(),
        getOne: jest.fn(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn(),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('evidence.status = :status', {
        status: 'collected',
      });
    });

    it('should filter by type', async () => {
      const query: QueryEvidenceDto = {
        type: 'document',
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[createMockEvidence()], 1]),
        getMany: jest.fn(),
        getOne: jest.fn(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn(),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('evidence.type = :type', {
        type: 'document',
      });
    });

    it('should filter by control', async () => {
      const query: QueryEvidenceDto = {
        controlId: 'control-123',
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[createMockEvidence()], 1]),
        getMany: jest.fn(),
        getOne: jest.fn(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn(),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('evidence.controlId = :controlId', {
        controlId: 'control-123',
      });
    });

    it('should search by text', async () => {
      const query: QueryEvidenceDto = {
        search: 'test',
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[createMockEvidence()], 1]),
        getMany: jest.fn(),
        getOne: jest.fn(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn(),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(evidence.title ILIKE :search OR evidence.description ILIKE :search)',
        { search: '%test%' }
      );
    });

    it('should filter by date range', async () => {
      const query: QueryEvidenceDto = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        getMany: jest.fn(),
        getOne: jest.fn(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn(),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('evidence.createdAt >= :startDate', {
        startDate: query.startDate,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('evidence.createdAt <= :endDate', {
        endDate: query.endDate,
      });
    });
  });

  describe('findOne', () => {
    it('should return evidence by ID', async () => {
      const mockEvidence = createMockEvidence();
      mockRepository.findOne.mockResolvedValue(mockEvidence);

      const result = await service.findOne('evidence-123');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'evidence-123' },
        // No relations needed - controlId and auditId are columns, not relations
      });
      expect(result).toEqual(mockEvidence);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update evidence', async () => {
      const updateDto: UpdateEvidenceDto = {
        title: 'Updated Evidence',
        description: 'Updated description',
        updatedBy: 'user-123',
      };

      const mockEvidence = createMockEvidence();
      mockRepository.findOne.mockResolvedValue(mockEvidence);
      mockRepository.save.mockResolvedValue({
        ...mockEvidence,
        ...updateDto,
      });

      const result = await service.update('evidence-123', updateDto);

      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('evidence.updated', expect.any(Object));
      expect(result.title).toBe(updateDto.title);
    });

    it('should validate status transitions', async () => {
      const updateDto: any = {
        status: 'archived',
      };

      const draftEvidence = { ...createMockEvidence(), status: 'draft' };
      mockRepository.findOne.mockResolvedValue(draftEvidence);

      await expect(service.update('evidence-123', updateDto)).rejects.toThrow(BadRequestException);
    });

    it('should handle concurrent updates', async () => {
      const updateDto: UpdateEvidenceDto = {
        title: 'Updated Title',
      };

      const mockEvidence = createMockEvidence();
      mockRepository.findOne.mockResolvedValue(mockEvidence);
      mockRepository.save.mockRejectedValue({
        code: '40001', // PostgreSQL serialization failure
      });

      await expect(service.update('evidence-123', updateDto)).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('should soft delete evidence', async () => {
      const mockEvidence = createMockEvidence();
      mockRepository.findOne.mockResolvedValue(mockEvidence);
      mockRepository.softDelete.mockResolvedValue({ affected: 1 });

      const result = await service.remove('evidence-123');

      expect(mockRepository.softDelete).toHaveBeenCalledWith('evidence-123');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('evidence.deleted', expect.any(Object));
      expect(result).toEqual(mockEvidence);
    });

    it('should prevent deletion of validated evidence', async () => {
      const mockEvidence = createMockEvidence();
      const validatedEvidence = { ...mockEvidence, status: 'approved' };
      mockRepository.findOne.mockResolvedValue(validatedEvidence);

      await expect(service.remove('evidence-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getExpiringEvidence', () => {
    it('should return evidence expiring within specified days', async () => {
      const mockEvidence = createMockEvidence();
      const expiringEvidence = {
        ...mockEvidence,
        expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      };

      mockQueryBuilder.getMany.mockResolvedValue([expiringEvidence]);

      const result = await service.getExpiringEvidence(30);

      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(result).toEqual([expiringEvidence]);
    });

    it('should handle no expiring evidence', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.getExpiringEvidence(30);

      expect(result).toEqual([]);
    });
  });

  describe('validateEvidence', () => {
    it('should validate evidence as approved', async () => {
      const validateDto = {
        isValid: true,
        validationComments: 'Evidence is complete and valid',
      };

      const mockEvidence = createMockEvidence();
      mockRepository.findOne.mockResolvedValue(mockEvidence);
      mockRepository.save.mockResolvedValue({
        ...mockEvidence,
        status: 'approved',
        validatedBy: 'user-123',
        validatedAt: new Date(),
        validationComments: validateDto.validationComments,
      });

      const result = await service.validateEvidence('evidence-123', validateDto, 'user-123');

      expect(result.status).toBe('approved');
      expect(result.validatedBy).toBe('user-123');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('evidence.verified', expect.any(Object));
    });

    it('should reject invalid evidence', async () => {
      const validateDto = {
        isValid: false,
        validationComments: 'Evidence is incomplete',
      };

      const mockEvidence = createMockEvidence();
      mockRepository.findOne.mockResolvedValue(mockEvidence);
      mockRepository.save.mockResolvedValue({
        ...mockEvidence,
        status: 'rejected',
        validatedBy: 'user-123',
        validatedAt: new Date(),
        validationComments: validateDto.validationComments,
      });

      const result = await service.validateEvidence('evidence-123', validateDto, 'user-123');

      expect(result.status).toBe('rejected');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('evidence.rejected', expect.any(Object));
    });

    it('should prevent re-validation of already validated evidence', async () => {
      const mockEvidence = createMockEvidence();
      const validatedEvidence = {
        ...mockEvidence,
        status: 'approved',
        validatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(validatedEvidence);

      await expect(
        service.validateEvidence('evidence-123', { isValid: true }, 'user-123')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkUpdate', () => {
    it('should update multiple evidence items', async () => {
      const bulkUpdateDto = {
        ids: ['evidence-1', 'evidence-2'],
        data: { status: 'reviewed' },
      };

      const mockEvidence = createMockEvidence();
      // Mock for bulkUpdate's findOne calls
      mockRepository.findOne
        .mockResolvedValueOnce(mockEvidence) // First evidence in bulkUpdate
        .mockResolvedValueOnce({ ...mockEvidence, id: 'evidence-2' }) // Second evidence in bulkUpdate
        .mockResolvedValueOnce(mockEvidence) // First evidence in update
        .mockResolvedValueOnce({ ...mockEvidence, id: 'evidence-2' }); // Second evidence in update
      mockRepository.save.mockResolvedValue(mockEvidence);

      const result = await service.bulkUpdate(bulkUpdateDto, 'user-123');

      expect(mockRepository.save).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        updated: 2,
        failed: 0,
      });
    });

    it('should handle partial failures', async () => {
      const bulkUpdateDto = {
        ids: ['evidence-1', 'non-existent'],
        data: { status: 'under_review' },
      };

      const mockEvidence = createMockEvidence();
      // Create evidence that can transition to under_review
      const collectEvidence = { ...mockEvidence, status: 'collected' };

      // Mock for bulkUpdate's findOne calls
      mockRepository.findOne
        .mockResolvedValueOnce(collectEvidence) // First evidence in bulkUpdate
        .mockResolvedValueOnce(null) // Second evidence not found
        .mockResolvedValueOnce(collectEvidence); // First evidence in update
      mockRepository.save.mockResolvedValue({ ...collectEvidence, status: 'under_review' });

      const result = await service.bulkUpdate(bulkUpdateDto, 'user-123');

      expect(result).toEqual({
        updated: 1,
        failed: 1,
        errors: expect.arrayContaining([expect.stringContaining('non-existent')]),
      });
    });
  });

  describe('getEvidenceByAudit', () => {
    it('should return evidence for specific audit', async () => {
      const mockEvidence = createMockEvidence();
      mockQueryBuilder.getMany.mockResolvedValue([mockEvidence]);

      const result = await service.getEvidenceByAudit('audit-123');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('evidence.auditId = :auditId', {
        auditId: 'audit-123',
      });
      expect(result).toEqual([mockEvidence]);
    });
  });

  describe('getEvidenceByControl', () => {
    it('should return evidence for specific control', async () => {
      const mockEvidence = createMockEvidence();
      mockQueryBuilder.getMany.mockResolvedValue([mockEvidence]);

      const result = await service.getEvidenceByControl('control-123');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('evidence.controlId = :controlId', {
        controlId: 'control-123',
      });
      expect(result).toEqual([mockEvidence]);
    });
  });

  describe('getEvidenceStats', () => {
    it('should calculate evidence statistics', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({
        total: 100,
        collected: 40,
        validated: 30,
        expired: 10,
        rejected: 20,
      });

      const result = await service.getEvidenceStats();

      expect(result).toMatchObject({
        total: 100,
        byStatus: {
          collected: 40,
          validated: 30,
          expired: 10,
          rejected: 20,
        },
      });
    });
  });

  describe('Event emission', () => {
    it('should emit events for all CRUD operations', async () => {
      const mockEvidence = createMockEvidence();
      
      // Create
      mockRepository.create.mockReturnValue(mockEvidence);
      mockRepository.save.mockResolvedValue(mockEvidence);
      await service.create({ ...mockEvidence, createdBy: 'user-123' });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('evidence.collected', expect.any(Object));

      // Update
      mockRepository.findOne.mockResolvedValue(mockEvidence);
      mockRepository.save.mockResolvedValue(mockEvidence);
      await service.update('evidence-123', { title: 'Updated' });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('evidence.updated', expect.any(Object));

      // Delete
      mockRepository.findOne.mockResolvedValue({ ...mockEvidence, status: 'collected' });
      mockRepository.softDelete.mockResolvedValue({ affected: 1 });
      await service.remove('evidence-123');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('evidence.deleted', expect.any(Object));
    });
  });

  describe('Data integrity', () => {
    it('should maintain audit trail for all changes', async () => {
      const mockEvidence = createMockEvidence();
      const updateDto: UpdateEvidenceDto = {
        title: 'Updated Title',
      };

      mockRepository.findOne.mockResolvedValue(mockEvidence);
      mockRepository.save.mockResolvedValue({
        ...mockEvidence,
        ...updateDto,
        updatedAt: new Date(),
        updatedBy: 'user-123',
      });

      const result = await service.update('evidence-123', {
        ...updateDto,
        updatedBy: 'user-123',
      });

      expect(result.updatedBy).toBe('user-123');
      expect(result.updatedAt).toBeDefined();
    });

    it('should preserve evidence chain of custody', async () => {
      const chainOfCustody = [
        { userId: 'user-1', action: 'collected', timestamp: new Date() },
        { userId: 'user-2', action: 'validated', timestamp: new Date() },
      ];

      const mockEvidence = createMockEvidence();
      const evidenceWithChain = {
        ...mockEvidence,
        status: 'approved', // Use approved status which can transition to archived
        chainOfCustody,
      };

      mockRepository.findOne.mockResolvedValue(evidenceWithChain);
      mockRepository.save.mockResolvedValue({ ...evidenceWithChain, status: 'archived' });

      const result = await service.update('evidence-123', {
        status: 'archived',
      });

      expect(result.chainOfCustody).toEqual(chainOfCustody);
    });
  });
});
