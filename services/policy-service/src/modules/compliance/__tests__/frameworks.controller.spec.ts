import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateFrameworkDto, QueryFrameworkDto, UpdateFrameworkDto } from '../dto';
import { FrameworkType } from '../entities/framework.entity';
import { FrameworksController } from '../frameworks.controller';
import { FrameworksService } from '../frameworks.service';

describe('FrameworksController', () => {
  let controller: FrameworksController;
  let service: FrameworksService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    organizationId: 'org-123',
    roles: ['admin', 'compliance_manager'],
  };

  const mockFrameworksService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByIdentifier: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getFrameworkStatistics: jest.fn(),
    getComplianceStatistics: jest.fn(),
    getCoverageReport: jest.fn(),
    getComplianceScore: jest.fn(),
    validateFramework: jest.fn(),
    getImplementationGuide: jest.fn(),
    findCrossMappings: jest.fn(),
    exportFramework: jest.fn(),
    importFramework: jest.fn(),
  };

  const mockFramework = {
    id: 'framework-123',
    identifier: 'SOC2',
    name: 'SOC 2 Type II',
    version: '2017',
    description: 'Service Organization Control 2',
    category: 'security',
    regulatoryBody: 'AICPA',
    effectiveDate: new Date('2017-01-01'),
    expirationDate: null,
    isActive: true,
    requirements: {
      sections: [
        {
          id: 'CC1',
          title: 'Control Environment',
          description: 'The control environment sets the tone of an organization',
          controls: [],
        },
      ],
    },
    certificationCriteria: {
      minimumScore: 85,
      requiredControls: ['CC1.1', 'CC1.2'],
      validityPeriod: 365,
    },
    tags: ['security', 'compliance', 'audit'],
    metadata: {
      lastReviewDate: new Date('2024-01-01'),
      nextReviewDate: new Date('2025-01-01'),
      owner: 'Compliance Team',
    },
    complianceScore: 0,
    controlCount: 0,
    policyCount: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    // Manual instantiation pattern - required due to TypeORM/Jest incompatibility
    service = mockFrameworksService as any;
    controller = new FrameworksController(service);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateFrameworkDto = {
      identifier: 'ISO27001',
      name: 'ISO/IEC 27001:2013',
      version: '2013',
      description: 'Information security management systems',
      type: FrameworkType.REGULATORY,
      category: 'security',
      regulatoryBody: 'ISO',
      metadata: {
        complianceRequirements: [
          {
            title: 'Information Security Policies',
            description: 'Management direction for information security',
          },
        ],
      },
    };

    it('should create a new framework', async () => {
      const expectedFramework = { ...mockFramework, ...createDto, id: 'new-framework-id' };
      mockFrameworksService.create.mockResolvedValue(expectedFramework);

      const result = await controller.create(createDto, mockUser as any);

      expect(result).toEqual(expectedFramework);
      expect(service.create).toHaveBeenCalledWith(createDto, mockUser);
    });

    it('should validate required fields', async () => {
      mockFrameworksService.create.mockRejectedValue(
        new BadRequestException('Identifier is required')
      );

      await expect(controller.create({} as CreateFrameworkDto, mockUser as any)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should handle duplicate identifiers', async () => {
      mockFrameworksService.create.mockRejectedValue(
        new BadRequestException('Framework with identifier ISO27001 already exists')
      );

      await expect(controller.create(createDto, mockUser as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    const mockResponse = {
      data: [mockFramework],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    };

    it('should return paginated frameworks', async () => {
      mockFrameworksService.findAll.mockResolvedValue(mockResponse);

      const query: QueryFrameworkDto = { page: 1, limit: 20 };
      const result = await controller.findAll(query);

      expect(result).toEqual(mockResponse);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should filter by category', async () => {
      const query: QueryFrameworkDto = { category: 'security' };
      mockFrameworksService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should filter by active status', async () => {
      const query: QueryFrameworkDto = { isActive: true };
      mockFrameworksService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should search by text', async () => {
      const query: QueryFrameworkDto = { search: 'SOC' };
      mockFrameworksService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should include statistics when requested', async () => {
      const query: QueryFrameworkDto = { includeStats: true };
      const responseWithStats = {
        ...mockResponse,
        meta: {
          ...mockResponse.meta,
          statistics: {
            totalControls: 100,
            totalPolicies: 50,
            averageComplianceScore: 85,
          },
        },
      };
      mockFrameworksService.findAll.mockResolvedValue(responseWithStats);

      const result = await controller.findAll(query);

      expect(result.meta.statistics).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('should return a framework by ID', async () => {
      mockFrameworksService.findOne.mockResolvedValue(mockFramework);

      const result = await controller.findOne('framework-123');

      expect(result).toEqual(mockFramework);
      expect(service.findOne).toHaveBeenCalledWith('framework-123');
    });

    it('should handle not found', async () => {
      mockFrameworksService.findOne.mockRejectedValue(new NotFoundException('Framework not found'));

      await expect(controller.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByIdentifier', () => {
    it('should return a framework by identifier', async () => {
      mockFrameworksService.findByIdentifier.mockResolvedValue(mockFramework);

      const result = await controller.findByIdentifier('SOC2');

      expect(result).toEqual(mockFramework);
      expect(service.findByIdentifier).toHaveBeenCalledWith('SOC2');
    });

    it('should handle case-insensitive search', async () => {
      mockFrameworksService.findByIdentifier.mockResolvedValue(mockFramework);

      await controller.findByIdentifier('soc2');

      expect(service.findByIdentifier).toHaveBeenCalledWith('soc2');
    });
  });

  describe('update', () => {
    const updateDto: UpdateFrameworkDto = {
      name: 'SOC 2 Type II (Updated)',
      description: 'Updated description',
      metadata: {
        officialUrl: 'https://example.com/soc2',
        certificationAvailable: true,
        updateFrequency: 'Annual',
      },
    };

    it('should update a framework', async () => {
      const updatedFramework = { ...mockFramework, ...updateDto };
      mockFrameworksService.update.mockResolvedValue(updatedFramework);

      const result = await controller.update('framework-123', updateDto, mockUser as any);

      expect(result).toEqual(updatedFramework);
      expect(service.update).toHaveBeenCalledWith('framework-123', updateDto, mockUser);
    });

    it('should validate version compatibility', async () => {
      mockFrameworksService.update.mockRejectedValue(
        new BadRequestException('Cannot change framework version')
      );

      await expect(controller.update('framework-123', { version: '2022' }, mockUser as any)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should handle not found', async () => {
      mockFrameworksService.update.mockRejectedValue(new NotFoundException('Framework not found'));

      await expect(controller.update('invalid-id', updateDto, mockUser as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a framework', async () => {
      mockFrameworksService.remove.mockResolvedValue(undefined);

      await controller.remove('framework-123', mockUser as any);

      expect(service.remove).toHaveBeenCalledWith('framework-123', mockUser);
    });

    it('should prevent deletion of frameworks with active controls', async () => {
      mockFrameworksService.remove.mockRejectedValue(
        new BadRequestException('Cannot delete framework with active controls')
      );

      await expect(controller.remove('framework-123', mockUser as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStatistics', () => {
    it('should return framework statistics', async () => {
      const stats = {
        totalControls: 100,
        implementedControls: 85,
        totalPolicies: 50,
        mappedPolicies: 45,
        complianceScore: 85,
        controlsByCategory: {
          'Common Criteria': 40,
          'Trust Services Criteria': 60,
        },
        implementationProgress: {
          notStarted: 10,
          inProgress: 5,
          implemented: 85,
        },
      };

      mockFrameworksService.getComplianceStatistics.mockResolvedValue(stats);

      const result = await controller.getStatistics('framework-123');

      expect(result).toEqual(stats);
      expect(service.getComplianceStatistics).toHaveBeenCalledWith('framework-123');
    });
  });

  describe('getCrossMappings', () => {
    it('should return cross-framework mappings', async () => {
      const mappings = {
        framework: 'SOC2',
        mappings: [
          {
            targetFramework: 'ISO27001',
            mappedControls: [
              { sourceControl: 'CC1.1', targetControl: 'A.5.1' },
              { sourceControl: 'CC1.2', targetControl: 'A.5.2' },
            ],
            coveragePercentage: 75,
          },
          {
            targetFramework: 'NIST',
            mappedControls: [{ sourceControl: 'CC1.1', targetControl: 'AC-1' }],
            coveragePercentage: 60,
          },
        ],
      };

      mockFrameworksService.findCrossMappings.mockResolvedValue(mappings);

      const result = await controller.getCrossMappings('framework-123');

      expect(result).toEqual(mappings);
      expect(service.findCrossMappings).toHaveBeenCalledWith('framework-123');
    });
  });

  describe('export', () => {
    it('should export framework data', async () => {
      const exportData = {
        framework: mockFramework,
        controls: [
          { id: 'CC1.1', title: 'Control 1.1', description: 'Description' },
          { id: 'CC1.2', title: 'Control 1.2', description: 'Description' },
        ],
        mappings: [],
        format: 'json',
        exportDate: new Date(),
      };

      mockFrameworksService.exportFramework.mockResolvedValue(exportData);

      const result = await controller.export('framework-123');

      expect(result).toEqual(exportData);
      expect(service.exportFramework).toHaveBeenCalledWith('framework-123');
    });
  });

  describe('import', () => {
    it('should import framework data', async () => {
      const importData = {
        identifier: 'CUSTOM-FW',
        name: 'Custom Framework',
        version: '1.0',
        requirements: {
          sections: [],
        },
      };

      const importedFramework = { ...mockFramework, ...importData, id: 'new-framework-id' };
      mockFrameworksService.importFramework.mockResolvedValue(importedFramework);

      const result = await controller.import(importData);

      expect(result).toEqual(importedFramework);
      expect(service.importFramework).toHaveBeenCalledWith(importData);
    });

    it('should validate import data structure', async () => {
      const invalidData = {
        name: 'Missing required fields',
      };

      mockFrameworksService.importFramework.mockRejectedValue(
        new BadRequestException('Invalid import data')
      );

      await expect(controller.import(invalidData)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCoverageReport', () => {
    it('should return coverage report', async () => {
      const report = {
        framework: mockFramework,
        coverage: {
          totalControls: 100,
          coveredControls: 85,
          coveragePercentage: 85,
          uncoveredControls: [
            { id: 'CC2.1', reason: 'No policy mapped' },
            { id: 'CC3.4', reason: 'Policy expired' },
          ],
        },
        recommendations: ['Create policy for CC2.1', 'Update expired policy for CC3.4'],
      };

      mockFrameworksService.getCoverageReport.mockResolvedValue(report);

      const result = await controller.getCoverageReport('framework-123');

      expect(result).toEqual(report);
      expect(service.getCoverageReport).toHaveBeenCalledWith('framework-123');
    });
  });

  describe('getComplianceScore', () => {
    it('should return compliance score', async () => {
      const score = {
        frameworkId: 'framework-123',
        score: 85,
        breakdown: {
          controlImplementation: 90,
          policyMapping: 85,
          evidenceCollection: 80,
          continuousMonitoring: 85,
        },
        trend: {
          current: 85,
          previous: 82,
          change: 3,
          direction: 'up',
        },
      };

      mockFrameworksService.getComplianceScore.mockResolvedValue(score);

      const result = await controller.getComplianceScore('framework-123');

      expect(result).toEqual(score);
      expect(service.getComplianceScore).toHaveBeenCalledWith('framework-123');
    });
  });

  describe('validateFramework', () => {
    it('should validate framework configuration', async () => {
      const validation = {
        valid: true,
        errors: [],
        warnings: ['Some controls have no mapped policies'],
      };

      mockFrameworksService.validateFramework.mockResolvedValue(validation);

      const result = await controller.validateFramework('framework-123');

      expect(result).toEqual(validation);
      expect(service.validateFramework).toHaveBeenCalledWith('framework-123');
    });

    it('should return validation errors', async () => {
      const validation = {
        valid: false,
        errors: ['Missing required control CC1.1', 'Invalid requirement structure'],
        warnings: [],
      };

      mockFrameworksService.validateFramework.mockResolvedValue(validation);

      const result = await controller.validateFramework('framework-123');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('getImplementationGuide', () => {
    it('should return implementation guide', async () => {
      const guide = {
        framework: mockFramework,
        steps: [
          {
            order: 1,
            title: 'Assess Current State',
            description: 'Evaluate existing controls and policies',
            estimatedDuration: '2 weeks',
            resources: ['Compliance team', 'IT security'],
          },
          {
            order: 2,
            title: 'Gap Analysis',
            description: 'Identify missing controls and policies',
            estimatedDuration: '1 week',
            resources: ['Compliance manager'],
          },
        ],
        timeline: {
          totalDuration: '3-6 months',
          phases: [
            { name: 'Assessment', duration: '1 month' },
            { name: 'Implementation', duration: '2-4 months' },
            { name: 'Validation', duration: '1 month' },
          ],
        },
        resources: {
          personnel: ['Compliance team', 'IT security', 'Legal'],
          tools: ['GRC platform', 'Document management'],
          budget: 'Varies by organization size',
        },
      };

      mockFrameworksService.getImplementationGuide.mockResolvedValue(guide);

      const result = await controller.getImplementationGuide('framework-123');

      expect(result).toEqual(guide);
      expect(service.getImplementationGuide).toHaveBeenCalledWith('framework-123');
    });
  });

  describe('Role-based access control', () => {
    it('should allow admin to perform all actions', async () => {
      const adminUser = { ...mockUser, roles: ['admin'] };
      mockFrameworksService.create.mockResolvedValue(mockFramework);

      await controller.create({} as CreateFrameworkDto, adminUser as any);

      expect(service.create).toHaveBeenCalled();
    });

    it('should allow compliance_manager to manage frameworks', async () => {
      const complianceUser = { ...mockUser, roles: ['compliance_manager'] };
      mockFrameworksService.update.mockResolvedValue(mockFramework);

      await controller.update('framework-123', {}, complianceUser as any);

      expect(service.update).toHaveBeenCalled();
    });

    it('should allow auditor read-only access', async () => {
      const auditorUser = { ...mockUser, roles: ['auditor'] };
      mockFrameworksService.findAll.mockResolvedValue({ data: [], meta: {} as any });

      await controller.findAll({});

      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockFrameworksService.findAll.mockRejectedValue(new Error('Database error'));

      await expect(controller.findAll({})).rejects.toThrow('Database error');
    });

    it('should validate framework requirements structure', async () => {
      const invalidDto = {
        identifier: 'TEST',
        requirements: 'invalid structure',
      };

      mockFrameworksService.create.mockRejectedValue(
        new BadRequestException('Invalid requirements structure')
      );

      await expect(controller.create(invalidDto as any, mockUser as any)).rejects.toThrow(BadRequestException);
    });
  });
});
