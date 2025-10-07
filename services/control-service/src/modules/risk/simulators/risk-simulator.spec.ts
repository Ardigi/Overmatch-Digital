import { RiskSimulator, RiskScenario } from './risk-simulator';
import { LossEventFrequencyCalculator } from '../calculators/loss-event-frequency.calculator';
import { LossMagnitudeCalculator } from '../calculators/loss-magnitude.calculator';
import { MonteCarloSimulator } from '../../financial/simulators/monte-carlo.simulator';
import { ValidationError } from '../../../shared/errors/validation.error';

describe('RiskSimulator', () => {
  let simulator: RiskSimulator;
  let mockLEFCalculator: jest.Mocked<LossEventFrequencyCalculator>;
  let mockLMCalculator: jest.Mocked<LossMagnitudeCalculator>;
  let mockMonteCarloSimulator: jest.Mocked<MonteCarloSimulator>;

  // Mock data used across tests
  const mockLEFResult = {
    threatEventFrequency: {
      min: 1,
      mostLikely: 5,
      max: 10,
      confidence: 0.8,
    },
    vulnerability: {
      min: 0.2,
      mostLikely: 0.3,
      max: 0.4,
      confidence: 0.75,
      threatCapability: { technical: 0.8, resources: 0.8, persistence: 0.8, overall: 0.8 },
      controlStrength: { preventive: 0.5, detective: 0.3, corrective: 0.2, overall: 0.4 },
    },
    frequency: {
      min: 0.2,
      mostLikely: 1.5,
      max: 4,
      confidence: 0.75,
    },
    annualOccurrences: 1.5,
    confidence: 0.75,
  };

  const mockLMResult = {
    primaryLoss: {
      productivity: { minimum: 10000, mostLikely: 50000, maximum: 100000, confidence: 0.7 },
      replacement: { minimum: 20000, mostLikely: 100000, maximum: 200000, confidence: 0.8 },
      response: { minimum: 30000, mostLikely: 80000, maximum: 150000, confidence: 0.6 },
      total: { minimum: 60000, mostLikely: 230000, maximum: 450000, confidence: 0.7 },
      components: [],
    },
    secondaryLoss: {
      regulatory: { minimum: 0, mostLikely: 500000, maximum: 2000000, confidence: 0.6 },
      reputation: { minimum: 100000, mostLikely: 300000, maximum: 800000, confidence: 0.5 },
      competitive: { minimum: 0, mostLikely: 0, maximum: 0, confidence: 1 },
      total: { minimum: 100000, mostLikely: 800000, maximum: 2800000, confidence: 0.55 },
      components: [],
    },
    totalLoss: {
      minimum: 160000,
      mostLikely: 1030000,
      maximum: 3250000,
      expected: 1100000,
      standardDeviation: 515000,
      confidence: 0.6,
      valueAtRisk95: 1947000,
      conditionalValueAtRisk95: 2162000,
    },
    confidence: 0.65,
    methodology: 'FAIR',
    timestamp: new Date(),
  };

  const mockSimulationResult = {
    iterations: 10000,
    statistics: {
      count: 10000,
      mean: 1650000,
      median: 1545000,
      mode: 1500000,
      variance: 265225000000,
      standardDeviation: 515000,
      skewness: 0.8,
      kurtosis: 0.3,
      min: 32000,
      max: 13000000,
      range: 12968000,
      coefficientOfVariation: 0.31,
    },
    percentiles: {
      p1: 200000,
      p5: 450000,
      p10: 620000,
      p25: 1050000,
      p50: 1545000,
      p75: 2100000,
      p90: 2600000,
      p95: 2950000,
      p99: 4500000,
    },
    confidenceIntervals: [
      { level: 90, lower: 1641000, upper: 1659000 },
      { level: 95, lower: 1640000, upper: 1660000 },
      { level: 99, lower: 1637000, upper: 1663000 },
    ],
    executionTime: 1500,
  };

  beforeEach(() => {
    // Create mocks
    mockLEFCalculator = {
      calculate: jest.fn(),
    } as any;

    mockLMCalculator = {
      calculate: jest.fn(),
    } as any;

    mockMonteCarloSimulator = {
      runSimulation: jest.fn(),
      generateSamples: jest.fn(),
      cancelSimulation: jest.fn(),
      runMultivariateSimulation: jest.fn(),
    } as any;

    simulator = new RiskSimulator(
      mockLEFCalculator,
      mockLMCalculator,
      mockMonteCarloSimulator
    );
  });

  describe('simulate', () => {
    const validScenario: RiskScenario = {
      name: 'Data Breach Scenario',
      description: 'Customer database breach',
      threatActor: 'ORGANIZED_CRIME',
      assetType: 'CUSTOMER_DATABASE',
      assetValue: 1000000,
      industry: 'FINANCIAL',
      controls: [
        {
          type: 'PREVENTIVE',
          name: 'Firewall',
          effectiveness: 0.8,
          maturityLevel: 0.7,
        },
      ],
      systemCriticality: 'HIGH',
      dataClassification: 'CONFIDENTIAL',
      publicProfile: 'MEDIUM',
      affectedUsers: 10000,
      estimatedDowntime: 24,
      recordsExposed: 50000,
      annualRevenue: 10000000,
      dataQuality: 0.8,
    };

    beforeEach(() => {
      mockLEFCalculator.calculate.mockResolvedValue(mockLEFResult);
      mockLMCalculator.calculate.mockResolvedValue(mockLMResult);
      mockMonteCarloSimulator.runSimulation.mockResolvedValue(mockSimulationResult);
    });

    it('should simulate risk for valid scenario', async () => {
      const result = await simulator.simulate(validScenario);

      expect(result).toBeDefined();
      expect(result.scenario.name).toBe('Data Breach Scenario');
      expect(result.lossEventFrequency).toBeDefined();
      expect(result.lossMagnitude).toBeDefined();
      expect(result.annualLossExposure).toBeDefined();
      expect(result.riskMetrics).toBeDefined();
      expect(result.riskRating).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should calculate comprehensive risk metrics', async () => {
      const result = await simulator.simulate(validScenario);

      const metrics = result.riskMetrics;
      expect(metrics.expectedAnnualLoss).toBeDefined();
      expect(metrics.expectedFrequency).toBeDefined();
      expect(metrics.expectedMagnitude).toBeDefined();
      expect(metrics.valueAtRisk95).toBeDefined();
      expect(metrics.conditionalValueAtRisk95).toBeDefined();
      expect(metrics.maxProbableLoss).toBeDefined();
      expect(metrics.probabilityOfLoss).toBeDefined();
      expect(metrics.riskCapitalRequirement).toBeDefined();
      expect(metrics.returnOnRiskCapital).toBeDefined();
      expect(metrics.controlEffectiveness).toBeDefined();
      expect(metrics.residualRisk).toBeDefined();
      expect(metrics.inherentRisk).toBeDefined();
      expect(metrics.coefficientOfVariation).toBeDefined();
    });

    it('should generate risk rating with factors', async () => {
      const result = await simulator.simulate(validScenario);

      const rating = result.riskRating;
      expect(rating.level).toMatch(/^(LOW|MEDIUM|HIGH|CRITICAL)$/);
      expect(rating.score).toBeGreaterThanOrEqual(0);
      expect(rating.score).toBeLessThanOrEqual(100);
      expect(rating.factors).toHaveLength(4);
      expect(rating.summary).toBeDefined();
      expect(typeof rating.actionRequired).toBe('boolean');

      // Verify each factor
      for (const factor of rating.factors) {
        expect(factor.name).toBeDefined();
        expect(factor.score).toBeGreaterThanOrEqual(0);
        expect(factor.weight).toBeGreaterThan(0);
        expect(factor.impact).toMatch(/^(LOW|MEDIUM|HIGH)$/);
      }
    });

    it('should generate appropriate recommendations', async () => {
      const result = await simulator.simulate(validScenario);

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);

      for (const rec of result.recommendations) {
        expect(rec.priority).toMatch(/^(LOW|MEDIUM|HIGH)$/);
        expect(rec.category).toBeDefined();
        expect(rec.title).toBeDefined();
        expect(rec.description).toBeDefined();
        expect(rec.estimatedCostSavings).toBeGreaterThanOrEqual(0);
        expect(rec.implementationEffort).toMatch(/^(LOW|MEDIUM|HIGH)$/);
      }
    });

    it('should use custom iterations when provided', async () => {
      await simulator.simulate(validScenario, { iterations: 5000 });

      expect(mockMonteCarloSimulator.runSimulation).toHaveBeenCalledWith(
        expect.any(Function),
        5000,
        expect.any(Object)
      );
    });

    it('should calculate multi-year projections when requested', async () => {
      const result = await simulator.simulate(validScenario, { 
        timeHorizon: 3,
        iterations: 1000 
      });

      expect(result.projections).toBeDefined();
      expect(result.projections).toHaveLength(3);

      for (let i = 0; i < 3; i++) {
        const projection = result.projections[i];
        expect(projection.year).toBe(i + 1);
        expect(projection.expectedLoss).toBeDefined();
        expect(projection.worstCase).toBeDefined();
        expect(projection.bestCase).toBeDefined();
        expect(projection.cumulativeExpectedLoss).toBeDefined();
      }
    });

    it('should calculate exceedance probabilities', async () => {
      mockSimulationResult.results = Array(10000).fill(0).map((_, i) => 
        Math.random() * 5000000
      );
      mockMonteCarloSimulator.runSimulation.mockResolvedValue(mockSimulationResult);

      const result = await simulator.simulate(validScenario, {
        includeRawResults: true
      });

      expect(result.annualLossExposure.exceedanceCurve).toBeDefined();
      expect(result.annualLossExposure.exceedanceCurve.length).toBeGreaterThan(0);

      for (const point of result.annualLossExposure.exceedanceCurve) {
        expect(point.threshold).toBeGreaterThan(0);
        expect(point.probability).toBeGreaterThanOrEqual(0);
        expect(point.probability).toBeLessThanOrEqual(1);
      }
    });

    it('should handle loss threshold probability', async () => {
      const scenarioWithThreshold = {
        ...validScenario,
        lossThreshold: 2000000,
      };

      const result = await simulator.simulate(scenarioWithThreshold);

      expect(result.riskMetrics.probabilityExceedingThreshold).toBeDefined();
      expect(result.riskMetrics.probabilityExceedingThreshold).toBeGreaterThanOrEqual(0);
      expect(result.riskMetrics.probabilityExceedingThreshold).toBeLessThanOrEqual(1);
    });

    it('should handle growth rate in projections', async () => {
      const scenarioWithGrowth = {
        ...validScenario,
        growthRate: 0.1, // 10% annual growth
      };

      const result = await simulator.simulate(scenarioWithGrowth, {
        timeHorizon: 3
      });

      // Each year should show growth
      expect(result.projections[1].expectedLoss).toBeGreaterThan(
        result.projections[0].expectedLoss
      );
      expect(result.projections[2].expectedLoss).toBeGreaterThan(
        result.projections[1].expectedLoss
      );
    });

    it('should handle progress callbacks', async () => {
      const onProgress = jest.fn();

      await simulator.simulate(validScenario, {
        iterations: 1000,
        onProgress
      });

      expect(mockMonteCarloSimulator.runSimulation).toHaveBeenCalledWith(
        expect.any(Function),
        1000,
        expect.objectContaining({ onProgress })
      );
    });
  });

  describe('compareScenarios', () => {
    const scenario1: RiskScenario = {
      name: 'Baseline',
      threatActor: 'ORGANIZED_CRIME',
      assetType: 'DATABASE',
      assetValue: 1000000,
      industry: 'FINANCIAL',
      controls: [],
    };

    const scenario2: RiskScenario = {
      name: 'With Controls',
      threatActor: 'ORGANIZED_CRIME',
      assetType: 'DATABASE',
      assetValue: 1000000,
      industry: 'FINANCIAL',
      controls: [
        { type: 'PREVENTIVE', name: 'MFA', effectiveness: 0.9, maturityLevel: 0.9 },
        { type: 'DETECTIVE', name: 'SIEM', effectiveness: 0.85, maturityLevel: 0.8 },
      ],
    };

    beforeEach(() => {
      // Setup different results for each scenario
      const baselineResult = {
        ...mockLEFResult,
        annualOccurrences: 5,
      };
      
      const controlledResult = {
        ...mockLEFResult,
        annualOccurrences: 1,
        vulnerability: {
          ...mockLEFResult.vulnerability,
          mostLikely: 0.1,
        },
      };

      mockLEFCalculator.calculate
        .mockResolvedValueOnce(baselineResult)
        .mockResolvedValueOnce(controlledResult);

      mockLMCalculator.calculate.mockResolvedValue(mockLMResult);
      
      // Different simulation results
      const highRiskSimulation = {
        ...mockSimulationResult,
        statistics: { ...mockSimulationResult.statistics, mean: 5000000 },
      };
      
      const lowRiskSimulation = {
        ...mockSimulationResult,
        statistics: { ...mockSimulationResult.statistics, mean: 500000 },
      };

      mockMonteCarloSimulator.runSimulation
        .mockResolvedValueOnce(highRiskSimulation)
        .mockResolvedValueOnce(lowRiskSimulation);
    });

    it('should compare multiple scenarios', async () => {
      const comparison = await simulator.compareScenarios([scenario1, scenario2]);

      expect(comparison).toBeDefined();
      expect(comparison.scenarios).toHaveLength(2);
      expect(comparison.optimalScenario).toBeDefined();
      expect(comparison.insights).toBeDefined();
    });

    it('should calculate relative metrics', async () => {
      const comparison = await simulator.compareScenarios([scenario1, scenario2]);

      for (const scenario of comparison.scenarios) {
        expect(scenario.scenario).toBeDefined();
        expect(scenario.absoluteRisk).toBeDefined();
        expect(scenario.relativeToBaseline).toBeDefined();
        expect(scenario.relativeToBaseline.expectedLossRatio).toBeDefined();
        expect(scenario.relativeToBaseline.riskReduction).toBeDefined();
        expect(scenario.relativeToBaseline.costBenefitRatio).toBeDefined();
      }
    });

    it('should identify optimal scenario', async () => {
      const comparison = await simulator.compareScenarios([scenario1, scenario2]);

      expect(comparison.optimalScenario).toBeDefined();
      expect(['Baseline', 'With Controls']).toContain(comparison.optimalScenario);
    });

    it('should generate comparative insights', async () => {
      const comparison = await simulator.compareScenarios([scenario1, scenario2]);

      expect(comparison.insights).toBeDefined();
      expect(Array.isArray(comparison.insights)).toBe(true);
    });

    it('should throw error for insufficient scenarios', async () => {
      await expect(simulator.compareScenarios([scenario1]))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('input validation', () => {
    it('should throw ValidationError for missing scenario', async () => {
      await expect(simulator.simulate(null as any))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for missing name', async () => {
      const invalidScenario = {
        threatActor: 'ORGANIZED_CRIME',
        assetType: 'DATABASE',
        assetValue: 100000,
        industry: 'FINANCIAL',
      } as RiskScenario;

      await expect(simulator.simulate(invalidScenario))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid asset value', async () => {
      const invalidScenario: RiskScenario = {
        name: 'Test',
        threatActor: 'ORGANIZED_CRIME',
        assetType: 'DATABASE',
        assetValue: -1000,
        industry: 'FINANCIAL',
        controls: [],
      };

      await expect(simulator.simulate(invalidScenario))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for missing threat actor', async () => {
      const invalidScenario = {
        name: 'Test',
        assetType: 'DATABASE',
        assetValue: 100000,
        industry: 'FINANCIAL',
      } as RiskScenario;

      await expect(simulator.simulate(invalidScenario))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('edge cases', () => {
    const minimalScenario: RiskScenario = {
      name: 'Minimal',
      threatActor: 'OPPORTUNISTIC',
      assetType: 'SERVER',
      assetValue: 10000,
      industry: 'MANUFACTURING',
      controls: [],
    };

    beforeEach(() => {
      mockLEFCalculator.calculate.mockResolvedValue(mockLEFResult);
      mockLMCalculator.calculate.mockResolvedValue(mockLMResult);
      mockMonteCarloSimulator.runSimulation.mockResolvedValue(mockSimulationResult);
    });

    it('should handle minimal scenario', async () => {
      const result = await simulator.simulate(minimalScenario);

      expect(result).toBeDefined();
      expect(result.riskMetrics).toBeDefined();
      expect(result.riskRating).toBeDefined();
    });

    it('should handle zero controls scenario', async () => {
      const noControlsScenario = {
        ...minimalScenario,
        controls: [],
      };

      const result = await simulator.simulate(noControlsScenario);

      expect(result.riskMetrics.controlEffectiveness).toBeDefined();
      // Control effectiveness is 1 - vulnerability, and mock vulnerability is 0.3
      // So control effectiveness should be 0.7
      expect(result.riskMetrics.controlEffectiveness).toBeCloseTo(0.7, 1);
    });

    it('should handle very high risk scenarios', async () => {
      const highRiskResult = {
        ...mockSimulationResult,
        statistics: { ...mockSimulationResult.statistics, mean: 50000000 },
        percentiles: { ...mockSimulationResult.percentiles, p95: 100000000 },
      };
      mockMonteCarloSimulator.runSimulation.mockResolvedValue(highRiskResult);

      const result = await simulator.simulate(minimalScenario);

      expect(result.riskRating.level).toMatch(/^(HIGH|CRITICAL)$/);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle scenarios without raw results', async () => {
      const noRawResult = {
        ...mockSimulationResult,
        results: undefined,
      };
      mockMonteCarloSimulator.runSimulation.mockResolvedValue(noRawResult);

      const result = await simulator.simulate(minimalScenario);

      // Should still calculate metrics using statistical approximations
      expect(result.riskMetrics.conditionalValueAtRisk95).toBeDefined();
      expect(result.riskMetrics.probabilityOfLoss).toBeDefined();
    });

    it('should handle error in Monte Carlo simulation gracefully', async () => {
      // First two calls succeed, Monte Carlo fails
      mockMonteCarloSimulator.runSimulation.mockRejectedValue(
        new Error('Simulation failed')
      );

      await expect(simulator.simulate(minimalScenario))
        .rejects.toThrow('Simulation failed');
    });
  });

  describe('risk calculations', () => {
    beforeEach(() => {
      mockLEFCalculator.calculate.mockResolvedValue(mockLEFResult);
      mockLMCalculator.calculate.mockResolvedValue(mockLMResult);
      mockMonteCarloSimulator.runSimulation.mockResolvedValue({
        ...mockSimulationResult,
        results: Array(10000).fill(0).map(() => Math.random() * 5000000),
      });
    });

    it('should calculate CVaR correctly', async () => {
      const scenario: RiskScenario = {
        name: 'Test',
        threatActor: 'ORGANIZED_CRIME',
        assetType: 'DATABASE',
        assetValue: 1000000,
        industry: 'FINANCIAL',
        controls: [],
      };

      const result = await simulator.simulate(scenario, {
        includeRawResults: true
      });

      // CVaR should be greater than VaR
      expect(result.riskMetrics.conditionalValueAtRisk95).toBeGreaterThan(
        result.riskMetrics.valueAtRisk95
      );
    });

    it('should rate critical risks appropriately', async () => {
      const criticalResult = {
        ...mockSimulationResult,
        statistics: { ...mockSimulationResult.statistics, mean: 10000000 },
      };
      mockMonteCarloSimulator.runSimulation.mockResolvedValue(criticalResult);

      const scenario: RiskScenario = {
        name: 'Critical Risk',
        threatActor: 'NATION_STATE',
        assetType: 'CRITICAL_INFRASTRUCTURE',
        assetValue: 10000000,
        industry: 'DEFENSE',
        controls: [],
      };

      const result = await simulator.simulate(scenario);

      // With mean loss of 10M, this should be at least HIGH
      expect(['HIGH', 'CRITICAL']).toContain(result.riskRating.level);
      expect(result.riskRating.actionRequired).toBe(true);
      expect(result.recommendations.some(r => r.priority === 'HIGH')).toBe(true);
    });
  });
});