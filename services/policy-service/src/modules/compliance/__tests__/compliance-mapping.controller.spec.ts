import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ComplianceMappingController } from '../compliance-mapping.controller';
import { ComplianceMappingService } from '../compliance-mapping.service';
import { BulkMappingDto, CreateMappingDto, CreatePolicyControlMappingDto, QueryMappingDto, UpdateMappingDto } from '../dto';

describe('ComplianceMappingController', () => {
  let controller: ComplianceMappingController;
  let service: ComplianceMappingService;

  const mockComplianceMappingService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByFrameworks: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    bulkCreate: jest.fn(),
    getMappingStatistics: jest.fn(),
    getMappingCoverage: jest.fn(),
    suggestMappings: jest.fn(),
    validateMapping: jest.fn(),
    exportMappings: jest.fn(),
    importMappings: jest.fn(),
    getMappingGaps: jest.fn(),
    getMappingConflicts: jest.fn(),
    approveMappings: jest.fn(),
    rejectMappings: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    roles: ['admin', 'compliance_manager'],
  };

  const mockMapping = {
    id: 'mapping-123',
    sourceFrameworkId: 'soc2-framework',
    targetFrameworkId: 'iso27001-framework',
    mappings: [
      {
        sourceControlId: 'CC1.1',
        targetControlId: 'A.5.1.1',
        mappingType: 'equivalent',
        confidence: 0.95,
        rationale: 'Both controls address information security policy',
        evidenceMapping: {
          sourceEvidence: ['Policy document'],
          targetEvidence: ['ISMS policy'],
          overlap: 0.9,
        },
      },
      {
        sourceControlId: 'CC1.2',
        targetControlId: 'A.5.1.2',
        mappingType: 'partial',
        confidence: 0.75,
        rationale: 'Partial overlap in policy review requirements',
      },
    ],
    metadata: {
      version: '1.0',
      createdBy: 'user-123',
      approvedBy: null,
      approvalDate: null,
      lastReviewDate: new Date('2024-01-01'),
      nextReviewDate: new Date('2025-01-01'),
      notes: 'Initial mapping between SOC2 and ISO 27001',
    },
    statistics: {
      totalMappings: 2,
      equivalentMappings: 1,
      partialMappings: 1,
      relatedMappings: 0,
      averageConfidence: 0.85,
      coveragePercentage: 75,
    },
    isApproved: false,
    tags: ['security', 'compliance'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    // Manual instantiation pattern - required due to TypeORM/Jest incompatibility
    service = mockComplianceMappingService as any;
    controller = new ComplianceMappingController(service);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateMappingDto = {
      sourceFrameworkId: 'soc2-framework',
      targetFrameworkId: 'iso27001-framework',
      mappings: [
        {
          sourceControlId: 'CC2.1',
          targetControlId: 'A.9.1.1',
          mappingType: 'equivalent',
          confidence: 0.9,
          rationale: 'Both address user access management',
        },
      ],
    };

    it('should create a new mapping', async () => {
      const expectedMapping = { ...mockMapping, ...createDto, id: 'new-mapping-id' };
      mockComplianceMappingService.create.mockResolvedValue(expectedMapping);

      const result = await controller.create(createDto);

      expect(result).toEqual(expectedMapping);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    it('should validate required fields', async () => {
      mockComplianceMappingService.create.mockRejectedValue(
        new BadRequestException('Source framework ID is required')
      );

      await expect(controller.create({} as CreateMappingDto)).rejects.toThrow(BadRequestException);
    });

    it('should prevent duplicate mappings', async () => {
      mockComplianceMappingService.create.mockRejectedValue(
        new BadRequestException('Mapping already exists between these frameworks')
      );

      await expect(controller.create(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    const mockResponse = {
      data: [mockMapping],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    };

    it('should return paginated mappings', async () => {
      mockComplianceMappingService.findAll.mockResolvedValue(mockResponse);

      const query: QueryMappingDto = { page: 1, limit: 20 };
      const result = await controller.findAll(query);

      expect(result).toEqual(mockResponse);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should filter by source framework', async () => {
      const query: QueryMappingDto = { sourceFrameworkId: 'soc2-framework' };
      mockComplianceMappingService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should filter by target framework', async () => {
      const query: QueryMappingDto = { targetFrameworkId: 'iso27001-framework' };
      mockComplianceMappingService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should filter by approval status', async () => {
      const query: QueryMappingDto = { isApproved: true };
      mockComplianceMappingService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should filter by mapping type', async () => {
      const query: QueryMappingDto = { mappingType: 'equivalent' };
      mockComplianceMappingService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should filter by confidence threshold', async () => {
      const query: QueryMappingDto = { minConfidence: 0.8 };
      mockComplianceMappingService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should include statistics when requested', async () => {
      const query: QueryMappingDto = { includeStats: true };
      const responseWithStats = {
        ...mockResponse,
        meta: {
          ...mockResponse.meta,
          statistics: {
            totalMappings: 100,
            byType: {
              equivalent: 60,
              partial: 30,
              related: 10,
            },
            averageConfidence: 0.82,
            frameworkCoverage: {
              SOC2: 0.85,
              ISO27001: 0.78,
            },
          },
        },
      };
      mockComplianceMappingService.findAll.mockResolvedValue(responseWithStats);

      const result = await controller.findAll(query);

      expect(result.meta.statistics).toBeDefined();
      expect(result.meta.statistics.averageConfidence).toBe(0.82);
    });
  });

  describe('findOne', () => {
    it('should return a mapping by ID', async () => {
      mockComplianceMappingService.findOne.mockResolvedValue(mockMapping);

      const result = await controller.findOne('mapping-123');

      expect(result).toEqual(mockMapping);
      expect(service.findOne).toHaveBeenCalledWith('mapping-123');
    });

    it('should handle not found', async () => {
      mockComplianceMappingService.findOne.mockRejectedValue(
        new NotFoundException('Mapping not found')
      );

      await expect(controller.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByFrameworks', () => {
    it('should return mappings between specific frameworks', async () => {
      mockComplianceMappingService.findByFrameworks.mockResolvedValue([mockMapping]);

      const result = await controller.findByFrameworks('soc2-framework,iso27001-framework');

      expect(result).toEqual([mockMapping]);
      expect(service.findByFrameworks).toHaveBeenCalledWith(['soc2-framework', 'iso27001-framework']);
    });

    it('should handle no mapping found', async () => {
      mockComplianceMappingService.findByFrameworks.mockResolvedValue([]);

      const result = await controller.findByFrameworks('framework-1,framework-2');

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    const updateDto: UpdateMappingDto = {
      mappings: [
        {
          sourceControlId: 'CC1.1',
          targetControlId: 'A.5.1.1',
          mappingType: 'equivalent',
          confidence: 0.98,
          rationale: 'Updated rationale with more detail',
        },
      ],
    };

    it('should update a mapping', async () => {
      const updatedMapping = { ...mockMapping, ...updateDto };
      mockComplianceMappingService.update.mockResolvedValue(updatedMapping);

      const result = await controller.update('mapping-123', updateDto);

      expect(result).toEqual(updatedMapping);
      expect(service.update).toHaveBeenCalledWith('mapping-123', updateDto);
    });

    it('should prevent updating approved mappings without permission', async () => {
      mockComplianceMappingService.update.mockRejectedValue(
        new BadRequestException('Cannot update approved mapping without re-approval')
      );

      await expect(controller.update('mapping-123', updateDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should handle not found', async () => {
      mockComplianceMappingService.update.mockRejectedValue(
        new NotFoundException('Mapping not found')
      );

      await expect(controller.update('invalid-id', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a mapping', async () => {
      mockComplianceMappingService.remove.mockResolvedValue(undefined);

      await controller.remove('mapping-123');

      expect(service.remove).toHaveBeenCalledWith('mapping-123');
    });

    it('should prevent deletion of approved mappings', async () => {
      mockComplianceMappingService.remove.mockRejectedValue(
        new BadRequestException('Cannot delete approved mapping')
      );

      await expect(controller.remove('mapping-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkCreate', () => {
    const bulkMappings: CreatePolicyControlMappingDto[] = [
      {
        policyId: 'policy-123',
        controlIds: ['control-1', 'control-2'],
        notes: 'Mapping for SOC2 compliance',
      },
      {
        policyId: 'policy-456',
        controlIds: ['control-3'],
        notes: 'Additional mapping',
      },
    ];

    it('should create multiple mappings', async () => {
      const result = {
        success: 2,
        failed: 0,
        errors: [],
        created: 2,
        results: [
          { policyId: 'policy-123', controlIds: ['control-1', 'control-2'], success: true },
          { policyId: 'policy-456', controlIds: ['control-3'], success: true },
        ],
      };
      mockComplianceMappingService.bulkCreate.mockResolvedValue(result);

      const response = await controller.bulkCreate(bulkMappings);

      expect(response).toEqual(result);
      expect(service.bulkCreate).toHaveBeenCalledWith(bulkMappings);
    });

    it('should handle partial failures', async () => {
      const result = {
        success: 1,
        failed: 1,
        errors: ['Control not found'],
        created: 1,
        results: [
          { policyId: 'policy-123', controlIds: ['control-1', 'control-2'], success: true },
          {
            policyId: 'policy-456',
            controlIds: ['invalid-control'],
            success: false,
            error: 'Control not found',
          },
        ],
      };
      mockComplianceMappingService.bulkCreate.mockResolvedValue(result);

      const response = await controller.bulkCreate(bulkMappings);

      expect(response.failed).toBe(1);
      expect(response.results[1].error).toBe('Control not found');
    });
  });

  describe('getStatistics', () => {
    it('should return mapping statistics', async () => {
      const stats = {
        totalMappings: 500,
        byFramework: {
          SOC2: {
            asSource: 150,
            asTarget: 120,
            totalControls: 100,
            mappedControls: 85,
            coverage: 0.85,
          },
          ISO27001: {
            asSource: 120,
            asTarget: 150,
            totalControls: 114,
            mappedControls: 95,
            coverage: 0.83,
          },
        },
        byType: {
          equivalent: 200,
          partial: 150,
          related: 50,
        },
        averageConfidence: 0.82,
        highConfidenceMappings: 300,
        lowConfidenceMappings: 100,
        pendingApproval: 25,
        approved: 375,
      };

      mockComplianceMappingService.getMappingStatistics.mockResolvedValue(stats);

      const result = await controller.getStatistics('org-123');

      expect(result).toEqual(stats);
      expect(service.getMappingStatistics).toHaveBeenCalledWith('org-123');
    });
  });

  describe('getCoverage', () => {
    it('should return mapping coverage for frameworks', async () => {
      const coverage = {
        frameworkId: 'soc2-framework',
        name: 'SOC2',
        totalControls: 100,
        mappedControls: 85,
        unmappedControls: ['CC7.1', 'CC7.2', 'CC8.1'],
        coveragePercentage: 85,
        mappingStrength: {
          strong: 60,
          medium: 30,
          weak: 10,
        },
        recommendations: [
          'Map remaining SOC2 controls in CC7 and CC8 sections',
          'Review partial mappings for potential upgrades to equivalent',
        ],
      };

      mockComplianceMappingService.getMappingCoverage.mockResolvedValue(coverage);

      const result = await controller.getCoverage('soc2-framework');

      expect(result).toEqual(coverage);
      expect(service.getMappingCoverage).toHaveBeenCalledWith('soc2-framework');
    });
  });

  describe('suggestMappings', () => {
    it('should return mapping suggestions', async () => {
      const suggestions = {
        policyId: 'policy-123',
        frameworkId: 'iso27001-framework',
        suggestions: [
          {
            controlId: 'A.12.1.1',
            confidence: 0.75,
            rationale: 'Both controls address operational procedures',
            similarityScore: 0.78,
          },
          {
            controlId: 'A.12.1.2',
            confidence: 0.65,
            rationale: 'Related change management requirements',
            similarityScore: 0.65,
          },
        ],
        methodology: 'AI-assisted semantic analysis with manual review',
      };

      mockComplianceMappingService.suggestMappings.mockResolvedValue(suggestions);

      const result = await controller.suggestMappings('policy-123', 'iso27001-framework');

      expect(result).toEqual(suggestions);
      expect(service.suggestMappings).toHaveBeenCalledWith('policy-123', 'iso27001-framework');
    });

    it('should accept framework parameter', async () => {
      mockComplianceMappingService.suggestMappings.mockResolvedValue({ suggestions: [] });

      await controller.suggestMappings('policy-1', 'framework-2');

      expect(service.suggestMappings).toHaveBeenCalledWith('policy-1', 'framework-2');
    });
  });

  describe('validateMapping', () => {
    it('should validate a mapping', async () => {
      const validation = {
        valid: true,
        issues: [],
        errors: [],
        warnings: ['Consider adding evidence mapping for better traceability'],
        recommendations: [
          'Review confidence score - similar mappings typically have 0.9+ confidence',
        ],
      };

      mockComplianceMappingService.validateMapping.mockResolvedValue(validation);

      const result = await controller.validateMapping('mapping-123');

      expect(result).toEqual(validation);
      expect(service.validateMapping).toHaveBeenCalledWith('mapping-123');
    });

    it('should return validation errors', async () => {
      const validation = {
        valid: false,
        issues: [
          'Invalid control reference: CC99.9 does not exist',
          'Confidence score 1.5 exceeds maximum value of 1.0',
        ],
        errors: [
          'Invalid control reference: CC99.9 does not exist',
          'Confidence score 1.5 exceeds maximum value of 1.0',
        ],
        warnings: [],
        recommendations: [],
      };

      mockComplianceMappingService.validateMapping.mockResolvedValue(validation);

      const result = await controller.validateMapping('mapping-123');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('export', () => {
    it('should export mappings', async () => {
      const exportData = {
        format: 'json',
        mappings: [mockMapping],
        metadata: {
          exportDate: new Date(),
          exportedBy: 'user-123',
          format: 'json',
          version: '1.0',
        },
      };

      mockComplianceMappingService.exportMappings.mockResolvedValue(exportData);

      const result = await controller.export('json');

      expect(result).toEqual(exportData);
      expect(service.exportMappings).toHaveBeenCalledWith('json');
    });

    it('should support CSV export format', async () => {
      mockComplianceMappingService.exportMappings.mockResolvedValue({ format: 'csv' });

      await controller.export('csv');

      expect(service.exportMappings).toHaveBeenCalledWith('csv');
    });
  });

  describe('import', () => {
    it('should import mappings', async () => {
      const importData = {
        data: JSON.stringify({
          mappings: [
            {
              sourceControlId: 'CC1.1',
              targetControlId: 'AC-1',
              mappingType: 'equivalent',
              confidence: 0.9,
            },
          ],
        }),
        format: 'json',
      };

      const importResult = {
        imported: 1,
        updated: 0,
        failed: 0,
        errors: [],
        results: [
          {
            sourceControlId: 'CC1.1',
            targetControlId: 'AC-1',
            action: 'created',
            success: true,
          },
        ],
      };

      mockComplianceMappingService.importMappings.mockResolvedValue(importResult);

      const result = await controller.import(importData);

      expect(result).toEqual(importResult);
      expect(service.importMappings).toHaveBeenCalledWith(importData.data, importData.format);
    });

    it('should validate import data structure', async () => {
      const invalidData = {
        data: 'invalid data',
        format: 'json',
      };

      mockComplianceMappingService.importMappings.mockRejectedValue(
        new BadRequestException('Invalid import data')
      );

      await expect(controller.import(invalidData)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getGaps', () => {
    it('should return mapping gaps analysis', async () => {
      const gaps = {
        frameworkId: 'soc2-framework',
        name: 'SOC2',
        unmappedControls: [
          {
            controlId: 'CC7.1',
            title: 'System Operations',
            priority: 'high',
            suggestedTargets: ['A.12.1.1', 'A.12.1.2'],
          },
        ],
        impact: {
          complianceRisk: 'medium',
          implementationEffort: 'low',
          estimatedTime: '2 weeks',
        },
        recommendations: [
          'Prioritize mapping high-priority unmapped controls',
          'Consider using partial mappings for controls with no direct equivalent',
        ],
      };

      mockComplianceMappingService.getMappingGaps.mockResolvedValue(gaps);

      const result = await controller.getGaps('soc2-framework');

      expect(result).toEqual(gaps);
      expect(service.getMappingGaps).toHaveBeenCalledWith('soc2-framework');
    });
  });

  describe('getConflicts', () => {
    it('should return mapping conflicts', async () => {
      const conflicts = {
        conflicts: [
          {
            type: 'duplicate',
            description: 'Control CC1.1 is mapped to multiple targets',
            affectedMappings: [
              {
                sourceControlId: 'CC1.1',
                targetControlId: 'A.5.1.1',
                confidence: 0.9,
              },
              {
                sourceControlId: 'CC1.1',
                targetControlId: 'A.5.1.2',
                confidence: 0.8,
              },
            ],
            recommendation: 'Review and consolidate to single best mapping',
          },
          {
            type: 'circular',
            description: 'Circular mapping detected',
            affectedMappings: [
              {
                sourceControlId: 'CC2.1',
                targetControlId: 'A.9.1.1',
              },
            ],
            recommendation: 'Remove circular reference',
          },
        ],
        resolutionStrategies: [
          'Keep highest confidence mapping',
          'Merge into partial mapping with multiple targets',
          'Escalate to compliance team for review',
        ],
      };

      mockComplianceMappingService.getMappingConflicts.mockResolvedValue(conflicts);

      const result = await controller.getConflicts();

      expect(result).toEqual(conflicts);
      expect(service.getMappingConflicts).toHaveBeenCalledWith();
    });
  });

  describe('approve', () => {
    it('should approve mappings', async () => {
      const approveDto = {
        approvedBy: 'user-123',
        comments: 'Reviewed and verified',
      };

      const approvalResult = {
        approved: 1,
        failed: 0,
        errors: [],
        results: [
          { id: 'mapping-1', success: true },
        ],
      };

      mockComplianceMappingService.approveMappings.mockResolvedValue(approvalResult);

      const result = await controller.approve('mapping-1', approveDto);

      expect(result).toEqual(approvalResult);
      expect(service.approveMappings).toHaveBeenCalledWith(['mapping-1'], approveDto);
    });

    it('should handle approval failures', async () => {
      const approveDto = {
        approvedBy: 'user-123',
      };

      const approvalResult = {
        approved: 0,
        failed: 1,
        errors: ['Already approved'],
        results: [
          { id: 'mapping-2', success: false, error: 'Already approved' },
        ],
      };

      mockComplianceMappingService.approveMappings.mockResolvedValue(approvalResult);

      const result = await controller.approve('mapping-2', approveDto);

      expect(result.failed).toBe(1);
      expect(result.results[0].error).toBe('Already approved');
    });
  });

  describe('reject', () => {
    it('should reject mappings', async () => {
      const rejectDto = {
        rejectedBy: 'user-123',
        reason: 'Insufficient evidence for mapping confidence',
      };

      const rejectionResult = {
        rejected: 1,
        failed: 0,
        errors: [],
        results: [
          { id: 'mapping-1', success: true },
        ],
      };

      mockComplianceMappingService.rejectMappings.mockResolvedValue(rejectionResult);

      const result = await controller.reject('mapping-1', rejectDto);

      expect(result).toEqual(rejectionResult);
      expect(service.rejectMappings).toHaveBeenCalledWith(['mapping-1'], rejectDto);
    });
  });

  describe('Role-based access control', () => {
    it('should allow admin to perform all actions', async () => {
      const adminUser = { ...mockUser, roles: ['admin'] };
      mockComplianceMappingService.create.mockResolvedValue(mockMapping);

      await controller.create({} as CreateMappingDto);

      expect(service.create).toHaveBeenCalled();
    });

    it('should allow compliance_manager to manage mappings', async () => {
      const complianceUser = { ...mockUser, roles: ['compliance_manager'] };
      mockComplianceMappingService.update.mockResolvedValue(mockMapping);

      await controller.update('mapping-123', {});

      expect(service.update).toHaveBeenCalled();
    });

    it('should allow auditor to view mappings', async () => {
      const auditorUser = { ...mockUser, roles: ['auditor'] };
      mockComplianceMappingService.findAll.mockResolvedValue({ data: [], meta: {} as any });

      await controller.findAll({});

      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockComplianceMappingService.findAll.mockRejectedValue(new Error('Database error'));

      await expect(controller.findAll({})).rejects.toThrow('Database error');
    });

    it('should validate mapping confidence values', async () => {
      const invalidDto = {
        mappings: [
          {
            sourceControlId: 'CC1.1',
            targetControlId: 'A.1.1',
            confidence: 1.5, // Invalid - exceeds 1.0
          },
        ],
      };

      mockComplianceMappingService.create.mockRejectedValue(
        new BadRequestException('Confidence must be between 0 and 1')
      );

      await expect(controller.create(invalidDto as any)).rejects.toThrow(BadRequestException);
    });

    it('should validate mapping types', async () => {
      const invalidDto = {
        mappings: [
          {
            sourceControlId: 'CC1.1',
            targetControlId: 'A.1.1',
            mappingType: 'invalid-type',
          },
        ],
      };

      mockComplianceMappingService.create.mockRejectedValue(
        new BadRequestException('Invalid mapping type')
      );

      await expect(controller.create(invalidDto as any)).rejects.toThrow(BadRequestException);
    });
  });
});
