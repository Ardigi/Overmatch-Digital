import { HttpService } from '@nestjs/axios';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cache } from 'cache-manager';
import { defer, of, throwError } from 'rxjs';
import { Repository } from 'typeorm';
import { AnalysisService } from './analysis.service';
import { ComplianceAnalysis } from './entities/compliance-analysis.entity';

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

describe('AnalysisService', () => {
  let service: AnalysisService;
  let repository: any;
  let eventEmitter: any;
  let httpService: any;
  let configService: any;
  let cacheManager: any;
  let mockQueryBuilder: any;

  const mockAnalysis = {
    id: 'analysis-123',
    clientId: 'client-123',
    organizationId: 'org-123',
    type: 'compliance_gap',
    status: 'completed',
    findings: {
      gaps: [
        {
          area: 'Access Control',
          severity: 'high',
          description: 'Inadequate access reviews',
        },
      ],
      score: 75.5,
    },
    metadata: {
      frameworks: ['SOC2', 'ISO27001'],
      dataPoints: 1500,
      processingTime: 3500,
    },
    createdAt: new Date(),
    completedAt: new Date(),
  };

  beforeEach(() => {
    // Create mock query builder
    mockQueryBuilder = {
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
    };

    // Create mocks
    repository = createMockRepository();
    // Override createQueryBuilder to return our consistent mock
    repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    eventEmitter = createMockEventEmitter();
    httpService = {
      post: jest.fn().mockReturnValue(of({ data: {} })), // Default to returning an observable
      get: jest.fn().mockReturnValue(of({ data: {} })),
    } as any;
    configService = {
      get: jest.fn(),
    } as any;
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as any;

    // Manual instantiation
    service = new AnalysisService(
      repository,
      eventEmitter,
      httpService,
      configService,
      cacheManager
    );

    jest.clearAllMocks();

    // Setup default repository mock behaviors
    repository.update.mockResolvedValue({ affected: 1 });

    // Setup default config values
    configService.get.mockImplementation((key: string) => {
      const configs = {
        AI_SERVICE_URL: 'http://ai-engine:8080',
        AI_SERVICE_TIMEOUT: 30000,
        ANALYSIS_CACHE_TTL: 3600,
      };
      return configs[key];
    });
  });

  describe('create', () => {
    it('should create a new analysis', async () => {
      const createDto = {
        clientId: 'client-123',
        type: 'compliance_gap',
        frameworks: ['SOC2'],
        createdBy: 'user-123',
        organizationId: 'org-123',
      };

      const createdAnalysis = { ...mockAnalysis, status: 'pending' };
      repository.create.mockReturnValue(createdAnalysis);
      repository.save.mockResolvedValue(createdAnalysis);

      const result = await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith({
        ...createDto,
        status: 'pending',
        startedAt: expect.any(Date),
      });
      expect(repository.save).toHaveBeenCalledWith(createdAnalysis);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'analysis.created',
        expect.objectContaining({ analysis: createdAnalysis })
      );
      expect(result).toEqual(createdAnalysis);
    });

    it('should trigger AI analysis after creation', async () => {
      const createDto = {
        clientId: 'client-123',
        type: 'risk_assessment',
        createdBy: 'user-123',
        organizationId: 'org-123',
      };

      const createdAnalysis = { ...mockAnalysis, status: 'pending' };
      repository.create.mockReturnValue(createdAnalysis);
      repository.save.mockResolvedValue(createdAnalysis);
      httpService.post.mockReturnValue(of({ data: { jobId: 'job-123' } }));

      await service.create(createDto);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://ai-engine:8080/analyze',
        expect.objectContaining({
          analysisId: mockAnalysis.id,
          type: createDto.type,
        })
      );
    });

    it('should handle AI service errors gracefully', async () => {
      const createDto = {
        clientId: 'client-123',
        type: 'predictive',
        createdBy: 'user-123',
        organizationId: 'org-123',
      };

      const createdAnalysis = { ...mockAnalysis, status: 'pending' };
      repository.create.mockReturnValue(createdAnalysis);
      repository.save.mockResolvedValue(createdAnalysis);
      httpService.post.mockReturnValue(throwError(() => new Error('AI service unavailable')));

      const result = await service.create(createDto);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(result.status).toBe('pending');
      // First call is 'analysis.created', second should be 'analysis.ai.failed'
      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenNthCalledWith(
        2,
        'analysis.ai.failed',
        expect.any(Object)
      );
    });
  });

  describe('analyzeCompliance', () => {
    it('should perform compliance gap analysis', async () => {
      const analysisDto = {
        clientId: 'client-123',
        frameworks: ['SOC2', 'ISO27001'],
      };
      const organizationId = 'org-123';

      const mockAIResponse = {
        data: {
          overallScore: 82.5,
          frameworkScores: {
            SOC2: 85.0,
            ISO27001: 80.0,
          },
          gaps: [
            {
              control: 'CC6.1',
              gap: 'Missing MFA implementation',
              severity: 'high',
              recommendation: 'Implement MFA for all privileged users',
            },
          ],
          recommendations: [
            {
              priority: 'high',
              area: 'Access Control',
              actions: ['Implement MFA', 'Quarterly access reviews'],
            },
          ],
        },
      };

      httpService.post.mockReturnValue(of(mockAIResponse));

      const result = await service.analyzeCompliance(analysisDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://ai-engine:8080/analyze/compliance',
        expect.objectContaining({
          clientId: analysisDto.clientId,
          frameworks: analysisDto.frameworks,
          organizationId,
        })
      );
      expect(result).toEqual(mockAIResponse.data);
    });

    it('should cache compliance analysis results', async () => {
      const analysisDto = {
        clientId: 'client-123',
        frameworks: ['SOC2'],
      };
      const organizationId = 'org-123';
      const cacheKey = `compliance:${organizationId}:${analysisDto.clientId}:SOC2`;

      cacheManager.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(of({ data: { score: 85.0 } }));

      await service.analyzeCompliance(analysisDto, organizationId);

      expect(cacheManager.set).toHaveBeenCalledWith(cacheKey, expect.any(Object), 3600);
    });

    it('should use cached results when available', async () => {
      const analysisDto = {
        clientId: 'client-123',
        frameworks: ['SOC2'],
      };
      const organizationId = 'org-123';
      const cachedResult = { score: 85.0, cached: true };

      cacheManager.get.mockResolvedValue(cachedResult);

      const result = await service.analyzeCompliance(analysisDto, organizationId);

      expect(httpService.post).not.toHaveBeenCalled();
      expect(result).toEqual(cachedResult);
    });
  });

  describe('analyzeRisks', () => {
    it('should perform risk assessment with ML models', async () => {
      const riskDto = {
        clientId: 'client-123',
        riskCategories: ['security', 'compliance'],
        includePredictions: true,
      };
      const organizationId = 'org-123';

      const mockRiskResponse = {
        data: {
          overallRiskScore: 'medium',
          risksByCategory: {
            security: {
              score: 'high',
              factors: ['Unpatched systems', 'Weak passwords'],
            },
            compliance: {
              score: 'medium',
              factors: ['Missing policies', 'Incomplete training'],
            },
          },
          predictions: {
            next30Days: {
              security: 'high',
              compliance: 'medium',
            },
            next90Days: {
              security: 'medium',
              compliance: 'low',
            },
          },
        },
      };

      httpService.post.mockReturnValue(of(mockRiskResponse));

      const result = await service.analyzeRisks(riskDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://ai-engine:8080/analyze/risks',
        expect.objectContaining({
          clientId: riskDto.clientId,
          categories: riskDto.riskCategories,
          includePredictions: true,
        })
      );
      expect(result).toEqual(mockRiskResponse.data);
    });

    it('should aggregate historical risk data', async () => {
      const riskDto = {
        clientId: 'client-123',
        includeHistorical: true,
        timeframe: '6months',
      };
      const organizationId = 'org-123';

      const mockHistoricalData = [
        { date: '2024-01', score: 'high' },
        { date: '2024-02', score: 'medium' },
        { date: '2024-03', score: 'medium' },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(mockHistoricalData);

      httpService.post.mockReturnValue(of({ data: { current: 'low' } }));

      const result = await service.analyzeRisks(riskDto, organizationId);

      expect(result.historical).toBeDefined();
      expect(result.historical).toHaveLength(3);
    });
  });

  describe('analyzeTrends', () => {
    it('should analyze compliance trends over time', async () => {
      const trendDto = {
        clientId: 'client-123',
        period: 'last_year',
        metrics: ['compliance_score', 'control_effectiveness'],
      };
      const organizationId = 'org-123';

      const mockTrendData = {
        data: {
          trends: {
            compliance_score: {
              dataPoints: [
                { date: '2024-01', value: 70 },
                { date: '2024-02', value: 75 },
                { date: '2024-03', value: 80 },
              ],
              trend: 'improving',
              forecast: { '2024-04': 82, '2024-05': 84 },
            },
          },
          insights: [
            'Steady improvement in compliance score',
            'Control effectiveness increased by 15%',
          ],
        },
      };

      httpService.post.mockReturnValue(of(mockTrendData));

      const result = await service.analyzeTrends(trendDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://ai-engine:8080/analyze/trends',
        expect.objectContaining({
          clientId: trendDto.clientId,
          period: trendDto.period,
          metrics: trendDto.metrics,
        })
      );
      expect(result.insights).toHaveLength(2);
    });

    it('should detect anomalies in trends', async () => {
      const trendDto = {
        clientId: 'client-123',
        detectAnomalies: true,
      };
      const organizationId = 'org-123';

      const mockAnomalyData = {
        data: {
          anomalies: [
            {
              date: '2024-02-15',
              metric: 'compliance_score',
              expected: 75,
              actual: 60,
              severity: 'high',
              possibleCauses: ['Policy change', 'Staff turnover'],
            },
          ],
        },
      };

      httpService.post.mockReturnValue(of(mockAnomalyData));

      const result = await service.analyzeTrends(trendDto, organizationId);

      expect(result.anomalies).toBeDefined();
      expect(result.anomalies[0].severity).toBe('high');
    });
  });

  describe('generateRecommendations', () => {
    it('should generate AI-powered recommendations', async () => {
      const recommendationDto = {
        clientId: 'client-123',
        areas: ['security', 'compliance'],
        priority: 'high',
      };
      const organizationId = 'org-123';

      const mockRecommendations = {
        data: {
          recommendations: [
            {
              id: 'rec-001',
              area: 'security',
              title: 'Implement Zero Trust Architecture',
              priority: 'high',
              effort: 'high',
              impact: 'very high',
              description: 'Transition to zero trust security model',
              steps: [
                'Assess current architecture',
                'Define trust boundaries',
                'Implement micro-segmentation',
              ],
              estimatedTimeline: '6-12 months',
              estimatedCost: '$50,000 - $100,000',
            },
          ],
          reasoning: 'Based on current security gaps and industry trends',
        },
      };

      httpService.post.mockReturnValue(of(mockRecommendations));

      const result = await service.generateRecommendations(recommendationDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://ai-engine:8080/recommendations',
        expect.objectContaining({
          clientId: recommendationDto.clientId,
          areas: recommendationDto.areas,
          priority: recommendationDto.priority,
        })
      );
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].priority).toBe('high');
    });

    it('should personalize recommendations based on client context', async () => {
      const recommendationDto = {
        clientId: 'client-123',
        includeContext: true,
        industrySpecific: true,
      };
      const organizationId = 'org-123';

      // Mock getting client context
      httpService.get.mockReturnValue(
        of({
          data: {
            industry: 'healthcare',
            size: 'enterprise',
            regulations: ['HIPAA', 'SOC2'],
          },
        })
      );

      httpService.post.mockReturnValue(
        of({
          data: {
            recommendations: [
              {
                title: 'HIPAA-specific encryption requirements',
                context: 'Healthcare industry requirement',
              },
            ],
          },
        })
      );

      const result = await service.generateRecommendations(recommendationDto, organizationId);

      expect(httpService.get).toHaveBeenCalledWith(expect.stringContaining('/context/client-123'));
      expect(result.recommendations[0].context).toContain('Healthcare');
    });
  });

  describe('compareFrameworks', () => {
    it('should compare multiple compliance frameworks', async () => {
      const comparisonDto = {
        clientId: 'client-123',
        frameworks: ['SOC2', 'ISO27001', 'NIST'],
        includeMapping: true,
      };
      const organizationId = 'org-123';

      const mockComparison = {
        data: {
          frameworks: ['SOC2', 'ISO27001', 'NIST'],
          overlapAnalysis: {
            'SOC2-ISO27001': 0.65,
            'SOC2-NIST': 0.7,
            'ISO27001-NIST': 0.6,
          },
          uniqueControls: {
            SOC2: ['CC6.7', 'CC6.8'],
            ISO27001: ['A.15.1', 'A.15.2'],
            NIST: ['AC-1', 'AC-2'],
          },
          mappings: [
            {
              SOC2: 'CC6.1',
              ISO27001: 'A.9.1',
              NIST: 'AC-2',
              similarity: 0.92,
            },
          ],
          consolidationOpportunities: [
            {
              controls: ['CC6.1', 'A.9.1', 'AC-2'],
              description: 'Unified access control implementation',
              effortSavings: '30%',
            },
          ],
        },
      };

      httpService.post.mockReturnValue(of(mockComparison));

      const result = await service.compareFrameworks(comparisonDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://ai-engine:8080/compare/frameworks',
        expect.objectContaining({
          frameworks: comparisonDto.frameworks,
          includeMapping: true,
        })
      );
      expect(result.overlapAnalysis).toBeDefined();
      expect(result.consolidationOpportunities).toHaveLength(1);
    });

    it('should identify framework migration paths', async () => {
      const comparisonDto = {
        clientId: 'client-123',
        currentFramework: 'SOC2',
        targetFrameworks: ['ISO27001'],
        migrationAnalysis: true,
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            migrationPath: {
              from: 'SOC2',
              to: 'ISO27001',
              gapCount: 15,
              reusePercentage: 65,
              estimatedEffort: '3-6 months',
              steps: ['Map existing controls', 'Identify gaps', 'Implement missing controls'],
            },
          },
        })
      );

      const result = await service.compareFrameworks(comparisonDto, organizationId);

      expect(result.migrationPath).toBeDefined();
      expect(result.migrationPath.reusePercentage).toBe(65);
    });
  });

  describe('findAll', () => {
    it('should return paginated analyses', async () => {
      const query = {
        page: 1,
        limit: 10,
        status: 'completed',
      };
      const organizationId = 'org-123';

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockAnalysis], 1]);

      const result = await service.findAll(query, organizationId);

      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'analysis.organizationId = :organizationId',
        { organizationId }
      );
      expect(result).toEqual({
        data: [mockAnalysis],
        total: 1,
        page: 1,
        limit: 10,
      });
    });

    it('should filter by multiple criteria', async () => {
      const query = {
        clientId: 'client-123',
        type: 'compliance_gap',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      };
      const organizationId = 'org-123';

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(query, organizationId);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('analysis.clientId = :clientId', {
        clientId: query.clientId,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('analysis.type = :type', {
        type: query.type,
      });
    });
  });

  describe('findOne', () => {
    it('should return analysis by ID', async () => {
      repository.findOne.mockResolvedValue(mockAnalysis);

      const result = await service.findOne('analysis-123', 'org-123');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          id: 'analysis-123',
          organizationId: 'org-123',
        },
        relations: ['client'],
      });
      expect(result).toEqual(mockAnalysis);
    });

    it('should use cache for frequently accessed analyses', async () => {
      const cacheKey = 'analysis:analysis-123';
      cacheManager.get.mockResolvedValue(mockAnalysis);

      const result = await service.findOne('analysis-123', 'org-123');

      expect(cacheManager.get).toHaveBeenCalledWith(cacheKey);
      expect(repository.findOne).not.toHaveBeenCalled();
      expect(result).toEqual(mockAnalysis);
    });

    it('should throw NotFoundException when not found', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent', 'org-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update analysis metadata', async () => {
      const updateDto = {
        tags: ['quarterly-review'],
        notes: 'Updated findings',
      };

      repository.findOne.mockResolvedValue(mockAnalysis);
      repository.save.mockResolvedValue({
        ...mockAnalysis,
        ...updateDto,
      });

      const result = await service.update('analysis-123', updateDto, 'org-123');

      expect(repository.save).toHaveBeenCalledWith({
        ...mockAnalysis,
        ...updateDto,
        updatedAt: expect.any(Date),
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('analysis.updated', expect.any(Object));
      expect(cacheManager.del).toHaveBeenCalledWith('analysis:analysis-123');
    });

    it('should prevent updating completed analyses', async () => {
      const completedAnalysis = {
        ...mockAnalysis,
        status: 'completed',
        completedAt: new Date(),
      };

      repository.findOne.mockResolvedValue(completedAnalysis);

      await expect(
        service.update('analysis-123', { status: 'pending' }, 'org-123')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Event handling', () => {
    it('should emit events for analysis lifecycle', async () => {
      // Create
      repository.create.mockReturnValue(mockAnalysis);
      repository.save.mockResolvedValue(mockAnalysis);
      await service.create({
        clientId: 'client-123',
        type: 'compliance_gap',
        createdBy: 'user-123',
        organizationId: 'org-123',
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('analysis.created', expect.any(Object));

      // Update
      repository.findOne.mockResolvedValue(mockAnalysis);
      repository.save.mockResolvedValue(mockAnalysis);
      await service.update('analysis-123', { tags: ['test'] }, 'org-123');
      expect(eventEmitter.emit).toHaveBeenCalledWith('analysis.updated', expect.any(Object));

      // Complete
      repository.findOne.mockResolvedValue({ ...mockAnalysis, status: 'processing' });
      repository.save.mockResolvedValue({ ...mockAnalysis, status: 'completed' });
      await service.completeAnalysis('analysis-123', { findings: {} });
      expect(eventEmitter.emit).toHaveBeenCalledWith('analysis.completed', expect.any(Object));
    });
  });

  describe('AI Model Management', () => {
    it('should handle model version updates', async () => {
      const createDto = {
        clientId: 'client-123',
        type: 'predictive',
        modelVersion: 'v2.0',
        createdBy: 'user-123',
        organizationId: 'org-123',
      };

      repository.create.mockReturnValue(mockAnalysis);
      repository.save.mockResolvedValue({
        ...mockAnalysis,
        metadata: { ...mockAnalysis.metadata, modelVersion: 'v2.0' },
      });

      const result = await service.create(createDto);

      expect(result.metadata.modelVersion).toBe('v2.0');
    });

    it('should track model performance metrics', async () => {
      const performanceMetrics = {
        accuracy: 0.92,
        precision: 0.89,
        recall: 0.94,
        f1Score: 0.91,
      };

      httpService.post.mockReturnValue(
        of({
          data: {
            result: {},
            metrics: performanceMetrics,
          },
        })
      );

      await service.analyzeCompliance({ clientId: 'client-123', frameworks: ['SOC2'] }, 'org-123');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'analysis.model.metrics',
        expect.objectContaining({ metrics: performanceMetrics })
      );
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed AI requests', async () => {
      const createDto = {
        clientId: 'client-123',
        type: 'compliance_gap',
        createdBy: 'user-123',
        organizationId: 'org-123',
      };

      let attempts = 0;
      httpService.post.mockImplementation((url, data) => {
        return defer(() => {
          attempts++;
          if (attempts < 3) {
            return throwError(() => new Error('Temporary failure'));
          }
          return of({ data: { jobId: 'job-123' } });
        });
      });

      const createdAnalysis = { ...mockAnalysis, status: 'pending' };
      repository.create.mockReturnValue(createdAnalysis);
      repository.save.mockResolvedValue(createdAnalysis);
      repository.update.mockResolvedValue({ affected: 1 });

      await service.create(createDto);

      // Wait for async operations to complete including retries
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(httpService.post).toHaveBeenCalledTimes(1);
      expect(attempts).toBe(3);
    });

    it('should fall back to rule-based analysis on AI failure', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('AI service down')));

      const result = await service.analyzeCompliance(
        { clientId: 'client-123', frameworks: ['SOC2'], fallbackEnabled: true },
        'org-123'
      );

      expect(result.analysisMethod).toBe('rule_based');
      expect(result.disclaimer).toContain('AI service unavailable');
    });
  });
});
