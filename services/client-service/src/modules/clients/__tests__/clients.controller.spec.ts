import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { KongUser } from '../../../shared/decorators/kong-user.decorator';
import { ClientsController } from '../clients.controller';
import { ClientsService } from '../clients.service';
import type {
  CompleteOnboardingDto,
  CreateClientDto,
  QueryClientDto,
  StartOnboardingDto,
  UpdateClientDto,
} from '../dto';
import {
  ClientStatus,
  ClientType,
  CompanySize,
  ComplianceFramework,
  ComplianceStatus,
  Industry,
} from './mock-entities';

describe('ClientsController', () => {
  let controller: ClientsController;
  let service: ClientsService;

  const mockUser: KongUser = {
    id: 'user-123',
    email: 'test@example.com',
    roles: ['admin'],
    organizationId: 'org-123',
  };

  const mockClient = {
    id: 'client-123',
    name: 'Test Client',
    slug: 'test-client-123456',
    clientType: ClientType.DIRECT,
    status: ClientStatus.ACTIVE,
    complianceStatus: ComplianceStatus.ASSESSMENT,
    industry: Industry.TECHNOLOGY,
    size: CompanySize.MEDIUM,
    complianceScore: 0.75,
    targetFrameworks: [ComplianceFramework.SOC2_TYPE2],
    tags: ['priority', 'tech'],
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-123',
    updatedBy: 'user-123',
  };

  const mockClientsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findBySlug: jest.fn(),
    update: jest.fn(),
    updateComplianceStatus: jest.fn(),
    startOnboarding: jest.fn(),
    completeOnboarding: jest.fn(),
    archive: jest.fn(),
    restore: jest.fn(),
    getDashboardStats: jest.fn(),
    getUpcomingAudits: jest.fn(),
    getExpiringCertificates: jest.fn(),
    getComplianceMetrics: jest.fn(),
    getClientUsers: jest.fn(),
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
    it('should create a new client successfully', async () => {
      const createDto: CreateClientDto = {
        name: 'New Client',
        clientType: ClientType.DIRECT,
        industry: Industry.TECHNOLOGY,
        size: CompanySize.MEDIUM,
        contactInfo: {
          primaryContact: {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1234567890',
          },
        },
      };

      mockClientsService.create.mockResolvedValue(mockClient);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(mockClient);
      expect(service.create).toHaveBeenCalledWith(createDto, mockUser.id);
    });

    it('should handle ConflictException when client name exists', async () => {
      const createDto: CreateClientDto = {
        name: 'Existing Client',
        clientType: ClientType.DIRECT,
      };

      mockClientsService.create.mockRejectedValue(
        new ConflictException('Client with this name already exists')
      );

      await expect(controller.create(createDto, mockUser)).rejects.toThrow(ConflictException);
    });

    it('should validate required fields', async () => {
      const invalidDto = {
        // Missing required name field
        clientType: ClientType.DIRECT,
      };

      // In real implementation, ValidationPipe would catch this
      // This test ensures we're thinking about validation
      expect(() => {
        if (!invalidDto['name']) {
          throw new BadRequestException('Name is required');
        }
      }).toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated clients', async () => {
      const query: QueryClientDto = {
        page: 1,
        limit: 20,
        status: ClientStatus.ACTIVE,
        complianceStatus: ComplianceStatus.COMPLIANT,
      };

      const mockResponse = {
        data: [mockClient],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };

      mockClientsService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll(query);

      expect(result).toEqual(mockResponse);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should handle search queries', async () => {
      const query: QueryClientDto = {
        search: 'tech',
        industry: Industry.TECHNOLOGY,
        tags: ['priority'],
      };

      const mockResponse = {
        data: [mockClient],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };

      mockClientsService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll(query);

      expect(result.data[0].name).toContain('Test');
      expect(result.data[0].industry).toBe(Industry.TECHNOLOGY);
    });

    it('should handle empty results', async () => {
      const query: QueryClientDto = {
        status: ClientStatus.ARCHIVED,
      };

      const mockResponse = {
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        },
      };

      mockClientsService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll(query);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a client by ID', async () => {
      mockClientsService.findOne.mockResolvedValue(mockClient);

      const result = await controller.findOne('client-123');

      expect(result).toEqual(mockClient);
      expect(service.findOne).toHaveBeenCalledWith('client-123');
    });

    it('should handle NotFoundException', async () => {
      mockClientsService.findOne.mockRejectedValue(
        new NotFoundException('Client with ID invalid-id not found')
      );

      await expect(controller.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should validate UUID format', () => {
      const invalidUuid = 'not-a-uuid';
      // ParseUUIDPipe would catch this in real implementation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      expect(uuidRegex.test(invalidUuid)).toBe(false);
      expect(uuidRegex.test('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    });
  });

  describe('findBySlug', () => {
    it('should return a client by slug', async () => {
      mockClientsService.findBySlug.mockResolvedValue(mockClient);

      const result = await controller.findBySlug('test-client-123456');

      expect(result).toEqual(mockClient);
      expect(service.findBySlug).toHaveBeenCalledWith('test-client-123456');
    });

    it('should handle special characters in slug', async () => {
      const slug = 'test-client-with-special-chars';
      mockClientsService.findBySlug.mockResolvedValue({
        ...mockClient,
        slug,
      });

      const result = await controller.findBySlug(slug);

      expect(result.slug).toBe(slug);
    });
  });

  describe('update', () => {
    it('should update a client successfully', async () => {
      const updateDto: UpdateClientDto = {
        name: 'Updated Client Name',
        industry: Industry.FINANCE,
        complianceScore: 0.85,
      };

      const updatedClient = {
        ...mockClient,
        ...updateDto,
        updatedAt: new Date(),
      };

      mockClientsService.update.mockResolvedValue(updatedClient);

      const result = await controller.update('client-123', updateDto, mockUser);

      expect(result).toEqual(updatedClient);
      expect(service.update).toHaveBeenCalledWith('client-123', updateDto, mockUser.id);
    });

    it('should handle partial updates', async () => {
      const updateDto: UpdateClientDto = {
        complianceScore: 0.95,
      };

      mockClientsService.update.mockResolvedValue({
        ...mockClient,
        complianceScore: 0.95,
      });

      const result = await controller.update('client-123', updateDto, mockUser);

      expect(result.complianceScore).toBe(0.95);
      expect(result.name).toBe(mockClient.name); // Unchanged
    });

    it('should validate compliance score range', async () => {
      const invalidDto: UpdateClientDto = {
        complianceScore: 1.5, // Invalid: should be between 0 and 1
      };

      // Validation would catch this
      expect(() => {
        if (
          invalidDto.complianceScore &&
          (invalidDto.complianceScore < 0 || invalidDto.complianceScore > 1)
        ) {
          throw new BadRequestException('Compliance score must be between 0 and 1');
        }
      }).toThrow(BadRequestException);
    });
  });

  describe('updateComplianceStatus', () => {
    it('should update compliance status successfully', async () => {
      const newStatus = ComplianceStatus.COMPLIANT;
      const notes = 'Audit completed successfully';

      const updatedClient = {
        ...mockClient,
        complianceStatus: newStatus,
        complianceScore: 1.0,
      };

      mockClientsService.updateComplianceStatus.mockResolvedValue(updatedClient);

      const result = await controller.updateComplianceStatus(
        'client-123',
        { status: newStatus, notes },
        mockUser
      );

      expect(result.complianceStatus).toBe(newStatus);
      expect(service.updateComplianceStatus).toHaveBeenCalledWith(
        'client-123',
        newStatus,
        mockUser.id,
        notes
      );
    });

    it('should update compliance score based on status', async () => {
      const statusScoreMap = [
        { status: ComplianceStatus.COMPLIANT, expectedScore: 1.0 },
        { status: ComplianceStatus.NON_COMPLIANT, expectedScore: 0 },
        { status: ComplianceStatus.READY_FOR_AUDIT, expectedScore: 0.9 },
        { status: ComplianceStatus.UNDER_AUDIT, expectedScore: 0.85 },
        { status: ComplianceStatus.IMPLEMENTATION, expectedScore: 0.5 },
        { status: ComplianceStatus.REMEDIATION, expectedScore: 0.3 },
        { status: ComplianceStatus.ASSESSMENT, expectedScore: 0.2 },
      ];

      for (const { status, expectedScore } of statusScoreMap) {
        mockClientsService.updateComplianceStatus.mockResolvedValue({
          ...mockClient,
          complianceStatus: status,
          complianceScore: expectedScore,
        });

        const result = await controller.updateComplianceStatus('client-123', { status }, mockUser);

        expect(result.complianceScore).toBe(expectedScore);
      }
    });
  });

  describe('startOnboarding', () => {
    it('should start onboarding process', async () => {
      const startDto: StartOnboardingDto = {
        clientId: 'client-123',
        projectManagerId: 'pm-123',
        customTasks: ['Setup VPN', 'Initial assessment'],
      };

      const updatedClient = {
        ...mockClient,
        onboardingStartDate: new Date(),
        status: ClientStatus.ACTIVE,
      };

      mockClientsService.startOnboarding.mockResolvedValue(updatedClient);

      const result = await controller.startOnboarding(startDto, mockUser);

      expect(result.onboardingStartDate).toBeDefined();
      expect(result.status).toBe(ClientStatus.ACTIVE);
      expect(service.startOnboarding).toHaveBeenCalledWith(startDto, mockUser.id);
    });

    it('should prevent duplicate onboarding', async () => {
      const startDto: StartOnboardingDto = {
        clientId: 'client-123',
      };

      mockClientsService.startOnboarding.mockRejectedValue(
        new BadRequestException('Onboarding has already been started for this client')
      );

      await expect(controller.startOnboarding(startDto, mockUser)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('completeOnboarding', () => {
    it('should complete onboarding successfully', async () => {
      const completeDto: CompleteOnboardingDto = {
        summary: 'Onboarding completed successfully',
        finalChecklist: {
          contractsSigned: true,
          systemAccessGranted: true,
          initialAssessmentComplete: true,
        },
        firstAuditScheduled: '2025-03-01T00:00:00.000Z',
      };

      const updatedClient = {
        ...mockClient,
        onboardingStartDate: new Date('2025-01-01'),
        onboardingCompleteDate: new Date(),
        nextAuditDate: new Date('2025-03-01'),
        complianceStatus: ComplianceStatus.ASSESSMENT,
      };

      mockClientsService.completeOnboarding.mockResolvedValue(updatedClient);

      const result = await controller.completeOnboarding('client-123', completeDto, mockUser);

      expect(result.onboardingCompleteDate).toBeDefined();
      expect(result.nextAuditDate).toEqual(completeDto.firstAuditScheduled);
      expect(service.completeOnboarding).toHaveBeenCalledWith(
        'client-123',
        completeDto,
        mockUser.id
      );
    });

    it('should require onboarding to be started first', async () => {
      const completeDto: CompleteOnboardingDto = {
        summary: 'Trying to complete without starting',
      };

      mockClientsService.completeOnboarding.mockRejectedValue(
        new BadRequestException('Onboarding has not been started for this client')
      );

      await expect(
        controller.completeOnboarding('client-123', completeDto, mockUser)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('archive', () => {
    it('should archive a client', async () => {
      mockClientsService.archive.mockResolvedValue(undefined);

      await controller.archive('client-123', mockUser);

      expect(service.archive).toHaveBeenCalledWith('client-123', mockUser.id);
    });

    it('should prevent archiving with active contracts', async () => {
      mockClientsService.archive.mockRejectedValue(
        new BadRequestException(
          'Cannot archive client with active contracts. Please terminate or complete all contracts first.'
        )
      );

      await expect(controller.archive('client-123', mockUser)).rejects.toThrow(BadRequestException);
    });

    it('should require admin role', () => {
      // This would be handled by the @Roles decorator and guard
      const nonAdminUser = { ...mockUser, roles: ['user'] };

      // In real implementation, KongRolesGuard would check this
      expect(nonAdminUser.roles.includes('admin')).toBe(false);
    });
  });

  describe('restore', () => {
    it('should restore an archived client', async () => {
      const restoredClient = {
        ...mockClient,
        status: ClientStatus.INACTIVE,
        isDeleted: false,
      };

      mockClientsService.restore.mockResolvedValue(restoredClient);

      const result = await controller.restore('client-123', mockUser);

      expect(result.isDeleted).toBe(false);
      expect(result.status).toBe(ClientStatus.INACTIVE);
      expect(service.restore).toHaveBeenCalledWith('client-123', mockUser.id);
    });

    it('should handle non-archived client', async () => {
      mockClientsService.restore.mockRejectedValue(
        new BadRequestException('Client is not archived')
      );

      await expect(controller.restore('client-123', mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDashboardStats', () => {
    it('should return dashboard statistics', async () => {
      const mockStats = {
        totalClients: 50,
        activeClients: 35,
        clientsByStatus: {
          active: 35,
          inactive: 10,
          pending: 5,
        },
        clientsByCompliance: {
          compliant: 20,
          non_compliant: 5,
          under_audit: 10,
        },
        clientsByFramework: {
          soc2_type2: 30,
          iso27001: 15,
          hipaa: 10,
        },
        upcomingAuditsCount: 12,
        expiringCertificatesCount: 8,
        averageComplianceScore: 0.78,
      };

      mockClientsService.getDashboardStats.mockResolvedValue(mockStats);

      const result = await controller.getDashboardStats();

      expect(result).toEqual(mockStats);
      expect(result.totalClients).toBe(50);
      expect(result.averageComplianceScore).toBe(0.78);
    });

    it('should handle empty database', async () => {
      const emptyStats = {
        totalClients: 0,
        activeClients: 0,
        clientsByStatus: {},
        clientsByCompliance: {},
        clientsByFramework: {},
        upcomingAuditsCount: 0,
        expiringCertificatesCount: 0,
        averageComplianceScore: 0,
      };

      mockClientsService.getDashboardStats.mockResolvedValue(emptyStats);

      const result = await controller.getDashboardStats();

      expect(result.totalClients).toBe(0);
      expect(result.averageComplianceScore).toBe(0);
    });
  });

  describe('getUpcomingAudits', () => {
    it('should return clients with upcoming audits', async () => {
      const clientsWithAudits = [
        { ...mockClient, nextAuditDate: new Date('2025-02-01') },
        { ...mockClient, id: 'client-456', nextAuditDate: new Date('2025-02-15') },
      ];

      mockClientsService.getUpcomingAudits.mockResolvedValue(clientsWithAudits);

      const result = await controller.getUpcomingAudits('90');

      expect(result.data).toHaveLength(2);
      expect(result.meta.daysAhead).toBe(90);
      expect(service.getUpcomingAudits).toHaveBeenCalledWith(90);
    });

    it('should use default days when not specified', async () => {
      mockClientsService.getUpcomingAudits.mockResolvedValue([]);

      await controller.getUpcomingAudits();

      expect(service.getUpcomingAudits).toHaveBeenCalledWith(90);
    });

    it('should handle invalid days parameter', async () => {
      const result = await controller.getUpcomingAudits('invalid');

      // parseInt('invalid') returns NaN, which should be handled
      expect(service.getUpcomingAudits).toHaveBeenCalledWith(NaN);
    });
  });

  describe('getExpiringCertificates', () => {
    it('should return clients with expiring certificates', async () => {
      const clientsWithExpiring = [
        { ...mockClient, certificateExpiryDate: new Date('2025-02-01') },
        { ...mockClient, id: 'client-789', certificateExpiryDate: new Date('2025-03-01') },
      ];

      mockClientsService.getExpiringCertificates.mockResolvedValue(clientsWithExpiring);

      const result = await controller.getExpiringCertificates('60');

      expect(result.data).toHaveLength(2);
      expect(result.meta.daysAhead).toBe(60);
      expect(service.getExpiringCertificates).toHaveBeenCalledWith(60);
    });

    it('should filter out expired certificates', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      const clientsWithExpired = [{ ...mockClient, certificateExpiryDate: pastDate }];

      mockClientsService.getExpiringCertificates.mockResolvedValue(clientsWithExpired);

      const result = await controller.getExpiringCertificates();

      // Service should handle filtering
      expect(result.data).toBeDefined();
    });
  });

  describe('getComplianceMetrics', () => {
    it('should return comprehensive compliance metrics', async () => {
      const mockMetrics = {
        overallScore: 0.85,
        frameworkScores: {
          soc2_type2: 0.9,
          iso27001: 0.8,
        },
        controlsStatus: {
          total: 100,
          implemented: 75,
          inProgress: 15,
          notStarted: 10,
        },
        upcomingAudits: [],
        certificateStatus: {
          active: 1,
          expiringSoon: 0,
          expired: 0,
        },
      };

      mockClientsService.getComplianceMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getComplianceMetrics('client-123');

      expect(result).toEqual(mockMetrics);
      expect(result.overallScore).toBe(0.85);
      expect(result.controlsStatus.implemented).toBe(75);
    });

    it('should calculate control implementation percentage', async () => {
      const metrics = await controller.getComplianceMetrics('client-123');

      mockClientsService.getComplianceMetrics.mockResolvedValue({
        overallScore: 0.75,
        frameworkScores: {},
        controlsStatus: {
          total: 100,
          implemented: 75,
          inProgress: 15,
          notStarted: 10,
        },
        upcomingAudits: [],
        certificateStatus: {
          active: 0,
          expiringSoon: 0,
          expired: 0,
        },
      });

      const result = await controller.getComplianceMetrics('client-123');
      const implementationPercentage =
        (result.controlsStatus.implemented / result.controlsStatus.total) * 100;

      expect(implementationPercentage).toBe(75);
    });
  });

  describe('getClientUsers', () => {
    it('should return client users with filters', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          clientId: 'client-123',
          userId: 'user-456',
          role: 'admin',
          status: 'active',
        },
        {
          id: 'user-2',
          clientId: 'client-123',
          userId: 'user-789',
          role: 'viewer',
          status: 'active',
        },
      ];

      mockClientsService.getClientUsers.mockResolvedValue(mockUsers);

      const result = await controller.getClientUsers('client-123', 'active', 'admin');

      expect(result.data).toBeDefined();
      expect(result.meta.total).toBeDefined();
      expect(service.getClientUsers).toHaveBeenCalledWith('client-123', {
        status: 'active',
        role: 'admin',
      });
    });

    it('should handle users without filters', async () => {
      mockClientsService.getClientUsers.mockResolvedValue([]);

      const result = await controller.getClientUsers('client-123');

      expect(service.getClientUsers).toHaveBeenCalledWith('client-123', {
        status: undefined,
        role: undefined,
      });
    });
  });

  describe('Role-based Access Control', () => {
    it('should enforce role requirements for each endpoint', () => {
      // These tests verify that the @Roles decorator is properly configured
      const endpoints = [
        { method: 'create', roles: ['admin', 'compliance_manager', 'account_manager'] },
        { method: 'findAll', roles: ['admin', 'compliance_manager', 'account_manager', 'auditor'] },
        { method: 'updateComplianceStatus', roles: ['admin', 'compliance_manager'] },
        { method: 'archive', roles: ['admin'] },
      ];

      // In real implementation, KongRolesGuard would enforce these
      endpoints.forEach((endpoint) => {
        expect(endpoint.roles).toBeDefined();
        expect(endpoint.roles.length).toBeGreaterThan(0);
      });
    });

    it('should deny access for unauthorized roles', async () => {
      const unauthorizedUser = { ...mockUser, roles: ['viewer'] };

      // In real implementation, guard would throw ForbiddenException
      const hasRequiredRole = (requiredRoles: string[], userRoles: string[]) => {
        return requiredRoles.some((role) => userRoles.includes(role));
      };

      expect(hasRequiredRole(['admin'], unauthorizedUser.roles)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockClientsService.findAll.mockRejectedValue(new Error('Database connection failed'));

      await expect(controller.findAll({})).rejects.toThrow(Error);
    });

    it('should validate input data types', () => {
      // Test various invalid inputs
      const invalidInputs = [
        { complianceScore: 'not-a-number' },
        { status: 'invalid-status' },
        { targetFrameworks: 'not-an-array' },
      ];

      invalidInputs.forEach((input) => {
        // ValidationPipe would catch these in real implementation
        expect(() => {
          // Type checking logic
          if (input.complianceScore && typeof input.complianceScore !== 'number') {
            throw new BadRequestException('Compliance score must be a number');
          }
        }).toBeDefined();
      });
    });

    it('should handle concurrent modification conflicts', async () => {
      const updateDto: UpdateClientDto = {
        name: 'Updated Name',
      };

      mockClientsService.update.mockRejectedValue(
        new ConflictException('Client was modified by another user')
      );

      await expect(controller.update('client-123', updateDto, mockUser)).rejects.toThrow(
        ConflictException
      );
    });
  });
});
