import { Injectable } from '@nestjs/common';
import { ValidationError } from '../../../shared/errors/validation.error';

/**
 * Loss Magnitude Calculator
 * Implements FAIR methodology for estimating potential loss magnitude
 * Single responsibility: Calculate primary and secondary loss components
 */
@Injectable()
export class LossMagnitudeCalculator {
  // Industry-standard cost factors (USD)
  private readonly COST_FACTORS = {
    PRODUCTIVITY: {
      perUserPerHour: 50,
      systemDowntimePerHour: 5000,
      criticalSystemMultiplier: 10,
    },
    REPLACEMENT: {
      dataPerGB: 500,
      hardwarePerUnit: 2000,
      softwareLicenseBase: 10000,
    },
    RESPONSE: {
      incidentResponseTeamPerHour: 200,
      forensicsPerIncident: 15000,
      legalConsultationPerHour: 500,
      publicRelationsPerIncident: 25000,
    },
    REGULATORY: {
      finePerRecord: {
        GDPR: 100,
        HIPAA: 150,
        PCI: 50,
        CCPA: 75,
      },
      maxFinePercentOfRevenue: 0.04, // 4% for GDPR
    },
    REPUTATION: {
      customerChurnRate: 0.05, // 5% churn after breach
      stockPriceImpact: 0.03, // 3% average drop
      brandValueImpact: 0.10, // 10% brand value reduction
    },
  } as const;

  // Confidence levels for different estimation methods
  private readonly CONFIDENCE_LEVELS = {
    HISTORICAL_DATA: 0.9,
    INDUSTRY_BENCHMARK: 0.7,
    EXPERT_JUDGMENT: 0.6,
    THEORETICAL_MODEL: 0.5,
  } as const;

  /**
   * Calculate comprehensive loss magnitude with all components
   * @param scenario Risk scenario with asset and impact information
   * @returns Detailed loss magnitude estimates
   */
  async calculate(scenario: LossMagnitudeScenario): Promise<LossMagnitudeResult> {
    // Validate inputs
    this.validateScenario(scenario);

    // Calculate primary loss components
    const primaryLoss = await this.calculatePrimaryLoss(scenario);

    // Calculate secondary loss components
    const secondaryLoss = await this.calculateSecondaryLoss(scenario, primaryLoss);

    // Combine for total loss magnitude
    const totalLoss = this.combineLosses(primaryLoss, secondaryLoss);

    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(scenario, primaryLoss, secondaryLoss);

    return {
      primaryLoss,
      secondaryLoss,
      totalLoss,
      confidence,
      methodology: 'FAIR',
      timestamp: new Date(),
    };
  }

  /**
   * Calculate primary loss (direct impact from the incident)
   */
  private async calculatePrimaryLoss(
    scenario: LossMagnitudeScenario
  ): Promise<PrimaryLossEstimate> {
    const productivity = this.calculateProductivityLoss(scenario);
    const replacement = this.calculateReplacementCost(scenario);
    const response = this.calculateResponseCost(scenario);

    // Calculate totals with PERT distribution
    const total = this.aggregateLossEstimates([productivity, replacement, response]);

    return {
      productivity,
      replacement,
      response,
      total,
      components: [
        { name: 'Productivity Loss', ...productivity },
        { name: 'Replacement Cost', ...replacement },
        { name: 'Response Cost', ...response },
      ],
    };
  }

  /**
   * Calculate productivity loss from disruption
   */
  private calculateProductivityLoss(scenario: LossMagnitudeScenario): LossEstimate {
    const baseRate = this.COST_FACTORS.PRODUCTIVITY.perUserPerHour;
    const affectedUsers = scenario.affectedUsers || 0;
    const downtimeHours = scenario.estimatedDowntime || 0;

    // Factor in system criticality
    const criticalityMultiplier = scenario.systemCriticality === 'CRITICAL' 
      ? this.COST_FACTORS.PRODUCTIVITY.criticalSystemMultiplier 
      : scenario.systemCriticality === 'HIGH' ? 5 : 1;

    // Calculate base loss
    const userProductivityLoss = affectedUsers * downtimeHours * baseRate;
    const systemDowntimeLoss = downtimeHours * 
      this.COST_FACTORS.PRODUCTIVITY.systemDowntimePerHour * 
      criticalityMultiplier;

    const baseLoss = userProductivityLoss + systemDowntimeLoss;

    // Apply uncertainty bounds (±30%)
    return {
      minimum: baseLoss * 0.7,
      mostLikely: baseLoss,
      maximum: baseLoss * 1.3,
      confidence: this.CONFIDENCE_LEVELS.INDUSTRY_BENCHMARK,
    };
  }

  /**
   * Calculate replacement costs for damaged assets
   */
  private calculateReplacementCost(scenario: LossMagnitudeScenario): LossEstimate {
    let totalCost = 0;

    // Data replacement cost
    if (scenario.dataLossGB) {
      totalCost += scenario.dataLossGB * this.COST_FACTORS.REPLACEMENT.dataPerGB;
    }

    // Hardware replacement
    if (scenario.hardwareUnitsAffected) {
      totalCost += scenario.hardwareUnitsAffected * 
        this.COST_FACTORS.REPLACEMENT.hardwarePerUnit;
    }

    // Software licenses
    if (scenario.softwareLicensesAffected) {
      totalCost += scenario.softwareLicensesAffected * 
        this.COST_FACTORS.REPLACEMENT.softwareLicenseBase;
    }

    // Asset-specific replacement value
    if (scenario.assetReplacementValue) {
      totalCost += scenario.assetReplacementValue;
    }

    // Apply uncertainty based on asset complexity
    const complexityFactor = scenario.assetComplexity === 'HIGH' ? 0.5 : 0.3;

    return {
      minimum: totalCost * (1 - complexityFactor),
      mostLikely: totalCost,
      maximum: totalCost * (1 + complexityFactor * 2),
      confidence: scenario.assetReplacementValue 
        ? this.CONFIDENCE_LEVELS.HISTORICAL_DATA 
        : this.CONFIDENCE_LEVELS.THEORETICAL_MODEL,
    };
  }

  /**
   * Calculate incident response costs
   */
  private calculateResponseCost(scenario: LossMagnitudeScenario): LossEstimate {
    const responseHours = scenario.estimatedResponseHours || 40; // Default 1 week
    let totalCost = 0;

    // Internal response team
    totalCost += responseHours * this.COST_FACTORS.RESPONSE.incidentResponseTeamPerHour;

    // Forensics (if needed)
    if (scenario.requiresForensics) {
      totalCost += this.COST_FACTORS.RESPONSE.forensicsPerIncident;
    }

    // Legal consultation
    if (scenario.requiresLegalReview) {
      const legalHours = Math.max(20, responseHours * 0.25);
      totalCost += legalHours * this.COST_FACTORS.RESPONSE.legalConsultationPerHour;
    }

    // Public relations
    if (scenario.requiresPRResponse) {
      totalCost += this.COST_FACTORS.RESPONSE.publicRelationsPerIncident;
    }

    // Add 20% contingency for unexpected costs
    const contingency = 0.2;

    return {
      minimum: totalCost,
      mostLikely: totalCost * (1 + contingency),
      maximum: totalCost * (1 + contingency * 3),
      confidence: this.CONFIDENCE_LEVELS.EXPERT_JUDGMENT,
    };
  }

  /**
   * Calculate secondary loss (indirect consequences)
   */
  private async calculateSecondaryLoss(
    scenario: LossMagnitudeScenario,
    primaryLoss: PrimaryLossEstimate
  ): Promise<SecondaryLossEstimate> {
    const regulatory = this.calculateRegulatoryFines(scenario);
    const reputation = this.calculateReputationDamage(scenario);
    const competitive = this.calculateCompetitiveDisadvantage(scenario);

    // Calculate totals
    const total = this.aggregateLossEstimates([regulatory, reputation, competitive]);

    return {
      regulatory,
      reputation,
      competitive,
      total,
      components: [
        { name: 'Regulatory Fines', ...regulatory },
        { name: 'Reputation Damage', ...reputation },
        { name: 'Competitive Disadvantage', ...competitive },
      ],
    };
  }

  /**
   * Calculate potential regulatory fines
   */
  private calculateRegulatoryFines(scenario: LossMagnitudeScenario): LossEstimate {
    if (!scenario.regulatoryEnvironment || scenario.recordsExposed === 0) {
      return {
        minimum: 0,
        mostLikely: 0,
        maximum: 0,
        confidence: 1,
      };
    }

    const recordsExposed = scenario.recordsExposed || 0;
    let totalFines = 0;

    // Calculate per-record fines for each regulation
    for (const regulation of scenario.regulatoryEnvironment) {
      const finePerRecord = this.COST_FACTORS.REGULATORY.finePerRecord[regulation] || 50;
      totalFines += recordsExposed * finePerRecord;
    }

    // Cap at percentage of revenue if provided
    if (scenario.annualRevenue) {
      const maxFine = scenario.annualRevenue * 
        this.COST_FACTORS.REGULATORY.maxFinePercentOfRevenue;
      totalFines = Math.min(totalFines, maxFine);
    }

    // Probability of enforcement action
    const enforcementProbability = this.estimateEnforcementProbability(scenario);

    return {
      minimum: totalFines * enforcementProbability * 0.1, // 10% of max if enforced
      mostLikely: totalFines * enforcementProbability * 0.5, // 50% typical settlement
      maximum: totalFines * enforcementProbability, // Full fine possible
      confidence: this.CONFIDENCE_LEVELS.INDUSTRY_BENCHMARK,
    };
  }

  /**
   * Estimate probability of regulatory enforcement
   */
  private estimateEnforcementProbability(scenario: LossMagnitudeScenario): number {
    let probability = 0.3; // Base probability

    // Adjust based on number of records
    if ((scenario.recordsExposed || 0) > 10000) {
      probability += 0.2;
    }
    if ((scenario.recordsExposed || 0) > 100000) {
      probability += 0.3;
    }

    // Adjust based on data sensitivity
    if (scenario.dataClassification === 'TOP_SECRET' || 
        scenario.dataClassification === 'RESTRICTED') {
      probability += 0.2;
    }

    // Public visibility increases enforcement likelihood
    if (scenario.publicProfile === 'HIGH') {
      probability += 0.1;
    }

    return Math.min(1, probability);
  }

  /**
   * Calculate reputation damage costs
   */
  private calculateReputationDamage(scenario: LossMagnitudeScenario): LossEstimate {
    if (!scenario.annualRevenue) {
      return {
        minimum: 0,
        mostLikely: 0,
        maximum: 0,
        confidence: this.CONFIDENCE_LEVELS.THEORETICAL_MODEL,
      };
    }

    let totalDamage = 0;

    // Customer churn impact
    const churnImpact = scenario.annualRevenue * 
      this.COST_FACTORS.REPUTATION.customerChurnRate;
    totalDamage += churnImpact;

    // Stock price impact (if public company)
    if (scenario.marketCapitalization) {
      const stockImpact = scenario.marketCapitalization * 
        this.COST_FACTORS.REPUTATION.stockPriceImpact;
      totalDamage += stockImpact * 0.1; // 10% of stock impact translates to real loss
    }

    // Brand value impact
    const brandImpact = scenario.annualRevenue * 0.2 * // Brand value ~20% of revenue
      this.COST_FACTORS.REPUTATION.brandValueImpact;
    totalDamage += brandImpact;

    // Recovery time factor (reputation damage persists)
    const recoveryYears = scenario.systemCriticality === 'CRITICAL' ? 3 : 2;
    totalDamage *= recoveryYears;

    // Public profile amplifies reputation damage
    const publicProfileMultiplier = 
      scenario.publicProfile === 'HIGH' ? 2 :
      scenario.publicProfile === 'MEDIUM' ? 1.5 : 1;

    totalDamage *= publicProfileMultiplier;

    return {
      minimum: totalDamage * 0.2, // Best case: minimal impact
      mostLikely: totalDamage * 0.6, // Typical impact
      maximum: totalDamage, // Worst case: full impact
      confidence: this.CONFIDENCE_LEVELS.EXPERT_JUDGMENT,
    };
  }

  /**
   * Calculate competitive disadvantage from IP theft or disruption
   */
  private calculateCompetitiveDisadvantage(
    scenario: LossMagnitudeScenario
  ): LossEstimate {
    if (!scenario.intellectualPropertyValue) {
      return {
        minimum: 0,
        mostLikely: 0,
        maximum: 0,
        confidence: 1,
      };
    }

    const ipValue = scenario.intellectualPropertyValue;
    let lossFactor = 0;

    // Determine loss factor based on threat type
    switch (scenario.threatType) {
      case 'NATION_STATE':
        lossFactor = 0.8; // High likelihood of IP exploitation
        break;
      case 'ORGANIZED_CRIME':
        lossFactor = 0.5; // May sell IP
        break;
      case 'COMPETITOR':
        lossFactor = 0.9; // Direct competitive use
        break;
      default:
        lossFactor = 0.2; // Lower exploitation likelihood
    }

    // Adjust for time advantage lost
    const timeAdvantageYears = scenario.timeAdvantageYears || 2;
    const annualValue = ipValue / Math.max(5, timeAdvantageYears * 2);
    const competitiveLoss = annualValue * timeAdvantageYears * lossFactor;

    return {
      minimum: competitiveLoss * 0.3,
      mostLikely: competitiveLoss * 0.7,
      maximum: competitiveLoss,
      confidence: this.CONFIDENCE_LEVELS.EXPERT_JUDGMENT,
    };
  }

  /**
   * Combine primary and secondary losses
   */
  private combineLosses(
    primary: PrimaryLossEstimate,
    secondary: SecondaryLossEstimate
  ): TotalLossEstimate {
    const minimum = primary.total.minimum + secondary.total.minimum;
    const mostLikely = primary.total.mostLikely + secondary.total.mostLikely;
    const maximum = primary.total.maximum + secondary.total.maximum;

    // Calculate expected value using PERT
    const expected = (minimum + 4 * mostLikely + maximum) / 6;

    // Calculate standard deviation for risk assessment
    const stdDev = (maximum - minimum) / 6;

    return {
      minimum,
      mostLikely,
      maximum,
      expected,
      standardDeviation: stdDev,
      confidence: Math.min(primary.total.confidence, secondary.total.confidence),
      valueAtRisk95: expected + 1.645 * stdDev, // 95% VaR
      conditionalValueAtRisk95: expected + 2.063 * stdDev, // CVaR (expected tail loss)
    };
  }

  /**
   * Calculate overall confidence in the assessment
   */
  private calculateConfidence(
    scenario: LossMagnitudeScenario,
    primary: PrimaryLossEstimate,
    secondary: SecondaryLossEstimate
  ): number {
    const weights = {
      dataQuality: 0.3,
      historicalData: 0.3,
      expertInput: 0.2,
      modelMaturity: 0.2,
    };

    let confidence = 0;

    // Data quality confidence
    confidence += (scenario.dataQuality || 0.5) * weights.dataQuality;

    // Historical data availability
    const hasHistoricalData = scenario.historicalLossData ? 0.9 : 0.5;
    confidence += hasHistoricalData * weights.historicalData;

    // Expert input quality
    const expertQuality = scenario.expertEstimatesCount 
      ? Math.min(1, scenario.expertEstimatesCount / 5) 
      : 0.3;
    confidence += expertQuality * weights.expertInput;

    // Model maturity (based on component confidence)
    const avgComponentConfidence = (
      primary.total.confidence + secondary.total.confidence
    ) / 2;
    confidence += avgComponentConfidence * weights.modelMaturity;

    return Math.min(1, confidence);
  }

  /**
   * Aggregate multiple loss estimates using PERT
   */
  private aggregateLossEstimates(estimates: LossEstimate[]): LossEstimate {
    if (estimates.length === 0) {
      return {
        minimum: 0,
        mostLikely: 0,
        maximum: 0,
        confidence: 1,
      };
    }

    const minimum = estimates.reduce((sum, e) => sum + e.minimum, 0);
    const mostLikely = estimates.reduce((sum, e) => sum + e.mostLikely, 0);
    const maximum = estimates.reduce((sum, e) => sum + e.maximum, 0);

    // Weight confidence by contribution to total
    const total = mostLikely || 1;
    const weightedConfidence = estimates.reduce(
      (sum, e) => sum + (e.confidence * e.mostLikely / total),
      0
    );

    return {
      minimum,
      mostLikely,
      maximum,
      confidence: weightedConfidence,
    };
  }

  /**
   * Validate input scenario
   */
  private validateScenario(scenario: LossMagnitudeScenario): void {
    if (!scenario) {
      throw new ValidationError('Scenario is required');
    }

    if (!scenario.assetType) {
      throw ValidationError.required('assetType');
    }

    // Validate numeric fields
    const numericFields = [
      'affectedUsers',
      'estimatedDowntime',
      'dataLossGB',
      'recordsExposed',
      'annualRevenue',
      'assetReplacementValue',
    ];

    for (const field of numericFields) {
      const value = (scenario as any)[field];
      if (value !== undefined && value !== null) {
        if (!isFinite(value) || value < 0) {
          throw ValidationError.forField(field, value, 'Must be non-negative number');
        }
      }
    }

    // Validate data quality
    if (scenario.dataQuality !== undefined) {
      if (scenario.dataQuality < 0 || scenario.dataQuality > 1) {
        throw ValidationError.outOfRange('dataQuality', scenario.dataQuality, 0, 1);
      }
    }

    // Validate system criticality
    if (scenario.systemCriticality) {
      const validCriticalities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      if (!validCriticalities.includes(scenario.systemCriticality)) {
        throw ValidationError.forField(
          'systemCriticality',
          scenario.systemCriticality,
          `Must be one of: ${validCriticalities.join(', ')}`
        );
      }
    }
  }
}

// Type definitions

export interface LossMagnitudeScenario {
  // Asset information
  assetType: string;
  assetReplacementValue?: number;
  assetComplexity?: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Hardware and software
  hardwareUnitsAffected?: number;
  softwareLicensesAffected?: number;
  
  // Impact metrics
  affectedUsers?: number;
  estimatedDowntime?: number; // hours
  estimatedResponseHours?: number;
  dataLossGB?: number;
  recordsExposed?: number;
  
  // Business context
  annualRevenue?: number;
  marketCapitalization?: number;
  intellectualPropertyValue?: number;
  timeAdvantageYears?: number;
  
  // Threat context
  threatType?: string;
  systemCriticality?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dataClassification?: string;
  publicProfile?: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Regulatory context
  regulatoryEnvironment?: Array<'GDPR' | 'HIPAA' | 'PCI' | 'CCPA'>;
  
  // Response requirements
  requiresForensics?: boolean;
  requiresLegalReview?: boolean;
  requiresPRResponse?: boolean;
  
  // Data quality indicators
  dataQuality?: number; // 0-1
  historicalLossData?: boolean;
  expertEstimatesCount?: number;
}

export interface LossMagnitudeResult {
  primaryLoss: PrimaryLossEstimate;
  secondaryLoss: SecondaryLossEstimate;
  totalLoss: TotalLossEstimate;
  confidence: number;
  methodology: string;
  timestamp: Date;
}

export interface LossEstimate {
  minimum: number;
  mostLikely: number;
  maximum: number;
  confidence: number;
}

export interface PrimaryLossEstimate {
  productivity: LossEstimate;
  replacement: LossEstimate;
  response: LossEstimate;
  total: LossEstimate;
  components: LossComponent[];
}

export interface SecondaryLossEstimate {
  regulatory: LossEstimate;
  reputation: LossEstimate;
  competitive: LossEstimate;
  total: LossEstimate;
  components: LossComponent[];
}

export interface LossComponent extends LossEstimate {
  name: string;
}

export interface TotalLossEstimate extends LossEstimate {
  expected: number;
  standardDeviation: number;
  valueAtRisk95: number;
  conditionalValueAtRisk95: number;
}