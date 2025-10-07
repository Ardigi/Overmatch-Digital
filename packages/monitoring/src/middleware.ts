import { Injectable, type NestMiddleware } from '@nestjs/common';
import { SpanKind } from '@opentelemetry/api';
import type { NextFunction, Request, Response } from 'express';
import { LoggingService } from './logging';
import { MetricsService } from './metrics';
import { TracingService } from './tracing';

export interface RequestWithContext extends Request {
  correlationId?: string;
  startTime?: number;
  user?: {
    id: string;
    organizationId: string;
  };
}

@Injectable()
export class MonitoringMiddleware implements NestMiddleware {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly tracingService: TracingService,
    private readonly loggingService: LoggingService
  ) {}

  async use(req: RequestWithContext, res: Response, next: NextFunction) {
    // Generate or extract correlation ID
    req.correlationId = (req.headers['x-correlation-id'] as string) || this.generateCorrelationId();
    req.startTime = Date.now();

    // Extract route pattern
    const route = req.route?.path || req.path;
    const method = req.method;

    // Start metrics
    this.metricsService.incrementHttpRequestsInFlight(method, route);

    // Start tracing span
    await this.tracingService.withSpan(
      `${method} ${route}`,
      async (span) => {
        // Set span attributes
        span.setAttribute('http.method', method);
        span.setAttribute('http.url', req.url);
        span.setAttribute('http.target', route);
        span.setAttribute('http.host', req.get('host') || '');
        span.setAttribute('http.scheme', req.protocol);
        span.setAttribute('http.user_agent', req.get('user-agent') || '');
        span.setAttribute('correlation.id', req.correlationId);

        if (req.user) {
          span.setAttribute('user.id', req.user.id);
          span.setAttribute('user.organization_id', req.user.organizationId);
        }

        // Log request
        const context = {
          correlationId: req.correlationId,
          traceId: this.tracingService.getTraceId(),
          spanId: this.tracingService.getSpanId(),
          userId: req.user?.id,
          organizationId: req.user?.organizationId,
        };

        this.loggingService.logHttpRequest(
          method,
          route,
          0, // Will be updated in response handler
          0, // Will be updated in response handler
          context
        );

        // Continue with request processing
        return new Promise<void>((resolve) => {
          // Handle response
          const originalSend = res.send;
          const metricsService = this.metricsService;
          const loggingService = this.loggingService;

          res.send = function (data: any) {
            res.send = originalSend;

            // Calculate duration
            const duration = (Date.now() - (req.startTime || 0)) / 1000;

            // Update span
            span.setAttribute('http.status_code', res.statusCode);
            span.setAttribute('http.response_content_length', res.get('content-length') || 0);

            // Record metrics
            metricsService.recordHttpRequest(method, route, res.statusCode, duration);
            metricsService.decrementHttpRequestsInFlight(method, route);

            // Log response
            loggingService.logHttpRequest(
              method,
              route,
              res.statusCode,
              duration * 1000, // Convert to milliseconds
              context
            );

            // Check for errors
            if (res.statusCode >= 400) {
              span.setAttribute('http.error', true);
              if (res.statusCode >= 500) {
                loggingService.error(`HTTP Error: ${method} ${route}`, undefined, {
                  ...context,
                  statusCode: res.statusCode,
                  response: data,
                });
              }
            }

            resolve();
            return originalSend.call(this, data);
          };

          next();
        });
      },
      { kind: SpanKind.SERVER }
    );
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
