import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { CreateRemediationDto, QueryRemediationDto, UpdateRemediationDto } from './dto';
import { RemediationController } from './remediation.controller';
import { RemediationService } from './remediation.service';

describe('RemediationController', () => {
  let controller: RemediationController;
  let service: any;

  const mockUser = {
    id: 'user-123',
    email: 'analyst@example.com',
    organizationId: 'org-123',
    roles: ['compliance_analyst'],
  };

  const mockRemediation = {
    id: 'remediation-123',
    findingId: 'finding-123',
    clientId: 'client-123',
    title: 'Implement automated access reviews',
    description: 'Deploy automated system for quarterly access reviews',
    priority: 'high',
    status: 'in_progress',
    assignedTo: 'user-456',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    estimatedEffort: {
      hours: 40,
      complexity: 'medium',
    },
    implementationSteps: [
      {
        step: 1,
        description: 'Select access review tool',
        status: 'completed',
        completedDate: new Date(),
      },
      {
        step: 2,
        description: 'Configure automated workflows',
        status: 'in_progress',
        estimatedCompletion: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    ],
    aiRecommendations: {
      suggestedApproach: 'Use existing IAM platform capabilities',
      alternativeOptions: ['Third-party tool', 'Custom development'],
      riskReduction: 0.75,
      confidenceScore: 0.88,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Create mocks
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      generateRemediationPlan: jest.fn(),
      prioritizeRemediations: jest.fn(),
      estimateEffort: jest.fn(),
      trackProgress: jest.fn(),
      suggestAutomation: jest.fn(),
      analyzeImpact: jest.fn(),
      validateCompletion: jest.fn(),
      generateReport: jest.fn(),
      bulkAssign: jest.fn(),
    };

    // Manual instantiation
    controller = new RemediationController(service);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new remediation', async () => {
      const createDto: CreateRemediationDto = {
        findingId: 'finding-123',
        clientId: 'client-123',
        title: 'Implement automated access reviews',
        description: 'Deploy automated system for quarterly access reviews',
        priority: 'high',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        assignedTo: 'user-456',
      };

      service.create.mockResolvedValue(mockRemediation);

      const result = await controller.create(createDto, mockUser);

      expect(service.create).toHaveBeenCalledWith({
        ...createDto,
        createdBy: mockUser.id,
        organizationId: mockUser.organizationId,
      });
      expect(result).toEqual(mockRemediation);
    });

    it('should validate due date is in the future', async () => {
      const createDto = {
        findingId: 'finding-123',
        title: 'Test remediation',
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Past date
      } as CreateRemediationDto;

      service.create.mockRejectedValue(new BadRequestException('Due date must be in the future'));

      await expect(controller.create(createDto, mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateRemediationPlan', () => {
    it('should generate AI-powered remediation plan', async () => {
      const planDto = {
        findingIds: ['finding-123', 'finding-124', 'finding-125'],
        clientId: 'client-123',
        optimizationStrategy: 'minimize_effort',
        includeAutomation: true,
      };

      const remediationPlan = {
        findings: [
          {
            findingId: 'finding-123',
            type: 'access_control',
            severity: 'high',
            description: 'Missing automated access reviews',
          },
          {
            findingId: 'finding-124',
            type: 'access_control',
            severity: 'medium',
            description: 'Weak password policy',
          },
        ],
        remediations: [
          {
            title: 'Implement comprehensive access management',
            description: 'Deploy automated access review system with enhanced password policies',
            addressesFindings: ['finding-123', 'finding-124'],
            priority: 'high',
            estimatedEffort: {
              hours: 60,
              complexity: 'medium',
              resources: ['Security Engineer', 'IAM Specialist'],
            },
            implementation: {
              approach: 'Leverage existing IAM platform',
              phases: [
                { phase: 1, task: 'Configure access review workflows', duration: '2 weeks' },
                { phase: 2, task: 'Update password policies', duration: '1 week' },
                { phase: 3, task: 'Testing and validation', duration: '1 week' },
              ],
            },
            automationOpportunities: [
              'Automated access certification campaigns',
              'Self-service password reset',
              'Risk-based authentication',
            ],
            expectedOutcome: {
              riskReduction: 0.82,
              complianceImprovement: 0.75,
              effortSavings: '40% compared to manual process',
            },
          },
        ],
        prioritization: {
          method: 'risk_effort_matrix',
          sequence: [
            { order: 1, remediation: 'Access management', reason: 'High risk, medium effort' },
            { order: 2, remediation: 'Logging enhancement', reason: 'Medium risk, low effort' },
          ],
        },
        timeline: {
          totalDuration: '8 weeks',
          criticalPath: ['Access management', 'Testing'],
          milestones: [
            { week: 2, deliverable: 'Access review system deployed' },
            { week: 4, deliverable: 'Password policies updated' },
            { week: 8, deliverable: 'All remediations complete' },
          ],
        },
      };

      service.generateRemediationPlan.mockResolvedValue(remediationPlan);

      const result = await controller.generateRemediationPlan(planDto, mockUser);

      expect(service.generateRemediationPlan).toHaveBeenCalledWith(
        planDto,
        mockUser.organizationId
      );
      expect(result).toEqual(remediationPlan);
    });

    it('should optimize for cost when requested', async () => {
      const planDto = {
        findingIds: ['finding-123'],
        optimizationStrategy: 'minimize_cost',
        budgetConstraint: 50000,
      };

      service.generateRemediationPlan.mockResolvedValue({
        remediations: [],
        optimization: {
          strategy: 'minimize_cost',
          totalCost: 45000,
          costBreakdown: {
            tools: 15000,
            labor: 25000,
            training: 5000,
          },
        },
      });

      await controller.generateRemediationPlan(planDto, mockUser);

      expect(service.generateRemediationPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          optimizationStrategy: 'minimize_cost',
          budgetConstraint: 50000,
        }),
        mockUser.organizationId
      );
    });
  });

  describe('prioritizeRemediations', () => {
    it('should prioritize remediations based on risk', async () => {
      const prioritizeDto = {
        remediationIds: ['rem-1', 'rem-2', 'rem-3'],
        prioritizationMethod: 'risk_based',
        factors: ['severity', 'exploitability', 'business_impact'],
      };

      const prioritizationResult = {
        prioritizedList: [
          {
            remediationId: 'rem-3',
            priority: 1,
            score: 0.95,
            factors: {
              severity: 'critical',
              exploitability: 'high',
              businessImpact: 'high',
            },
            reasoning: 'Critical severity with high exploitability',
          },
          {
            remediationId: 'rem-1',
            priority: 2,
            score: 0.72,
            factors: {
              severity: 'high',
              exploitability: 'medium',
              businessImpact: 'medium',
            },
          },
          {
            remediationId: 'rem-2',
            priority: 3,
            score: 0.45,
            factors: {
              severity: 'medium',
              exploitability: 'low',
              businessImpact: 'low',
            },
          },
        ],
        recommendations: [
          'Focus on rem-3 immediately due to critical risk',
          'Allocate 60% of resources to top 2 remediations',
          'Consider bundling rem-2 with future maintenance',
        ],
      };

      service.prioritizeRemediations.mockResolvedValue(prioritizationResult);

      const result = await controller.prioritizeRemediations(prioritizeDto, mockUser);

      expect(service.prioritizeRemediations).toHaveBeenCalledWith(
        prioritizeDto,
        mockUser.organizationId
      );
      expect(result).toEqual(prioritizationResult);
    });

    it('should support effort-based prioritization', async () => {
      const prioritizeDto = {
        remediationIds: ['rem-1', 'rem-2'],
        prioritizationMethod: 'quick_wins',
      };

      service.prioritizeRemediations.mockResolvedValue({
        prioritizedList: [
          {
            remediationId: 'rem-2',
            priority: 1,
            score: 0.85,
            effortHours: 8,
            impactScore: 0.7,
            reasoning: 'Low effort, high impact',
          },
        ],
      });

      await controller.prioritizeRemediations(prioritizeDto, mockUser);

      expect(service.prioritizeRemediations).toHaveBeenCalledWith(
        expect.objectContaining({ prioritizationMethod: 'quick_wins' }),
        mockUser.organizationId
      );
    });
  });

  describe('estimateEffort', () => {
    it('should estimate remediation effort using AI', async () => {
      const effortDto = {
        remediationId: 'remediation-123',
        includeBreakdown: true,
        considerDependencies: true,
      };

      const effortEstimate = {
        totalEffort: {
          hours: 80,
          range: { min: 64, max: 96 },
          confidence: 0.85,
        },
        breakdown: {
          planning: { hours: 8, percentage: 10 },
          implementation: { hours: 48, percentage: 60 },
          testing: { hours: 16, percentage: 20 },
          documentation: { hours: 8, percentage: 10 },
        },
        resources: [
          { role: 'Security Engineer', hours: 40, level: 'Senior' },
          { role: 'Developer', hours: 24, level: 'Mid' },
          { role: 'QA Engineer', hours: 16, level: 'Mid' },
        ],
        dependencies: [
          {
            task: 'IAM platform upgrade',
            impact: 'Blocks implementation phase',
            estimatedDelay: '1 week',
          },
        ],
        assumptions: [
          'Existing IAM platform has API capabilities',
          'Development team familiar with security practices',
        ],
        risks: [
          {
            risk: 'Scope creep',
            probability: 0.3,
            impact: '20% effort increase',
            mitigation: 'Clear requirements documentation',
          },
        ],
      };

      service.estimateEffort.mockResolvedValue(effortEstimate);

      const result = await controller.estimateEffort(effortDto, mockUser);

      expect(service.estimateEffort).toHaveBeenCalledWith(effortDto, mockUser.organizationId);
      expect(result).toEqual(effortEstimate);
    });
  });

  describe('trackProgress', () => {
    it('should track remediation progress', async () => {
      const progressDto = {
        remediationId: 'remediation-123',
        includeMetrics: true,
        includeForecast: true,
      };

      const progressReport = {
        current: {
          status: 'in_progress',
          percentComplete: 45,
          completedSteps: 2,
          totalSteps: 5,
          actualEffortHours: 18,
          plannedEffortHours: 40,
        },
        timeline: {
          startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          currentDate: new Date(),
          dueDate: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000),
          isOnTrack: true,
        },
        metrics: {
          velocityTrend: 'increasing',
          effortVariance: -0.05, // 5% under budget
          qualityScore: 0.92,
        },
        forecast: {
          estimatedCompletion: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
          confidence: 0.88,
          risks: ['Resource availability next week'],
        },
        recommendations: [
          'Maintain current pace to complete 4 days early',
          'Consider allocating additional QA resources',
        ],
      };

      service.trackProgress.mockResolvedValue(progressReport);

      const result = await controller.trackProgress(progressDto, mockUser);

      expect(service.trackProgress).toHaveBeenCalledWith(progressDto, mockUser.organizationId);
      expect(result).toEqual(progressReport);
    });
  });

  describe('suggestAutomation', () => {
    it('should suggest automation opportunities', async () => {
      const automationDto = {
        remediationIds: ['rem-1', 'rem-2', 'rem-3'],
        automationGoal: 'maximize_efficiency',
        budgetLimit: 100000,
      };

      const automationSuggestions = {
        opportunities: [
          {
            remediationId: 'rem-1',
            task: 'Access reviews',
            currentProcess: 'Manual quarterly reviews',
            automatedSolution: {
              description: 'Automated certification campaigns',
              tool: 'SailPoint IdentityIQ',
              implementation: 'Configure certification workflows',
              cost: {
                initial: 25000,
                annual: 15000,
              },
              benefits: {
                effortReduction: '85%',
                accuracyImprovement: '95%',
                timeToComplete: '2 days vs 2 weeks',
              },
              roi: {
                breakeven: '8 months',
                fiveYearSavings: 180000,
              },
            },
          },
          {
            remediationId: 'rem-2',
            task: 'Log monitoring',
            automatedSolution: {
              description: 'SIEM with automated alerting',
              tool: 'Splunk Enterprise Security',
              benefits: {
                detectionTime: '5 minutes vs 24 hours',
                falsePositiveReduction: '70%',
              },
            },
          },
        ],
        summary: {
          totalOpportunities: 5,
          implementationCost: 75000,
          annualSavings: 120000,
          effortReduction: '65%',
          recommendedSequence: [
            'Access reviews - highest ROI',
            'Log monitoring - critical for compliance',
            'Vulnerability scanning - risk reduction',
          ],
        },
      };

      service.suggestAutomation.mockResolvedValue(automationSuggestions);

      const result = await controller.suggestAutomation(automationDto, mockUser);

      expect(service.suggestAutomation).toHaveBeenCalledWith(
        automationDto,
        mockUser.organizationId
      );
      expect(result).toEqual(automationSuggestions);
    });
  });

  describe('analyzeImpact', () => {
    it('should analyze remediation impact', async () => {
      const impactDto = {
        remediationId: 'remediation-123',
        impactDimensions: ['compliance', 'security', 'operations'],
        timeHorizon: '12months',
      };

      const impactAnalysis = {
        dimensions: {
          compliance: {
            currentScore: 72,
            projectedScore: 88,
            improvement: 16,
            affectedControls: ['CC6.1', 'CC6.2', 'CC6.7'],
            frameworks: ['SOC2', 'ISO27001'],
          },
          security: {
            riskReduction: 0.65,
            threatsAddressed: ['Unauthorized access', 'Privilege escalation'],
            vulnerabilitiesClosed: 8,
          },
          operations: {
            efficiencyGain: '30%',
            processesAffected: ['User provisioning', 'Access reviews'],
            resourcesSaved: '200 hours/year',
          },
        },
        cascadingEffects: [
          {
            area: 'Audit preparation',
            impact: 'Reduced effort by 40%',
            timeframe: 'Next audit cycle',
          },
          {
            area: 'Incident response',
            impact: 'Faster user access investigations',
            timeframe: 'Immediate',
          },
        ],
        costBenefit: {
          implementationCost: 50000,
          annualBenefit: 75000,
          paybackPeriod: '8 months',
          netPresentValue: 225000,
        },
        riskAssessment: {
          implementationRisks: [
            { risk: 'User adoption', probability: 0.3, mitigation: 'Training program' },
          ],
          residualRisks: [{ risk: 'Advanced persistent threats', level: 'medium' }],
        },
      };

      service.analyzeImpact.mockResolvedValue(impactAnalysis);

      const result = await controller.analyzeImpact(impactDto, mockUser);

      expect(service.analyzeImpact).toHaveBeenCalledWith(impactDto, mockUser.organizationId);
      expect(result).toEqual(impactAnalysis);
    });
  });

  describe('validateCompletion', () => {
    it('should validate remediation completion', async () => {
      const validationDto = {
        remediationId: 'remediation-123',
        evidenceIds: ['evidence-1', 'evidence-2'],
        testingResults: {
          functionalTesting: 'passed',
          securityTesting: 'passed',
          userAcceptance: 'passed',
        },
      };

      const validationResult = {
        status: 'validated',
        completionScore: 0.95,
        validation: {
          evidenceReview: {
            status: 'complete',
            evidenceQuality: 'high',
            coverage: 'comprehensive',
          },
          testingValidation: {
            allTestsPassed: true,
            testCoverage: 0.92,
            criticalPathsTested: true,
          },
          effectivenessAssessment: {
            findingAddressed: true,
            riskMitigation: 'verified',
            complianceImprovement: 'confirmed',
          },
        },
        residualItems: [
          {
            item: 'Documentation update',
            priority: 'low',
            deadline: '2 weeks',
          },
        ],
        certification: {
          certifiedBy: 'user-123',
          certificationDate: new Date(),
          nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      };

      service.validateCompletion.mockResolvedValue(validationResult);

      const result = await controller.validateCompletion(validationDto, mockUser);

      expect(service.validateCompletion).toHaveBeenCalledWith(
        validationDto,
        mockUser.organizationId
      );
      expect(result).toEqual(validationResult);
    });
  });

  describe('findAll', () => {
    it('should return paginated remediations', async () => {
      const query: QueryRemediationDto = {
        page: 1,
        limit: 10,
        status: 'in_progress',
        priority: 'high',
      };

      service.findAll.mockResolvedValue({
        data: [mockRemediation],
        total: 1,
        page: 1,
        limit: 10,
      });

      const result = await controller.findAll(query, mockUser);

      expect(service.findAll).toHaveBeenCalledWith(query, mockUser.organizationId);
      expect(result.data).toHaveLength(1);
    });

    it('should filter by overdue remediations', async () => {
      const query: QueryRemediationDto = {
        overdue: true,
      };

      service.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      await controller.findAll(query, mockUser);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ overdue: true }),
        mockUser.organizationId
      );
    });
  });

  describe('findOne', () => {
    it('should return remediation by ID', async () => {
      service.findOne.mockResolvedValue(mockRemediation);

      const result = await controller.findOne('remediation-123', mockUser);

      expect(service.findOne).toHaveBeenCalledWith('remediation-123', mockUser.organizationId);
      expect(result).toEqual(mockRemediation);
    });

    it('should handle not found', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Remediation not found'));

      await expect(controller.findOne('non-existent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update remediation details', async () => {
      const updateDto: UpdateRemediationDto = {
        status: 'completed',
        completionNotes: 'Successfully implemented automated access reviews',
        actualEffortHours: 38,
      };

      const updatedRemediation = { ...mockRemediation, ...updateDto };
      service.update.mockResolvedValue(updatedRemediation);

      const result = await controller.update('remediation-123', updateDto, mockUser);

      expect(service.update).toHaveBeenCalledWith(
        'remediation-123',
        updateDto,
        mockUser.organizationId
      );
      expect(result).toEqual(updatedRemediation);
    });
  });

  describe('generateReport', () => {
    it('should generate remediation report', async () => {
      const reportDto = {
        clientId: 'client-123',
        reportType: 'executive_summary',
        dateRange: {
          start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        includeMetrics: true,
      };

      const report = {
        summary: {
          totalRemediations: 25,
          completed: 18,
          inProgress: 5,
          overdue: 2,
          completionRate: 0.72,
        },
        highlights: [
          'Reduced critical findings by 85%',
          'Automated 60% of manual processes',
          'Achieved SOC2 compliance',
        ],
        byPriority: {
          critical: { total: 5, completed: 5 },
          high: { total: 10, completed: 8 },
          medium: { total: 10, completed: 5 },
        },
        costAnalysis: {
          budgeted: 250000,
          actual: 215000,
          savings: 35000,
          roi: 1.45,
        },
        recommendations: [
          'Continue automation initiatives',
          'Focus on medium priority items',
          'Plan for next audit cycle',
        ],
      };

      service.generateReport.mockResolvedValue(report);

      const result = await controller.generateReport(reportDto, mockUser);

      expect(service.generateReport).toHaveBeenCalledWith(reportDto, mockUser.organizationId);
      expect(result).toEqual(report);
    });
  });

  describe('bulkAssign', () => {
    it('should bulk assign remediations', async () => {
      const bulkAssignDto = {
        remediationIds: ['rem-1', 'rem-2', 'rem-3'],
        assigneeId: 'user-789',
        rebalanceWorkload: true,
      };

      const assignmentResult = {
        assigned: 3,
        assignments: [
          { remediationId: 'rem-1', assignee: 'user-789', workloadScore: 0.7 },
          { remediationId: 'rem-2', assignee: 'user-789', workloadScore: 0.75 },
          { remediationId: 'rem-3', assignee: 'user-789', workloadScore: 0.8 },
        ],
        workloadAnalysis: {
          assignee: 'user-789',
          totalRemediations: 8,
          totalEffortHours: 120,
          capacityUtilization: 0.8,
          recommendation: 'Near capacity - consider distributing future work',
        },
      };

      service.bulkAssign.mockResolvedValue(assignmentResult);

      const result = await controller.bulkAssign(bulkAssignDto, mockUser);

      expect(service.bulkAssign).toHaveBeenCalledWith(bulkAssignDto, mockUser.organizationId);
      expect(result).toEqual(assignmentResult);
    });
  });

  describe('remove', () => {
    it('should soft delete remediation', async () => {
      service.remove.mockResolvedValue(mockRemediation);

      const result = await controller.remove('remediation-123', mockUser);

      expect(service.remove).toHaveBeenCalledWith('remediation-123', mockUser.organizationId);
      expect(result).toEqual(mockRemediation);
    });
  });

  describe('Role-based access control', () => {
    it('should allow managers to assign remediations', async () => {
      const managerUser = { ...mockUser, roles: ['compliance_manager'] };
      service.bulkAssign.mockResolvedValue({ assigned: 3 });

      await controller.bulkAssign({} as any, managerUser);

      expect(service.bulkAssign).toHaveBeenCalled();
    });
  });

  describe('AI-Powered Recommendations', () => {
    it('should provide AI-driven implementation guidance', async () => {
      const planDto = {
        findingIds: ['finding-123'],
        useAIGuidance: true,
      };

      service.generateRemediationPlan.mockResolvedValue({
        remediations: [
          {
            title: 'Implement access controls',
            aiGuidance: {
              bestPractices: [
                'Use principle of least privilege',
                'Implement role-based access control',
                'Enable multi-factor authentication',
              ],
              implementationTips: [
                'Start with high-privilege accounts',
                'Use existing IAM infrastructure',
                'Plan phased rollout',
              ],
              commonPitfalls: [
                'Over-permissioning during migration',
                'Lack of user training',
                'Insufficient testing',
              ],
              successMetrics: [
                'Reduction in access-related incidents',
                'Improved audit pass rate',
                'Decreased provisioning time',
              ],
            },
          },
        ],
      });

      const result = await controller.generateRemediationPlan(planDto, mockUser);

      expect(result.remediations[0].aiGuidance).toBeDefined();
      expect(result.remediations[0].aiGuidance.bestPractices).toHaveLength(3);
    });
  });
});
