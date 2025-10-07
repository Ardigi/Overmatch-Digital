import { Injectable } from '@nestjs/common';
import { 
  LossEventFrequencyCalculator, 
  LEFScenario,
  LossEventFrequencyResult 
} from '../calculators/loss-event-frequency.calculator';
import { 
  LossMagnitudeCalculator,
  LossMagnitudeScenario,
  LossMagnitudeResult
} from '../calculators/loss-magnitude.calculator';
import { MonteCarloSimulator } from '../../financial/simulators/monte-carlo.simulator';
import { ValidationError } from '../../../shared/errors/validation.error';

/**
 * Risk Simulator
 * Combines Loss Event Frequency and Loss Magnitude to calculate overall risk
 * Implements FAIR methodology with Monte Carlo simulation for risk quantification
 */
@Injectable()
export class RiskSimulator {
  private readonly DEFAULT_SIMULATION_ITERATIONS = 10000;
  private readonly DEFAULT_TIME_HORIZON_YEARS = 1;

  constructor(
    private readonly lefCalculator: LossEventFrequencyCalculator,
    private readonly lmCalculator: LossMagnitudeCalculator,
    private readonly monteCarloSimulator: MonteCarloSimulator,
  ) {}

  /**
   * Run comprehensive risk simulation
   * @param scenario Combined risk scenario
   * @param options Simulation options
   * @returns Detailed risk assessment with distributions
   */
  async simulate(
    scenario: RiskScenario,
    options?: RiskSimulationOptions
  ): Promise<RiskSimulationResult> {
    // Validate inputs
    this.validateScenario(scenario);

    const iterations = options?.iterations || this.DEFAULT_SIMULATION_ITERATIONS;
    const timeHorizon = options?.timeHorizon || this.DEFAULT_TIME_HORIZON_YEARS;

    // Calculate base LEF and LM
    const lefResult = await this.calculateLEF(scenario);
    const lmResult = await this.calculateLM(scenario);

    // Run Monte Carlo simulation for annual loss exposure
    const aleSimulation = await this.simulateAnnualLossExposure(
      lefResult,
      lmResult,
      iterations,
      options
    );

    // Calculate risk metrics
    const riskMetrics = this.calculateRiskMetrics(
      aleSimulation,
      scenario,
      lefResult,
      lmResult
    );

    // Generate risk rating
    const riskRating = this.generateRiskRating(riskMetrics);

    // Calculate multi-year projections if requested
    const projections = timeHorizon > 1
      ? await this.calculateMultiYearProjections(
          aleSimulation,
          timeHorizon,
          scenario.growthRate
        )
      : undefined;

    return {
      scenario: {
        name: scenario.name,
        description: scenario.description,
        timestamp: new Date(),
      },
      lossEventFrequency: lefResult,
      lossMagnitude: lmResult,
      annualLossExposure: aleSimulation,
      riskMetrics,
      riskRating,
      projections,
      recommendations: this.generateRecommendations(riskMetrics, scenario),
      confidence: this.calculateOverallConfidence(lefResult, lmResult, aleSimulation),
    };
  }

  /**
   * Compare multiple risk scenarios
   */
  async compareScenarios(
    scenarios: RiskScenario[],
    options?: RiskSimulationOptions
  ): Promise<ScenarioComparison> {
    if (scenarios.length < 2) {
      throw new ValidationError('At least 2 scenarios required for comparison');
    }

    const results = await Promise.all(
      scenarios.map(scenario => this.simulate(scenario, options))
    );

    // Sort by expected annual loss
    results.sort((a, b) => 
      b.riskMetrics.expectedAnnualLoss - a.riskMetrics.expectedAnnualLoss
    );

    // Calculate relative metrics
    const baseline = results[0];
    const comparisons = results.map(result => ({
      scenario: result.scenario.name,
      absoluteRisk: result.riskMetrics,
      relativeToBaseline: {
        expectedLossRatio: result.riskMetrics.expectedAnnualLoss / 
                          baseline.riskMetrics.expectedAnnualLoss,
        riskReduction: 1 - (result.riskMetrics.expectedAnnualLoss / 
                           baseline.riskMetrics.expectedAnnualLoss),
        costBenefitRatio: this.calculateCostBenefitRatio(result, baseline),
      },
    }));

    return {
      scenarios: comparisons,
      optimalScenario: this.identifyOptimalScenario(results),
      insights: this.generateComparativeInsights(results),
    };
  }

  /**
   * Calculate Loss Event Frequency
   */
  private async calculateLEF(scenario: RiskScenario): Promise<LossEventFrequencyResult> {
    const lefScenario: LEFScenario = {
      threatActor: scenario.threatActor,
      assetType: scenario.assetType,
      assetValue: scenario.assetValue,
      industry: scenario.industry,
      controls: scenario.controls || [],
      dataClassification: scenario.dataClassification,
      publicProfile: scenario.publicProfile,
      dataQuality: scenario.dataQuality,
    };

    return await this.lefCalculator.calculate(lefScenario);
  }

  /**
   * Calculate Loss Magnitude
   */
  private async calculateLM(scenario: RiskScenario): Promise<LossMagnitudeResult> {
    const lmScenario: LossMagnitudeScenario = {
      assetType: scenario.assetType,
      assetReplacementValue: scenario.assetValue,
      assetComplexity: scenario.assetComplexity,
      affectedUsers: scenario.affectedUsers,
      estimatedDowntime: scenario.estimatedDowntime,
      estimatedResponseHours: scenario.estimatedResponseHours,
      dataLossGB: scenario.dataLossGB,
      recordsExposed: scenario.recordsExposed,
      annualRevenue: scenario.annualRevenue,
      marketCapitalization: scenario.marketCapitalization,
      intellectualPropertyValue: scenario.intellectualPropertyValue,
      timeAdvantageYears: scenario.timeAdvantageYears,
      threatType: scenario.threatActor,
      systemCriticality: scenario.systemCriticality,
      dataClassification: scenario.dataClassification,
      publicProfile: scenario.publicProfile,
      regulatoryEnvironment: scenario.regulatoryEnvironment,
      requiresForensics: scenario.requiresForensics,
      requiresLegalReview: scenario.requiresLegalReview,
      requiresPRResponse: scenario.requiresPRResponse,
      dataQuality: scenario.dataQuality,
      historicalLossData: scenario.historicalLossData,
      expertEstimatesCount: scenario.expertEstimatesCount,
    };

    return await this.lmCalculator.calculate(lmScenario);
  }

  /**
   * Simulate Annual Loss Exposure using Monte Carlo
   */
  private async simulateAnnualLossExposure(
    lef: LossEventFrequencyResult,
    lm: LossMagnitudeResult,
    iterations: number,
    options?: RiskSimulationOptions
  ): Promise<AnnualLossExposure> {
    // Generator function for single simulation iteration
    const aleGenerator = () => {
      // Sample frequency from PERT distribution
      const frequency = this.samplePERT(
        lef.frequency.min,
        lef.frequency.mostLikely,
        lef.frequency.max
      );

      // Sample magnitude from PERT distribution
      const magnitude = this.samplePERT(
        lm.totalLoss.minimum,
        lm.totalLoss.mostLikely,
        lm.totalLoss.maximum
      );

      // Calculate annual loss (frequency × magnitude)
      return frequency * magnitude;
    };

    // Run Monte Carlo simulation
    const simulation = await this.monteCarloSimulator.runSimulation(
      aleGenerator,
      iterations,
      {
        onProgress: options?.onProgress,
        includeRawData: options?.includeRawResults,
      }
    );

    // Calculate exceedance probabilities
    const exceedanceCurve = this.calculateExceedanceCurve(
      simulation.results || [],
      simulation.percentiles
    );

    return {
      distribution: simulation.statistics,
      percentiles: simulation.percentiles,
      confidenceIntervals: simulation.confidenceIntervals,
      exceedanceCurve,
      simulationIterations: iterations,
      rawResults: simulation.results,
    };
  }

  /**
   * Calculate comprehensive risk metrics
   */
  private calculateRiskMetrics(
    ale: AnnualLossExposure,
    scenario: RiskScenario,
    lef: LossEventFrequencyResult,
    lm: LossMagnitudeResult
  ): RiskMetrics {
    const metrics: RiskMetrics = {
      // Expected values
      expectedAnnualLoss: ale.distribution.mean,
      expectedFrequency: lef.annualOccurrences,
      expectedMagnitude: lm.totalLoss.expected,

      // Risk measures
      valueAtRisk95: ale.percentiles.p95,
      conditionalValueAtRisk95: this.calculateCVaR(ale, 0.95),
      maxProbableLoss: ale.percentiles.p99,
      
      // Probability metrics
      probabilityOfLoss: this.calculateProbabilityOfLoss(ale),
      probabilityExceedingThreshold: scenario.lossThreshold
        ? this.calculateExceedanceProbability(ale, scenario.lossThreshold)
        : undefined,

      // Financial metrics
      riskCapitalRequirement: this.calculateRiskCapital(ale, scenario),
      returnOnRiskCapital: this.calculateRORiskCapital(scenario, ale),
      
      // Control effectiveness
      controlEffectiveness: this.calculateControlEffectiveness(scenario, lef),
      residualRisk: ale.distribution.mean,
      inherentRisk: this.calculateInherentRisk(scenario),
      
      // Uncertainty
      coefficientOfVariation: ale.distribution.coefficientOfVariation,
      confidenceInterval95: ale.confidenceIntervals.find(ci => ci.level === 95),
    };

    return metrics;
  }

  /**
   * Generate risk rating based on metrics
   */
  private generateRiskRating(metrics: RiskMetrics): RiskRating {
    // Calculate risk score (0-100)
    let score = 0;
    let factors: RatingFactor[] = [];

    // Expected loss factor (40% weight)
    const lossScore = Math.min(100, (metrics.expectedAnnualLoss / 1000000) * 10);
    score += lossScore * 0.4;
    factors.push({
      name: 'Expected Annual Loss',
      score: lossScore,
      weight: 0.4,
      impact: lossScore > 50 ? 'HIGH' : lossScore > 20 ? 'MEDIUM' : 'LOW',
    });

    // Frequency factor (20% weight)
    const freqScore = Math.min(100, metrics.expectedFrequency * 10);
    score += freqScore * 0.2;
    factors.push({
      name: 'Event Frequency',
      score: freqScore,
      weight: 0.2,
      impact: freqScore > 50 ? 'HIGH' : freqScore > 20 ? 'MEDIUM' : 'LOW',
    });

    // Magnitude factor (20% weight)
    const magScore = Math.min(100, (metrics.expectedMagnitude / 5000000) * 100);
    score += magScore * 0.2;
    factors.push({
      name: 'Loss Magnitude',
      score: magScore,
      weight: 0.2,
      impact: magScore > 50 ? 'HIGH' : magScore > 20 ? 'MEDIUM' : 'LOW',
    });

    // Control effectiveness factor (20% weight)
    const controlScore = (1 - metrics.controlEffectiveness) * 100;
    score += controlScore * 0.2;
    factors.push({
      name: 'Control Weakness',
      score: controlScore,
      weight: 0.2,
      impact: controlScore > 50 ? 'HIGH' : controlScore > 20 ? 'MEDIUM' : 'LOW',
    });

    // Determine rating level
    const level: RiskLevel = 
      score >= 75 ? 'CRITICAL' :
      score >= 50 ? 'HIGH' :
      score >= 25 ? 'MEDIUM' :
      'LOW';

    return {
      level,
      score,
      factors,
      summary: this.generateRatingSummary(level, score),
      actionRequired: level === 'CRITICAL' || level === 'HIGH',
    };
  }

  /**
   * Calculate multi-year projections
   */
  private async calculateMultiYearProjections(
    baseALE: AnnualLossExposure,
    years: number,
    growthRate?: number
  ): Promise<MultiYearProjection[]> {
    const projections: MultiYearProjection[] = [];
    const rate = growthRate || 0;

    for (let year = 1; year <= years; year++) {
      const multiplier = Math.pow(1 + rate, year - 1);
      
      projections.push({
        year,
        expectedLoss: baseALE.distribution.mean * multiplier,
        worstCase: baseALE.percentiles.p95 * multiplier,
        bestCase: baseALE.percentiles.p5 * multiplier,
        cumulativeExpectedLoss: projections.reduce(
          (sum, p) => sum + p.expectedLoss,
          baseALE.distribution.mean * multiplier
        ),
      });
    }

    return projections;
  }

  /**
   * Generate recommendations based on risk assessment
   */
  private generateRecommendations(
    metrics: RiskMetrics,
    scenario: RiskScenario
  ): RiskRecommendation[] {
    const recommendations: RiskRecommendation[] = [];

    // High expected loss
    if (metrics.expectedAnnualLoss > 1000000) {
      recommendations.push({
        priority: 'HIGH',
        category: 'RISK_REDUCTION',
        title: 'Implement Additional Controls',
        description: 'Expected annual loss exceeds $1M. Consider implementing additional preventive controls.',
        estimatedCostSavings: metrics.expectedAnnualLoss * 0.3,
        implementationEffort: 'HIGH',
      });
    }

    // Low control effectiveness
    if (metrics.controlEffectiveness < 0.5) {
      recommendations.push({
        priority: 'HIGH',
        category: 'CONTROL_IMPROVEMENT',
        title: 'Strengthen Existing Controls',
        description: 'Current controls are less than 50% effective. Focus on improving control maturity.',
        estimatedCostSavings: metrics.expectedAnnualLoss * 0.2,
        implementationEffort: 'MEDIUM',
      });
    }

    // High frequency
    if (metrics.expectedFrequency > 10) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'PREVENTION',
        title: 'Reduce Attack Surface',
        description: 'High frequency of events indicates large attack surface. Implement preventive measures.',
        estimatedCostSavings: metrics.expectedAnnualLoss * 0.15,
        implementationEffort: 'MEDIUM',
      });
    }

    // Risk transfer opportunity
    if (metrics.valueAtRisk95 > 5000000) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'RISK_TRANSFER',
        title: 'Consider Cyber Insurance',
        description: 'High tail risk suggests opportunity for risk transfer through insurance.',
        estimatedCostSavings: metrics.valueAtRisk95 * 0.8,
        implementationEffort: 'LOW',
      });
    }

    // Sort by priority and estimated savings
    recommendations.sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.estimatedCostSavings - a.estimatedCostSavings;
    });

    return recommendations;
  }

  // Helper methods

  private samplePERT(min: number, mostLikely: number, max: number, lambda: number = 4): number {
    const mean = (min + lambda * mostLikely + max) / (lambda + 2);
    const alpha = ((mean - min) * (2 * mostLikely - min - max)) / 
                  ((mostLikely - mean) * (max - min));
    const beta = (alpha * (max - mean)) / (mean - min);
    
    // Sample from Beta distribution
    const betaSample = this.sampleBeta(Math.max(0.1, alpha), Math.max(0.1, beta));
    
    return min + betaSample * (max - min);
  }

  private sampleBeta(alpha: number, beta: number): number {
    // Simplified Beta sampling
    const x = Math.pow(Math.random(), 1 / alpha);
    const y = Math.pow(Math.random(), 1 / beta);
    return x / (x + y);
  }

  private calculateExceedanceCurve(
    results: number[],
    percentiles: any
  ): ExceedancePoint[] {
    const points: ExceedancePoint[] = [];
    const sortedResults = [...results].sort((a, b) => a - b);
    
    // Calculate exceedance probabilities for key thresholds
    const thresholds = [
      100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000
    ];
    
    for (const threshold of thresholds) {
      const exceedCount = sortedResults.filter(r => r > threshold).length;
      const probability = exceedCount / sortedResults.length;
      
      if (probability > 0) {
        points.push({ threshold, probability });
      }
    }
    
    return points;
  }

  private calculateCVaR(ale: AnnualLossExposure, confidence: number): number {
    if (!ale.rawResults || ale.rawResults.length === 0) {
      return ale.percentiles.p95 * 1.2; // Estimate if no raw data
    }
    
    const sortedResults = [...ale.rawResults].sort((a, b) => a - b);
    const cutoffIndex = Math.floor(sortedResults.length * confidence);
    const tailLosses = sortedResults.slice(cutoffIndex);
    
    if (tailLosses.length === 0) return ale.percentiles.p95;
    
    return tailLosses.reduce((sum, loss) => sum + loss, 0) / tailLosses.length;
  }

  private calculateProbabilityOfLoss(ale: AnnualLossExposure): number {
    if (!ale.rawResults) return 0.99; // Conservative estimate
    
    const lossCount = ale.rawResults.filter(r => r > 0).length;
    return lossCount / ale.rawResults.length;
  }

  private calculateExceedanceProbability(
    ale: AnnualLossExposure,
    threshold: number
  ): number {
    if (!ale.rawResults) {
      // Estimate using normal approximation
      const z = (threshold - ale.distribution.mean) / ale.distribution.standardDeviation;
      return 1 - this.normalCDF(z);
    }
    
    const exceedCount = ale.rawResults.filter(r => r > threshold).length;
    return exceedCount / ale.rawResults.length;
  }

  private normalCDF(z: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);
    
    const t = 1 / (1 + p * z);
    const t2 = t * t;
    const t3 = t2 * t;
    const t4 = t3 * t;
    const t5 = t4 * t;
    
    const y = 1 - ((((a5 * t5 + a4 * t4) + a3 * t3) + a2 * t2) + a1 * t) * 
              Math.exp(-z * z);
    
    return 0.5 * (1 + sign * y);
  }

  private calculateRiskCapital(ale: AnnualLossExposure, scenario: RiskScenario): number {
    // Risk capital = VaR95 - Expected Loss + Buffer
    const buffer = ale.distribution.standardDeviation * 0.5;
    return Math.max(0, ale.percentiles.p95 - ale.distribution.mean + buffer);
  }

  private calculateRORiskCapital(scenario: RiskScenario, ale: AnnualLossExposure): number {
    const riskCapital = this.calculateRiskCapital(ale, scenario);
    if (riskCapital === 0) return 0;
    
    // Assuming control investment saves 30% of expected loss
    const expectedSavings = ale.distribution.mean * 0.3;
    return expectedSavings / riskCapital;
  }

  private calculateControlEffectiveness(
    scenario: RiskScenario,
    lef: LossEventFrequencyResult
  ): number {
    // Control effectiveness based on vulnerability reduction
    return 1 - lef.vulnerability.mostLikely;
  }

  private calculateInherentRisk(scenario: RiskScenario): number {
    // Estimate risk without controls
    const baseFrequency = 50; // Base frequency for uncontrolled system
    const baseMagnitude = scenario.assetValue * 0.5; // Assume 50% loss
    return baseFrequency * baseMagnitude;
  }

  private calculateCostBenefitRatio(
    result: RiskSimulationResult,
    baseline: RiskSimulationResult
  ): number {
    const riskReduction = baseline.riskMetrics.expectedAnnualLoss - 
                         result.riskMetrics.expectedAnnualLoss;
    const implementationCost = 100000; // Estimated cost, should be in scenario
    return riskReduction / implementationCost;
  }

  private identifyOptimalScenario(results: RiskSimulationResult[]): string {
    // Find scenario with best risk-adjusted return
    let bestScenario = results[0];
    let bestScore = -Infinity;
    
    for (const result of results) {
      const score = -result.riskMetrics.expectedAnnualLoss + 
                    result.riskMetrics.returnOnRiskCapital * 100000;
      if (score > bestScore) {
        bestScore = score;
        bestScenario = result;
      }
    }
    
    return bestScenario.scenario.name;
  }

  private generateComparativeInsights(results: RiskSimulationResult[]): string[] {
    const insights: string[] = [];
    
    // Compare expected losses
    const losses = results.map(r => r.riskMetrics.expectedAnnualLoss);
    const maxLoss = Math.max(...losses);
    const minLoss = Math.min(...losses);
    
    if (maxLoss / minLoss > 5) {
      insights.push('Significant variation in expected losses across scenarios (>5x difference)');
    }
    
    // Check control effectiveness
    const avgEffectiveness = results.reduce(
      (sum, r) => sum + r.riskMetrics.controlEffectiveness,
      0
    ) / results.length;
    
    if (avgEffectiveness < 0.5) {
      insights.push('Overall control effectiveness is low across all scenarios (<50%)');
    }
    
    return insights;
  }

  private generateRatingSummary(level: RiskLevel, score: number): string {
    const summaries = {
      CRITICAL: `Critical risk level (score: ${score.toFixed(1)}). Immediate action required.`,
      HIGH: `High risk level (score: ${score.toFixed(1)}). Priority attention needed.`,
      MEDIUM: `Medium risk level (score: ${score.toFixed(1)}). Monitor and improve controls.`,
      LOW: `Low risk level (score: ${score.toFixed(1)}). Maintain current controls.`,
    };
    
    return summaries[level];
  }

  private calculateOverallConfidence(
    lef: LossEventFrequencyResult,
    lm: LossMagnitudeResult,
    ale: AnnualLossExposure
  ): number {
    // Weight confidence from different components
    return (
      lef.confidence * 0.3 +
      lm.confidence * 0.3 +
      (ale.simulationIterations >= 10000 ? 0.9 : 0.7) * 0.4
    );
  }

  private validateScenario(scenario: RiskScenario): void {
    if (!scenario) {
      throw new ValidationError('Scenario is required');
    }

    if (!scenario.name) {
      throw ValidationError.required('name');
    }

    if (!scenario.threatActor) {
      throw ValidationError.required('threatActor');
    }

    if (!scenario.assetType) {
      throw ValidationError.required('assetType');
    }

    if (scenario.assetValue <= 0) {
      throw ValidationError.forField('assetValue', scenario.assetValue, 'Must be positive');
    }

    if (!scenario.industry) {
      throw ValidationError.required('industry');
    }
  }
}

// Type definitions

export interface RiskScenario extends LEFScenario, LossMagnitudeScenario {
  name: string;
  description?: string;
  lossThreshold?: number;
  growthRate?: number;
}

export interface RiskSimulationOptions {
  iterations?: number;
  timeHorizon?: number;
  includeRawResults?: boolean;
  onProgress?: (progress: any) => void;
}

export interface RiskSimulationResult {
  scenario: {
    name: string;
    description?: string;
    timestamp: Date;
  };
  lossEventFrequency: LossEventFrequencyResult;
  lossMagnitude: LossMagnitudeResult;
  annualLossExposure: AnnualLossExposure;
  riskMetrics: RiskMetrics;
  riskRating: RiskRating;
  projections?: MultiYearProjection[];
  recommendations: RiskRecommendation[];
  confidence: number;
}

export interface AnnualLossExposure {
  distribution: any;
  percentiles: any;
  confidenceIntervals: any[];
  exceedanceCurve: ExceedancePoint[];
  simulationIterations: number;
  rawResults?: number[];
}

export interface RiskMetrics {
  expectedAnnualLoss: number;
  expectedFrequency: number;
  expectedMagnitude: number;
  valueAtRisk95: number;
  conditionalValueAtRisk95: number;
  maxProbableLoss: number;
  probabilityOfLoss: number;
  probabilityExceedingThreshold?: number;
  riskCapitalRequirement: number;
  returnOnRiskCapital: number;
  controlEffectiveness: number;
  residualRisk: number;
  inherentRisk: number;
  coefficientOfVariation: number;
  confidenceInterval95?: any;
}

export interface RiskRating {
  level: RiskLevel;
  score: number;
  factors: RatingFactor[];
  summary: string;
  actionRequired: boolean;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RatingFactor {
  name: string;
  score: number;
  weight: number;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface MultiYearProjection {
  year: number;
  expectedLoss: number;
  worstCase: number;
  bestCase: number;
  cumulativeExpectedLoss: number;
}

export interface RiskRecommendation {
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  category: string;
  title: string;
  description: string;
  estimatedCostSavings: number;
  implementationEffort: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ExceedancePoint {
  threshold: number;
  probability: number;
}

export interface ScenarioComparison {
  scenarios: any[];
  optimalScenario: string;
  insights: string[];
}