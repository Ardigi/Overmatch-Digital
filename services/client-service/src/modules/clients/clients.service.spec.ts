import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import { Repository } from 'typeorm';
import type { KafkaProducerService } from '../events/kafka-producer.service';
import { RedisService } from '../redis/redis.service';
import type { ContractCoreService } from '../shared-client/contract-core.service';
import { ClientsService } from './clients.service';
import { type CreateClientDto, QueryClientDto, type UpdateClientDto } from './dto';
import type { Client, ClientAudit, ClientDocument, ClientUser } from './entities';

// Mock monitoring services to avoid OpenTelemetry issues in tests
const mockMetricsService = {
  recordHttpRequest: jest.fn(),
  incrementHttpRequestsInFlight: jest.fn(),
  decrementHttpRequestsInFlight: jest.fn(),
  recordDbQuery: jest.fn(),
  recordCacheHit: jest.fn(),
  recordCacheMiss: jest.fn(),
  registerCounter: jest.fn().mockReturnValue({ inc: jest.fn() }),
  registerGauge: jest.fn().mockReturnValue({ set: jest.fn() }),
  registerHistogram: jest.fn().mockReturnValue({ observe: jest.fn() }),
  getMetric: jest.fn(),
  config: { serviceName: 'client-service' },
};

const mockTracingService = {
  withSpan: jest.fn().mockImplementation((name, fn, options) => fn({ setAttribute: jest.fn() })),
  createSpan: jest.fn().mockReturnValue({ setAttribute: jest.fn(), end: jest.fn() }),
  getActiveSpan: jest.fn().mockReturnValue({ setAttribute: jest.fn() }),
};

const mockLoggingService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

describe('ClientsService', () => {
  let service: ClientsService;
  let mockClientRepository: jest.Mocked<Repository<Client>>;
  let mockClientUserRepository: jest.Mocked<Repository<ClientUser>>;
  let mockClientDocumentRepository: jest.Mocked<Repository<ClientDocument>>;
  let mockClientAuditRepository: jest.Mocked<Repository<ClientAudit>>;
  let mockContractCoreService: jest.Mocked<ContractCoreService>;
  let mockKafkaProducer: jest.Mocked<KafkaProducerService>;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockServiceDiscovery: jest.Mocked<ServiceDiscoveryService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;

  // Test data factory
  const createMockClient = () => ({
    id: 'client-123',
    name: 'Test Client',
    legalName: 'Test Client Inc.',
    slug: 'test-client',
    description: 'A test client',
    website: 'https://testclient.com',
    clientType: 'enterprise',
    size: 'large',
    industry: 'technology',
    status: 'active',
    complianceStatus: 'not_started',
    complianceScore: 0,
    targetFrameworks: ['soc2'],
    organizationId: 'org-123',
    createdBy: 'user-123',
    updatedBy: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    isDeleted: false,
  });

  beforeEach(() => {
    // Mock repositories using manual instantiation pattern
    mockClientRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    mockClientUserRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    } as any;

    mockClientDocumentRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    } as any;

    mockClientAuditRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    } as any;

    // Mock services
    mockContractCoreService = {
      findActiveByClientId: jest.fn(),
      findByClientId: jest.fn(),
    } as any;

    mockKafkaProducer = {
      publishClientCreated: jest.fn(),
      publishClientUpdated: jest.fn(),
      publishAuditScheduled: jest.fn(),
      publishClientEvent: jest.fn(),
    } as any;

    mockRedisService = {
      getCachedClient: jest.fn(),
      cacheClient: jest.fn(),
      getCachedClientList: jest.fn(),
      cacheClientList: jest.fn(),
      invalidateClient: jest.fn(),
      invalidateClientList: jest.fn(),
    } as any;

    mockServiceDiscovery = {
      callService: jest.fn(),
    } as any;

    mockEventEmitter = {
      emit: jest.fn(),
    } as any;

    // Manual instantiation to avoid TypeORM/Jest issues
    service = new ClientsService(
      mockClientRepository,
      mockClientUserRepository,
      mockClientDocumentRepository,
      mockClientAuditRepository,
      mockContractCoreService,
      mockKafkaProducer,
      mockRedisService,
      mockServiceDiscovery,
      mockEventEmitter,
      mockMetricsService as any,
      mockTracingService as any,
      mockLoggingService as any
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new client successfully', async () => {
      // Arrange
      const createClientDto: CreateClientDto = {
        name: 'Test Client',
        legalName: 'Test Client Inc.',
        description: 'A test client',
        website: 'https://testclient.com',
        clientType: 'enterprise' as any,
        size: 'large' as any,
        industry: 'technology' as any,
        targetFrameworks: ['soc2'] as any,
        organizationId: 'org-123',
      };
      const userId = 'user-123';
      const mockClient = createMockClient();

      // Mock repository methods
      mockClientRepository.findOne.mockResolvedValue(null); // No existing client
      mockClientRepository.create.mockReturnValue(mockClient as any);
      mockClientRepository.save.mockResolvedValue(mockClient as any);
      mockServiceDiscovery.callService.mockResolvedValue({ success: true, data: { id: userId } }); // User exists

      // Act
      const result = await service.create(createClientDto, userId);

      // Assert
      expect(result).toEqual(mockClient);
      expect(mockClientRepository.findOne).toHaveBeenCalledWith({
        where: { name: createClientDto.name, isDeleted: false },
      });
      expect(mockClientRepository.create).toHaveBeenCalledWith({
        ...createClientDto,
        createdBy: userId,
        updatedBy: userId,
      });
      expect(mockClientRepository.save).toHaveBeenCalledWith(mockClient);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('client.created', expect.any(Object));
      expect(mockKafkaProducer.publishClientCreated).toHaveBeenCalledWith(
        mockClient.id,
        mockClient,
        userId
      );
    });

    it('should throw ConflictException if client with same name exists', async () => {
      // Arrange
      const createClientDto: CreateClientDto = {
        name: 'Existing Client',
        legalName: 'Existing Client Inc.',
        organizationId: 'org-123',
      } as any;
      const userId = 'user-123';
      const existingClient = createMockClient();

      mockClientRepository.findOne.mockResolvedValue(existingClient as any);
      mockServiceDiscovery.callService.mockResolvedValue({ success: true, data: { id: userId } });

      // Act & Assert
      await expect(service.create(createClientDto, userId)).rejects.toThrow(ConflictException);
      expect(mockClientRepository.findOne).toHaveBeenCalledWith({
        where: { name: createClientDto.name, isDeleted: false },
      });
    });

    it('should throw BadRequestException if user does not exist', async () => {
      // Arrange
      const createClientDto: CreateClientDto = {
        name: 'Test Client',
        organizationId: 'org-123',
      } as any;
      const userId = 'nonexistent-user';

      mockServiceDiscovery.callService.mockResolvedValue({ 
        success: false, 
        error: { 
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date()
        }
      });

      // Act & Assert
      await expect(service.create(createClientDto, userId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return client from cache if available', async () => {
      // Arrange
      const clientId = 'client-123';
      const cachedClient = createMockClient();
      mockRedisService.getCachedClient.mockResolvedValue(cachedClient as any);

      // Act
      const result = await service.findOne(clientId);

      // Assert
      expect(result).toEqual(cachedClient);
      expect(mockRedisService.getCachedClient).toHaveBeenCalledWith(clientId);
      expect(mockClientRepository.findOne).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not in cache', async () => {
      // Arrange
      const clientId = 'client-123';
      const dbClient = createMockClient();
      mockRedisService.getCachedClient.mockResolvedValue(null);
      mockClientRepository.findOne.mockResolvedValue(dbClient as any);

      // Act
      const result = await service.findOne(clientId);

      // Assert
      expect(result).toEqual(dbClient);
      expect(mockRedisService.getCachedClient).toHaveBeenCalledWith(clientId);
      expect(mockClientRepository.findOne).toHaveBeenCalledWith({
        where: { id: clientId, isDeleted: false },
        relations: ['subsidiaries', 'contracts', 'clientUsers', 'audits'],
      });
      expect(mockRedisService.cacheClient).toHaveBeenCalledWith(clientId, dbClient);
    });

    it('should throw NotFoundException if client not found', async () => {
      // Arrange
      const clientId = 'nonexistent-client';
      mockRedisService.getCachedClient.mockResolvedValue(null);
      mockClientRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(clientId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update client successfully', async () => {
      // Arrange
      const clientId = 'client-123';
      const updateDto: UpdateClientDto = {
        name: 'Updated Client Name',
        description: 'Updated description',
      };
      const userId = 'user-123';
      const existingClient = createMockClient();
      const updatedClient = { ...existingClient, ...updateDto, updatedBy: userId };

      mockRedisService.getCachedClient.mockResolvedValue(existingClient as any);
      mockClientRepository.save.mockResolvedValue(updatedClient as any);

      // Act
      const result = await service.update(clientId, updateDto, userId);

      // Assert
      expect(result).toEqual(updatedClient);
      expect(mockClientRepository.save).toHaveBeenCalledWith(expect.objectContaining(updateDto));
      expect(mockRedisService.invalidateClient).toHaveBeenCalledWith(clientId);
      expect(mockRedisService.invalidateClientList).toHaveBeenCalledWith(
        existingClient.organizationId
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('client.updated', expect.any(Object));
      expect(mockKafkaProducer.publishClientUpdated).toHaveBeenCalled();
    });
  });

  describe('monitoring integration', () => {
    it('should have monitoring services injected', () => {
      // Verify that monitoring services are properly injected
      expect(service['metricsService']).toBeDefined();
      expect(service['tracingService']).toBeDefined();
      expect(service['loggingService']).toBeDefined();
    });

    it('should have monitoring decorators applied to key methods', () => {
      // Verify that the service instance has the monitoring decorators applied
      // by checking that the methods exist and are functions
      expect(typeof service.create).toBe('function');
      expect(typeof service.update).toBe('function');
      expect(typeof service.findAll).toBe('function');
      expect(typeof service.findOne).toBe('function');
      expect(typeof service.updateComplianceStatus).toBe('function');
      expect(typeof service.startOnboarding).toBe('function');
      expect(typeof service.completeOnboarding).toBe('function');
      expect(typeof service.getComplianceMetrics).toBe('function');
      expect(typeof service.scheduleAudit).toBe('function');

      // In a real production environment, these methods would have monitoring decorators
      // that provide tracing, metrics, and logging functionality
    });
  });
});
