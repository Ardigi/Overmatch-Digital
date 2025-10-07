import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { CreatePredictionDto, QueryPredictionDto, UpdatePredictionDto } from './dto';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';

describe('PredictionsController', () => {
  let controller: PredictionsController;
  let service: any;

  const mockUser = {
    id: 'user-123',
    email: 'analyst@example.com',
    organizationId: 'org-123',
    roles: ['compliance_analyst'],
  };

  const mockPrediction = {
    id: 'prediction-123',
    clientId: 'client-123',
    type: 'compliance_score',
    timeframe: '90days',
    predictions: {
      30: { value: 85.5, confidence: 0.92 },
      60: { value: 87.2, confidence: 0.88 },
      90: { value: 89.0, confidence: 0.82 },
    },
    modelVersion: 'v2.3',
    factors: {
      positive: ['Improved control implementation', 'Regular evidence collection'],
      negative: ['Upcoming regulatory changes', 'Staff turnover risk'],
    },
    accuracy: {
      mae: 2.3,
      rmse: 3.1,
      mape: 0.027,
    },
    status: 'active',
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
      predictCompliance: jest.fn(),
      predictRisks: jest.fn(),
      predictControlEffectiveness: jest.fn(),
      predictResourceNeeds: jest.fn(),
      predictAuditOutcomes: jest.fn(),
      evaluatePredictionAccuracy: jest.fn(),
      backtestPredictions: jest.fn(),
      getPredictionHistory: jest.fn(),
      exportPredictions: jest.fn(),
    };

    // Manual instantiation
    controller = new PredictionsController(service);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new prediction', async () => {
      const createDto: CreatePredictionDto = {
        clientId: 'client-123',
        type: 'compliance_score',
        timeframe: '90days',
        modelConfig: {
          modelType: 'time_series',
          features: ['historical_scores', 'control_effectiveness', 'evidence_quality'],
          hyperparameters: {
            lookback_period: 180,
            seasonality: true,
          },
        },
      };

      service.create.mockResolvedValue(mockPrediction);

      const result = await controller.create(createDto, mockUser);

      expect(service.create).toHaveBeenCalledWith({
        ...createDto,
        createdBy: mockUser.id,
        organizationId: mockUser.organizationId,
      });
      expect(result).toEqual(mockPrediction);
    });

    it('should validate prediction timeframe', async () => {
      const createDto = {
        clientId: 'client-123',
        type: 'compliance_score',
        timeframe: 'invalid',
      } as any;

      service.create.mockRejectedValue(new BadRequestException('Invalid timeframe'));

      await expect(controller.create(createDto, mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('predictCompliance', () => {
    it('should generate compliance score predictions', async () => {
      const predictionDto = {
        clientId: 'client-123',
        frameworks: ['SOC2', 'ISO27001'],
        timeframe: '12months',
        includeScenarios: true,
      };

      const compliancePrediction = {
        client: 'client-123',
        frameworks: ['SOC2', 'ISO27001'],
        baseline: {
          current: 82.5,
          trend: 'improving',
        },
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
        scenarios: {
          bestCase: { '12months': 93.0 },
          likelyCase: { '12months': 89.0 },
          worstCase: { '12months': 84.0 },
        },
        drivers: [
          { factor: 'Control automation', impact: 'high', direction: 'positive' },
          { factor: 'New regulations', impact: 'medium', direction: 'negative' },
        ],
      };

      service.predictCompliance.mockResolvedValue(compliancePrediction);

      const result = await controller.predictCompliance(predictionDto, mockUser);

      expect(service.predictCompliance).toHaveBeenCalledWith(
        predictionDto,
        mockUser.organizationId
      );
      expect(result).toEqual(compliancePrediction);
    });

    it('should handle ML model failures gracefully', async () => {
      const predictionDto = {
        clientId: 'client-123',
        frameworks: ['SOC2'],
      };

      service.predictCompliance.mockResolvedValue({
        error: 'Model temporarily unavailable',
        fallback: true,
        predictions: {
          method: 'statistical_baseline',
          '3months': { score: 83.0, confidence: 0.6 },
        },
      });

      const result = await controller.predictCompliance(predictionDto, mockUser);

      expect(result.fallback).toBe(true);
      expect(result.predictions.method).toBe('statistical_baseline');
    });
  });

  describe('predictRisks', () => {
    it('should predict future risk events', async () => {
      const riskDto = {
        clientId: 'client-123',
        riskCategories: ['security', 'compliance', 'operational'],
        timeHorizon: '6months',
        includeEarlyWarnings: true,
      };

      const riskPrediction = {
        timeHorizon: '6months',
        riskPredictions: [
          {
            category: 'security',
            event: 'Data breach attempt',
            probability: 0.23,
            timeframe: '2-3 months',
            impact: 'high',
            earlyIndicators: ['Increased phishing attempts', 'Unusual network activity patterns'],
          },
          {
            category: 'compliance',
            event: 'Regulatory audit failure',
            probability: 0.15,
            timeframe: '4-6 months',
            impact: 'medium',
            earlyIndicators: ['Control effectiveness declining', 'Evidence gaps increasing'],
          },
        ],
        mitigationStrategies: [
          {
            risk: 'Data breach attempt',
            actions: ['Enhance security training', 'Implement advanced threat detection'],
            urgency: 'high',
          },
        ],
        confidenceInterval: {
          lower: 0.8,
          upper: 0.95,
        },
      };

      service.predictRisks.mockResolvedValue(riskPrediction);

      const result = await controller.predictRisks(riskDto, mockUser);

      expect(service.predictRisks).toHaveBeenCalledWith(riskDto, mockUser.organizationId);
      expect(result).toEqual(riskPrediction);
    });

    it('should include Monte Carlo simulations when requested', async () => {
      const riskDto = {
        clientId: 'client-123',
        includeSimulations: true,
        simulationRuns: 10000,
      };

      service.predictRisks.mockResolvedValue({
        predictions: [],
        simulations: {
          runs: 10000,
          percentiles: {
            p5: { totalRisk: 'low' },
            p50: { totalRisk: 'medium' },
            p95: { totalRisk: 'high' },
          },
          distribution: expect.any(Array),
        },
      });

      await controller.predictRisks(riskDto, mockUser);

      expect(service.predictRisks).toHaveBeenCalledWith(
        expect.objectContaining({
          includeSimulations: true,
          simulationRuns: 10000,
        }),
        mockUser.organizationId
      );
    });
  });

  describe('predictControlEffectiveness', () => {
    it('should predict control effectiveness trends', async () => {
      const controlDto = {
        clientId: 'client-123',
        controlIds: ['ctrl-1', 'ctrl-2', 'ctrl-3'],
        evaluationPeriod: '12months',
        factors: ['testing_frequency', 'evidence_quality', 'automation_level'],
      };

      const effectivenessPrediction = {
        predictions: [
          {
            controlId: 'ctrl-1',
            currentEffectiveness: 0.85,
            predictions: {
              '3months': { effectiveness: 0.87, confidence: 0.9 },
              '6months': { effectiveness: 0.88, confidence: 0.85 },
              '12months': { effectiveness: 0.9, confidence: 0.75 },
            },
            riskOfDegradation: 0.12,
            recommendedActions: ['Increase automation', 'Enhance monitoring frequency'],
          },
        ],
        aggregateMetrics: {
          overallTrend: 'improving',
          averageEffectiveness: {
            current: 0.83,
            predicted12Months: 0.88,
          },
          controlsAtRisk: 2,
        },
      };

      service.predictControlEffectiveness.mockResolvedValue(effectivenessPrediction);

      const result = await controller.predictControlEffectiveness(controlDto, mockUser);

      expect(service.predictControlEffectiveness).toHaveBeenCalledWith(
        controlDto,
        mockUser.organizationId
      );
      expect(result).toEqual(effectivenessPrediction);
    });
  });

  describe('predictResourceNeeds', () => {
    it('should predict resource requirements', async () => {
      const resourceDto = {
        clientId: 'client-123',
        planningHorizon: '12months',
        resourceTypes: ['personnel', 'tools', 'budget'],
        growthScenarios: ['conservative', 'moderate', 'aggressive'],
      };

      const resourcePrediction = {
        currentUtilization: {
          personnel: 0.82,
          tools: 0.65,
          budget: 0.78,
        },
        predictions: {
          conservative: {
            personnel: { '6months': 8, '12months': 9 },
            tools: { '6months': 'current', '12months': '+2 licenses' },
            budget: { '6months': 150000, '12months': 175000 },
          },
          moderate: {
            personnel: { '6months': 10, '12months': 12 },
            tools: { '6months': '+1 platform', '12months': '+3 licenses' },
            budget: { '6months': 180000, '12months': 220000 },
          },
        },
        bottlenecks: [
          {
            resource: 'personnel',
            timing: '4-6 months',
            impact: 'high',
            mitigation: 'Start recruitment process immediately',
          },
        ],
        recommendations: [
          'Hire 2 compliance analysts within 3 months',
          'Upgrade automation platform before Q3',
        ],
      };

      service.predictResourceNeeds.mockResolvedValue(resourcePrediction);

      const result = await controller.predictResourceNeeds(resourceDto, mockUser);

      expect(service.predictResourceNeeds).toHaveBeenCalledWith(
        resourceDto,
        mockUser.organizationId
      );
      expect(result).toEqual(resourcePrediction);
    });
  });

  describe('predictAuditOutcomes', () => {
    it('should predict audit results', async () => {
      const auditDto = {
        clientId: 'client-123',
        auditType: 'SOC2_TYPE2',
        scheduledDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        includeFindings: true,
      };

      const auditPrediction = {
        auditType: 'SOC2_TYPE2',
        scheduledDate: auditDto.scheduledDate,
        predictions: {
          overallOutcome: {
            clean: 0.75,
            qualified: 0.2,
            adverse: 0.05,
          },
          findingsPrediction: {
            expected: 3,
            range: { min: 1, max: 5 },
            byCategory: {
              'Access Control': 2,
              'Change Management': 1,
            },
          },
          areasOfConcern: [
            {
              area: 'User Access Reviews',
              riskLevel: 'medium',
              probability: 0.65,
              recommendation: 'Implement automated access review system',
            },
          ],
        },
        preparationScore: {
          current: 72,
          targetByAudit: 90,
          gap: 18,
        },
        actionPlan: [
          {
            action: 'Complete all control testing',
            deadline: '30 days before audit',
            priority: 'high',
          },
          {
            action: 'Remediate identified gaps',
            deadline: '45 days before audit',
            priority: 'critical',
          },
        ],
      };

      service.predictAuditOutcomes.mockResolvedValue(auditPrediction);

      const result = await controller.predictAuditOutcomes(auditDto, mockUser);

      expect(service.predictAuditOutcomes).toHaveBeenCalledWith(auditDto, mockUser.organizationId);
      expect(result).toEqual(auditPrediction);
    });
  });

  describe('evaluatePredictionAccuracy', () => {
    it('should evaluate historical prediction accuracy', async () => {
      const evaluationDto = {
        predictionIds: ['pred-1', 'pred-2', 'pred-3'],
        evaluationPeriod: 'last_quarter',
      };

      const accuracyReport = {
        period: 'last_quarter',
        evaluations: [
          {
            predictionId: 'pred-1',
            type: 'compliance_score',
            predicted: 85.0,
            actual: 83.5,
            error: 1.5,
            accuracy: 0.982,
          },
        ],
        aggregateMetrics: {
          meanAbsoluteError: 2.1,
          rootMeanSquareError: 2.8,
          meanAccuracy: 0.975,
        },
        modelPerformance: {
          compliance_score: { accuracy: 0.98, trending: 'stable' },
          risk_prediction: { accuracy: 0.92, trending: 'improving' },
        },
      };

      service.evaluatePredictionAccuracy.mockResolvedValue(accuracyReport);

      const result = await controller.evaluatePredictionAccuracy(evaluationDto, mockUser);

      expect(service.evaluatePredictionAccuracy).toHaveBeenCalledWith(
        evaluationDto,
        mockUser.organizationId
      );
      expect(result).toEqual(accuracyReport);
    });
  });

  describe('backtestPredictions', () => {
    it('should perform prediction backtesting', async () => {
      const backtestDto = {
        modelType: 'compliance_score',
        historicalPeriod: '2years',
        testStrategy: 'rolling_window',
        windowSize: '3months',
      };

      const backtestResults = {
        modelType: 'compliance_score',
        testPeriod: '2years',
        results: {
          accuracyOverTime: [
            { period: 'Q1-2022', accuracy: 0.91 },
            { period: 'Q2-2022', accuracy: 0.93 },
            { period: 'Q3-2022', accuracy: 0.95 },
            { period: 'Q4-2022', accuracy: 0.94 },
          ],
          performanceMetrics: {
            sharpeRatio: 1.8,
            informationRatio: 2.1,
            maxDrawdown: 0.05,
          },
          stabilityAnalysis: {
            coefficientOfVariation: 0.03,
            trend: 'improving',
          },
        },
        recommendations: [
          'Model performance is stable and improving',
          'Consider increasing prediction horizon',
        ],
      };

      service.backtestPredictions.mockResolvedValue(backtestResults);

      const result = await controller.backtestPredictions(backtestDto, mockUser);

      expect(service.backtestPredictions).toHaveBeenCalledWith(
        backtestDto,
        mockUser.organizationId
      );
      expect(result).toEqual(backtestResults);
    });
  });

  describe('findAll', () => {
    it('should return paginated predictions', async () => {
      const query: QueryPredictionDto = {
        page: 1,
        limit: 10,
        type: 'compliance_score',
        status: 'active',
      };

      service.findAll.mockResolvedValue({
        data: [mockPrediction],
        total: 1,
        page: 1,
        limit: 10,
      });

      const result = await controller.findAll(query, mockUser);

      expect(service.findAll).toHaveBeenCalledWith(query, mockUser.organizationId);
      expect(result.data).toHaveLength(1);
    });

    it('should filter by client and date range', async () => {
      const query: QueryPredictionDto = {
        clientId: 'client-123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      };

      service.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      await controller.findAll(query, mockUser);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: query.clientId,
          startDate: query.startDate,
          endDate: query.endDate,
        }),
        mockUser.organizationId
      );
    });
  });

  describe('findOne', () => {
    it('should return prediction by ID', async () => {
      service.findOne.mockResolvedValue(mockPrediction);

      const result = await controller.findOne('prediction-123', mockUser);

      expect(service.findOne).toHaveBeenCalledWith('prediction-123', mockUser.organizationId);
      expect(result).toEqual(mockPrediction);
    });

    it('should handle not found', async () => {
      service.findOne.mockRejectedValue(new NotFoundException('Prediction not found'));

      await expect(controller.findOne('non-existent', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update prediction metadata', async () => {
      const updateDto: UpdatePredictionDto = {
        tags: ['quarterly-review', 'board-presentation'],
        notes: 'Updated based on new data availability',
      };

      const updatedPrediction = { ...mockPrediction, ...updateDto };
      service.update.mockResolvedValue(updatedPrediction);

      const result = await controller.update('prediction-123', updateDto, mockUser);

      expect(service.update).toHaveBeenCalledWith(
        'prediction-123',
        updateDto,
        mockUser.organizationId
      );
      expect(result).toEqual(updatedPrediction);
    });
  });

  describe('getPredictionHistory', () => {
    it('should return prediction version history', async () => {
      const history = [
        {
          version: 1,
          timestamp: new Date('2024-01-01'),
          modelVersion: 'v2.1',
          accuracy: 0.91,
          changes: ['Initial prediction'],
        },
        {
          version: 2,
          timestamp: new Date('2024-02-01'),
          modelVersion: 'v2.2',
          accuracy: 0.93,
          changes: ['Model updated', 'New features added'],
        },
      ];

      service.getPredictionHistory.mockResolvedValue(history);

      const result = await controller.getPredictionHistory('prediction-123', mockUser);

      expect(service.getPredictionHistory).toHaveBeenCalledWith(
        'prediction-123',
        mockUser.organizationId
      );
      expect(result).toEqual(history);
    });
  });

  describe('exportPredictions', () => {
    it('should export predictions in requested format', async () => {
      const exportDto = {
        format: 'excel',
        includeCharts: true,
        includeMethodology: true,
      };

      const exportResult = {
        url: 'https://exports.example.com/predictions-123.xlsx',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      service.exportPredictions.mockResolvedValue(exportResult);

      const result = await controller.exportPredictions('prediction-123', exportDto, mockUser);

      expect(service.exportPredictions).toHaveBeenCalledWith(
        'prediction-123',
        exportDto,
        mockUser.organizationId
      );
      expect(result).toEqual(exportResult);
    });
  });

  describe('remove', () => {
    it('should soft delete prediction', async () => {
      service.remove.mockResolvedValue(mockPrediction);

      const result = await controller.remove('prediction-123', mockUser);

      expect(service.remove).toHaveBeenCalledWith('prediction-123', mockUser.organizationId);
      expect(result).toEqual(mockPrediction);
    });
  });

  describe('Role-based access control', () => {
    it('should allow analysts to create predictions', async () => {
      const analystUser = { ...mockUser, roles: ['analyst'] };
      service.create.mockResolvedValue(mockPrediction);

      await controller.create({} as CreatePredictionDto, analystUser);

      expect(service.create).toHaveBeenCalled();
    });
  });

  describe('Model Explainability', () => {
    it('should provide prediction explanations', async () => {
      const predictionDto = {
        clientId: 'client-123',
        explainabilityLevel: 'detailed',
      };

      service.predictCompliance.mockResolvedValue({
        prediction: { score: 85.0 },
        explanation: {
          topFactors: [
            { factor: 'Historical trend', contribution: 0.35 },
            { factor: 'Control effectiveness', contribution: 0.25 },
            { factor: 'Recent evidence quality', contribution: 0.2 },
          ],
          featureImportance: {
            control_test_pass_rate: 0.28,
            evidence_timeliness: 0.22,
            audit_finding_count: 0.18,
          },
          confidenceFactors: [
            'High data quality',
            'Stable historical patterns',
            'Recent model retraining',
          ],
        },
      });

      const result = await controller.predictCompliance(predictionDto, mockUser);

      expect(result.explanation).toBeDefined();
      expect(result.explanation.topFactors).toHaveLength(3);
    });
  });

  describe('Real-time Predictions', () => {
    it('should support real-time prediction updates', async () => {
      const realtimeDto = {
        clientId: 'client-123',
        streamUpdates: true,
        updateFrequency: 'hourly',
      };

      service.predictCompliance.mockResolvedValue({
        predictions: { current: 82.5 },
        streaming: {
          enabled: true,
          websocketUrl: 'wss://predictions.example.com/stream/client-123',
          updateFrequency: 'hourly',
        },
      });

      const result = await controller.predictCompliance(realtimeDto, mockUser);

      expect(result.streaming).toBeDefined();
      expect(result.streaming.enabled).toBe(true);
    });
  });
});
