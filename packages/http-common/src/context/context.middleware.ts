import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type {
  AuditContext,
  RequestContext,
  RequestMetadata,
  UserContext,
} from '../interfaces/request-context.interface';
import { RequestContextService } from './request-context.service';

/**
 * Express middleware that initializes request context from incoming HTTP requests
 * This should be one of the first middleware in the chain
 */
@Injectable()
export class ContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ContextMiddleware.name);

  constructor(private readonly contextService: RequestContextService) {}

  use(req: Request & { context?: RequestContext }, res: Response, next: NextFunction): void {
    try {
      // Extract context from headers
      let context: RequestContext;

      if (this.hasContextHeaders(req)) {
        // Create context from propagated headers
        context = this.contextService.headersToContext(req.headers);
        this.logger.debug('Created context from propagated headers', {
          correlationId: context.correlationId,
          sourceService: context.request.sourceService,
        });
      } else {
        // Initialize new context for external requests
        context = this.initializeNewContext(req);
        this.logger.debug('Initialized new context for external request', {
          correlationId: context.correlationId,
          path: req.path,
          method: req.method,
        });
      }

      // Update request metadata with actual values
      context.request = {
        ...context.request,
        method: req.method,
        path: req.path,
        startTime: new Date(),
      };

      // Attach context to request object for access in controllers
      req.context = context;

      // Set correlation ID in response headers
      res.setHeader('X-Correlation-ID', context.correlationId);

      // Run the rest of the request in the context
      this.contextService.runWithContext(context, () => {
        next();
      });
    } catch (error) {
      this.logger.error('Failed to initialize request context', {
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
        method: req.method,
      });

      // Continue without context rather than failing the request
      next();
    }
  }

  /**
   * Check if request has context propagation headers
   */
  private hasContextHeaders(req: Request): boolean {
    return !!(
      req.headers['x-correlation-id'] ||
      req.headers['x-source-service'] ||
      req.headers['x-user-id']
    );
  }

  /**
   * Initialize new context for external requests
   */
  private initializeNewContext(req: Request): RequestContext {
    // Extract user context from Kong headers (if available)
    const userContext = this.extractUserFromKongHeaders(req);

    // Extract audit context from request
    const auditContext = this.extractAuditContext(req);

    // Create request metadata
    const requestMetadata: Partial<RequestMetadata> = {
      sourceService: process.env.SERVICE_NAME || 'unknown',
      method: req.method,
      path: req.path,
      startTime: new Date(),
    };

    return this.contextService.initializeContext(
      undefined, // Let service generate correlation ID
      userContext,
      auditContext,
      requestMetadata
    );
  }

  /**
   * Extract user context from Kong gateway headers
   */
  private extractUserFromKongHeaders(req: Request): UserContext | undefined {
    // Kong sets these headers after JWT validation
    const userId = this.getHeader(req, 'x-consumer-id');
    const organizationId = this.getHeader(req, 'x-consumer-custom-id');

    if (!userId || !organizationId) {
      return undefined;
    }

    // Try to get additional user info from JWT claims or other headers
    const email = this.getHeader(req, 'x-user-email');
    const displayName = this.getHeader(req, 'x-user-name');
    const rolesHeader = this.getHeader(req, 'x-user-roles');

    return {
      userId,
      organizationId,
      roles: rolesHeader ? rolesHeader.split(',').map((role) => role.trim()) : [],
      email,
      displayName,
    };
  }

  /**
   * Extract audit context from request
   */
  private extractAuditContext(req: Request): AuditContext | undefined {
    // Determine action from HTTP method and path
    const action = this.determineAction(req.method, req.path);
    const resource = this.determineResource(req.path);

    if (!action || !resource) {
      return undefined;
    }

    return {
      action,
      resource,
      timestamp: new Date(),
      clientIp: this.getClientIp(req),
      userAgent: req.headers['user-agent'],
      metadata: {
        httpMethod: req.method,
        path: req.path,
        query: req.query,
      },
    };
  }

  /**
   * Determine action from HTTP method and path
   */
  private determineAction(method: string, path: string): string {
    const httpMethodActions: Record<string, string> = {
      GET: 'read',
      POST: 'create',
      PUT: 'update',
      PATCH: 'update',
      DELETE: 'delete',
    };

    const baseAction = httpMethodActions[method.toUpperCase()] || 'access';

    // Add more specific actions based on path patterns
    if (path.includes('/login')) return 'authenticate';
    if (path.includes('/logout')) return 'logout';
    if (path.includes('/register')) return 'register';
    if (path.includes('/verify')) return 'verify';
    if (path.includes('/reset')) return 'reset_password';
    if (path.includes('/export')) return 'export';
    if (path.includes('/import')) return 'import';
    if (path.includes('/approve')) return 'approve';
    if (path.includes('/reject')) return 'reject';

    return baseAction;
  }

  /**
   * Determine resource from path
   */
  private determineResource(path: string): string {
    // Remove leading slash and split path
    const segments = path.replace(/^\//, '').split('/');

    if (segments.length === 0) return 'unknown';

    // First segment is usually the resource type
    let resource = segments[0];

    // Remove version prefixes
    if (resource.match(/^v\d+$/)) {
      resource = segments[1] || 'unknown';
    }

    // Handle nested resources
    if (segments.length > 2 && segments[2] && !this.isId(segments[1])) {
      resource = `${resource}.${segments[2]}`;
    }

    return resource;
  }

  /**
   * Check if a string looks like an ID (UUID, number, etc.)
   */
  private isId(str: string): boolean {
    return (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) ||
      /^\d+$/.test(str)
    );
  }

  /**
   * Get client IP address
   */
  private getClientIp(req: Request): string | undefined {
    return (
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      (req.headers['x-client-ip'] as string) ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress
    );
  }

  /**
   * Get header value in a case-insensitive way
   */
  private getHeader(req: Request, name: string): string | undefined {
    const value = req.headers[name] || req.headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }
}

/**
 * Functional middleware factory for use in main.ts or module configuration
 */
export function createContextMiddleware(contextService: RequestContextService) {
  return (req: Request & { context?: RequestContext }, res: Response, next: NextFunction) => {
    const middleware = new ContextMiddleware(contextService);
    middleware.use(req, res, next);
  };
}
