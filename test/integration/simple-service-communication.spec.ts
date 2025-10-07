/**
 * Simple Service Communication Test
 *
 * This test verifies that shared packages can be imported and used correctly,
 * proving that our import fixes work as expected.
 */

import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

// Test shared package imports - this will fail if imports are broken
import {
  HttpClientService,
  ServiceDiscoveryService,
  type ServiceResponse,
} from '@soc-compliance/http-common';

import {
  type ApiResponse,
  ComplianceStatus,
  type OrganizationResponse,
  type User,
} from '@soc-compliance/shared-contracts';

describe('Simple Service Communication Test', () => {
  let serviceDiscovery: ServiceDiscoveryService;
  let httpClient: HttpClientService;
  let configService: ConfigService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        HttpModule.register({
          timeout: 5000,
          maxRedirects: 2,
        }),
      ],
      providers: [
        ServiceDiscoveryService,
        HttpClientService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                AUTH_SERVICE_URL: 'http://127.0.0.1:3001',
                INTEGRATION_SERVICE_URL: 'http://127.0.0.1:3009',
                CLIENT_SERVICE_URL: 'http://127.0.0.1:3002',
                SERVICE_HEALTH_CHECK_INTERVAL: 60000,
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    serviceDiscovery = module.get<ServiceDiscoveryService>(ServiceDiscoveryService);
    httpClient = module.get<HttpClientService>(HttpClientService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('Shared Package Import Verification', () => {
    it('should successfully import ServiceDiscoveryService from @soc-compliance/http-common', () => {
      expect(ServiceDiscoveryService).toBeDefined();
      expect(serviceDiscovery).toBeDefined();
      expect(serviceDiscovery.getService).toBeDefined();
      expect(serviceDiscovery.callService).toBeDefined();
      expect(serviceDiscovery.checkServiceHealth).toBeDefined();
    });

    it('should successfully import HttpClientService from @soc-compliance/http-common', () => {
      expect(HttpClientService).toBeDefined();
      expect(httpClient).toBeDefined();
      expect(httpClient.get).toBeDefined();
      expect(httpClient.post).toBeDefined();
      expect(httpClient.put).toBeDefined();
      expect(httpClient.delete).toBeDefined();
    });

    it('should successfully import types from @soc-compliance/shared-contracts', () => {
      // Create a mock user using imported types
      const mockUser: User = {
        id: 'test-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'CLIENT_ADMIN',
        organizationId: 'org-456',
        mfaEnabled: false,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(mockUser).toBeDefined();
      expect(mockUser.id).toBe('test-123');
      expect(mockUser.email).toBe('test@example.com');
      expect(mockUser.role).toBe('CLIENT_ADMIN');
    });

    it('should successfully use ComplianceStatus enum from shared contracts', () => {
      expect(ComplianceStatus.IN_PROGRESS).toBe('in_progress');
      expect(ComplianceStatus.COMPLIANT).toBe('compliant');
      expect(ComplianceStatus.NOT_STARTED).toBe('not_started');
    });

    it('should successfully create ServiceResponse objects', () => {
      const successResponse: ServiceResponse<string> = {
        success: true,
        data: 'test data',
        metadata: {
          service: 'test-service',
          timestamp: new Date(),
        },
      };

      const errorResponse: ServiceResponse<null> = {
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: 'This is a test error',
          timestamp: new Date(),
        },
      };

      expect(successResponse.success).toBe(true);
      expect(successResponse.data).toBe('test data');
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error?.code).toBe('TEST_ERROR');
    });

    it('should successfully create ApiResponse objects', () => {
      const apiResponse: ApiResponse<User> = {
        success: true,
        data: {
          id: 'user-123',
          email: 'user@example.com',
          name: 'API User',
          role: 'CLIENT_USER',
          organizationId: 'org-789',
          mfaEnabled: true,
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        metadata: {
          timestamp: new Date(),
          version: '1.0.0',
        },
      };

      expect(apiResponse.success).toBe(true);
      expect(apiResponse.data?.id).toBe('user-123');
      expect(apiResponse.data?.mfaEnabled).toBe(true);
    });
  });

  describe('Service Discovery Configuration', () => {
    it('should register services in the service registry', () => {
      const allServices = serviceDiscovery.getAllServices();

      expect(allServices.size).toBeGreaterThan(0);
      expect(allServices.has('auth-service')).toBe(true);
      expect(allServices.has('integration-service')).toBe(true);
      expect(allServices.has('client-service')).toBe(true);
      expect(allServices.has('notification-service')).toBe(true);
      expect(allServices.has('ai-service')).toBe(true);
    });

    it('should get service configuration correctly', () => {
      const authService = serviceDiscovery.getService('auth-service');
      const clientService = serviceDiscovery.getService('client-service');

      expect(authService).toBeDefined();
      expect(authService?.name).toBe('auth-service');
      expect(authService?.url).toContain('auth-service');
      expect(authService?.timeout).toBe(30000);
      expect(authService?.retries).toBe(3);

      expect(clientService).toBeDefined();
      expect(clientService?.name).toBe('client-service');
      expect(clientService?.url).toContain('client-service');
    });

    it('should return undefined for non-existent service', () => {
      const nonExistentService = serviceDiscovery.getService('non-existent-service');
      expect(nonExistentService).toBeUndefined();
    });
  });

  describe('Service Communication Methods', () => {
    it('should have callService method that returns ServiceResponse', async () => {
      const response = await serviceDiscovery.callService<any>(
        'non-existent-service',
        'GET',
        '/test'
      );

      expect(response).toBeDefined();
      expect(typeof response.success).toBe('boolean');
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('SERVICE_NOT_FOUND');
    });

    it('should validate HTTP methods in callService', async () => {
      // Test all supported HTTP methods
      const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

      for (const method of httpMethods) {
        const response = await serviceDiscovery.callService<any>(
          'non-existent-service',
          method,
          '/test',
          method === 'GET' || method === 'DELETE' ? undefined : { test: 'data' }
        );

        expect(response).toBeDefined();
        expect(response.success).toBe(false);
        expect(response.error?.code).toBe('SERVICE_NOT_FOUND');
      }
    });
  });

  describe('Type Safety and Interface Compliance', () => {
    it('should enforce proper OrganizationResponse structure', () => {
      const orgResponse: OrganizationResponse = {
        id: 'org-123',
        name: 'Test Organization',
        slug: 'test-org',
        status: 'active',
        complianceStatus: ComplianceStatus.IN_PROGRESS,
        contactInfo: {
          primaryEmail: 'contact@testorg.com',
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      expect(orgResponse.id).toBe('org-123');
      expect(orgResponse.complianceStatus).toBe('in_progress');
      expect(orgResponse.contactInfo.primaryEmail).toBe('contact@testorg.com');
    });

    it('should work with complex nested types', () => {
      const complexResponse: ApiResponse<{
        user: User;
        organization: OrganizationResponse;
        permissions: string[];
      }> = {
        success: true,
        data: {
          user: {
            id: 'user-456',
            email: 'complex@example.com',
            name: 'Complex User',
            role: 'ADMIN',
            organizationId: 'org-789',
            mfaEnabled: false,
            lastLoginAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          organization: {
            id: 'org-789',
            name: 'Complex Org',
            slug: 'complex-org',
            status: 'active',
            complianceStatus: ComplianceStatus.COMPLIANT,
            contactInfo: {
              primaryEmail: 'contact@complexorg.com',
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          permissions: ['read:users', 'write:users', 'admin:org'],
        },
      };

      expect(complexResponse.success).toBe(true);
      expect(complexResponse.data?.user.role).toBe('ADMIN');
      expect(complexResponse.data?.organization.complianceStatus).toBe('compliant');
      expect(complexResponse.data?.permissions).toContain('admin:org');
    });
  });

  describe('Error Handling and Validation', () => {
    it('should handle ServiceResponse error structure correctly', () => {
      const errorResponse: ServiceResponse<null> = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input provided',
          timestamp: new Date(),
          service: 'test-service',
        },
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error?.code).toBe('VALIDATION_ERROR');
      expect(errorResponse.error?.service).toBe('test-service');
      expect(errorResponse.data).toBeUndefined();
    });

    it('should validate import resolution works for all key modules', () => {
      // This test ensures that the import paths are working correctly
      // If any of these imports failed, the test file wouldn't even compile

      expect(ServiceDiscoveryService).toBeDefined();
      expect(HttpClientService).toBeDefined();
      expect(ComplianceStatus).toBeDefined();

      // Verify that enums are properly imported
      expect(typeof ComplianceStatus.IN_PROGRESS).toBe('string');
      expect(typeof ComplianceStatus.COMPLIANT).toBe('string');

      // Verify that interfaces can be used for type checking
      const testUser: User = {
        id: 'test',
        email: 'test@test.com',
        name: 'Test',
        role: 'CLIENT_USER',
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(testUser.id).toBe('test');
    });
  });
});
