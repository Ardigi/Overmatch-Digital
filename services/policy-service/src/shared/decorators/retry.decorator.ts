import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoffMultiplier?: number;
  maxDelay?: number;
  retryCondition?: (error: any) => boolean;
  onRetry?: (error: any, attempt: number) => void;
}

const defaultRetryCondition = (error: any): boolean => {
  // Retry on network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return true;
  }

  // Retry on 5xx errors
  if (error.response?.status >= 500) {
    return true;
  }

  // Retry on specific database errors
  if (error.code === 'ER_LOCK_DEADLOCK' || error.code === '40001') {
    return true;
  }

  // Don't retry on client errors
  return false;
};

export function WithRetry(options: RetryOptions = {}) {
  const logger = new Logger('RetryDecorator');

  const config = {
    maxAttempts: options.maxAttempts ?? 3,
    delay: options.delay ?? 1000,
    backoffMultiplier: options.backoffMultiplier ?? 2,
    maxDelay: options.maxDelay ?? 10000,
    retryCondition: options.retryCondition ?? defaultRetryCondition,
    onRetry:
      options.onRetry ??
      ((error, attempt) => {
        logger.warn(`Retry attempt ${attempt} after error: ${error.message}`);
      }),
  };

  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError: any;

      for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;

          // Check if we should retry
          if (attempt === config.maxAttempts || !config.retryCondition(error)) {
            throw error;
          }

          // Calculate delay with exponential backoff
          const delay = Math.min(
            config.delay * config.backoffMultiplier ** (attempt - 1),
            config.maxDelay
          );

          // Call onRetry callback
          config.onRetry(error, attempt);

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      throw lastError;
    };

    return descriptor;
  };
}

// Convenience decorators for common retry scenarios
export const RetryOnNetworkError = () =>
  WithRetry({
    maxAttempts: 3,
    delay: 1000,
    retryCondition: (error) => {
      return (
        error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND'
      );
    },
  });

export const RetryOnDatabaseError = () =>
  WithRetry({
    maxAttempts: 3,
    delay: 500,
    backoffMultiplier: 1.5,
    retryCondition: (error) => {
      return (
        error.code === 'ER_LOCK_DEADLOCK' ||
        error.code === '40001' || // Serialization failure
        error.code === 'ER_LOCK_WAIT_TIMEOUT'
      );
    },
  });

export const RetryOnElasticsearchError = () =>
  WithRetry({
    maxAttempts: 3,
    delay: 2000,
    retryCondition: (error) => {
      return (
        error.name === 'ConnectionError' ||
        error.statusCode === 503 || // Service unavailable
        error.statusCode === 429
      ); // Too many requests
    },
  });
