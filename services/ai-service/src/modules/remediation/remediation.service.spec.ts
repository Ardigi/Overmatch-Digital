import { HttpService } from '@nestjs/axios';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cache } from 'cache-manager';
import { of, throwError } from 'rxjs';
import { Repository } from 'typeorm';
import { Remediation } from './entities/remediation.entity';
import { RemediationService } from './remediation.service';

// Mock factories
const createMockRepository = <T = any>(): jest.Mocked<Repository<T>> =>
  ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    softDelete: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getMany: jest.fn(),
      getOne: jest.fn(),
    })),
    merge: jest.fn(),
    preload: jest.fn(),
    query: jest.fn(),
    clear: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
  }) as any;

const createMockEventEmitter = (): any => ({
  emit: jest.fn(),
  emitAsync: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  many: jest.fn(),
  off: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn(),
  hasListeners: jest.fn(),
  prependListener: jest.fn(),
  prependOnceListener: jest.fn(),
  prependMany: jest.fn(),
  listeners: jest.fn(),
  listenersAny: jest.fn(),
  eventNames: jest.fn(),
  listenerCount: jest.fn(),
  setMaxListeners: jest.fn(),
  getMaxListeners: jest.fn(),
  waitFor: jest.fn(),
});

describe('RemediationService', () => {
  let service: RemediationService;
  let repository: any;
  let eventEmitter: any;
  let httpService: any;
  let configService: any;
  let cacheManager: any;
  let mockQueryBuilder: any;

  const mockRemediation = {
    id: 'remediation-123',
    findingId: 'finding-123',
    clientId: 'client-123',
    organizationId: 'org-123',
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
    actualEffort: {
      hours: 18,
      percentComplete: 45,
    },
    metadata: {
      category: 'access_control',
      framework: 'SOC2',
      controlsAddressed: ['CC6.1', 'CC6.2'],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Create mocks
    repository = createMockRepository();
    eventEmitter = createMockEventEmitter();
    httpService = {
      post: jest.fn(),
      get: jest.fn(),
    } as any;
    configService = {
      get: jest.fn(),
    } as any;
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any;

    // Setup mockQueryBuilder
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    };
    repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    // Manual instantiation
    service = new RemediationService(
      repository,
      eventEmitter,
      httpService,
      configService,
      cacheManager
    );

    jest.clearAllMocks();

    // Setup default config values
    configService.get.mockImplementation((key: string) => {
      const configs = {
        AI_SERVICE_URL: 'http://ai-engine:8080',
        REMEDIATION_ENGINE_URL: 'http://remediation-engine:8083',
        AI_SERVICE_TIMEOUT: 30000,
        REMEDIATION_CACHE_TTL: 1800,
      };
      return configs[key];
    });
  });

  describe('create', () => {
    it('should create a new remediation', async () => {
      const createDto = {
        findingId: 'finding-123',
        clientId: 'client-123',
        title: 'Implement automated access reviews',
        description: 'Deploy automated system for quarterly access reviews',
        priority: 'high',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        assignedTo: 'user-456',
        createdBy: 'user-123',
        organizationId: 'org-123',
      };

      repository.create.mockReturnValue(mockRemediation);
      repository.save.mockResolvedValue(mockRemediation);

      const result = await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith({
        ...createDto,
        status: 'pending',
        estimatedEffort: expect.any(Object),
      });
      expect(repository.save).toHaveBeenCalledWith(mockRemediation);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'remediation.created',
        expect.objectContaining({ remediation: mockRemediation })
      );
      expect(result).toEqual(mockRemediation);
    });

    it('should validate due date is in the future', async () => {
      const createDto = {
        findingId: 'finding-123',
        title: 'Test remediation',
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        createdBy: 'user-123',
        organizationId: 'org-123',
      };

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should auto-estimate effort if not provided', async () => {
      const createDto = {
        findingId: 'finding-123',
        clientId: 'client-123',
        title: 'Fix security vulnerability',
        priority: 'high',
        createdBy: 'user-123',
        organizationId: 'org-123',
      };

      httpService.post.mockReturnValue(
        of({
          data: {
            estimatedHours: 24,
            complexity: 'medium',
            confidence: 0.82,
          },
        })
      );

      repository.create.mockReturnValue(mockRemediation);
      repository.save.mockResolvedValue(mockRemediation);

      await service.create(createDto);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://remediation-engine:8083/estimate',
        expect.objectContaining({
          title: createDto.title,
          priority: createDto.priority,
        })
      );
    });
  });

  describe('generateRemediationPlan', () => {
    it('should generate AI-powered remediation plan', async () => {
      const planDto = {
        findingIds: ['finding-123', 'finding-124'],
        clientId: 'client-123',
        optimizationStrategy: 'minimize_effort',
      };
      const organizationId = 'org-123';

      const mockPlanResponse = {
        data: {
          findings: [
            {
              findingId: 'finding-123',
              type: 'access_control',
              severity: 'high',
            },
          ],
          remediations: [
            {
              title: 'Implement comprehensive access management',
              addressesFindings: ['finding-123', 'finding-124'],
              priority: 'high',
              estimatedEffort: {
                hours: 60,
                complexity: 'medium',
              },
              implementation: {
                approach: 'Leverage existing IAM platform',
                phases: [{ phase: 1, task: 'Configure workflows', duration: '2 weeks' }],
              },
            },
          ],
          optimization: {
            strategy: 'minimize_effort',
            effortSaved: '40%',
            consolidatedItems: 2,
          },
        },
      };

      httpService.post.mockReturnValue(of(mockPlanResponse));

      const result = await service.generateRemediationPlan(planDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://remediation-engine:8083/plan',
        expect.objectContaining({
          findingIds: planDto.findingIds,
          clientId: planDto.clientId,
          strategy: planDto.optimizationStrategy,
          organizationId,
        })
      );
      expect(result).toEqual(mockPlanResponse.data);
    });

    it('should include automation opportunities when requested', async () => {
      const planDto = {
        findingIds: ['finding-123'],
        includeAutomation: true,
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            remediations: [
              {
                title: 'Access control remediation',
                automationOpportunities: [
                  'Automated access certification',
                  'Self-service password reset',
                ],
                automationROI: {
                  costSavings: 50000,
                  effortReduction: '75%',
                },
              },
            ],
          },
        })
      );

      const result = await service.generateRemediationPlan(planDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ includeAutomation: true })
      );
      expect(result.remediations[0].automationOpportunities).toBeDefined();
    });

    it('should respect budget constraints', async () => {
      const planDto = {
        findingIds: ['finding-123'],
        optimizationStrategy: 'minimize_cost',
        budgetConstraint: 50000,
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            remediations: [],
            optimization: {
              totalCost: 45000,
              budgetUtilization: 0.9,
            },
          },
        })
      );

      const result = await service.generateRemediationPlan(planDto, organizationId);

      expect(result.optimization.totalCost).toBeLessThanOrEqual(50000);
    });
  });

  describe('prioritizeRemediations', () => {
    it('should prioritize remediations based on risk', async () => {
      const prioritizeDto = {
        remediationIds: ['rem-1', 'rem-2', 'rem-3'],
        prioritizationMethod: 'risk_based',
      };
      const organizationId = 'org-123';

      const mockPriorityResponse = {
        data: {
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
            },
            {
              remediationId: 'rem-1',
              priority: 2,
              score: 0.72,
            },
            {
              remediationId: 'rem-2',
              priority: 3,
              score: 0.45,
            },
          ],
          methodology: 'weighted_risk_scoring',
        },
      };

      httpService.post.mockReturnValue(of(mockPriorityResponse));

      const result = await service.prioritizeRemediations(prioritizeDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://remediation-engine:8083/prioritize',
        expect.objectContaining({
          remediationIds: prioritizeDto.remediationIds,
          method: prioritizeDto.prioritizationMethod,
        })
      );
      expect(result).toEqual(mockPriorityResponse.data);
    });

    it('should support quick wins prioritization', async () => {
      const prioritizeDto = {
        remediationIds: ['rem-1', 'rem-2'],
        prioritizationMethod: 'quick_wins',
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            prioritizedList: [
              {
                remediationId: 'rem-2',
                priority: 1,
                effortHours: 8,
                impactScore: 0.7,
                effortImpactRatio: 8.75,
              },
            ],
          },
        })
      );

      const result = await service.prioritizeRemediations(prioritizeDto, organizationId);

      expect(result.prioritizedList[0].effortImpactRatio).toBeDefined();
    });
  });

  describe('estimateEffort', () => {
    it('should estimate remediation effort using AI', async () => {
      const effortDto = {
        remediationId: 'remediation-123',
        includeBreakdown: true,
      };
      const organizationId = 'org-123';

      repository.findOne.mockResolvedValue(mockRemediation);

      const mockEffortResponse = {
        data: {
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
          factors: {
            complexity: 'medium',
            teamExperience: 'high',
            toolAvailability: 'good',
          },
        },
      };

      httpService.post.mockReturnValue(of(mockEffortResponse));

      const result = await service.estimateEffort(effortDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://remediation-engine:8083/estimate/detailed',
        expect.objectContaining({
          remediation: mockRemediation,
          includeBreakdown: true,
        })
      );
      expect(result).toEqual(mockEffortResponse.data);
    });

    it('should consider dependencies in effort estimation', async () => {
      const effortDto = {
        remediationId: 'remediation-123',
        considerDependencies: true,
      };
      const organizationId = 'org-123';

      repository.findOne.mockResolvedValue(mockRemediation);
      httpService.post.mockReturnValue(
        of({
          data: {
            totalEffort: { hours: 100 },
            dependencies: [
              {
                task: 'IAM platform upgrade',
                impact: 'Adds 20 hours',
                critical: true,
              },
            ],
          },
        })
      );

      const result = await service.estimateEffort(effortDto, organizationId);

      expect(result.dependencies).toBeDefined();
      expect(result.totalEffort.hours).toBe(100);
    });
  });

  describe('trackProgress', () => {
    it('should track remediation progress', async () => {
      const progressDto = {
        remediationId: 'remediation-123',
        includeMetrics: true,
      };
      const organizationId = 'org-123';

      repository.findOne.mockResolvedValue(mockRemediation);

      const mockProgressResponse = {
        data: {
          current: {
            status: 'in_progress',
            percentComplete: 45,
            completedSteps: 2,
            totalSteps: 5,
          },
          timeline: {
            isOnTrack: true,
            daysRemaining: 16,
            estimatedCompletion: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
          },
          metrics: {
            velocityTrend: 'increasing',
            effortVariance: -0.05,
            qualityScore: 0.92,
          },
        },
      };

      httpService.post.mockReturnValue(of(mockProgressResponse));

      const result = await service.trackProgress(progressDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://remediation-engine:8083/progress',
        expect.objectContaining({
          remediation: mockRemediation,
          includeMetrics: true,
        })
      );
      expect(result).toEqual(mockProgressResponse.data);
    });

    it('should include forecast when requested', async () => {
      const progressDto = {
        remediationId: 'remediation-123',
        includeForecast: true,
      };
      const organizationId = 'org-123';

      repository.findOne.mockResolvedValue(mockRemediation);
      httpService.post.mockReturnValue(
        of({
          data: {
            forecast: {
              estimatedCompletion: new Date(),
              confidence: 0.88,
              scenarios: {
                optimistic: new Date(),
                realistic: new Date(),
                pessimistic: new Date(),
              },
            },
          },
        })
      );

      const result = await service.trackProgress(progressDto, organizationId);

      expect(result.forecast).toBeDefined();
      expect(result.forecast.scenarios).toBeDefined();
    });
  });

  describe('suggestAutomation', () => {
    it('should suggest automation opportunities', async () => {
      const automationDto = {
        remediationIds: ['rem-1', 'rem-2'],
        automationGoal: 'maximize_efficiency',
      };
      const organizationId = 'org-123';

      const mockAutomationResponse = {
        data: {
          opportunities: [
            {
              remediationId: 'rem-1',
              task: 'Access reviews',
              automatedSolution: {
                description: 'Automated certification campaigns',
                tool: 'SailPoint IdentityIQ',
                cost: { initial: 25000, annual: 15000 },
                benefits: {
                  effortReduction: '85%',
                  accuracyImprovement: '95%',
                },
                roi: { breakeven: '8 months' },
              },
            },
          ],
          summary: {
            totalOpportunities: 5,
            implementationCost: 75000,
            annualSavings: 120000,
          },
        },
      };

      httpService.post.mockReturnValue(of(mockAutomationResponse));

      const result = await service.suggestAutomation(automationDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://remediation-engine:8083/automation',
        expect.objectContaining({
          remediationIds: automationDto.remediationIds,
          goal: automationDto.automationGoal,
        })
      );
      expect(result).toEqual(mockAutomationResponse.data);
    });
  });

  describe('analyzeImpact', () => {
    it('should analyze remediation impact', async () => {
      const impactDto = {
        remediationId: 'remediation-123',
        impactDimensions: ['compliance', 'security', 'operations'],
      };
      const organizationId = 'org-123';

      repository.findOne.mockResolvedValue(mockRemediation);

      const mockImpactResponse = {
        data: {
          dimensions: {
            compliance: {
              currentScore: 72,
              projectedScore: 88,
              improvement: 16,
            },
            security: {
              riskReduction: 0.65,
              threatsAddressed: ['Unauthorized access'],
            },
            operations: {
              efficiencyGain: '30%',
              resourcesSaved: '200 hours/year',
            },
          },
          costBenefit: {
            implementationCost: 50000,
            annualBenefit: 75000,
            paybackPeriod: '8 months',
          },
        },
      };

      httpService.post.mockReturnValue(of(mockImpactResponse));

      const result = await service.analyzeImpact(impactDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://remediation-engine:8083/impact',
        expect.objectContaining({
          remediation: mockRemediation,
          dimensions: impactDto.impactDimensions,
        })
      );
      expect(result).toEqual(mockImpactResponse.data);
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
        },
      };
      const organizationId = 'org-123';

      repository.findOne.mockResolvedValue({
        ...mockRemediation,
        status: 'pending_validation',
      });

      const mockValidationResponse = {
        data: {
          status: 'validated',
          completionScore: 0.95,
          validation: {
            evidenceReview: { status: 'complete' },
            testingValidation: { allTestsPassed: true },
            effectivenessAssessment: { findingAddressed: true },
          },
        },
      };

      httpService.post.mockReturnValue(of(mockValidationResponse));
      repository.save.mockResolvedValue({
        ...mockRemediation,
        status: 'completed',
      });

      const result = await service.validateCompletion(validationDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://remediation-engine:8083/validate',
        expect.objectContaining({
          remediation: expect.any(Object),
          evidenceIds: validationDto.evidenceIds,
          testingResults: validationDto.testingResults,
        })
      );
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' })
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('remediation.completed', expect.any(Object));
      expect(result).toEqual(mockValidationResponse.data);
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
      };
      const organizationId = 'org-123';

      const mockReportResponse = {
        data: {
          summary: {
            totalRemediations: 25,
            completed: 18,
            completionRate: 0.72,
          },
          highlights: ['Reduced critical findings by 85%'],
          costAnalysis: {
            budgeted: 250000,
            actual: 215000,
          },
        },
      };

      httpService.post.mockReturnValue(of(mockReportResponse));

      const result = await service.generateReport(reportDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://remediation-engine:8083/report',
        expect.objectContaining({
          clientId: reportDto.clientId,
          reportType: reportDto.reportType,
          dateRange: reportDto.dateRange,
          organizationId,
        })
      );
      expect(result).toEqual(mockReportResponse.data);
    });
  });

  describe('bulkAssign', () => {
    it('should bulk assign remediations', async () => {
      const bulkAssignDto = {
        remediationIds: ['rem-1', 'rem-2', 'rem-3'],
        assigneeId: 'user-789',
        rebalanceWorkload: true,
      };
      const organizationId = 'org-123';

      const remediations = [
        { ...mockRemediation, id: 'rem-1' },
        { ...mockRemediation, id: 'rem-2' },
        { ...mockRemediation, id: 'rem-3' },
      ];

      repository.find.mockResolvedValue(remediations);
      httpService.post.mockReturnValue(
        of({
          data: {
            workloadAnalysis: {
              assignee: 'user-789',
              totalRemediations: 8,
              capacityUtilization: 0.8,
            },
          },
        })
      );
      repository.save.mockResolvedValue(remediations);

      const result = await service.bulkAssign(bulkAssignDto, organizationId);

      expect(repository.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            assignedTo: 'user-789',
          }),
        ])
      );
      expect(eventEmitter.emit).toHaveBeenCalledTimes(3); // One per remediation
      expect(result.assigned).toBe(3);
    });
  });

  describe('findAll', () => {
    it('should return paginated remediations', async () => {
      const query = {
        page: 1,
        limit: 10,
        status: 'in_progress',
      };
      const organizationId = 'org-123';

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockRemediation], 1]);

      const result = await service.findAll(query, organizationId);

      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'remediation.organizationId = :organizationId',
        { organizationId }
      );
      expect(result).toEqual({
        data: [mockRemediation],
        total: 1,
        page: 1,
        limit: 10,
      });
    });

    it('should filter overdue remediations', async () => {
      const query = {
        overdue: true,
      };
      const organizationId = 'org-123';

      // getManyAndCount is already set up in beforeEach

      await service.findAll(query, organizationId);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'remediation.dueDate < :now AND remediation.status != :completed',
        expect.objectContaining({
          now: expect.any(Date),
          completed: 'completed',
        })
      );
    });
  });

  describe('findOne', () => {
    it('should return remediation by ID', async () => {
      repository.findOne.mockResolvedValue(mockRemediation);

      const result = await service.findOne('remediation-123', 'org-123');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          id: 'remediation-123',
          organizationId: 'org-123',
        },
        relations: ['finding', 'assignee'],
      });
      expect(result).toEqual(mockRemediation);
    });

    it('should use cache for recent remediations', async () => {
      const cacheKey = 'remediation:remediation-123';
      cacheManager.get.mockResolvedValue(mockRemediation);

      const result = await service.findOne('remediation-123', 'org-123');

      expect(cacheManager.get).toHaveBeenCalledWith(cacheKey);
      expect(repository.findOne).not.toHaveBeenCalled();
      expect(result).toEqual(mockRemediation);
    });

    it('should throw NotFoundException when not found', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent', 'org-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update remediation details', async () => {
      const updateDto = {
        status: 'completed',
        completionNotes: 'Successfully implemented',
        actualEffortHours: 38,
      };

      repository.findOne.mockResolvedValue(mockRemediation);
      repository.save.mockResolvedValue({
        ...mockRemediation,
        ...updateDto,
      });

      const result = await service.update('remediation-123', updateDto, 'org-123');

      expect(repository.save).toHaveBeenCalledWith({
        ...mockRemediation,
        ...updateDto,
        updatedAt: expect.any(Date),
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('remediation.updated', expect.any(Object));
      expect(cacheManager.del).toHaveBeenCalledWith('remediation:remediation-123');
    });

    it('should update progress metrics', async () => {
      const updateDto = {
        actualEffortHours: 25,
        percentComplete: 60,
      };

      repository.findOne.mockResolvedValue(mockRemediation);
      repository.save.mockResolvedValue(mockRemediation);

      await service.update('remediation-123', updateDto, 'org-123');

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          actualEffort: expect.objectContaining({
            hours: 25,
            percentComplete: 60,
          }),
        })
      );
    });
  });

  describe('AI-Powered Features', () => {
    it('should use machine learning for effort estimation', async () => {
      const createDto = {
        findingId: 'finding-123',
        title: 'Complex security remediation',
        description: 'Implement zero trust architecture',
        priority: 'high',
        createdBy: 'user-123',
        organizationId: 'org-123',
      };

      httpService.post.mockReturnValue(
        of({
          data: {
            estimatedHours: 120,
            complexity: 'high',
            confidence: 0.78,
            similarRemediations: [
              { title: 'Zero trust implementation', actualHours: 110 },
              { title: 'Network segmentation', actualHours: 130 },
            ],
            factors: {
              scope: 'large',
              technicalDebt: 'medium',
              teamCapability: 'high',
            },
          },
        })
      );

      repository.create.mockReturnValue(mockRemediation);
      repository.save.mockResolvedValue(mockRemediation);

      await service.create(createDto);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/estimate'),
        expect.objectContaining({
          description: expect.stringContaining('zero trust'),
        })
      );
    });

    it('should provide intelligent remediation recommendations', async () => {
      const planDto = {
        findingIds: ['finding-123'],
        useAIGuidance: true,
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            remediations: [
              {
                title: 'Implement access controls',
                aiGuidance: {
                  confidence: 0.92,
                  rationale: 'Based on 150 similar remediations',
                  successFactors: [
                    'Executive sponsorship',
                    'Phased implementation',
                    'User training program',
                  ],
                  riskMitigation: {
                    before: 0.85,
                    after: 0.25,
                    reduction: 0.7,
                  },
                },
              },
            ],
          },
        })
      );

      const result = await service.generateRemediationPlan(planDto, organizationId);

      expect(result.remediations[0].aiGuidance).toBeDefined();
      expect(result.remediations[0].aiGuidance.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('Workload Balancing', () => {
    it('should analyze team workload during assignment', async () => {
      const bulkAssignDto = {
        remediationIds: ['rem-1'],
        assigneeId: 'user-789',
        rebalanceWorkload: true,
      };
      const organizationId = 'org-123';

      repository.find.mockResolvedValue([mockRemediation]);
      httpService.post.mockReturnValue(
        of({
          data: {
            workloadAnalysis: {
              assignee: 'user-789',
              currentLoad: 0.75,
              projectedLoad: 0.85,
              recommendation: 'Near capacity',
              alternativeAssignees: [{ id: 'user-790', currentLoad: 0.45 }],
            },
          },
        })
      );

      const result = await service.bulkAssign(bulkAssignDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/workload'),
        expect.objectContaining({
          assigneeId: 'user-789',
          rebalance: true,
        })
      );
      expect(result.workloadAnalysis.recommendation).toBe('Near capacity');
    });
  });

  describe('remove', () => {
    it('should soft delete remediation', async () => {
      const completedRemediation = {
        ...mockRemediation,
        status: 'completed',
      };
      repository.findOne.mockResolvedValue(completedRemediation);
      repository.softDelete.mockResolvedValue({ affected: 1 });

      const result = await service.remove('remediation-123', 'org-123');

      expect(repository.softDelete).toHaveBeenCalledWith('remediation-123');
      expect(eventEmitter.emit).toHaveBeenCalledWith('remediation.deleted', expect.any(Object));
      expect(cacheManager.del).toHaveBeenCalledWith('remediation:remediation-123');
    });
  });
});
