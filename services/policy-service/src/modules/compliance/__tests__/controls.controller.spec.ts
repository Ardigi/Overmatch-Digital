import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ControlsController } from '../controls.controller';
import { ControlsService } from '../controls.service';
import type { CreateControlDto, QueryControlDto, UpdateControlDto } from '../dto';
import {
  ControlFrequency,
  ControlPriority,
  ControlStatus,
  ControlType,
} from '../entities/control.entity';

describe('ControlsController', () => {
  let controller: ControlsController;
  let service: ControlsService;

  const mockControlsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByControlId: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getControlStatistics: jest.fn(),
    getImplementationStatus: jest.fn(),
    getControlTestResults: jest.fn(),
    scheduleTest: jest.fn(),
    recordTestResult: jest.fn(),
    getControlEvidence: jest.fn(),
    attachEvidence: jest.fn(),
    removeEvidence: jest.fn(),
    bulkOperation: jest.fn(),
    exportControls: jest.fn(),
    importControls: jest.fn(),
    validateControl: jest.fn(),
    getControlGaps: jest.fn(),
    getControlRiskAssessment: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    roles: ['admin', 'compliance_manager'],
  };

  const mockControl = {
    id: 'control-123',
    controlId: 'AC-1',
    title: 'Access Control Policy and Procedures',
    description: 'The organization develops, documents, and disseminates an access control policy',
    type: ControlType.PREVENTIVE,
    status: ControlStatus.IMPLEMENTED,
    priority: ControlPriority.HIGH,
    frequency: ControlFrequency.ANNUAL,
    frameworkId: 'framework-123',
    category: 'Access Control',
    implementationDetails: {
      description: 'Policy documented and approved',
      responsibleParty: 'Security Team',
      implementationDate: new Date('2024-01-01'),
      lastReviewDate: new Date('2024-06-01'),
      nextReviewDate: new Date('2025-01-01'),
    },
    testingProcedure: {
      steps: [
        'Review access control policy document',
        'Verify approval signatures',
        'Check dissemination records',
      ],
      expectedResults: 'Policy is current and properly disseminated',
      testingTools: ['Document review checklist'],
    },
    evidenceRequirements: [
      'Access control policy document',
      'Approval records',
      'Distribution list',
    ],
    automationCapable: false,
    compensatingControls: [],
    relatedControls: ['AC-2', 'AC-3'],
    tags: ['access-control', 'policy'],
    riskScore: 8,
    complianceScore: 0.85,
    lastTestDate: new Date('2024-06-01'),
    nextTestDate: new Date('2025-06-01'),
    testResults: [],
    evidence: [],
    metadata: {
      source: 'NIST 800-53',
      version: 'Rev 5',
      lastModifiedBy: 'admin',
      approvedBy: 'compliance_manager',
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
  };

  beforeEach(() => {
    // Manual instantiation pattern - required due to TypeORM/Jest incompatibility
    service = mockControlsService as any;
    controller = new ControlsController(service);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateControlDto = {
      controlId: 'AC-2',
      identifier: 'AC-2',
      title: 'Account Management',
      description: 'The organization manages information system accounts',
      type: ControlType.PREVENTIVE,
      priority: ControlPriority.HIGH,
      frequency: ControlFrequency.CONTINUOUS,
      frameworkId: 'framework-123',
      category: 'Access Control',
    };

    it('should create a new control', async () => {
      const expectedControl = { ...mockControl, ...createDto, id: 'new-control-id' };
      mockControlsService.create.mockResolvedValue(expectedControl);

      const result = await controller.create(createDto);

      expect(result).toEqual(expectedControl);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    it('should validate required fields', async () => {
      mockControlsService.create.mockRejectedValue(
        new BadRequestException('Control ID is required')
      );

      await expect(controller.create({} as CreateControlDto)).rejects.toThrow(BadRequestException);
    });

    it('should handle duplicate control IDs', async () => {
      mockControlsService.create.mockRejectedValue(
        new BadRequestException('Control with ID AC-2 already exists')
      );

      await expect(controller.create(createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    const mockResponse = {
      data: [mockControl],
      items: [mockControl],
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

    it('should return paginated controls', async () => {
      mockControlsService.findAll.mockResolvedValue(mockResponse);

      const query: QueryControlDto = { page: 1, limit: 20 };
      const result = await controller.findAll(query);

      expect(result).toEqual(mockResponse);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should filter by framework', async () => {
      const query: QueryControlDto = { frameworkId: 'framework-123' };
      mockControlsService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should filter by type', async () => {
      const query: QueryControlDto = { type: ControlType.PREVENTIVE };
      mockControlsService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should filter by status', async () => {
      const query: QueryControlDto = { status: ControlStatus.IMPLEMENTED };
      mockControlsService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should filter by category', async () => {
      const query: QueryControlDto = { category: 'Access Control' };
      mockControlsService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should search by text', async () => {
      const query: QueryControlDto = { search: 'access' };
      mockControlsService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should filter by automation capability', async () => {
      const query: QueryControlDto = { automationCapable: true };
      mockControlsService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should filter by testing due status', async () => {
      const query: QueryControlDto = { testingDue: true };
      mockControlsService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should filter by risk score range', async () => {
      const query: QueryControlDto = { minRiskScore: 5, maxRiskScore: 10 };
      mockControlsService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should include statistics when requested', async () => {
      const query: QueryControlDto = { includeStats: true };
      const responseWithStats = {
        ...mockResponse,
        meta: {
          ...mockResponse.meta,
          statistics: {
            total: 100,
            byStatus: {
              [ControlStatus.IMPLEMENTED]: 70,
              [ControlStatus.PLANNED]: 20,
              [ControlStatus.NOT_APPLICABLE]: 10,
            },
            byType: {
              [ControlType.PREVENTIVE]: 50,
              [ControlType.DETECTIVE]: 30,
              [ControlType.CORRECTIVE]: 20,
            },
            automationRate: 0.35,
            averageComplianceScore: 0.82,
            testingDue: 15,
          },
        },
      };
      mockControlsService.findAll.mockResolvedValue(responseWithStats);

      const result = await controller.findAll(query);

      expect(result.meta.statistics).toBeDefined();
      expect(result.meta.statistics.automationRate).toBe(0.35);
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
  });

  describe('findByControlId', () => {
    it('should return a control by control ID', async () => {
      mockControlsService.findByControlId.mockResolvedValue(mockControl);

      const result = await controller.findByControlId('AC-1');

      expect(result).toEqual(mockControl);
      expect(service.findByControlId).toHaveBeenCalledWith('AC-1');
    });

    it('should handle case-insensitive search', async () => {
      mockControlsService.findByControlId.mockResolvedValue(mockControl);

      await controller.findByControlId('ac-1');

      expect(service.findByControlId).toHaveBeenCalledWith('ac-1');
    });
  });

  describe('update', () => {
    const updateDto: UpdateControlDto = {
      title: 'Access Control Policy and Procedures (Updated)',
      description: 'Updated description',
      priority: ControlPriority.CRITICAL,
    };

    it('should update a control', async () => {
      const updatedControl = { ...mockControl, ...updateDto };
      mockControlsService.update.mockResolvedValue(updatedControl);

      const result = await controller.update('control-123', updateDto);

      expect(result).toEqual(updatedControl);
      expect(service.update).toHaveBeenCalledWith('control-123', updateDto);
    });

    it('should validate status transitions', async () => {
      mockControlsService.update.mockRejectedValue(
        new BadRequestException('Invalid status transition')
      );

      await expect(
        controller.update('control-123', { priority: ControlPriority.LOW })
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle not found', async () => {
      mockControlsService.update.mockRejectedValue(new NotFoundException('Control not found'));

      await expect(controller.update('invalid-id', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a control', async () => {
      mockControlsService.remove.mockResolvedValue(undefined);

      await controller.remove('control-123');

      expect(service.remove).toHaveBeenCalledWith('control-123');
    });

    it('should prevent deletion of controls with dependencies', async () => {
      mockControlsService.remove.mockRejectedValue(
        new BadRequestException('Cannot delete control with active test schedules')
      );

      await expect(controller.remove('control-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStatistics', () => {
    it('should return control statistics', async () => {
      const stats = {
        controlId: 'AC-1',
        implementationStatus: 'Fully Implemented',
        complianceScore: 0.85,
        testHistory: {
          totalTests: 10,
          passedTests: 8,
          failedTests: 2,
          successRate: 0.8,
        },
        evidenceStatus: {
          required: 5,
          collected: 4,
          verified: 3,
          completeness: 0.8,
        },
        riskMetrics: {
          inherentRisk: 8,
          residualRisk: 3,
          riskReduction: 0.625,
        },
        lastTestResult: {
          date: new Date('2024-06-01'),
          result: 'Pass',
          findings: [],
        },
        nextTestDate: new Date('2025-06-01'),
      };

      mockControlsService.getControlStatistics.mockResolvedValue(stats);

      const result = await controller.getStatistics('control-123');

      expect(result).toEqual(stats);
      expect(service.getControlStatistics).toHaveBeenCalledWith('control-123');
    });
  });

  describe('getImplementationStatus', () => {
    it('should return implementation status', async () => {
      const status = {
        control: mockControl,
        implementationProgress: {
          status: 'In Progress',
          completedSteps: 3,
          totalSteps: 5,
          percentComplete: 60,
        },
        dependencies: {
          policies: ['POL-001', 'POL-002'],
          procedures: ['PROC-001'],
          technologies: ['SIEM', 'IAM'],
        },
        timeline: {
          plannedStart: new Date('2024-01-01'),
          actualStart: new Date('2024-01-15'),
          plannedCompletion: new Date('2024-06-01'),
          currentDelay: 14,
        },
        blockers: [],
        nextActions: ['Complete SIEM integration', 'Conduct initial testing'],
      };

      mockControlsService.getImplementationStatus.mockResolvedValue(status);

      const result = await controller.getImplementationStatus('control-123');

      expect(result).toEqual(status);
      expect(service.getImplementationStatus).toHaveBeenCalledWith('control-123');
    });
  });

  describe('getTestResults', () => {
    it('should return test results', async () => {
      const testResults = {
        control: mockControl,
        results: [
          {
            id: 'test-001',
            testDate: new Date('2024-06-01'),
            tester: 'auditor-123',
            result: 'Pass',
            findings: [],
            evidence: ['evidence-001'],
            notes: 'Control operating effectively',
          },
          {
            id: 'test-002',
            testDate: new Date('2024-03-01'),
            tester: 'auditor-456',
            result: 'Fail',
            findings: ['Finding 1', 'Finding 2'],
            evidence: ['evidence-002'],
            notes: 'Issues identified',
          },
        ],
        summary: {
          totalTests: 2,
          passed: 1,
          failed: 1,
          successRate: 0.5,
          trend: 'improving',
        },
      };

      mockControlsService.getControlTestResults.mockResolvedValue(testResults);

      const result = await controller.getTestResults('control-123');

      expect(result).toEqual(testResults);
      expect(service.getControlTestResults).toHaveBeenCalledWith('control-123');
    });
  });

  describe('scheduleTest', () => {
    it('should schedule a control test', async () => {
      const scheduleDto = {
        testDate: new Date('2025-01-01'),
        tester: 'auditor-123',
        notes: 'Annual test',
      };

      const scheduledTest = {
        id: 'schedule-001',
        controlId: 'control-123',
        ...scheduleDto,
        status: 'Scheduled',
        createdAt: new Date(),
      };

      mockControlsService.scheduleTest.mockResolvedValue(scheduledTest);

      const result = await controller.scheduleTest('control-123', scheduleDto);

      expect(result).toEqual(scheduledTest);
      expect(service.scheduleTest).toHaveBeenCalledWith('control-123', scheduleDto);
    });
  });

  describe('recordTestResult', () => {
    it('should record test result', async () => {
      const testResultDto = {
        testDate: new Date('2024-06-01'),
        tester: 'auditor-123',
        result: 'Pass',
        findings: [],
        evidence: ['evidence-001'],
        notes: 'Control operating effectively',
      };

      const updatedControl = {
        ...mockControl,
        lastTestDate: testResultDto.testDate,
        testResults: [...mockControl.testResults, testResultDto],
      };

      mockControlsService.recordTestResult.mockResolvedValue(updatedControl);

      const result = await controller.recordTestResult('control-123', testResultDto);

      expect(result).toEqual(updatedControl);
      expect(service.recordTestResult).toHaveBeenCalledWith('control-123', testResultDto);
    });

    it('should validate test result data', async () => {
      const invalidResult = {
        result: 'Invalid',
      };

      mockControlsService.recordTestResult.mockRejectedValue(
        new BadRequestException('Invalid test result')
      );

      await expect(
        controller.recordTestResult('control-123', invalidResult as any)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getEvidence', () => {
    it('should return control evidence', async () => {
      const evidence = {
        control: mockControl,
        evidence: [
          {
            id: 'evidence-001',
            type: 'Document',
            name: 'Access Control Policy',
            description: 'Current access control policy document',
            uploadedBy: 'user-123',
            uploadedAt: new Date('2024-01-01'),
            verified: true,
            verifiedBy: 'auditor-123',
            verifiedAt: new Date('2024-01-15'),
          },
        ],
        requirements: ['Access control policy document', 'Approval records'],
        completeness: {
          required: 2,
          collected: 1,
          percentage: 50,
        },
      };

      mockControlsService.getControlEvidence.mockResolvedValue(evidence);

      const result = await controller.getEvidence('control-123');

      expect(result).toEqual(evidence);
      expect(service.getControlEvidence).toHaveBeenCalledWith('control-123');
    });
  });

  describe('attachEvidence', () => {
    it('should attach evidence to control', async () => {
      const evidenceDto = {
        type: 'Document',
        name: 'Approval Records',
        description: 'Management approval for policy',
        fileId: 'file-123',
      };

      const updatedControl = {
        ...mockControl,
        evidence: [...mockControl.evidence, { ...evidenceDto, id: 'evidence-002' }],
      };

      mockControlsService.attachEvidence.mockResolvedValue(updatedControl);

      const result = await controller.attachEvidence('control-123', evidenceDto);

      expect(result).toEqual(updatedControl);
      expect(service.attachEvidence).toHaveBeenCalledWith('control-123', evidenceDto);
    });
  });

  describe('removeEvidence', () => {
    it('should remove evidence from control', async () => {
      mockControlsService.removeEvidence.mockResolvedValue(mockControl);

      const result = await controller.removeEvidence('control-123', 'evidence-001');

      expect(result).toEqual(mockControl);
      expect(service.removeEvidence).toHaveBeenCalledWith('control-123', 'evidence-001');
    });
  });

  describe('bulkUpdate', () => {
    it('should perform bulk update operations', async () => {
      const bulkDto = {
        controlIds: ['control-1', 'control-2', 'control-3'],
        operation: 'updateStatus',
        data: { status: ControlStatus.UNDER_REVIEW },
      };

      const bulkResult = {
        success: 3,
        failed: 0,
        results: [
          { id: 'control-1', success: true },
          { id: 'control-2', success: true },
          { id: 'control-3', success: true },
        ],
      };

      mockControlsService.bulkOperation.mockResolvedValue(bulkResult);

      const result = await controller.bulkUpdate(bulkDto);

      expect(result).toEqual(bulkResult);
      expect(service.bulkOperation).toHaveBeenCalledWith(bulkDto);
    });

    it('should handle partial failures', async () => {
      const bulkDto = {
        controlIds: ['control-1', 'control-2', 'control-3'],
        operation: 'scheduleTest',
        data: { testDate: new Date('2025-01-01') },
      };

      const partialResult = {
        success: 2,
        failed: 1,
        results: [
          { id: 'control-1', success: true },
          { id: 'control-2', success: true },
          { id: 'control-3', success: false, error: 'Test already scheduled' },
        ],
      };

      mockControlsService.bulkOperation.mockResolvedValue(partialResult);

      const result = await controller.bulkUpdate(bulkDto);

      expect(result.failed).toBe(1);
      expect(result.results[2].error).toBe('Test already scheduled');
    });
  });

  describe('export', () => {
    it('should export controls', async () => {
      const exportData = {
        framework: 'NIST 800-53',
        controls: [mockControl],
        metadata: {
          exportDate: new Date(),
          exportedBy: 'user-123',
          format: 'json',
          version: '1.0',
        },
      };

      mockControlsService.exportControls.mockResolvedValue(exportData);

      const result = await controller.export({ frameworkId: 'framework-123', format: 'json' });

      expect(result).toEqual(exportData);
      expect(service.exportControls).toHaveBeenCalledWith({
        frameworkId: 'framework-123',
        format: 'json',
      });
    });
  });

  describe('import', () => {
    it('should import controls', async () => {
      const importData = {
        framework: 'NIST 800-53',
        controls: [
          {
            controlId: 'AC-2',
            title: 'Account Management',
            description: 'The organization manages information system accounts',
            type: ControlType.PREVENTIVE,
          },
        ],
      };

      const importResult = {
        imported: 1,
        updated: 0,
        failed: 0,
        results: [{ controlId: 'AC-2', action: 'created', success: true }],
      };

      mockControlsService.importControls.mockResolvedValue(importResult);

      const result = await controller.import(importData);

      expect(result).toEqual(importResult);
      expect(service.importControls).toHaveBeenCalledWith(importData);
    });

    it('should validate import data structure', async () => {
      const invalidData = {
        controls: 'invalid',
      };

      mockControlsService.importControls.mockRejectedValue(
        new BadRequestException('Invalid import data')
      );

      await expect(controller.import(invalidData as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateControl', () => {
    it('should validate control configuration', async () => {
      const validation = {
        valid: true,
        errors: [],
        warnings: ['Consider adding automation capability'],
        recommendations: ['Link related policies for better traceability'],
      };

      mockControlsService.validateControl.mockResolvedValue(validation);

      const result = await controller.validateControl('control-123');

      expect(result).toEqual(validation);
      expect(service.validateControl).toHaveBeenCalledWith('control-123');
    });

    it('should return validation errors', async () => {
      const validation = {
        valid: false,
        errors: ['Missing testing procedure', 'Invalid frequency configuration'],
        warnings: [],
        recommendations: [],
      };

      mockControlsService.validateControl.mockResolvedValue(validation);

      const result = await controller.validateControl('control-123');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('getControlGaps', () => {
    it('should return control gaps analysis', async () => {
      const gaps = {
        control: mockControl,
        gaps: [
          {
            type: 'Implementation',
            description: 'SIEM integration not completed',
            severity: 'Medium',
            remediation: 'Complete SIEM integration by Q2',
            effort: 'Medium',
            timeline: '2 months',
          },
          {
            type: 'Testing',
            description: 'No automated testing configured',
            severity: 'Low',
            remediation: 'Implement automated testing scripts',
            effort: 'Low',
            timeline: '1 month',
          },
        ],
        maturityLevel: {
          current: 3,
          target: 4,
          gap: 1,
        },
        recommendations: ['Prioritize SIEM integration', 'Develop automated testing capabilities'],
      };

      mockControlsService.getControlGaps.mockResolvedValue(gaps);

      const result = await controller.getControlGaps('control-123');

      expect(result).toEqual(gaps);
      expect(service.getControlGaps).toHaveBeenCalledWith('control-123');
    });
  });

  describe('getRiskAssessment', () => {
    it('should return control risk assessment', async () => {
      const riskAssessment = {
        control: mockControl,
        inherentRisk: {
          likelihood: 4,
          impact: 5,
          score: 20,
          level: 'Critical',
        },
        controlEffectiveness: {
          design: 0.9,
          implementation: 0.8,
          operation: 0.85,
          overall: 0.85,
        },
        residualRisk: {
          likelihood: 2,
          impact: 5,
          score: 10,
          level: 'Medium',
        },
        riskReduction: {
          percentage: 50,
          category: 'Significant',
        },
        trends: {
          direction: 'Decreasing',
          historicalScores: [
            { date: new Date('2024-01-01'), score: 15 },
            { date: new Date('2024-04-01'), score: 12 },
            { date: new Date('2024-07-01'), score: 10 },
          ],
        },
        recommendations: [
          'Continue monitoring effectiveness',
          'Consider additional compensating controls',
        ],
      };

      mockControlsService.getControlRiskAssessment.mockResolvedValue(riskAssessment);

      const result = await controller.getRiskAssessment('control-123');

      expect(result).toEqual(riskAssessment);
      expect(service.getControlRiskAssessment).toHaveBeenCalledWith('control-123');
    });
  });

  describe('Role-based access control', () => {
    it('should allow admin to perform all actions', async () => {
      const adminUser = { ...mockUser, roles: ['admin'] };
      mockControlsService.create.mockResolvedValue(mockControl);

      await controller.create({} as CreateControlDto);

      expect(service.create).toHaveBeenCalled();
    });

    it('should allow compliance_manager to manage controls', async () => {
      const complianceUser = { ...mockUser, roles: ['compliance_manager'] };
      mockControlsService.update.mockResolvedValue(mockControl);

      await controller.update('control-123', {});

      expect(service.update).toHaveBeenCalled();
    });

    it('should allow auditor to view and test controls', async () => {
      const auditorUser = { ...mockUser, roles: ['auditor'] };
      mockControlsService.recordTestResult.mockResolvedValue(mockControl);

      await controller.recordTestResult('control-123', {} as any);

      expect(service.recordTestResult).toHaveBeenCalled();
    });

    it('should allow control_operator limited access', async () => {
      const operatorUser = { ...mockUser, roles: ['control_operator'] };
      mockControlsService.findAll.mockResolvedValue({ data: [], meta: {} as any });

      await controller.findAll({});

      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockControlsService.findAll.mockRejectedValue(new Error('Database error'));

      await expect(controller.findAll({})).rejects.toThrow('Database error');
    });

    it('should validate control test schedules', async () => {
      const pastDate = new Date('2020-01-01');
      const scheduleDto = {
        testDate: pastDate,
        tester: 'auditor-123',
      };

      mockControlsService.scheduleTest.mockRejectedValue(
        new BadRequestException('Test date must be in the future')
      );

      await expect(controller.scheduleTest('control-123', scheduleDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should validate evidence requirements', async () => {
      const invalidEvidence = {
        type: 'Invalid',
        name: '',
      };

      mockControlsService.attachEvidence.mockRejectedValue(
        new BadRequestException('Invalid evidence type')
      );

      await expect(
        controller.attachEvidence('control-123', invalidEvidence as any)
      ).rejects.toThrow(BadRequestException);
    });
  });
});
