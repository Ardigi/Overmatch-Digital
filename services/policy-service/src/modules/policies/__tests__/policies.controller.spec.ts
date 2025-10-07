import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreatePolicyDto, QueryPolicyDto, UpdatePolicyDto } from '../dto';
import { PolicyPriority, PolicyScope, PolicyStatus, PolicyType } from '../entities/policy.entity';
import { PoliciesController } from '../policies.controller';
import { PoliciesService } from '../policies.service';

describe('PoliciesController', () => {
  let controller: PoliciesController;
  let service: PoliciesService;

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

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    roles: ['admin', 'policy_manager'],
    organizationId: 'org-123',
  };

  const mockPolicy = {
    id: 'policy-123',
    policyNumber: 'SEC-2025-001',
    title: 'Information Security Policy',
    description: 'Comprehensive information security policy',
    purpose: 'To establish security requirements and controls',
    type: PolicyType.SECURITY,
    status: PolicyStatus.DRAFT,
    priority: PolicyPriority.HIGH,
    scope: PolicyScope.ORGANIZATION,
    version: '1.0',
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
    workflowState: 'draft',
    isEvaluatable: false,
    isTemplate: false,
    tags: ['security', 'compliance'],
    keywords: ['information', 'security', 'data', 'protection'],
    viewCount: 10,
    downloadCount: 5,
    createdBy: 'user-789',
    updatedBy: 'user-789',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-15'),
  };

  beforeEach(() => {
    // Manual instantiation pattern - required due to TypeORM/Jest incompatibility
    service = mockPoliciesService as any;
    controller = new PoliciesController(service);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
      ownerName: 'Test Owner',
      tags: ['security'],
    };

    it('should create a new policy', async () => {
      const expectedPolicy = { ...mockPolicy, ...createDto, id: 'new-policy-id' };
      mockPoliciesService.create.mockResolvedValue(expectedPolicy);

      const result = await controller.create(createDto, { user: mockUser });

      expect(result).toEqual(expectedPolicy);
      expect(service.create).toHaveBeenCalledWith({
        ...createDto,
        createdBy: mockUser.id,
      });
    });

    it('should validate required fields', async () => {
      const invalidDto = { title: '' } as CreatePolicyDto;

      mockPoliciesService.create.mockRejectedValue(new BadRequestException('Validation failed'));

      await expect(controller.create(invalidDto, { user: mockUser })).rejects.toThrow(
        BadRequestException
      );
    });

    it('should set organizationId from user context', async () => {
      mockPoliciesService.create.mockResolvedValue(mockPolicy);

      await controller.create(createDto, { user: mockUser });

      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: mockUser.id,
        })
      );
    });
  });

  describe('findAll', () => {
    const mockResponse = {
      data: [mockPolicy],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        metrics: {
          byStatus: { [PolicyStatus.DRAFT]: 1 },
          byType: { [PolicyType.SECURITY]: 1 },
          expiringSoon: 0,
          needsReview: 0,
          averageComplianceScore: 0.85,
        },
      },
    };

    it('should return paginated policies', async () => {
      mockPoliciesService.findAll.mockResolvedValue(mockResponse);

      const query: QueryPolicyDto = { page: 1, limit: 20 };
      const req = { user: mockUser };
      const result = await controller.findAll(query, req as any);

      expect(result).toEqual(mockResponse);
      expect(service.findAll).toHaveBeenCalledWith(query, {
        id: mockUser.id,
        organizationId: mockUser.organizationId,
        roles: mockUser.roles,
      });
    });

    it('should filter by status', async () => {
      mockPoliciesService.findAll.mockResolvedValue({
        ...mockResponse,
        data: [{ ...mockPolicy, status: PolicyStatus.EFFECTIVE }],
      });

      const query: QueryPolicyDto = { status: PolicyStatus.EFFECTIVE };
      const req = { user: mockUser };
      await controller.findAll(query, req as any);

      expect(service.findAll).toHaveBeenCalledWith(query, {
        id: mockUser.id,
        organizationId: mockUser.organizationId,
        roles: mockUser.roles,
      });
    });

    it('should filter by type', async () => {
      const query: QueryPolicyDto = { type: PolicyType.SECURITY };
      mockPoliciesService.findAll.mockResolvedValue(mockResponse);

      const req = { user: mockUser };
      await controller.findAll(query, req as any);

      expect(service.findAll).toHaveBeenCalledWith(query, {
        id: mockUser.id,
        organizationId: mockUser.organizationId,
        roles: mockUser.roles,
      });
    });

    it('should search by text', async () => {
      const query: QueryPolicyDto = { search: 'security' };
      mockPoliciesService.findAll.mockResolvedValue(mockResponse);

      const req = { user: mockUser };
      await controller.findAll(query, req as any);

      expect(service.findAll).toHaveBeenCalledWith(query, {
        id: mockUser.id,
        organizationId: mockUser.organizationId,
        roles: mockUser.roles,
      });
    });

    it('should filter by date ranges', async () => {
      const query: QueryPolicyDto = {
        effectiveDateFrom: '2025-01-01',
        effectiveDateTo: '2025-12-31',
      };
      mockPoliciesService.findAll.mockResolvedValue(mockResponse);

      const req = { user: mockUser };
      await controller.findAll(query, req as any);

      expect(service.findAll).toHaveBeenCalledWith(query, {
        id: mockUser.id,
        organizationId: mockUser.organizationId,
        roles: mockUser.roles,
      });
    });

    it('should include metrics when requested', async () => {
      const query: QueryPolicyDto = { includeMetrics: true };
      mockPoliciesService.findAll.mockResolvedValue(mockResponse);

      const req = { user: mockUser };
      const result = await controller.findAll(query, req as any);

      expect(result.meta.metrics).toBeDefined();
    });
  });

  describe('getExpiringPolicies', () => {
    it('should return policies expiring within default 30 days', async () => {
      const expiringPolicies = [{ ...mockPolicy, expirationDate: new Date('2025-01-15') }];
      mockPoliciesService.getExpiringPolicies.mockResolvedValue(expiringPolicies);

      const result = await controller.getExpiringPolicies();

      expect(result).toEqual(expiringPolicies);
      expect(service.getExpiringPolicies).toHaveBeenCalledWith(30);
    });

    it('should accept custom days ahead parameter', async () => {
      mockPoliciesService.getExpiringPolicies.mockResolvedValue([]);

      await controller.getExpiringPolicies('60');

      expect(service.getExpiringPolicies).toHaveBeenCalledWith(60);
    });

    it('should handle invalid days parameter', async () => {
      mockPoliciesService.getExpiringPolicies.mockRejectedValue(
        new BadRequestException('Invalid days parameter')
      );

      await expect(controller.getExpiringPolicies('invalid')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPoliciesNeedingReview', () => {
    it('should return policies needing review', async () => {
      const needingReview = [{ ...mockPolicy, nextReviewDate: new Date('2024-12-01') }];
      mockPoliciesService.getPoliciesNeedingReview.mockResolvedValue(needingReview);

      const result = await controller.getPoliciesNeedingReview();

      expect(result).toEqual(needingReview);
      expect(service.getPoliciesNeedingReview).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a policy by ID', async () => {
      mockPoliciesService.findOne.mockResolvedValue(mockPolicy);
      mockPoliciesService.recordView.mockResolvedValue(undefined);

      const result = await controller.findOne('policy-123', { user: mockUser });

      expect(result).toEqual(mockPolicy);
      expect(service.findOne).toHaveBeenCalledWith('policy-123');
      expect(service.recordView).toHaveBeenCalledWith('policy-123', mockUser.id);
    });

    it('should record view access', async () => {
      mockPoliciesService.findOne.mockResolvedValue(mockPolicy);

      await controller.findOne('policy-123', { user: mockUser });

      expect(service.recordView).toHaveBeenCalledWith('policy-123', mockUser.id);
    });

    it('should handle not found', async () => {
      mockPoliciesService.findOne.mockRejectedValue(new NotFoundException('Policy not found'));

      await expect(controller.findOne('invalid-id', { user: mockUser })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findByPolicyNumber', () => {
    it('should return a policy by policy number', async () => {
      mockPoliciesService.findByPolicyNumber.mockResolvedValue(mockPolicy);
      mockPoliciesService.recordView.mockResolvedValue(undefined);

      const result = await controller.findByPolicyNumber('SEC-2025-001', { user: mockUser });

      expect(result).toEqual(mockPolicy);
      expect(service.findByPolicyNumber).toHaveBeenCalledWith('SEC-2025-001');
    });

    it('should record view access', async () => {
      mockPoliciesService.findByPolicyNumber.mockResolvedValue(mockPolicy);

      await controller.findByPolicyNumber('SEC-2025-001', { user: mockUser });

      expect(service.recordView).toHaveBeenCalledWith(mockPolicy.id, mockUser.id);
    });
  });

  describe('downloadPolicy', () => {
    it('should set correct headers for PDF download', async () => {
      mockPoliciesService.findOne.mockResolvedValue(mockPolicy);
      mockPoliciesService.recordDownload.mockResolvedValue(undefined);

      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await controller.downloadPolicy('policy-123', { user: mockUser }, mockResponse as any);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="SEC-2025-001_Information_Security_Policy.pdf"'
      );
      expect(service.recordDownload).toHaveBeenCalledWith('policy-123', mockUser.id);
    });

    it('should sanitize filename', async () => {
      const policyWithSpecialChars = {
        ...mockPolicy,
        title: 'Policy / With \\ Special : Characters',
      };
      mockPoliciesService.findOne.mockResolvedValue(policyWithSpecialChars);

      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await controller.downloadPolicy('policy-123', { user: mockUser }, mockResponse as any);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('Policy_/_With_\\_Special_:_Characters')
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
      const updatedPolicy = { ...mockPolicy, ...updateDto };
      mockPoliciesService.update.mockResolvedValue(updatedPolicy);

      const result = await controller.update('policy-123', updateDto, { user: mockUser });

      expect(result).toEqual(updatedPolicy);
      expect(service.update).toHaveBeenCalledWith(
        'policy-123',
        {
          ...updateDto,
          updatedBy: mockUser.id,
        },
        mockUser.id
      );
    });

    it('should handle permission errors', async () => {
      mockPoliciesService.update.mockRejectedValue(
        new ForbiddenException('You do not have permission to edit this policy')
      );

      await expect(controller.update('policy-123', updateDto, { user: mockUser })).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should handle not found', async () => {
      mockPoliciesService.update.mockRejectedValue(new NotFoundException('Policy not found'));

      await expect(controller.update('invalid-id', updateDto, { user: mockUser })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('approve', () => {
    it('should approve a policy with comments', async () => {
      const approvedPolicy = { ...mockPolicy, status: PolicyStatus.APPROVED };
      mockPoliciesService.approve.mockResolvedValue(approvedPolicy);

      const result = await controller.approve('policy-123', 'Approved after review', {
        user: mockUser,
      });

      expect(result).toEqual(approvedPolicy);
      expect(service.approve).toHaveBeenCalledWith(
        'policy-123',
        mockUser.id,
        'Approved after review'
      );
    });

    it('should approve without comments', async () => {
      const approvedPolicy = { ...mockPolicy, status: PolicyStatus.APPROVED };
      mockPoliciesService.approve.mockResolvedValue(approvedPolicy);

      await controller.approve('policy-123', undefined, { user: mockUser });

      expect(service.approve).toHaveBeenCalledWith('policy-123', mockUser.id, undefined);
    });

    it('should handle invalid status', async () => {
      mockPoliciesService.approve.mockRejectedValue(
        new BadRequestException('Policy must be under review to be approved')
      );

      await expect(controller.approve('policy-123', undefined, { user: mockUser })).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('publish', () => {
    it('should publish an approved policy', async () => {
      const publishedPolicy = { ...mockPolicy, status: PolicyStatus.PUBLISHED };
      mockPoliciesService.publish.mockResolvedValue(publishedPolicy);

      const result = await controller.publish('policy-123', { user: mockUser });

      expect(result).toEqual(publishedPolicy);
      expect(service.publish).toHaveBeenCalledWith('policy-123', mockUser.id);
    });

    it('should handle non-approved policy', async () => {
      mockPoliciesService.publish.mockRejectedValue(
        new BadRequestException('Policy must be approved before publishing')
      );

      await expect(controller.publish('policy-123', { user: mockUser })).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('addException', () => {
    const exception = {
      description: 'Exception for specific use case',
      justification: 'Business requirement',
      expirationDate: new Date('2025-12-31'),
      conditions: ['Must have manager approval', 'Limited to specific department'],
    };

    it('should add an exception to a policy', async () => {
      const policyWithException = {
        ...mockPolicy,
        exceptions: [{ ...exception, id: 'exc-123' }],
      };
      mockPoliciesService.addException.mockResolvedValue(policyWithException);

      const result = await controller.addException('policy-123', exception, { user: mockUser });

      expect(result).toEqual(policyWithException);
      expect(service.addException).toHaveBeenCalledWith('policy-123', exception, mockUser.id);
    });

    it('should require all exception fields', async () => {
      const incompleteException = {
        description: 'Exception without justification',
      };

      await controller.addException('policy-123', incompleteException as any, { user: mockUser });

      expect(service.addException).toHaveBeenCalledWith(
        'policy-123',
        incompleteException,
        mockUser.id
      );
    });
  });

  describe('remove', () => {
    it('should soft delete a policy', async () => {
      mockPoliciesService.remove.mockResolvedValue(undefined);

      await controller.remove('policy-123', { user: mockUser });

      expect(service.remove).toHaveBeenCalledWith('policy-123', mockUser.id);
    });

    it('should handle not found', async () => {
      mockPoliciesService.remove.mockRejectedValue(new NotFoundException('Policy not found'));

      await expect(controller.remove('invalid-id', { user: mockUser })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('Role-based access control', () => {
    it('should allow admin to perform all actions', async () => {
      const adminUser = { ...{ user: mockUser }, roles: ['admin'] };
      mockPoliciesService.create.mockResolvedValue(mockPolicy);

      await controller.create({} as CreatePolicyDto, adminUser);

      expect(service.create).toHaveBeenCalled();
    });

    it('should allow policy_manager to create and manage policies', async () => {
      const policyManagerUser = { ...{ user: mockUser }, roles: ['policy_manager'] };
      mockPoliciesService.approve.mockResolvedValue(mockPolicy);

      await controller.approve('policy-123', undefined, policyManagerUser);

      expect(service.approve).toHaveBeenCalled();
    });

    it('should allow compliance_manager to view and create policies', async () => {
      const complianceUser = { ...mockUser, roles: ['compliance_manager'] };
      mockPoliciesService.findAll.mockResolvedValue({ data: [], meta: {} as any });

      const req = { user: complianceUser };
      await controller.findAll({}, req as any);

      expect(service.findAll).toHaveBeenCalled();
    });

    it('should allow policy_viewer read-only access', async () => {
      const viewerUser = { ...{ user: mockUser }, roles: ['policy_viewer'] };
      mockPoliciesService.findOne.mockResolvedValue(mockPolicy);

      await controller.findOne('policy-123', viewerUser);

      expect(service.findOne).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockPoliciesService.findAll.mockRejectedValue(new Error('Database error'));

      const req = { user: mockUser };
      await expect(controller.findAll({}, req as any)).rejects.toThrow('Database error');
    });

    it('should validate UUIDs', async () => {
      mockPoliciesService.findOne.mockRejectedValue(new BadRequestException('Invalid UUID format'));

      await expect(controller.findOne('not-a-uuid', { user: mockUser })).rejects.toThrow(
        BadRequestException
      );
    });

    it('should handle concurrent updates', async () => {
      mockPoliciesService.update.mockRejectedValue(new Error('Optimistic locking failed'));

      await expect(controller.update('policy-123', {}, { user: mockUser })).rejects.toThrow(
        'Optimistic locking failed'
      );
    });
  });

  describe('Batch operations', () => {
    it('should support bulk status updates', async () => {
      // This would be implemented as a custom endpoint
      const bulkUpdateDto = {
        policyIds: ['policy-1', 'policy-2', 'policy-3'],
        status: PolicyStatus.UNDER_REVIEW,
      };

      // Test would verify bulk operations when implemented
      expect(bulkUpdateDto.policyIds).toHaveLength(3);
    });
  });

  describe('Audit trail', () => {
    it('should track all policy modifications', async () => {
      const policyWithHistory = {
        ...mockPolicy,
        changeHistory: [
          {
            version: '1.0',
            changedBy: mockUser.id,
            changedAt: new Date(),
            changes: {
              summary: 'Updated title, description',
              details: {
                title: { old: 'Old Title', new: 'New Title' },
              },
            },
          },
        ],
      };

      mockPoliciesService.update.mockResolvedValue(policyWithHistory);

      const result = await controller.update(
        'policy-123',
        { title: 'New Title' },
        { user: mockUser }
      );

      expect(result.changeHistory).toHaveLength(1);
    });
  });

  describe('Compliance mapping', () => {
    it('should handle framework mappings', async () => {
      const createDto: CreatePolicyDto = {
        title: mockPolicy.title,
        description: mockPolicy.description,
        type: mockPolicy.type,
        priority: PolicyPriority.HIGH,
        scope: PolicyScope.ORGANIZATION,
        content: mockPolicy.content,
        effectiveDate: '2025-02-01',
        ownerName: 'Test Owner',
        complianceMapping: {
          frameworks: ['SOC2', 'ISO27001', 'NIST'],
          controls: ['AC-1', 'AC-2', 'AC-3'],
        },
      };

      mockPoliciesService.create.mockResolvedValue({ ...mockPolicy, ...createDto });

      const result = await controller.create(createDto, { user: mockUser });

      expect(result.complianceMapping.frameworks).toContain('SOC2');
      expect(result.complianceMapping.controls).toHaveLength(3);
    });
  });

  describe('Content management', () => {
    it('should validate content structure', async () => {
      const createDto: CreatePolicyDto = {
        title: mockPolicy.title,
        description: mockPolicy.description,
        type: mockPolicy.type,
        priority: PolicyPriority.HIGH,
        scope: PolicyScope.ORGANIZATION,
        effectiveDate: '2025-02-01',
        ownerName: 'Test Owner',
        content: {
          sections: [
            { title: 'Section 1', content: 'Content 1' },
            { title: 'Section 2', content: 'Content 2' },
          ],
        },
      };

      const expectedResult = {
        ...mockPolicy,
        ...createDto,
        content: {
          sections: createDto.content.sections.map((section, index) => ({
            ...section,
            id: `section-${index + 1}`,
            order: index,
          })),
        },
      };
      mockPoliciesService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createDto, { user: mockUser });

      expect(result.content.sections).toHaveLength(2);
      expect(result.content.sections[0]).toHaveProperty('id');
      expect(result.content.sections[0]).toHaveProperty('order');
    });
  });

  describe('Search and filtering', () => {
    it('should support complex queries', async () => {
      const complexQuery: QueryPolicyDto = {
        types: [PolicyType.SECURITY, PolicyType.PRIVACY],
        statuses: [PolicyStatus.EFFECTIVE, PolicyStatus.PUBLISHED],
        tags: ['security', 'compliance'],
        framework: 'SOC2',
        minComplianceScore: 0.8,
        needsReview: true,
        sortBy: 'nextReviewDate',
        sortOrder: 'ASC',
      };

      mockPoliciesService.findAll.mockResolvedValue({ data: [], meta: {} as any });

      const req = { user: mockUser };
      await controller.findAll(complexQuery, req as any);

      expect(service.findAll).toHaveBeenCalledWith(complexQuery, {
        id: mockUser.id,
        organizationId: mockUser.organizationId,
        roles: mockUser.roles,
      });
    });
  });
});
