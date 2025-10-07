import { Injectable } from '@nestjs/common';
import { LoggingService } from '@soc-compliance/monitoring';
import * as math from 'mathjs';

/**
 * Enterprise-grade financial analysis service for billion-dollar platform
 * Implements NPV, IRR, Monte Carlo simulations, and advanced ROI calculations
 * Used for control investment decisions and compliance cost-benefit analysis
 */
@Injectable()
export class AdvancedRoiService {
  private readonly MONTE_CARLO_ITERATIONS = 10000;
  private readonly CONFIDENCE_LEVELS = [0.05, 0.25, 0.5, 0.75, 0.95]; // 5%, 25%, 50%, 75%, 95%
  private readonly DEFAULT_DISCOUNT_RATE = 0.08; // 8% annual
  private readonly DEFAULT_RISK_FREE_RATE = 0.03; // 3% Treasury rate

  constructor(
    private readonly loggingService: LoggingService,
  ) {}

  /**
   * Calculate comprehensive ROI with multiple methodologies
   * Provides executive-level financial metrics for control investments
   */
  async calculateComprehensiveROI(
    investment: InvestmentData
  ): Promise<ComprehensiveROIResult> {
    const startTime = Date.now();

    try {
      // 1. Basic ROI calculation
      const basicROI = this.calculateBasicROI(investment);

      // 2. Net Present Value (NPV)
      const npv = this.calculateNPV(
        investment.cashFlows,
        investment.discountRate || this.DEFAULT_DISCOUNT_RATE
      );

      // 3. Internal Rate of Return (IRR)
      const irr = this.calculateIRR(investment.cashFlows);

      // 4. Payback Period
      const paybackPeriod = this.calculatePaybackPeriod(investment.cashFlows);

      // 5. Profitability Index
      const profitabilityIndex = this.calculateProfitabilityIndex(
        investment.cashFlows,
        investment.discountRate || this.DEFAULT_DISCOUNT_RATE
      );

      // 6. Monte Carlo Simulation for risk analysis
      const monteCarloResult = await this.runMonteCarloSimulation(investment);

      // 7. Risk-Adjusted Return (Sharpe Ratio)
      const sharpeRatio = this.calculateSharpeRatio(
        investment.expectedReturn,
        investment.volatility || 0.15,
        this.DEFAULT_RISK_FREE_RATE
      );

      // 8. Economic Value Added (EVA)
      const eva = this.calculateEVA(investment);

      // 9. Total Cost of Ownership (TCO)
      const tco = this.calculateTCO(investment);

      // 10. Return on Security Investment (ROSI)
      const rosi = this.calculateROSI(investment);

      // Generate recommendations based on analysis
      const recommendations = this.generateInvestmentRecommendations({
        npv,
        irr,
        paybackPeriod,
        profitabilityIndex,
        sharpeRatio,
        monteCarloResult,
      });

      const result: ComprehensiveROIResult = {
        basicROI,
        npv,
        irr,
        paybackPeriod,
        profitabilityIndex,
        sharpeRatio,
        eva,
        tco,
        rosi,
        monteCarloResult,
        recommendations,
        confidenceScore: this.calculateConfidenceScore(monteCarloResult),
        calculationTime: Date.now() - startTime,
      };

      await this.loggingService.log('Comprehensive ROI calculated', {
        investmentId: investment.id,
        npv,
        irr,
        confidenceScore: result.confidenceScore,
      });

      return result;

    } catch (error) {
      await this.loggingService.error('ROI calculation failed', error);
      throw error;
    }
  }

  /**
   * Calculate Net Present Value (NPV)
   * Critical for evaluating long-term control investments
   */
  private calculateNPV(cashFlows: number[], discountRate: number): number {
    let npv = 0;
    
    for (let t = 0; t < cashFlows.length; t++) {
      npv += cashFlows[t] / Math.pow(1 + discountRate, t);
    }
    
    return Math.round(npv * 100) / 100;
  }

  /**
   * Calculate Internal Rate of Return (IRR)
   * Uses Newton-Raphson method for precision
   */
  private calculateIRR(cashFlows: number[]): number {
    // Initial guess based on simple approximation
    let rate = 0.1;
    const maxIterations = 100;
    const tolerance = 0.00001;

    for (let i = 0; i < maxIterations; i++) {
      const npv = this.calculateNPV(cashFlows, rate);
      const npvDerivative = this.calculateNPVDerivative(cashFlows, rate);
      
      const newRate = rate - npv / npvDerivative;
      
      if (Math.abs(newRate - rate) < tolerance) {
        return Math.round(newRate * 10000) / 10000; // 4 decimal places
      }
      
      rate = newRate;
    }

    // If no convergence, use binary search as fallback
    return this.calculateIRRBinarySearch(cashFlows);
  }

  /**
   * Calculate NPV derivative for Newton-Raphson method
   */
  private calculateNPVDerivative(cashFlows: number[], rate: number): number {
    let derivative = 0;
    
    for (let t = 1; t < cashFlows.length; t++) {
      derivative -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
    }
    
    return derivative;
  }

  /**
   * Fallback IRR calculation using binary search
   */
  private calculateIRRBinarySearch(cashFlows: number[]): number {
    let low = -0.99;
    let high = 10;
    const tolerance = 0.00001;
    const maxIterations = 100;

    for (let i = 0; i < maxIterations; i++) {
      const mid = (low + high) / 2;
      const npv = this.calculateNPV(cashFlows, mid);
      
      if (Math.abs(npv) < tolerance) {
        return Math.round(mid * 10000) / 10000;
      }
      
      if (npv > 0) {
        low = mid;
      } else {
        high = mid;
      }
    }

    return (low + high) / 2;
  }

  /**
   * Monte Carlo simulation for risk analysis
   * Simulates thousands of scenarios to provide confidence intervals
   */
  private async runMonteCarloSimulation(
    investment: InvestmentData
  ): Promise<MonteCarloResult> {
    const results: number[] = [];
    const npvResults: number[] = [];
    const irrResults: number[] = [];

    for (let i = 0; i < this.MONTE_CARLO_ITERATIONS; i++) {
      // Generate random scenario based on probability distributions
      const scenario = this.generateScenario(investment);
      
      // Calculate metrics for this scenario
      const scenarioNPV = this.calculateNPV(
        scenario.cashFlows,
        scenario.discountRate || 0.1
      );
      const scenarioIRR = this.calculateIRR(scenario.cashFlows);
      const scenarioROI = this.calculateBasicROI(scenario);

      npvResults.push(scenarioNPV);
      irrResults.push(scenarioIRR);
      results.push(scenarioROI);
    }

    // Sort results for percentile calculation
    results.sort((a, b) => a - b);
    npvResults.sort((a, b) => a - b);
    irrResults.sort((a, b) => a - b);

    // Calculate statistics
    const percentiles = this.CONFIDENCE_LEVELS.map(level => ({
      level,
      roi: results[Math.floor(results.length * level)],
      npv: npvResults[Math.floor(npvResults.length * level)],
      irr: irrResults[Math.floor(irrResults.length * level)],
    }));

    // Calculate Value at Risk (VaR)
    const var95 = results[Math.floor(results.length * 0.05)];
    const cvar95 = this.calculateCVaR(results, 0.05);

    return {
      iterations: this.MONTE_CARLO_ITERATIONS,
      percentiles,
      mean: this.calculateMean(results),
      standardDeviation: this.calculateStandardDeviation(results),
      skewness: this.calculateSkewness(results),
      kurtosis: this.calculateKurtosis(results),
      valueAtRisk95: var95,
      conditionalVaR95: cvar95,
      probabilityOfLoss: results.filter(r => r < 0).length / results.length,
      probabilityOfExceedingTarget: this.calculateProbabilityOfExceeding(
        results,
        investment.targetReturn || 0.15
      ),
      confidenceIntervals: this.calculateConfidenceIntervals(results),
    };
  }

  /**
   * Generate random scenario for Monte Carlo simulation
   */
  private generateScenario(investment: InvestmentData): InvestmentData {
    const scenario = { ...investment };
    
    // Apply random variations based on uncertainty parameters
    const cashFlowVariation = this.generateNormalDistribution(
      1,
      investment.cashFlowVolatility || 0.2
    );
    
    scenario.cashFlows = investment.cashFlows.map(cf => 
      cf * cashFlowVariation
    );

    // Vary discount rate
    scenario.discountRate = this.generateNormalDistribution(
      investment.discountRate || this.DEFAULT_DISCOUNT_RATE,
      0.02 // 2% standard deviation
    );

    // Vary costs
    if (investment.implementationCost) {
      scenario.implementationCost = investment.implementationCost * 
        this.generateLogNormalDistribution(1, 0.1);
    }

    return scenario;
  }

  /**
   * Generate normal distribution random number
   * Uses Box-Muller transform
   */
  private generateNormalDistribution(mean: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  /**
   * Generate log-normal distribution random number
   */
  private generateLogNormalDistribution(mean: number, stdDev: number): number {
    const normal = this.generateNormalDistribution(
      Math.log(mean),
      stdDev
    );
    return Math.exp(normal);
  }

  /**
   * Calculate Conditional Value at Risk (CVaR)
   * Expected loss beyond VaR threshold
   */
  private calculateCVaR(results: number[], alpha: number): number {
    const varIndex = Math.floor(results.length * alpha);
    const tailResults = results.slice(0, varIndex);
    return this.calculateMean(tailResults);
  }

  /**
   * Calculate Sharpe Ratio for risk-adjusted returns
   */
  private calculateSharpeRatio(
    expectedReturn: number,
    volatility: number,
    riskFreeRate: number
  ): number {
    return (expectedReturn - riskFreeRate) / volatility;
  }

  /**
   * Calculate Economic Value Added (EVA)
   * Measures true economic profit
   */
  private calculateEVA(investment: InvestmentData): number {
    const nopat = investment.netOperatingProfit || 0; // Net Operating Profit After Tax
    const capitalEmployed = investment.capitalEmployed || investment.implementationCost;
    const wacc = investment.wacc || this.DEFAULT_DISCOUNT_RATE;
    
    return nopat - (capitalEmployed * wacc);
  }

  /**
   * Calculate Total Cost of Ownership (TCO)
   * Includes all direct and indirect costs
   */
  private calculateTCO(investment: InvestmentData): TCOBreakdown {
    const acquisition = investment.implementationCost;
    const operating = investment.annualOperatingCost || 0;
    const maintenance = investment.annualMaintenanceCost || 0;
    const training = investment.trainingCost || 0;
    const downtime = investment.downtimeCost || 0;
    const disposal = investment.disposalCost || 0;
    
    const years = investment.cashFlows.length - 1;
    
    const totalOperating = operating * years;
    const totalMaintenance = maintenance * years;
    
    const total = acquisition + totalOperating + totalMaintenance + 
                  training + downtime + disposal;

    return {
      acquisition,
      operating: totalOperating,
      maintenance: totalMaintenance,
      training,
      downtime,
      disposal,
      total,
      annualized: total / years,
      perUser: investment.userCount ? total / investment.userCount : null,
    };
  }

  /**
   * Calculate Return on Security Investment (ROSI)
   * Specific to security control investments
   */
  private calculateROSI(investment: InvestmentData): ROSIMetrics {
    const ale = investment.annualLossExpectancy || 0; // Before control
    const aleReduced = investment.reducedAnnualLossExpectancy || 0; // After control
    const riskReduction = ale - aleReduced;
    
    const cost = investment.implementationCost + 
                 (investment.annualOperatingCost || 0);
    
    const rosi = ((riskReduction - cost) / cost) * 100;
    
    // Calculate security-specific metrics
    const incidentReduction = investment.expectedIncidentReduction || 0;
    const complianceBenefit = investment.compliancePenaltyAvoided || 0;
    const reputationValue = investment.reputationValueProtected || 0;
    
    return {
      rosi,
      riskReduction,
      incidentReduction,
      complianceBenefit,
      reputationValue,
      totalSecurityValue: riskReduction + complianceBenefit + reputationValue,
      breakEvenTime: cost / (riskReduction / 12), // months
    };
  }

  /**
   * Calculate basic ROI
   */
  private calculateBasicROI(investment: InvestmentData): number {
    const totalReturn = investment.cashFlows.reduce((sum, cf) => sum + cf, 0);
    const totalCost = investment.implementationCost;
    return ((totalReturn - totalCost) / totalCost) * 100;
  }

  /**
   * Calculate payback period
   */
  private calculatePaybackPeriod(cashFlows: number[]): number {
    let cumulative = 0;
    
    for (let i = 0; i < cashFlows.length; i++) {
      cumulative += cashFlows[i];
      if (cumulative >= 0) {
        // Linear interpolation for partial period
        if (i > 0 && cashFlows[i] !== 0) {
          const previousCumulative = cumulative - cashFlows[i];
          const partialPeriod = -previousCumulative / cashFlows[i];
          return i - 1 + partialPeriod;
        }
        return i;
      }
    }
    
    return cashFlows.length; // Never pays back
  }

  /**
   * Calculate profitability index
   */
  private calculateProfitabilityIndex(
    cashFlows: number[],
    discountRate: number
  ): number {
    const initialInvestment = Math.abs(cashFlows[0]);
    const pvOfFutureCashFlows = cashFlows
      .slice(1)
      .reduce((sum, cf, i) => sum + cf / Math.pow(1 + discountRate, i + 1), 0);
    
    return pvOfFutureCashFlows / initialInvestment;
  }

  /**
   * Generate investment recommendations based on metrics
   */
  private generateInvestmentRecommendations(
    metrics: any
  ): InvestmentRecommendation[] {
    const recommendations: InvestmentRecommendation[] = [];

    // NPV recommendation
    if (metrics.npv > 0) {
      recommendations.push({
        type: 'POSITIVE',
        metric: 'NPV',
        message: `Positive NPV of $${metrics.npv.toLocaleString()} indicates value creation`,
        priority: 'HIGH',
      });
    } else {
      recommendations.push({
        type: 'NEGATIVE',
        metric: 'NPV',
        message: `Negative NPV of $${metrics.npv.toLocaleString()} suggests reconsideration`,
        priority: 'CRITICAL',
      });
    }

    // IRR recommendation
    if (metrics.irr > 0.15) {
      recommendations.push({
        type: 'POSITIVE',
        metric: 'IRR',
        message: `IRR of ${(metrics.irr * 100).toFixed(2)}% exceeds typical hurdle rate`,
        priority: 'HIGH',
      });
    }

    // Payback period recommendation
    if (metrics.paybackPeriod < 3) {
      recommendations.push({
        type: 'POSITIVE',
        metric: 'Payback',
        message: `Quick payback period of ${metrics.paybackPeriod.toFixed(1)} years`,
        priority: 'MEDIUM',
      });
    }

    // Risk assessment from Monte Carlo
    if (metrics.monteCarloResult.probabilityOfLoss < 0.1) {
      recommendations.push({
        type: 'POSITIVE',
        metric: 'Risk',
        message: `Low probability of loss (${(metrics.monteCarloResult.probabilityOfLoss * 100).toFixed(1)}%)`,
        priority: 'HIGH',
      });
    }

    // Sharpe ratio recommendation
    if (metrics.sharpeRatio > 1) {
      recommendations.push({
        type: 'POSITIVE',
        metric: 'Risk-Adjusted Return',
        message: `Strong risk-adjusted returns with Sharpe ratio of ${metrics.sharpeRatio.toFixed(2)}`,
        priority: 'MEDIUM',
      });
    }

    return recommendations;
  }

  /**
   * Calculate confidence score based on Monte Carlo results
   */
  private calculateConfidenceScore(monteCarloResult: MonteCarloResult): number {
    // Factors that increase confidence:
    // - Low standard deviation (consistent results)
    // - Low probability of loss
    // - High probability of exceeding target
    // - Normal distribution (low skewness/kurtosis)
    
    const volatilityScore = Math.max(0, 1 - monteCarloResult.standardDeviation / 100);
    const lossScore = 1 - monteCarloResult.probabilityOfLoss;
    const targetScore = monteCarloResult.probabilityOfExceedingTarget;
    const distributionScore = Math.max(0, 1 - Math.abs(monteCarloResult.skewness) / 2);
    
    const confidence = (volatilityScore * 0.3 + 
                       lossScore * 0.3 + 
                       targetScore * 0.2 + 
                       distributionScore * 0.2) * 100;
    
    return Math.round(confidence);
  }

  // Statistical helper methods

  private calculateMean(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = this.calculateMean(squaredDiffs);
    return Math.sqrt(variance);
  }

  private calculateSkewness(values: number[]): number {
    const mean = this.calculateMean(values);
    const stdDev = this.calculateStandardDeviation(values);
    const n = values.length;
    
    const skew = values.reduce((sum, v) => 
      sum + Math.pow((v - mean) / stdDev, 3), 0
    ) / n;
    
    return skew;
  }

  private calculateKurtosis(values: number[]): number {
    const mean = this.calculateMean(values);
    const stdDev = this.calculateStandardDeviation(values);
    const n = values.length;
    
    const kurt = values.reduce((sum, v) => 
      sum + Math.pow((v - mean) / stdDev, 4), 0
    ) / n - 3;
    
    return kurt;
  }

  private calculateProbabilityOfExceeding(
    values: number[],
    target: number
  ): number {
    return values.filter(v => v > target).length / values.length;
  }

  private calculateConfidenceIntervals(values: number[]): ConfidenceInterval[] {
    const mean = this.calculateMean(values);
    const stdDev = this.calculateStandardDeviation(values);
    const n = values.length;
    const stdError = stdDev / Math.sqrt(n);

    return [
      {
        level: 90,
        lower: mean - 1.645 * stdError,
        upper: mean + 1.645 * stdError,
      },
      {
        level: 95,
        lower: mean - 1.96 * stdError,
        upper: mean + 1.96 * stdError,
      },
      {
        level: 99,
        lower: mean - 2.576 * stdError,
        upper: mean + 2.576 * stdError,
      },
    ];
  }
}

// Type definitions

interface InvestmentData {
  id: string;
  cashFlows: number[]; // [initial investment (negative), year1, year2, ...]
  implementationCost: number;
  discountRate?: number;
  expectedReturn: number;
  volatility?: number;
  targetReturn?: number;
  cashFlowVolatility?: number;
  annualOperatingCost?: number;
  annualMaintenanceCost?: number;
  trainingCost?: number;
  downtimeCost?: number;
  disposalCost?: number;
  userCount?: number;
  netOperatingProfit?: number;
  capitalEmployed?: number;
  wacc?: number; // Weighted Average Cost of Capital
  annualLossExpectancy?: number;
  reducedAnnualLossExpectancy?: number;
  expectedIncidentReduction?: number;
  compliancePenaltyAvoided?: number;
  reputationValueProtected?: number;
}

interface ComprehensiveROIResult {
  basicROI: number;
  npv: number;
  irr: number;
  paybackPeriod: number;
  profitabilityIndex: number;
  sharpeRatio: number;
  eva: number;
  tco: TCOBreakdown;
  rosi: ROSIMetrics;
  monteCarloResult: MonteCarloResult;
  recommendations: InvestmentRecommendation[];
  confidenceScore: number;
  calculationTime: number;
}

interface MonteCarloResult {
  iterations: number;
  percentiles: Array<{
    level: number;
    roi: number;
    npv: number;
    irr: number;
  }>;
  mean: number;
  standardDeviation: number;
  skewness: number;
  kurtosis: number;
  valueAtRisk95: number;
  conditionalVaR95: number;
  probabilityOfLoss: number;
  probabilityOfExceedingTarget: number;
  confidenceIntervals: ConfidenceInterval[];
}

interface TCOBreakdown {
  acquisition: number;
  operating: number;
  maintenance: number;
  training: number;
  downtime: number;
  disposal: number;
  total: number;
  annualized: number;
  perUser: number | null;
}

interface ROSIMetrics {
  rosi: number;
  riskReduction: number;
  incidentReduction: number;
  complianceBenefit: number;
  reputationValue: number;
  totalSecurityValue: number;
  breakEvenTime: number;
}

interface InvestmentRecommendation {
  type: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  metric: string;
  message: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

interface ConfidenceInterval {
  level: number;
  lower: number;
  upper: number;
}