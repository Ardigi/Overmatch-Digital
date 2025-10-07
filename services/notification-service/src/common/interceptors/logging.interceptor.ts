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
    const { method, url, body } = request;
    const userAgent = request.get('user-agent') || '';
    const ip = request.ip;

    const now = Date.now();

    // Log request
    this.logger.log(`→ ${method} ${url} ${userAgent} ${ip}`);

    // Log request body in development
    if (process.env.NODE_ENV === 'development' && Object.keys(body).length) {
      this.logger.debug(`Request body: ${JSON.stringify(body)}`);
    }

    return next.handle().pipe(
      tap({
        next: (data: any) => {
          const response = ctx.getResponse();
          const { statusCode } = response;
          const contentLength = response.get('content-length');

          this.logger.log(
            `← ${method} ${url} ${statusCode} ${contentLength || 0} - ${Date.now() - now}ms`
          );

          // Log response in development
          if (process.env.NODE_ENV === 'development' && data) {
            this.logger.debug(`Response: ${JSON.stringify(data).substring(0, 1000)}`);
          }
        },
        error: (err: Error) => {
          this.logger.error(`← ${method} ${url} ERROR - ${Date.now() - now}ms`, err.stack);
        },
      })
    );
  }
}
