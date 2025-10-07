import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import type { RequestContext } from '../interfaces/request-context.interface';
import { RequestContextService } from './request-context.service';

/**
 * NestJS interceptor that enhances request context and adds audit logging
 * Works in conjunction with ContextMiddleware to provide complete context management
 */
@Injectable()
export class ContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ContextInterceptor.name);

  constructor(private readonly contextService: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request & { context?: RequestContext }>();
    const response = httpContext.getResponse<Response>();

    const startTime = Date.now();
    const requestContext = this.contextService.getCurrentContext();

    // Enhance context with controller/handler information
    if (requestContext) {
      this.enhanceContextWithControllerInfo(context, requestContext);
    }

    // Log request start
    this.logRequestStart(context, requestContext);

    return next.handle().pipe(
      tap((data) => {
        // Log successful completion
        const duration = Date.now() - startTime;
        this.logRequestSuccess(context, requestContext, response.statusCode, duration, data);

        // Update response headers with additional context info
        this.setResponseHeaders(response, requestContext);
      }),
      catchError((error) => {
        // Log error
        const duration = Date.now() - startTime;
        this.logRequestError(context, requestContext, error, duration);

        // Update response headers even on error
        this.setResponseHeaders(response, requestContext);

        // Re-throw the error
        throw error;
      })
    );
  }

  /**
   * Enhance request context with controller and handler information
   */
  private enhanceContextWithControllerInfo(
    context: ExecutionContext,
    requestContext: RequestContext
  ): void {
    const controller = context.getClass();
    const handler = context.getHandler();

    const controllerName = controller.name;
    const handlerName = handler.name;

    // Update audit context with more specific action/resource info
    if (requestContext.audit) {
      requestContext.audit.resource = `${controllerName}.${handlerName}`;

      // Add metadata about the controller and handler
      if (!requestContext.audit.metadata) {
        requestContext.audit.metadata = {};
      }
      requestContext.audit.metadata.controller = controllerName;
      requestContext.audit.metadata.handler = handlerName;
    }

    // Add custom context data
    this.contextService.setCustomData('controller', controllerName);
    this.contextService.setCustomData('handler', handlerName);
  }

  /**
   * Log request start
   */
  private logRequestStart(context: ExecutionContext, requestContext?: RequestContext): void {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();

    const logData = {
      correlationId: requestContext?.correlationId,
      method: request.method,
      path: request.path,
      userId: requestContext?.user?.userId,
      organizationId: requestContext?.user?.organizationId,
      sourceService: requestContext?.request.sourceService,
      clientIp: requestContext?.audit?.clientIp,
      userAgent: request.headers['user-agent'],
    };

    this.logger.log(`Request started: ${request.method} ${request.path}`, logData);
  }

  /**
   * Log successful request completion
   */
  private logRequestSuccess(
    context: ExecutionContext,
    requestContext: RequestContext | undefined,
    statusCode: number,
    duration: number,
    responseData: any
  ): void {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();

    const logData = {
      correlationId: requestContext?.correlationId,
      method: request.method,
      path: request.path,
      statusCode,
      duration: `${duration}ms`,
      userId: requestContext?.user?.userId,
      organizationId: requestContext?.user?.organizationId,
      sourceService: requestContext?.request.sourceService,
      responseSize: this.getResponseSize(responseData),
    };

    this.logger.log(`Request completed: ${request.method} ${request.path}`, logData);

    // Log audit event for compliance
    if (requestContext?.audit) {
      this.logAuditEvent(requestContext, statusCode, duration, 'success');
    }
  }

  /**
   * Log request error
   */
  private logRequestError(
    context: ExecutionContext,
    requestContext: RequestContext | undefined,
    error: any,
    duration: number
  ): void {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();

    const logData = {
      correlationId: requestContext?.correlationId,
      method: request.method,
      path: request.path,
      duration: `${duration}ms`,
      userId: requestContext?.user?.userId,
      organizationId: requestContext?.user?.organizationId,
      sourceService: requestContext?.request.sourceService,
      error: {
        name: error.name,
        message: error.message,
        status: error.status || error.statusCode,
      },
    };

    this.logger.error(`Request failed: ${request.method} ${request.path}`, logData);

    // Log audit event for compliance
    if (requestContext?.audit) {
      this.logAuditEvent(requestContext, error.status || 500, duration, 'error', error);
    }
  }

  /**
   * Set additional response headers
   */
  private setResponseHeaders(response: Response, requestContext?: RequestContext): void {
    if (!requestContext) return;

    // Set correlation ID if not already set
    if (!response.getHeader('X-Correlation-ID')) {
      response.setHeader('X-Correlation-ID', requestContext.correlationId);
    }

    // Set service identification headers
    response.setHeader('X-Service-Name', requestContext.request.sourceService);

    if (requestContext.request.startTime) {
      response.setHeader('X-Request-Timestamp', requestContext.request.startTime.toISOString());
    }

    // Set audit headers for compliance
    if (requestContext.audit) {
      response.setHeader('X-Audit-Action', requestContext.audit.action);
      response.setHeader('X-Audit-Resource', requestContext.audit.resource);
    }
  }

  /**
   * Log audit event for compliance tracking
   */
  private logAuditEvent(
    requestContext: RequestContext,
    statusCode: number,
    duration: number,
    outcome: 'success' | 'error',
    error?: any
  ): void {
    const auditEvent = {
      timestamp: new Date().toISOString(),
      correlationId: requestContext.correlationId,
      user: requestContext.user,
      action: requestContext.audit?.action,
      resource: requestContext.audit?.resource,
      outcome,
      statusCode,
      duration,
      clientIp: requestContext.audit?.clientIp,
      userAgent: requestContext.audit?.userAgent,
      metadata: {
        ...requestContext.audit?.metadata,
        error: error
          ? {
              name: error.name,
              message: error.message,
              status: error.status || error.statusCode,
            }
          : undefined,
      },
    };

    // Use a separate logger for audit events to enable different log routing
    const auditLogger = new Logger('AUDIT');
    auditLogger.log('Audit event', auditEvent);
  }

  /**
   * Get response size for logging
   */
  private getResponseSize(data: any): string {
    if (!data) return '0B';

    try {
      const size = JSON.stringify(data).length;
      if (size < 1024) return `${size}B`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
      return `${(size / (1024 * 1024)).toFixed(1)}MB`;
    } catch {
      return 'unknown';
    }
  }
}

/**
 * Global interceptor that can be applied to all routes
 */
@Injectable()
export class GlobalContextInterceptor extends ContextInterceptor {
  constructor(contextService: RequestContextService) {
    super(contextService);
  }
}
