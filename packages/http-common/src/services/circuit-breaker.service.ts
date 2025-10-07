import { Injectable, Logger } from '@nestjs/common';
import type { CircuitBreakerConfig } from '../interfaces/service-config.interface';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuits = new Map<string, CircuitBreakerState>();

  getCircuitState(serviceName: string): CircuitBreakerState {
    if (!this.circuits.has(serviceName)) {
      this.circuits.set(serviceName, {
        state: CircuitState.CLOSED,
        failures: 0,
      });
    }
    return this.circuits.get(serviceName)!;
  }

  async executeWithCircuitBreaker<T>(
    serviceName: string,
    config: CircuitBreakerConfig,
    operation: () => Promise<T>
  ): Promise<T> {
    const circuit = this.getCircuitState(serviceName);

    // Check if circuit is open
    if (circuit.state === CircuitState.OPEN) {
      if (Date.now() < circuit.nextAttemptTime!.getTime()) {
        throw new Error(`Circuit breaker is OPEN for service ${serviceName}`);
      }
      // Move to half-open state
      circuit.state = CircuitState.HALF_OPEN;
      this.logger.log(`Circuit breaker for ${serviceName} moved to HALF_OPEN`);
    }

    try {
      const result = await operation();

      // Success - reset circuit
      if (circuit.state === CircuitState.HALF_OPEN || circuit.failures > 0) {
        this.logger.log(`Circuit breaker for ${serviceName} reset to CLOSED`);
        circuit.state = CircuitState.CLOSED;
        circuit.failures = 0;
        circuit.lastFailureTime = undefined;
        circuit.nextAttemptTime = undefined;
      }

      return result;
    } catch (error) {
      return this.handleFailure(serviceName, config, circuit, error);
    }
  }

  private handleFailure(
    serviceName: string,
    config: CircuitBreakerConfig,
    circuit: CircuitBreakerState,
    error: any
  ): never {
    circuit.failures++;
    circuit.lastFailureTime = new Date();

    if (circuit.failures >= config.threshold) {
      circuit.state = CircuitState.OPEN;
      circuit.nextAttemptTime = new Date(Date.now() + config.resetTimeout);
      this.logger.error(
        `Circuit breaker for ${serviceName} is now OPEN. Will retry at ${circuit.nextAttemptTime}`
      );
    } else {
      this.logger.warn(
        `Circuit breaker for ${serviceName}: failure ${circuit.failures}/${config.threshold}`
      );
    }

    throw error;
  }

  getCircuitStatus(): Record<string, CircuitBreakerState> {
    const status: Record<string, CircuitBreakerState> = {};
    this.circuits.forEach((state, service) => {
      status[service] = { ...state };
    });
    return status;
  }

  resetCircuit(serviceName: string): void {
    if (this.circuits.has(serviceName)) {
      this.circuits.set(serviceName, {
        state: CircuitState.CLOSED,
        failures: 0,
      });
      this.logger.log(`Circuit breaker for ${serviceName} manually reset`);
    }
  }

  resetAllCircuits(): void {
    this.circuits.clear();
    this.logger.log('All circuit breakers reset');
  }
}
