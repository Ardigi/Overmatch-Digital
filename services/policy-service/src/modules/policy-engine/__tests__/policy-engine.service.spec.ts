import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  PerformanceTestHelper,
  SECURITY_TEST_CONSTANTS,
  TEST_OPA_POLICIES,
  TestDataBuilder,
} from '../../../../test/utils/test-helpers';
import { CacheService } from '../../cache/cache.service';
import type { PolicyContext } from '../interfaces/policy-engine.interface';
import { PolicyEngineService } from '../policy-engine.service';

describe('PolicyEngineService', () => {
  let service: PolicyEngineService;
  let cacheService: CacheService;
  let configService: ConfigService;

  // Mock dependencies
  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    invalidatePattern: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      const config = {
        'policy.engine.timeout': 5000,
        'policy.engine.maxPolicySize': 1048576,
        'policy.engine.cacheEnabled': true,
        'policy.engine.cacheTTL': 3600,
      };
      return config[key];
    }),
  };

  // Mock repository following TypeORM/Jest pattern
  const mockPolicyRepository = TestDataBuilder.createMockRepository();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyEngineService,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: 'PolicyRepository',
          useValue: mockPolicyRepository,
        },
      ],
    }).compile();

    service = module.get<PolicyEngineService>(PolicyEngineService);
    cacheService = module.get<CacheService>(CacheService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  describe('Policy Evaluation', () => {
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
        tags: ['financial'],
      },
      action: 'read',
      environment: {
        time: new Date().toISOString(),
        ipAddress: '192.168.1.100',
        location: 'US',
      },
    };

    describe('evaluatePolicy', () => {
      it('should evaluate policy and return decision with caching', async () => {
        const policyId = 'policy-123';
        const cacheKey = `policy:${policyId}:${JSON.stringify(mockContext)}`;

        // Mock cache miss
        mockCacheService.get.mockResolvedValue(null);

        // Mock policy retrieval
        mockPolicyRepository.findOne.mockResolvedValue({
          id: policyId,
          content: { code: TEST_OPA_POLICIES.ALLOW_READ },
          status: 'PUBLISHED',
        });

        // Mock OPA evaluation (simulated)
        const mockDecision = {
          decision: 'ALLOW',
          reasons: ['User has admin role'],
          obligations: ['Log access'],
          metadata: {
            evaluationTime: 25,
            policyVersion: '1.0',
            cached: false,
          },
        };

        // Simulate service evaluation logic
        jest.spyOn(service as any, 'evaluateWithOPA').mockResolvedValue(mockDecision);

        const result = await service.evaluatePolicy(policyId, mockContext);

        expect(mockCacheService.get).toHaveBeenCalledWith(expect.stringContaining('policy:'));
        expect(mockCacheService.set).toHaveBeenCalledWith(
          expect.stringContaining('policy:'),
          mockDecision,
          3600
        );
        expect(result).toEqual(mockDecision);
      });

      it('should return cached result when available', async () => {
        const cachedDecision = {
          decision: 'ALLOW',
          metadata: { cached: true },
        };

        mockCacheService.get.mockResolvedValue(cachedDecision);

        const result = await service.evaluatePolicy('policy-123', mockContext);

        expect(mockPolicyRepository.findOne).not.toHaveBeenCalled();
        expect(result.metadata.cached).toBe(true);
      });

      it('should enforce performance requirements', async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPolicyRepository.findOne.mockResolvedValue({
          id: 'policy-123',
          content: { code: TEST_OPA_POLICIES.ALLOW_READ },
        });

        const { result, duration } = await PerformanceTestHelper.measureResponseTime(() =>
          service.evaluatePolicy('policy-123', mockContext)
        );

        expect(duration).toBeLessThan(SECURITY_TEST_CONSTANTS.MAX_POLICY_EVALUATION_TIME);
      });

      it('should handle policy not found', async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPolicyRepository.findOne.mockResolvedValue(null);

        await expect(service.evaluatePolicy('non-existent', mockContext)).rejects.toThrow(
          NotFoundException
        );
      });

      it('should validate context structure', async () => {
        const invalidContext = {
          user: { id: 'user-123' },
          // Missing required fields
        } as PolicyContext;

        await expect(service.evaluatePolicy('policy-123', invalidContext)).rejects.toThrow(
          BadRequestException
        );
      });

      it('should handle evaluation timeout', async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockPolicyRepository.findOne.mockResolvedValue({
          id: 'policy-123',
          content: { code: 'infinite loop policy' },
        });

        // Mock timeout scenario
        jest.spyOn(service as any, 'evaluateWithOPA').mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(resolve, 10000); // Longer than timeout
            })
        );

        await expect(service.evaluatePolicy('policy-123', mockContext)).rejects.toThrow(
          'Policy evaluation timeout'
        );
      });
    });

    describe('evaluatePolicySet', () => {
      it('should evaluate multiple policies and aggregate results', async () => {
        const policySetId = 'set-123';
        const policies = [
          { id: 'policy-1', code: TEST_OPA_POLICIES.ALLOW_READ },
          { id: 'policy-2', code: TEST_OPA_POLICIES.ENFORCE_MFA },
        ];

        mockPolicyRepository.find.mockResolvedValue(policies);

        const mockResults = {
          overallDecision: 'ALLOW',
          policyResults: [
            { policyId: 'policy-1', decision: 'ALLOW' },
            { policyId: 'policy-2', decision: 'ALLOW' },
          ],
          conflictResolution: 'ALL_MUST_ALLOW',
          metadata: {
            totalPolicies: 2,
            evaluationTime: 45,
          },
        };

        jest.spyOn(service as any, 'aggregatePolicyDecisions').mockReturnValue(mockResults);

        const result = await service.evaluatePolicySet(policySetId, mockContext);

        expect(result).toEqual(mockResults);
        expect(result.metadata.evaluationTime).toBeLessThan(
          SECURITY_TEST_CONSTANTS.MAX_POLICY_EVALUATION_TIME * 2
        );
      });

      it('should handle conflicting decisions with ANY_DENY strategy', async () => {
        const decisions = [
          { policyId: 'policy-1', decision: 'ALLOW' },
          { policyId: 'policy-2', decision: 'DENY', reason: 'MFA required' },
        ];

        const aggregated = (service as any).aggregatePolicyDecisions(decisions, 'ANY_DENY');

        expect(aggregated.overallDecision).toBe('DENY');
        expect(aggregated.conflictResolution).toBe('ANY_DENY');
      });

      it('should handle empty policy set', async () => {
        mockPolicyRepository.find.mockResolvedValue([]);

        await expect(service.evaluatePolicySet('empty-set', mockContext)).rejects.toThrow(
          'Policy set is empty'
        );
      });
    });
  });

  describe('Policy Validation and Compilation', () => {
    describe('validatePolicy', () => {
      it('should validate correct OPA syntax', async () => {
        const validCode = TEST_OPA_POLICIES.ALLOW_READ;

        const result = await service.validatePolicy(validCode);

        expect(result).toBe(true);
      });

      it('should detect and reject malicious patterns', async () => {
        const maliciousPatterns = [
          'http.send({url: "http://evil.com"})',
          'io.jwt.decode_verify()',
          'net.lookup_ip_addr("evil.com")',
          'opa.env',
        ];

        for (const pattern of maliciousPatterns) {
          const maliciousCode = `
            package policy.malicious
            allow {
              ${pattern}
            }
          `;

          const result = await service.validatePolicy(maliciousCode);

          expect(result).toBe(false);
        }
      });

      it('should enforce size limits', async () => {
        const largeCode = 'a'.repeat(SECURITY_TEST_CONSTANTS.MAX_REQUEST_SIZE + 1);

        await expect(service.validatePolicy(largeCode)).rejects.toThrow(
          'Policy exceeds maximum size limit'
        );
      });

      it('should validate required package declaration', async () => {
        const codeWithoutPackage = `
          default allow = false
          allow { input.user.roles[_] == "admin" }
        `;

        const result = await service.validatePolicy(codeWithoutPackage);

        expect(result).toBe(false);
      });
    });

    describe('compilePolicy', () => {
      it('should compile valid policy code', async () => {
        const code = TEST_OPA_POLICIES.DATA_CLASSIFICATION;

        const compiled = await service.compilePolicy(code);

        expect(compiled).toHaveProperty('id');
        expect(compiled).toHaveProperty('package', 'policy.data');
        expect(compiled).toHaveProperty('rules');
        expect(compiled.rules).toContain('classification');
      });

      it('should cache compiled policies', async () => {
        const code = TEST_OPA_POLICIES.ALLOW_READ;

        await service.compilePolicy(code);

        expect(mockCacheService.set).toHaveBeenCalledWith(
          expect.stringContaining('compiled:'),
          expect.any(Object),
          expect.any(Number)
        );
      });

      it('should handle compilation errors with details', async () => {
        const invalidCode = `
          package policy.invalid
          allow {
            input.user.roles[_] = "admin"  // Invalid operator
          }
        `;

        await expect(service.compilePolicy(invalidCode)).rejects.toThrow('Compilation error');
      });

      it('should measure compilation performance', async () => {
        const code = TEST_OPA_POLICIES.ALLOW_READ;

        const { result, duration } = await PerformanceTestHelper.measureResponseTime(() =>
          service.compilePolicy(code)
        );

        expect(duration).toBeLessThan(SECURITY_TEST_CONSTANTS.MAX_API_RESPONSE_TIME);
      });
    });
  });

  describe('Cache Management', () => {
    describe('invalidateCache', () => {
      it('should invalidate cache for specific policy', async () => {
        const policyId = 'policy-123';

        await service.invalidateCache(policyId);

        expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith(`policy:${policyId}:*`);
      });

      it('should invalidate all policy caches when no ID provided', async () => {
        await service.invalidateCache();

        expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('policy:*');
        expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('compiled:*');
      });

      it('should handle cache service errors gracefully', async () => {
        mockCacheService.invalidatePattern.mockRejectedValue(new Error('Redis connection error'));

        // Should not throw, but log error
        await expect(service.invalidateCache()).resolves.not.toThrow();
      });
    });
  });

  describe('Security Features', () => {
    it('should sanitize policy code before processing', async () => {
      const codeWithDangerousChars = `
        package policy.test
        // <script>alert('xss')</script>
        allow { input.user.roles[_] == "admin" }
      `;

      const result = await service.validatePolicy(codeWithDangerousChars);

      expect(result).toBe(true); // Comments are allowed, but sanitized
    });

    it('should enforce policy isolation', async () => {
      // Policies should not be able to access other policies or system resources
      const isolationTestCode = `
        package policy.isolated
        
        import data.other_policy
        
        allow {
          other_policy.secret == "leaked"
        }
      `;

      const result = await service.validatePolicy(isolationTestCode);

      expect(result).toBe(false);
    });

    it('should track policy evaluation audit trail', async () => {
      const context = { ...mockContext };
      const auditEntry = {
        timestamp: expect.any(Date),
        policyId: 'policy-123',
        userId: context.user.id,
        action: 'POLICY_EVALUATED',
        decision: 'ALLOW',
        context: context,
      };

      mockCacheService.get.mockResolvedValue(null);
      mockPolicyRepository.findOne.mockResolvedValue({
        id: 'policy-123',
        content: { code: TEST_OPA_POLICIES.ALLOW_READ },
      });

      jest.spyOn(service as any, 'recordAuditEntry').mockImplementation();

      await service.evaluatePolicy('policy-123', context);

      expect((service as any).recordAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          policyId: 'policy-123',
          userId: context.user.id,
          action: 'POLICY_EVALUATED',
        })
      );
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent policy evaluations', async () => {
      const concurrency = 10;
      const iterations = 5;

      mockCacheService.get.mockResolvedValue(null);
      mockPolicyRepository.findOne.mockResolvedValue({
        id: 'policy-123',
        content: { code: TEST_OPA_POLICIES.ALLOW_READ },
      });

      const results = await PerformanceTestHelper.runLoadTest(
        () => service.evaluatePolicy('policy-123', mockContext),
        concurrency,
        iterations
      );

      expect(results.avgDuration).toBeLessThan(SECURITY_TEST_CONSTANTS.MAX_POLICY_EVALUATION_TIME);
      expect(results.errors).toBe(0);
    });

    it('should maintain performance with large policy sets', async () => {
      const largePolicySet = Array(50)
        .fill(null)
        .map((_, i) => ({
          id: `policy-${i}`,
          code: TEST_OPA_POLICIES.ALLOW_READ,
        }));

      mockPolicyRepository.find.mockResolvedValue(largePolicySet);

      const { duration } = await PerformanceTestHelper.measureResponseTime(() =>
        service.evaluatePolicySet('large-set', mockContext)
      );

      // Should complete within reasonable time even with many policies
      expect(duration).toBeLessThan(1000); // 1 second for 50 policies
    });
  });
});
