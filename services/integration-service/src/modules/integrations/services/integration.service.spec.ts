import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import {
  AuthType,
  type Integration,
  IntegrationStatus,
  IntegrationType,
} from '../entities/integration.entity';
import {
  IntegrationLog,
  type LogLevel,
  type OperationType,
} from '../entities/integration-log.entity';
import { ConnectorFactory } from './connector.factory';
import { HealthCheckService } from './health-check.service';
import { IntegrationService } from './integration.service';

// Mock factories
const createMockRepository = <T extends object = any>(): jest.Mocked<Repository<T>> => {
  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    limit: jest.fn().mockReturnThis(),
  };

  return {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    merge: jest.fn(),
    preload: jest.fn(),
    query: jest.fn(),
    clear: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
  } as any;
};

const createMockEventEmitter = (): any => ({
  emit: jest.fn(),
  emitAsync: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  many: jest.fn(),
  off: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  hasListeners: jest.fn(),
  prependListener: jest.fn(),
  prependOnceListener: jest.fn(),
  prependMany: jest.fn(),
  listeners: jest.fn(),
  listenersAny: jest.fn(),
  eventNames: jest.fn(),
  listenerCount: jest.fn(),
  setMaxListeners: jest.fn(),
  getMaxListeners: jest.fn(),
  waitFor: jest.fn(),
});

describe('IntegrationService', () => {
  let service: IntegrationService;
  let integrationRepository: any;
  let logRepository: any;
  let connectorFactory: any;
  let healthCheckService: any;
  let eventEmitter: any;

  const mockIntegration = {
    id: 'integration-123',
    organizationId: 'org-123',
    name: 'Salesforce Integration',
    description: 'CRM integration for client data',
    integrationType: IntegrationType.CRM,
    authType: AuthType.OAUTH2,
    status: IntegrationStatus.ACTIVE,
    isHealthy: true,
    healthMessage: 'Connection successful',
    configuration: {
      apiUrl: 'https://api.salesforce.com',
      apiVersion: 'v53.0',
      oauth2Config: {
        clientId: 'client-id',
        clientSecret: 'encrypted-secret',
        authorizationUrl: 'https://login.salesforce.com/services/oauth2/authorize',
        tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
        scope: ['api', 'refresh_token'],
      },
      syncSettings: {
        entities: ['Contact', 'Account', 'Opportunity'],
        syncInterval: 300,
        batchSize: 100,
      },
    },
    healthCheck: {
      endpoint: '/services/data',
      interval: 300,
      timeout: 30,
      successCriteria: {
        statusCode: 200,
        responseContains: 'resources',
      },
    },
    metadata: {
      lastSync: new Date(),
      syncInterval: 300,
      capabilities: ['read', 'write', 'delete'],
      version: '1.0.0',
    },
    tags: ['crm', 'sales', 'production'],
    stats: {
      totalRequests: 1250,
      successfulRequests: 1200,
      failedRequests: 50,
      lastHealthCheckAt: new Date(),
      lastSuccessAt: new Date(),
      lastFailureAt: null,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockIntegrationLog = {
    id: 'log-123',
    integrationId: 'integration-123',
    timestamp: new Date(),
    logLevel: 'INFO',
    operationType: 'SYNC',
    success: true,
    message: 'Sync completed successfully',
    requestData: {
      endpoint: '/services/data/v53.0/sobjects/Contact',
      method: 'GET',
      params: { limit: 100 },
    },
    responseData: {
      statusCode: 200,
      recordsCount: 100,
    },
    duration: 1200,
    errorDetails: null,
    metadata: {
      batchId: 'batch-123',
      processedRecords: 100,
    },
  };

  beforeEach(() => {
    // Create mocks
    integrationRepository = createMockRepository();
    logRepository = createMockRepository();
    connectorFactory = {
      createConnector: jest.fn(),
      getSupportedTypes: jest.fn(),
      validateConfiguration: jest.fn(),
    } as any;
    healthCheckService = {
      checkHealth: jest.fn(),
      getHealthHistory: jest.fn(),
      scheduleHealthCheck: jest.fn(),
      updateHealthStatus: jest.fn(),
    } as any;
    eventEmitter = createMockEventEmitter();

    // Mock ServiceDiscoveryService
    const mockServiceDiscovery = {
      getService: jest.fn(),
      callService: jest.fn(),
    } as any;

    // Manual instantiation
    service = new IntegrationService(
      integrationRepository,
      logRepository,
      connectorFactory,
      healthCheckService,
      eventEmitter,
      mockServiceDiscovery
    );

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new integration', async () => {
      const createDto = {
        organizationId: 'org-123',
        name: 'HubSpot Integration',
        description: 'Marketing automation integration',
        integrationType: IntegrationType.MARKETING,
        authType: AuthType.API_KEY,
        configuration: {
          apiUrl: 'https://api.hubspot.com',
          apiKey: 'encrypted-key',
        },
        tags: ['marketing', 'automation'],
      };

      const mockConnector = {
        testConnection: jest.fn().mockResolvedValue({
          success: true,
          message: 'Connection successful',
          details: { apiVersion: 'v3' },
        }),
      };

      integrationRepository.findOne.mockResolvedValue(null);
      integrationRepository.create.mockReturnValue({
        ...createDto,
        status: IntegrationStatus.PENDING,
      });
      integrationRepository.save.mockResolvedValue({
        ...mockIntegration,
        ...createDto,
        id: 'integration-456',
      });
      connectorFactory.createConnector.mockResolvedValue(mockConnector);

      const result = await service.create(createDto);

      expect(integrationRepository.findOne).toHaveBeenCalledWith({
        where: {
          organizationId: createDto.organizationId,
          name: createDto.name,
        },
      });
      expect(integrationRepository.create).toHaveBeenCalledWith({
        ...createDto,
        status: IntegrationStatus.PENDING,
        stats: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
        },
      });
      expect(connectorFactory.createConnector).toHaveBeenCalled();
      expect(mockConnector.testConnection).toHaveBeenCalled();
      expect(result.status).toBe(IntegrationStatus.ACTIVE);
      expect(result.isHealthy).toBe(true);
    });

    it('should handle duplicate integration names', async () => {
      const createDto = {
        organizationId: 'org-123',
        name: 'Duplicate Integration',
        integrationType: IntegrationType.CRM,
        authType: AuthType.OAUTH2,
        configuration: {
          apiUrl: 'https://api.example.com',
        },
      };

      integrationRepository.findOne.mockResolvedValue(mockIntegration);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
      expect(integrationRepository.save).not.toHaveBeenCalled();
    });

    it('should handle connection test failures', async () => {
      const createDto = {
        organizationId: 'org-123',
        name: 'Failed Integration',
        integrationType: IntegrationType.CRM,
        authType: AuthType.API_KEY,
        configuration: {
          apiUrl: 'https://api.invalid.com',
          apiKey: 'invalid-key',
        },
      };

      const mockConnector = {
        testConnection: jest.fn().mockResolvedValue({
          success: false,
          message: 'Authentication failed',
          error: 'Invalid API key',
        }),
      };

      integrationRepository.findOne.mockResolvedValue(null);
      integrationRepository.create.mockReturnValue({
        ...createDto,
        status: IntegrationStatus.PENDING,
      });
      integrationRepository.save.mockImplementation((entity: Integration) =>
        Promise.resolve(entity)
      );
      connectorFactory.createConnector.mockResolvedValue(mockConnector);

      const result = await service.create(createDto);

      expect(result.status).toBe(IntegrationStatus.ERROR);
      expect(result.isHealthy).toBe(false);
      expect(result.healthMessage).toContain('Authentication failed');
    });
  });

  describe('findAll', () => {
    it('should return filtered integrations', async () => {
      const filters = {
        status: IntegrationStatus.ACTIVE,
        type: IntegrationType.CRM,
        isHealthy: true,
        tags: ['production'],
      };

      const mockQueryBuilder = integrationRepository.createQueryBuilder();
      mockQueryBuilder.getMany.mockResolvedValue([mockIntegration]);

      const result = await service.findAll('org-123', filters);

      expect(integrationRepository.createQueryBuilder).toHaveBeenCalledWith('integration');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'integration.organizationId = :organizationId',
        { organizationId: 'org-123' }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('integration.status = :status', {
        status: IntegrationStatus.ACTIVE,
      });
      expect(result).toEqual([mockIntegration]);
    });

    it('should handle tag filtering with array contains', async () => {
      const filters = {
        tags: ['crm', 'production'],
      };

      const mockQueryBuilder = integrationRepository.createQueryBuilder();
      mockQueryBuilder.getMany.mockResolvedValue([mockIntegration]);

      await service.findAll('org-123', filters);

      expect(integrationRepository.createQueryBuilder).toHaveBeenCalledWith('integration');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('integration.tags @> :tags', {
        tags: filters.tags,
      });
    });
  });

  describe('testConnection', () => {
    it('should test integration connection and update status', async () => {
      const mockConnector = {
        testConnection: jest.fn().mockResolvedValue({
          success: true,
          message: 'Connection successful',
          latency: 150,
          details: {
            apiVersion: 'v53.0',
            orgId: 'salesforce-org-123',
          },
        }),
      };

      integrationRepository.findOne.mockResolvedValue(mockIntegration);
      connectorFactory.createConnector.mockResolvedValue(mockConnector);
      integrationRepository.save.mockResolvedValue(mockIntegration);

      const result = await service.testConnection('integration-123', 'org-123');

      expect(integrationRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'integration-123', organizationId: 'org-123' },
      });
      expect(connectorFactory.createConnector).toHaveBeenCalledWith(mockIntegration);
      expect(mockConnector.testConnection).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(integrationRepository.save).toHaveBeenCalled();
    });

    it('should handle connection test errors', async () => {
      const mockConnector = {
        testConnection: jest.fn().mockRejectedValue(new Error('Network timeout')),
      };

      integrationRepository.findOne.mockResolvedValue(mockIntegration);
      connectorFactory.createConnector.mockResolvedValue(mockConnector);
      integrationRepository.save.mockResolvedValue(mockIntegration);

      const result = await service.testConnection('integration-123', 'org-123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection test failed');
      expect(result.error).toContain('Network timeout');
    });
  });

  describe('activate/deactivate', () => {
    it('should activate an integration', async () => {
      const inactiveIntegration = {
        ...mockIntegration,
        status: IntegrationStatus.INACTIVE,
      };

      const mockConnector = {
        testConnection: jest.fn().mockResolvedValue({
          success: true,
          message: 'Connection successful',
        }),
      };

      integrationRepository.findOne.mockResolvedValue(inactiveIntegration);
      connectorFactory.createConnector.mockResolvedValue(mockConnector);
      integrationRepository.save.mockResolvedValue({
        ...inactiveIntegration,
        status: IntegrationStatus.ACTIVE,
        isHealthy: true,
      });

      const result = await service.activate('integration-123', 'org-123');

      expect(mockConnector.testConnection).toHaveBeenCalled();
      expect(result.status).toBe(IntegrationStatus.ACTIVE);
      expect(result.isHealthy).toBe(true);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'integration.activated',
        expect.objectContaining({ integrationId: 'integration-123' })
      );
    });

    it('should fail activation if connection test fails', async () => {
      const inactiveIntegration = {
        ...mockIntegration,
        status: IntegrationStatus.INACTIVE,
      };

      const mockConnector = {
        testConnection: jest.fn().mockResolvedValue({
          success: false,
          message: 'Authentication failed',
        }),
      };

      integrationRepository.findOne.mockResolvedValue(inactiveIntegration);
      connectorFactory.createConnector.mockResolvedValue(mockConnector);

      await expect(service.activate('integration-123', 'org-123')).rejects.toThrow(
        'Cannot activate integration: Authentication failed'
      );
    });

    it('should deactivate an integration', async () => {
      integrationRepository.findOne.mockResolvedValue(mockIntegration);
      integrationRepository.save.mockResolvedValue({
        ...mockIntegration,
        status: IntegrationStatus.INACTIVE,
      });

      const result = await service.deactivate('integration-123', 'org-123');

      expect(result.status).toBe(IntegrationStatus.INACTIVE);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'integration.deactivated',
        expect.objectContaining({ integrationId: 'integration-123' })
      );
    });
  });

  describe('getStats', () => {
    it('should calculate integration statistics', async () => {
      const logs = [
        { ...mockIntegrationLog, success: true, duration: 200 },
        { ...mockIntegrationLog, success: true, duration: 250 },
        { ...mockIntegrationLog, success: false, duration: 1000 },
      ];

      // Create a fresh copy to avoid test pollution
      const freshMockIntegration = { ...mockIntegration, stats: { ...mockIntegration.stats } };
      integrationRepository.findOne.mockResolvedValue(freshMockIntegration);
      logRepository.find.mockResolvedValue(logs);
      healthCheckService.getHealthHistory.mockResolvedValue([]);

      const result = await service.getStats('integration-123', 'org-123');

      expect(result.totalRequests).toBe(3);
      expect(result.successfulRequests).toBe(2);
      expect(result.failedRequests).toBe(1);
      expect(result.successRate).toBeCloseTo(66.67);
      expect(result.averageResponseTime).toBe(225); // Average of successful requests
    });

    it('should include health check status', async () => {
      // Create a fresh copy of mockIntegration to avoid test pollution
      const freshMockIntegration = {
        ...mockIntegration,
        isHealthy: true, // The service uses the integration's current health status
        stats: { ...mockIntegration.stats },
      };
      integrationRepository.findOne.mockResolvedValue(freshMockIntegration);
      logRepository.find.mockResolvedValue([]);

      const healthHistory = [{ timestamp: new Date(), isHealthy: true }];
      healthCheckService.getHealthHistory.mockResolvedValue(healthHistory);

      const result = await service.getStats('integration-123', 'org-123');

      // The service returns the integration's current health status and the latest health check timestamp
      expect(result.isHealthy).toBe(freshMockIntegration.isHealthy);
      expect(result.lastHealthCheck).toEqual(healthHistory[0].timestamp);
    });
  });

  describe('getLogs', () => {
    it('should return filtered logs', async () => {
      const filters = {
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-16'),
        logLevel: 'ERROR' as LogLevel,
        operationType: 'SYNC' as OperationType,
        success: false,
        limit: 50,
      };

      const mockQueryBuilder = logRepository.createQueryBuilder();
      mockQueryBuilder.getMany.mockResolvedValue([mockIntegrationLog]);

      integrationRepository.findOne.mockResolvedValue(mockIntegration);

      const result = await service.getLogs('integration-123', 'org-123', filters);

      expect(logRepository.createQueryBuilder).toHaveBeenCalledWith('log');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('log.integrationId = :integrationId', {
        integrationId: 'integration-123',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('log.timestamp >= :startDate', {
        startDate: filters.startDate,
      });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual([mockIntegrationLog]);
    });

    it('should apply default limit if not specified', async () => {
      const mockQueryBuilder = logRepository.createQueryBuilder();
      mockQueryBuilder.getMany.mockResolvedValue([]);

      integrationRepository.findOne.mockResolvedValue(mockIntegration);

      await service.getLogs('integration-123', 'org-123', {});

      expect(logRepository.createQueryBuilder).toHaveBeenCalledWith('log');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(100);
    });
  });

  describe('update', () => {
    it('should update integration configuration', async () => {
      const updateDto = {
        configuration: {
          ...mockIntegration.configuration,
          syncSettings: {
            ...mockIntegration.configuration.syncSettings,
            syncInterval: 600,
          },
        },
        tags: ['crm', 'sales', 'production', 'priority'],
      };

      integrationRepository.findOne.mockResolvedValue(mockIntegration);
      integrationRepository.save.mockResolvedValue({
        ...mockIntegration,
        ...updateDto,
      });

      const result = await service.update('integration-123', 'org-123', updateDto);

      expect(integrationRepository.save).toHaveBeenCalledWith({
        ...mockIntegration,
        ...updateDto,
      });
      expect(result.configuration.syncSettings?.syncInterval).toBe(600);
      expect(result.tags).toContain('priority');
    });

    it('should prevent status changes for error integrations', async () => {
      const errorIntegration = {
        ...mockIntegration,
        status: IntegrationStatus.ERROR,
      };

      integrationRepository.findOne.mockResolvedValue(errorIntegration);

      await expect(
        service.update('integration-123', 'org-123', {
          status: IntegrationStatus.ACTIVE,
        })
      ).rejects.toThrow(
        'Cannot change status of integration in ERROR state. Please test connection first.'
      );
    });
  });

  describe('delete', () => {
    it('should soft delete integration', async () => {
      integrationRepository.findOne.mockResolvedValue(mockIntegration);
      integrationRepository.softDelete.mockResolvedValue({ affected: 1 });

      await service.delete('integration-123', 'org-123');

      expect(integrationRepository.softDelete).toHaveBeenCalledWith('integration-123');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'integration.disconnected',
        expect.objectContaining({
          payload: expect.objectContaining({
            integrationId: 'integration-123',
            organizationId: 'org-123',
          }),
        })
      );
    });

    it('should throw error if integration not found', async () => {
      integrationRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('non-existent', 'org-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Event Emissions', () => {
    it('should emit events for integration lifecycle', async () => {
      const createDto = {
        organizationId: 'org-123',
        name: 'Event Test Integration',
        integrationType: IntegrationType.CRM,
        authType: AuthType.API_KEY,
        configuration: {
          apiUrl: 'https://api.example.com',
          apiKey: 'test-key',
        },
      };

      const mockConnector = {
        testConnection: jest.fn().mockResolvedValue({
          success: true,
          message: 'Connected',
        }),
      };

      integrationRepository.findOne.mockResolvedValue(null);
      integrationRepository.create.mockReturnValue(createDto);
      integrationRepository.save.mockResolvedValue({
        ...mockIntegration,
        ...createDto,
      });
      connectorFactory.createConnector.mockResolvedValue(mockConnector);

      await service.create(createDto);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'integration.connected',
        expect.objectContaining({
          payload: expect.objectContaining({
            integrationId: expect.any(String),
            organizationId: 'org-123',
          }),
        })
      );
    });
  });

  describe('Logging', () => {
    it('should log integration operations', async () => {
      const mockConnector = {
        testConnection: jest.fn().mockResolvedValue({
          success: true,
          message: 'Connected',
        }),
      };

      integrationRepository.findOne.mockResolvedValue(mockIntegration);
      connectorFactory.createConnector.mockResolvedValue(mockConnector);
      integrationRepository.save.mockResolvedValue(mockIntegration);
      logRepository.create.mockReturnValue(mockIntegrationLog);
      logRepository.save.mockResolvedValue(mockIntegrationLog);

      await service.testConnection('integration-123', 'org-123');

      expect(logRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          integrationId: 'integration-123',
          operationType: 'TEST_CONNECTION',
          success: true,
          message: 'Connected',
        })
      );
      expect(logRepository.save).toHaveBeenCalled();
    });
  });
});
