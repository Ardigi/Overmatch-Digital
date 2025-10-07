import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import type { ClientsService } from './clients.service';
import type { CreateClientDto, QueryClientDto, UpdateClientDto } from './dto';
import {
  ClientStatus,
  ClientType,
  CompanySize,
  ComplianceStatus,
  Industry,
} from './entities/client.entity';

describe('ClientsController (Simple Unit Tests)', () => {
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

  beforeEach(() => {
    service = mockClientsService as any;
    controller = new ClientsController(service);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new client', async () => {
      const createDto: CreateClientDto = {
        name: 'Test Client',
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
        address: {
          headquarters: {
            street1: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94105',
            country: 'USA',
          },
        },
        targetFrameworks: ['soc2_type2'] as any,
      };

      const expectedResult = {
        id: '123',
        ...createDto,
        status: ClientStatus.PENDING,
        complianceStatus: ComplianceStatus.NOT_STARTED,
        createdBy: mockUser.id,
      };

      mockClientsService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createDto, mockUser as any);

      expect(result).toEqual(expectedResult);
      expect(mockClientsService.create).toHaveBeenCalledWith(createDto, mockUser.id);
    });

    it('should handle duplicate client creation', async () => {
      const createDto: CreateClientDto = {
        name: 'Duplicate Client',
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
        address: {
          headquarters: {
            street1: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94105',
            country: 'USA',
          },
        },
        targetFrameworks: ['soc2_type2'] as any,
      };

      mockClientsService.create.mockRejectedValue(
        new BadRequestException('Client with this name already exists')
      );

      await expect(controller.create(createDto, mockUser as any)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated clients', async () => {
      const query: QueryClientDto = {
        page: 1,
        limit: 20,
      };

      const expectedResult = {
        data: [
          { id: '1', name: 'Client 1' },
          { id: '2', name: 'Client 2' },
        ],
        meta: {
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };

      mockClientsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(query);

      expect(result).toEqual(expectedResult);
      expect(mockClientsService.findAll).toHaveBeenCalledWith(query);
    });

    it('should filter by status', async () => {
      const query: QueryClientDto = {
        status: ClientStatus.ACTIVE,
        page: 1,
        limit: 20,
      };

      const expectedResult = {
        data: [{ id: '1', name: 'Active Client', status: ClientStatus.ACTIVE }],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };

      mockClientsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(query);

      expect(result).toEqual(expectedResult);
      expect(mockClientsService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return a client by ID', async () => {
      const clientId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedClient = {
        id: clientId,
        name: 'Test Client',
        status: ClientStatus.ACTIVE,
      };

      mockClientsService.findOne.mockResolvedValue(expectedClient);

      const result = await controller.findOne(clientId);

      expect(result).toEqual(expectedClient);
      expect(mockClientsService.findOne).toHaveBeenCalledWith(clientId);
    });

    it('should throw NotFoundException for non-existent client', async () => {
      const clientId = '123e4567-e89b-12d3-a456-426614174000';

      mockClientsService.findOne.mockRejectedValue(new NotFoundException('Client not found'));

      await expect(controller.findOne(clientId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a client', async () => {
      const clientId = '123e4567-e89b-12d3-a456-426614174000';
      const updateDto: UpdateClientDto = {
        name: 'Updated Client Name',
        complianceScore: 0.85,
      };

      const expectedResult = {
        id: clientId,
        ...updateDto,
        updatedBy: mockUser.id,
      };

      mockClientsService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(clientId, updateDto, mockUser as any);

      expect(result).toEqual(expectedResult);
      expect(mockClientsService.update).toHaveBeenCalledWith(clientId, updateDto, mockUser.id);
    });
  });

  describe('archive', () => {
    it('should archive a client', async () => {
      const clientId = '123e4567-e89b-12d3-a456-426614174000';

      mockClientsService.archive.mockResolvedValue(undefined);

      await controller.archive(clientId, mockUser as any);

      expect(mockClientsService.archive).toHaveBeenCalledWith(clientId, mockUser.id);
    });

    it('should prevent archiving with active contracts', async () => {
      const clientId = '123e4567-e89b-12d3-a456-426614174000';

      mockClientsService.archive.mockRejectedValue(
        new BadRequestException('Cannot archive client with active contracts')
      );

      await expect(controller.archive(clientId, mockUser as any)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('getDashboardStats', () => {
    it('should return dashboard statistics', async () => {
      const expectedStats = {
        totalClients: 100,
        activeClients: 75,
        clientsByStatus: {
          active: 75,
          pending: 10,
          inactive: 15,
        },
        clientsByCompliance: {
          compliant: 50,
          under_audit: 20,
          not_compliant: 5,
        },
        averageComplianceScore: 0.85,
      };

      mockClientsService.getDashboardStats.mockResolvedValue(expectedStats);

      const result = await controller.getDashboardStats();

      expect(result).toEqual(expectedStats);
      expect(mockClientsService.getDashboardStats).toHaveBeenCalled();
    });
  });

  describe('startOnboarding', () => {
    it('should start client onboarding', async () => {
      const startOnboardingDto = {
        clientId: '123',
        projectManagerId: 'pm-456',
        customTasks: ['Task 1', 'Task 2'],
      };

      const expectedResult = {
        id: '123',
        status: ClientStatus.ACTIVE,
        onboardingStartDate: new Date(),
      };

      mockClientsService.startOnboarding.mockResolvedValue(expectedResult);

      const result = await controller.startOnboarding(startOnboardingDto, mockUser as any);

      expect(result).toEqual(expectedResult);
      expect(mockClientsService.startOnboarding).toHaveBeenCalledWith(
        startOnboardingDto,
        mockUser.id
      );
    });
  });
});
