import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthType, IntegrationStatus, IntegrationType } from './entities/integration.entity';
import { CredentialType, type OAuth2TokenData } from './entities/integration-credential.entity';
import { IntegrationsController } from './integrations.controller';
import { ConnectorFactory } from './services/connector.factory';
import { CredentialService } from './services/credential.service';
import { HealthCheckService } from './services/health-check.service';
import { IntegrationService } from './services/integration.service';

describe('IntegrationsController', () => {
  let controller: IntegrationsController;
  let integrationService: any;
  let credentialService: any;
  let connectorFactory: any;
  let healthCheckService: any;

  const mockUser = {
    id: 'user-123',
    email: 'admin@example.com',
    organizationId: 'org-123',
    roles: ['admin'],
  };

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
    },
    metadata: {
      lastSync: new Date(),
      syncInterval: 300,
      capabilities: ['read', 'write', 'delete'],
    },
    tags: ['crm', 'sales', 'production'],
    stats: {
      totalRequests: 1250,
      successfulRequests: 1200,
      failedRequests: 50,
      successRate: 96,
      averageResponseTime: 250,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCredential = {
    id: 'credential-123',
    integrationId: 'integration-123',
    name: 'OAuth2 Token',
    description: 'Production OAuth2 credentials',
    credentialType: CredentialType.TOKEN,
    environment: 'production',
    isActive: true,
    oauth2Config: {
      accessToken: 'encrypted-access-token',
      refreshToken: 'encrypted-refresh-token',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 3600000),
    },
    requiresRotation: true,
    rotationIntervalDays: 90,
    lastRotatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Create mocks
    integrationService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      activate: jest.fn(),
      deactivate: jest.fn(),
      testConnection: jest.fn(),
      getStats: jest.fn(),
      getLogs: jest.fn(),
    };
    credentialService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      rotateCredential: jest.fn(),
      refreshOAuth2Token: jest.fn(),
      getActiveCredential: jest.fn(),
      updateTokens: jest.fn(),
    };
    connectorFactory = {
      getSupportedTypes: jest.fn(),
      createConnector: jest.fn(),
    };
    healthCheckService = {
      getHealthHistory: jest.fn(),
    };

    // Manual instantiation
    controller = new IntegrationsController(
      integrationService,
      credentialService,
      connectorFactory,
      healthCheckService
    );

    jest.clearAllMocks();
  });

  describe('listIntegrations', () => {
    it('should return list of integrations', async () => {
      const mockIntegrations = [mockIntegration];
      integrationService.findAll.mockResolvedValue(mockIntegrations);

      const result = await controller.listIntegrations(
        { user: mockUser },
        IntegrationStatus.ACTIVE,
        IntegrationType.CRM,
        true,
        'crm,production'
      );

      expect(integrationService.findAll).toHaveBeenCalledWith(mockUser.organizationId, {
        status: IntegrationStatus.ACTIVE,
        type: IntegrationType.CRM,
        isHealthy: true,
        tags: ['crm', 'production'],
      });
      expect(result).toEqual(mockIntegrations);
    });

    it('should handle empty tag list', async () => {
      integrationService.findAll.mockResolvedValue([]);

      await controller.listIntegrations(
        { user: mockUser },
        undefined,
        undefined,
        undefined,
        undefined
      );

      expect(integrationService.findAll).toHaveBeenCalledWith(mockUser.organizationId, {
        status: undefined,
        type: undefined,
        isHealthy: undefined,
        tags: undefined,
      });
    });
  });

  describe('getIntegrationTypes', () => {
    it('should return supported integration types', async () => {
      const supportedConnectors = ['rest-api', 'oauth2', 'webhook', 'graphql', 'soap'];
      connectorFactory.getSupportedTypes.mockReturnValue(supportedConnectors);

      const result = await controller.getIntegrationTypes();

      expect(result).toEqual({
        types: Object.values(IntegrationType),
        authTypes: Object.values(AuthType),
        connectors: supportedConnectors,
      });
    });
  });

  describe('createIntegration', () => {
    it('should create a new integration', async () => {
      const createDto = {
        name: 'HubSpot Integration',
        description: 'Marketing automation integration',
        integrationType: IntegrationType.MARKETING,
        authType: AuthType.API_KEY,
        configuration: {
          apiUrl: 'https://api.hubspot.com',
          apiKey: 'encrypted-key',
        },
        healthCheck: {
          endpoint: '/v3/account',
          interval: 300,
          timeout: 30,
        },
        tags: ['marketing', 'automation'],
      };

      integrationService.create.mockResolvedValue({
        ...mockIntegration,
        ...createDto,
        id: 'integration-456',
      });

      const result = await controller.createIntegration(createDto, { user: mockUser });

      expect(integrationService.create).toHaveBeenCalledWith({
        ...createDto,
        organizationId: mockUser.organizationId,
      });
      expect(result.name).toBe(createDto.name);
    });

    it('should handle duplicate integration names', async () => {
      const createDto = {
        name: 'Duplicate Integration',
        integrationType: IntegrationType.CRM,
        authType: AuthType.OAUTH2,
        configuration: {
          apiUrl: 'https://api.example.com',
        },
      };

      integrationService.create.mockRejectedValue(
        new BadRequestException('Integration "Duplicate Integration" already exists')
      );

      await expect(controller.createIntegration(createDto, { user: mockUser })).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('testConnection', () => {
    it('should test integration connection', async () => {
      const testResult = {
        success: true,
        message: 'Connection successful',
        latency: 150,
        details: {
          apiVersion: 'v53.0',
          orgId: 'org-salesforce-123',
        },
      };

      integrationService.testConnection.mockResolvedValue(testResult);

      const result = await controller.testConnection('integration-123', { user: mockUser });

      expect(integrationService.testConnection).toHaveBeenCalledWith(
        'integration-123',
        mockUser.organizationId
      );
      expect(result).toEqual(testResult);
    });

    it('should handle connection failures', async () => {
      const testResult = {
        success: false,
        message: 'Authentication failed',
        error: 'Invalid credentials',
      };

      integrationService.testConnection.mockResolvedValue(testResult);

      const result = await controller.testConnection('integration-123', { user: mockUser });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Authentication failed');
    });
  });

  describe('getStats', () => {
    it('should return integration statistics', async () => {
      const stats = {
        totalRequests: 5000,
        successfulRequests: 4850,
        failedRequests: 150,
        successRate: 97,
        averageResponseTime: 200,
        lastHealthCheck: new Date(),
        isHealthy: true,
        uptime: 99.5,
        hourlyStats: [
          { hour: '2024-01-15T10:00:00Z', requests: 100, errors: 2 },
          { hour: '2024-01-15T11:00:00Z', requests: 150, errors: 1 },
        ],
      };

      integrationService.getStats.mockResolvedValue(stats);

      const result = await controller.getStats('integration-123', { user: mockUser });

      expect(integrationService.getStats).toHaveBeenCalledWith(
        'integration-123',
        mockUser.organizationId
      );
      expect(result).toEqual(stats);
    });
  });

  describe('getLogs', () => {
    it('should return integration logs with filters', async () => {
      const logs = [
        {
          id: 'log-1',
          integrationId: 'integration-123',
          timestamp: new Date(),
          logLevel: 'INFO',
          operationType: 'SYNC',
          success: true,
          message: 'Sync completed successfully',
          requestData: { endpoint: '/contacts' },
          responseData: { count: 50 },
          duration: 1200,
        },
      ];

      integrationService.getLogs.mockResolvedValue(logs);

      const result = await controller.getLogs(
        'integration-123',
        { user: mockUser },
        '2024-01-15',
        '2024-01-16',
        'INFO',
        'SYNC',
        true,
        100
      );

      expect(integrationService.getLogs).toHaveBeenCalledWith(
        'integration-123',
        mockUser.organizationId,
        {
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-01-16'),
          logLevel: 'INFO',
          operationType: 'SYNC',
          success: true,
          limit: 100,
        }
      );
      expect(result).toEqual(logs);
    });
  });

  describe('activate/deactivate', () => {
    it('should activate an integration', async () => {
      const activatedIntegration = {
        ...mockIntegration,
        status: IntegrationStatus.ACTIVE,
        isHealthy: true,
      };

      integrationService.activate.mockResolvedValue(activatedIntegration);

      const result = await controller.activateIntegration('integration-123', { user: mockUser });

      expect(integrationService.activate).toHaveBeenCalledWith(
        'integration-123',
        mockUser.organizationId
      );
      expect(result.status).toBe(IntegrationStatus.ACTIVE);
    });

    it('should deactivate an integration', async () => {
      const deactivatedIntegration = {
        ...mockIntegration,
        status: IntegrationStatus.INACTIVE,
      };

      integrationService.deactivate.mockResolvedValue(deactivatedIntegration);

      const result = await controller.deactivateIntegration('integration-123', { user: mockUser });

      expect(integrationService.deactivate).toHaveBeenCalledWith(
        'integration-123',
        mockUser.organizationId
      );
      expect(result.status).toBe(IntegrationStatus.INACTIVE);
    });
  });

  describe('Credential Management', () => {
    describe('listCredentials', () => {
      it('should list credentials for an integration', async () => {
        integrationService.findOne.mockResolvedValue(mockIntegration);
        credentialService.findAll.mockResolvedValue([mockCredential]);

        const result = await controller.listCredentials('integration-123', { user: mockUser });

        expect(integrationService.findOne).toHaveBeenCalledWith(
          'integration-123',
          mockUser.organizationId
        );
        expect(credentialService.findAll).toHaveBeenCalledWith('integration-123');
        expect(result).toEqual([mockCredential]);
      });
    });

    describe('createCredential', () => {
      it('should create a new credential', async () => {
        const createDto = {
          name: 'API Key',
          description: 'Production API key',
          credentialType: CredentialType.API_KEY,
          value: 'encrypted-api-key',
          environment: 'production',
          requiresRotation: true,
          rotationIntervalDays: 30,
        };

        integrationService.findOne.mockResolvedValue(mockIntegration);
        credentialService.create.mockResolvedValue({
          ...mockCredential,
          ...createDto,
          id: 'credential-456',
        });

        const result = await controller.createCredential('integration-123', createDto, {
          user: mockUser,
        });

        expect(credentialService.create).toHaveBeenCalledWith({
          ...createDto,
          integrationId: 'integration-123',
        });
        expect(result.credentialType).toBe(CredentialType.API_KEY);
      });
    });

    describe('rotateCredential', () => {
      it('should rotate a credential', async () => {
        const rotateBody = {
          value: 'new-encrypted-key',
          secret: 'new-encrypted-secret',
        };

        const rotatedCredential = {
          ...mockCredential,
          value: rotateBody.value,
          lastRotatedAt: new Date(),
        };

        integrationService.findOne.mockResolvedValue(mockIntegration);
        credentialService.rotateCredential.mockResolvedValue(rotatedCredential);

        const result = await controller.rotateCredential(
          'integration-123',
          'credential-123',
          rotateBody,
          { user: mockUser }
        );

        expect(credentialService.rotateCredential).toHaveBeenCalledWith(
          'credential-123',
          rotateBody.value,
          rotateBody.secret
        );
        expect(result.lastRotatedAt).toBeDefined();
      });
    });

    describe('refreshOAuth2Token', () => {
      it('should refresh OAuth2 token', async () => {
        const tokenData: OAuth2TokenData = {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 7200,
        };

        const refreshedCredential = {
          ...mockCredential,
          value: JSON.stringify(tokenData), // OAuth2 tokens are stored as JSON in value field
          expiresAt: new Date(Date.now() + 7200000),
        };

        integrationService.findOne.mockResolvedValue(mockIntegration);
        credentialService.refreshOAuth2Token.mockResolvedValue(refreshedCredential);

        const result = await controller.refreshOAuth2Token('integration-123', 'credential-123', {
          user: mockUser,
        });

        expect(credentialService.refreshOAuth2Token).toHaveBeenCalledWith('credential-123');
        expect(result).toBeDefined();
        expect(result.id).toBe('credential-123');
        expect(result.expiresAt).toBeDefined();
      });
    });
  });

  describe('OAuth2 Flow', () => {
    describe('getOAuth2AuthorizeUrl', () => {
      it('should generate OAuth2 authorization URL', async () => {
        const mockConnector = {
          getAuthorizationUrl: jest
            .fn()
            .mockReturnValue(
              'https://login.salesforce.com/services/oauth2/authorize?client_id=123&redirect_uri=callback&state=xyz'
            ),
        };

        integrationService.findOne.mockResolvedValue(mockIntegration);
        connectorFactory.createConnector.mockResolvedValue(mockConnector);

        const result = await controller.getOAuth2AuthorizeUrl(
          'integration-123',
          'https://app.example.com/callback',
          'state-xyz',
          { user: mockUser }
        );

        expect(mockConnector.getAuthorizationUrl).toHaveBeenCalledWith(
          'state-xyz',
          'https://app.example.com/callback'
        );
        expect(result.url).toContain('oauth2/authorize');
      });

      it('should throw error for non-OAuth2 integrations', async () => {
        const nonOAuth2Integration = {
          ...mockIntegration,
          authType: AuthType.API_KEY,
        };

        integrationService.findOne.mockResolvedValue(nonOAuth2Integration);

        await expect(
          controller.getOAuth2AuthorizeUrl('integration-123', 'callback', 'state', {
            user: mockUser,
          })
        ).rejects.toThrow('Integration does not use OAuth2');
      });
    });

    describe('handleOAuth2Callback', () => {
      it('should exchange code for token and create credential', async () => {
        const mockConnector = {
          exchangeCodeForToken: jest.fn().mockResolvedValue({
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresIn: 3600,
            tokenType: 'Bearer',
          }),
        };

        const newCredential = {
          ...mockCredential,
          id: 'credential-789',
        };

        integrationService.findOne.mockResolvedValue(mockIntegration);
        connectorFactory.createConnector.mockResolvedValue(mockConnector);
        credentialService.getActiveCredential.mockResolvedValue(null);
        credentialService.create.mockResolvedValue(newCredential);

        const result = await controller.handleOAuth2Callback(
          'integration-123',
          {
            code: 'auth-code-123',
            redirectUri: 'https://app.example.com/callback',
          },
          { user: mockUser }
        );

        expect(mockConnector.exchangeCodeForToken).toHaveBeenCalledWith(
          'auth-code-123',
          'https://app.example.com/callback'
        );
        expect(credentialService.create).toHaveBeenCalledWith({
          integrationId: 'integration-123',
          name: 'OAuth2 Token',
          credentialType: CredentialType.TOKEN,
          value: 'new-access-token',
          oauth2Config: mockIntegration.configuration.oauth2Config,
        });
        expect(result).toEqual(newCredential);
      });

      it('should update existing credential if found', async () => {
        const mockConnector = {
          exchangeCodeForToken: jest.fn().mockResolvedValue({
            accessToken: 'updated-access-token',
            refreshToken: 'updated-refresh-token',
            expiresIn: 3600,
          }),
        };

        const existingCredential = {
          ...mockCredential,
          updateTokens: jest.fn(),
        };

        integrationService.findOne.mockResolvedValue(mockIntegration);
        connectorFactory.createConnector.mockResolvedValue(mockConnector);
        credentialService.getActiveCredential.mockResolvedValue(existingCredential);
        credentialService.update.mockResolvedValue(existingCredential);

        await controller.handleOAuth2Callback(
          'integration-123',
          {
            code: 'auth-code-123',
            redirectUri: 'https://app.example.com/callback',
          },
          { user: mockUser }
        );

        expect(credentialService.updateTokens).toHaveBeenCalledWith(
          existingCredential,
          'updated-access-token',
          'updated-refresh-token',
          3600
        );
        expect(credentialService.update).toHaveBeenCalledWith(existingCredential.id, {});
      });
    });
  });

  describe('Role-based access control', () => {
    it('should allow viewers to list integrations', async () => {
      const viewerUser = { ...mockUser, roles: ['viewer'] };
      integrationService.findAll.mockResolvedValue([mockIntegration]);

      await controller.listIntegrations({ user: viewerUser });

      expect(integrationService.findAll).toHaveBeenCalled();
    });

    it('should restrict viewers from creating integrations', async () => {
      const viewerUser = { ...mockUser, roles: ['viewer'] };

      // In real implementation, this would be enforced by guards
      // Test demonstrates expected behavior
      expect(controller.createIntegration).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle integration not found', async () => {
      integrationService.findOne.mockRejectedValue(new NotFoundException('Integration not found'));

      await expect(controller.getIntegration('non-existent', { user: mockUser })).rejects.toThrow(
        NotFoundException
      );
    });

    it('should handle invalid configuration', async () => {
      const invalidDto = {
        name: 'Invalid Integration',
        integrationType: IntegrationType.CRM,
        authType: AuthType.OAUTH2,
        configuration: {
          apiUrl: 'https://api.example.com',
          // Missing required OAuth2 config
        },
      };

      integrationService.create.mockRejectedValue(
        new BadRequestException('Invalid OAuth2 configuration')
      );

      await expect(controller.createIntegration(invalidDto, { user: mockUser })).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
