import { Injectable } from '@nestjs/common';
import { LoggingService } from '@soc-compliance/monitoring';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as math from 'mathjs';

/**
 * FAIR (Factor Analysis of Information Risk) implementation
 * Enterprise-grade quantitative risk assessment for billion-dollar platform
 * Provides monetary risk values for executive decision-making
 */
@Injectable()
export class FairRiskAssessmentService {
  // FAIR model calibration parameters
  private readonly CONFIDENCE_LEVELS = [0.1, 0.5, 0.9]; // 10th, 50th, 90th percentiles
  private readonly SIMULATION_RUNS = 10000;
  private readonly PERT_LAMBDA = 4; // PERT distribution shape parameter

  constructor(
    private readonly loggingService: LoggingService,
    @InjectRepository(RiskScenario)
    private readonly riskScenarioRepository: Repository<RiskScenario>,
    @InjectRepository(ThreatEvent)
    private readonly threatEventRepository: Repository<ThreatEvent>,
  ) {}

  /**
   * Perform comprehensive FAIR risk assessment
   * Calculates annualized loss expectancy with confidence intervals
   */
  async assessRisk(
    scenario: RiskScenarioInput
  ): Promise<FairRiskAssessment> {
    const startTime = Date.now();

    try {
      // 1. Calculate Loss Event Frequency (LEF)
      const lef = await this.calculateLossEventFrequency(scenario);

      // 2. Calculate Loss Magnitude (LM)
      const lm = await this.calculateLossMagnitude(scenario);

      // 3. Run Monte Carlo simulation for risk distribution
      const riskDistribution = await this.simulateRiskDistribution(lef, lm);

      // 4. Calculate key risk metrics
      const annualizedLossExpectancy = this.calculateALE(riskDistribution);
      const valueAtRisk = this.calculateVaR(riskDistribution, 0.95);
      const conditionalVaR = this.calculateCVaR(riskDistribution, 0.95);

      // 5. Determine risk rating and recommendations
      const riskRating = this.determineRiskRating(annualizedLossExpectancy);
      const controlRecommendations = await this.generateControlRecommendations(
        scenario,
        annualizedLossExpectancy
      );

      // 6. Calculate risk reduction from controls
      const controlEffectiveness = await this.assessControlEffectiveness(
        scenario,
        lef,
        lm
      );

      const result: FairRiskAssessment = {
        scenarioId: scenario.id,
        lossEventFrequency: lef,
        lossMagnitude: lm,
        annualizedLossExpectancy,
        valueAtRisk95: valueAtRisk,
        conditionalVaR95: conditionalVaR,
        riskRating,
        riskDistribution,
        controlEffectiveness,
        recommendations: controlRecommendations,
        confidenceIntervals: this.calculateConfidenceIntervals(riskDistribution),
        calculationTime: Date.now() - startTime,
        timestamp: new Date(),
      };

      await this.loggingService.log('FAIR risk assessment completed', {
        scenarioId: scenario.id,
        ale: annualizedLossExpectancy,
        riskRating,
      });

      return result;

    } catch (error) {
      await this.loggingService.error('FAIR risk assessment failed', error);
      throw error;
    }
  }

  /**
   * Calculate Loss Event Frequency (LEF)
   * LEF = Threat Event Frequency (TEF) × Vulnerability (Vuln)
   */
  private async calculateLossEventFrequency(
    scenario: RiskScenarioInput
  ): Promise<LossEventFrequency> {
    // Calculate Threat Event Frequency
    const tef = await this.calculateThreatEventFrequency(scenario);

    // Calculate Vulnerability (probability of successful attack)
    const vulnerability = await this.calculateVulnerability(scenario);

    // LEF = TEF × Vulnerability
    const frequency = {
      min: tef.min * vulnerability.min,
      mostLikely: tef.mostLikely * vulnerability.mostLikely,
      max: tef.max * vulnerability.max,
      confidence: Math.min(tef.confidence, vulnerability.confidence),
    };

    return {
      threatEventFrequency: tef,
      vulnerability,
      frequency,
      annualOccurrences: frequency.mostLikely,
    };
  }

  /**
   * Calculate Threat Event Frequency (TEF)
   * Based on threat actor capability and contact frequency
   */
  private async calculateThreatEventFrequency(
    scenario: RiskScenarioInput
  ): Promise<FrequencyEstimate> {
    // Get historical threat data
    const historicalEvents = await this.threatEventRepository.find({
      where: {
        assetType: scenario.assetType,
        threatActorType: scenario.threatActor,
      },
      order: { occurredAt: 'DESC' },
      take: 100,
    });

    // Calculate contact frequency (attempts per year)
    const contactFrequency = this.estimateContactFrequency(
      scenario.threatActor,
      scenario.assetValue,
      historicalEvents
    );

    // Calculate probability of action (threat actor motivation)
    const probabilityOfAction = this.calculateThreatActorMotivation(
      scenario.threatActor,
      scenario.assetValue,
      scenario.industry
    );

    return {
      min: contactFrequency.min * probabilityOfAction.min,
      mostLikely: contactFrequency.mostLikely * probabilityOfAction.mostLikely,
      max: contactFrequency.max * probabilityOfAction.max,
      confidence: (contactFrequency.confidence + probabilityOfAction.confidence) / 2,
    };
  }

  /**
   * Calculate Vulnerability
   * Threat Capability (TCap) vs Control Strength (CS)
   */
  private async calculateVulnerability(
    scenario: RiskScenarioInput
  ): Promise<VulnerabilityEstimate> {
    // Assess threat capability
    const threatCapability = this.assessThreatCapability(scenario.threatActor);

    // Assess control strength
    const controlStrength = await this.assessControlStrength(scenario.controls);

    // Calculate vulnerability as probability of overcoming controls
    const vulnerability = this.calculateVulnerabilityProbability(
      threatCapability,
      controlStrength
    );

    return {
      threatCapability,
      controlStrength,
      ...vulnerability,
    };
  }

  /**
   * Calculate Loss Magnitude (LM)
   * Includes primary and secondary losses
   */
  private async calculateLossMagnitude(
    scenario: RiskScenarioInput
  ): Promise<LossMagnitude> {
    // Primary Loss Factors
    const primaryLoss = this.calculatePrimaryLoss(scenario);

    // Secondary Loss Factors
    const secondaryLoss = await this.calculateSecondaryLoss(scenario);

    // Total Loss Magnitude
    const total = {
      min: primaryLoss.min + secondaryLoss.min,
      mostLikely: primaryLoss.mostLikely + secondaryLoss.mostLikely,
      max: primaryLoss.max + secondaryLoss.max,
      confidence: Math.min(primaryLoss.confidence, secondaryLoss.confidence),
    };

    return {
      primaryLoss,
      secondaryLoss,
      totalLoss: total,
      worstCaseScenario: total.max,
      expectedLoss: total.mostLikely,
    };
  }

  /**
   * Calculate Primary Loss
   * Direct losses from the incident
   */
  private calculatePrimaryLoss(scenario: RiskScenarioInput): LossEstimate {
    const assetValue = scenario.assetValue;
    
    // Productivity loss
    const productivityLoss = this.estimateProductivityLoss(
      scenario.affectedUsers,
      scenario.downtime,
      scenario.hourlyRate
    );

    // Replacement cost
    const replacementCost = scenario.replacementCost || 0;

    // Response cost
    const responseCost = this.estimateResponseCost(
      scenario.severity,
      scenario.complexity
    );

    return {
      min: productivityLoss.min + replacementCost * 0.8 + responseCost.min,
      mostLikely: productivityLoss.mostLikely + replacementCost + responseCost.mostLikely,
      max: productivityLoss.max + replacementCost * 1.5 + responseCost.max,
      confidence: 0.8,
      breakdown: {
        productivity: productivityLoss.mostLikely,
        replacement: replacementCost,
        response: responseCost.mostLikely,
      },
    };
  }

  /**
   * Calculate Secondary Loss
   * Reputation, competitive advantage, legal/regulatory losses
   */
  private async calculateSecondaryLoss(
    scenario: RiskScenarioInput
  ): Promise<LossEstimate> {
    // Reputation damage
    const reputationLoss = await this.estimateReputationLoss(
      scenario.dataRecords,
      scenario.dataClassification,
      scenario.publicDisclosure
    );

    // Competitive advantage loss
    const competitiveLoss = this.estimateCompetitiveLoss(
      scenario.intellectualProperty,
      scenario.marketShare
    );

    // Legal and regulatory fines
    const regulatoryLoss = await this.estimateRegulatoryLoss(
      scenario.dataRecords,
      scenario.dataClassification,
      scenario.jurisdiction
    );

    return {
      min: reputationLoss.min + competitiveLoss.min + regulatoryLoss.min,
      mostLikely: reputationLoss.mostLikely + competitiveLoss.mostLikely + regulatoryLoss.mostLikely,
      max: reputationLoss.max + competitiveLoss.max + regulatoryLoss.max,
      confidence: 0.7, // Lower confidence for secondary losses
      breakdown: {
        reputation: reputationLoss.mostLikely,
        competitive: competitiveLoss.mostLikely,
        regulatory: regulatoryLoss.mostLikely,
      },
    };
  }

  /**
   * Run Monte Carlo simulation for risk distribution
   */
  private async simulateRiskDistribution(
    lef: LossEventFrequency,
    lm: LossMagnitude
  ): Promise<RiskDistribution> {
    const losses: number[] = [];

    for (let i = 0; i < this.SIMULATION_RUNS; i++) {
      // Sample frequency from PERT distribution
      const frequency = this.samplePERT(
        lef.frequency.min,
        lef.frequency.mostLikely,
        lef.frequency.max
      );

      // Sample loss magnitude from PERT distribution
      const magnitude = this.samplePERT(
        lm.totalLoss.min,
        lm.totalLoss.mostLikely,
        lm.totalLoss.max
      );

      // Annual loss for this simulation
      const annualLoss = frequency * magnitude;
      losses.push(annualLoss);
    }

    // Sort for percentile calculations
    losses.sort((a, b) => a - b);

    return {
      simulations: this.SIMULATION_RUNS,
      losses,
      percentiles: this.calculatePercentiles(losses),
      mean: this.calculateMean(losses),
      median: losses[Math.floor(losses.length / 2)],
      standardDeviation: this.calculateStandardDeviation(losses),
      skewness: this.calculateSkewness(losses),
      kurtosis: this.calculateKurtosis(losses),
    };
  }

  /**
   * Sample from PERT distribution
   * Better than triangular for risk modeling
   */
  private samplePERT(min: number, mode: number, max: number): number {
    // Calculate alpha and beta for Beta distribution
    const mean = (min + this.PERT_LAMBDA * mode + max) / (this.PERT_LAMBDA + 2);
    const alpha = ((mean - min) * (2 * mode - min - max)) / 
                  ((mode - mean) * (max - min));
    const beta = (alpha * (max - mean)) / (mean - min);

    // Sample from Beta distribution
    const betaSample = this.sampleBeta(alpha, beta);

    // Scale to original range
    return min + betaSample * (max - min);
  }

  /**
   * Sample from Beta distribution using acceptance-rejection method
   */
  private sampleBeta(alpha: number, beta: number): number {
    const x = this.sampleGamma(alpha);
    const y = this.sampleGamma(beta);
    return x / (x + y);
  }

  /**
   * Sample from Gamma distribution (simplified)
   */
  private sampleGamma(shape: number): number {
    // Marsaglia and Tsang method (simplified)
    let sum = 0;
    for (let i = 0; i < Math.floor(shape); i++) {
      sum -= Math.log(Math.random());
    }
    return sum;
  }

  /**
   * Estimate contact frequency based on threat actor and asset value
   */
  private estimateContactFrequency(
    threatActor: string,
    assetValue: number,
    historicalData: ThreatEvent[]
  ): FrequencyEstimate {
    // Base rates by threat actor type (per year)
    const baseRates: Record<string, any> = {
      'NATION_STATE': { min: 1, mostLikely: 5, max: 20 },
      'ORGANIZED_CRIME': { min: 5, mostLikely: 20, max: 100 },
      'HACKTIVIST': { min: 2, mostLikely: 10, max: 50 },
      'INSIDER_MALICIOUS': { min: 0.1, mostLikely: 1, max: 5 },
      'INSIDER_ACCIDENTAL': { min: 1, mostLikely: 10, max: 50 },
      'OPPORTUNISTIC': { min: 10, mostLikely: 100, max: 1000 },
    };

    const base = baseRates[threatActor] || baseRates['OPPORTUNISTIC'];

    // Adjust based on asset value
    const valueMultiplier = Math.log10(assetValue / 10000) / 2;

    // Adjust based on historical data
    const historicalMultiplier = historicalData.length > 0
      ? historicalData.length / 10
      : 1;

    return {
      min: base.min * valueMultiplier * historicalMultiplier,
      mostLikely: base.mostLikely * valueMultiplier * historicalMultiplier,
      max: base.max * valueMultiplier * historicalMultiplier,
      confidence: historicalData.length > 10 ? 0.8 : 0.6,
    };
  }

  /**
   * Calculate threat actor motivation
   */
  private calculateThreatActorMotivation(
    threatActor: string,
    assetValue: number,
    industry: string
  ): FrequencyEstimate {
    // Industry attractiveness scores
    const industryScores: Record<string, number> = {
      'FINANCIAL': 0.9,
      'HEALTHCARE': 0.8,
      'GOVERNMENT': 0.85,
      'RETAIL': 0.7,
      'TECHNOLOGY': 0.75,
      'MANUFACTURING': 0.6,
      'OTHER': 0.5,
    };

    const industryScore = industryScores[industry] || 0.5;

    // Asset value score (logarithmic)
    const valueScore = Math.min(1, Math.log10(assetValue) / 8);

    // Threat actor specific motivations
    const motivationFactors: Record<string, number> = {
      'NATION_STATE': 0.9,
      'ORGANIZED_CRIME': 0.8,
      'HACKTIVIST': 0.6,
      'INSIDER_MALICIOUS': 0.7,
      'INSIDER_ACCIDENTAL': 0.3,
      'OPPORTUNISTIC': 0.4,
    };

    const actorMotivation = motivationFactors[threatActor] || 0.5;

    const overallMotivation = (industryScore + valueScore + actorMotivation) / 3;

    return {
      min: overallMotivation * 0.5,
      mostLikely: overallMotivation,
      max: Math.min(1, overallMotivation * 1.5),
      confidence: 0.7,
    };
  }

  /**
   * Assess threat actor capability
   */
  private assessThreatCapability(threatActor: string): CapabilityScore {
    const capabilities: Record<string, CapabilityScore> = {
      'NATION_STATE': {
        technical: 0.95,
        resources: 1.0,
        persistence: 0.95,
        overall: 0.97,
      },
      'ORGANIZED_CRIME': {
        technical: 0.8,
        resources: 0.85,
        persistence: 0.8,
        overall: 0.82,
      },
      'HACKTIVIST': {
        technical: 0.6,
        resources: 0.4,
        persistence: 0.7,
        overall: 0.57,
      },
      'INSIDER_MALICIOUS': {
        technical: 0.5,
        resources: 0.3,
        persistence: 0.6,
        overall: 0.47,
      },
      'INSIDER_ACCIDENTAL': {
        technical: 0.1,
        resources: 0.1,
        persistence: 0.1,
        overall: 0.1,
      },
      'OPPORTUNISTIC': {
        technical: 0.3,
        resources: 0.2,
        persistence: 0.3,
        overall: 0.27,
      },
    };

    return capabilities[threatActor] || capabilities['OPPORTUNISTIC'];
  }

  /**
   * Assess control strength
   */
  private async assessControlStrength(
    controls: string[]
  ): Promise<ControlStrengthScore> {
    // This would query actual control effectiveness data
    // For now, using estimates based on control types

    let preventiveStrength = 0;
    let detectiveStrength = 0;
    let correctiveStrength = 0;

    for (const control of controls) {
      if (control.includes('PREVENT')) preventiveStrength += 0.2;
      if (control.includes('DETECT')) detectiveStrength += 0.15;
      if (control.includes('CORRECT')) correctiveStrength += 0.1;
    }

    const overall = Math.min(1, (preventiveStrength + detectiveStrength + correctiveStrength) / 2);

    return {
      preventive: Math.min(1, preventiveStrength),
      detective: Math.min(1, detectiveStrength),
      corrective: Math.min(1, correctiveStrength),
      overall,
    };
  }

  /**
   * Calculate vulnerability probability
   */
  private calculateVulnerabilityProbability(
    threatCapability: CapabilityScore,
    controlStrength: ControlStrengthScore
  ): FrequencyEstimate {
    // Vulnerability = Threat Capability - Control Strength
    const diff = threatCapability.overall - controlStrength.overall;
    const vulnerability = Math.max(0, Math.min(1, (diff + 1) / 2));

    return {
      min: Math.max(0, vulnerability - 0.2),
      mostLikely: vulnerability,
      max: Math.min(1, vulnerability + 0.2),
      confidence: 0.75,
    };
  }

  /**
   * Estimate productivity loss
   */
  private estimateProductivityLoss(
    users: number,
    downtime: number,
    hourlyRate: number
  ): LossEstimate {
    const baseLoss = users * downtime * hourlyRate;

    return {
      min: baseLoss * 0.7,
      mostLikely: baseLoss,
      max: baseLoss * 1.5,
      confidence: 0.85,
    };
  }

  /**
   * Estimate incident response cost
   */
  private estimateResponseCost(
    severity: string,
    complexity: string
  ): LossEstimate {
    const severityCosts: Record<string, number> = {
      'CRITICAL': 100000,
      'HIGH': 50000,
      'MEDIUM': 20000,
      'LOW': 5000,
    };

    const complexityMultipliers: Record<string, number> = {
      'VERY_HIGH': 3,
      'HIGH': 2,
      'MEDIUM': 1.5,
      'LOW': 1,
    };

    const base = severityCosts[severity] || 20000;
    const multiplier = complexityMultipliers[complexity] || 1.5;

    return {
      min: base * multiplier * 0.5,
      mostLikely: base * multiplier,
      max: base * multiplier * 2,
      confidence: 0.7,
    };
  }

  /**
   * Estimate reputation loss
   */
  private async estimateReputationLoss(
    records: number,
    classification: string,
    publicDisclosure: boolean
  ): Promise<LossEstimate> {
    // Base loss per record by classification
    const perRecordLoss: Record<string, number> = {
      'PII': 150,
      'PHI': 500,
      'PCI': 200,
      'CONFIDENTIAL': 100,
      'PUBLIC': 10,
    };

    const baseLoss = records * (perRecordLoss[classification] || 100);
    const disclosureMultiplier = publicDisclosure ? 3 : 1;

    return {
      min: baseLoss * disclosureMultiplier * 0.5,
      mostLikely: baseLoss * disclosureMultiplier,
      max: baseLoss * disclosureMultiplier * 5,
      confidence: 0.6,
    };
  }

  /**
   * Estimate competitive advantage loss
   */
  private estimateCompetitiveLoss(
    hasIP: boolean,
    marketShare: number
  ): LossEstimate {
    if (!hasIP) {
      return { min: 0, mostLikely: 0, max: 0, confidence: 1 };
    }

    const marketValue = marketShare * 1000000; // $1M per percentage point

    return {
      min: marketValue * 0.01,
      mostLikely: marketValue * 0.05,
      max: marketValue * 0.2,
      confidence: 0.5,
    };
  }

  /**
   * Estimate regulatory fines
   */
  private async estimateRegulatoryLoss(
    records: number,
    classification: string,
    jurisdiction: string
  ): Promise<LossEstimate> {
    // GDPR fines: up to 4% of annual revenue or €20M
    // CCPA: $2,500-$7,500 per violation
    // HIPAA: $50-$50,000 per violation

    const fineStructures: Record<string, any> = {
      'GDPR': { min: 100, mostLikely: 200, max: 500 },
      'CCPA': { min: 100, mostLikely: 150, max: 300 },
      'HIPAA': { min: 200, mostLikely: 400, max: 1000 },
      'PCI': { min: 50, mostLikely: 100, max: 200 },
      'OTHER': { min: 20, mostLikely: 50, max: 100 },
    };

    const finePerRecord = fineStructures[jurisdiction] || fineStructures['OTHER'];
    const totalFine = records * finePerRecord.mostLikely;

    return {
      min: records * finePerRecord.min,
      mostLikely: totalFine,
      max: Math.min(records * finePerRecord.max, 20000000), // Cap at €20M
      confidence: 0.7,
    };
  }

  /**
   * Calculate Annualized Loss Expectancy
   */
  private calculateALE(distribution: RiskDistribution): number {
    return distribution.mean;
  }

  /**
   * Calculate Value at Risk
   */
  private calculateVaR(distribution: RiskDistribution, confidence: number): number {
    const index = Math.floor(distribution.losses.length * confidence);
    return distribution.losses[index];
  }

  /**
   * Calculate Conditional Value at Risk
   */
  private calculateCVaR(distribution: RiskDistribution, confidence: number): number {
    const varIndex = Math.floor(distribution.losses.length * confidence);
    const tail = distribution.losses.slice(varIndex);
    return this.calculateMean(tail);
  }

  /**
   * Determine risk rating based on ALE
   */
  private determineRiskRating(ale: number): RiskRating {
    if (ale < 10000) return 'LOW';
    if (ale < 100000) return 'MEDIUM';
    if (ale < 1000000) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Generate control recommendations
   */
  private async generateControlRecommendations(
    scenario: RiskScenarioInput,
    ale: number
  ): Promise<ControlRecommendation[]> {
    const recommendations: ControlRecommendation[] = [];

    // Recommend controls based on risk factors
    if (ale > 100000) {
      recommendations.push({
        control: 'IMPLEMENT_MFA',
        expectedRiskReduction: 0.6,
        estimatedCost: 50000,
        roi: (ale * 0.6 - 50000) / 50000,
        priority: 'HIGH',
      });
    }

    if (scenario.threatActor === 'INSIDER_MALICIOUS') {
      recommendations.push({
        control: 'DLP_SOLUTION',
        expectedRiskReduction: 0.4,
        estimatedCost: 100000,
        roi: (ale * 0.4 - 100000) / 100000,
        priority: 'HIGH',
      });
    }

    return recommendations;
  }

  /**
   * Assess control effectiveness
   */
  private async assessControlEffectiveness(
    scenario: RiskScenarioInput,
    lef: LossEventFrequency,
    lm: LossMagnitude
  ): Promise<ControlEffectivenessResult> {
    // Calculate residual risk with controls
    const controlledLEF = {
      ...lef,
      frequency: {
        min: lef.frequency.min * 0.3,
        mostLikely: lef.frequency.mostLikely * 0.3,
        max: lef.frequency.max * 0.3,
        confidence: lef.frequency.confidence,
      },
    };

    const residualDistribution = await this.simulateRiskDistribution(
      controlledLEF,
      lm
    );

    const residualALE = this.calculateALE(residualDistribution);
    const inherentALE = this.calculateALE(
      await this.simulateRiskDistribution(lef, lm)
    );

    return {
      inherentRisk: inherentALE,
      residualRisk: residualALE,
      riskReduction: inherentALE - residualALE,
      riskReductionPercentage: ((inherentALE - residualALE) / inherentALE) * 100,
      controlROI: ((inherentALE - residualALE) - scenario.controlCost) / scenario.controlCost,
    };
  }

  /**
   * Calculate percentiles from distribution
   */
  private calculatePercentiles(values: number[]): Record<string, number> {
    return {
      p10: values[Math.floor(values.length * 0.1)],
      p25: values[Math.floor(values.length * 0.25)],
      p50: values[Math.floor(values.length * 0.5)],
      p75: values[Math.floor(values.length * 0.75)],
      p90: values[Math.floor(values.length * 0.9)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
    };
  }

  /**
   * Calculate confidence intervals
   */
  private calculateConfidenceIntervals(
    distribution: RiskDistribution
  ): ConfidenceInterval[] {
    const mean = distribution.mean;
    const stdError = distribution.standardDeviation / Math.sqrt(distribution.simulations);

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

  // Statistical helper methods
  private calculateMean(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(this.calculateMean(squaredDiffs));
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
}

// Type definitions and entities

interface RiskScenarioInput {
  id: string;
  assetType: string;
  assetValue: number;
  threatActor: string;
  industry: string;
  controls: string[];
  controlCost: number;
  affectedUsers: number;
  downtime: number; // hours
  hourlyRate: number;
  replacementCost?: number;
  severity: string;
  complexity: string;
  dataRecords: number;
  dataClassification: string;
  publicDisclosure: boolean;
  intellectualProperty: boolean;
  marketShare: number;
  jurisdiction: string;
}

interface FairRiskAssessment {
  scenarioId: string;
  lossEventFrequency: LossEventFrequency;
  lossMagnitude: LossMagnitude;
  annualizedLossExpectancy: number;
  valueAtRisk95: number;
  conditionalVaR95: number;
  riskRating: RiskRating;
  riskDistribution: RiskDistribution;
  controlEffectiveness: ControlEffectivenessResult;
  recommendations: ControlRecommendation[];
  confidenceIntervals: ConfidenceInterval[];
  calculationTime: number;
  timestamp: Date;
}

interface LossEventFrequency {
  threatEventFrequency: FrequencyEstimate;
  vulnerability: VulnerabilityEstimate;
  frequency: FrequencyEstimate;
  annualOccurrences: number;
}

interface LossMagnitude {
  primaryLoss: LossEstimate;
  secondaryLoss: LossEstimate;
  totalLoss: LossEstimate;
  worstCaseScenario: number;
  expectedLoss: number;
}

interface FrequencyEstimate {
  min: number;
  mostLikely: number;
  max: number;
  confidence: number;
}

interface LossEstimate extends FrequencyEstimate {
  breakdown?: Record<string, number>;
}

interface VulnerabilityEstimate extends FrequencyEstimate {
  threatCapability: CapabilityScore;
  controlStrength: ControlStrengthScore;
}

interface CapabilityScore {
  technical: number;
  resources: number;
  persistence: number;
  overall: number;
}

interface ControlStrengthScore {
  preventive: number;
  detective: number;
  corrective: number;
  overall: number;
}

interface RiskDistribution {
  simulations: number;
  losses: number[];
  percentiles: Record<string, number>;
  mean: number;
  median: number;
  standardDeviation: number;
  skewness: number;
  kurtosis: number;
}

interface ControlEffectivenessResult {
  inherentRisk: number;
  residualRisk: number;
  riskReduction: number;
  riskReductionPercentage: number;
  controlROI: number;
}

interface ControlRecommendation {
  control: string;
  expectedRiskReduction: number;
  estimatedCost: number;
  roi: number;
  priority: string;
}

interface ConfidenceInterval {
  level: number;
  lower: number;
  upper: number;
}

type RiskRating = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Entity classes for TypeORM
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('risk_scenarios')
export class RiskScenario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'jsonb' })
  parameters: RiskScenarioInput;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('threat_events')
export class ThreatEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  assetType: string;

  @Column()
  threatActorType: string;

  @Column()
  severity: string;

  @CreateDateColumn()
  occurredAt: Date;
}