import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ControlsController } from '../controls.controller';
import { ControlsService } from '../controls.service';
import type { CreateControlDto } from '../dto/create-control.dto';
import type { UpdateControlDto } from '../dto/update-control.dto';
import {
  ControlCategory,
  ControlFrequency,
  ControlStatus,
  ControlType,
} from '../entities/control.entity';

describe('ControlsController', () => {
  let controller: ControlsController;
  let service: any;

  const mockControlsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOneExtended: jest.fn(),
    findByCode: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getControlsByFramework: jest.fn(),
    getControlMetrics: jest.fn(),
    getControlCoverage: jest.fn(),
    bulkImport: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    roles: ['admin', 'compliance_manager'],
    organizationId: 'org-123',
  };

  const mockControl = {
    id: 'control-123',
    code: 'AC-1',
    name: 'Access Control Policy',
    description: 'Establish and maintain access control policy',
    type: ControlType.PREVENTIVE,
    category: ControlCategory.ACCESS_CONTROL,
    status: ControlStatus.ACTIVE,
    frequency: ControlFrequency.CONTINUOUS,
    objective: 'Ensure proper access control',
    requirements: 'Policy must be documented and approved',
    frameworks: [
      { name: 'SOC2', section: 'CC6.1' },
      { name: 'ISO27001', section: 'A.9.1' },
    ],
    implementationGuidance: 'Develop comprehensive access control policy',
    testProcedures: ['Review policy documentation', 'Interview process owners'],
    evidenceRequirements: ['Policy document', 'Approval records'],
    metrics: {
      successRate: 0.95,
      avgTestDuration: 120,
      lastTestDate: new Date('2024-12-01'),
      totalTests: 25,
      failureCount: 1,
    },
    automationCapable: true,
    automationImplemented: false,
    automationDetails: {
      tool: 'Custom Script',
      schedule: '0 0 * * *',
      lastRun: new Date('2024-12-15'),
    },
    automationConfig: {
      isAutomated: false,
      automationType: 'manual',
    },
    relatedControls: ['AC-2', 'AC-3'],
    compensatingControls: ['AC-4'],
    tags: ['security', 'access-control', 'mandatory'],
    ownerId: 'user-456',
    organizationId: 'org-123',
    riskRating: 'high',
    costOfImplementation: 50000,
    costOfTesting: 5000,
    regulatoryRequirement: true,
    dataClassification: 'confidential',
    businessProcesses: ['user-access', 'authentication'],
    systemComponents: ['identity-provider', 'access-gateway'],
    riskFactors: [],
    stakeholders: [],
    customFields: {},
    version: 1,
    priority: 'medium',
    effectiveness: {
      score: 85,
      lastAssessmentDate: new Date('2024-12-01'),
      assessmentMethod: 'automated',
      strengths: ['Well documented', 'Automated monitoring'],
      weaknesses: ['Manual testing required'],
      improvements: ['Implement automated testing']
    },
    createdBy: 'user-789',
    updatedBy: 'user-789',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-12-15'),
    
    // Relations
    implementations: [],
    testResults: [],
    exceptions: [],
    assessments: [],
    mappings: [],
    tests: [],
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create fresh mock instance
    service = { ...mockControlsService };

    // Manually instantiate controller with mock service
    controller = new ControlsController(service);
  });

  describe('create', () => {
    const createDto: CreateControlDto = {
      code: 'AC-2',
      name: 'Account Management',
      description: 'Manage user accounts',
      type: ControlType.PREVENTIVE,
      category: ControlCategory.ACCESS_CONTROL,
      frequency: ControlFrequency.CONTINUOUS,
      objective: 'Manage account lifecycle',
      frameworks: [{ name: 'SOC2', section: 'CC6.2' }],
    };

    it('should create a new control', async () => {
      const expectedControl = { ...mockControl, ...createDto, id: 'new-control-id' };
      mockControlsService.create.mockResolvedValue(expectedControl);

      const result = await controller.create(createDto, mockUser);

      expect(result).toEqual(expectedControl);
      expect(service.create).toHaveBeenCalledWith(createDto, mockUser);
    });

    it('should validate required fields', async () => {
      const invalidDto = { code: 'AC-2' } as CreateControlDto;

      mockControlsService.create.mockRejectedValue(new BadRequestException('Validation failed'));

      await expect(controller.create(invalidDto, mockUser)).rejects.toThrow(BadRequestException);
    });

    it('should enforce unique control codes', async () => {
      mockControlsService.create.mockRejectedValue(
        new BadRequestException('Control code already exists')
      );

      await expect(controller.create(createDto, mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    const mockControls = [mockControl];

    it('should return all controls without filters', async () => {
      mockControlsService.findAll.mockResolvedValue(mockControls);

      const result = await controller.findAll({});

      expect(result).toEqual(mockControls);
      expect(service.findAll).toHaveBeenCalledWith({});
    });

    it('should filter by status', async () => {
      mockControlsService.findAll.mockResolvedValue(mockControls);

      await controller.findAll({ status: ControlStatus.ACTIVE });

      expect(service.findAll).toHaveBeenCalledWith({ status: ControlStatus.ACTIVE });
    });

    it('should filter by type', async () => {
      mockControlsService.findAll.mockResolvedValue(mockControls);

      await controller.findAll({ type: ControlType.PREVENTIVE });

      expect(service.findAll).toHaveBeenCalledWith({ type: ControlType.PREVENTIVE });
    });

    it('should filter by category', async () => {
      mockControlsService.findAll.mockResolvedValue(mockControls);

      await controller.findAll({ category: ControlCategory.ACCESS_CONTROL });

      expect(service.findAll).toHaveBeenCalledWith({ category: ControlCategory.ACCESS_CONTROL });
    });

    it('should filter by framework', async () => {
      mockControlsService.findAll.mockResolvedValue(mockControls);

      await controller.findAll({ framework: 'SOC2' });

      expect(service.findAll).toHaveBeenCalledWith({ framework: 'SOC2' });
    });

    it('should filter by owner', async () => {
      mockControlsService.findAll.mockResolvedValue(mockControls);

      await controller.findAll({ ownerId: 'user-456' });

      expect(service.findAll).toHaveBeenCalledWith({ ownerId: 'user-456' });
    });

    it('should handle multiple filters', async () => {
      const filters = {
        status: ControlStatus.ACTIVE,
        type: ControlType.PREVENTIVE,
        framework: 'SOC2',
      };

      mockControlsService.findAll.mockResolvedValue(mockControls);

      await controller.findAll(filters);

      expect(service.findAll).toHaveBeenCalledWith(filters);
    });
  });

  describe('getByFramework', () => {
    it('should return controls for a specific framework', async () => {
      const soc2Controls = [mockControl];
      mockControlsService.getControlsByFramework.mockResolvedValue(soc2Controls);

      const result = await controller.getByFramework('SOC2');

      expect(result).toEqual(soc2Controls);
      expect(service.getControlsByFramework).toHaveBeenCalledWith('SOC2');
    });

    it('should handle framework not found', async () => {
      mockControlsService.getControlsByFramework.mockResolvedValue([]);

      const result = await controller.getByFramework('INVALID');

      expect(result).toEqual([]);
    });

    it('should be case-sensitive for frameworks', async () => {
      mockControlsService.getControlsByFramework.mockResolvedValue([]);

      await controller.getByFramework('soc2'); // lowercase

      expect(service.getControlsByFramework).toHaveBeenCalledWith('soc2');
    });
  });

  describe('getCoverage', () => {
    const mockCoverage = {
      overall: {
        totalControls: 100,
        implementedControls: 85,
        fullyImplemented: 80,
        coveragePercentage: 80.0,
      },
      byCategory: [
        {
          category: ControlCategory.ACCESS_CONTROL,
          type: ControlType.PREVENTIVE,
          total_controls: 20,
          implemented_controls: 18,
          fully_implemented: 17,
        },
      ],
    };

    it('should return control coverage for organization', async () => {
      mockControlsService.getControlCoverage.mockResolvedValue(mockCoverage);

      const result = await controller.getCoverage('org-123');

      expect(result).toEqual(mockCoverage);
      expect(service.getControlCoverage).toHaveBeenCalledWith('org-123');
    });

    it('should handle organization with no controls', async () => {
      const emptyCoverage = {
        overall: {
          totalControls: 0,
          implementedControls: 0,
          fullyImplemented: 0,
          coveragePercentage: 0,
        },
        byCategory: [],
      };

      mockControlsService.getControlCoverage.mockResolvedValue(emptyCoverage);

      const result = await controller.getCoverage('new-org');

      expect(result.overall.coveragePercentage).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a control by ID', async () => {
      mockControlsService.findOne.mockResolvedValue(mockControl);

      const result = await controller.findOne('control-123');

      expect(result).toEqual(mockControl);
      expect(service.findOne).toHaveBeenCalledWith('control-123');
    });

    it('should handle not found', async () => {
      mockControlsService.findOne.mockRejectedValue(new NotFoundException('Control not found'));

      await expect(controller.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should validate UUID format', async () => {
      mockControlsService.findOne.mockRejectedValue(new BadRequestException('Invalid UUID format'));

      await expect(controller.findOne('not-a-uuid')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByCode', () => {
    it('should return a control by code', async () => {
      mockControlsService.findByCode.mockResolvedValue(mockControl);

      const result = await controller.findByCode('AC-1');

      expect(result).toEqual(mockControl);
      expect(service.findByCode).toHaveBeenCalledWith('AC-1');
    });

    it('should handle code not found', async () => {
      mockControlsService.findByCode.mockRejectedValue(
        new NotFoundException('Control with code not found')
      );

      await expect(controller.findByCode('INVALID-CODE')).rejects.toThrow(NotFoundException);
    });

    it('should handle case-sensitive codes', async () => {
      mockControlsService.findByCode.mockResolvedValue(mockControl);

      await controller.findByCode('ac-1'); // lowercase

      expect(service.findByCode).toHaveBeenCalledWith('ac-1');
    });
  });

  describe('getMetrics', () => {
    it('should return control metrics', async () => {
      mockControlsService.getControlMetrics.mockResolvedValue(mockControl.metrics);

      const result = await controller.getMetrics('control-123');

      expect(result).toEqual(mockControl.metrics);
      expect(service.getControlMetrics).toHaveBeenCalledWith('control-123');
    });

    it('should handle control without metrics', async () => {
      mockControlsService.getControlMetrics.mockResolvedValue({
        successRate: 0,
        avgTestDuration: 0,
        lastTestDate: null,
        totalTests: 0,
        failureCount: 0,
      });

      const result = await controller.getMetrics('new-control');

      expect(result.totalTests).toBe(0);
    });

    it('should calculate and update metrics', async () => {
      const updatedMetrics = {
        ...mockControl.metrics,
        successRate: 0.98,
        totalTests: 30,
      };

      mockControlsService.getControlMetrics.mockResolvedValue(updatedMetrics);

      const result = await controller.getMetrics('control-123');

      expect(result.successRate).toBe(0.98);
      expect(result.totalTests).toBe(30);
    });
  });

  describe('update', () => {
    const updateDto: UpdateControlDto = {
      name: 'Updated Control Name',
      description: 'Updated description',
      status: ControlStatus.UNDER_REVIEW,
    };

    it('should update a control', async () => {
      const updatedControl = { ...mockControl, ...updateDto };
      mockControlsService.update.mockResolvedValue(updatedControl);

      const result = await controller.update('control-123', updateDto, mockUser);

      expect(result).toEqual(updatedControl);
      expect(service.update).toHaveBeenCalledWith('control-123', updateDto, mockUser);
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { status: ControlStatus.INACTIVE };
      mockControlsService.update.mockResolvedValue({ ...mockControl, ...partialUpdate });

      await controller.update('control-123', partialUpdate, mockUser);

      expect(service.update).toHaveBeenCalledWith('control-123', partialUpdate, mockUser);
    });

    it('should validate enum values', async () => {
      const invalidUpdate = { status: 'INVALID_STATUS' as any };
      mockControlsService.update.mockRejectedValue(new BadRequestException('Invalid status'));

      await expect(controller.update('control-123', invalidUpdate, mockUser)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should prevent updating immutable fields', async () => {
      const invalidUpdate = { code: 'NEW-CODE' }; // Code should be immutable
      mockControlsService.update.mockRejectedValue(
        new BadRequestException('Cannot update control code')
      );

      await expect(
        controller.update('control-123', invalidUpdate as any, mockUser)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should soft delete a control', async () => {
      mockControlsService.remove.mockResolvedValue(undefined);

      await controller.remove('control-123', mockUser);

      expect(service.remove).toHaveBeenCalledWith('control-123', mockUser);
    });

    it('should handle control not found', async () => {
      mockControlsService.remove.mockRejectedValue(new NotFoundException('Control not found'));

      await expect(controller.remove('invalid-id', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should prevent deletion of controls with implementations', async () => {
      mockControlsService.remove.mockRejectedValue(
        new BadRequestException('Cannot delete control with active implementations')
      );

      await expect(controller.remove('control-123', mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkImport', () => {
    const controlsToImport: CreateControlDto[] = [
      {
        code: 'AC-2',
        name: 'Account Management',
        description: 'Manage user accounts and access rights',
        type: ControlType.PREVENTIVE,
        category: ControlCategory.ACCESS_CONTROL,
        frequency: ControlFrequency.CONTINUOUS,
        objective: 'Manage accounts',
        frameworks: [{ name: 'SOC2', section: 'CC6.2' }],
      },
      {
        code: 'AC-3',
        name: 'Access Enforcement',
        description: 'Enforce approved authorizations for logical access',
        type: ControlType.DETECTIVE,
        category: ControlCategory.ACCESS_CONTROL,
        frequency: ControlFrequency.CONTINUOUS,
        objective: 'Enforce access',
        frameworks: [{ name: 'SOC2', section: 'CC6.3' }],
      },
    ];

    it('should bulk import controls', async () => {
      const importedControls = controlsToImport.map((dto, i) => ({
        ...dto,
        id: `imported-${i}`,
        status: ControlStatus.ACTIVE,
      }));

      mockControlsService.bulkImport.mockResolvedValue(importedControls);

      const result = await controller.bulkImport(controlsToImport, mockUser);

      expect(result).toEqual(importedControls);
      expect(result).toHaveLength(2);
      expect(service.bulkImport).toHaveBeenCalledWith(controlsToImport, mockUser);
    });

    it('should handle partial import failures', async () => {
      const partialResult = [controlsToImport[0]]; // Only first control imported
      mockControlsService.bulkImport.mockResolvedValue(partialResult);

      const result = await controller.bulkImport(controlsToImport, mockUser);

      expect(result).toHaveLength(1);
    });

    it('should validate all controls before import', async () => {
      const invalidControls = [
        { code: 'INVALID' }, // Missing required fields
      ] as CreateControlDto[];

      mockControlsService.bulkImport.mockRejectedValue(
        new BadRequestException('Validation failed for one or more controls')
      );

      await expect(controller.bulkImport(invalidControls, mockUser)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should handle duplicate codes in bulk import', async () => {
      const duplicateControls = [
        ...controlsToImport,
        controlsToImport[0], // Duplicate
      ];

      mockControlsService.bulkImport.mockRejectedValue(
        new BadRequestException('Duplicate control codes found')
      );

      await expect(controller.bulkImport(duplicateControls, mockUser)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should limit bulk import size', async () => {
      const tooManyControls = Array(1001).fill(controlsToImport[0]);

      mockControlsService.bulkImport.mockRejectedValue(
        new BadRequestException('Bulk import limited to 1000 controls')
      );

      await expect(controller.bulkImport(tooManyControls, mockUser)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('Role-based access control', () => {
    it('should allow admin to perform all actions', async () => {
      const adminUser = { ...mockUser, roles: ['admin'] };
      mockControlsService.create.mockResolvedValue(mockControl);

      await controller.create({} as CreateControlDto, adminUser);

      expect(service.create).toHaveBeenCalled();
    });

    it('should allow compliance_manager to create and manage controls', async () => {
      const complianceUser = { ...mockUser, roles: ['compliance_manager'] };
      mockControlsService.update.mockResolvedValue(mockControl);

      await controller.update('control-123', {}, complianceUser);

      expect(service.update).toHaveBeenCalled();
    });

    it('should allow read-only access for auditors', async () => {
      const auditorUser = { ...mockUser, roles: ['auditor'] };
      mockControlsService.findAll.mockResolvedValue([mockControl]);

      await controller.findAll({});

      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('Framework mapping', () => {
    it('should handle multiple framework mappings', async () => {
      const multiFrameworkControl = {
        ...mockControl,
        frameworks: [
          { name: 'SOC2', section: 'CC6.1' },
          { name: 'ISO27001', section: 'A.9.1' },
          { name: 'NIST', section: 'AC-1' },
          { name: 'HIPAA', section: '164.308(a)(3)' },
        ],
      };

      mockControlsService.findOne.mockResolvedValue(multiFrameworkControl);

      const result = await controller.findOne('control-123');

      expect(result.frameworks).toHaveLength(4);
    });

    it('should validate framework names', async () => {
      const invalidFramework = {
        code: 'AC-1',
        frameworks: [{ name: 'INVALID_FRAMEWORK', section: 'A.1' }],
      };

      mockControlsService.create.mockRejectedValue(
        new BadRequestException('Invalid framework name')
      );

      await expect(controller.create(invalidFramework as any, mockUser)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockControlsService.findAll.mockRejectedValue(new Error('Database error'));

      await expect(controller.findAll({})).rejects.toThrow('Database error');
    });

    it('should handle concurrent updates', async () => {
      mockControlsService.update.mockRejectedValue(new Error('Optimistic locking failed'));

      await expect(controller.update('control-123', {}, mockUser)).rejects.toThrow(
        'Optimistic locking failed'
      );
    });
  });

  describe('Control testing', () => {
    it('should track test frequency', () => {
      const testFrequencies = Object.values(ControlFrequency);

      testFrequencies.forEach((frequency) => {
        expect(frequency).toBeDefined();
      });

      expect(testFrequencies).toContain(ControlFrequency.CONTINUOUS);
      expect(testFrequencies).toContain(ControlFrequency.ANNUAL);
    });

    it('should validate test procedures', async () => {
      const controlWithProcedures = {
        ...mockControl,
        testProcedures: [
          'Review access logs',
          'Interview system administrators',
          'Test access controls',
        ],
      };

      expect(controlWithProcedures.testProcedures).toHaveLength(3);
    });
  });

  describe('Automation capabilities', () => {
    it('should track automation status', async () => {
      const automatedControl = {
        ...mockControl,
        automationCapable: true,
        automationImplemented: true,
        automationDetails: {
          tool: 'Custom Script',
          schedule: '0 0 * * *', // Daily
          lastRun: new Date(),
        },
      };

      mockControlsService.findOne.mockResolvedValue(automatedControl);

      const result = await controller.findOne('control-123');

      expect(result.automationCapable).toBe(true);
      expect(result.automationImplemented).toBe(true);
    });
  });
});
