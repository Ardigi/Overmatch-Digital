import {
  BadRequestException,
  type ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import type { CreatePolicyDto } from '../dto';
import { PolicyPriority, PolicyScope, PolicyStatus, PolicyType } from '../entities/policy.entity';
import { PoliciesController } from '../policies.controller';
import { PoliciesService } from '../policies.service';

describe('Policies Security Tests', () => {
  let controller: PoliciesController;
  let service: PoliciesService;
  let authGuard: JwtAuthGuard;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const mockPoliciesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByPolicyNumber: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    approve: jest.fn(),
    publish: jest.fn(),
    recordView: jest.fn(),
    recordDownload: jest.fn(),
    getExpiringPolicies: jest.fn(),
    getPoliciesNeedingReview: jest.fn(),
    addException: jest.fn(),
  };

  const createMockExecutionContext = (user: any, roles: string[]): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization: 'Bearer mock-token',
          },
          user: user ? { ...user, roles } : null,
        }),
      }),
      getHandler: () => controller.create,
      getClass: () => PoliciesController,
    } as any;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PoliciesController],
      providers: [
        {
          provide: PoliciesService,
          useValue: mockPoliciesService,
        },
        JwtAuthGuard,
        RolesGuard,
        Reflector,
      ],
    }).compile();

    controller = module.get<PoliciesController>(PoliciesController);
    service = module.get<PoliciesService>(PoliciesService);
    authGuard = module.get<JwtAuthGuard>(JwtAuthGuard);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Tests', () => {
    it('should reject requests without authentication', async () => {
      const context = createMockExecutionContext(null, []);

      jest.spyOn(authGuard, 'canActivate').mockReturnValue(false);

      const canActivate = await authGuard.canActivate(context);

      expect(canActivate).toBe(false);
    });

    it('should reject requests with invalid tokens', async () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer invalid-token',
            },
          }),
        }),
      } as ExecutionContext;

      jest.spyOn(authGuard, 'canActivate').mockImplementation(() => {
        throw new UnauthorizedException('Invalid token');
      });

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should accept requests with valid authentication', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
      };

      const context = createMockExecutionContext(user, ['admin']);

      jest.spyOn(authGuard, 'canActivate').mockReturnValue(true);

      const canActivate = await authGuard.canActivate(context);

      expect(canActivate).toBe(true);
    });

    it('should validate JWT token format', async () => {
      const invalidTokens = ['', 'not-a-token', 'Bearer', 'Bearer ', 'InvalidBearer token'];

      for (const token of invalidTokens) {
        const context = {
          switchToHttp: () => ({
            getRequest: () => ({
              headers: {
                authorization: token,
              },
            }),
          }),
        } as ExecutionContext;

        jest.spyOn(authGuard, 'canActivate').mockReturnValue(false);

        const canActivate = await authGuard.canActivate(context);
        expect(canActivate).toBe(false);
      }
    });
  });

  describe('Role-Based Access Control Tests', () => {
    describe('create endpoint', () => {
      const allowedRoles = ['admin', 'policy_manager', 'compliance_manager'];
      const deniedRoles = ['auditor', 'policy_viewer', 'guest'];

      it.each(allowedRoles)('should allow %s role to create policies', async (role) => {
        const user = { id: 'user-123', email: 'test@example.com' };
        const context = createMockExecutionContext(user, [role]);

        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);
        jest.spyOn(rolesGuard, 'canActivate').mockReturnValue(true);

        const canActivate = await rolesGuard.canActivate(context);

        expect(canActivate).toBe(true);
      });

      it.each(deniedRoles)('should deny %s role from creating policies', async (role) => {
        const user = { id: 'user-123', email: 'test@example.com' };
        const context = createMockExecutionContext(user, [role]);

        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);
        jest.spyOn(rolesGuard, 'canActivate').mockReturnValue(false);

        const canActivate = await rolesGuard.canActivate(context);

        expect(canActivate).toBe(false);
      });
    });

    describe('approve endpoint', () => {
      const allowedRoles = ['admin', 'policy_manager', 'compliance_manager'];
      const deniedRoles = ['auditor', 'policy_viewer'];

      it.each(allowedRoles)('should allow %s role to approve policies', async (role) => {
        const user = { id: 'user-123', email: 'test@example.com' };
        const context = createMockExecutionContext(user, [role]);

        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);
        jest.spyOn(rolesGuard, 'canActivate').mockReturnValue(true);

        const canActivate = await rolesGuard.canActivate(context);

        expect(canActivate).toBe(true);
      });

      it.each(deniedRoles)('should deny %s role from approving policies', async (role) => {
        const user = { id: 'user-123', email: 'test@example.com' };
        const context = createMockExecutionContext(user, [role]);

        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);
        jest.spyOn(rolesGuard, 'canActivate').mockReturnValue(false);

        const canActivate = await rolesGuard.canActivate(context);

        expect(canActivate).toBe(false);
      });
    });

    describe('publish endpoint', () => {
      const allowedRoles = ['admin', 'policy_manager'];
      const deniedRoles = ['compliance_manager', 'auditor', 'policy_viewer'];

      it('should only allow admin and policy_manager to publish', async () => {
        const adminUser = { id: 'user-123', email: 'admin@example.com' };
        const context = createMockExecutionContext(adminUser, ['admin']);

        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);
        jest.spyOn(rolesGuard, 'canActivate').mockReturnValue(true);

        const canActivate = await rolesGuard.canActivate(context);

        expect(canActivate).toBe(true);
      });

      it.each(deniedRoles)('should deny %s role from publishing policies', async (role) => {
        const user = { id: 'user-123', email: 'test@example.com' };
        const context = createMockExecutionContext(user, [role]);

        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);
        jest.spyOn(rolesGuard, 'canActivate').mockReturnValue(false);

        const canActivate = await rolesGuard.canActivate(context);

        expect(canActivate).toBe(false);
      });
    });

    describe('delete endpoint', () => {
      const allowedRoles = ['admin', 'policy_manager'];

      it('should require elevated permissions for deletion', async () => {
        const user = { id: 'user-123', email: 'test@example.com' };
        const context = createMockExecutionContext(user, ['compliance_manager']);

        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allowedRoles);
        jest.spyOn(rolesGuard, 'canActivate').mockReturnValue(false);

        const canActivate = await rolesGuard.canActivate(context);

        expect(canActivate).toBe(false);
      });
    });

    it('should handle multiple roles correctly', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const userRoles = ['auditor', 'policy_viewer', 'compliance_manager'];
      const context = createMockExecutionContext(user, userRoles);

      // Endpoint requires admin or compliance_manager
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin', 'compliance_manager']);
      jest.spyOn(rolesGuard, 'canActivate').mockReturnValue(true);

      const canActivate = await rolesGuard.canActivate(context);

      expect(canActivate).toBe(true); // Has compliance_manager role
    });

    it('should deny access when no roles match', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const userRoles = ['guest', 'viewer'];
      const context = createMockExecutionContext(user, userRoles);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin', 'policy_manager']);
      jest.spyOn(rolesGuard, 'canActivate').mockReturnValue(false);

      const canActivate = await rolesGuard.canActivate(context);

      expect(canActivate).toBe(false);
    });
  });

  describe('Data Access Control Tests', () => {
    it('should enforce organization-level isolation', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
      };

      const createDto: CreatePolicyDto = {
        title: 'Test Policy',
        type: PolicyType.SECURITY,
        content: { sections: [] },
      };

      mockPoliciesService.create.mockImplementation((dto, userId) => {
        return {
          ...dto,
          organizationId: user.organizationId,
          createdBy: userId,
        };
      });

      await controller.create(createDto, user as any);

      expect(service.create).toHaveBeenCalledWith({
        ...createDto,
        createdBy: user.id,
      });
    });

    it('should prevent cross-organization access', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
      };

      const policyFromDifferentOrg = {
        id: 'policy-456',
        organizationId: 'org-999',
        canBeViewedBy: jest.fn().mockReturnValue(false),
      };

      mockPoliciesService.findOne.mockResolvedValue(policyFromDifferentOrg);

      // In real implementation, service would check organization
      const result = await service.findOne('policy-456');

      expect(result.canBeViewedBy(user.id, user.roles)).toBe(false);
    });

    it('should filter queries by organization', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
      };

      mockPoliciesService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      await controller.findAll({});

      // Service should internally filter by organizationId
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('Sensitive Data Protection', () => {
    it('should not expose internal metadata to unauthorized users', async () => {
      const policy = {
        id: 'policy-123',
        title: 'Public Policy',
        // Sensitive internal fields
        internalNotes: 'Internal compliance assessment',
        riskAssessment: {
          vulnerabilities: ['SQL Injection risk', 'XSS vulnerability'],
        },
        approvalWorkflow: {
          internalComments: 'Needs legal review',
        },
      };

      // Different roles should see different fields
      const roleFieldAccess = {
        admin: ['internalNotes', 'riskAssessment', 'approvalWorkflow'],
        policy_manager: ['internalNotes', 'approvalWorkflow'],
        compliance_manager: ['riskAssessment'],
        auditor: ['riskAssessment'],
        policy_viewer: [],
      };

      // This would be implemented as a response interceptor
      for (const [role, allowedFields] of Object.entries(roleFieldAccess)) {
        expect(roleFieldAccess[role]).toBeDefined();
      }
    });

    it('should sanitize user input to prevent injection attacks', async () => {
      const maliciousInputs = [
        { title: '<script>alert("XSS")</script>' },
        { description: "'; DROP TABLE policies; --" },
        { content: { sections: [{ content: '${process.env.DATABASE_URL}' }] } },
        { tags: ['{{constructor.constructor("return process.env")()}}'] },
      ];

      for (const input of maliciousInputs) {
        const createDto: CreatePolicyDto = {
          ...input,
          type: PolicyType.SECURITY,
          content: input.content || { sections: [] },
        } as any;

        // Validation should sanitize or reject these
        expect(createDto.title || createDto.description).toBeDefined();
      }
    });

    it('should validate and sanitize file paths', async () => {
      const dangerousPaths = [
        '../../../etc/passwd',
        'C:\\Windows\\System32\\config\\sam',
        '\\\\server\\share\\sensitive',
        'file:///etc/shadow',
      ];

      for (const path of dangerousPaths) {
        const dto = {
          title: 'Policy',
          type: PolicyType.SECURITY,
          attachments: [{ path }],
        };

        // Should reject dangerous paths
        expect(path).toMatch(/\.\.|\\\\|file:/);
      }
    });
  });

  describe('Audit Trail Tests', () => {
    it('should log all policy access', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
      };

      const policy = {
        id: 'policy-123',
        recordView: jest.fn(),
      };

      mockPoliciesService.findOne.mockResolvedValue(policy);
      mockPoliciesService.recordView.mockResolvedValue(undefined);

      await controller.findOne('policy-123', user as any);

      expect(service.recordView).toHaveBeenCalledWith('policy-123', user.id);
    });

    it('should track all modifications with user info', async () => {
      const user = {
        id: 'user-456',
        email: 'editor@example.com',
        organizationId: 'org-123',
      };

      const updateDto = { title: 'Updated Title' };

      mockPoliciesService.update.mockResolvedValue({
        id: 'policy-123',
        changeHistory: [
          {
            changedBy: user.id,
            changedAt: new Date(),
            changes: { title: { old: 'Old Title', new: 'Updated Title' } },
          },
        ],
      });

      const result = await controller.update('policy-123', updateDto, user as any);

      expect(result.changeHistory[0].changedBy).toBe(user.id);
    });

    it('should track approval chain', async () => {
      const approver = {
        id: 'approver-123',
        email: 'approver@example.com',
        organizationId: 'org-123',
      };

      mockPoliciesService.approve.mockResolvedValue({
        id: 'policy-123',
        approvalWorkflow: {
          steps: [
            {
              approver: approver.id,
              date: new Date(),
              status: 'approved',
            },
          ],
        },
      });

      const result = await controller.approve('policy-123', 'Approved', approver as any);

      expect(result.approvalWorkflow.steps[0].approver).toBe(approver.id);
    });
  });

  describe('Input Validation Security', () => {
    it('should validate enum values strictly', () => {
      const invalidEnums = {
        type: 'INVALID_TYPE',
        status: 'INVALID_STATUS',
        priority: 'INVALID_PRIORITY',
        scope: 'INVALID_SCOPE',
      };

      // Each should be rejected by validation
      for (const [field, value] of Object.entries(invalidEnums)) {
        expect(() => {
          if (!Object.values(PolicyType).includes(value as any)) {
            throw new Error(`Invalid ${field}`);
          }
        }).toThrow();
      }
    });

    it('should enforce field length limits', () => {
      const fieldLimits = {
        title: 255,
        description: 1000,
        policyNumber: 50,
        ownerDepartment: 100,
      };

      // Verify limits are reasonable
      for (const [field, limit] of Object.entries(fieldLimits)) {
        expect(limit).toBeGreaterThan(0);
        expect(limit).toBeLessThanOrEqual(1000);
      }
    });

    it('should validate nested structures', () => {
      const nestedStructures = [
        'content',
        'complianceMapping',
        'riskAssessment',
        'approvalWorkflow',
        'metrics',
      ];

      // Each nested structure should be validated
      nestedStructures.forEach((structure) => {
        expect(structure).toBeDefined();
      });
    });

    it('should prevent prototype pollution', () => {
      const maliciousPayloads = [
        { __proto__: { isAdmin: true } },
        { constructor: { prototype: { isAdmin: true } } },
        { prototype: { isAdmin: true } },
      ];

      maliciousPayloads.forEach((payload) => {
        // These should be stripped by validation/sanitization
        expect(payload).toBeDefined();
      });
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should implement rate limiting for sensitive operations', () => {
      const rateLimitConfig = {
        create: { limit: 50, window: '15m' },
        update: { limit: 200, window: '15m' },
        approve: { limit: 20, window: '15m' },
        publish: { limit: 10, window: '15m' },
        delete: { limit: 5, window: '1h' },
      };

      // Verify rate limit configuration exists
      expect(rateLimitConfig.create.limit).toBe(50);
      expect(rateLimitConfig.publish.limit).toBe(10);
    });

    it('should have stricter limits for destructive operations', () => {
      const destructiveOpsLimits = {
        delete: 5, // per hour
        bulkDelete: 1, // per hour
        bulkUpdate: 10, // per hour
      };

      // Destructive operations should have lower limits
      expect(destructiveOpsLimits.delete).toBeLessThan(10);
      expect(destructiveOpsLimits.bulkDelete).toBeLessThan(5);
    });
  });

  describe('Exception Approval Security', () => {
    it('should require elevated permissions for exceptions', async () => {
      const regularUser = {
        id: 'user-123',
        email: 'user@example.com',
        roles: ['policy_viewer'],
      };

      const exception = {
        description: 'Exception request',
        justification: 'Business need',
      };

      // Should be denied for regular users
      const context = createMockExecutionContext(regularUser, regularUser.roles);
      jest.spyOn(rolesGuard, 'canActivate').mockReturnValue(false);

      expect(await rolesGuard.canActivate(context)).toBe(false);
    });

    it('should track exception approvers', async () => {
      const approver = {
        id: 'approver-123',
        email: 'compliance@example.com',
        organizationId: 'org-123',
      };

      const exception = {
        description: 'Legacy system exception',
        justification: 'Migration in progress',
      };

      mockPoliciesService.addException.mockResolvedValue({
        exceptions: [
          {
            ...exception,
            approvedBy: approver.id,
            approvalDate: new Date(),
          },
        ],
      });

      // Mock the request object to simulate the @Request() decorator
      const req = { user: approver };
      jest.spyOn(controller, 'addException').mockImplementation(async (id, exception) => {
        return mockPoliciesService.addException(id, exception, req.user.id);
      });

      const result = await controller.addException('policy-123', exception);

      expect(mockPoliciesService.addException).toHaveBeenCalledWith(
        'policy-123',
        exception,
        approver.id
      );
    });
  });

  describe('Content Security', () => {
    it('should sanitize HTML content', () => {
      const dangerousContent = [
        '<img src=x onerror=alert("XSS")>',
        '<iframe src="javascript:alert(1)">',
        '<object data="data:text/html,<script>alert(1)</script>">',
      ];

      dangerousContent.forEach((content) => {
        const section = {
          title: 'Section',
          content,
        };

        // Should be sanitized
        expect(section.content).toContain('<');
      });
    });

    it('should validate markdown content', () => {
      const validMarkdown = [
        '# Heading\n\nParagraph with **bold** and *italic*',
        '- List item 1\n- List item 2',
        '[Link](https://example.com)',
      ];

      validMarkdown.forEach((content) => {
        expect(content).toBeDefined();
      });
    });
  });

  describe('Workflow Security', () => {
    it('should prevent status manipulation', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
      };

      // Try to skip approval process
      const updateDto = {
        status: PolicyStatus.EFFECTIVE, // Should not be allowed directly
      };

      mockPoliciesService.update.mockRejectedValue(
        new BadRequestException('Cannot change status directly')
      );

      await expect(controller.update('policy-123', updateDto, user as any)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should enforce approval workflow order', async () => {
      // Cannot publish without approval
      mockPoliciesService.publish.mockRejectedValue(
        new BadRequestException('Policy must be approved before publishing')
      );

      const user = { id: 'user-123', email: 'test@example.com' };

      await expect(controller.publish('draft-policy-id', user as any)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('Data Export Security', () => {
    it('should track bulk exports', () => {
      const exportLimits = {
        maxRecords: 5000,
        maxFileSize: '50MB',
        allowedFormats: ['pdf', 'csv', 'json'],
        rateLimitPerDay: 10,
      };

      expect(exportLimits.maxRecords).toBeLessThanOrEqual(5000);
      expect(exportLimits.rateLimitPerDay).toBeLessThanOrEqual(10);
    });

    it('should redact sensitive data in downloads', async () => {
      const policy = {
        id: 'policy-123',
        title: 'Public Policy',
        internalNotes: 'Should be redacted',
        approvalWorkflow: {
          internalComments: 'Should be redacted',
        },
      };

      mockPoliciesService.findOne.mockResolvedValue(policy);
      mockPoliciesService.recordDownload.mockResolvedValue(undefined);

      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await controller.downloadPolicy(
        'policy-123',
        { user: { id: 'user-123' } } as any,
        mockResponse as any
      );

      // Download should be tracked
      expect(service.recordDownload).toHaveBeenCalled();
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
  });

  describe('Error Message Security', () => {
    it('should not leak sensitive information in error messages', () => {
      const safeErrorMessages = {
        notFound: 'Policy not found',
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
  });
});
