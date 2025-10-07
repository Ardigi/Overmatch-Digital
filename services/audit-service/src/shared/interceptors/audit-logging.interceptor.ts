import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Request } from 'express';
import { type Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {
  AuditAction,
  type AuditContext,
  AuditResource,
  AuditSeverity,
} from '../../modules/audit-trail/entities/audit-entry.entity';

export const AUDIT_METADATA_KEY = 'audit';

export interface AuditMetadata {
  action?: AuditAction;
  resource?: AuditResource;
  severity?: AuditSeverity;
  description?: string;
  skipAudit?: boolean;
}

// Define the user interface
interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
  organizationId?: string;
}

// Extend Express Request to include user
declare module 'express' {
  interface Request {
    user?: User;
  }
}

@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLoggingInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly eventEmitter: EventEmitter2
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<Request>();

    // Get audit metadata from decorator
    const auditMetadata = this.reflector.get<AuditMetadata>(
      AUDIT_METADATA_KEY,
      context.getHandler()
    );

    // Skip if audit is disabled for this handler
    if (auditMetadata?.skipAudit) {
      return next.handle();
    }

    // Extract request information
    const { method, url, ip, headers, params, query, body, user } = request;

    const userAgent = headers['user-agent'];
    const correlationId = headers['x-correlation-id'] as string;
    const sessionId = headers['x-session-id'] as string;

    // Determine action and resource from metadata or HTTP method
    const action = auditMetadata?.action || this.getActionFromMethod(method);
    const resource = auditMetadata?.resource || this.getResourceFromUrl(url);

    // Build audit context
    const auditContext: AuditContext = {
      service: 'audit-service',
      endpoint: url,
      method,
      correlationId,
      sessionId,
    };

    return next.handle().pipe(
      tap((response) => {
        const duration = Date.now() - startTime;

        // Emit audit event for successful request
        this.eventEmitter.emit('audit.entry.create', {
          organizationId: user?.organizationId,
          userId: user?.id,
          userEmail: user?.email || 'system',
          userName: user?.name,
          userRole: user?.role,
          action,
          resource,
          resourceId: params.id || this.extractResourceId(response),
          resourceName: this.extractResourceName(response),
          description:
            auditMetadata?.description || this.generateDescription(method, url, response),
          severity: auditMetadata?.severity || AuditSeverity.INFO,
          timestamp: new Date(),
          ipAddress: ip || request.connection.remoteAddress || 'unknown',
          userAgent,
          oldValue: method === 'PUT' || method === 'PATCH' ? body.oldValue : null,
          newValue: method === 'POST' || method === 'PUT' || method === 'PATCH' ? response : null,
          context: {
            ...auditContext,
            statusCode: 200,
            duration,
          },
          success: true,
        });

        this.logger.log({
          message: 'Request completed successfully',
          action,
          resource,
          duration,
          user: user?.email,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        // Emit audit event for failed request
        this.eventEmitter.emit('audit.entry.create', {
          organizationId: user?.organizationId,
          userId: user?.id,
          userEmail: user?.email || 'system',
          userName: user?.name,
          userRole: user?.role,
          action,
          resource,
          resourceId: params.id,
          description: auditMetadata?.description || `Failed to ${action} ${resource}`,
          severity: this.getSeverityFromError(error),
          timestamp: new Date(),
          ipAddress: ip || request.connection.remoteAddress || 'unknown',
          userAgent,
          context: {
            ...auditContext,
            statusCode: error.status || 500,
            duration,
            errorMessage: error.message,
            stackTrace: error.stack,
          },
          success: false,
          failureReason: error.message,
        });

        this.logger.error({
          message: 'Request failed',
          action,
          resource,
          duration,
          user: user?.email,
          error: error.message,
        });

        return throwError(() => error);
      })
    );
  }

  private getActionFromMethod(method: string): AuditAction {
    switch (method.toUpperCase()) {
      case 'GET':
        return AuditAction.READ;
      case 'POST':
        return AuditAction.CREATE;
      case 'PUT':
      case 'PATCH':
        return AuditAction.UPDATE;
      case 'DELETE':
        return AuditAction.DELETE;
      default:
        return AuditAction.CUSTOM;
    }
  }

  private getResourceFromUrl(url: string): AuditResource {
    const segments = url.split('/').filter(Boolean);

    // Map URL segments to resources
    const resourceMap: Record<string, AuditResource> = {
      clients: AuditResource.CLIENT,
      controls: AuditResource.CONTROL,
      policies: AuditResource.POLICY,
      evidence: AuditResource.EVIDENCE,
      findings: AuditResource.FINDING,
      risks: AuditResource.RISK,
      workflows: AuditResource.WORKFLOW,
      reports: AuditResource.REPORT,
      users: AuditResource.USER,
      roles: AuditResource.ROLE,
      integrations: AuditResource.INTEGRATION,
      webhooks: AuditResource.WEBHOOK,
      assessments: AuditResource.ASSESSMENT,
      frameworks: AuditResource.FRAMEWORK,
      documents: AuditResource.DOCUMENT,
      audit: AuditResource.SYSTEM,
    };

    // Find matching resource from URL
    for (const segment of segments) {
      if (resourceMap[segment]) {
        return resourceMap[segment];
      }
    }

    return AuditResource.SYSTEM;
  }

  private extractResourceId(response: any): string | undefined {
    if (!response) return undefined;

    // Try common ID fields
    return response.id || response._id || response.uuid || undefined;
  }

  private extractResourceName(response: any): string | undefined {
    if (!response) return undefined;

    // Try common name fields
    return response.name || response.title || response.displayName || undefined;
  }

  private generateDescription(method: string, url: string, response: any): string {
    const action = method.toLowerCase();
    const resource = url.split('/').filter(Boolean).pop() || 'resource';
    const name = this.extractResourceName(response);

    if (name) {
      return `${action} ${resource}: ${name}`;
    }

    return `${action} ${resource}`;
  }

  private getSeverityFromError(error: any): AuditSeverity {
    const status = error.status || 500;

    if (status >= 500) return AuditSeverity.CRITICAL;
    if (status >= 400 && status < 500) {
      if (status === 401 || status === 403) return AuditSeverity.HIGH;
      return AuditSeverity.MEDIUM;
    }

    return AuditSeverity.LOW;
  }
}
