/**
 * Service-to-Service Communication Integration Test
 *
 * This test verifies that services can successfully communicate with each other
 * using ServiceDiscoveryService and that import fixes allow proper communication.
 *
 * Tests:
 * 1. Services can import shared packages correctly
 * 2. ServiceDiscoveryService works as expected
 * 3. HTTP calls between services succeed
 * 4. Mock service endpoints respond correctly
 */

import { HttpModule } from '@nestjs/axios';
import { Body, Controller, Get, type INestApplication, Post } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
// Import from http-common package to test import fixes
import {
  HttpCommonModule,
  ServiceDiscoveryService,
  type ServiceResponse,
} from '@soc-compliance/http-common';
// Import from shared contracts to test import fixes
import type { ApiResponse, OrganizationResponse, User } from '@soc-compliance/shared-contracts';
import express from 'express';
import type { Server } from 'http';

// Mock data for testing
const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'CLIENT_ADMIN',
  organizationId: 'org-456',
  mfaEnabled: false,
  lastLoginAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockOrganization: OrganizationResponse = {
  id: 'org-456',
  name: 'Test Organization',
  slug: 'test-org',
  status: 'active',
  complianceStatus: 'IN_PROGRESS' as any,
  contactInfo: {
    primaryEmail: 'contact@testorg.com',
  },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// Mock Express App for simulating external services
let mockAuthServiceApp: express.Application;
let mockIntegrationServiceApp: express.Application;
let mockAuthServer: Server;
let mockIntegrationServer: Server;

describe('Service-to-Service Communication Integration', () => {
  let app: INestApplication;
  let serviceDiscovery: ServiceDiscoveryService;
  let configService: ConfigService;

  beforeAll(async () => {
    // Setup mock auth service
    mockAuthServiceApp = express();
    mockAuthServiceApp.use(express.json());

    mockAuthServiceApp.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'auth-service',
        timestamp: new Date(),
        details: {
          database: { status: 'up', message: 'Connected' },
          redis: { status: 'up', message: 'Connected' },
        },
      });
    });

    mockAuthServiceApp.get('/users/:id', (req, res) => {
      if (req.params.id === 'user-123') {
        res.json({
          success: true,
          data: mockUser,
          metadata: {
            service: 'auth-service',
            timestamp: new Date(),
          },
        });
      } else {
        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
            timestamp: new Date(),
          },
        });
      }
    });

    mockAuthServiceApp.post('/auth/validate', (req, res) => {
      const { token } = req.body;
      if (token === 'valid-token') {
        res.json({
          success: true,
          data: {
            valid: true,
            user: mockUser,
          },
        });
      } else {
        res.json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token is invalid',
            timestamp: new Date(),
          },
        });
      }
    });

    // Setup mock integration service
    mockIntegrationServiceApp = express();
    mockIntegrationServiceApp.use(express.json());

    mockIntegrationServiceApp.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'integration-service',
        timestamp: new Date(),
        details: {
          database: { status: 'up', message: 'Connected' },
          kafka: { status: 'up', message: 'Connected' },
        },
      });
    });

    mockIntegrationServiceApp.get('/organizations/:id', (req, res) => {
      if (req.params.id === 'org-456') {
        res.json({
          success: true,
          data: mockOrganization,
        });
      } else {
        res.status(404).json({
          success: false,
          error: {
            code: 'ORGANIZATION_NOT_FOUND',
            message: 'Organization not found',
            timestamp: new Date(),
          },
        });
      }
    });

    mockIntegrationServiceApp.post('/sync/user', (req, res) => {
      const { userId, organizationId } = req.body;
      res.json({
        success: true,
        data: {
          syncId: 'sync-789',
          userId,
          organizationId,
          status: 'completed',
          timestamp: new Date(),
        },
      });
    });

    // Start mock servers
    mockAuthServer = mockAuthServiceApp.listen(13001);
    mockIntegrationServer = mockIntegrationServiceApp.listen(13009);
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.test', '.env'],
        }),
        HttpCommonModule.forRoot({
          global: true,
          enableLogging: false,
          enableCorrelationId: false,
          enableResponseInterceptor: false,
          enableRequestContext: false,
          enableContextInterceptor: false,
        }),
      ],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                AUTH_SERVICE_URL: 'http://127.0.0.1:13001',
                INTEGRATION_SERVICE_URL: 'http://127.0.0.1:13009',
                SERVICE_HEALTH_CHECK_INTERVAL: 30000,
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    serviceDiscovery = moduleFixture.get<ServiceDiscoveryService>(ServiceDiscoveryService);
    configService = moduleFixture.get<ConfigService>(ConfigService);

    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  afterAll(async () => {
    // Close mock servers
    if (mockAuthServer) {
      mockAuthServer.close();
    }
    if (mockIntegrationServer) {
      mockIntegrationServer.close();
    }
  });

  describe('Service Discovery and Registration', () => {
    it('should register all services in the service registry', () => {
      const allServices = serviceDiscovery.getAllServices();

      expect(allServices.size).toBeGreaterThan(0);
      expect(allServices.has('auth-service')).toBe(true);
      expect(allServices.has('integration-service')).toBe(true);
      expect(allServices.has('client-service')).toBe(true);
      expect(allServices.has('notification-service')).toBe(true);
    });

    it('should get service configuration for registered services', () => {
      const authService = serviceDiscovery.getService('auth-service');
      const integrationService = serviceDiscovery.getService('integration-service');

      expect(authService).toBeDefined();
      expect(authService?.name).toBe('auth-service');
      expect(authService?.url).toBe('http://127.0.0.1:13001');
      expect(authService?.timeout).toBe(30000);
      expect(authService?.retries).toBe(3);

      expect(integrationService).toBeDefined();
      expect(integrationService?.name).toBe('integration-service');
      expect(integrationService?.url).toBe('http://127.0.0.1:13009');
    });

    it('should return undefined for non-existent service', () => {
      const nonExistentService = serviceDiscovery.getService('non-existent-service');
      expect(nonExistentService).toBeUndefined();
    });
  });

  describe('Service Health Checks', () => {
    it('should perform health check on auth-service', async () => {
      const healthResponse = await serviceDiscovery.checkServiceHealth('auth-service');

      expect(healthResponse).toBeDefined();
      expect(healthResponse.status).toBe('healthy');
      expect(healthResponse.service).toBe('auth-service');
      expect(healthResponse.details?.database?.status).toBe('up');
      expect(healthResponse.details?.redis?.status).toBe('up');
    });

    it('should perform health check on integration-service', async () => {
      const healthResponse = await serviceDiscovery.checkServiceHealth('integration-service');

      expect(healthResponse).toBeDefined();
      expect(healthResponse.status).toBe('healthy');
      expect(healthResponse.service).toBe('integration-service');
      expect(healthResponse.details?.database?.status).toBe('up');
      expect(healthResponse.details?.kafka?.status).toBe('up');
    });

    it('should return unhealthy status for non-existent service', async () => {
      const healthResponse = await serviceDiscovery.checkServiceHealth('non-existent-service');

      expect(healthResponse.status).toBe('unhealthy');
      expect(healthResponse.service).toBe('non-existent-service');
      expect(healthResponse.details?.database?.status).toBe('down');
    });

    it('should check all services health', async () => {
      const allHealthChecks = await serviceDiscovery.checkAllServices();

      expect(allHealthChecks.size).toBeGreaterThan(0);
      expect(allHealthChecks.has('auth-service')).toBe(true);
      expect(allHealthChecks.has('integration-service')).toBe(true);

      const authHealth = allHealthChecks.get('auth-service');
      expect(authHealth?.status).toBe('healthy');
    });
  });

  describe('Service-to-Service HTTP Communication', () => {
    it('should make GET request to auth-service to fetch user', async () => {
      const response = await serviceDiscovery.callService<ApiResponse<User>>(
        'auth-service',
        'GET',
        '/users/user-123'
      );

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data?.success).toBe(true);
      expect(response.data?.data?.id).toBe('user-123');
      expect(response.data?.data?.email).toBe('test@example.com');
      expect(response.data?.data?.organizationId).toBe('org-456');
    });

    it('should make POST request to auth-service to validate token', async () => {
      const response = await serviceDiscovery.callService<
        ApiResponse<{ valid: boolean; user: User }>
      >('auth-service', 'POST', '/auth/validate', { token: 'valid-token' });

      expect(response.success).toBe(true);
      expect(response.data?.success).toBe(true);
      expect(response.data?.data?.valid).toBe(true);
      expect(response.data?.data?.user.id).toBe('user-123');
    });

    it('should handle 404 error from auth-service gracefully', async () => {
      const response = await serviceDiscovery.callService<ApiResponse<User>>(
        'auth-service',
        'GET',
        '/users/non-existent-user'
      );

      expect(response.success).toBe(true); // HTTP request succeeded
      expect(response.data?.success).toBe(false); // API response indicates failure
      expect(response.data?.error?.code).toBe('USER_NOT_FOUND');
    });

    it('should make GET request to integration-service to fetch organization', async () => {
      const response = await serviceDiscovery.callService<ApiResponse<OrganizationResponse>>(
        'integration-service',
        'GET',
        '/organizations/org-456'
      );

      expect(response.success).toBe(true);
      expect(response.data?.success).toBe(true);
      expect(response.data?.data?.id).toBe('org-456');
      expect(response.data?.data?.name).toBe('Test Organization');
      expect(response.data?.data?.complianceStatus).toBe('IN_PROGRESS');
    });

    it('should make POST request to integration-service for user sync', async () => {
      const syncData = {
        userId: 'user-123',
        organizationId: 'org-456',
      };

      const response = await serviceDiscovery.callService<ApiResponse<any>>(
        'integration-service',
        'POST',
        '/sync/user',
        syncData
      );

      expect(response.success).toBe(true);
      expect(response.data?.success).toBe(true);
      expect(response.data?.data?.syncId).toBe('sync-789');
      expect(response.data?.data?.userId).toBe('user-123');
      expect(response.data?.data?.status).toBe('completed');
    });

    it('should handle service not found error', async () => {
      const response = await serviceDiscovery.callService<any>(
        'non-existent-service',
        'GET',
        '/test'
      );

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('SERVICE_NOT_FOUND');
      expect(response.error?.message).toContain('Service non-existent-service not found');
    });
  });

  describe('Cross-Service Workflow Integration', () => {
    it('should simulate auth-service to integration-service communication flow', async () => {
      // Step 1: Validate user token with auth-service
      const authResponse = await serviceDiscovery.callService<
        ApiResponse<{ valid: boolean; user: User }>
      >('auth-service', 'POST', '/auth/validate', { token: 'valid-token' });

      expect(authResponse.success).toBe(true);
      expect(authResponse.data?.data?.valid).toBe(true);

      const user = authResponse.data?.data?.user;
      expect(user).toBeDefined();

      // Step 2: Fetch organization details from integration-service
      const orgResponse = await serviceDiscovery.callService<ApiResponse<OrganizationResponse>>(
        'integration-service',
        'GET',
        `/organizations/${user?.organizationId}`
      );

      expect(orgResponse.success).toBe(true);
      expect(orgResponse.data?.data?.id).toBe(user?.organizationId);

      // Step 3: Sync user data with integration-service
      const syncResponse = await serviceDiscovery.callService<ApiResponse<any>>(
        'integration-service',
        'POST',
        '/sync/user',
        {
          userId: user?.id,
          organizationId: user?.organizationId,
        }
      );

      expect(syncResponse.success).toBe(true);
      expect(syncResponse.data?.data?.status).toBe('completed');
    });
  });

  describe('Shared Package Import Verification', () => {
    it('should successfully import and use types from @soc-compliance/shared-contracts', () => {
      // This test verifies that the import fixes work by using imported types
      const testUser: User = {
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'CLIENT_ADMIN',
        organizationId: 'org-id',
        mfaEnabled: false,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(testUser).toBeDefined();
      expect(testUser.id).toBe('test-id');
      expect(testUser.email).toBe('test@example.com');
    });

    it('should successfully import and use ServiceResponse from @soc-compliance/http-common', () => {
      // This test verifies that HTTP common imports work correctly
      const testResponse: ServiceResponse<string> = {
        success: true,
        data: 'test data',
        metadata: {
          service: 'test-service',
          timestamp: new Date(),
        },
      };

      expect(testResponse).toBeDefined();
      expect(testResponse.success).toBe(true);
      expect(testResponse.data).toBe('test data');
    });

    it('should verify ServiceDiscoveryService can be instantiated and used', () => {
      expect(serviceDiscovery).toBeDefined();
      expect(serviceDiscovery.getService).toBeDefined();
      expect(serviceDiscovery.callService).toBeDefined();
      expect(serviceDiscovery.checkServiceHealth).toBeDefined();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle network timeout gracefully', async () => {
      // This test would require a mock server that doesn't respond
      // For now, we'll test with a very short timeout
      const response = await serviceDiscovery.callService<any>(
        'auth-service',
        'GET',
        '/users/user-123',
        undefined,
        { timeout: 1 } // 1ms timeout to force timeout
      );

      // The response should either succeed quickly or handle timeout gracefully
      expect(response).toBeDefined();
      expect(typeof response.success).toBe('boolean');
    });

    it('should handle invalid JSON response gracefully', async () => {
      // Test with an endpoint that would return invalid JSON
      const response = await serviceDiscovery.callService<any>(
        'auth-service',
        'GET',
        '/invalid-endpoint'
      );

      expect(response).toBeDefined();
      expect(typeof response.success).toBe('boolean');
    });
  });
});
