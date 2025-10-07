import { SetMetadata } from '@nestjs/common';
import { SpanKind } from '@opentelemetry/api';
import { LogContext } from './interfaces';
import { LoggingService } from './logging';
import { MetricsService } from './metrics';
import { TracingService } from './tracing';

export const SKIP_METRICS_KEY = 'skipMetrics';
export const SkipMetrics = () => SetMetadata(SKIP_METRICS_KEY, true);

export const SKIP_TRACING_KEY = 'skipTracing';
export const SkipTracing = () => SetMetadata(SKIP_TRACING_KEY, true);

// Method decorator for automatic tracing
export function Traced(spanName?: string) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    if (!descriptor.value) {
      throw new Error('Traced decorator can only be applied to methods');
    }

    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const tracingService = this.tracingService as TracingService;
      if (!tracingService) {
        return originalMethod.apply(this, args);
      }

      const name = spanName || `${target.constructor.name}.${propertyKey}`;
      return tracingService.withSpan(
        name,
        async (span) => {
          span.setAttribute('class', target.constructor.name);
          span.setAttribute('method', propertyKey);
          return originalMethod.apply(this, args);
        },
        { kind: SpanKind.INTERNAL }
      );
    };

    return descriptor;
  };
}

// Method decorator for automatic metrics
export function Metered(metricName?: string) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    if (!descriptor.value) {
      throw new Error('Metered decorator can only be applied to methods');
    }

    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const metricsService = this.metricsService as MetricsService;
      if (!metricsService) {
        return originalMethod.apply(this, args);
      }

      const name =
        metricName || `${target.constructor.name.toLowerCase()}_${propertyKey}_duration_seconds`;
      let histogram = metricsService.getMetric(name);

      if (!histogram) {
        histogram = metricsService.registerHistogram(
          name,
          `Duration of ${target.constructor.name}.${propertyKey} in seconds`,
          ['class', 'method']
        );
      }

      const startTime = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = (Date.now() - startTime) / 1000;
        (histogram as any).observe(
          {
            class: target.constructor.name,
            method: propertyKey,
            service: metricsService.config.serviceName,
          },
          duration
        );
        return result;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        (histogram as any).observe(
          {
            class: target.constructor.name,
            method: propertyKey,
            service: metricsService.config.serviceName,
          },
          duration
        );
        throw error;
      }
    };

    return descriptor;
  };
}

// Method decorator for automatic logging
export function Logged(level: 'debug' | 'info' | 'warn' | 'error' = 'info') {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    if (!descriptor.value) {
      throw new Error('Logged decorator can only be applied to methods');
    }

    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const loggingService = this.loggingService as LoggingService;
      if (!loggingService) {
        return originalMethod.apply(this, args);
      }

      const className = target.constructor.name;
      const context = {
        class: className,
        method: propertyKey,
        args: args.length > 0 ? args : undefined,
      };

      loggingService.log(`Entering ${className}.${propertyKey}`, context);

      try {
        const result = await originalMethod.apply(this, args);
        loggingService.log(`Exiting ${className}.${propertyKey}`, {
          ...context,
          result: result !== undefined ? 'success' : undefined,
        });
        return result;
      } catch (error) {
        loggingService.error(
          `Error in ${className}.${propertyKey}`,
          error instanceof Error ? error.stack : undefined,
          {
            ...context,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        );
        throw error;
      }
    };

    return descriptor;
  };
}

// Caching decorator
export function Cacheable(options?: {
  key?: string;
  ttl?: number;
  service?: string;
}) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    if (!descriptor.value) {
      throw new Error('Cacheable decorator can only be applied to methods');
    }

    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      // If no cache service is available, just run the original method
      const cacheService = this.cacheService || this.redisService;
      if (!cacheService) {
        return originalMethod.apply(this, args);
      }

      // Generate cache key
      const cacheKey = options?.key || `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;
      const ttl = options?.ttl || 300; // Default 5 minutes

      // Try to get from cache
      try {
        const cached = await cacheService.getCache(cacheKey);
        if (cached !== null) {
          return cached;
        }
      } catch (error) {
        // If cache read fails, continue to execute method
        console.warn(`Cache read failed for key ${cacheKey}:`, error);
      }

      // Execute original method
      const result = await originalMethod.apply(this, args);

      // Store in cache
      try {
        await cacheService.setCache(cacheKey, result, ttl);
      } catch (error) {
        // If cache write fails, don't fail the request
        console.warn(`Cache write failed for key ${cacheKey}:`, error);
      }

      return result;
    };

    return descriptor;
  };
}

// Combined decorator for full observability
export function Observable(options?: {
  spanName?: string;
  metricName?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    if (!descriptor.value) {
      throw new Error('Observable decorator can only be applied to methods');
    }

    // Apply decorators in sequence
    Traced(options?.spanName)(target, propertyKey, descriptor);
    Metered(options?.metricName)(target, propertyKey, descriptor);
    Logged(options?.logLevel || 'info')(target, propertyKey, descriptor);
    return descriptor;
  };
}
