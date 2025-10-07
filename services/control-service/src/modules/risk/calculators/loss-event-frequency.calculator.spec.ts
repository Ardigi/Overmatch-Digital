import { LossEventFrequencyCalculator, LEFScenario, ControlConfiguration, ThreatEvent } from './loss-event-frequency.calculator';
import { ValidationError } from '../../../shared/errors/validation.error';
import { Repository } from 'typeorm';

describe('LossEventFrequencyCalculator', () => {
  let calculator: LossEventFrequencyCalculator;
  let mockThreatEventRepository: jest.Mocked<Repository<ThreatEvent>>;

  beforeEach(() => {
    // Create mock repository
    mockThreatEventRepository = {
      find: jest.fn(),
    } as any;

    calculator = new LossEventFrequencyCalculator(mockThreatEventRepository);
  });

  describe('calculate', () => {
    const validScenario: LEFScenario = {
      threatActor: 'ORGANIZED_CRIME',
      assetType: 'DATABASE',
      assetValue: 1000000,
      industry: 'FINANCIAL',
      controls: [
        {
          type: 'PREVENTIVE',
          name: 'Firewall',
          effectiveness: 0.8,
          maturityLevel: 0.7,
        },
        {
          type: 'DETECTIVE',
          name: 'IDS',
          effectiveness: 0.9,
          maturityLevel: 0.8,
        },
      ],
      dataClassification: 'CONFIDENTIAL',
      publicProfile: 'MEDIUM',
      dataQuality: 0.8,
    };

    it('should calculate LEF for typical scenario', async () => {
      mockThreatEventRepository.find.mockResolvedValue([]);

      const result = await calculator.calculate(validScenario);

      expect(result).toBeDefined();
      expect(result.threatEventFrequency).toBeDefined();
      expect(result.vulnerability).toBeDefined();
      expect(result.frequency).toBeDefined();
      expect(result.annualOccurrences).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should adjust frequency based on asset value', async () => {
      mockThreatEventRepository.find.mockResolvedValue([]);

      const lowValueScenario = { ...validScenario, assetValue: 10000 };
      const highValueScenario = { ...validScenario, assetValue: 10000000 };

      const lowResult = await calculator.calculate(lowValueScenario);
      const highResult = await calculator.calculate(highValueScenario);

      // Higher value assets should have higher threat frequency
      expect(highResult.threatEventFrequency.mostLikely).toBeGreaterThan(
        lowResult.threatEventFrequency.mostLikely
      );
    });

    it('should incorporate historical threat data', async () => {
      const historicalEvents: ThreatEvent[] = [
        {
          id: '1',
          assetType: 'DATABASE',
          threatActorType: 'ORGANIZED_CRIME',
          severity: 'HIGH',
          occurredAt: new Date(),
        },
        {
          id: '2',
          assetType: 'DATABASE',
          threatActorType: 'ORGANIZED_CRIME',
          severity: 'MEDIUM',
          occurredAt: new Date(),
        },
      ];

      mockThreatEventRepository.find.mockResolvedValue(historicalEvents);

      const result = await calculator.calculate(validScenario);

      // Should have higher confidence with historical data
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should calculate vulnerability based on controls', async () => {
      mockThreatEventRepository.find.mockResolvedValue([]);

      const weakControlsScenario: LEFScenario = {
        ...validScenario,
        controls: [
          {
            type: 'PREVENTIVE',
            name: 'Basic Auth',
            effectiveness: 0.3,
            maturityLevel: 0.2,
          },
        ],
      };

      const strongControlsScenario: LEFScenario = {
        ...validScenario,
        controls: [
          {
            type: 'PREVENTIVE',
            name: 'MFA',
            effectiveness: 0.95,
            maturityLevel: 0.9,
          },
          {
            type: 'DETECTIVE',
            name: 'SIEM',
            effectiveness: 0.9,
            maturityLevel: 0.85,
          },
          {
            type: 'CORRECTIVE',
            name: 'Auto-remediation',
            effectiveness: 0.8,
            maturityLevel: 0.8,
          },
        ],
      };

      const weakResult = await calculator.calculate(weakControlsScenario);
      const strongResult = await calculator.calculate(strongControlsScenario);

      // Weak controls should result in higher vulnerability
      expect(weakResult.vulnerability.mostLikely).toBeGreaterThan(
        strongResult.vulnerability.mostLikely
      );
    });

    it('should handle different threat actors correctly', async () => {
      mockThreatEventRepository.find.mockResolvedValue([]);

      const nationStateScenario = { ...validScenario, threatActor: 'NATION_STATE' as const };
      const opportunisticScenario = { ...validScenario, threatActor: 'OPPORTUNISTIC' as const };

      const nationStateResult = await calculator.calculate(nationStateScenario);
      const opportunisticResult = await calculator.calculate(opportunisticScenario);

      // Nation state should have higher capability but lower frequency
      expect(nationStateResult.vulnerability.threatCapability.overall).toBeGreaterThan(
        opportunisticResult.vulnerability.threatCapability.overall
      );
    });

    it('should apply industry multipliers', async () => {
      mockThreatEventRepository.find.mockResolvedValue([]);

      const financialScenario = { ...validScenario, industry: 'FINANCIAL' };
      const manufacturingScenario = { ...validScenario, industry: 'MANUFACTURING' };

      const financialResult = await calculator.calculate(financialScenario);
      const manufacturingResult = await calculator.calculate(manufacturingScenario);

      // Financial should have higher threat frequency
      expect(financialResult.threatEventFrequency.mostLikely).toBeGreaterThan(
        manufacturingResult.threatEventFrequency.mostLikely
      );
    });

    it('should handle missing historical data gracefully', async () => {
      mockThreatEventRepository.find.mockRejectedValue(new Error('Database error'));

      // Should not throw, should continue with baseline estimates
      const result = await calculator.calculate(validScenario);

      expect(result).toBeDefined();
      expect(result.annualOccurrences).toBeGreaterThan(0);
    });
  });

  describe('input validation', () => {
    it('should throw ValidationError for missing scenario', async () => {
      await expect(calculator.calculate(null as any))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for missing threat actor', async () => {
      const invalidScenario = {
        assetType: 'DATABASE',
        assetValue: 100000,
        industry: 'FINANCIAL',
        controls: [],
      } as any;

      await expect(calculator.calculate(invalidScenario))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid asset value', async () => {
      const invalidScenario: LEFScenario = {
        threatActor: 'ORGANIZED_CRIME',
        assetType: 'DATABASE',
        assetValue: -1000, // Invalid: negative
        industry: 'FINANCIAL',
        controls: [],
      };

      await expect(calculator.calculate(invalidScenario))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid control effectiveness', async () => {
      const invalidScenario: LEFScenario = {
        threatActor: 'ORGANIZED_CRIME',
        assetType: 'DATABASE',
        assetValue: 100000,
        industry: 'FINANCIAL',
        controls: [
          {
            type: 'PREVENTIVE',
            name: 'Invalid Control',
            effectiveness: 1.5, // Invalid: > 1
            maturityLevel: 0.5,
          },
        ],
      };

      await expect(calculator.calculate(invalidScenario))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for unknown threat actor', async () => {
      const invalidScenario = {
        threatActor: 'UNKNOWN_ACTOR',
        assetType: 'DATABASE',
        assetValue: 100000,
        industry: 'FINANCIAL',
        controls: [],
      } as any;

      await expect(calculator.calculate(invalidScenario))
        .rejects.toThrow(ValidationError);
    });

    it('should validate controls array', async () => {
      const invalidScenario = {
        threatActor: 'ORGANIZED_CRIME',
        assetType: 'DATABASE',
        assetValue: 100000,
        industry: 'FINANCIAL',
        controls: 'not-an-array', // Invalid
      } as any;

      await expect(calculator.calculate(invalidScenario))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('edge cases', () => {
    it('should handle zero controls', async () => {
      mockThreatEventRepository.find.mockResolvedValue([]);

      const noControlsScenario: LEFScenario = {
        threatActor: 'ORGANIZED_CRIME',
        assetType: 'DATABASE',
        assetValue: 100000,
        industry: 'FINANCIAL',
        controls: [],
      };

      const result = await calculator.calculate(noControlsScenario);

      // Should have high vulnerability with no controls
      expect(result.vulnerability.mostLikely).toBeGreaterThan(0.7);
      expect(result.vulnerability.controlStrength.overall).toBe(0);
    });

    it('should handle very high asset values', async () => {
      mockThreatEventRepository.find.mockResolvedValue([]);

      const scenario: LEFScenario = {
        threatActor: 'NATION_STATE',
        assetType: 'INTELLECTUAL_PROPERTY',
        assetValue: 1000000000, // $1 billion
        industry: 'DEFENSE',
        controls: [],
      };

      const result = await calculator.calculate(scenario);

      expect(result.annualOccurrences).toBeDefined();
      expect(isFinite(result.annualOccurrences)).toBe(true);
    });

    it('should handle insider threats differently', async () => {
      mockThreatEventRepository.find.mockResolvedValue([]);

      const maliciousInsiderScenario: LEFScenario = {
        threatActor: 'INSIDER_MALICIOUS',
        assetType: 'DATABASE',
        assetValue: 500000,
        industry: 'FINANCIAL',
        controls: [
          {
            type: 'PREVENTIVE',
            name: 'Access Control',
            effectiveness: 0.7,
            maturityLevel: 0.8,
          },
        ],
      };

      const accidentalInsiderScenario: LEFScenario = {
        ...maliciousInsiderScenario,
        threatActor: 'INSIDER_ACCIDENTAL',
      };

      const maliciousResult = await calculator.calculate(maliciousInsiderScenario);
      const accidentalResult = await calculator.calculate(accidentalInsiderScenario);

      // Accidental should have higher frequency but lower capability
      expect(accidentalResult.threatEventFrequency.mostLikely).toBeGreaterThan(
        maliciousResult.threatEventFrequency.mostLikely
      );
      expect(accidentalResult.vulnerability.threatCapability.overall).toBeLessThan(
        maliciousResult.vulnerability.threatCapability.overall
      );
    });

    it('should bound frequency estimates reasonably', async () => {
      mockThreatEventRepository.find.mockResolvedValue([]);

      const extremeScenario: LEFScenario = {
        threatActor: 'OPPORTUNISTIC',
        assetType: 'PUBLIC_WEBSITE',
        assetValue: 100000000,
        industry: 'FINANCIAL',
        controls: [],
        publicProfile: 'HIGH',
      };

      const result = await calculator.calculate(extremeScenario);

      // Should have reasonable bounds even with extreme inputs
      expect(result.frequency.max).toBeLessThan(100000); // Not infinite
      expect(result.frequency.min).toBeGreaterThan(0); // Not zero
    });
  });

  describe('confidence calculation', () => {
    it('should increase confidence with more controls', async () => {
      mockThreatEventRepository.find.mockResolvedValue([]);

      const fewControlsScenario: LEFScenario = {
        threatActor: 'ORGANIZED_CRIME',
        assetType: 'DATABASE',
        assetValue: 100000,
        industry: 'FINANCIAL',
        controls: [
          {
            type: 'PREVENTIVE',
            name: 'Firewall',
            effectiveness: 0.7,
          },
        ],
        dataQuality: 0.5,
      };

      const manyControlsScenario: LEFScenario = {
        ...fewControlsScenario,
        controls: [
          { type: 'PREVENTIVE', name: 'Firewall', effectiveness: 0.7 },
          { type: 'PREVENTIVE', name: 'IPS', effectiveness: 0.8 },
          { type: 'DETECTIVE', name: 'SIEM', effectiveness: 0.9 },
          { type: 'DETECTIVE', name: 'EDR', effectiveness: 0.85 },
          { type: 'CORRECTIVE', name: 'Backup', effectiveness: 0.95 },
          { type: 'CORRECTIVE', name: 'IR Plan', effectiveness: 0.8 },
        ],
        dataQuality: 0.9,
      };

      const fewResult = await calculator.calculate(fewControlsScenario);
      const manyResult = await calculator.calculate(manyControlsScenario);

      expect(manyResult.confidence).toBeGreaterThan(fewResult.confidence);
    });

    it('should reflect data quality in confidence', async () => {
      mockThreatEventRepository.find.mockResolvedValue([]);

      const lowQualityScenario: LEFScenario = {
        threatActor: 'ORGANIZED_CRIME',
        assetType: 'DATABASE',
        assetValue: 100000,
        industry: 'FINANCIAL',
        controls: [],
        dataQuality: 0.2,
      };

      const highQualityScenario: LEFScenario = {
        ...lowQualityScenario,
        dataQuality: 0.95,
      };

      const lowResult = await calculator.calculate(lowQualityScenario);
      const highResult = await calculator.calculate(highQualityScenario);

      expect(highResult.confidence).toBeGreaterThan(lowResult.confidence);
    });
  });

  describe('control strength assessment', () => {
    it('should weight preventive controls higher', async () => {
      mockThreatEventRepository.find.mockResolvedValue([]);

      const preventiveScenario: LEFScenario = {
        threatActor: 'ORGANIZED_CRIME',
        assetType: 'DATABASE',
        assetValue: 100000,
        industry: 'FINANCIAL',
        controls: [
          {
            type: 'PREVENTIVE',
            name: 'Strong Preventive',
            effectiveness: 0.8,
            maturityLevel: 0.8,
          },
        ],
      };

      const detectiveScenario: LEFScenario = {
        ...preventiveScenario,
        controls: [
          {
            type: 'DETECTIVE',
            name: 'Strong Detective',
            effectiveness: 0.8,
            maturityLevel: 0.8,
          },
        ],
      };

      const preventiveResult = await calculator.calculate(preventiveScenario);
      const detectiveResult = await calculator.calculate(detectiveScenario);

      // Preventive controls should reduce vulnerability more
      expect(preventiveResult.vulnerability.mostLikely).toBeLessThan(
        detectiveResult.vulnerability.mostLikely
      );
    });

    it('should combine control types effectively', async () => {
      mockThreatEventRepository.find.mockResolvedValue([]);

      const scenario: LEFScenario = {
        threatActor: 'ORGANIZED_CRIME',
        assetType: 'DATABASE',
        assetValue: 100000,
        industry: 'FINANCIAL',
        controls: [
          {
            type: 'PREVENTIVE',
            name: 'MFA',
            effectiveness: 0.9,
            maturityLevel: 0.85,
          },
          {
            type: 'DETECTIVE',
            name: 'SIEM',
            effectiveness: 0.85,
            maturityLevel: 0.8,
          },
          {
            type: 'CORRECTIVE',
            name: 'Auto-block',
            effectiveness: 0.8,
            maturityLevel: 0.75,
          },
        ],
      };

      const result = await calculator.calculate(scenario);

      // Should have balanced control strength scores
      expect(result.vulnerability.controlStrength.preventive).toBeGreaterThan(0);
      expect(result.vulnerability.controlStrength.detective).toBeGreaterThan(0);
      expect(result.vulnerability.controlStrength.corrective).toBeGreaterThan(0);
      expect(result.vulnerability.controlStrength.overall).toBeGreaterThan(0.5);
    });
  });
});