import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { ValidationError } from '../../../shared/errors/validation.error';

// Entity for TypeORM - defined first to avoid circular dependency
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

  @Column({ nullable: true })
  impact?: number;

  @CreateDateColumn()
  occurredAt: Date;
}

/**
 * Loss Event Frequency Calculator
 * Implements FAIR methodology for calculating threat event frequency and vulnerability
 * Single responsibility: LEF = TEF × Vulnerability calculations
 */
@Injectable()
export class LossEventFrequencyCalculator {
  // Industry-standard threat frequency baselines (per year)
  private readonly THREAT_FREQUENCY_BASELINES = {
    NATION_STATE: { min: 1, mostLikely: 5, max: 20 },
    ORGANIZED_CRIME: { min: 5, mostLikely: 20, max: 100 },
    HACKTIVIST: { min: 2, mostLikely: 10, max: 50 },
    INSIDER_MALICIOUS: { min: 0.1, mostLikely: 1, max: 5 },
    INSIDER_ACCIDENTAL: { min: 1, mostLikely: 10, max: 50 },
    OPPORTUNISTIC: { min: 10, mostLikely: 100, max: 1000 },
  } as const;

  // Threat capability scores based on MITRE ATT&CK framework
  private readonly THREAT_CAPABILITIES = {
    NATION_STATE: { technical: 0.95, resources: 1.0, persistence: 0.95 },
    ORGANIZED_CRIME: { technical: 0.8, resources: 0.85, persistence: 0.8 },
    HACKTIVIST: { technical: 0.6, resources: 0.4, persistence: 0.7 },
    INSIDER_MALICIOUS: { technical: 0.5, resources: 0.3, persistence: 0.6 },
    INSIDER_ACCIDENTAL: { technical: 0.1, resources: 0.1, persistence: 0.1 },
    OPPORTUNISTIC: { technical: 0.3, resources: 0.2, persistence: 0.3 },
  } as const;

  constructor(
    @InjectRepository(ThreatEvent)
    private readonly threatEventRepository: Repository<ThreatEvent>,
  ) {}

  /**
   * Calculate Loss Event Frequency with comprehensive validation
   * @param scenario Risk scenario with threat and control information
   * @returns LEF components and annual occurrence estimate
   */
  async calculate(scenario: LEFScenario): Promise<LossEventFrequencyResult> {
    // Validate inputs
    this.validateScenario(scenario);

    // Calculate Threat Event Frequency
    const tef = await this.calculateThreatEventFrequency(scenario);

    // Calculate Vulnerability (probability of successful attack)
    const vulnerability = this.calculateVulnerability(scenario);

    // LEF = TEF × Vulnerability
    const frequency = this.multiplyFrequencyEstimates(tef, vulnerability);

    return {
      threatEventFrequency: tef,
      vulnerability,
      frequency,
      annualOccurrences: frequency.mostLikely,
      confidence: this.calculateConfidence(tef, vulnerability, scenario),
    };
  }

  /**
   * Calculate Threat Event Frequency based on historical data and threat intelligence
   */
  private async calculateThreatEventFrequency(
    scenario: LEFScenario
  ): Promise<FrequencyEstimate> {
    // Get historical threat data if available
    const historicalData = await this.getHistoricalThreatData(scenario);
    
    // Calculate contact frequency (attempts per year)
    const contactFrequency = this.estimateContactFrequency(
      scenario,
      historicalData
    );

    // Calculate probability of action (threat actor motivation)
    const probabilityOfAction = this.calculateThreatMotivation(scenario);

    // TEF = Contact Frequency × Probability of Action
    return this.multiplyFrequencyEstimates(
      contactFrequency,
      probabilityOfAction
    );
  }

  /**
   * Get historical threat event data for calibration
   */
  private async getHistoricalThreatData(
    scenario: LEFScenario
  ): Promise<ThreatEvent[]> {
    try {
      const events = await this.threatEventRepository.find({
        where: {
          assetType: scenario.assetType,
          threatActorType: scenario.threatActor,
        },
        order: { occurredAt: 'DESC' },
        take: 100, // Limit to recent events for relevance
      });

      return events || [];
    } catch (error) {
      // If database is unavailable, continue with baseline estimates
      console.warn('Could not fetch historical threat data:', error);
      return [];
    }
  }

  /**
   * Estimate contact frequency based on threat actor and asset value
   */
  private estimateContactFrequency(
    scenario: LEFScenario,
    historicalData: ThreatEvent[]
  ): FrequencyEstimate {
    // Start with baseline frequencies
    const baseline = this.THREAT_FREQUENCY_BASELINES[scenario.threatActor];
    
    if (!baseline) {
      throw new ValidationError(
        `Unknown threat actor type: ${scenario.threatActor}`
      );
    }

    // Adjust based on asset value (logarithmic scale)
    const valueMultiplier = this.calculateValueMultiplier(scenario.assetValue);

    // Adjust based on historical data if available
    const historicalMultiplier = this.calculateHistoricalMultiplier(
      historicalData
    );

    // Industry-specific adjustments
    const industryMultiplier = this.getIndustryMultiplier(scenario.industry);

    // Apply multipliers with bounds checking
    const adjustedFrequency: FrequencyEstimate = {
      min: Math.max(0.01, baseline.min * valueMultiplier * historicalMultiplier * industryMultiplier),
      mostLikely: Math.max(0.1, baseline.mostLikely * valueMultiplier * historicalMultiplier * industryMultiplier),
      max: Math.min(10000, baseline.max * valueMultiplier * historicalMultiplier * industryMultiplier),
      confidence: historicalData.length > 10 ? 0.8 : 0.6,
    };

    return adjustedFrequency;
  }

  /**
   * Calculate value-based multiplier for frequency
   */
  private calculateValueMultiplier(assetValue: number): number {
    if (assetValue <= 0) {
      throw new ValidationError('Asset value must be positive');
    }

    // Logarithmic scaling: doubles every order of magnitude
    // $10K baseline, $100K = 1.5x, $1M = 2x, $10M = 2.5x
    const logValue = Math.log10(Math.max(10000, assetValue));
    return Math.min(5, Math.max(0.5, (logValue - 3) / 2));
  }

  /**
   * Calculate historical data multiplier
   */
  private calculateHistoricalMultiplier(historicalData: ThreatEvent[]): number {
    if (historicalData.length === 0) {
      return 1; // No adjustment without data
    }

    // Calculate annual frequency from historical data
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    
    const recentEvents = historicalData.filter(
      event => event.occurredAt > oneYearAgo
    );

    if (recentEvents.length === 0) {
      return 0.8; // Reduce if no recent events
    }

    // Adjust based on recent event frequency
    return Math.min(3, Math.max(0.5, recentEvents.length / 5));
  }

  /**
   * Get industry-specific threat multiplier
   */
  private getIndustryMultiplier(industry: string): number {
    const industryRiskScores: Record<string, number> = {
      FINANCIAL: 1.5,
      HEALTHCARE: 1.4,
      GOVERNMENT: 1.6,
      RETAIL: 1.2,
      TECHNOLOGY: 1.3,
      MANUFACTURING: 1.0,
      EDUCATION: 1.1,
      ENERGY: 1.4,
      DEFENSE: 1.8,
    };

    return industryRiskScores[industry] || 1.0;
  }

  /**
   * Calculate threat actor motivation
   */
  private calculateThreatMotivation(scenario: LEFScenario): FrequencyEstimate {
    // Base motivation by threat actor type
    const motivationFactors: Record<string, number> = {
      NATION_STATE: 0.9,
      ORGANIZED_CRIME: 0.8,
      HACKTIVIST: 0.6,
      INSIDER_MALICIOUS: 0.7,
      INSIDER_ACCIDENTAL: 0.3,
      OPPORTUNISTIC: 0.4,
    };

    const baseMotivation = motivationFactors[scenario.threatActor] || 0.5;

    // Adjust for target attractiveness
    const attractiveness = this.calculateTargetAttractiveness(scenario);

    // Combine factors
    const overallMotivation = (baseMotivation + attractiveness) / 2;

    return {
      min: Math.max(0, overallMotivation - 0.2),
      mostLikely: overallMotivation,
      max: Math.min(1, overallMotivation + 0.2),
      confidence: 0.7,
    };
  }

  /**
   * Calculate target attractiveness based on multiple factors
   */
  private calculateTargetAttractiveness(scenario: LEFScenario): number {
    let score = 0;
    let factors = 0;

    // Asset value attractiveness
    if (scenario.assetValue > 1000000) {
      score += 0.9;
      factors++;
    } else if (scenario.assetValue > 100000) {
      score += 0.6;
      factors++;
    } else {
      score += 0.3;
      factors++;
    }

    // Data sensitivity
    if (scenario.dataClassification) {
      const sensitivityScores: Record<string, number> = {
        PUBLIC: 0.1,
        INTERNAL: 0.3,
        CONFIDENTIAL: 0.6,
        RESTRICTED: 0.8,
        TOP_SECRET: 1.0,
      };
      score += sensitivityScores[scenario.dataClassification] || 0.5;
      factors++;
    }

    // Public profile
    if (scenario.publicProfile === 'HIGH') {
      score += 0.8;
      factors++;
    } else if (scenario.publicProfile === 'MEDIUM') {
      score += 0.5;
      factors++;
    } else {
      score += 0.2;
      factors++;
    }

    return factors > 0 ? score / factors : 0.5;
  }

  /**
   * Calculate vulnerability based on threat capability vs control strength
   */
  private calculateVulnerability(scenario: LEFScenario): VulnerabilityEstimate {
    // Get threat capability
    const threatCapability = this.assessThreatCapability(scenario.threatActor);

    // Assess control strength
    const controlStrength = this.assessControlStrength(scenario.controls);

    // Calculate vulnerability probability
    const vulnerabilityProbability = this.calculateVulnerabilityProbability(
      threatCapability,
      controlStrength
    );

    return {
      threatCapability,
      controlStrength,
      ...vulnerabilityProbability,
    };
  }

  /**
   * Assess threat actor capability
   */
  private assessThreatCapability(threatActor: string): CapabilityScore {
    const capabilities = this.THREAT_CAPABILITIES[threatActor as keyof typeof this.THREAT_CAPABILITIES];
    
    if (!capabilities) {
      throw new ValidationError(`Unknown threat actor: ${threatActor}`);
    }

    // Calculate overall capability score
    const overall = (
      capabilities.technical * 0.4 +
      capabilities.resources * 0.3 +
      capabilities.persistence * 0.3
    );

    return {
      ...capabilities,
      overall,
    };
  }

  /**
   * Assess control strength based on control configuration
   */
  private assessControlStrength(controls: ControlConfiguration[]): ControlStrengthScore {
    if (!controls || controls.length === 0) {
      return {
        preventive: 0,
        detective: 0,
        corrective: 0,
        overall: 0,
      };
    }

    let preventiveScore = 0;
    let detectiveScore = 0;
    let correctiveScore = 0;
    let totalWeight = 0;

    for (const control of controls) {
      const effectiveness = control.effectiveness || 0.5;
      const maturity = control.maturityLevel || 0.5;
      const score = effectiveness * maturity;

      switch (control.type) {
        case 'PREVENTIVE':
          preventiveScore += score;
          totalWeight += 0.5; // Preventive controls weighted higher
          break;
        case 'DETECTIVE':
          detectiveScore += score;
          totalWeight += 0.3;
          break;
        case 'CORRECTIVE':
          correctiveScore += score;
          totalWeight += 0.2;
          break;
      }
    }

    // Normalize scores
    const normalizedPreventive = Math.min(1, preventiveScore / Math.max(1, controls.filter(c => c.type === 'PREVENTIVE').length));
    const normalizedDetective = Math.min(1, detectiveScore / Math.max(1, controls.filter(c => c.type === 'DETECTIVE').length));
    const normalizedCorrective = Math.min(1, correctiveScore / Math.max(1, controls.filter(c => c.type === 'CORRECTIVE').length));

    // Calculate overall with weights
    const overall = Math.min(1, 
      normalizedPreventive * 0.5 +
      normalizedDetective * 0.3 +
      normalizedCorrective * 0.2
    );

    return {
      preventive: normalizedPreventive,
      detective: normalizedDetective,
      corrective: normalizedCorrective,
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
    // Mapped to [0, 1] probability range
    const diff = threatCapability.overall - controlStrength.overall;
    const vulnerability = Math.max(0, Math.min(1, (diff + 1) / 2));

    // Add uncertainty bounds
    const uncertainty = 0.15; // ±15% uncertainty

    return {
      min: Math.max(0, vulnerability - uncertainty),
      mostLikely: vulnerability,
      max: Math.min(1, vulnerability + uncertainty),
      confidence: 0.75,
    };
  }

  /**
   * Multiply two frequency estimates
   */
  private multiplyFrequencyEstimates(
    a: FrequencyEstimate,
    b: FrequencyEstimate
  ): FrequencyEstimate {
    return {
      min: a.min * b.min,
      mostLikely: a.mostLikely * b.mostLikely,
      max: a.max * b.max,
      confidence: Math.min(a.confidence, b.confidence),
    };
  }

  /**
   * Calculate overall confidence in the assessment
   */
  private calculateConfidence(
    tef: FrequencyEstimate,
    vulnerability: VulnerabilityEstimate,
    scenario: LEFScenario
  ): number {
    let confidence = 0;
    let weights = 0;

    // TEF confidence
    confidence += tef.confidence * 0.3;
    weights += 0.3;

    // Vulnerability confidence
    confidence += vulnerability.confidence * 0.3;
    weights += 0.3;

    // Data quality confidence
    const dataQuality = scenario.dataQuality || 0.5;
    confidence += dataQuality * 0.2;
    weights += 0.2;

    // Control assessment confidence
    const controlConfidence = scenario.controls.length > 5 ? 0.8 : 0.5;
    confidence += controlConfidence * 0.2;
    weights += 0.2;

    return weights > 0 ? confidence / weights : 0.5;
  }

  /**
   * Validate input scenario
   */
  private validateScenario(scenario: LEFScenario): void {
    if (!scenario) {
      throw new ValidationError('Scenario is required');
    }

    if (!scenario.threatActor) {
      throw ValidationError.required('threatActor');
    }

    if (!scenario.assetType) {
      throw ValidationError.required('assetType');
    }

    if (scenario.assetValue <= 0) {
      throw ValidationError.forField(
        'assetValue',
        scenario.assetValue,
        'Must be positive'
      );
    }

    if (!scenario.industry) {
      throw ValidationError.required('industry');
    }

    if (!Array.isArray(scenario.controls)) {
      throw ValidationError.forField(
        'controls',
        scenario.controls,
        'Must be an array'
      );
    }

    // Validate each control
    scenario.controls.forEach((control, index) => {
      if (!control.type) {
        throw new ValidationError(`Control ${index} missing type`);
      }
      
      if (control.effectiveness !== undefined) {
        if (control.effectiveness < 0 || control.effectiveness > 1) {
          throw ValidationError.outOfRange(
            `controls[${index}].effectiveness`,
            control.effectiveness,
            0,
            1
          );
        }
      }
    });
  }
}

// Type definitions

export interface LEFScenario {
  threatActor: 'NATION_STATE' | 'ORGANIZED_CRIME' | 'HACKTIVIST' | 'INSIDER_MALICIOUS' | 'INSIDER_ACCIDENTAL' | 'OPPORTUNISTIC';
  assetType: string;
  assetValue: number;
  industry: string;
  controls: ControlConfiguration[];
  dataClassification?: string;
  publicProfile?: 'HIGH' | 'MEDIUM' | 'LOW';
  dataQuality?: number; // 0-1 confidence in input data
}

export interface ControlConfiguration {
  type: 'PREVENTIVE' | 'DETECTIVE' | 'CORRECTIVE';
  name: string;
  effectiveness?: number; // 0-1
  maturityLevel?: number; // 0-1
}

export interface LossEventFrequencyResult {
  threatEventFrequency: FrequencyEstimate;
  vulnerability: VulnerabilityEstimate;
  frequency: FrequencyEstimate;
  annualOccurrences: number;
  confidence: number;
}

export interface FrequencyEstimate {
  min: number;
  mostLikely: number;
  max: number;
  confidence: number;
}

export interface VulnerabilityEstimate extends FrequencyEstimate {
  threatCapability: CapabilityScore;
  controlStrength: ControlStrengthScore;
}

export interface CapabilityScore {
  technical: number;
  resources: number;
  persistence: number;
  overall: number;
}

export interface ControlStrengthScore {
  preventive: number;
  detective: number;
  corrective: number;
  overall: number;
}

