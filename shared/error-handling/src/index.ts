/**
 * Comprehensive Error Handling Framework
 * Provides consistent error handling across all microservices
 */

export enum ErrorCode {
  // System Errors (1000-1999)
  SYSTEM_ERROR = 1000,
  DATABASE_CONNECTION_ERROR = 1001,
  REDIS_CONNECTION_ERROR = 1002,
  KAFKA_CONNECTION_ERROR = 1003,
  EXTERNAL_SERVICE_ERROR = 1004,

  // Authentication Errors (2000-2999)
  UNAUTHORIZED = 2000,
  INVALID_CREDENTIALS = 2001,
  TOKEN_EXPIRED = 2002,
  TOKEN_INVALID = 2003,
  MFA_REQUIRED = 2004,
  MFA_INVALID = 2005,

  // Validation Errors (3000-3999)
  VALIDATION_ERROR = 3000,
  MISSING_REQUIRED_FIELD = 3001,
  INVALID_FORMAT = 3002,
  INVALID_ENUM_VALUE = 3003,

  // Business Logic Errors (4000-4999)
  RESOURCE_NOT_FOUND = 4000,
  DUPLICATE_RESOURCE = 4001,
  QUOTA_EXCEEDED = 4002,
  OPERATION_NOT_ALLOWED = 4003,
  INSUFFICIENT_PERMISSIONS = 4004,

  // Rate Limiting (5000-5999)
  RATE_LIMIT_EXCEEDED = 5000,
}

export interface ErrorContext {
  service: string;
  operation: string;
  userId?: string;
  organizationId?: string;
  requestId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class ServiceError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public context: ErrorContext,
    public statusCode: number = 500,
    public isOperational: boolean = true,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ServiceError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      stack: this.stack,
      cause: this.cause?.message,
    };
  }
}

export interface ErrorHandlerOptions {
  logErrors: boolean;
  includeStackTrace: boolean;
  notifyOnCritical: boolean;
  service: string;
}

export class ErrorHandler {
  constructor(private options: ErrorHandlerOptions) {}

  handle(error: Error, context: Partial<ErrorContext>): ServiceError {
    if (error instanceof ServiceError) {
      return error;
    }

    // Map common errors to ServiceErrors
    const errorMapping = this.mapError(error);

    return new ServiceError(
      errorMapping.code,
      errorMapping.message,
      {
        service: this.options.service,
        timestamp: new Date(),
        ...context,
      } as ErrorContext,
      errorMapping.statusCode,
      errorMapping.isOperational,
      error
    );
  }

  private mapError(error: Error): {
    code: ErrorCode;
    message: string;
    statusCode: number;
    isOperational: boolean;
  } {
    // Database errors
    if (error.message.includes('ECONNREFUSED') && error.message.includes('5432')) {
      return {
        code: ErrorCode.DATABASE_CONNECTION_ERROR,
        message: 'Database connection failed',
        statusCode: 503,
        isOperational: false,
      };
    }

    // Redis errors
    if (error.message.includes('ECONNREFUSED') && error.message.includes('6379')) {
      return {
        code: ErrorCode.REDIS_CONNECTION_ERROR,
        message: 'Redis connection failed',
        statusCode: 503,
        isOperational: false,
      };
    }

    // Kafka errors
    if (
      error.message.includes('KafkaJSConnectionError') ||
      (error.message.includes('ECONNREFUSED') && error.message.includes('9092'))
    ) {
      return {
        code: ErrorCode.KAFKA_CONNECTION_ERROR,
        message: 'Kafka connection failed',
        statusCode: 503,
        isOperational: false,
      };
    }

    // Default
    return {
      code: ErrorCode.SYSTEM_ERROR,
      message: error.message || 'An unexpected error occurred',
      statusCode: 500,
      isOperational: false,
    };
  }
}

// Circuit Breaker for external service calls
export class CircuitBreaker {
  private failures = 0;
  private lastFailTime?: Date;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000, // 1 minute
    private resetTimeout: number = 30000 // 30 seconds
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime!.getTime() > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new ServiceError(
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          'Circuit breaker is OPEN',
          {
            service: 'circuit-breaker',
            operation: 'execute',
            timestamp: new Date(),
          },
          503
        );
      }
    }

    try {
      const result = await fn();
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailTime = new Date();

      if (this.failures >= this.threshold) {
        this.state = 'OPEN';
      }

      throw error;
    }
  }
}

// Retry mechanism with exponential backoff
export class RetryHandler {
  constructor(
    private maxRetries: number = 3,
    private initialDelay: number = 1000,
    private maxDelay: number = 30000,
    private factor: number = 2
  ) {}

  async execute<T>(
    fn: () => Promise<T>,
    isRetriable: (error: Error) => boolean = () => true
  ): Promise<T> {
    let lastError: Error;
    let delay = this.initialDelay;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === this.maxRetries || !isRetriable(lastError)) {
          throw lastError;
        }

        await this.sleep(Math.min(delay, this.maxDelay));
        delay *= this.factor;
      }
    }

    throw lastError!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Global error registry for tracking error patterns
export class ErrorRegistry {
  private errors: Map<string, { count: number; lastOccurred: Date }> = new Map();

  record(error: ServiceError): void {
    const key = `${error.code}-${error.context.service}-${error.context.operation}`;
    const existing = this.errors.get(key);

    if (existing) {
      existing.count++;
      existing.lastOccurred = new Date();
    } else {
      this.errors.set(key, { count: 1, lastOccurred: new Date() });
    }
  }

  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [key, value] of this.errors.entries()) {
      stats[key] = value;
    }

    return stats;
  }

  getTopErrors(limit: number = 10): Array<[string, { count: number; lastOccurred: Date }]> {
    return Array.from(this.errors.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, limit);
  }
}
