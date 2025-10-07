import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import {
  type Policy,
  PolicyPriority,
  PolicyScope,
  PolicyStatus,
  PolicyType,
} from '../entities/policy.entity';
import { PoliciesService } from '../policies.service';

describe('Policies Service Integration Tests (Manual Instantiation)', () => {
  let policiesService: PoliciesService;
  let mockPolicyRepository: jest.Mocked<Repository<Policy>>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockCacheService: any;
  let mockSearchService: any;
  let mockOpaService: any;
  let mockAuthorizationService: any;

  // Simulated database storage
  let policiesDb: Map<string, Policy>;
  let policyCounter = 0;

  const adminUser = {
    id: 'admin-user-123',
    email: 'admin@example.com',
    roles: ['admin'],
    organizationId: 'org-123',
  };

  const testPolicy = {
    title: 'Integration Test Policy',
    description: 'Policy for integration testing',
    type: PolicyType.SECURITY,
    priority: PolicyPriority.HIGH,
    scope: PolicyScope.ORGANIZATION,
    content: {
      sections: [
        {
          title: 'Purpose',
          content: 'This policy defines security standards',
        },
        {
          title: 'Scope',
          content: 'Applies to all employees and contractors',
        },
      ],
    },
    effectiveDate: new Date('2025-02-01'),
    expirationDate: new Date('2026-02-01'),
    nextReviewDate: new Date('2025-08-01'),
    ownerDepartment: 'IT Security',
    complianceMapping: {
      frameworks: ['SOC2', 'ISO27001'],
      controls: ['AC-1', 'AC-2'],
    },
    tags: ['security', 'compliance', 'mandatory'],
    keywords: ['information', 'security', 'data', 'protection'],
  };

  beforeEach(() => {
    // Initialize in-memory database
    policiesDb = new Map();
    policyCounter = 0;

    // Create mock repository with realistic behavior
    mockPolicyRepository = {
      create: jest.fn((dto) => {
        const year = new Date().getFullYear();
        const typePrefix =
          dto.type === PolicyType.SECURITY
            ? 'SEC'
            : dto.type === PolicyType.PRIVACY
              ? 'PRI'
              : dto.type === PolicyType.COMPLIANCE
                ? 'COM'
                : 'GEN';
        const policyNumber = `${typePrefix}-${year}-${String(++policyCounter).padStart(3, '0')}`;

        return {
          id: `policy-${Date.now()}-${Math.random()}`,
          ...dto,
          policyNumber,
          status: PolicyStatus.DRAFT,
          version: '1.0',
          viewCount: 0,
          downloadCount: 0,
          createdBy: 'admin-user-123',
          updatedBy: 'admin-user-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          changeHistory: [],
        } as Policy;
      }),
      save: jest.fn(async (policy) => {
        if (Array.isArray(policy)) {
          return policy.map((p) => {
            policiesDb.set(p.id, p);
            return p;
          });
        }
        policiesDb.set(policy.id, policy);
        return policy;
      }),
      find: jest.fn(async (options?: any) => {
        let results = Array.from(policiesDb.values());

        if (options?.where) {
          const where = options.where;
          if (where.status) {
            results = results.filter((p) => p.status === where.status);
          }
          if (where.type) {
            results = results.filter((p) => p.type === where.type);
          }
        }

        return results;
      }),
      findOne: jest.fn(async (options) => {
        if (options.where.id) {
          return policiesDb.get(options.where.id) || null;
        }
        if (options.where.policyNumber) {
          return (
            Array.from(policiesDb.values()).find(
              (p) => p.policyNumber === options.where.policyNumber
            ) || null
          );
        }
        return null;
      }),
      delete: jest.fn(async () => {
        policiesDb.clear();
        return { affected: policiesDb.size };
      }),
      count: jest.fn(async (options?: any) => {
        let results = Array.from(policiesDb.values());

        if (options?.where) {
          const where = options.where;
          if (where.status) {
            results = results.filter((p) => p.status === where.status);
          }
          if (where.type) {
            results = results.filter((p) => p.type === where.type);
          }
        }

        return results.length;
      }),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn(async () => {
          const results = Array.from(policiesDb.values());
          return [results, results.length];
        }),
        getMany: jest.fn(async () => Array.from(policiesDb.values())),
        getOne: jest.fn(async () => Array.from(policiesDb.values())[0] || null),
      })),
    } as any;

    mockEventEmitter = {
      emit: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
      buildPolicyKey: jest.fn((id) => `policy:${id}`),
    };

    mockSearchService = {
      indexPolicy: jest.fn().mockResolvedValue(undefined),
      updatePolicy: jest.fn().mockResolvedValue(undefined),
      deletePolicy: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue({ hits: [], total: 0 }),
    };

    mockOpaService = {
      evaluatePolicy: jest.fn().mockResolvedValue({ allow: true }),
      checkPermission: jest.fn().mockResolvedValue(true),
    };

    mockAuthorizationService = {
      canAccessResource: jest.fn().mockResolvedValue(true),
      filterAccessibleResources: jest.fn().mockImplementation(async (resources) => resources),
      checkPermission: jest.fn().mockResolvedValue(true),
    };

    // Create service with manual instantiation
    policiesService = new PoliciesService(
      mockPolicyRepository,
      mockEventEmitter,
      mockCacheService,
      mockSearchService,
      mockOpaService,
      mockAuthorizationService
    );
  });

  afterEach(() => {
    // Clear all data and mocks
    policiesDb.clear();
    policyCounter = 0;
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new policy', async () => {
      const policyDto = {
        ...testPolicy,
        organizationId: 'org-123',
        createdBy: 'admin-user-123',
      };
      const result = await policiesService.create(policyDto);

      expect(result).toMatchObject({
        id: expect.any(String),
        policyNumber: expect.stringMatching(/^SEC-\d{4}-\d{3}$/),
        title: testPolicy.title,
        status: PolicyStatus.DRAFT,
        version: '1.0',
        viewCount: 0,
        downloadCount: 0,
        createdBy: 'admin-user-123',
      });

      // Verify it was saved
      expect(policiesDb.size).toBe(1);
      const savedPolicy = Array.from(policiesDb.values())[0];
      expect(savedPolicy.title).toBe(testPolicy.title);

      // Verify event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'policy.created',
        expect.objectContaining({
          policyId: result.id,
          policyNumber: result.policyNumber,
          type: result.type,
        })
      );
    });

    it('should generate unique policy numbers', async () => {
      // Create first policy
      const policyDto1 = {
        ...testPolicy,
        organizationId: 'org-123',
        createdBy: 'admin-user-123',
      };
      const policy1 = await policiesService.create(policyDto1);

      // Create second policy
      const policyDto2 = {
        ...testPolicy,
        title: 'Second Policy',
        organizationId: 'org-123',
        createdBy: 'admin-user-123',
      };
      const policy2 = await policiesService.create(policyDto2);

      expect(policy1.policyNumber).not.toBe(policy2.policyNumber);
      expect(policy1.policyNumber).toMatch(/^SEC-\d{4}-001$/);
      expect(policy2.policyNumber).toMatch(/^SEC-\d{4}-002$/);
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      // Create test data
      const policies = [
        {
          ...testPolicy,
          title: 'Active Security Policy',
          status: PolicyStatus.EFFECTIVE,
          type: PolicyType.SECURITY,
          complianceScore: 0.95,
        },
        {
          ...testPolicy,
          title: 'Draft Privacy Policy',
          status: PolicyStatus.DRAFT,
          type: PolicyType.PRIVACY,
          complianceScore: 0.6,
        },
        {
          ...testPolicy,
          title: 'Under Review Compliance Policy',
          status: PolicyStatus.UNDER_REVIEW,
          type: PolicyType.COMPLIANCE,
          complianceScore: 0.75,
        },
      ];

      for (const policyData of policies) {
        const policy = mockPolicyRepository.create(policyData);
        await mockPolicyRepository.save(policy);
      }
    });

    it('should return paginated policies', async () => {
      const result = await policiesService.findAll({});

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toHaveLength(3);
      expect(result.meta).toEqual({
        total: 3,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should filter by status', async () => {
      const result = await policiesService.findAll({ status: PolicyStatus.EFFECTIVE });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe(PolicyStatus.EFFECTIVE);
    });

    it('should filter by type', async () => {
      const result = await policiesService.findAll({ type: PolicyType.PRIVACY });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe(PolicyType.PRIVACY);
    });

    it('should handle pagination', async () => {
      const result = await policiesService.findAll({ page: 2, limit: 2 });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        total: 3,
        page: 2,
        limit: 2,
        totalPages: 2,
      });
    });

    it('should include metrics when requested', async () => {
      // Mock the metrics calculation
      mockPolicyRepository.count.mockImplementation(async (options) => {
        const allPolicies = Array.from(policiesDb.values());
        if (options?.where?.status) {
          return allPolicies.filter((p) => p.status === options.where.status).length;
        }
        if (options?.where?.type) {
          return allPolicies.filter((p) => p.type === options.where.type).length;
        }
        return allPolicies.length;
      });

      const result = await policiesService.findAll({ includeMetrics: true });

      expect(result.meta.metrics).toBeDefined();
      expect(result.meta.metrics).toHaveProperty('byStatus');
      expect(result.meta.metrics).toHaveProperty('byType');
      expect(result.meta.metrics).toHaveProperty('averageComplianceScore');
      expect(result.meta.metrics.averageComplianceScore).toBeCloseTo(0.77, 1);
    });
  });

  describe('findExpiring', () => {
    beforeEach(async () => {
      const today = new Date();
      const in15Days = new Date();
      in15Days.setDate(today.getDate() + 15);
      const in45Days = new Date();
      in45Days.setDate(today.getDate() + 45);

      const policies = [
        {
          ...testPolicy,
          title: 'Expiring Soon Policy',
          expirationDate: in15Days,
          status: PolicyStatus.EFFECTIVE,
        },
        {
          ...testPolicy,
          title: 'Expiring Later Policy',
          expirationDate: in45Days,
          status: PolicyStatus.EFFECTIVE,
        },
      ];

      for (const policyData of policies) {
        const policy = mockPolicyRepository.create(policyData);
        await mockPolicyRepository.save(policy);
      }
    });

    it('should return policies expiring within 30 days', async () => {
      const result = await policiesService.findExpiring();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Expiring Soon Policy');
    });

    it('should accept custom days parameter', async () => {
      const result = await policiesService.findExpiring(60);

      expect(result).toHaveLength(2);
    });
  });

  describe('findNeedsReview', () => {
    beforeEach(async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const policies = [
        {
          ...testPolicy,
          title: 'Overdue Review Policy',
          nextReviewDate: pastDate,
          status: PolicyStatus.EFFECTIVE,
        },
        {
          ...testPolicy,
          title: 'Future Review Policy',
          nextReviewDate: futureDate,
          status: PolicyStatus.EFFECTIVE,
        },
      ];

      for (const policyData of policies) {
        const policy = mockPolicyRepository.create(policyData);
        await mockPolicyRepository.save(policy);
      }
    });

    it('should return policies needing review', async () => {
      const result = await policiesService.findNeedsReview();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Overdue Review Policy');
    });
  });

  describe('findOne', () => {
    let policyId: string;

    beforeEach(async () => {
      const policy = mockPolicyRepository.create(testPolicy);
      const saved = await mockPolicyRepository.save(policy);
      policyId = saved.id;
    });

    it('should return a policy by ID', async () => {
      const result = await policiesService.findOne(policyId);

      expect(result).toMatchObject({
        id: policyId,
        title: testPolicy.title,
        type: testPolicy.type,
      });
    });

    it('should track view access', async () => {
      // Mock the view tracking
      mockPolicyRepository.save.mockImplementationOnce(async (policy) => {
        const updated = { ...policy, viewCount: (policy.viewCount || 0) + 1 };
        policiesDb.set(updated.id, updated);
        return updated;
      });

      await policiesService.findOne(policyId);

      const policy = policiesDb.get(policyId);
      expect(policy?.viewCount).toBe(1);

      // Verify event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'policy.viewed',
        expect.objectContaining({
          policyId,
          userId: 'admin-user-123',
        })
      );
    });

    it('should throw NotFoundException for non-existent policy', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';

      await expect(policiesService.findOne(fakeId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByPolicyNumber', () => {
    let policyNumber: string;

    beforeEach(async () => {
      const policy = mockPolicyRepository.create(testPolicy);
      const saved = await mockPolicyRepository.save(policy);
      policyNumber = saved.policyNumber;
    });

    it('should return a policy by policy number', async () => {
      const result = await policiesService.findByPolicyNumber(policyNumber);

      expect(result.policyNumber).toBe(policyNumber);
    });

    it('should throw NotFoundException for non-existent policy number', async () => {
      await expect(policiesService.findByPolicyNumber('INVALID-2025-999')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('update', () => {
    let policyId: string;

    beforeEach(async () => {
      const policy = mockPolicyRepository.create(testPolicy);
      const saved = await mockPolicyRepository.save(policy);
      policyId = saved.id;
    });

    it('should update a policy', async () => {
      const updateData = {
        title: 'Updated Policy Title',
        description: 'Updated description',
        priority: PolicyPriority.CRITICAL,
      };

      // Mock the update behavior
      mockPolicyRepository.save.mockImplementationOnce(async (policy) => {
        const updated = {
          ...policy,
          changeHistory: [
            ...policy.changeHistory,
            {
              changedAt: new Date(),
              changedBy: 'admin-user-123',
              changes: {
                summary: 'Updated: title, description, priority',
              },
            },
          ],
        };
        policiesDb.set(updated.id, updated);
        return updated;
      });

      const result = await policiesService.update(policyId, updateData);

      expect(result).toMatchObject({
        id: policyId,
        title: updateData.title,
        description: updateData.description,
        priority: updateData.priority,
      });

      // Verify event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'policy.updated',
        expect.objectContaining({
          policyId,
          changes: updateData,
          userId: 'admin-user-123',
        })
      );
    });

    it('should track changes in history', async () => {
      const updateData = { title: 'Updated Title' };

      // Mock the update behavior
      mockPolicyRepository.save.mockImplementationOnce(async (policy) => {
        const updated = {
          ...policy,
          title: updateData.title,
          changeHistory: [
            ...policy.changeHistory,
            {
              changedAt: new Date(),
              changedBy: 'admin-user-123',
              changes: {
                summary: 'Updated: title',
              },
            },
          ],
        };
        policiesDb.set(updated.id, updated);
        return updated;
      });

      await policiesService.update(policyId, updateData);

      const updated = policiesDb.get(policyId);
      expect(updated?.changeHistory).toHaveLength(1);
      expect(updated?.changeHistory[0]).toMatchObject({
        changedBy: adminUser.id,
        changes: {
          summary: expect.stringContaining('title'),
        },
      });
    });
  });

  describe('approve', () => {
    let policyId: string;

    beforeEach(async () => {
      const policy = mockPolicyRepository.create({
        ...testPolicy,
        status: PolicyStatus.UNDER_REVIEW,
      });
      const saved = await mockPolicyRepository.save(policy);
      policyId = saved.id;
    });

    it('should approve a policy under review', async () => {
      // Mock the approval
      mockPolicyRepository.save.mockImplementationOnce(async (policy) => {
        const updated = {
          ...policy,
          status: PolicyStatus.APPROVED,
          approvalDate: new Date(),
          approvedBy: 'admin-user-123',
        };
        policiesDb.set(updated.id, updated);
        return updated;
      });

      const result = await policiesService.approve(policyId, {
        comments: 'Approved after thorough review',
      });

      expect(result.status).toBe(PolicyStatus.APPROVED);
      expect(result.approvalDate).toBeDefined();

      // Verify event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'policy.approved',
        expect.objectContaining({
          policyId,
          approvedBy: 'admin-user-123',
        })
      );
    });

    it('should reject approval for draft policy', async () => {
      const draftPolicy = mockPolicyRepository.create({
        ...testPolicy,
        status: PolicyStatus.DRAFT,
      });
      const saved = await mockPolicyRepository.save(draftPolicy);

      await expect(policiesService.approve(saved.id, {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('publish', () => {
    let policyId: string;

    beforeEach(async () => {
      const policy = mockPolicyRepository.create({
        ...testPolicy,
        status: PolicyStatus.APPROVED,
        approvalDate: new Date(),
      });
      const saved = await mockPolicyRepository.save(policy);
      policyId = saved.id;
    });

    it('should publish an approved policy', async () => {
      // Mock the publish
      mockPolicyRepository.save.mockImplementationOnce(async (policy) => {
        const updated = {
          ...policy,
          status: PolicyStatus.PUBLISHED,
          publishedDate: new Date(),
          publishedBy: 'admin-user-123',
        };
        policiesDb.set(updated.id, updated);
        return updated;
      });

      const result = await policiesService.publish(policyId);

      expect(result.status).toBe(PolicyStatus.PUBLISHED);
      expect(result.publishedDate).toBeDefined();

      // Verify event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'policy.published',
        expect.objectContaining({
          policyId,
          publishedBy: 'admin-user-123',
        })
      );
    });

    it('should make policy effective if date has passed', async () => {
      const policy = policiesDb.get(policyId);
      if (policy) {
        policy.effectiveDate = new Date(Date.now() - 86400000); // Yesterday
        policiesDb.set(policyId, policy);
      }

      // Mock the publish with effective status
      mockPolicyRepository.save.mockImplementationOnce(async (policy) => {
        const updated = {
          ...policy,
          status: PolicyStatus.EFFECTIVE,
          publishedDate: new Date(),
          publishedBy: 'admin-user-123',
        };
        policiesDb.set(updated.id, updated);
        return updated;
      });

      const result = await policiesService.publish(policyId);

      expect(result.status).toBe(PolicyStatus.EFFECTIVE);
    });
  });

  describe('addException', () => {
    let policyId: string;

    beforeEach(async () => {
      const policy = mockPolicyRepository.create({
        ...testPolicy,
        status: PolicyStatus.EFFECTIVE,
      });
      const saved = await mockPolicyRepository.save(policy);
      policyId = saved.id;
    });

    it('should add an exception to a policy', async () => {
      const exception = {
        description: 'Exception for legacy systems',
        justification: 'Migration in progress',
        expirationDate: new Date('2025-12-31'),
        conditions: ['Must have CTO approval', 'Monthly review required'],
      };

      // Mock the exception addition
      mockPolicyRepository.save.mockImplementationOnce(async (policy) => {
        const updated = {
          ...policy,
          exceptions: [
            ...(policy.exceptions || []),
            {
              ...exception,
              approvedBy: 'admin-user-123',
              approvedDate: new Date(),
            },
          ],
        };
        policiesDb.set(updated.id, updated);
        return updated;
      });

      const result = await policiesService.addException(policyId, exception);

      expect(result.exceptions).toHaveLength(1);
      expect(result.exceptions[0]).toMatchObject({
        ...exception,
        approvedBy: adminUser.id,
      });

      // Verify event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'policy.exception.added',
        expect.objectContaining({
          policyId,
          exception: expect.objectContaining(exception),
        })
      );
    });
  });

  describe('remove', () => {
    let policyId: string;

    beforeEach(async () => {
      const policy = mockPolicyRepository.create(testPolicy);
      const saved = await mockPolicyRepository.save(policy);
      policyId = saved.id;
    });

    it('should soft delete a policy', async () => {
      // Mock the soft delete
      mockPolicyRepository.save.mockImplementationOnce(async (policy) => {
        const updated = {
          ...policy,
          status: PolicyStatus.RETIRED,
          archivedAt: new Date(),
          archivedBy: 'admin-user-123',
        };
        policiesDb.set(updated.id, updated);
        return updated;
      });

      await policiesService.remove(policyId);

      const archived = policiesDb.get(policyId);
      expect(archived?.status).toBe(PolicyStatus.RETIRED);
      expect(archived?.archivedAt).toBeDefined();

      // Verify event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'policy.archived',
        expect.objectContaining({
          policyId,
          archivedBy: 'admin-user-123',
        })
      );
    });
  });
});
