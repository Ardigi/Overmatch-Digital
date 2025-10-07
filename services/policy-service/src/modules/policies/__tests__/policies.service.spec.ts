import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ServiceDiscoveryService } from '@soc-compliance/http-common';
import { LoggingService, MetricsService, TracingService } from '@soc-compliance/monitoring';
import { Repository } from 'typeorm';
import {
  InsufficientPermissionsException,
  InvalidStateTransitionException,
  ResourceAlreadyExistsException,
  ResourceNotFoundException,
} from '../../../shared/exceptions/business.exception';
import { AuthorizationService } from '../../../shared/services/authorization.service';
import { CacheService } from '../../cache/cache.service';
import { OpaService } from '../../opa/opa.service';
import { SearchService } from '../../search/search.service';
import { CreatePolicyDto, QueryPolicyDto, UpdatePolicyDto } from '../dto';
import {
  Policy,
  PolicyPriority,
  PolicyScope,
  PolicyStatus,
  PolicyType,
  WorkflowState,
} from '../entities/policy.entity';
import { PoliciesService } from '../policies.service';

describe('PoliciesService', () => {
  let service: PoliciesService;
  let mockPolicyRepository: any;
  let mockEventEmitter: any;
  let mockCacheService: any;
  let mockSearchService: any;
  let mockOpaService: any;
  let mockAuthorizationService: any;
  let mockServiceDiscovery: any;
  let mockMetricsService: any;
  let mockTracingService: any;
  let mockLoggingService: any;

  // Factory function to create fresh mock policy
  const createMockPolicy = (): Policy =>
    ({
      id: 'policy-123',
      policyNumber: 'SEC-2025-001',
      title: 'Information Security Policy',
      description: 'Comprehensive information security policy',
      purpose: 'To establish security requirements and controls',
      type: PolicyType.SECURITY,
      status: PolicyStatus.DRAFT,
      priority: PolicyPriority.HIGH,
      scope: PolicyScope.ORGANIZATION,
      version: '1.0.0',
      effectiveDate: new Date('2025-01-01'),
      expirationDate: new Date('2026-01-01'),
      nextReviewDate: new Date('2025-07-01'),
      ownerId: 'user-456',
      ownerName: 'John Doe',
      ownerEmail: 'john.doe@example.com',
      ownerDepartment: 'IT Security',
      organizationId: 'org-123',
      content: {
        sections: [
          {
            id: 'section-1',
            title: 'Purpose',
            content: 'This policy establishes security requirements',
            order: 0,
          },
        ],
      },
      complianceMapping: {
        frameworks: ['SOC2', 'ISO27001'],
        controls: ['AC-1', 'AC-2'],
      },
      complianceScore: 0.85,
      adoptionRate: 0.78,
      viewCount: 10,
      downloadCount: 5,
      workflowState: WorkflowState.DRAFT,
      isEvaluatable: false,
      isTemplate: false,
      tags: ['security', 'compliance'],
      keywords: ['information', 'security', 'data', 'protection'],
      exceptions: [],
      changeHistory: [],
      createdBy: 'user-789',
      updatedBy: 'user-789',
      createdAt: new Date('2024-12-01'),
      updatedAt: new Date('2024-12-15'),

      // Computed properties
      get isActive() { return true; },
      get isExpiringSoon() { return false; },
      get needsReview() { return false; },
      get completionPercentage() { return 85; },

      // Entity methods
      addSection: jest.fn(),
      recordEvaluation: jest.fn(),
      updateMetrics: jest.fn(),
      recordView: jest.fn(),
      recordDownload: jest.fn(),
      calculateComplianceScore: jest.fn(),
      canBeEditedBy: jest.fn().mockReturnValue(true),
    }) as any;

  beforeEach(() => {
    // Initialize mocks
    mockPolicyRepository = {
      create: jest.fn(),
      save: jest
        .fn()
        .mockImplementation((policy) => Promise.resolve(JSON.parse(JSON.stringify(policy)))),
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      deleteByTags: jest.fn(),
      buildPolicyKey: jest.fn((id) => `policy:${id}`),
      buildEvaluationKey: jest.fn((id, context) => `evaluation:${id}:${JSON.stringify(context)}`),
    };

    mockSearchService = {
      indexPolicy: jest.fn(),
      searchPolicies: jest.fn(),
      findSimilarPolicies: jest.fn(),
    };

    mockOpaService = {
      validateRegoSyntax: jest.fn(),
      compilePolicy: jest.fn(),
      uploadPolicy: jest.fn(),
      evaluatePolicy: jest.fn(),
      generatePolicyId: jest.fn(),
    };

    mockAuthorizationService = {
      applyOrganizationFilter: jest.fn(),
    };

    mockServiceDiscovery = {
      callService: jest.fn(),
    };

    mockMetricsService = {
      recordHttpRequest: jest.fn(),
      registerCounter: jest.fn().mockReturnValue({ inc: jest.fn() }),
      registerHistogram: jest.fn().mockReturnValue({ observe: jest.fn() }),
      getMetric: jest.fn(),
      config: { serviceName: 'policy-service-test' },
    };

    mockTracingService = {
      withSpan: jest.fn().mockImplementation((name, fn) => fn({ setAttribute: jest.fn() })),
      createSpan: jest.fn().mockReturnValue({ setAttribute: jest.fn(), end: jest.fn() }),
      getActiveSpan: jest.fn().mockReturnValue({ setAttribute: jest.fn() }),
    };

    mockLoggingService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
    };

    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getMany: jest.fn(),
      getOne: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };

    // Manual instantiation to avoid TypeORM issues
    service = new PoliciesService(
      mockPolicyRepository,
      mockEventEmitter,
      mockCacheService,
      mockSearchService,
      mockOpaService,
      mockAuthorizationService,
      mockServiceDiscovery,
      mockMetricsService,
      mockTracingService,
      mockLoggingService
    );

    // Mock the sanitizePolicyContent method to bypass sanitize-html issues
    service.sanitizePolicyContent = jest.fn().mockImplementation((content) => content);

    // Reset all mocks
    jest.clearAllMocks();
    mockPolicyRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  describe('Constructor and Dependencies', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have monitoring services injected', () => {
      expect(service['metricsService']).toBeDefined();
      expect(service['tracingService']).toBeDefined();
      expect(service['loggingService']).toBeDefined();
    });
  });

  describe('create', () => {
    const createDto: CreatePolicyDto = {
      title: 'New Security Policy',
      description: 'Policy description',
      type: PolicyType.SECURITY,
      priority: PolicyPriority.HIGH,
      scope: PolicyScope.ORGANIZATION,
      content: {
        sections: [
          {
            title: 'Introduction',
            content: 'Policy introduction',
          },
        ],
      },
      effectiveDate: '2025-02-01',
      organizationId: 'org-123',
      ownerId: 'user-456',
      ownerName: 'John Doe',
      createdBy: 'user-123',
    };

    it('should create a new policy with generated policy number', async () => {
      const mockPolicy = createMockPolicy();
      mockPolicyRepository.findOne.mockResolvedValue(null); // No existing policy
      mockPolicyRepository.count.mockResolvedValue(0);
      mockPolicyRepository.create.mockReturnValue(mockPolicy);
      mockPolicyRepository.save.mockResolvedValue(mockPolicy);

      const result = await service.create(createDto);

      expect(result).toEqual(mockPolicy);
      expect(mockPolicyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createDto,
          policyNumber: expect.stringMatching(/^SEC-\d{4}-\d{3}$/),
          status: PolicyStatus.DRAFT,
          workflowState: WorkflowState.DRAFT,
          viewCount: 0,
          downloadCount: 0,
          isEvaluatable: false,
        })
      );
      expect(mockSearchService.indexPolicy).toHaveBeenCalledWith(mockPolicy);
      expect(mockCacheService.deleteByTags).toHaveBeenCalledWith(['policies', 'org:org-123']);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'policy.created',
        expect.objectContaining({
          type: 'compliance.policy_created',
          payload: expect.objectContaining({
            policyId: mockPolicy.id,
            policyNumber: mockPolicy.policyNumber,
            title: mockPolicy.title,
            type: mockPolicy.type,
            status: mockPolicy.status,
            frameworks: mockPolicy.complianceMapping.frameworks,
          }),
          userId: 'user-123',
        })
      );
    });

    it('should throw ResourceAlreadyExistsException if title already exists', async () => {
      const mockPolicy = createMockPolicy();
      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy);

      await expect(service.create(createDto)).rejects.toThrow(
        new ResourceAlreadyExistsException('Policy', 'title', createDto.title)
      );
    });

    it('should calculate risk scores and levels', async () => {
      const dtoWithRisk = {
        ...createDto,
        riskAssessment: {
          inherentRisk: {
            likelihood: 3,
            impact: 4,
          },
        },
      };

      mockPolicyRepository.findOne.mockResolvedValue(null);
      mockPolicyRepository.count.mockResolvedValue(0);
      mockPolicyRepository.create.mockImplementation((policy) => ({
        ...policy,
        riskAssessment: {
          inherentRisk: {
            ...policy.riskAssessment.inherentRisk,
            score: 12,
            level: 'high',
          },
        },
      }));
      const mockPolicy = createMockPolicy();
      mockPolicyRepository.save.mockResolvedValue(mockPolicy);

      await service.create(dtoWithRisk);

      expect(mockPolicyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          riskAssessment: expect.objectContaining({
            inherentRisk: expect.objectContaining({
              likelihood: 3,
              impact: 4,
            }),
          }),
        })
      );
    });

    it('should set default effective date if not provided', async () => {
      const dtoWithoutDate = { ...createDto };
      delete dtoWithoutDate.effectiveDate;

      const mockPolicy = createMockPolicy();
      mockPolicyRepository.findOne.mockResolvedValue(null);
      mockPolicyRepository.count.mockResolvedValue(0);
      mockPolicyRepository.create.mockImplementation((policy) => ({ ...mockPolicy, ...policy }));
      let savedPolicy;
      mockPolicyRepository.save.mockImplementation((policy) => {
        savedPolicy = policy;
        return Promise.resolve(policy);
      });

      await service.create(dtoWithoutDate);

      expect(savedPolicy).toBeDefined();
      expect(savedPolicy.effectiveDate).toBeDefined();
      expect(savedPolicy.effectiveDate).toBeInstanceOf(Date);
    });

    it('should generate sequential policy numbers per type and year', async () => {
      const mockPolicy = createMockPolicy();
      mockPolicyRepository.findOne.mockResolvedValue(null);
      mockPolicyRepository.count.mockResolvedValue(10);
      mockPolicyRepository.create.mockReturnValue(mockPolicy);
      mockPolicyRepository.save.mockResolvedValue(mockPolicy);

      await service.create(createDto);

      const expectedNumber = `SEC-${new Date().getFullYear()}-011`;
      expect(mockPolicyRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          policyNumber: expectedNumber,
        })
      );
    });
  });

  describe('findAll', () => {
    const mockPolicies = [createMockPolicy()];
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getMany: jest.fn(),
      getOne: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };

    beforeEach(() => {
      mockPolicyRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockPolicies, 1]);
      mockQueryBuilder.getMany.mockResolvedValue(mockPolicies);
    });

    it('should return paginated policies', async () => {
      const query: QueryPolicyDto = { page: 1, limit: 20 };

      const result = await service.findAll(query);

      expect(result).toEqual({
        data: mockPolicies,
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      });
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    });

    it('should filter by organizationId', async () => {
      const query: QueryPolicyDto = { organizationId: 'org-123' };

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'policy.organizationId = :organizationId',
        { organizationId: 'org-123' }
      );
    });

    it('should filter by multiple types', async () => {
      const query: QueryPolicyDto = {
        types: [PolicyType.SECURITY, PolicyType.PRIVACY],
      };

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('policy.type IN (:...types)', {
        types: [PolicyType.SECURITY, PolicyType.PRIVACY],
      });
    });

    it('should filter by active policies', async () => {
      const query: QueryPolicyDto = { isActive: true };

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('policy.status = :effectiveStatus', {
        effectiveStatus: PolicyStatus.EFFECTIVE,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('policy.effectiveDate <= :now', {
        now: expect.any(Date),
      });
    });

    it('should search by text', async () => {
      const query: QueryPolicyDto = { search: 'security' };

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(policy.title ILIKE :search OR policy.description ILIKE :search OR policy.policyNumber ILIKE :search)',
        { search: '%security%' }
      );
    });

    it('should exclude archived policies by default', async () => {
      const query: QueryPolicyDto = {};

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('policy.archivedAt IS NULL');
    });

    it('should apply user authorization filter', async () => {
      const user = { id: 'user-123', organizationId: 'org-123' };
      const query: QueryPolicyDto = {};

      await service.findAll(query, user);

      expect(mockAuthorizationService.applyOrganizationFilter).toHaveBeenCalledWith(
        mockQueryBuilder,
        user,
        'policy'
      );
    });
  });

  describe('findOne', () => {
    it('should return a policy by ID from cache if available', async () => {
      const mockPolicy = createMockPolicy();
      mockCacheService.get.mockResolvedValue(mockPolicy);

      const result = await service.findOne('policy-123');

      expect(result).toEqual(mockPolicy);
      expect(mockPolicyRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return a policy by ID from database and cache it', async () => {
      mockCacheService.get.mockResolvedValue(null);
      const mockPolicy = createMockPolicy();
      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy);

      const result = await service.findOne('policy-123');

      expect(result).toEqual(mockPolicy);
      expect(mockPolicyRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'policy-123' },
        relations: [],
      });
      expect(mockCacheService.set).toHaveBeenCalledWith('policy:policy-123', mockPolicy, {
        ttl: 3600,
        tags: ['policies', 'policy:policy-123', 'org:org-123'],
      });
    });

    it('should throw ResourceNotFoundException when policy not found', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPolicyRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        new ResourceNotFoundException('Policy', 'non-existent')
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdatePolicyDto = {
      title: 'Updated Policy Title',
      description: 'Updated description',
      priority: PolicyPriority.CRITICAL,
    };

    it('should update a policy', async () => {
      mockCacheService.get.mockResolvedValue(null);
      const mockPolicy = createMockPolicy();
      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy);
      mockPolicyRepository.save.mockResolvedValue({ ...mockPolicy, ...updateDto });

      const result = await service.update('policy-123', updateDto, 'user-123');

      expect(result).toEqual(expect.objectContaining(updateDto));
      expect(mockPolicyRepository.save).toHaveBeenCalled();
      expect(mockSearchService.indexPolicy).toHaveBeenCalled();
      expect(mockCacheService.delete).toHaveBeenCalledWith('policy:policy-123');
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'policy.updated',
        expect.objectContaining({
          type: 'compliance.policy_updated',
          payload: expect.objectContaining({
            policyId: 'policy-123',
            changes: expect.any(Array),
          }),
          userId: 'user-123',
        })
      );
    });

    it('should check edit permissions', async () => {
      const mockPolicy = createMockPolicy();
      const policyWithPermission = {
        ...mockPolicy,
        canBeEditedBy: jest.fn().mockReturnValue(false),
      };
      mockCacheService.get.mockResolvedValue(null);
      mockPolicyRepository.findOne.mockResolvedValue(policyWithPermission);

      await expect(service.update('policy-123', updateDto, 'user-123')).rejects.toThrow(
        new InsufficientPermissionsException('update', 'Policy', 'policy-123')
      );
    });

    it('should validate status transitions', async () => {
      const updateWithInvalidStatus = {
        ...updateDto,
        status: PolicyStatus.EFFECTIVE,
      };
      const mockPolicy = createMockPolicy();
      mockCacheService.get.mockResolvedValue(null);
      mockPolicyRepository.findOne.mockResolvedValue({
        ...mockPolicy,
        status: PolicyStatus.DRAFT,
      });

      await expect(
        service.update('policy-123', updateWithInvalidStatus, 'user-123')
      ).rejects.toThrow(InvalidStateTransitionException);
    });

    it('should increment version on significant changes', async () => {
      const updateWithContent = {
        ...updateDto,
        content: { sections: [] },
      };
      mockCacheService.get.mockResolvedValue(null);
      const mockPolicy = createMockPolicy();
      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy);
      mockPolicyRepository.save.mockImplementation((policy) => Promise.resolve(policy));

      await service.update('policy-123', updateWithContent, 'user-123');

      const savedPolicy = mockPolicyRepository.save.mock.calls[0][0];
      expect(savedPolicy.version).toBe('1.0.1');
    });

    it('should compile and validate OPA policy when updated', async () => {
      const updateWithRego = {
        ...updateDto,
        regoPolicy: 'package policy\nallow = true',
      };
      mockCacheService.get.mockResolvedValue(null);
      const mockPolicy = createMockPolicy();
      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy);
      mockPolicyRepository.save.mockResolvedValue(mockPolicy);
      mockOpaService.validateRegoSyntax.mockReturnValue({ valid: true, errors: [] });
      mockOpaService.compilePolicy.mockResolvedValue({ result: { errors: [] } });

      await service.update('policy-123', updateWithRego, 'user-123');

      expect(mockOpaService.validateRegoSyntax).toHaveBeenCalledWith(updateWithRego.regoPolicy);
      expect(mockOpaService.compilePolicy).toHaveBeenCalledWith(updateWithRego.regoPolicy);
    });
  });

  describe('remove', () => {
    it('should soft delete a policy', async () => {
      mockCacheService.get.mockResolvedValue(null);
      const mockPolicy = createMockPolicy();
      mockPolicyRepository.findOne.mockResolvedValue(mockPolicy);
      mockPolicyRepository.save.mockResolvedValue({
        ...mockPolicy,
        archivedAt: new Date(),
        status: PolicyStatus.RETIRED,
      });

      await service.remove('policy-123', 'user-123');

      expect(mockPolicyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          archivedAt: expect.any(Date),
          status: PolicyStatus.RETIRED,
        })
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'policy.archived',
        expect.objectContaining({
          type: 'policy.archived',
          payload: expect.objectContaining({
            policyId: 'policy-123',
            archivedBy: 'user-123',
          }),
          userId: 'user-123',
        })
      );
    });
  });

  describe('approve', () => {
    it('should approve a policy under review', async () => {
      const mockPolicy = createMockPolicy();
      const policyUnderReview = {
        ...mockPolicy,
        status: PolicyStatus.UNDER_REVIEW,
        approvalWorkflow: {
          steps: [{ name: 'Manager Approval', status: 'pending' }],
          currentStep: 0,
          requiredApprovals: 1,
          receivedApprovals: 0,
        },
      };
      mockCacheService.get.mockResolvedValue(null);
      mockPolicyRepository.findOne.mockResolvedValue(policyUnderReview);
      mockPolicyRepository.save.mockResolvedValue({
        ...policyUnderReview,
        status: PolicyStatus.APPROVED,
        approvalDate: new Date(),
      });

      const result = await service.approve('policy-123', 'approver-123', 'Looks good');

      expect(result.status).toBe(PolicyStatus.APPROVED);
      expect(result.approvalDate).toBeDefined();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'policy.approved',
        expect.objectContaining({
          type: 'compliance.policy_approved',
          payload: expect.objectContaining({
            policyId: 'policy-123',
            approvedBy: 'approver-123',
          }),
        })
      );
    });

    it('should reject approval for invalid status', async () => {
      const mockPolicy = createMockPolicy();
      const draftPolicy = {
        ...mockPolicy,
        status: PolicyStatus.DRAFT,
      };
      mockCacheService.get.mockResolvedValue(null);
      mockPolicyRepository.findOne.mockResolvedValue(draftPolicy);

      await expect(service.approve('policy-123', 'approver-123')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('publish', () => {
    it('should publish an approved policy', async () => {
      const mockPolicy = createMockPolicy();
      const approvedPolicy = {
        ...mockPolicy,
        status: PolicyStatus.APPROVED,
        effectiveDate: new Date(Date.now() + 86400000), // Tomorrow
      };
      mockCacheService.get.mockResolvedValue(null);
      mockPolicyRepository.findOne.mockResolvedValue(approvedPolicy);
      mockPolicyRepository.save.mockResolvedValue({
        ...approvedPolicy,
        status: PolicyStatus.PUBLISHED,
        publishedDate: new Date(),
      });

      const result = await service.publish('policy-123', 'user-123');

      expect(result.status).toBe(PolicyStatus.PUBLISHED);
      expect(result.publishedDate).toBeDefined();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'policy.published',
        expect.objectContaining({
          type: 'policy.published',
          payload: expect.objectContaining({
            policyId: 'policy-123',
          }),
          userId: 'user-123',
        })
      );
    });

    it('should make policy effective immediately if date has passed', async () => {
      const mockPolicy = createMockPolicy();
      const approvedPolicy = {
        ...mockPolicy,
        status: PolicyStatus.APPROVED,
        effectiveDate: new Date(Date.now() - 86400000), // Yesterday
      };
      mockCacheService.get.mockResolvedValue(null);
      mockPolicyRepository.findOne.mockResolvedValue(approvedPolicy);
      mockPolicyRepository.save.mockImplementation((policy) => Promise.resolve(policy));

      const result = await service.publish('policy-123', 'user-123');

      expect(result.status).toBe(PolicyStatus.EFFECTIVE);
    });

    it('should reject publishing non-approved policy', async () => {
      const mockPolicy = createMockPolicy();
      const draftPolicy = {
        ...mockPolicy,
        status: PolicyStatus.DRAFT,
      };
      mockCacheService.get.mockResolvedValue(null);
      mockPolicyRepository.findOne.mockResolvedValue(draftPolicy);

      await expect(service.publish('policy-123', 'user-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('evaluatePolicy', () => {
    const context = { user: 'user-123', action: 'read', resource: 'document' };

    it('should evaluate a policy with OPA', async () => {
      const mockPolicy = createMockPolicy();
      const evaluatablePolicy = {
        ...mockPolicy,
        isEvaluatable: true,
        regoPolicy: 'package policy\nallow = true',
      };
      mockCacheService.get.mockResolvedValue(null);
      mockPolicyRepository.findOne.mockResolvedValue(evaluatablePolicy);
      mockPolicyRepository.save.mockResolvedValue(evaluatablePolicy);
      mockOpaService.generatePolicyId.mockReturnValue('org-123/SEC-2025-001');
      mockOpaService.evaluatePolicy.mockResolvedValue({
        result: true,
        decision_id: 'decision-123',
      });

      const result = await service.evaluatePolicy('policy-123', context);

      expect(result).toEqual({
        allowed: true,
        reasons: [],
        decision_id: 'decision-123',
        evaluationTime: expect.any(Number),
      });
      expect(mockOpaService.evaluatePolicy).toHaveBeenCalledWith(
        '/soc2/policies/sec-2025-001/allow',
        context
      );
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should use cached evaluation result', async () => {
      const mockPolicy = createMockPolicy();
      const evaluatablePolicy = {
        ...mockPolicy,
        isEvaluatable: true,
        regoPolicy: 'package policy\nallow = true',
      };
      const cachedResult = {
        allowed: true,
        reasons: [],
        decision_id: 'cached-123',
        evaluationTime: 10,
      };
      const cacheKey = 'evaluation:policy-123:' + JSON.stringify(context);

      // Set up mocks
      mockCacheService.buildEvaluationKey.mockReturnValue(cacheKey);
      mockCacheService.get
        .mockResolvedValueOnce(null) // First call for policy cache (findOne)
        .mockResolvedValueOnce(cachedResult); // Second call for evaluation cache
      mockPolicyRepository.findOne.mockResolvedValue(evaluatablePolicy);

      const result = await service.evaluatePolicy('policy-123', context);

      expect(result).toEqual(cachedResult);
      expect(mockOpaService.evaluatePolicy).not.toHaveBeenCalled();
    });

    it('should throw error for non-evaluatable policy', async () => {
      const mockPolicy = createMockPolicy();
      const nonEvaluatablePolicy = {
        ...mockPolicy,
        isEvaluatable: false,
        evaluationError: 'No OPA policy defined',
      };
      mockCacheService.get.mockResolvedValue(null);
      mockPolicyRepository.findOne.mockResolvedValue(nonEvaluatablePolicy);

      await expect(service.evaluatePolicy('policy-123', context)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('checkPolicyLifecycle', () => {
    const mockQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockPolicyRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockPolicyRepository.find.mockResolvedValue([]);
    });

    it('should update policies to effective when date arrives', async () => {
      mockQueryBuilder.execute.mockResolvedValue({ affected: 3 });

      await service.checkPolicyLifecycle();

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(Policy);
      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        status: PolicyStatus.EFFECTIVE,
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('status = :published', {
        published: PolicyStatus.PUBLISHED,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('effectiveDate <= :now', {
        now: expect.any(Date),
      });
    });

    it('should expire policies past expiration date', async () => {
      mockQueryBuilder.execute.mockResolvedValue({ affected: 2 });

      await service.checkPolicyLifecycle();

      expect(mockQueryBuilder.set).toHaveBeenCalledWith({
        status: PolicyStatus.RETIRED,
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('expirationDate < :now', {
        now: expect.any(Date),
      });
    });

    it('should emit events for policies needing review', async () => {
      const needingReview = [
        {
          ...createMockPolicy(),
          nextReviewDate: new Date('2024-11-01'),
        },
      ];
      mockQueryBuilder.execute.mockResolvedValue({ affected: 0 });
      mockPolicyRepository.find.mockResolvedValue(needingReview);

      await service.checkPolicyLifecycle();

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'policy.needs_review',
        expect.objectContaining({
          type: 'policy.needs_review',
          payload: expect.objectContaining({
            policyId: needingReview[0].id,
            daysOverdue: expect.any(Number),
          }),
        })
      );
    });
  });
});
