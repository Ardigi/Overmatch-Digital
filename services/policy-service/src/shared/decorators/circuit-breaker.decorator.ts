import { Logger } from '@nestjs/common';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  monitoringPeriod?: number;
  halfOpenRequests?: number;
  fallback?: (...args: any[]) => any;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: number;
  private halfOpenAttempts = 0;
  private readonly logger = new Logger('CircuitBreaker');

  constructor(
    private readonly name: string,
    private readonly options: Required<CircuitBreakerOptions>
  ) {}

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenAttempts = 0;
        this.logger.log(`Circuit breaker ${this.name} entering HALF_OPEN state`);
      } else {
        this.logger.warn(`Circuit breaker ${this.name} is OPEN, using fallback`);
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.options.halfOpenRequests) {
        this.state = CircuitState.CLOSED;
        this.successes = 0;
        this.logger.log(`Circuit breaker ${this.name} is now CLOSED`);
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.logger.warn(`Circuit breaker ${this.name} is now OPEN (failed in HALF_OPEN state)`);
    } else if (this.failures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.logger.warn(`Circuit breaker ${this.name} is now OPEN (threshold reached)`);
    }
  }

  private shouldAttemptReset(): boolean {
    return (
      this.lastFailureTime !== undefined &&
      Date.now() - this.lastFailureTime >= this.options.resetTimeout
    );
  }

  getState(): { state: CircuitState; failures: number; successes: number } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
    };
  }
}

// Store circuit breakers globally
const circuitBreakers = new Map<string, CircuitBreaker>();

export function WithCircuitBreaker(options: CircuitBreakerOptions = {}) {
  const defaultOptions: Required<CircuitBreakerOptions> = {
    failureThreshold: options.failureThreshold ?? 5,
    resetTimeout: options.resetTimeout ?? 60000, // 1 minute
    monitoringPeriod: options.monitoringPeriod ?? 600000, // 10 minutes
    halfOpenRequests: options.halfOpenRequests ?? 3,
    fallback:
      options.fallback ??
      (() => {
        throw new Error('Circuit breaker is open and no fallback provided');
      }),
  };

  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const circuitBreakerName = `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      // Get or create circuit breaker for this method
      let circuitBreaker = circuitBreakers.get(circuitBreakerName);
      if (!circuitBreaker) {
        circuitBreaker = new CircuitBreaker(circuitBreakerName, defaultOptions);
        circuitBreakers.set(circuitBreakerName, circuitBreaker);
      }

      try {
        return await circuitBreaker.call(() => originalMethod.apply(this, args));
      } catch (error) {
        // If circuit is open, use fallback
        if (error.message.includes('Circuit breaker') && error.message.includes('is OPEN')) {
          return defaultOptions.fallback.apply(this, args);
        }
        throw error;
      }
    };

    return descriptor;
  };
}

// Utility function to get circuit breaker status
export function getCircuitBreakerStatus(name: string) {
  const breaker = circuitBreakers.get(name);
  return breaker ? breaker.getState() : null;
}

// Utility function to manually reset a circuit breaker
export function resetCircuitBreaker(name: string) {
  circuitBreakers.delete(name);
}
