import { HttpService } from '@nestjs/axios';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cache } from 'cache-manager';
import { of, throwError } from 'rxjs';
import { Repository } from 'typeorm';
import { Prediction } from './entities/prediction.entity';
import { PredictionsService } from './predictions.service';

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
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
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

describe('PredictionsService', () => {
  let service: PredictionsService;
  let repository: any;
  let eventEmitter: any;
  let httpService: any;
  let configService: any;
  let cacheManager: any;

  const mockPrediction = {
    id: 'prediction-123',
    clientId: 'client-123',
    organizationId: 'org-123',
    type: 'compliance_score',
    timeframe: '90days',
    predictions: {
      30: { value: 85.5, confidence: 0.92 },
      60: { value: 87.2, confidence: 0.88 },
      90: { value: 89.0, confidence: 0.82 },
    },
    modelVersion: 'v2.3',
    metadata: {
      features: ['historical_scores', 'control_effectiveness'],
      modelType: 'time_series',
      trainingDate: new Date('2024-01-01'),
    },
    status: 'active',
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

    // Manual instantiation
    service = new PredictionsService(
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
        PREDICTION_SERVICE_URL: 'http://prediction-engine:8081',
        AI_SERVICE_TIMEOUT: 30000,
        PREDICTION_CACHE_TTL: 1800,
        MODEL_VERSION: 'v2.3',
      };
      return configs[key];
    });
  });

  describe('create', () => {
    it('should create a new prediction', async () => {
      const createDto = {
        clientId: 'client-123',
        type: 'compliance_score',
        timeframe: '90days',
        createdBy: 'user-123',
        organizationId: 'org-123',
      };

      repository.create.mockReturnValue(mockPrediction);
      repository.save.mockResolvedValue(mockPrediction);
      httpService.post.mockReturnValue(of({ data: { jobId: 'job-123', status: 'processing' } }));

      const result = await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith({
        ...createDto,
        status: 'pending',
        modelVersion: 'v2.3',
      });
      expect(repository.save).toHaveBeenCalledWith(mockPrediction);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'prediction.created',
        expect.objectContaining({ prediction: mockPrediction })
      );
      expect(httpService.post).toHaveBeenCalledWith(
        'http://prediction-engine:8081/predict',
        expect.objectContaining({
          predictionId: mockPrediction.id,
          type: createDto.type,
          timeframe: createDto.timeframe,
        })
      );
      expect(result).toEqual(mockPrediction);
    });

    it('should handle prediction engine errors', async () => {
      const createDto = {
        clientId: 'client-123',
        type: 'risk_assessment',
        createdBy: 'user-123',
        organizationId: 'org-123',
      };

      repository.create.mockReturnValue(mockPrediction);
      repository.save.mockResolvedValue(mockPrediction);
      httpService.post.mockReturnValue(
        throwError(() => new Error('Prediction engine unavailable'))
      );

      const result = await service.create(createDto);

      expect(result.status).toBe('pending');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'prediction.engine.failed',
        expect.any(Object)
      );
    });
  });

  describe('predictCompliance', () => {
    it('should generate compliance score predictions', async () => {
      const predictionDto = {
        clientId: 'client-123',
        frameworks: ['SOC2', 'ISO27001'],
        timeframe: '12months',
      };
      const organizationId = 'org-123';

      const mockPredictionResponse = {
        data: {
          predictions: {
            '3months': {
              SOC2: { score: 84.0, confidence: 0.9 },
              ISO27001: { score: 83.5, confidence: 0.88 },
            },
            '6months': {
              SOC2: { score: 86.5, confidence: 0.85 },
              ISO27001: { score: 85.0, confidence: 0.82 },
            },
            '12months': {
              SOC2: { score: 90.0, confidence: 0.75 },
              ISO27001: { score: 88.5, confidence: 0.72 },
            },
          },
          modelMetrics: {
            accuracy: 0.92,
            precision: 0.89,
            recall: 0.94,
          },
        },
      };

      httpService.post.mockReturnValue(of(mockPredictionResponse));

      const result = await service.predictCompliance(predictionDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://prediction-engine:8081/predict/compliance',
        expect.objectContaining({
          clientId: predictionDto.clientId,
          frameworks: predictionDto.frameworks,
          timeframe: predictionDto.timeframe,
          organizationId,
        })
      );
      expect(result).toEqual(mockPredictionResponse.data);
    });

    it('should use cached predictions when available', async () => {
      const predictionDto = {
        clientId: 'client-123',
        frameworks: ['SOC2'],
      };
      const organizationId = 'org-123';
      const cacheKey = `compliance:${organizationId}:${predictionDto.clientId}:SOC2`;
      const cachedPrediction = { score: 85.0, cached: true };

      cacheManager.get.mockResolvedValue(cachedPrediction);

      const result = await service.predictCompliance(predictionDto, organizationId);

      expect(cacheManager.get).toHaveBeenCalledWith(cacheKey);
      expect(httpService.post).not.toHaveBeenCalled();
      expect(result).toEqual(cachedPrediction);
    });

    it('should include scenario analysis when requested', async () => {
      const predictionDto = {
        clientId: 'client-123',
        frameworks: ['SOC2'],
        includeScenarios: true,
      };
      const organizationId = 'org-123';

      cacheManager.get.mockResolvedValue(null);
      httpService.post.mockReturnValue(
        of({
          data: {
            baseline: { score: 85.0 },
            scenarios: {
              bestCase: { score: 92.0, assumptions: ['All controls automated'] },
              worstCase: { score: 78.0, assumptions: ['Major incident occurs'] },
              likelyCase: { score: 87.0, assumptions: ['Normal progression'] },
            },
          },
        })
      );

      const result = await service.predictCompliance(predictionDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ includeScenarios: true })
      );
      expect(result.scenarios).toBeDefined();
    });
  });

  describe('predictRisks', () => {
    it('should predict risk events with ML models', async () => {
      const riskDto = {
        clientId: 'client-123',
        riskCategories: ['security', 'compliance'],
        timeHorizon: '6months',
      };
      const organizationId = 'org-123';

      const mockRiskResponse = {
        data: {
          riskPredictions: [
            {
              category: 'security',
              event: 'Data breach attempt',
              probability: 0.23,
              confidence: 0.88,
              timeframe: '2-3 months',
              modelFeatures: {
                threat_landscape_score: 0.65,
                vulnerability_index: 0.45,
                historical_incidents: 2,
              },
            },
          ],
          aggregateRisk: {
            overall: 'medium',
            trend: 'increasing',
          },
        },
      };

      httpService.post.mockReturnValue(of(mockRiskResponse));

      const result = await service.predictRisks(riskDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://prediction-engine:8081/predict/risks',
        expect.objectContaining({
          clientId: riskDto.clientId,
          categories: riskDto.riskCategories,
          horizon: riskDto.timeHorizon,
        })
      );
      expect(result).toEqual(mockRiskResponse.data);
    });

    it('should perform Monte Carlo simulations', async () => {
      const riskDto = {
        clientId: 'client-123',
        includeSimulations: true,
        simulationRuns: 10000,
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            simulations: {
              runs: 10000,
              convergenceAchieved: true,
              results: {
                expectedValue: 0.25,
                standardDeviation: 0.08,
                valueAtRisk: { p95: 0.42, p99: 0.51 },
              },
            },
          },
        })
      );

      const result = await service.predictRisks(riskDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          monteCarlo: {
            enabled: true,
            runs: 10000,
          },
        })
      );
      expect(result.simulations.convergenceAchieved).toBe(true);
    });
  });

  describe('predictControlEffectiveness', () => {
    it('should predict control effectiveness trends', async () => {
      const controlDto = {
        clientId: 'client-123',
        controlIds: ['ctrl-1', 'ctrl-2'],
        evaluationPeriod: '12months',
      };
      const organizationId = 'org-123';

      const mockControlResponse = {
        data: {
          predictions: [
            {
              controlId: 'ctrl-1',
              currentEffectiveness: 0.85,
              predictions: {
                '3months': { effectiveness: 0.87, confidence: 0.9 },
                '6months': { effectiveness: 0.88, confidence: 0.85 },
                '12months': { effectiveness: 0.9, confidence: 0.75 },
              },
              degradationRisk: {
                probability: 0.12,
                factors: ['Resource constraints', 'Process changes'],
              },
            },
          ],
        },
      };

      httpService.post.mockReturnValue(of(mockControlResponse));

      const result = await service.predictControlEffectiveness(controlDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://prediction-engine:8081/predict/control-effectiveness',
        expect.objectContaining({
          clientId: controlDto.clientId,
          controlIds: controlDto.controlIds,
          period: controlDto.evaluationPeriod,
        })
      );
      expect(result).toEqual(mockControlResponse.data);
    });

    it('should include feature importance analysis', async () => {
      const controlDto = {
        clientId: 'client-123',
        controlIds: ['ctrl-1'],
        factors: ['testing_frequency', 'automation_level', 'evidence_quality'],
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            predictions: [],
            featureAnalysis: {
              testing_frequency: { importance: 0.35, trend: 'increasing' },
              automation_level: { importance: 0.28, trend: 'stable' },
              evidence_quality: { importance: 0.22, trend: 'decreasing' },
            },
          },
        })
      );

      const result = await service.predictControlEffectiveness(controlDto, organizationId);

      expect(result.featureAnalysis).toBeDefined();
      expect(result.featureAnalysis['testing_frequency'].importance).toBe(0.35);
    });
  });

  describe('predictResourceNeeds', () => {
    it('should predict resource requirements', async () => {
      const resourceDto = {
        clientId: 'client-123',
        planningHorizon: '12months',
        resourceTypes: ['personnel', 'tools'],
      };
      const organizationId = 'org-123';

      const mockResourceResponse = {
        data: {
          predictions: {
            personnel: {
              current: 5,
              predictions: {
                '3months': { needed: 6, confidence: 0.9 },
                '6months': { needed: 7, confidence: 0.85 },
                '12months': { needed: 8, confidence: 0.75 },
              },
              breakdown: {
                compliance_analysts: 3,
                security_engineers: 2,
                auditors: 3,
              },
            },
            tools: {
              current: ['GRC Platform', 'SIEM'],
              additions: {
                '3months': [],
                '6months': ['Vulnerability Scanner'],
                '12months': ['AI Analytics Platform'],
              },
            },
          },
          drivers: [
            'Increasing compliance requirements',
            'Expanding client base',
            'New framework adoptions',
          ],
        },
      };

      httpService.post.mockReturnValue(of(mockResourceResponse));

      const result = await service.predictResourceNeeds(resourceDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://prediction-engine:8081/predict/resources',
        expect.objectContaining({
          clientId: resourceDto.clientId,
          horizon: resourceDto.planningHorizon,
          types: resourceDto.resourceTypes,
        })
      );
      expect(result).toEqual(mockResourceResponse.data);
    });

    it('should include cost projections', async () => {
      const resourceDto = {
        clientId: 'client-123',
        planningHorizon: '12months',
        includeCostProjections: true,
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            predictions: {},
            costProjections: {
              '3months': { total: 150000, breakdown: {} },
              '6months': { total: 180000, breakdown: {} },
              '12months': { total: 220000, breakdown: {} },
            },
            roi: {
              breakeven: '8months',
              projectedReturn: 1.35,
            },
          },
        })
      );

      const result = await service.predictResourceNeeds(resourceDto, organizationId);

      expect(result.costProjections).toBeDefined();
      expect(result.roi.projectedReturn).toBe(1.35);
    });
  });

  describe('predictAuditOutcomes', () => {
    it('should predict audit results', async () => {
      const auditDto = {
        clientId: 'client-123',
        auditType: 'SOC2_TYPE2',
        scheduledDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const organizationId = 'org-123';

      const mockAuditResponse = {
        data: {
          predictions: {
            overallOutcome: {
              clean: 0.75,
              qualified: 0.2,
              adverse: 0.05,
            },
            findingsPrediction: {
              expected: 3,
              distribution: {
                0: 0.1,
                1: 0.15,
                2: 0.25,
                3: 0.3,
                4: 0.15,
                5: 0.05,
              },
            },
          },
          riskFactors: [
            { factor: 'Recent control changes', impact: 'medium' },
            { factor: 'New auditor', impact: 'low' },
          ],
        },
      };

      httpService.post.mockReturnValue(of(mockAuditResponse));

      const result = await service.predictAuditOutcomes(auditDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://prediction-engine:8081/predict/audit',
        expect.objectContaining({
          clientId: auditDto.clientId,
          auditType: auditDto.auditType,
          scheduledDate: auditDto.scheduledDate,
        })
      );
      expect(result).toEqual(mockAuditResponse.data);
    });

    it('should provide preparation recommendations', async () => {
      const auditDto = {
        clientId: 'client-123',
        auditType: 'ISO27001',
        includePreparationPlan: true,
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            predictions: {},
            preparationPlan: {
              criticalActions: [
                {
                  action: 'Complete risk assessment update',
                  deadline: '45 days before audit',
                  impact: 'high',
                },
                {
                  action: 'Conduct internal audit',
                  deadline: '30 days before audit',
                  impact: 'high',
                },
              ],
              timeline: {
                '90days': ['Begin evidence collection'],
                '60days': ['Complete control testing'],
                '30days': ['Finalize documentation'],
              },
            },
          },
        })
      );

      const result = await service.predictAuditOutcomes(auditDto, organizationId);

      expect(result.preparationPlan).toBeDefined();
      expect(result.preparationPlan.criticalActions).toHaveLength(2);
    });
  });

  describe('evaluatePredictionAccuracy', () => {
    it('should evaluate historical prediction accuracy', async () => {
      const evaluationDto = {
        predictionIds: ['pred-1', 'pred-2'],
      };
      const organizationId = 'org-123';

      const predictions = [
        {
          id: 'pred-1',
          clientId: 'client-123',
          type: 'compliance_score',
          createdAt: new Date(Date.now() - 1000000), // Old date to avoid triggering retraining
          predictions: { 30: { value: 85.0 } },
          actualValues: { 30: 83.5 },
        },
        {
          id: 'pred-2',
          clientId: 'client-456',
          type: 'compliance_score',
          createdAt: new Date(Date.now() - 1000000), // Old date to avoid triggering retraining
          predictions: { 30: { value: 78.0 } },
          actualValues: { 30: 79.2 },
        },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(predictions),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.evaluatePredictionAccuracy(evaluationDto, organizationId);

      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(result.evaluations).toHaveLength(2);
      expect(result.aggregateMetrics.meanAbsoluteError).toBeDefined();
    });

    it('should calculate model performance metrics', async () => {
      const evaluationDto = {
        evaluationPeriod: 'last_quarter',
      };
      const organizationId = 'org-123';

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'pred-1',
            clientId: 'client-123',
            type: 'compliance_score',
            createdAt: new Date(Date.now() - 1000000), // Old date to avoid triggering retraining
            predictions: { 30: { value: 85.0 } },
            actualValues: { 30: 84.0 },
          },
        ]),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.evaluatePredictionAccuracy(evaluationDto, organizationId);

      expect(result.modelPerformance).toBeDefined();
      expect(result.aggregateMetrics.meanAccuracy).toBeGreaterThan(0);
    });
  });

  describe('backtestPredictions', () => {
    it('should perform rolling window backtesting', async () => {
      const backtestDto = {
        modelType: 'compliance_score',
        historicalPeriod: '2years',
        testStrategy: 'rolling_window',
        windowSize: '3months',
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            results: {
              windows: [
                { period: 'Q1-2022', accuracy: 0.91, mae: 2.1 },
                { period: 'Q2-2022', accuracy: 0.93, mae: 1.8 },
              ],
              aggregate: {
                meanAccuracy: 0.92,
                stabilityScore: 0.88,
                overfittingRisk: 'low',
              },
            },
          },
        })
      );

      const result = await service.backtestPredictions(backtestDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        'http://prediction-engine:8081/backtest',
        expect.objectContaining({
          modelType: backtestDto.modelType,
          strategy: backtestDto.testStrategy,
          windowSize: backtestDto.windowSize,
        })
      );
      expect(result.results.aggregate.meanAccuracy).toBe(0.92);
    });

    it('should perform walk-forward analysis', async () => {
      const backtestDto = {
        modelType: 'risk_prediction',
        testStrategy: 'walk_forward',
        retrainFrequency: 'monthly',
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            results: {
              iterations: 12,
              performanceDecay: 0.02,
              optimalRetrainFrequency: '6weeks',
            },
          },
        })
      );

      const result = await service.backtestPredictions(backtestDto, organizationId);

      expect(result.results.optimalRetrainFrequency).toBe('6weeks');
    });
  });

  describe('findAll', () => {
    it('should return paginated predictions', async () => {
      const query = {
        page: 1,
        limit: 10,
        type: 'compliance_score',
      };
      const organizationId = 'org-123';

      // Set up the mock before calling the service
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockPrediction], 1]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll(query, organizationId);

      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'prediction.organizationId = :organizationId',
        { organizationId }
      );
      expect(result).toEqual({
        data: [mockPrediction],
        total: 1,
        page: 1,
        limit: 10,
      });
    });

    it('should filter by accuracy threshold', async () => {
      const query = {
        minAccuracy: 0.9,
      };
      const organizationId = 'org-123';

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(query, organizationId);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'prediction.accuracy >= :minAccuracy',
        { minAccuracy: 0.9 }
      );
    });
  });

  describe('findOne', () => {
    it('should return prediction by ID', async () => {
      repository.findOne.mockResolvedValue(mockPrediction);

      const result = await service.findOne('prediction-123', 'org-123');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          id: 'prediction-123',
          organizationId: 'org-123',
        },
        relations: ['client'],
      });
      expect(result).toEqual(mockPrediction);
    });

    it('should use cache for recent predictions', async () => {
      const cacheKey = 'prediction:prediction-123';
      cacheManager.get.mockResolvedValue(mockPrediction);

      const result = await service.findOne('prediction-123', 'org-123');

      expect(cacheManager.get).toHaveBeenCalledWith(cacheKey);
      expect(repository.findOne).not.toHaveBeenCalled();
      expect(result).toEqual(mockPrediction);
    });

    it('should throw NotFoundException when not found', async () => {
      cacheManager.get.mockResolvedValue(null);
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent', 'org-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update prediction metadata', async () => {
      const updateDto = {
        tags: ['quarterly-review'],
        notes: 'Updated based on new data',
      };

      repository.findOne.mockResolvedValue(mockPrediction);
      repository.save.mockResolvedValue({
        ...mockPrediction,
        ...updateDto,
      });

      const result = await service.update('prediction-123', updateDto, 'org-123');

      expect(repository.save).toHaveBeenCalledWith({
        ...mockPrediction,
        ...updateDto,
        updatedAt: expect.any(Date),
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('prediction.updated', expect.any(Object));
      expect(cacheManager.del).toHaveBeenCalledWith('prediction:prediction-123');
    });

    it('should prevent updating active predictions', async () => {
      const activePrediction = {
        ...mockPrediction,
        status: 'processing',
      };

      repository.findOne.mockResolvedValue(activePrediction);

      await expect(
        service.update('prediction-123', { status: 'completed' }, 'org-123')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Model Retraining', () => {
    it('should trigger model retraining when accuracy drops', async () => {
      const evaluationDto = {
        evaluationPeriod: 'last_month',
      };
      const organizationId = 'org-123';

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'pred-1',
            clientId: 'client-123',
            type: 'compliance_score',
            createdAt: new Date(),
            predictions: { 30: { value: 85.0 } },
            actualValues: { 30: 60.0 }, // Very large error (25 points) to ensure accuracy < 80%
          },
        ]),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      httpService.post.mockReturnValue(of({ data: { retrainJobId: 'retrain-123' } }));

      await service.evaluatePredictionAccuracy(evaluationDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/retrain'),
        expect.objectContaining({
          modelType: 'compliance_score',
          reason: 'accuracy_degradation',
        })
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('model.retrain.triggered', expect.any(Object));
    });
  });

  describe('Ensemble Predictions', () => {
    it('should combine multiple models for predictions', async () => {
      const predictionDto = {
        clientId: 'client-123',
        useEnsemble: true,
        ensembleModels: ['time_series', 'random_forest', 'neural_network'],
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            ensemblePrediction: {
              value: 85.5,
              confidence: 0.93,
            },
            modelContributions: {
              time_series: { value: 84.0, weight: 0.4 },
              random_forest: { value: 86.0, weight: 0.35 },
              neural_network: { value: 87.0, weight: 0.25 },
            },
            method: 'weighted_average',
          },
        })
      );

      const result = await service.predictCompliance(predictionDto, organizationId);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ensemble: {
            enabled: true,
            models: predictionDto.ensembleModels,
          },
        })
      );
      expect(result.ensemblePrediction.confidence).toBe(0.93);
    });
  });

  describe('Prediction Explanations', () => {
    it('should provide SHAP values for predictions', async () => {
      const predictionDto = {
        clientId: 'client-123',
        explainabilityMethod: 'shap',
      };
      const organizationId = 'org-123';

      httpService.post.mockReturnValue(
        of({
          data: {
            prediction: { value: 85.0 },
            explanation: {
              method: 'shap',
              featureContributions: {
                control_effectiveness: 12.5,
                evidence_timeliness: 8.3,
                historical_trend: 6.2,
                recent_incidents: -4.5,
              },
              baselineValue: 62.5,
            },
          },
        })
      );

      const result = await service.predictCompliance(predictionDto, organizationId);

      expect(result.explanation.method).toBe('shap');
      expect(result.explanation.featureContributions).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should soft delete prediction', async () => {
      const inactivePrediction = {
        ...mockPrediction,
        status: 'expired',
      };
      repository.findOne.mockResolvedValue(inactivePrediction);
      repository.softDelete.mockResolvedValue({ affected: 1 });

      const result = await service.remove('prediction-123', 'org-123');

      expect(repository.softDelete).toHaveBeenCalledWith('prediction-123');
      expect(eventEmitter.emit).toHaveBeenCalledWith('prediction.deleted', expect.any(Object));
      expect(cacheManager.del).toHaveBeenCalledWith('prediction:prediction-123');
    });
  });
});
