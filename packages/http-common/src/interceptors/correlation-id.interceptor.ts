import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get or generate correlation ID
    const correlationId =
      request.headers['x-correlation-id'] || request.headers['x-request-id'] || uuidv4();

    // Set correlation ID in request
    request.correlationId = correlationId;

    // Set correlation ID in response headers
    response.setHeader('X-Correlation-ID', correlationId);

    // Add correlation ID to all outgoing HTTP requests
    if (request.httpClient) {
      request.httpClient.defaults.headers.common['X-Correlation-ID'] = correlationId;
    }

    return next.handle().pipe(
      tap(() => {
        // Log with correlation ID
        const duration = Date.now() - request.startTime;
        console.log(
          `[${correlationId}] ${request.method} ${request.url} - ${response.statusCode} (${duration}ms)`
        );
      })
    );
  }
}
