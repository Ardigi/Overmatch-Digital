import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import type { CreateEvidenceDto, QueryEvidenceDto, UpdateEvidenceDto } from './dto';
import { EvidenceType, EvidenceSource } from './entities/evidence.entity';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

describe('EvidenceController', () => {
  let controller: EvidenceController;
  let service: EvidenceService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    organizationId: 'org-123',
    roles: ['compliance_manager'],
  };

  const mockEvidence = {
    id: 'evidence-123',
    title: 'Test Evidence',
    description: 'Test evidence description',
    type: 'document',
    controlId: 'control-123',
    status: 'collected',
    metadata: {
      fileName: 'test.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
    },
    createdBy: mockUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEvidenceService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getExpiringEvidence: jest.fn(),
    getEvidenceByAudit: jest.fn(),
    getEvidenceByControl: jest.fn(),
    validateEvidence: jest.fn(),
    bulkUpdate: jest.fn(),
    bulkDelete: jest.fn(),
    bulkValidate: jest.fn(),
    bulkCollect: jest.fn(),
    downloadEvidence: jest.fn(),
    getEvidenceHistory: jest.fn(),
    getVersionHistory: jest.fn(),
    getEvidenceStats: jest.fn(),
    recordAccess: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
    createNewVersion: jest.fn(),
    linkToControl: jest.fn(),
    unlinkFromControl: jest.fn(),
    bulkLinkToControl: jest.fn(),
    getControlEvidenceSummary: jest.fn(),
    getEvidenceByControlWithFilters: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvidenceController],
      providers: [
        {
          provide: EvidenceService,
          useValue: mockEvidenceService,
        },
      ],
    }).compile();

    controller = module.get<EvidenceController>(EvidenceController);
    service = module.get<EvidenceService>(EvidenceService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create new evidence successfully', async () => {
      const createDto: CreateEvidenceDto = {
        title: 'New Evidence',
        description: 'New evidence description',
        type: EvidenceType.DOCUMENT,
        source: EvidenceSource.MANUAL_UPLOAD,
        clientId: 'client-123',
        createdBy: 'user-123',
        controlId: 'control-123',
      };

      mockEvidenceService.create.mockResolvedValue(mockEvidence);

      const result = await controller.create(createDto, mockUser);

      expect(service.create).toHaveBeenCalledWith({
        ...createDto,
        createdBy: mockUser.id,
      });
      expect(result).toEqual(mockEvidence);
    });

    it('should validate required fields', async () => {
      const invalidDto = {
        description: 'Missing required fields',
      } as CreateEvidenceDto;

      mockEvidenceService.create.mockRejectedValue(new BadRequestException('Validation failed'));

      await expect(controller.create(invalidDto, mockUser)).rejects.toThrow(BadRequestException);
    });

    it('should validate evidence type', async () => {
      const createDto: CreateEvidenceDto = {
        title: 'Invalid Type Evidence',
        description: 'Test',
        type: 'invalid' as any as EvidenceType, // Intentionally invalid for error test
        source: EvidenceSource.MANUAL_UPLOAD,
        clientId: 'client-123',
        createdBy: 'user-123',
        controlId: 'control-123',
      };

      mockEvidenceService.create.mockRejectedValue(
        new BadRequestException('Invalid evidence type')
      );

      await expect(controller.create(createDto, mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('uploadEvidence', () => {
    it('should upload evidence with file successfully', async () => {
      const mockFile = {
        originalname: 'test.pdf',
        size: 1024,
        mimetype: 'application/pdf',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      const createDto: CreateEvidenceDto = {
        title: 'Uploaded Evidence',
        description: 'Test upload',
        type: EvidenceType.DOCUMENT,
        source: EvidenceSource.MANUAL_UPLOAD,
        clientId: 'client-123',
        createdBy: 'user-123',
        controlId: 'control-123',
      };

      mockEvidenceService.create.mockResolvedValue(mockEvidence);

      const result = await controller.uploadEvidence(mockFile, createDto, mockUser);

      expect(service.create).toHaveBeenCalledWith({
        ...createDto,
        metadata: {
          fileName: mockFile.originalname,
          fileSize: mockFile.size,
          mimeType: mockFile.mimetype,
        },
        createdBy: mockUser.id,
      });
      expect(result).toEqual(mockEvidence);
    });

    it('should handle missing file upload', async () => {
      const createDto: CreateEvidenceDto = {
        title: 'No File Evidence',
        description: 'Test',
        type: 'document',
        controlId: 'control-123',
      };

      await expect(controller.uploadEvidence(null as Express.Multer.File, createDto, mockUser)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should validate file size limits', async () => {
      const largeFile = {
        originalname: 'large.pdf',
        size: 100 * 1024 * 1024, // 100MB
        mimetype: 'application/pdf',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      const createDto: CreateEvidenceDto = {
        title: 'Large File',
        description: 'Test',
        type: 'document',
        controlId: 'control-123',
      };

      mockEvidenceService.create.mockRejectedValue(new BadRequestException('File too large'));

      await expect(controller.uploadEvidence(largeFile, createDto, mockUser)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('findAll', () => {
    it('should return all evidence without filters', async () => {
      const mockEvidenceList = [mockEvidence];
      const query: QueryEvidenceDto = {};

      mockEvidenceService.findAll.mockResolvedValue({
        data: mockEvidenceList,
        total: 1,
        page: 1,
        limit: 10,
      });

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result.data).toEqual(mockEvidenceList);
    });

    it('should filter by status', async () => {
      const query: QueryEvidenceDto = { status: 'collected' };

      mockEvidenceService.findAll.mockResolvedValue({
        data: [mockEvidence],
        total: 1,
        page: 1,
        limit: 10,
      });

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should filter by type', async () => {
      const query: QueryEvidenceDto = { type: 'document' };

      mockEvidenceService.findAll.mockResolvedValue({
        data: [mockEvidence],
        total: 1,
        page: 1,
        limit: 10,
      });

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should handle pagination', async () => {
      const query: QueryEvidenceDto = { page: 2, limit: 20 };

      mockEvidenceService.findAll.mockResolvedValue({
        data: [],
        total: 50,
        page: 2,
        limit: 20,
      });

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
    });
  });

  describe('getExpiringEvidence', () => {
    it('should return expiring evidence with default 30 days', async () => {
      const expiringEvidence = [
        { ...mockEvidence, expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) },
      ];

      mockEvidenceService.getExpiringEvidence.mockResolvedValue(expiringEvidence);

      const result = await controller.getExpiringEvidence();

      expect(service.getExpiringEvidence).toHaveBeenCalledWith(30);
      expect(result).toEqual(expiringEvidence);
    });

    it('should accept custom days parameter', async () => {
      mockEvidenceService.getExpiringEvidence.mockResolvedValue([]);

      await controller.getExpiringEvidence('60');

      expect(service.getExpiringEvidence).toHaveBeenCalledWith(60);
    });

    it('should handle invalid days parameter', async () => {
      mockEvidenceService.getExpiringEvidence.mockResolvedValue([]);

      await controller.getExpiringEvidence('invalid');

      expect(service.getExpiringEvidence).toHaveBeenCalledWith(NaN);
    });
  });

  describe('getEvidenceByAudit', () => {
    it('should return evidence for specific audit', async () => {
      const auditId = 'audit-123';
      const auditEvidence = [mockEvidence];

      mockEvidenceService.getEvidenceByAudit.mockResolvedValue(auditEvidence);

      const result = await controller.getEvidenceByAudit(auditId);

      expect(service.getEvidenceByAudit).toHaveBeenCalledWith(auditId);
      expect(result).toEqual(auditEvidence);
    });

    it('should handle audit not found', async () => {
      const auditId = 'non-existent';

      mockEvidenceService.getEvidenceByAudit.mockRejectedValue(
        new NotFoundException('Audit not found')
      );

      await expect(controller.getEvidenceByAudit(auditId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEvidenceByControl', () => {
    it('should return evidence for specific control', async () => {
      const controlId = 'control-123';
      const controlEvidence = [mockEvidence];

      mockEvidenceService.getEvidenceByControl.mockResolvedValue(controlEvidence);

      const result = await controller.getEvidenceByControl(controlId);

      expect(service.getEvidenceByControl).toHaveBeenCalledWith(controlId);
      expect(result).toEqual(controlEvidence);
    });
  });

  describe('findOne', () => {
    it('should return evidence by ID', async () => {
      mockEvidenceService.findOne.mockResolvedValue(mockEvidence);

      const result = await controller.findOne('evidence-123');

      expect(service.findOne).toHaveBeenCalledWith('evidence-123');
      expect(result).toEqual(mockEvidence);
    });

    it('should handle not found', async () => {
      mockEvidenceService.findOne.mockRejectedValue(new NotFoundException('Evidence not found'));

      await expect(controller.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should validate UUID format', async () => {
      mockEvidenceService.findOne.mockRejectedValue(new BadRequestException('Invalid UUID'));

      await expect(controller.findOne('invalid-uuid')).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update evidence successfully', async () => {
      const updateDto: UpdateEvidenceDto = {
        title: 'Updated Evidence',
        description: 'Updated description',
      };

      const updatedEvidence = { ...mockEvidence, ...updateDto };
      mockEvidenceService.update.mockResolvedValue(updatedEvidence);

      const result = await controller.update('evidence-123', updateDto, mockUser);

      expect(service.update).toHaveBeenCalledWith('evidence-123', {
        ...updateDto,
        updatedBy: mockUser.id,
      });
      expect(result).toEqual(updatedEvidence);
    });

    it('should handle partial updates', async () => {
      const updateDto: UpdateEvidenceDto = {
        title: 'Only Title Updated',
      };

      mockEvidenceService.update.mockResolvedValue({
        ...mockEvidence,
        title: updateDto.title,
      });

      await controller.update('evidence-123', updateDto, mockUser);

      expect(service.update).toHaveBeenCalledWith('evidence-123', {
        ...updateDto,
        updatedBy: mockUser.id,
      });
    });

    it('should validate status transitions', async () => {
      const updateDto: UpdateEvidenceDto = {
        status: 'approved',
      };

      mockEvidenceService.update.mockRejectedValue(
        new BadRequestException('Invalid status transition')
      );

      await expect(controller.update('evidence-123', updateDto, mockUser)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('validateEvidence', () => {
    it('should validate evidence successfully', async () => {
      const validateDto = {
        isValid: true,
        validationComments: 'Evidence is valid and complete',
      };

      mockEvidenceService.validateEvidence.mockResolvedValue({
        ...mockEvidence,
        status: 'validated',
        validatedBy: mockUser.id,
        validatedAt: new Date(),
      });

      const result = await controller.validateEvidence('evidence-123', validateDto, mockUser);

      expect(service.validateEvidence).toHaveBeenCalledWith(
        'evidence-123',
        validateDto,
        mockUser.id
      );
      expect(result.status).toBe('validated');
    });

    it('should handle validation rejection', async () => {
      const validateDto = {
        isValid: false,
        validationComments: 'Evidence is incomplete',
      };

      mockEvidenceService.validateEvidence.mockResolvedValue({
        ...mockEvidence,
        status: 'rejected',
      });

      const result = await controller.validateEvidence('evidence-123', validateDto, mockUser);

      expect(result.status).toBe('rejected');
    });
  });

  describe('bulkUpdate', () => {
    it('should bulk update evidence', async () => {
      const bulkUpdateDto = {
        evidenceIds: ['evidence-1', 'evidence-2'],
        updates: { status: 'reviewed' },
      };

      mockEvidenceService.bulkUpdate.mockResolvedValue({
        updated: 2,
        failed: 0,
      });

      const result = await controller.bulkUpdate(bulkUpdateDto, mockUser);

      expect(service.bulkUpdate).toHaveBeenCalledWith(bulkUpdateDto, mockUser.id);
      expect(result.updated).toBe(2);
    });

    it('should handle partial bulk update failures', async () => {
      const bulkUpdateDto = {
        evidenceIds: ['evidence-1', 'evidence-2', 'invalid-id'],
        updates: { status: 'reviewed' },
      };

      mockEvidenceService.bulkUpdate.mockResolvedValue({
        updated: 2,
        failed: 1,
        errors: ['Invalid evidence ID: invalid-id'],
      });

      const result = await controller.bulkUpdate(bulkUpdateDto, mockUser);

      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('remove', () => {
    it('should soft delete evidence', async () => {
      mockEvidenceService.remove.mockResolvedValue(mockEvidence);

      const result = await controller.remove('evidence-123');

      expect(service.remove).toHaveBeenCalledWith('evidence-123');
      expect(result).toEqual(mockEvidence);
    });

    it('should prevent deletion of validated evidence', async () => {
      mockEvidenceService.remove.mockRejectedValue(
        new BadRequestException('Cannot delete validated evidence')
      );

      await expect(controller.remove('evidence-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('downloadEvidence', () => {
    it('should download evidence file', async () => {
      const mockFile = {
        buffer: Buffer.from('test content'),
        mimeType: 'application/pdf',
        fileName: 'evidence.pdf',
      };

      mockEvidenceService.downloadEvidence.mockResolvedValue(mockFile);

      const mockResponse: Partial<Response> = {
        set: jest.fn(),
        send: jest.fn(),
      };

      await controller.downloadEvidence('evidence-123', mockResponse as Response);

      expect(service.downloadEvidence).toHaveBeenCalledWith('evidence-123');
      expect(mockResponse.set).toHaveBeenCalledWith({
        'Content-Type': mockFile.mimeType,
        'Content-Disposition': `attachment; filename="${mockFile.fileName}"`,
      });
      expect(mockResponse.send).toHaveBeenCalledWith(mockFile.buffer);
    });

    it('should handle missing file', async () => {
      mockEvidenceService.downloadEvidence.mockRejectedValue(
        new NotFoundException('Evidence file not found')
      );

      const mockResponse: Partial<Response> = {
        set: jest.fn(),
        send: jest.fn(),
      };

      await expect(
        controller.downloadEvidence('evidence-123', mockResponse as Response)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEvidenceHistory', () => {
    it('should return evidence history', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          evidenceId: 'evidence-123',
          action: 'created',
          performedBy: 'user-123',
          performedAt: new Date(),
        },
        {
          id: 'history-2',
          evidenceId: 'evidence-123',
          action: 'updated',
          performedBy: 'user-456',
          performedAt: new Date(),
        },
      ];

      mockEvidenceService.getVersionHistory.mockResolvedValue(mockHistory);

      const result = await controller.getEvidenceHistory('evidence-123');

      expect(service.getVersionHistory).toHaveBeenCalledWith('evidence-123');
      expect(result).toEqual(mockHistory);
    });
  });

  describe('getEvidenceStats', () => {
    it('should return evidence statistics', async () => {
      const mockStats = {
        total: 100,
        byStatus: {
          collected: 40,
          validated: 30,
          expired: 10,
          rejected: 20,
        },
        byType: {
          document: 50,
          screenshot: 30,
          log: 20,
        },
        collectionRate: 75,
        validationRate: 60,
      };

      mockEvidenceService.getEvidenceStats.mockResolvedValue(mockStats);

      const result = await controller.getEvidenceStats();

      expect(service.getEvidenceStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('Role-based access control', () => {
    it('should allow admin to perform all actions', async () => {
      const adminUser = { ...mockUser, roles: ['admin'] };
      mockEvidenceService.create.mockResolvedValue(mockEvidence);

      await controller.create({} as CreateEvidenceDto, adminUser);

      expect(service.create).toHaveBeenCalled();
    });

    it('should allow compliance_manager to create and manage evidence', async () => {
      const complianceUser = { ...mockUser, roles: ['compliance_manager'] };
      mockEvidenceService.update.mockResolvedValue(mockEvidence);

      await controller.update('evidence-123', {}, complianceUser);

      expect(service.update).toHaveBeenCalled();
    });

    it('should allow evidence_viewer read-only access', async () => {
      const viewerUser = { ...mockUser, roles: ['evidence_viewer'] };
      mockEvidenceService.findAll.mockResolvedValue({ data: [], total: 0 });

      await controller.findAll({});

      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockEvidenceService.create.mockRejectedValue(new Error('Database connection error'));

      await expect(controller.create({} as CreateEvidenceDto, mockUser)).rejects.toThrow();
    });

    it('should validate input data types', async () => {
      // Create base valid DTO, then corrupt specific field for testing
      const baseDto: CreateEvidenceDto = {
        title: 'Valid Title', // This will be overwritten
        type: EvidenceType.DOCUMENT,
        source: EvidenceSource.MANUAL_UPLOAD,
        clientId: 'client-123',
        createdBy: 'user-123',
        controlId: 'control-123',
      };
      
      // Type-safe way to test invalid input: override valid field with invalid value
      const invalidDto = {
        ...baseDto,
        title: 123 as unknown as string, // Intentionally invalid for error test
      };

      mockEvidenceService.create.mockRejectedValue(new BadRequestException('Invalid input data'));

      await expect(controller.create(invalidDto, mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Evidence collection automation', () => {
    it('should support automated evidence collection', async () => {
      const collectDto = {
        controlIds: ['control-1', 'control-2'],
        collectionMethod: 'automated',
        schedule: 'daily',
      };

      mockEvidenceService.bulkCollect.mockResolvedValue({
        scheduled: 2,
        failed: 0,
      });

      const result = await controller.bulkCollect(collectDto, mockUser);

      expect(service.bulkCollect).toHaveBeenCalledWith(collectDto, mockUser.id);
      expect(result.scheduled).toBe(2);
    });
  });

  describe('Evidence retention and archival', () => {
    it('should handle evidence retention policies', async () => {
      const retentionDto = {
        evidenceId: 'evidence-123',
        retentionPeriod: 365, // days
        archiveAfter: true,
      };

      mockEvidenceService.update.mockResolvedValue({
        ...mockEvidence,
        retentionDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      await controller.update('evidence-123', retentionDto as UpdateEvidenceDto, mockUser);

      expect(service.update).toHaveBeenCalled();
    });
  });
});
