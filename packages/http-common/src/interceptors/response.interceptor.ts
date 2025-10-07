import {
  type CallHandler,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import type { ServiceResponse } from '../interfaces/http-response.interface';
import { ResponseBuilder } from '../utils/response-builder';

/**
 * Global response interceptor that standardizes all API responses
 *
 * Features:
 * - Wraps successful responses in ServiceResponse format
 * - Adds metadata (request ID, timing, service info)
 * - Handles error responses consistently
 * - Preserves correlation IDs
 * - Adds performance timing
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseInterceptor.name);
  private readonly serviceName: string;
  private readonly serviceVersion: string;

  constructor(serviceName?: string, serviceVersion?: string) {
    this.serviceName = serviceName || process.env.SERVICE_NAME || 'unknown';
    this.serviceVersion = serviceVersion || process.env.SERVICE_VERSION || '1.0.0';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Extract correlation ID from headers or generate new one
    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      (request.headers['x-request-id'] as string) ||
      ResponseBuilder.createMetadata(new Date()).requestId!;

    // Set correlation ID in response headers
    response.setHeader('x-correlation-id', correlationId);
    response.setHeader('x-service', this.serviceName);
    response.setHeader('x-service-version', this.serviceVersion);

    return next.handle().pipe(
      map((data) => {
        const duration = Date.now() - startTime;

        // If data is already a ServiceResponse, enhance metadata
        if (this.isServiceResponse(data)) {
          return {
            ...data,
            metadata: {
              ...data.metadata,
              duration,
              service: this.serviceName,
              version: this.serviceVersion,
              correlationId,
              timestamp: new Date(),
            },
          };
        }

        // Handle different response types
        if (this.isHealthCheck(request.path)) {
          return this.wrapHealthCheckResponse(data, duration, correlationId);
        }

        if (this.isPaginatedRoute(request.path, data)) {
          return this.wrapPaginatedResponse(data, duration, correlationId);
        }

        // Wrap regular responses
        return ResponseBuilder.success(data, undefined, {
          duration,
          service: this.serviceName,
          version: this.serviceVersion,
          correlationId,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error(`Request failed: ${request.method} ${request.path}`, {
          error: error.message,
          duration,
          correlationId,
          stack: error.stack,
        });

        // Transform error to standardized format
        const errorResponse = this.transformError(error, duration, correlationId);

        // Set appropriate HTTP status code
        this.setHttpStatusFromError(response, error);

        return throwError(() => errorResponse);
      })
    );
  }

  /**
   * Check if data is already a ServiceResponse
   */
  private isServiceResponse(data: any): data is ServiceResponse<any> {
    return data && typeof data === 'object' && typeof data.success === 'boolean';
  }

  /**
   * Check if this is a health check endpoint
   */
  private isHealthCheck(path: string): boolean {
    return path.includes('/health') || path.includes('/status');
  }

  /**
   * Check if this should be a paginated response
   */
  private isPaginatedRoute(path: string, data: any): boolean {
    // Check if data has pagination structure
    return (
      data &&
      typeof data === 'object' &&
      Array.isArray(data.items) &&
      typeof data.total === 'number' &&
      typeof data.page === 'number'
    );
  }

  /**
   * Wrap health check responses
   */
  private wrapHealthCheckResponse(data: any, duration: number, correlationId: string) {
    return ResponseBuilder.success(data, 'Health check completed', {
      duration,
      service: this.serviceName,
      version: this.serviceVersion,
      correlationId,
      type: 'health_check',
    });
  }

  /**
   * Wrap paginated responses
   */
  private wrapPaginatedResponse(data: any, duration: number, correlationId: string) {
    return ResponseBuilder.paginated(data.items, data.total, data.page, data.pageSize, undefined, {
      duration,
      service: this.serviceName,
      version: this.serviceVersion,
      correlationId,
    });
  }

  /**
   * Transform errors to standardized format
   */
  private transformError(
    error: any,
    duration: number,
    correlationId: string
  ): ServiceResponse<null> {
    // Handle different error types
    if (error.name === 'ValidationError' || error.status === 400) {
      return ResponseBuilder.badRequest(
        error.message || 'Bad request',
        error.details || error.validationErrors
      );
    }

    if (error.status === 401 || error.name === 'UnauthorizedException') {
      return ResponseBuilder.unauthorized(error.message);
    }

    if (error.status === 403 || error.name === 'ForbiddenException') {
      return ResponseBuilder.forbidden(error.message);
    }

    if (error.status === 404 || error.name === 'NotFoundException') {
      return ResponseBuilder.notFound(error.resource || 'Resource', error.id);
    }

    if (error.status === 409 || error.name === 'ConflictException') {
      return ResponseBuilder.conflict(error.resource || 'Resource', error.constraint);
    }

    if (error.status === 429 || error.name === 'ThrottlerException') {
      return ResponseBuilder.rateLimitExceeded(error.retryAfter);
    }

    if (error.status === 503 || error.name === 'ServiceUnavailableException') {
      return ResponseBuilder.serviceUnavailable(error.service, error.retryAfter);
    }

    // Default to internal server error
    return ResponseBuilder.internalError(
      process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      process.env.NODE_ENV === 'production' ? undefined : { stack: error.stack }
    );
  }

  /**
   * Set HTTP status code based on error type
   */
  private setHttpStatusFromError(response: Response, error: any): void {
    if (error.status) {
      response.status(error.status);
      return;
    }

    // Map error names to HTTP status codes
    const statusMap: Record<string, number> = {
      ValidationError: HttpStatus.BAD_REQUEST,
      UnauthorizedException: HttpStatus.UNAUTHORIZED,
      ForbiddenException: HttpStatus.FORBIDDEN,
      NotFoundException: HttpStatus.NOT_FOUND,
      ConflictException: HttpStatus.CONFLICT,
      ThrottlerException: HttpStatus.TOO_MANY_REQUESTS,
      ServiceUnavailableException: HttpStatus.SERVICE_UNAVAILABLE,
    };

    const status = statusMap[error.name] || HttpStatus.INTERNAL_SERVER_ERROR;
    response.status(status);
  }
}

/**
 * Factory function to create ResponseInterceptor with service info
 */
export function createResponseInterceptor(
  serviceName?: string,
  serviceVersion?: string
): ResponseInterceptor {
  return new ResponseInterceptor(serviceName, serviceVersion);
}

/**
 * Response interceptor configuration options
 */
export interface ResponseInterceptorOptions {
  serviceName?: string;
  serviceVersion?: string;
  enableLogging?: boolean;
  enableTiming?: boolean;
  enableCorrelationId?: boolean;
  productionErrorMode?: boolean;
}

/**
 * Configurable response interceptor
 */
@Injectable()
export class ConfigurableResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ConfigurableResponseInterceptor.name);
  private readonly options: Required<ResponseInterceptorOptions>;

  constructor(options: ResponseInterceptorOptions = {}) {
    this.options = {
      serviceName: options.serviceName || process.env.SERVICE_NAME || 'unknown',
      serviceVersion: options.serviceVersion || process.env.SERVICE_VERSION || '1.0.0',
      enableLogging: options.enableLogging !== false,
      enableTiming: options.enableTiming !== false,
      enableCorrelationId: options.enableCorrelationId !== false,
      productionErrorMode: options.productionErrorMode ?? process.env.NODE_ENV === 'production',
    };
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = this.options.enableTiming ? Date.now() : 0;
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    let correlationId: string = '';
    if (this.options.enableCorrelationId) {
      correlationId =
        (request.headers['x-correlation-id'] as string) ||
        (request.headers['x-request-id'] as string) ||
        ResponseBuilder.createMetadata(new Date()).requestId!;

      response.setHeader('x-correlation-id', correlationId);
    }

    response.setHeader('x-service', this.options.serviceName);
    response.setHeader('x-service-version', this.options.serviceVersion);

    return next.handle().pipe(
      map((data) => {
        const duration = this.options.enableTiming ? Date.now() - startTime : undefined;

        if (this.isServiceResponse(data)) {
          return {
            ...data,
            metadata: {
              ...data.metadata,
              ...(duration !== undefined && { duration }),
              service: this.options.serviceName,
              version: this.options.serviceVersion,
              ...(correlationId && { correlationId }),
              timestamp: new Date(),
            },
          };
        }

        return ResponseBuilder.success(data, undefined, {
          ...(duration !== undefined && { duration }),
          service: this.options.serviceName,
          version: this.options.serviceVersion,
          ...(correlationId && { correlationId }),
        });
      }),
      catchError((error) => {
        const duration = this.options.enableTiming ? Date.now() - startTime : undefined;

        if (this.options.enableLogging) {
          this.logger.error(`Request failed: ${request.method} ${request.path}`, {
            error: error.message,
            ...(duration !== undefined && { duration }),
            ...(correlationId && { correlationId }),
            ...(this.options.productionErrorMode ? {} : { stack: error.stack }),
          });
        }

        const errorResponse = this.transformError(error);
        this.setHttpStatusFromError(response, error);

        return throwError(() => errorResponse);
      })
    );
  }

  private isServiceResponse(data: any): data is ServiceResponse<any> {
    return data && typeof data === 'object' && typeof data.success === 'boolean';
  }

  private transformError(error: any): ServiceResponse<null> {
    // Same error transformation logic as ResponseInterceptor
    if (error.name === 'ValidationError' || error.status === 400) {
      return ResponseBuilder.badRequest(error.message || 'Bad request', error.details);
    }
    if (error.status === 401) return ResponseBuilder.unauthorized(error.message);
    if (error.status === 403) return ResponseBuilder.forbidden(error.message);
    if (error.status === 404) return ResponseBuilder.notFound('Resource', error.id);
    if (error.status === 409) return ResponseBuilder.conflict('Resource');
    if (error.status === 429) return ResponseBuilder.rateLimitExceeded(error.retryAfter);
    if (error.status === 503) return ResponseBuilder.serviceUnavailable(error.service);

    return ResponseBuilder.internalError(
      this.options.productionErrorMode ? 'Internal server error' : error.message,
      this.options.productionErrorMode ? undefined : { stack: error.stack }
    );
  }

  private setHttpStatusFromError(response: Response, error: any): void {
    const statusMap: Record<string, number> = {
      ValidationError: HttpStatus.BAD_REQUEST,
      UnauthorizedException: HttpStatus.UNAUTHORIZED,
      ForbiddenException: HttpStatus.FORBIDDEN,
      NotFoundException: HttpStatus.NOT_FOUND,
      ConflictException: HttpStatus.CONFLICT,
      ThrottlerException: HttpStatus.TOO_MANY_REQUESTS,
      ServiceUnavailableException: HttpStatus.SERVICE_UNAVAILABLE,
    };

    const status = error.status || statusMap[error.name] || HttpStatus.INTERNAL_SERVER_ERROR;
    response.status(status);
  }
}
