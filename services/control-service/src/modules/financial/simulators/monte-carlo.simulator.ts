import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { ValidationError } from '../../../shared/errors/validation.error';

/**
 * Monte Carlo Simulator with async chunking
 * Prevents event loop blocking for large simulations
 * Single responsibility: Statistical simulation and distribution analysis
 */
@Injectable()
export class MonteCarloSimulator extends EventEmitter {
  private readonly DEFAULT_ITERATIONS = 10000;
  private readonly CHUNK_SIZE = 100; // Process 100 iterations per chunk
  private readonly MAX_ITERATIONS = 1000000;
  private abortController: AbortController | null = null;

  /**
   * Run Monte Carlo simulation with progress reporting
   * @param generator Function that generates a single scenario result
   * @param iterations Number of simulations to run
   * @param options Simulation options including progress callback
   */
  async runSimulation<T extends number>(
    generator: () => T,
    iterations: number = this.DEFAULT_ITERATIONS,
    options?: SimulationOptions
  ): Promise<SimulationResult<T>> {
    // Validate inputs
    this.validateIterations(iterations);
    
    // Initialize abort controller for cancellation
    this.abortController = new AbortController();
    
    const results: T[] = [];
    const startTime = Date.now();
    const chunks = Math.ceil(iterations / this.CHUNK_SIZE);
    
    try {
      // Process in chunks to avoid blocking
      for (let chunk = 0; chunk < chunks; chunk++) {
        // Check for cancellation
        if (this.abortController.signal.aborted) {
          throw new Error('Simulation cancelled');
        }
        
        const chunkStart = chunk * this.CHUNK_SIZE;
        const chunkEnd = Math.min(chunkStart + this.CHUNK_SIZE, iterations);
        
        // Run chunk asynchronously
        await this.processChunk(
          results,
          generator,
          chunkStart,
          chunkEnd
        );
        
        // Report progress
        if (options?.onProgress) {
          const progress = (chunkEnd / iterations) * 100;
          options.onProgress({
            completed: chunkEnd,
            total: iterations,
            percentage: progress,
            estimatedTimeRemaining: this.estimateTimeRemaining(
              startTime,
              chunkEnd,
              iterations
            ),
          });
        }
        
        // Yield to event loop
        await this.yieldToEventLoop();
      }
      
      // Sort results for percentile calculations
      results.sort((a, b) => a - b);
      
      // Calculate statistics
      const statistics = this.calculateStatistics(results);
      const percentiles = this.calculatePercentiles(results);
      const confidenceIntervals = this.calculateConfidenceIntervals(results);
      
      return {
        iterations,
        results: options?.includeRawData ? results : undefined,
        statistics,
        percentiles,
        confidenceIntervals,
        executionTime: Date.now() - startTime,
      };
      
    } catch (error) {
      if (error.message === 'Simulation cancelled') {
        this.emit('cancelled', { iterations: results.length });
      }
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Run simulation with multiple variables (multivariate)
   */
  async runMultivariateSimulation(
    generators: Record<string, () => number>,
    iterations: number = this.DEFAULT_ITERATIONS,
    options?: SimulationOptions
  ): Promise<MultivariateSimulationResult> {
    this.validateIterations(iterations);
    
    const results: Record<string, number[]> = {};
    const correlations: Record<string, number> = {};
    
    // Initialize result arrays
    for (const key in generators) {
      results[key] = [];
    }
    
    // Run simulation
    for (let i = 0; i < iterations; i++) {
      for (const [key, generator] of Object.entries(generators)) {
        results[key].push(generator());
      }
      
      // Yield periodically
      if (i % this.CHUNK_SIZE === 0) {
        await this.yieldToEventLoop();
      }
    }
    
    // Calculate correlations between variables
    const keys = Object.keys(generators);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const correlation = this.calculateCorrelation(
          results[keys[i]],
          results[keys[j]]
        );
        correlations[`${keys[i]}_${keys[j]}`] = correlation;
      }
    }
    
    // Calculate statistics for each variable
    const statistics: Record<string, Statistics> = {};
    for (const [key, values] of Object.entries(results)) {
      values.sort((a, b) => a - b);
      statistics[key] = this.calculateStatistics(values);
    }
    
    return {
      iterations,
      variables: keys,
      statistics,
      correlations,
    };
  }

  /**
   * Cancel running simulation
   */
  cancelSimulation(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Generate samples from various probability distributions
   */
  generateSamples(distribution: Distribution, count: number): number[] {
    this.validateIterations(count);
    
    const samples: number[] = [];
    
    for (let i = 0; i < count; i++) {
      switch (distribution.type) {
        case 'normal':
          samples.push(this.sampleNormal(distribution.mean, distribution.stdDev));
          break;
        case 'uniform':
          samples.push(this.sampleUniform(distribution.min, distribution.max));
          break;
        case 'triangular':
          samples.push(this.sampleTriangular(distribution.min, distribution.mode, distribution.max));
          break;
        case 'pert':
          samples.push(this.samplePERT(distribution.min, distribution.mode, distribution.max, distribution.lambda));
          break;
        case 'lognormal':
          samples.push(this.sampleLogNormal(distribution.mean, distribution.stdDev));
          break;
        case 'exponential':
          samples.push(this.sampleExponential(distribution.lambda));
          break;
        default:
          // TypeScript exhaustiveness check - this should never be reached
          const _exhaustiveCheck: never = distribution;
          throw new ValidationError(`Unknown distribution type`);
      }
    }
    
    return samples;
  }

  // Private helper methods

  private async processChunk<T extends number>(
    results: T[],
    generator: () => T,
    start: number,
    end: number
  ): Promise<void> {
    for (let i = start; i < end; i++) {
      try {
        const value = generator();
        
        // Validate generated value
        if (!isFinite(value)) {
          throw new ValidationError(`Generated non-finite value at iteration ${i}`);
        }
        
        results.push(value);
      } catch (error) {
        // Log error but continue simulation
        console.error(`Error in iteration ${i}:`, error);
        // Push NaN to maintain iteration count, will be filtered later
        results.push(NaN as T);
      }
    }
  }

  private async yieldToEventLoop(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
  }

  private calculateStatistics(values: number[]): Statistics {
    // Filter out NaN values
    const validValues = values.filter(v => isFinite(v));
    
    if (validValues.length === 0) {
      throw new ValidationError('No valid values generated in simulation');
    }
    
    const n = validValues.length;
    const mean = this.calculateMean(validValues);
    const variance = this.calculateVariance(validValues, mean);
    const stdDev = Math.sqrt(variance);
    const skewness = this.calculateSkewness(validValues, mean, stdDev);
    const kurtosis = this.calculateKurtosis(validValues, mean, stdDev);
    
    return {
      count: n,
      mean,
      median: validValues[Math.floor(n / 2)],
      mode: this.calculateMode(validValues),
      variance,
      standardDeviation: stdDev,
      skewness,
      kurtosis,
      min: validValues[0],
      max: validValues[n - 1],
      range: validValues[n - 1] - validValues[0],
      coefficientOfVariation: stdDev / Math.abs(mean),
    };
  }

  private calculateMean(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private calculateVariance(values: number[], mean: number): number {
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return this.calculateMean(squaredDiffs);
  }

  private calculateSkewness(values: number[], mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    
    const n = values.length;
    const skew = values.reduce((sum, v) => 
      sum + Math.pow((v - mean) / stdDev, 3), 0
    ) / n;
    
    return skew;
  }

  private calculateKurtosis(values: number[], mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    
    const n = values.length;
    const kurt = values.reduce((sum, v) => 
      sum + Math.pow((v - mean) / stdDev, 4), 0
    ) / n - 3;
    
    return kurt;
  }

  private calculateMode(values: number[]): number {
    // Simple mode calculation for continuous data
    // Uses histogram binning
    const binCount = Math.min(50, Math.sqrt(values.length));
    const min = values[0];
    const max = values[values.length - 1];
    const binWidth = (max - min) / binCount;
    
    const bins = new Array(binCount).fill(0);
    
    for (const value of values) {
      const binIndex = Math.min(
        Math.floor((value - min) / binWidth),
        binCount - 1
      );
      bins[binIndex]++;
    }
    
    const maxBinIndex = bins.indexOf(Math.max(...bins));
    return min + (maxBinIndex + 0.5) * binWidth;
  }

  private calculatePercentiles(values: number[]): Percentiles {
    const percentile = (p: number) => {
      const index = Math.ceil(values.length * p) - 1;
      return values[Math.max(0, index)];
    };
    
    return {
      p1: percentile(0.01),
      p5: percentile(0.05),
      p10: percentile(0.10),
      p25: percentile(0.25),
      p50: percentile(0.50),
      p75: percentile(0.75),
      p90: percentile(0.90),
      p95: percentile(0.95),
      p99: percentile(0.99),
    };
  }

  private calculateConfidenceIntervals(values: number[]): ConfidenceInterval[] {
    const mean = this.calculateMean(values);
    const stdDev = Math.sqrt(this.calculateVariance(values, mean));
    const n = values.length;
    const stdError = stdDev / Math.sqrt(n);
    
    // Using t-distribution would be more accurate for small samples
    // but using normal approximation for simplicity
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

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length) {
      throw new ValidationError('Arrays must have same length for correlation');
    }
    
    const n = x.length;
    const meanX = this.calculateMean(x);
    const meanY = this.calculateMean(y);
    
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;
    
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }
    
    if (denomX === 0 || denomY === 0) return 0;
    
    return numerator / Math.sqrt(denomX * denomY);
  }

  private estimateTimeRemaining(
    startTime: number,
    completed: number,
    total: number
  ): number {
    const elapsed = Date.now() - startTime;
    const rate = completed / elapsed;
    const remaining = total - completed;
    return remaining / rate;
  }

  // Distribution sampling methods with proper error handling

  private sampleNormal(mean: number, stdDev: number): number {
    // Box-Muller transform with validation
    let u1, u2;
    do {
      u1 = Math.random();
      u2 = Math.random();
    } while (u1 === 0); // Avoid log(0)
    
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  private sampleUniform(min: number, max: number): number {
    if (min >= max) {
      throw new ValidationError('Min must be less than max for uniform distribution');
    }
    return min + Math.random() * (max - min);
  }

  private sampleTriangular(min: number, mode: number, max: number): number {
    if (min > mode || mode > max) {
      throw new ValidationError('Invalid triangular distribution parameters');
    }
    
    const u = Math.random();
    const fc = (mode - min) / (max - min);
    
    if (u < fc) {
      return min + Math.sqrt(u * (max - min) * (mode - min));
    } else {
      return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
    }
  }

  private samplePERT(min: number, mode: number, max: number, lambda: number = 4): number {
    if (min > mode || mode > max) {
      throw new ValidationError('Invalid PERT distribution parameters');
    }
    
    const mean = (min + lambda * mode + max) / (lambda + 2);
    const alpha = ((mean - min) * (2 * mode - min - max)) / 
                  ((mode - mean) * (max - min));
    const beta = (alpha * (max - mean)) / (mean - min);
    
    // Sample from Beta distribution
    const betaSample = this.sampleBeta(Math.max(0.1, alpha), Math.max(0.1, beta));
    
    return min + betaSample * (max - min);
  }

  private sampleBeta(alpha: number, beta: number): number {
    // Using acceptance-rejection for simplicity
    // For production, consider using more efficient algorithms
    const x = this.sampleGamma(alpha);
    const y = this.sampleGamma(beta);
    return x / (x + y);
  }

  private sampleGamma(shape: number): number {
    // Simplified Marsaglia and Tsang method
    if (shape < 1) {
      // Handle shape < 1 using scaling
      return this.sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
    }
    
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    
    while (true) {
      const z = this.sampleNormal(0, 1);
      const v = Math.pow(1 + c * z, 3);
      
      if (v > 0 && Math.log(Math.random()) < 0.5 * z * z + d - d * v + d * Math.log(v)) {
        return d * v;
      }
    }
  }

  private sampleLogNormal(mean: number, stdDev: number): number {
    const normal = this.sampleNormal(Math.log(mean), stdDev);
    return Math.exp(normal);
  }

  private sampleExponential(lambda: number): number {
    if (lambda <= 0) {
      throw new ValidationError('Lambda must be positive for exponential distribution');
    }
    return -Math.log(1 - Math.random()) / lambda;
  }

  private validateIterations(iterations: number): void {
    if (!isFinite(iterations) || iterations < 1) {
      throw new ValidationError('Iterations must be a positive number');
    }
    
    if (iterations > this.MAX_ITERATIONS) {
      throw new ValidationError(`Iterations cannot exceed ${this.MAX_ITERATIONS}`);
    }
  }
}

// Type definitions

interface SimulationOptions {
  onProgress?: (progress: ProgressInfo) => void;
  includeRawData?: boolean;
  seed?: number; // For reproducible simulations
}

interface ProgressInfo {
  completed: number;
  total: number;
  percentage: number;
  estimatedTimeRemaining: number;
}

interface SimulationResult<T> {
  iterations: number;
  results?: T[];
  statistics: Statistics;
  percentiles: Percentiles;
  confidenceIntervals: ConfidenceInterval[];
  executionTime: number;
}

interface MultivariateSimulationResult {
  iterations: number;
  variables: string[];
  statistics: Record<string, Statistics>;
  correlations: Record<string, number>;
}

interface Statistics {
  count: number;
  mean: number;
  median: number;
  mode: number;
  variance: number;
  standardDeviation: number;
  skewness: number;
  kurtosis: number;
  min: number;
  max: number;
  range: number;
  coefficientOfVariation: number;
}

interface Percentiles {
  p1: number;
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

interface ConfidenceInterval {
  level: number;
  lower: number;
  upper: number;
}

type Distribution = 
  | { type: 'normal'; mean: number; stdDev: number }
  | { type: 'uniform'; min: number; max: number }
  | { type: 'triangular'; min: number; mode: number; max: number }
  | { type: 'pert'; min: number; mode: number; max: number; lambda?: number }
  | { type: 'lognormal'; mean: number; stdDev: number }
  | { type: 'exponential'; lambda: number };