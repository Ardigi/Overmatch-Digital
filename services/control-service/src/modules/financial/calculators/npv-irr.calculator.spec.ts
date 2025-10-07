import { NpvIrrCalculator } from './npv-irr.calculator';
import { ValidationError } from '../../../shared/errors/validation.error';

describe('NpvIrrCalculator', () => {
  let calculator: NpvIrrCalculator;

  beforeEach(() => {
    calculator = new NpvIrrCalculator();
  });

  describe('calculateNPV', () => {
    it('should calculate NPV correctly for positive cash flows', () => {
      const cashFlows = [-1000, 300, 400, 500, 600];
      const discountRate = 0.1;
      
      const npv = calculator.calculateNPV(cashFlows, discountRate);
      
      // Manual calculation:
      // NPV = -1000 + 300/1.1 + 400/1.21 + 500/1.331 + 600/1.4641
      // NPV = -1000 + 272.73 + 330.58 + 375.66 + 409.81 = 388.78
      expect(npv).toBeCloseTo(388.78, 1);
    });

    it('should calculate negative NPV for poor investments', () => {
      const cashFlows = [-5000, 1000, 1000, 1000];
      const discountRate = 0.15;
      
      const npv = calculator.calculateNPV(cashFlows, discountRate);
      
      expect(npv).toBeLessThan(0);
      expect(npv).toBeCloseTo(-2716.77, 1);
    });

    it('should handle zero discount rate', () => {
      const cashFlows = [-1000, 400, 400, 400];
      const discountRate = 0;
      
      const npv = calculator.calculateNPV(cashFlows, discountRate);
      
      expect(npv).toBe(200); // Simple sum when rate is 0
    });

    it('should throw ValidationError for invalid cash flows', () => {
      expect(() => calculator.calculateNPV([], 0.1))
        .toThrow(ValidationError);
      
      expect(() => calculator.calculateNPV(null as any, 0.1))
        .toThrow(ValidationError);
      
      expect(() => calculator.calculateNPV([0, 0, 0], 0.1))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid discount rate', () => {
      const cashFlows = [-1000, 500, 500];
      
      expect(() => calculator.calculateNPV(cashFlows, -1))
        .toThrow(ValidationError);
      
      expect(() => calculator.calculateNPV(cashFlows, NaN))
        .toThrow(ValidationError);
      
      expect(() => calculator.calculateNPV(cashFlows, 11))
        .toThrow(ValidationError);
    });
  });

  describe('calculateIRR', () => {
    it('should calculate IRR correctly for typical investment', () => {
      const cashFlows = [-1000, 400, 400, 400];
      
      const irr = calculator.calculateIRR(cashFlows);
      
      // IRR should be around 9.7%
      expect(irr).toBeCloseTo(0.097, 2);
    });

    it('should calculate high IRR for excellent investment', () => {
      const cashFlows = [-1000, 500, 600, 700];
      
      const irr = calculator.calculateIRR(cashFlows);
      
      expect(irr).toBeGreaterThan(0.3);
      expect(irr).toBeLessThan(0.5);
    });

    it('should handle zero IRR case', () => {
      const cashFlows = [-1000, 500, 500];
      
      const irr = calculator.calculateIRR(cashFlows);
      
      expect(irr).toBeCloseTo(0, 1);
    });

    it('should throw error when no IRR exists', () => {
      // All positive cash flows - no IRR exists
      const cashFlows = [1000, 1000, 1000];
      
      expect(() => calculator.calculateIRR(cashFlows))
        .toThrow(ValidationError);
    });

    it('should use binary search fallback when Newton-Raphson fails', () => {
      // Edge case that might cause Newton-Raphson to fail
      const cashFlows = [-1000, 3000, -3000, 3000];
      
      // Should not throw, should fall back to binary search
      const irr = calculator.calculateIRR(cashFlows);
      
      expect(irr).toBeDefined();
      expect(isFinite(irr)).toBe(true);
    });
  });

  describe('calculatePaybackPeriod', () => {
    it('should calculate exact payback period', () => {
      const cashFlows = [-1000, 400, 400, 400];
      
      const payback = calculator.calculatePaybackPeriod(cashFlows);
      
      expect(payback).toBe(2.5); // Pays back in exactly 2.5 years
    });

    it('should calculate fractional payback period', () => {
      const cashFlows = [-1000, 300, 400, 500];
      
      const payback = calculator.calculatePaybackPeriod(cashFlows);
      
      // 300 + 400 = 700 (need 300 more)
      // 300/500 = 0.6 of year 3
      expect(payback).toBeCloseTo(2.6, 1);
    });

    it('should return 0 for immediate payback', () => {
      const cashFlows = [1000, 500, 500];
      
      const payback = calculator.calculatePaybackPeriod(cashFlows);
      
      expect(payback).toBe(0);
    });

    it('should return Infinity for never paying back', () => {
      const cashFlows = [-1000, 100, 100, 100];
      
      const payback = calculator.calculatePaybackPeriod(cashFlows);
      
      expect(payback).toBe(Infinity);
    });
  });

  describe('calculateProfitabilityIndex', () => {
    it('should calculate PI correctly', () => {
      const cashFlows = [-1000, 400, 500, 600];
      const discountRate = 0.1;
      
      const pi = calculator.calculateProfitabilityIndex(cashFlows, discountRate);
      
      // PI = PV of future cash flows / Initial investment
      // PI = (400/1.1 + 500/1.21 + 600/1.331) / 1000
      // PI = (363.64 + 413.22 + 450.79) / 1000 = 1.228
      expect(pi).toBeCloseTo(1.228, 2);
    });

    it('should return PI < 1 for poor investments', () => {
      const cashFlows = [-1000, 300, 300, 300];
      const discountRate = 0.15;
      
      const pi = calculator.calculateProfitabilityIndex(cashFlows, discountRate);
      
      expect(pi).toBeLessThan(1);
    });

    it('should throw error for zero initial investment', () => {
      const cashFlows = [0, 500, 500];
      
      expect(() => calculator.calculateProfitabilityIndex(cashFlows, 0.1))
        .toThrow(ValidationError);
    });

    it('should throw error for insufficient cash flows', () => {
      const cashFlows = [-1000];
      
      expect(() => calculator.calculateProfitabilityIndex(cashFlows, 0.1))
        .toThrow(ValidationError);
    });
  });

  describe('calculateMIRR', () => {
    it('should calculate MIRR correctly', () => {
      const cashFlows = [-1000, -500, 800, 800, 800];
      const financeRate = 0.1;
      const reinvestmentRate = 0.12;
      
      const mirr = calculator.calculateMIRR(cashFlows, financeRate, reinvestmentRate);
      
      // MIRR accounts for different rates for borrowing and reinvestment
      expect(mirr).toBeGreaterThan(0);
      expect(mirr).toBeLessThan(0.2);
    });

    it('should handle simple cases correctly', () => {
      const cashFlows = [-1000, 600, 600];
      const financeRate = 0.1;
      const reinvestmentRate = 0.1;
      
      const mirr = calculator.calculateMIRR(cashFlows, financeRate, reinvestmentRate);
      
      expect(mirr).toBeCloseTo(0.1225, 3);
    });

    it('should throw error when no negative cash flows', () => {
      const cashFlows = [1000, 1000, 1000];
      
      expect(() => calculator.calculateMIRR(cashFlows, 0.1, 0.12))
        .toThrow(ValidationError);
    });

    it('should throw error when no positive cash flows', () => {
      const cashFlows = [-1000, -1000, -1000];
      
      expect(() => calculator.calculateMIRR(cashFlows, 0.1, 0.12))
        .toThrow(ValidationError);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very large cash flows', () => {
      const cashFlows = [-1000000000, 400000000, 400000000, 400000000];
      const discountRate = 0.1;
      
      const npv = calculator.calculateNPV(cashFlows, discountRate);
      
      expect(isFinite(npv)).toBe(true);
    });

    it('should handle very small cash flows', () => {
      const cashFlows = [-0.01, 0.005, 0.005, 0.005];
      const discountRate = 0.1;
      
      const npv = calculator.calculateNPV(cashFlows, discountRate);
      
      expect(isFinite(npv)).toBe(true);
    });

    it('should handle negative discount rates above -100%', () => {
      const cashFlows = [-1000, 500, 500, 500];
      const discountRate = -0.05; // -5% discount rate
      
      const npv = calculator.calculateNPV(cashFlows, discountRate);
      
      expect(isFinite(npv)).toBe(true);
      expect(npv).toBeGreaterThan(500); // Should be higher than with positive rate
    });

    it('should validate all inputs comprehensively', () => {
      const validCashFlows = [-1000, 500, 500];
      
      // Test various invalid inputs
      const invalidInputs = [
        { cashFlows: [Infinity, 100], rate: 0.1 },
        { cashFlows: [-Infinity, 100], rate: 0.1 },
        { cashFlows: validCashFlows, rate: Infinity },
        { cashFlows: validCashFlows, rate: -Infinity },
      ];
      
      invalidInputs.forEach(input => {
        expect(() => calculator.calculateNPV(input.cashFlows, input.rate))
          .toThrow(ValidationError);
      });
    });
  });

  describe('precision and rounding', () => {
    it('should maintain precision for financial calculations', () => {
      const cashFlows = [-10000.50, 3333.33, 3333.33, 3333.34];
      const discountRate = 0.08;
      
      const npv = calculator.calculateNPV(cashFlows, discountRate);
      
      // Should round to 2 decimal places for currency
      expect(npv.toString()).toMatch(/^\-?\d+\.\d{0,2}$/);
    });

    it('should round IRR to 4 decimal places', () => {
      const cashFlows = [-1000, 400, 400, 400];
      
      const irr = calculator.calculateIRR(cashFlows);
      const irrString = irr.toString();
      
      // Should have at most 4 decimal places
      const decimalPart = irrString.split('.')[1];
      if (decimalPart) {
        expect(decimalPart.length).toBeLessThanOrEqual(4);
      }
    });
  });
});