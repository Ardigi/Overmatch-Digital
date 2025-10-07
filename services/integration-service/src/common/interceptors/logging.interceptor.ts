import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const now = Date.now();

    // Log incoming request
    this.logger.log(`Incoming Request: ${method} ${url} - ${ip} - ${userAgent}`);

    return next.handle().pipe(
      tap({
        next: (data) => {
          const response = ctx.getResponse();
          const statusCode = response.statusCode;
          const contentLength = response.get('content-length') || 0;
          const responseTime = Date.now() - now;

          this.logger.log(
            `Outgoing Response: ${method} ${url} - ${statusCode} - ${contentLength} bytes - ${responseTime}ms`
          );
        },
        error: (error) => {
          const responseTime = Date.now() - now;
          this.logger.error(
            `Request Error: ${method} ${url} - ${error.status || 500} - ${responseTime}ms - ${error.message}`
          );
        },
      })
    );
  }
}
