import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ComplianceFramework, ComplianceStatus, Industry } from './__tests__/mock-entities';
import { ClientStatus } from './entities/client.entity';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import type {
  CompleteOnboardingDto,
  CreateClientDto,
  QueryClientDto,
  StartOnboardingDto,
  UpdateClientDto,
} from './dto';

describe('ClientsController', () => {
  let controller: ClientsController;
  let service: ClientsService;

  const mockClientsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findBySlug: jest.fn(),
    update: jest.fn(),
    archive: jest.fn(),
    restore: jest.fn(),
    updateComplianceStatus: jest.fn(),
    getDashboardStats: jest.fn(),
    getUpcomingAudits: jest.fn(),
    getExpiringCertificates: jest.fn(),
    startOnboarding: jest.fn(),
    completeOnboarding: jest.fn(),
    getComplianceMetrics: jest.fn(),
    getClientUsers: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'admin@example.com',
    roles: ['admin'],
    organizationId: 'org-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientsController],
      providers: [
        {
          provide: ClientsService,
          useValue: mockClientsService,
        },
      ],
    }).compile();

    controller = module.get<ClientsController>(ClientsController);
    service = module.get<ClientsService>(ClientsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new client', async () => {
      // Arrange
      const createDto: CreateClientDto = {
        name: 'Test Client',
        industry: Industry.TECHNOLOGY,
        targetFrameworks: [ComplianceFramework.SOC2_TYPE2],
        contactInfo: {
          primaryContact: {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '123-456-7890',
          },
        },
      };

      const expectedResult = {
        id: 'client-123',
        ...createDto,
        slug: 'test-client',
        complianceStatus: ComplianceStatus.NOT_STARTED,
        createdBy: mockUser.id,
        createdAt: new Date(),
      };

      mockClientsService.create.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.create(createDto, mockUser);

      // Assert
      expect(service.create).toHaveBeenCalledWith(createDto, mockUser.id);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findAll', () => {
    it('should return paginated list of clients', async () => {
      // Arrange
      const query: QueryClientDto = {
        page: 1,
        limit: 10,
        status: ClientStatus.ACTIVE,
      };

      const expectedResult = {
        data: [
          {
            id: 'client-1',
            name: 'Client 1',
            complianceStatus: ComplianceStatus.IMPLEMENTATION,
          },
          {
            id: 'client-2',
            name: 'Client 2',
            complianceStatus: ComplianceStatus.IMPLEMENTATION,
          },
        ],
        meta: {
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      mockClientsService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAll(query);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle empty query parameters', async () => {
      // Arrange
      const expectedResult = {
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        },
      };

      mockClientsService.findAll.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAll({});

      // Assert
      expect(service.findAll).toHaveBeenCalledWith({});
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should return a single client by id', async () => {
      // Arrange
      const clientId = 'client-123';
      const expectedClient = {
        id: clientId,
        name: 'Test Client',
        email: 'client@example.com',
        complianceStatus: ComplianceStatus.COMPLIANT,
      };

      mockClientsService.findOne.mockResolvedValue(expectedClient);

      // Act
      const result = await controller.findOne(clientId);

      // Assert
      expect(service.findOne).toHaveBeenCalledWith(clientId);
      expect(result).toEqual(expectedClient);
    });

    it('should handle non-existent client', async () => {
      // Arrange
      const clientId = 'non-existent';
      mockClientsService.findOne.mockRejectedValue(new NotFoundException('Client not found'));

      // Act & Assert
      await expect(controller.findOne(clientId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySlug', () => {
    it('should return a client by slug', async () => {
      // Arrange
      const slug = 'test-client';
      const expectedClient = {
        id: 'client-123',
        name: 'Test Client',
        slug: slug,
      };

      mockClientsService.findBySlug.mockResolvedValue(expectedClient);

      // Act
      const result = await controller.findBySlug(slug);

      // Assert
      expect(service.findBySlug).toHaveBeenCalledWith(slug);
      expect(result).toEqual(expectedClient);
    });
  });

  describe('update', () => {
    it('should update a client', async () => {
      // Arrange
      const clientId = 'client-123';
      const updateDto: UpdateClientDto = {
        name: 'Updated Client',
        industry: Industry.FINANCE,
      };

      const expectedResult = {
        id: clientId,
        name: 'Updated Client',
        industry: 'Finance',
        updatedBy: mockUser.id,
        updatedAt: new Date(),
      };

      mockClientsService.update.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.update(clientId, updateDto, mockUser);

      // Assert
      expect(service.update).toHaveBeenCalledWith(clientId, updateDto, mockUser.id);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('updateComplianceStatus', () => {
    it('should update client compliance status', async () => {
      // Arrange
      const clientId = 'client-123';
      const body = {
        status: ComplianceStatus.COMPLIANT,
        notes: 'Passed all audits',
      };

      const expectedResult = {
        id: clientId,
        complianceStatus: ComplianceStatus.COMPLIANT,
        complianceNotes: 'Passed all audits',
        updatedBy: mockUser.id,
      };

      mockClientsService.updateComplianceStatus.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateComplianceStatus(clientId, body, mockUser);

      // Assert
      expect(service.updateComplianceStatus).toHaveBeenCalledWith(
        clientId,
        body.status,
        mockUser.id,
        body.notes
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('archive', () => {
    it('should archive a client', async () => {
      // Arrange
      const clientId = 'client-123';
      mockClientsService.archive.mockResolvedValue(undefined);

      // Act
      await controller.archive(clientId, mockUser);

      // Assert
      expect(service.archive).toHaveBeenCalledWith(clientId, mockUser.id);
    });
  });

  describe('restore', () => {
    it('should restore an archived client', async () => {
      // Arrange
      const clientId = 'client-123';
      const expectedResult = {
        id: clientId,
        name: 'Restored Client',
        isArchived: false,
      };

      mockClientsService.restore.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.restore(clientId, mockUser);

      // Assert
      expect(service.restore).toHaveBeenCalledWith(clientId, mockUser.id);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getDashboardStats', () => {
    it('should return dashboard statistics', async () => {
      // Arrange
      const expectedStats = {
        totalClients: 50,
        activeClients: 45,
        certifiedClients: 30,
        upcomingAudits: 5,
        expiringCertificates: 3,
      };

      mockClientsService.getDashboardStats.mockResolvedValue(expectedStats);

      // Act
      const result = await controller.getDashboardStats();

      // Assert
      expect(service.getDashboardStats).toHaveBeenCalled();
      expect(result).toEqual(expectedStats);
    });
  });

  describe('getUpcomingAudits', () => {
    it('should return upcoming audits with default days', async () => {
      // Arrange
      const expectedClients = [
        {
          id: 'client-1',
          name: 'Client 1',
          nextAuditDate: '2024-02-15',
        },
      ];

      mockClientsService.getUpcomingAudits.mockResolvedValue(expectedClients);

      // Act
      const result = await controller.getUpcomingAudits();

      // Assert
      expect(service.getUpcomingAudits).toHaveBeenCalledWith(90);
      expect(result).toEqual({
        data: expectedClients,
        meta: {
          total: 1,
          daysAhead: 90,
        },
      });
    });

    it('should handle custom days parameter', async () => {
      // Arrange
      const expectedClients = [];
      mockClientsService.getUpcomingAudits.mockResolvedValue(expectedClients);

      // Act
      const result = await controller.getUpcomingAudits('30');

      // Assert
      expect(service.getUpcomingAudits).toHaveBeenCalledWith(30);
      expect(result.meta.daysAhead).toBe(30);
    });
  });

  describe('getExpiringCertificates', () => {
    it('should return expiring certificates', async () => {
      // Arrange
      const expectedClients = [
        {
          id: 'client-1',
          name: 'Client 1',
          certificateExpiry: '2024-03-01',
        },
      ];

      mockClientsService.getExpiringCertificates.mockResolvedValue(expectedClients);

      // Act
      const result = await controller.getExpiringCertificates('60');

      // Assert
      expect(service.getExpiringCertificates).toHaveBeenCalledWith(60);
      expect(result).toEqual({
        data: expectedClients,
        meta: {
          total: 1,
          daysAhead: 60,
        },
      });
    });
  });

  describe('startOnboarding', () => {
    it('should start client onboarding', async () => {
      // Arrange
      const startDto: StartOnboardingDto = {
        clientId: 'client-123',
        projectManagerId: 'user-456',
      };

      const expectedResult = {
        id: 'onboarding-123',
        clientId: 'client-123',
        status: 'in_progress',
        startedBy: mockUser.id,
      };

      mockClientsService.startOnboarding.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.startOnboarding(startDto, mockUser);

      // Assert
      expect(service.startOnboarding).toHaveBeenCalledWith(startDto, mockUser.id);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('completeOnboarding', () => {
    it('should complete client onboarding', async () => {
      // Arrange
      const clientId = 'client-123';
      const completeDto: CompleteOnboardingDto = {
        summary: 'Onboarding completed successfully',
        finalChecklist: {
          contractSigned: true,
          paymentMethodSetup: true,
          usersProvisioned: true,
        },
      };

      const expectedResult = {
        id: clientId,
        onboardingStatus: 'completed',
        completedBy: mockUser.id,
      };

      mockClientsService.completeOnboarding.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.completeOnboarding(clientId, completeDto, mockUser);

      // Assert
      expect(service.completeOnboarding).toHaveBeenCalledWith(clientId, completeDto, mockUser.id);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getComplianceMetrics', () => {
    it('should return client compliance metrics', async () => {
      // Arrange
      const clientId = 'client-123';
      const expectedMetrics = {
        overallScore: 85,
        controlsCoverage: 92,
        evidenceCompletion: 78,
        lastAssessmentDate: '2024-01-15',
      };

      mockClientsService.getComplianceMetrics.mockResolvedValue(expectedMetrics);

      // Act
      const result = await controller.getComplianceMetrics(clientId);

      // Assert
      expect(service.getComplianceMetrics).toHaveBeenCalledWith(clientId);
      expect(result).toEqual(expectedMetrics);
    });
  });

  describe('getClientUsers', () => {
    it('should return client users with filters', async () => {
      // Arrange
      const clientId = 'client-123';
      const expectedUsers = [
        {
          id: 'user-1',
          email: 'user1@client.com',
          role: 'admin',
          status: 'active',
        },
      ];

      mockClientsService.getClientUsers.mockResolvedValue(expectedUsers);

      // Act
      const result = await controller.getClientUsers(clientId, 'active', 'admin');

      // Assert
      expect(service.getClientUsers).toHaveBeenCalledWith(clientId, {
        status: 'active',
        role: 'admin',
      });
      expect(result).toEqual({
        data: expectedUsers,
        meta: {
          total: 1,
        },
      });
    });

    it('should handle no filters', async () => {
      // Arrange
      const clientId = 'client-123';
      const expectedUsers = [];
      mockClientsService.getClientUsers.mockResolvedValue(expectedUsers);

      // Act
      const result = await controller.getClientUsers(clientId);

      // Assert
      expect(service.getClientUsers).toHaveBeenCalledWith(clientId, {
        status: undefined,
        role: undefined,
      });
      expect(result.meta.total).toBe(0);
    });
  });
});
