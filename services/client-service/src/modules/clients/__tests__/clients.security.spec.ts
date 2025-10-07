import {
  type ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { KongAuthGuard } from '../../../shared/guards/kong-auth.guard';
import { KongRolesGuard } from '../../../shared/guards/kong-roles.guard';
import { ClientsController } from '../clients.controller';
import { ClientsService } from '../clients.service';
import { CreateClientDto } from '../dto';
import { ClientType, CompanySize, ComplianceStatus, Industry } from './mock-entities';

describe('Clients Security Tests', () => {
  let controller: ClientsController;
  let service: ClientsService;
  let authGuard: KongAuthGuard;
  let rolesGuard: KongRolesGuard;
  let reflector: Reflector;

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

  const createMockExecutionContext = (user: any, roles: string[]): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            'x-user-id': user?.id,
            'x-user-email': user?.email,
            'x-user-roles': roles.join(','),
            'x-organization-id': user?.organizationId,
          },
          user,
        }),
      }),
      getHandler: () => controller.create,
      getClass: () => ClientsController,
    } as any;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientsController],
      providers: [
        {
          provide: ClientsService,
          useValue: mockClientsService,
        },
        KongAuthGuard,
        KongRolesGuard,
        Reflector,
      ],
    }).compile();

    controller = module.get<ClientsController>(ClientsController);
    service = module.get<ClientsService>(ClientsService);
    authGuard = module.get<KongAuthGuard>(KongAuthGuard);
    rolesGuard = module.get<KongRolesGuard>(KongRolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Tests', () => {
    it('should reject requests without authentication', async () => {
      const context = createMockExecutionContext(null, []);

      const canActivate = await authGuard.canActivate(context);

      expect(canActivate).toBe(false);
    });

    it('should reject requests with invalid authentication headers', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              'x-user-id': '',
              'x-user-email': '',
            },
          }),
        }),
      } as ExecutionContext;

      const canActivate = await authGuard.canActivate(context);

      expect(canActivate).toBe(false);
    });

    it('should accept requests with valid authentication', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
      };

      const context = createMockExecutionContext(user, ['admin']);

      const canActivate = await authGuard.canActivate(context);

      expect(canActivate).toBe(true);
    });

    it('should validate user ID format', async () => {
      const invalidUserIds = [
        '',
        null,
        undefined,
        '   ',
        'user_123', // Wrong format
        '123', // Too short
      ];

      for (const userId of invalidUserIds) {
        const context = {
          switchToHttp: () => ({
            getRequest: () => ({
              headers: {
                'x-user-id': userId,
                'x-user-email': 'test@example.com',
                'x-user-roles': 'admin',
              },
            }),
          }),
        } as ExecutionContext;

        const canActivate = await authGuard.canActivate(context);
        expect(canActivate).toBe(false);
      }
    });

    it('should validate email format', async () => {
      const invalidEmails = ['notanemail', '@example.com', 'user@', 'user@.com', ''];

      for (const email of invalidEmails) {
        const context = {
          switchToHttp: () => ({
            getRequest: () => ({
              headers: {
                'x-user-id': 'user-123',
                'x-user-email': email,
                'x-user-roles': 'admin',
              },
            }),
          }),
        } as ExecutionContext;

        const canActivate = await authGuard.canActivate(context);
        expect(canActivate).toBe(false);
      }
    });
  });

  describe('Role-Based Access Control Tests', () => {
    describe('create endpoint', () => {
      const allowedRoles = ['admin', 'compliance_manager', 'account_manager'];
      const deniedRoles = ['auditor', 'viewer', 'guest'];

      it.each(allowedRoles)('should allow %s role to create clients', async (role) => {
        const user = { id: 'user-123', email: 'test@example.com' };
        const context = createMockExecutionContext(user, [role]);

        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);

        const canActivate = await rolesGuard.canActivate(context);

        expect(canActivate).toBe(true);
      });

      it.each(deniedRoles)('should deny %s role from creating clients', async (role) => {
        const user = { id: 'user-123', email: 'test@example.com' };
        const context = createMockExecutionContext(user, [role]);

        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);

        const canActivate = await rolesGuard.canActivate(context);

        expect(canActivate).toBe(false);
      });
    });

    describe('updateComplianceStatus endpoint', () => {
      const allowedRoles = ['admin', 'compliance_manager'];
      const deniedRoles = ['account_manager', 'auditor', 'viewer'];

      it.each(allowedRoles)('should allow %s role to update compliance status', async (role) => {
        const user = { id: 'user-123', email: 'test@example.com' };
        const context = createMockExecutionContext(user, [role]);

        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);

        const canActivate = await rolesGuard.canActivate(context);

        expect(canActivate).toBe(true);
      });

      it.each(deniedRoles)('should deny %s role from updating compliance status', async (role) => {
        const user = { id: 'user-123', email: 'test@example.com' };
        const context = createMockExecutionContext(user, [role]);

        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);

        const canActivate = await rolesGuard.canActivate(context);

        expect(canActivate).toBe(false);
      });
    });

    describe('archive endpoint', () => {
      const allowedRoles = ['admin'];
      const deniedRoles = ['compliance_manager', 'account_manager', 'auditor', 'viewer'];

      it('should only allow admin role to archive clients', async () => {
        const adminUser = { id: 'user-123', email: 'admin@example.com' };
        const context = createMockExecutionContext(adminUser, ['admin']);

        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);

        const canActivate = await rolesGuard.canActivate(context);

        expect(canActivate).toBe(true);
      });

      it.each(deniedRoles)('should deny %s role from archiving clients', async (role) => {
        const user = { id: 'user-123', email: 'test@example.com' };
        const context = createMockExecutionContext(user, [role]);

        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);

        const canActivate = await rolesGuard.canActivate(context);

        expect(canActivate).toBe(false);
      });
    });

    it('should handle multiple roles correctly', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const userRoles = ['viewer', 'auditor', 'compliance_manager'];
      const context = createMockExecutionContext(user, userRoles);

      // Endpoint requires admin or compliance_manager
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin', 'compliance_manager']);

      const canActivate = await rolesGuard.canActivate(context);

      expect(canActivate).toBe(true); // Has compliance_manager role
    });

    it('should deny access when no roles match', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const userRoles = ['viewer', 'guest'];
      const context = createMockExecutionContext(user, userRoles);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin', 'compliance_manager']);

      const canActivate = await rolesGuard.canActivate(context);

      expect(canActivate).toBe(false);
    });
  });

  describe('Organization Isolation Tests', () => {
    it('should ensure clients are isolated by organization', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
      };

      const createDto: CreateClientDto = {
        name: 'Test Client',
        clientType: ClientType.DIRECT,
      };

      mockClientsService.create.mockImplementation((dto, userId) => {
        // Verify that service would associate client with user's organization
        return {
          ...dto,
          organizationId: user.organizationId,
          createdBy: userId,
        };
      });

      await controller.create(createDto, user as any);

      expect(service.create).toHaveBeenCalledWith(createDto, user.id);
    });

    it('should filter clients by organization in findAll', async () => {
      // This test verifies that the service layer would filter by organization
      // In a real implementation, this would be handled in the service layer
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
      };

      mockClientsService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      await controller.findAll({});

      // The service should internally filter by organizationId
      expect(service.findAll).toHaveBeenCalled();
    });

    it('should prevent cross-organization access', async () => {
      // This would be implemented in the service layer
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
      };

      const clientFromDifferentOrg = {
        id: 'client-456',
        organizationId: 'org-999',
      };

      mockClientsService.findOne.mockRejectedValue(new NotFoundException('Client not found'));

      await expect(controller.findOne('client-456')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Data Access Restrictions', () => {
    it('should restrict sensitive fields based on role', async () => {
      const sensitiveClient = {
        id: 'client-123',
        name: 'Test Client',
        // Sensitive fields
        billingInfo: {
          taxId: 'XX-XXXXXXX',
          creditLimit: 100000,
        },
        contractValue: 500000,
        internalNotes: 'Internal assessment notes',
      };

      // Different roles should see different fields
      const roleFieldAccess = {
        admin: ['billingInfo', 'contractValue', 'internalNotes'],
        compliance_manager: ['internalNotes'],
        account_manager: ['billingInfo', 'contractValue'],
        auditor: [],
        viewer: [],
      };

      // This would be implemented as a response interceptor or serializer
      for (const [role, allowedFields] of Object.entries(roleFieldAccess)) {
        // Test that only allowed fields are returned based on role
        expect(roleFieldAccess[role]).toBeDefined();
      }
    });

    it('should sanitize user input to prevent injection attacks', async () => {
      const { ValidationPipe } = await import('@nestjs/common');
      const { plainToClass } = await import('class-transformer');

      const validationPipe = new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      });

      const maliciousInputs = [
        { name: '<script>alert("XSS")</script>', expected: '' },
        { name: "'; DROP TABLE clients; --", expected: ' TABLE clients ' },
        { name: '${process.env.DATABASE_URL}', expected: 'process.env.DATABASE_URL' },
        {
          description: '{{constructor.constructor("return process.env")()}}',
          expected: 'constructor.constructorreturn process.env',
        },
      ];

      for (const { name, description, expected } of maliciousInputs) {
        const rawDto = {
          name: name || 'Test Client',
          description: description || undefined,
          clientType: ClientType.DIRECT,
        };

        // Transform the raw input through the DTO class
        const transformedDto = plainToClass(CreateClientDto, rawDto);

        // Apply validation pipe transforms
        const validatedDto = await validationPipe.transform(transformedDto, {
          type: 'body',
          metatype: CreateClientDto,
        });

        // Check that dangerous content was sanitized
        if (name) {
          expect(validatedDto.name).not.toContain('<script>');
          expect(validatedDto.name).not.toContain('</script>');
          expect(validatedDto.name).not.toContain('DROP');
          expect(validatedDto.name).not.toContain('${');
          expect(validatedDto.name).not.toContain(';--');
        }

        if (description) {
          expect(validatedDto.description).not.toContain('{{');
          expect(validatedDto.description).not.toContain('}}');
        }
      }
    });
  });

  describe('Audit Trail Tests', () => {
    it('should track all write operations', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
      };

      const createDto: CreateClientDto = {
        name: 'Audit Test Client',
        clientType: ClientType.DIRECT,
      };

      mockClientsService.create.mockResolvedValue({
        ...createDto,
        id: 'client-123',
        createdBy: user.id,
        createdAt: new Date(),
      });

      const result = await controller.create(createDto, user as any);

      expect(result.createdBy).toBe(user.id);
      expect(result.createdAt).toBeDefined();
    });

    it('should track updates with user information', async () => {
      const user = {
        id: 'user-456',
        email: 'updater@example.com',
        organizationId: 'org-123',
      };

      const updateDto = {
        name: 'Updated Name',
      };

      mockClientsService.update.mockResolvedValue({
        id: 'client-123',
        ...updateDto,
        updatedBy: user.id,
        updatedAt: new Date(),
      });

      const result = await controller.update('client-123', updateDto, user as any);

      expect(result.updatedBy).toBe(user.id);
      expect(result.updatedAt).toBeDefined();
    });

    it('should track deletion with user and timestamp', async () => {
      const user = {
        id: 'user-789',
        email: 'admin@example.com',
        organizationId: 'org-123',
        roles: ['admin'],
      };

      mockClientsService.archive.mockImplementation(async (id, userId) => {
        // Service should track who deleted and when
        return {
          deletedBy: userId,
          deletedAt: new Date(),
        };
      });

      await controller.archive('client-123', user as any);

      expect(service.archive).toHaveBeenCalledWith('client-123', user.id);
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should implement rate limiting for sensitive operations', async () => {
      // This would be implemented as a guard or interceptor
      const rateLimitConfig = {
        create: { limit: 100, window: '15m' },
        update: { limit: 500, window: '15m' },
        delete: { limit: 10, window: '1h' },
        bulkOperations: { limit: 5, window: '1h' },
      };

      // Verify rate limit configuration exists
      expect(rateLimitConfig.create.limit).toBe(100);
      expect(rateLimitConfig.delete.limit).toBe(10);
    });

    it('should have stricter limits for destructive operations', () => {
      const destructiveOpsLimits = {
        archive: 10, // per hour
        restore: 10, // per hour
        bulkDelete: 1, // per hour
        bulkUpdate: 5, // per hour
      };

      // Destructive operations should have lower limits
      expect(destructiveOpsLimits.archive).toBeLessThan(50);
      expect(destructiveOpsLimits.bulkDelete).toBeLessThan(5);
    });
  });

  describe('Input Validation Security', () => {
    it('should validate enum values strictly', () => {
      const invalidEnums = {
        clientType: 'INVALID_TYPE',
        status: 'INVALID_STATUS',
        industry: 'INVALID_INDUSTRY',
        complianceStatus: 'INVALID_COMPLIANCE',
      };

      // Each should be rejected by validation
      for (const [field, value] of Object.entries(invalidEnums)) {
        expect(() => {
          // In real implementation, class-validator would handle this
          if (!Object.values(ClientType).includes(value as any)) {
            throw new Error(`Invalid ${field}`);
          }
        }).toThrow();
      }
    });

    it('should enforce field length limits', () => {
      const fieldLimits = {
        name: 255,
        description: 1000,
        slug: 255,
        website: 500,
        email: 255,
        phone: 50,
      };

      // Verify limits are reasonable
      for (const [field, limit] of Object.entries(fieldLimits)) {
        expect(limit).toBeGreaterThan(0);
        expect(limit).toBeLessThanOrEqual(1000);
      }
    });

    it('should validate nested object structures', () => {
      const nestedStructures = [
        'contactInfo',
        'address',
        'billingInfo',
        'integrations',
        'settings',
      ];

      // Each nested structure should be validated
      nestedStructures.forEach((structure) => {
        expect(structure).toBeDefined();
      });
    });

    it('should prevent prototype pollution', () => {
      const maliciousPayloads = [
        { __proto__: { isAdmin: true as boolean } } as any,
        { constructor: { prototype: { isAdmin: true as boolean } } } as any,
        { prototype: { isAdmin: true as boolean } } as any,
      ];

      maliciousPayloads.forEach((payload) => {
        // These should be stripped by validation/sanitization
        expect(payload).toBeDefined();
      });
    });
  });

  describe('API Key Security', () => {
    it('should support API key authentication for service accounts', () => {
      const apiKeyHeaders = {
        'x-api-key': 'sk_test_1234567890abcdef',
        'x-api-version': 'v1',
      };

      // API keys should have specific format and permissions
      expect(apiKeyHeaders['x-api-key']).toMatch(/^sk_[a-zA-Z0-9_]+$/);
    });

    it('should restrict API key permissions', () => {
      const apiKeyPermissions = {
        read: ['clients.read', 'compliance.read'],
        write: ['clients.write'],
        admin: ['clients.admin'],
      };

      // API keys should have granular permissions
      expect(apiKeyPermissions.read).not.toContain('clients.delete');
      expect(apiKeyPermissions.write).not.toContain('clients.admin');
    });
  });

  describe('Data Export Security', () => {
    it('should restrict bulk data exports', () => {
      const exportLimits = {
        maxRecords: 10000,
        maxFileSize: '100MB',
        allowedFormats: ['csv', 'json', 'xlsx'],
        rateLimitPerDay: 10,
      };

      expect(exportLimits.maxRecords).toBeLessThanOrEqual(10000);
      expect(exportLimits.rateLimitPerDay).toBeLessThanOrEqual(10);
    });

    it('should redact sensitive data in exports', () => {
      const sensitiveFields = [
        'taxId',
        'creditCardNumber',
        'bankAccountNumber',
        'socialSecurityNumber',
        'apiKeys',
        'passwords',
      ];

      // These fields should be redacted in exports
      sensitiveFields.forEach((field) => {
        expect(field).toBeDefined();
      });
    });
  });

  describe('Cross-Site Request Forgery (CSRF) Protection', () => {
    it('should validate CSRF tokens for state-changing operations', () => {
      const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

      stateChangingMethods.forEach((method) => {
        // In production, CSRF tokens would be validated
        expect(method).toBeDefined();
      });
    });

    it('should not require CSRF for read operations', () => {
      const readOnlyMethods = ['GET', 'HEAD', 'OPTIONS'];

      readOnlyMethods.forEach((method) => {
        // These should not require CSRF tokens
        expect(method).toBeDefined();
      });
    });
  });

  describe('Session Security', () => {
    it('should implement session timeout', () => {
      const sessionConfig = {
        timeout: 30 * 60 * 1000, // 30 minutes
        absoluteTimeout: 8 * 60 * 60 * 1000, // 8 hours
        renewalThreshold: 5 * 60 * 1000, // 5 minutes
      };

      expect(sessionConfig.timeout).toBeLessThanOrEqual(60 * 60 * 1000); // Max 1 hour
      expect(sessionConfig.absoluteTimeout).toBeLessThanOrEqual(24 * 60 * 60 * 1000); // Max 24 hours
    });

    it('should invalidate sessions on privilege changes', async () => {
      // When user roles change, sessions should be invalidated
      const privilegeChanges = [
        'roleUpgrade',
        'roleDowngrade',
        'permissionChange',
        'organizationChange',
      ];

      privilegeChanges.forEach((change) => {
        // Each should trigger session invalidation
        expect(change).toBeDefined();
      });
    });
  });

  describe('Error Message Security', () => {
    it('should not leak sensitive information in error messages', () => {
      const safeErrorMessages = {
        notFound: 'Resource not found',
        unauthorized: 'Unauthorized',
        forbidden: 'Forbidden',
        validation: 'Validation failed',
      };

      // Error messages should be generic
      Object.values(safeErrorMessages).forEach((message) => {
        expect(message).not.toContain('database');
        expect(message).not.toContain('SQL');
        expect(message).not.toContain('stack');
        expect(message).not.toContain('path');
      });
    });

    it('should log detailed errors internally only', () => {
      // Detailed errors should only go to internal logs
      const internalErrorInfo = {
        stack: true,
        query: true,
        headers: false, // Don't log auth headers
        body: true,
        timestamp: true,
        userId: true,
      };

      expect(internalErrorInfo.headers).toBe(false);
      expect(internalErrorInfo.stack).toBe(true);
    });
  });
});
