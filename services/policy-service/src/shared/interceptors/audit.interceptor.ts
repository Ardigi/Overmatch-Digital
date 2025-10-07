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
import { AuditService } from '../../modules/audit/audit.service';
import { AuditAction, AuditResourceType } from '../../modules/audit/entities/audit-log.entity';

interface UserContext {
  id: string;
  email: string;
  organizationId: string;
  roles?: string[];
}

interface RequestWithUser extends Request {
  user?: UserContext;
}

/**
 * Audit Interceptor
 *
 * Automatically logs all API operations including user context, resource access,
 * response times, and errors. Provides comprehensive audit trail for compliance
 * and security monitoring.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request & { user?: UserContext }>();
    const response = ctx.getResponse<Response>();

    // Extract audit context
    const auditContext = this.extractAuditContext(context);

    // Skip health checks and metrics endpoints
    if (this.shouldSkipAudit(request.path)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (data) => {
        // Log successful operations
        const duration = Date.now() - startTime;

        try {
          await this.auditService.create({
            userId: request.user?.id,
            userEmail: request.user?.email,
            organizationId: request.user?.organizationId || 'system',
            action: auditContext.action,
            resourceType: auditContext.resourceType,
            resourceId: auditContext.resourceId,
            resourceName: auditContext.resourceName,
            description: this.generateDescription(auditContext, request),
            metadata: {
              ip: request.ip,
              userAgent: request.headers['user-agent'],
              correlationId: request.headers['x-correlation-id'] as string,
              method: request.method,
              path: request.path,
              query: request.query,
              apiKeyId: request['apiKeyId'],
              responseSize: JSON.stringify(data || {}).length,
            },
            success: true,
            statusCode: response.statusCode,
            durationMs: duration,
          });
        } catch (error) {
          this.logger.error('Failed to create audit log for successful operation', error);
        }
      }),
      catchError(async (error) => {
        // Log failed operations
        const duration = Date.now() - startTime;

        try {
          await this.auditService.create({
            userId: request.user?.id,
            userEmail: request.user?.email,
            organizationId: request.user?.organizationId || 'system',
            action: auditContext.action,
            resourceType: auditContext.resourceType,
            resourceId: auditContext.resourceId,
            resourceName: auditContext.resourceName,
            description: `Failed: ${this.generateDescription(auditContext, request)}`,
            metadata: {
              ip: request.ip,
              userAgent: request.headers['user-agent'],
              correlationId: request.headers['x-correlation-id'] as string,
              method: request.method,
              path: request.path,
              query: request.query,
              apiKeyId: request['apiKeyId'],
              errorMessage: error.message,
              errorType: error.name,
              stackTrace: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            },
            success: false,
            statusCode: error.status || 500,
            durationMs: duration,
          });
        } catch (auditError) {
          this.logger.error('Failed to create audit log for failed operation', auditError);
        }

        // Re-throw the original error
        throw error;
      })
    );
  }

  /**
   * Extract audit context from execution context
   */
  private extractAuditContext(context: ExecutionContext): {
    action: AuditAction;
    resourceType: AuditResourceType;
    resourceId?: string;
    resourceName?: string;
  } {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const handler = context.getHandler();
    const controller = context.getClass();

    // Get controller and method names
    const controllerName = controller.name.toLowerCase();
    const methodName = handler.name.toLowerCase();

    // Determine resource type based on controller
    const resourceType = this.getResourceType(controllerName);

    // Determine action based on method name and HTTP method
    const action = this.getAuditAction(methodName, request.method);

    // Extract resource ID from params or body
    const resourceId = request.params.id || request.params.policyNumber || request.body?.id;

    const resourceName = request.body?.title || request.body?.name || request.params.policyNumber;

    return { action, resourceType, resourceId, resourceName };
  }

  /**
   * Map controller name to resource type
   */
  private getResourceType(controllerName: string): AuditResourceType {
    const mappings: Record<string, AuditResourceType> = {
      policies: AuditResourceType.POLICY,
      controls: AuditResourceType.CONTROL,
      frameworks: AuditResourceType.FRAMEWORK,
      assessments: AuditResourceType.ASSESSMENT,
      risks: AuditResourceType.RISK,
      users: AuditResourceType.USER,
      apikeys: AuditResourceType.API_KEY,
      compliance: AuditResourceType.COMPLIANCE_MAPPING,
    };

    for (const [key, value] of Object.entries(mappings)) {
      if (controllerName.includes(key)) {
        return value;
      }
    }

    return AuditResourceType.SYSTEM;
  }

  /**
   * Map method name and HTTP method to audit action
   */
  private getAuditAction(methodName: string, httpMethod: string): AuditAction {
    // Special method mappings
    if (methodName.includes('approve')) return AuditAction.APPROVE;
    if (methodName.includes('publish')) return AuditAction.PUBLISH;
    if (methodName.includes('download')) return AuditAction.DOWNLOAD;
    if (methodName.includes('login')) return AuditAction.LOGIN;
    if (methodName.includes('logout')) return AuditAction.LOGOUT;

    // HTTP method mappings
    switch (httpMethod) {
      case 'POST':
        return AuditAction.CREATE;
      case 'GET':
        return AuditAction.READ;
      case 'PUT':
      case 'PATCH':
        return AuditAction.UPDATE;
      case 'DELETE':
        return AuditAction.DELETE;
      default:
        return AuditAction.READ;
    }
  }

  /**
   * Generate human-readable description
   */
  private generateDescription(
    context: { action: AuditAction; resourceType: AuditResourceType; resourceName?: string },
    request: RequestWithUser
  ): string {
    const { action, resourceType, resourceName } = context;
    const user = request.user?.email || 'Anonymous';

    const actionVerb =
      {
        [AuditAction.CREATE]: 'created',
        [AuditAction.READ]: 'viewed',
        [AuditAction.UPDATE]: 'updated',
        [AuditAction.DELETE]: 'deleted',
        [AuditAction.APPROVE]: 'approved',
        [AuditAction.PUBLISH]: 'published',
        [AuditAction.DOWNLOAD]: 'downloaded',
      }[action] || action.toLowerCase();

    if (resourceName) {
      return `${user} ${actionVerb} ${resourceType.toLowerCase()} "${resourceName}"`;
    }

    return `${user} ${actionVerb} ${resourceType.toLowerCase()}`;
  }

  /**
   * Check if the endpoint should skip audit logging
   */
  private shouldSkipAudit(path: string): boolean {
    const skipPaths = ['/health', '/metrics', '/api-docs', '/swagger', '/favicon.ico'];

    return skipPaths.some((skipPath) => path.includes(skipPath));
  }
}
