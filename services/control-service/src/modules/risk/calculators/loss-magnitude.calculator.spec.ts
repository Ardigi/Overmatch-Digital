import { LossMagnitudeCalculator, LossMagnitudeScenario } from './loss-magnitude.calculator';
import { ValidationError } from '../../../shared/errors/validation.error';

describe('LossMagnitudeCalculator', () => {
  let calculator: LossMagnitudeCalculator;

  beforeEach(() => {
    calculator = new LossMagnitudeCalculator();
  });

  describe('calculate', () => {
    const validScenario: LossMagnitudeScenario = {
      assetType: 'CUSTOMER_DATABASE',
      assetReplacementValue: 100000,
      assetComplexity: 'MEDIUM',
      affectedUsers: 1000,
      estimatedDowntime: 24,
      estimatedResponseHours: 80,
      dataLossGB: 100,
      recordsExposed: 50000,
      annualRevenue: 10000000,
      marketCapitalization: 50000000,
      intellectualPropertyValue: 500000,
      timeAdvantageYears: 2,
      threatType: 'ORGANIZED_CRIME',
      systemCriticality: 'HIGH',
      dataClassification: 'CONFIDENTIAL',
      publicProfile: 'MEDIUM',
      regulatoryEnvironment: ['GDPR', 'CCPA'],
      requiresForensics: true,
      requiresLegalReview: true,
      requiresPRResponse: false,
      dataQuality: 0.8,
      historicalLossData: true,
      expertEstimatesCount: 3,
    };

    it('should calculate comprehensive loss magnitude', async () => {
      const result = await calculator.calculate(validScenario);

      expect(result).toBeDefined();
      expect(result.primaryLoss).toBeDefined();
      expect(result.secondaryLoss).toBeDefined();
      expect(result.totalLoss).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.methodology).toBe('FAIR');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should calculate primary loss components', async () => {
      const result = await calculator.calculate(validScenario);

      expect(result.primaryLoss.productivity).toBeDefined();
      expect(result.primaryLoss.replacement).toBeDefined();
      expect(result.primaryLoss.response).toBeDefined();
      expect(result.primaryLoss.total).toBeDefined();
      expect(result.primaryLoss.components).toHaveLength(3);

      // Verify loss estimates have proper structure
      expect(result.primaryLoss.productivity.minimum).toBeLessThanOrEqual(
        result.primaryLoss.productivity.mostLikely
      );
      expect(result.primaryLoss.productivity.mostLikely).toBeLessThanOrEqual(
        result.primaryLoss.productivity.maximum
      );
    });

    it('should calculate secondary loss components', async () => {
      const result = await calculator.calculate(validScenario);

      expect(result.secondaryLoss.regulatory).toBeDefined();
      expect(result.secondaryLoss.reputation).toBeDefined();
      expect(result.secondaryLoss.competitive).toBeDefined();
      expect(result.secondaryLoss.total).toBeDefined();
      expect(result.secondaryLoss.components).toHaveLength(3);
    });

    it('should calculate total loss with risk metrics', async () => {
      const result = await calculator.calculate(validScenario);

      expect(result.totalLoss.minimum).toBeDefined();
      expect(result.totalLoss.mostLikely).toBeDefined();
      expect(result.totalLoss.maximum).toBeDefined();
      expect(result.totalLoss.expected).toBeDefined();
      expect(result.totalLoss.standardDeviation).toBeDefined();
      expect(result.totalLoss.valueAtRisk95).toBeDefined();
      expect(result.totalLoss.conditionalValueAtRisk95).toBeDefined();

      // VaR should be greater than expected value
      expect(result.totalLoss.valueAtRisk95).toBeGreaterThan(result.totalLoss.expected);
      expect(result.totalLoss.conditionalValueAtRisk95).toBeGreaterThan(
        result.totalLoss.valueAtRisk95
      );
    });

    it('should scale productivity loss with criticality', async () => {
      const lowCriticalityScenario = {
        ...validScenario,
        systemCriticality: 'LOW' as const,
      };
      const criticalScenario = {
        ...validScenario,
        systemCriticality: 'CRITICAL' as const,
      };

      const lowResult = await calculator.calculate(lowCriticalityScenario);
      const criticalResult = await calculator.calculate(criticalScenario);

      expect(criticalResult.primaryLoss.productivity.mostLikely).toBeGreaterThan(
        lowResult.primaryLoss.productivity.mostLikely
      );
    });

    it('should calculate regulatory fines based on records exposed', async () => {
      const noRecordsScenario = {
        ...validScenario,
        recordsExposed: 0,
      };
      const manyRecordsScenario = {
        ...validScenario,
        recordsExposed: 1000000,
      };

      const noRecordsResult = await calculator.calculate(noRecordsScenario);
      const manyRecordsResult = await calculator.calculate(manyRecordsScenario);

      expect(noRecordsResult.secondaryLoss.regulatory.maximum).toBe(0);
      expect(manyRecordsResult.secondaryLoss.regulatory.maximum).toBeGreaterThan(0);
    });

    it('should cap regulatory fines at percentage of revenue', async () => {
      const scenario = {
        ...validScenario,
        recordsExposed: 10000000, // 10 million records
        annualRevenue: 1000000, // $1M revenue
      };

      const result = await calculator.calculate(scenario);

      // Should be capped at 4% of revenue (GDPR max)
      const maxFine = scenario.annualRevenue * 0.04;
      expect(result.secondaryLoss.regulatory.maximum).toBeLessThanOrEqual(maxFine);
    });

    it('should calculate reputation damage based on public profile', async () => {
      const lowProfileScenario = {
        ...validScenario,
        publicProfile: 'LOW' as const,
      };
      const highProfileScenario = {
        ...validScenario,
        publicProfile: 'HIGH' as const,
      };

      const lowResult = await calculator.calculate(lowProfileScenario);
      const highResult = await calculator.calculate(highProfileScenario);

      expect(highResult.secondaryLoss.reputation.mostLikely).toBeGreaterThan(
        lowResult.secondaryLoss.reputation.mostLikely
      );
    });

    it('should calculate competitive disadvantage for IP theft', async () => {
      const noIPScenario = {
        ...validScenario,
        intellectualPropertyValue: 0,
      };
      const highIPScenario = {
        ...validScenario,
        intellectualPropertyValue: 5000000,
        threatType: 'COMPETITOR',
      };

      const noIPResult = await calculator.calculate(noIPScenario);
      const highIPResult = await calculator.calculate(highIPScenario);

      expect(noIPResult.secondaryLoss.competitive.maximum).toBe(0);
      expect(highIPResult.secondaryLoss.competitive.maximum).toBeGreaterThan(0);
    });

    it('should increase confidence with better data quality', async () => {
      const poorDataScenario = {
        ...validScenario,
        dataQuality: 0.2,
        historicalLossData: false,
        expertEstimatesCount: 0,
      };
      const goodDataScenario = {
        ...validScenario,
        dataQuality: 0.95,
        historicalLossData: true,
        expertEstimatesCount: 10,
      };

      const poorResult = await calculator.calculate(poorDataScenario);
      const goodResult = await calculator.calculate(goodDataScenario);

      expect(goodResult.confidence).toBeGreaterThan(poorResult.confidence);
    });

    it('should handle minimal scenario', async () => {
      const minimalScenario: LossMagnitudeScenario = {
        assetType: 'SERVER',
      };

      const result = await calculator.calculate(minimalScenario);

      expect(result).toBeDefined();
      expect(result.totalLoss.maximum).toBeGreaterThanOrEqual(0);
    });
  });

  describe('input validation', () => {
    it('should throw ValidationError for missing scenario', async () => {
      await expect(calculator.calculate(null as any))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for missing asset type', async () => {
      const invalidScenario = {} as LossMagnitudeScenario;

      await expect(calculator.calculate(invalidScenario))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for negative values', async () => {
      const invalidScenario: LossMagnitudeScenario = {
        assetType: 'DATABASE',
        affectedUsers: -100, // Invalid: negative
      };

      await expect(calculator.calculate(invalidScenario))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid data quality', async () => {
      const invalidScenario: LossMagnitudeScenario = {
        assetType: 'DATABASE',
        dataQuality: 1.5, // Invalid: > 1
      };

      await expect(calculator.calculate(invalidScenario))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid system criticality', async () => {
      const invalidScenario: LossMagnitudeScenario = {
        assetType: 'DATABASE',
        systemCriticality: 'INVALID' as any,
      };

      await expect(calculator.calculate(invalidScenario))
        .rejects.toThrow(ValidationError);
    });

    it('should validate all numeric fields', async () => {
      const invalidScenario: LossMagnitudeScenario = {
        assetType: 'DATABASE',
        affectedUsers: Infinity, // Invalid
      };

      await expect(calculator.calculate(invalidScenario))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('edge cases', () => {
    it('should handle zero downtime scenario', async () => {
      const scenario: LossMagnitudeScenario = {
        assetType: 'DATABASE',
        estimatedDowntime: 0,
        affectedUsers: 1000,
      };

      const result = await calculator.calculate(scenario);

      expect(result.primaryLoss.productivity.mostLikely).toBe(0);
    });

    it('should handle no regulatory environment', async () => {
      const scenario: LossMagnitudeScenario = {
        assetType: 'DATABASE',
        recordsExposed: 10000,
        regulatoryEnvironment: [],
      };

      const result = await calculator.calculate(scenario);

      expect(result.secondaryLoss.regulatory.maximum).toBe(0);
    });

    it('should handle very large losses', async () => {
      const scenario: LossMagnitudeScenario = {
        assetType: 'CRITICAL_INFRASTRUCTURE',
        assetReplacementValue: 1000000000, // $1 billion
        annualRevenue: 10000000000, // $10 billion
        marketCapitalization: 100000000000, // $100 billion
        recordsExposed: 100000000, // 100 million records
        systemCriticality: 'CRITICAL',
        regulatoryEnvironment: ['GDPR', 'CCPA', 'HIPAA', 'PCI'],
      };

      const result = await calculator.calculate(scenario);

      expect(isFinite(result.totalLoss.maximum)).toBe(true);
      expect(result.totalLoss.maximum).toBeGreaterThan(0);
    });

    it('should handle nation state threats differently', async () => {
      const criminalScenario: LossMagnitudeScenario = {
        assetType: 'IP',
        intellectualPropertyValue: 1000000,
        threatType: 'ORGANIZED_CRIME',
      };

      const nationStateScenario: LossMagnitudeScenario = {
        assetType: 'IP',
        intellectualPropertyValue: 1000000,
        threatType: 'NATION_STATE',
      };

      const criminalResult = await calculator.calculate(criminalScenario);
      const nationStateResult = await calculator.calculate(nationStateScenario);

      // Nation state should have higher competitive loss factor
      expect(nationStateResult.secondaryLoss.competitive.mostLikely).toBeGreaterThan(
        criminalResult.secondaryLoss.competitive.mostLikely
      );
    });

    it('should handle all response types', async () => {
      const fullResponseScenario: LossMagnitudeScenario = {
        assetType: 'DATABASE',
        estimatedResponseHours: 200,
        requiresForensics: true,
        requiresLegalReview: true,
        requiresPRResponse: true,
      };

      const result = await calculator.calculate(fullResponseScenario);

      // Should include all response costs
      expect(result.primaryLoss.response.mostLikely).toBeGreaterThan(100000);
    });

    it('should calculate PERT expected value correctly', async () => {
      const scenario: LossMagnitudeScenario = {
        assetType: 'DATABASE',
        assetReplacementValue: 100000,
      };

      const result = await calculator.calculate(scenario);

      // PERT formula: (min + 4*likely + max) / 6
      const expectedPERT = (
        result.totalLoss.minimum +
        4 * result.totalLoss.mostLikely +
        result.totalLoss.maximum
      ) / 6;

      expect(result.totalLoss.expected).toBeCloseTo(expectedPERT, 2);
    });

    it('should handle public company stock impact', async () => {
      const privateCompanyScenario: LossMagnitudeScenario = {
        assetType: 'DATABASE',
        annualRevenue: 10000000,
        marketCapitalization: 0,
      };

      const publicCompanyScenario: LossMagnitudeScenario = {
        assetType: 'DATABASE',
        annualRevenue: 10000000,
        marketCapitalization: 100000000,
      };

      const privateResult = await calculator.calculate(privateCompanyScenario);
      const publicResult = await calculator.calculate(publicCompanyScenario);

      // Public company should have additional reputation damage from stock impact
      expect(publicResult.secondaryLoss.reputation.mostLikely).toBeGreaterThan(
        privateResult.secondaryLoss.reputation.mostLikely
      );
    });

    it('should aggregate component losses correctly', async () => {
      const scenario: LossMagnitudeScenario = {
        assetType: 'DATABASE',
        affectedUsers: 100,
        estimatedDowntime: 10,
        dataLossGB: 50,
        assetReplacementValue: 50000,
      };

      const result = await calculator.calculate(scenario);

      // Total should be sum of components
      const componentSum = 
        result.primaryLoss.productivity.mostLikely +
        result.primaryLoss.replacement.mostLikely +
        result.primaryLoss.response.mostLikely;

      expect(result.primaryLoss.total.mostLikely).toBeCloseTo(componentSum, 2);
    });
  });

  describe('confidence calculations', () => {
    it('should weight confidence by contribution', async () => {
      const scenario: LossMagnitudeScenario = {
        assetType: 'DATABASE',
        assetReplacementValue: 1000000, // High confidence (historical data)
        estimatedResponseHours: 10, // Lower confidence (expert judgment)
      };

      const result = await calculator.calculate(scenario);

      // Primary loss confidence should be weighted toward replacement cost
      expect(result.primaryLoss.total.confidence).toBeGreaterThan(0.6);
    });

    it('should reflect enforcement probability in fines', async () => {
      const lowRiskScenario: LossMagnitudeScenario = {
        assetType: 'DATABASE',
        recordsExposed: 100, // Few records
        dataClassification: 'PUBLIC',
        publicProfile: 'LOW',
        regulatoryEnvironment: ['GDPR'],
        annualRevenue: 1000000,
      };

      const highRiskScenario: LossMagnitudeScenario = {
        assetType: 'DATABASE',
        recordsExposed: 1000000, // Many records
        dataClassification: 'TOP_SECRET',
        publicProfile: 'HIGH',
        regulatoryEnvironment: ['GDPR'],
        annualRevenue: 1000000,
      };

      const lowResult = await calculator.calculate(lowRiskScenario);
      const highResult = await calculator.calculate(highRiskScenario);

      // High risk should have higher absolute expected fines
      expect(highResult.secondaryLoss.regulatory.mostLikely).toBeGreaterThan(
        lowResult.secondaryLoss.regulatory.mostLikely
      );
      
      // And the maximum fine should be much higher
      expect(highResult.secondaryLoss.regulatory.maximum).toBeGreaterThan(
        lowResult.secondaryLoss.regulatory.maximum * 10
      );
    });
  });
});