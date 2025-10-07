import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    // Store start time in request
    request.startTime = startTime;

    const { method, url, headers } = request;
    const correlationId = headers['x-correlation-id'] || 'none';
    const serviceName = headers['x-service-name'] || 'unknown';

    this.logger.log(`Incoming ${method} ${url}`, {
      correlationId,
      fromService: serviceName,
      headers: this.sanitizeHeaders(headers),
    });

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log(`Outgoing ${method} ${url} - ${response.statusCode}`, {
          correlationId,
          duration,
          statusCode: response.statusCode,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error(`Failed ${method} ${url} - ${error.status || 500}`, {
          correlationId,
          duration,
          error: error.message,
          stack: error.stack,
        });
        throw error;
      })
    );
  }

  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sanitized = { ...headers };

    // Remove sensitive headers
    const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'x-auth-token'];

    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}
