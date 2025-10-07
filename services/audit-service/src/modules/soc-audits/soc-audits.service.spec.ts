import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { CreateSOCAuditDto } from './dto/create-soc-audit.dto';
import type { UpdateSOCAuditDto } from './dto/update-soc-audit.dto';
import { AuditPhase, AuditStatus, AuditType, type SOCAudit } from './entities/soc-audit.entity';
import { SOCAuditsService } from './soc-audits.service';

describe('SOCAuditsService', () => {
  let service: SOCAuditsService;

  const mockAuditRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  const mockAudit: Partial<SOCAudit> = {
    id: 'audit-123',
    organizationId: 'org-123',
    clientId: 'client-123',
    auditNumber: 'SOC2-2024-001',
    auditType: AuditType.SOC2_TYPE2,
    status: AuditStatus.PLANNING,
    currentPhase: AuditPhase.KICKOFF,
    auditPeriodStart: new Date('2024-01-01'),
    auditPeriodEnd: new Date('2024-12-31'),
    plannedCompletionDate: new Date('2025-03-31'),
    completionPercentage: 0,
    leadAuditorId: 'auditor-123',
    cpaFirmId: 'cpa-123',
    scopeDescription: 'Annual SOC 2 Type II audit',
    createdBy: 'user-123',
    updatedBy: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuditRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    // Manual instantiation to avoid TypeORM/Jest issues
    service = new SOCAuditsService(mockAuditRepository as any, mockEventEmitter as any);
  });

  describe('create', () => {
    const createDto: CreateSOCAuditDto = {
      organizationId: 'org-123',
      clientId: 'client-123',
      auditNumber: 'SOC2-2024-001',
      auditType: AuditType.SOC2_TYPE2,
      auditPeriodStart: new Date('2024-01-01'),
      auditPeriodEnd: new Date('2024-12-31'),
      plannedCompletionDate: new Date('2025-03-31'),
      trustServiceCriteria: ['SECURITY', 'AVAILABILITY'],
      leadAuditorId: 'auditor-123',
      engagementPartnerId: 'partner-123',
      auditTeamIds: ['team-member-1', 'team-member-2'],
      cpaFirmId: 'cpa-123',
      cpaFirmName: 'Test CPA Firm LLC',
      auditObjectives: 'Test audit objectives',
      scopeDescription: 'Annual SOC 2 Type II audit',
      inScopeServices: ['Web Application', 'API Services'],
      inScopeLocations: ['Primary Data Center', 'Corporate Office'],
    };

    it('should create a new audit', async () => {
      mockAuditRepository.findOne.mockResolvedValue(null);
      mockAuditRepository.create.mockReturnValue(mockAudit);
      mockAuditRepository.save.mockResolvedValue(mockAudit);

      const result = await service.create(createDto, 'user-123');

      expect(mockAuditRepository.findOne).toHaveBeenCalledWith({
        where: { auditNumber: createDto.auditNumber },
      });
      expect(mockAuditRepository.create).toHaveBeenCalledWith({
        ...createDto,
        status: AuditStatus.PLANNING,
        currentPhase: AuditPhase.KICKOFF,
        completionPercentage: 0,
        createdBy: 'user-123',
        updatedBy: 'user-123',
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('soc-audit.created', {
        audit: mockAudit,
        userId: 'user-123',
        timestamp: expect.any(Date),
      });
      expect(result).toEqual(mockAudit);
    });

    it('should throw ConflictException if audit number exists', async () => {
      mockAuditRepository.findOne.mockResolvedValue(mockAudit);

      await expect(service.create(createDto, 'user-123')).rejects.toThrow(
        new ConflictException(`Audit with number ${createDto.auditNumber} already exists`)
      );

      expect(mockAuditRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if end date is before start date', async () => {
      const invalidDto = {
        ...createDto,
        auditPeriodEnd: new Date('2023-12-31'), // Before start date
      };

      mockAuditRepository.findOne.mockResolvedValue(null);

      await expect(service.create(invalidDto, 'user-123')).rejects.toThrow(
        new BadRequestException('Audit period end date must be after start date')
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated audits with filters', async () => {
      const params = {
        organizationId: 'org-123',
        status: AuditStatus.IN_FIELDWORK,
        page: 1,
        limit: 10,
      };

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAudit], 1]);

      const result = await service.findAll(params);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'audit.organizationId = :organizationId',
        { organizationId: 'org-123' }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('audit.status = :status', {
        status: AuditStatus.IN_FIELDWORK,
      });
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: [mockAudit],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });
    });

    it('should apply search filter', async () => {
      const params = {
        search: 'SOC2',
        page: 1,
        limit: 20,
      };

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAudit], 1]);

      await service.findAll(params);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(audit.auditNumber ILIKE :search OR audit.scopeDescription ILIKE :search)',
        { search: '%SOC2%' }
      );
    });

    it('should apply date range filter', async () => {
      const params = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        page: 1,
        limit: 20,
      };

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(params);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'audit.auditPeriodStart BETWEEN :startDate AND :endDate',
        { startDate: params.startDate, endDate: params.endDate }
      );
    });

    it('should handle pagination correctly', async () => {
      const params = {
        page: 3,
        limit: 25,
      };

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 100]);

      const result = await service.findAll(params);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(50); // (3-1) * 25
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(25);
      expect(result.meta.totalPages).toBe(4); // 100 / 25
    });
  });

  describe('findOne', () => {
    it('should return an audit by ID', async () => {
      mockAuditRepository.findOne.mockResolvedValue(mockAudit);

      const result = await service.findOne('audit-123');

      expect(mockAuditRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'audit-123' },
      });
      expect(result).toEqual(mockAudit);
    });

    it('should throw NotFoundException if audit not found', async () => {
      mockAuditRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        new NotFoundException('Audit with ID non-existent not found')
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateSOCAuditDto = {
      scopeDescription: 'Updated scope description',
      completionPercentage: 25,
    };

    it('should update an audit', async () => {
      const updatedAudit = {
        ...mockAudit,
        ...updateDto,
        updatedBy: 'user-456',
      };

      mockAuditRepository.findOne.mockResolvedValue(mockAudit);
      mockAuditRepository.save.mockResolvedValue(updatedAudit);

      const result = await service.update('audit-123', updateDto, 'user-456');

      expect(mockAuditRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockAudit,
          ...updateDto,
          updatedBy: 'user-456',
        })
      );
      expect(result).toEqual(updatedAudit);
    });

    it('should emit status-changed event when status changes', async () => {
      const updateDtoWithStatus: UpdateSOCAuditDto = {
        status: AuditStatus.IN_FIELDWORK,
      };
      const updatedAudit = {
        ...mockAudit,
        status: AuditStatus.IN_FIELDWORK,
      };

      mockAuditRepository.findOne.mockResolvedValue(mockAudit);
      mockAuditRepository.save.mockResolvedValue(updatedAudit);

      await service.update('audit-123', updateDtoWithStatus, 'user-456');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith('soc-audit.status-changed', {
        audit: updatedAudit,
        previousStatus: AuditStatus.PLANNING,
        newStatus: AuditStatus.IN_FIELDWORK,
        userId: 'user-456',
        timestamp: expect.any(Date),
      });
    });

    it('should emit phase-changed event when phase changes', async () => {
      const updateDtoWithPhase: UpdateSOCAuditDto = {
        currentPhase: AuditPhase.CONTROL_TESTING,
      };
      const updatedAudit = {
        ...mockAudit,
        currentPhase: AuditPhase.CONTROL_TESTING,
      };

      mockAuditRepository.findOne.mockResolvedValue(mockAudit);
      mockAuditRepository.save.mockResolvedValue(updatedAudit);

      await service.update('audit-123', updateDtoWithPhase, 'user-456');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith('soc-audit.phase-changed', {
        audit: updatedAudit,
        previousPhase: AuditPhase.KICKOFF,
        newPhase: AuditPhase.CONTROL_TESTING,
        userId: 'user-456',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('updateStatus', () => {
    it('should update audit status to completed', async () => {
      const inProgressAudit = {
        ...mockAudit,
        status: AuditStatus.IN_FIELDWORK,
      };
      const completedAudit = {
        ...inProgressAudit,
        status: AuditStatus.COMPLETED,
        actualCompletionDate: expect.any(Date),
        completionPercentage: 100,
      };

      mockAuditRepository.findOne.mockResolvedValue(inProgressAudit);
      mockAuditRepository.save.mockResolvedValue(completedAudit);
      // Mock the private method
      jest.spyOn(service as any, 'isValidStatusTransition').mockReturnValue(true);

      const result = await service.updateStatus('audit-123', AuditStatus.COMPLETED, 'user-456');

      expect(mockAuditRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AuditStatus.COMPLETED,
          actualCompletionDate: expect.any(Date),
          completionPercentage: 100,
          updatedBy: 'user-456',
        })
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('soc-audit.status-changed', {
        audit: completedAudit,
        previousStatus: AuditStatus.IN_FIELDWORK,
        newStatus: AuditStatus.COMPLETED,
        userId: 'user-456',
        timestamp: expect.any(Date),
      });
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      const completedAudit = {
        ...mockAudit,
        status: AuditStatus.COMPLETED,
      };

      mockAuditRepository.findOne.mockResolvedValue(completedAudit);
      // Mock the private method
      jest.spyOn(service as any, 'isValidStatusTransition').mockReturnValue(false);

      await expect(
        service.updateStatus('audit-123', AuditStatus.PLANNING, 'user-456')
      ).rejects.toThrow(
        new BadRequestException(
          `Invalid status transition from ${AuditStatus.COMPLETED} to ${AuditStatus.PLANNING}`
        )
      );
    });

    it('should throw NotFoundException if audit not found', async () => {
      mockAuditRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('non-existent', AuditStatus.IN_FIELDWORK, 'user-456')
      ).rejects.toThrow(new NotFoundException('Audit with ID non-existent not found'));
    });
  });
});
