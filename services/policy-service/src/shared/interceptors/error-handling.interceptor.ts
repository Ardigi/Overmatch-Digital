import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

interface RequestWithCorrelationId extends Request {
  correlationId?: string;
}

@Injectable()
export class ErrorHandlingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorHandlingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<RequestWithCorrelationId>();
    const response = ctx.getResponse<Response>();

    // Generate or extract correlation ID
    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Set correlation ID in request for downstream use
    request.correlationId = correlationId;

    // Set correlation ID in response headers
    response.setHeader('X-Correlation-ID', correlationId);

    const now = Date.now();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';

    return next.handle().pipe(
      tap(() => {
        // Log successful requests
        const responseTime = Date.now() - now;
        this.logger.log({
          correlationId,
          method,
          url,
          statusCode: response.statusCode,
          responseTime,
          ip,
          userAgent,
        });
      }),
      catchError((err) => {
        // Add correlation ID to error
        if (err && typeof err === 'object') {
          err.correlationId = correlationId;
        }

        // Log failed requests
        const responseTime = Date.now() - now;
        this.logger.error({
          correlationId,
          method,
          url,
          responseTime,
          ip,
          userAgent,
          error: err.message || err,
        });

        return throwError(() => err);
      })
    );
  }
}
