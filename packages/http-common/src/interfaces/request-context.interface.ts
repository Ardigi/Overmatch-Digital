/**
 * Request context interfaces for cross-service request tracking
 */

export interface UserContext {
  /** Unique user identifier */
  userId: string;
  /** Organization the user belongs to */
  organizationId: string;
  /** User roles for authorization */
  roles: string[];
  /** User email for audit trails */
  email?: string;
  /** User display name */
  displayName?: string;
}

export interface AuditContext {
  /** Action being performed */
  action: string;
  /** Resource being accessed */
  resource: string;
  /** Timestamp when the action was initiated */
  timestamp: Date;
  /** IP address of the client */
  clientIp?: string;
  /** User agent string */
  userAgent?: string;
  /** Additional metadata for the audit */
  metadata?: Record<string, any>;
}

export interface RequestMetadata {
  /** Source service making the request */
  sourceService: string;
  /** Target service receiving the request */
  targetService?: string;
  /** HTTP method used */
  method: string;
  /** Request path */
  path: string;
  /** Timestamp when request started */
  startTime: Date;
  /** Additional request metadata */
  metadata?: Record<string, any>;
}

export interface RequestContext {
  /** Unique correlation ID for tracing across services */
  correlationId: string;
  /** User context information */
  user?: UserContext;
  /** Audit context for compliance tracking */
  audit?: AuditContext;
  /** Request metadata */
  request: RequestMetadata;
  /** Custom context data */
  custom?: Record<string, any>;
}

export interface ContextHeaders {
  /** Correlation ID header */
  'x-correlation-id': string;
  /** User ID header */
  'x-user-id'?: string;
  /** Organization ID header */
  'x-organization-id'?: string;
  /** User roles header (comma-separated) */
  'x-user-roles'?: string;
  /** User email header */
  'x-user-email'?: string;
  /** Source service header */
  'x-source-service': string;
  /** Target service header */
  'x-target-service'?: string;
  /** Audit action header */
  'x-audit-action'?: string;
  /** Audit resource header */
  'x-audit-resource'?: string;
  /** Client IP header */
  'x-client-ip'?: string;
  /** Request timestamp header */
  'x-request-timestamp'?: string;
}

export type ContextHeaderKey = keyof ContextHeaders;

export interface ContextOptions {
  /** Whether to include user context in propagation */
  includeUser?: boolean;
  /** Whether to include audit context in propagation */
  includeAudit?: boolean;
  /** Whether to include request metadata in propagation */
  includeMetadata?: boolean;
  /** Custom headers to include */
  customHeaders?: Record<string, string>;
}
