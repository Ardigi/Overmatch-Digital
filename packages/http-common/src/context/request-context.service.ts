import { Injectable, Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { v4 as uuidv4 } from 'uuid';
import type {
  AuditContext,
  ContextHeaders,
  ContextOptions,
  RequestContext,
  RequestMetadata,
  UserContext,
} from '../interfaces/request-context.interface';

/**
 * Service for managing request context across service boundaries
 * Uses AsyncLocalStorage to maintain context throughout the request lifecycle
 */
@Injectable()
export class RequestContextService {
  private readonly logger = new Logger(RequestContextService.name);
  private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

  /**
   * Initialize a new request context
   */
  initializeContext(
    correlationId?: string,
    user?: UserContext,
    audit?: AuditContext,
    request?: Partial<RequestMetadata>
  ): RequestContext {
    const context: RequestContext = {
      correlationId: correlationId || this.generateCorrelationId(),
      user,
      audit,
      request: {
        sourceService: process.env.SERVICE_NAME || 'unknown',
        method: 'unknown',
        path: 'unknown',
        startTime: new Date(),
        ...request,
      },
    };

    this.logger.debug('Initialized request context', {
      correlationId: context.correlationId,
      userId: user?.userId,
      organizationId: user?.organizationId,
      sourceService: context.request.sourceService,
    });

    return context;
  }

  /**
   * Run code within a request context
   */
  runWithContext<T>(context: RequestContext, callback: () => T): T {
    return this.asyncLocalStorage.run(context, callback);
  }

  /**
   * Get the current request context
   */
  getCurrentContext(): RequestContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Get the correlation ID from current context
   */
  getCorrelationId(): string | undefined {
    const context = this.getCurrentContext();
    return context?.correlationId;
  }

  /**
   * Get the user context from current context
   */
  getUserContext(): UserContext | undefined {
    const context = this.getCurrentContext();
    return context?.user;
  }

  /**
   * Get the audit context from current context
   */
  getAuditContext(): AuditContext | undefined {
    const context = this.getCurrentContext();
    return context?.audit;
  }

  /**
   * Get request metadata from current context
   */
  getRequestMetadata(): RequestMetadata | undefined {
    const context = this.getCurrentContext();
    return context?.request;
  }

  /**
   * Update the current context with new data
   */
  updateContext(updates: Partial<RequestContext>): void {
    const currentContext = this.getCurrentContext();
    if (!currentContext) {
      this.logger.warn('Attempted to update context but no context is available');
      return;
    }

    // Deep merge the updates
    Object.assign(currentContext, {
      ...updates,
      user: updates.user ? { ...currentContext.user, ...updates.user } : currentContext.user,
      audit: updates.audit ? { ...currentContext.audit, ...updates.audit } : currentContext.audit,
      request: updates.request
        ? { ...currentContext.request, ...updates.request }
        : currentContext.request,
      custom: updates.custom
        ? { ...currentContext.custom, ...updates.custom }
        : currentContext.custom,
    });
  }

  /**
   * Set custom data in the current context
   */
  setCustomData(key: string, value: any): void {
    const context = this.getCurrentContext();
    if (!context) {
      this.logger.warn('Attempted to set custom data but no context is available');
      return;
    }

    if (!context.custom) {
      context.custom = {};
    }
    context.custom[key] = value;
  }

  /**
   * Get custom data from the current context
   */
  getCustomData<T = any>(key: string): T | undefined {
    const context = this.getCurrentContext();
    return context?.custom?.[key] as T;
  }

  /**
   * Convert request context to HTTP headers for propagation
   */
  contextToHeaders(context?: RequestContext, options?: ContextOptions): ContextHeaders {
    const ctx = context || this.getCurrentContext();
    if (!ctx) {
      throw new Error('No request context available');
    }

    const headers: Partial<ContextHeaders> = {
      'x-correlation-id': ctx.correlationId,
      'x-source-service': ctx.request.sourceService,
    };

    // Include user context if available and not explicitly excluded
    if (ctx.user && options?.includeUser !== false) {
      headers['x-user-id'] = ctx.user.userId;
      headers['x-organization-id'] = ctx.user.organizationId;
      headers['x-user-roles'] = ctx.user.roles.join(',');
      if (ctx.user.email) {
        headers['x-user-email'] = ctx.user.email;
      }
    }

    // Include audit context if available and not explicitly excluded
    if (ctx.audit && options?.includeAudit !== false) {
      headers['x-audit-action'] = ctx.audit.action;
      headers['x-audit-resource'] = ctx.audit.resource;
      if (ctx.audit.clientIp) {
        headers['x-client-ip'] = ctx.audit.clientIp;
      }
    }

    // Include request metadata if not explicitly excluded
    if (options?.includeMetadata !== false) {
      headers['x-request-timestamp'] = ctx.request.startTime.toISOString();
      if (ctx.request.targetService) {
        headers['x-target-service'] = ctx.request.targetService;
      }
    }

    // Include custom headers
    if (options?.customHeaders) {
      Object.assign(headers, options.customHeaders);
    }

    return headers as ContextHeaders;
  }

  /**
   * Create request context from HTTP headers
   */
  headersToContext(headers: Record<string, string | string[] | undefined>): RequestContext {
    const getHeader = (key: string): string | undefined => {
      const value = headers[key] || headers[key.toLowerCase()];
      return Array.isArray(value) ? value[0] : value;
    };

    const correlationId = getHeader('x-correlation-id') || this.generateCorrelationId();
    const sourceService = getHeader('x-source-service') || 'unknown';

    // Build user context if headers are present
    let user: UserContext | undefined;
    const userId = getHeader('x-user-id');
    const organizationId = getHeader('x-organization-id');
    const rolesHeader = getHeader('x-user-roles');

    if (userId && organizationId) {
      user = {
        userId,
        organizationId,
        roles: rolesHeader ? rolesHeader.split(',').map((role) => role.trim()) : [],
        email: getHeader('x-user-email'),
      };
    }

    // Build audit context if headers are present
    let audit: AuditContext | undefined;
    const auditAction = getHeader('x-audit-action');
    const auditResource = getHeader('x-audit-resource');

    if (auditAction && auditResource) {
      audit = {
        action: auditAction,
        resource: auditResource,
        timestamp: new Date(),
        clientIp: getHeader('x-client-ip'),
      };
    }

    // Build request metadata
    const requestTimestamp = getHeader('x-request-timestamp');
    const request: RequestMetadata = {
      sourceService,
      targetService: getHeader('x-target-service'),
      method: 'unknown',
      path: 'unknown',
      startTime: requestTimestamp ? new Date(requestTimestamp) : new Date(),
    };

    const context: RequestContext = {
      correlationId,
      user,
      audit,
      request,
    };

    this.logger.debug('Created context from headers', {
      correlationId,
      userId: user?.userId,
      organizationId: user?.organizationId,
      sourceService,
    });

    return context;
  }

  /**
   * Create a child context for outgoing requests
   */
  createChildContext(targetService?: string, action?: string, resource?: string): RequestContext {
    const parentContext = this.getCurrentContext();
    if (!parentContext) {
      throw new Error('No parent context available');
    }

    const childContext: RequestContext = {
      ...parentContext,
      request: {
        ...parentContext.request,
        targetService,
        startTime: new Date(),
      },
    };

    // Update audit context if action/resource provided
    if (action && resource) {
      childContext.audit = {
        ...parentContext.audit,
        action,
        resource,
        timestamp: new Date(),
      };
    }

    return childContext;
  }

  /**
   * Generate a new correlation ID
   */
  private generateCorrelationId(): string {
    return `req_${uuidv4().replace(/-/g, '')}`;
  }

  /**
   * Log context information for debugging
   */
  logContext(message?: string): void {
    const context = this.getCurrentContext();
    if (!context) {
      this.logger.debug('No request context available');
      return;
    }

    this.logger.debug(message || 'Current request context', {
      correlationId: context.correlationId,
      userId: context.user?.userId,
      organizationId: context.user?.organizationId,
      sourceService: context.request.sourceService,
      targetService: context.request.targetService,
      auditAction: context.audit?.action,
      auditResource: context.audit?.resource,
    });
  }
}
