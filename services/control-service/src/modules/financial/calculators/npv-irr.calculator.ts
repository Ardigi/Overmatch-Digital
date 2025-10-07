import { Injectable } from '@nestjs/common';
import { ValidationError } from '../../../shared/errors/validation.error';

/**
 * NPV and IRR Calculator
 * Focused service for Net Present Value and Internal Rate of Return calculations
 * Single responsibility: Time value of money calculations
 */
@Injectable()
export class NpvIrrCalculator {
  private readonly MAX_IRR_ITERATIONS = 100;
  private readonly IRR_TOLERANCE = 0.00001;
  private readonly MIN_DISCOUNT_RATE = -0.99;
  private readonly MAX_DISCOUNT_RATE = 10;

  /**
   * Calculate Net Present Value with input validation
   * @param cashFlows Array of cash flows [initial investment (negative), year1, year2, ...]
   * @param discountRate Annual discount rate (e.g., 0.08 for 8%)
   * @throws ValidationError if inputs are invalid
   */
  calculateNPV(cashFlows: number[], discountRate: number): number {
    // Input validation
    this.validateCashFlows(cashFlows);
    this.validateDiscountRate(discountRate);

    let npv = 0;
    
    for (let t = 0; t < cashFlows.length; t++) {
      const discountFactor = Math.pow(1 + discountRate, t);
      
      // Guard against overflow
      if (!isFinite(discountFactor)) {
        throw new ValidationError(`Discount factor overflow at period ${t}`);
      }
      
      npv += cashFlows[t] / discountFactor;
    }
    
    return Math.round(npv * 100) / 100;
  }

  /**
   * Calculate Internal Rate of Return with robust error handling
   * Uses Newton-Raphson method with binary search fallback
   * @param cashFlows Array of cash flows
   * @throws ValidationError if IRR cannot be calculated
   */
  calculateIRR(cashFlows: number[]): number {
    this.validateCashFlows(cashFlows);
    
    // Check if there's at least one positive and one negative cash flow
    const hasPositive = cashFlows.some(cf => cf > 0);
    const hasNegative = cashFlows.some(cf => cf < 0);
    
    if (!hasPositive || !hasNegative) {
      throw new ValidationError('IRR requires both positive and negative cash flows');
    }

    // Try Newton-Raphson first
    try {
      return this.calculateIRRNewtonRaphson(cashFlows);
    } catch (error) {
      // Fallback to binary search if Newton-Raphson fails
      return this.calculateIRRBinarySearch(cashFlows);
    }
  }

  /**
   * Calculate payback period with partial period precision
   * @param cashFlows Array of cash flows
   * @returns Payback period in years (can be fractional)
   */
  calculatePaybackPeriod(cashFlows: number[]): number {
    this.validateCashFlows(cashFlows);
    
    let cumulative = 0;
    
    for (let i = 0; i < cashFlows.length; i++) {
      cumulative += cashFlows[i];
      
      if (cumulative >= 0) {
        if (i === 0) return 0; // Immediate payback
        
        // Calculate partial period using linear interpolation
        const previousCumulative = cumulative - cashFlows[i];
        const partialPeriod = -previousCumulative / cashFlows[i];
        
        // Validate partial period calculation
        if (!isFinite(partialPeriod) || partialPeriod < 0 || partialPeriod > 1) {
          return i; // Return whole period if interpolation fails
        }
        
        return i - 1 + partialPeriod;
      }
    }
    
    return Infinity; // Never pays back
  }

  /**
   * Calculate profitability index
   * @param cashFlows Array of cash flows
   * @param discountRate Annual discount rate
   * @returns PI ratio (>1 indicates profitable investment)
   */
  calculateProfitabilityIndex(cashFlows: number[], discountRate: number): number {
    this.validateCashFlows(cashFlows);
    this.validateDiscountRate(discountRate);
    
    if (cashFlows.length < 2) {
      throw new ValidationError('Profitability index requires at least 2 cash flows');
    }
    
    const initialInvestment = Math.abs(cashFlows[0]);
    
    if (initialInvestment === 0) {
      throw new ValidationError('Initial investment cannot be zero');
    }
    
    const pvOfFutureCashFlows = cashFlows
      .slice(1)
      .reduce((sum, cf, i) => {
        const discountFactor = Math.pow(1 + discountRate, i + 1);
        
        if (!isFinite(discountFactor)) {
          throw new ValidationError(`Discount factor overflow at period ${i + 1}`);
        }
        
        return sum + cf / discountFactor;
      }, 0);
    
    return Math.round((pvOfFutureCashFlows / initialInvestment) * 1000) / 1000;
  }

  /**
   * Calculate Modified Internal Rate of Return (MIRR)
   * Addresses IRR's reinvestment rate assumption issue
   */
  calculateMIRR(
    cashFlows: number[],
    financeRate: number,
    reinvestmentRate: number
  ): number {
    this.validateCashFlows(cashFlows);
    this.validateDiscountRate(financeRate);
    this.validateDiscountRate(reinvestmentRate);

    const n = cashFlows.length - 1;
    
    // Calculate PV of negative cash flows
    let pvNegative = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      if (cashFlows[i] < 0) {
        pvNegative += cashFlows[i] / Math.pow(1 + financeRate, i);
      }
    }
    
    // Calculate FV of positive cash flows
    let fvPositive = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      if (cashFlows[i] > 0) {
        fvPositive += cashFlows[i] * Math.pow(1 + reinvestmentRate, n - i);
      }
    }
    
    if (pvNegative === 0 || fvPositive === 0) {
      throw new ValidationError('MIRR requires both positive and negative cash flows');
    }
    
    const mirr = Math.pow(fvPositive / Math.abs(pvNegative), 1 / n) - 1;
    
    return Math.round(mirr * 10000) / 10000;
  }

  // Private helper methods

  private calculateIRRNewtonRaphson(cashFlows: number[]): number {
    let rate = 0.1; // Initial guess
    
    for (let iteration = 0; iteration < this.MAX_IRR_ITERATIONS; iteration++) {
      const npv = this.calculateNPV(cashFlows, rate);
      const npvDerivative = this.calculateNPVDerivative(cashFlows, rate);
      
      if (Math.abs(npvDerivative) < 1e-10) {
        throw new Error('Derivative too small for Newton-Raphson');
      }
      
      const newRate = rate - npv / npvDerivative;
      
      // Bound the rate to prevent divergence
      if (newRate < this.MIN_DISCOUNT_RATE) {
        throw new Error('IRR calculation diverged below minimum');
      }
      if (newRate > this.MAX_DISCOUNT_RATE) {
        throw new Error('IRR calculation diverged above maximum');
      }
      
      if (Math.abs(newRate - rate) < this.IRR_TOLERANCE) {
        return Math.round(newRate * 10000) / 10000;
      }
      
      rate = newRate;
    }
    
    throw new Error('Newton-Raphson did not converge');
  }

  private calculateNPVDerivative(cashFlows: number[], rate: number): number {
    let derivative = 0;
    
    for (let t = 1; t < cashFlows.length; t++) {
      const denominator = Math.pow(1 + rate, t + 1);
      
      if (!isFinite(denominator)) {
        throw new ValidationError('Overflow in derivative calculation');
      }
      
      derivative -= t * cashFlows[t] / denominator;
    }
    
    return derivative;
  }

  private calculateIRRBinarySearch(cashFlows: number[]): number {
    let low = this.MIN_DISCOUNT_RATE;
    let high = this.MAX_DISCOUNT_RATE;
    
    // Check if solution exists in range
    const npvLow = this.calculateNPV(cashFlows, low);
    const npvHigh = this.calculateNPV(cashFlows, high);
    
    if (npvLow * npvHigh > 0) {
      throw new ValidationError('No IRR exists in reasonable range');
    }
    
    for (let iteration = 0; iteration < this.MAX_IRR_ITERATIONS; iteration++) {
      const mid = (low + high) / 2;
      const npvMid = this.calculateNPV(cashFlows, mid);
      
      if (Math.abs(npvMid) < this.IRR_TOLERANCE * 1000) {
        return Math.round(mid * 10000) / 10000;
      }
      
      if (npvMid * npvLow < 0) {
        high = mid;
      } else {
        low = mid;
      }
      
      if (high - low < this.IRR_TOLERANCE) {
        return Math.round(mid * 10000) / 10000;
      }
    }
    
    return (low + high) / 2;
  }

  private validateCashFlows(cashFlows: number[]): void {
    if (!cashFlows || !Array.isArray(cashFlows)) {
      throw new ValidationError('Cash flows must be an array');
    }
    
    if (cashFlows.length === 0) {
      throw new ValidationError('Cash flows array cannot be empty');
    }
    
    if (cashFlows.some(cf => !isFinite(cf))) {
      throw new ValidationError('All cash flows must be finite numbers');
    }
    
    if (cashFlows.every(cf => cf === 0)) {
      throw new ValidationError('At least one cash flow must be non-zero');
    }
  }

  private validateDiscountRate(rate: number): void {
    if (typeof rate !== 'number' || !isFinite(rate)) {
      throw new ValidationError('Discount rate must be a finite number');
    }
    
    if (rate <= -1) {
      throw new ValidationError('Discount rate must be greater than -100%');
    }
    
    if (rate > 10) {
      throw new ValidationError('Discount rate seems unreasonably high (>1000%)');
    }
  }
}