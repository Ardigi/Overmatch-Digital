/**
 * Enterprise Error Handling System
 * 
 * Provides structured error handling with:
 * - Standardized error types
 * - Error correlation and tracing
 * - Security-aware error sanitization
 * - Audit trail integration
 * - Circuit breaker patterns
 */

import { HttpException, HttpStatus } from '@nestjs/common';

export enum ErrorCode {
  // Authentication & Authorization
  AUTHENTICATION_FAILED = 'AUTH_001',
  AUTHORIZATION_FAILED = 'AUTH_002',
  TOKEN_EXPIRED = 'AUTH_003',
  INVALID_CREDENTIALS = 'AUTH_004',
  INSUFFICIENT_PERMISSIONS = 'AUTH_005',
  
  // Business Logic
  POLICY_VALIDATION_FAILED = 'BIZ_001',
  CONTROL_MAPPING_INVALID = 'BIZ_002',
  FRAMEWORK_CONFLICT = 'BIZ_003',
  ASSESSMENT_INCOMPLETE = 'BIZ_004',
  WORKFLOW_STATE_INVALID = 'BIZ_005',
  
  // Data Integrity
  RESOURCE_NOT_FOUND = 'DATA_001',
  DUPLICATE_RESOURCE = 'DATA_002',
  CONSTRAINT_VIOLATION = 'DATA_003',
  DATA_CORRUPTION = 'DATA_004',
  RELATIONSHIP_VIOLATION = 'DATA_005',
  
  // External Services
  EXTERNAL_SERVICE_UNAVAILABLE = 'EXT_001',
  EXTERNAL_SERVICE_TIMEOUT = 'EXT_002',
  EXTERNAL_SERVICE_ERROR = 'EXT_003',
  OPA_EVALUATION_FAILED = 'EXT_004',
  ELASTICSEARCH_ERROR = 'EXT_005',
  
  // System
  CONFIGURATION_ERROR = 'SYS_001',
  RESOURCE_EXHAUSTED = 'SYS_002',
  SERVICE_DEGRADED = 'SYS_003',
  CIRCUIT_BREAKER_OPEN = 'SYS_004',
  RATE_LIMIT_EXCEEDED = 'SYS_005',
  
  // Security
  SECURITY_VIOLATION = 'SEC_001',
  SUSPICIOUS_ACTIVITY = 'SEC_002',
  INPUT_VALIDATION_FAILED = 'SEC_003',
  INJECTION_ATTEMPT = 'SEC_004',
  AUDIT_LOG_CORRUPTION = 'SEC_005',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorContext {
  correlationId: string;
  userId?: string;
  organizationId?: string;
  operation: string;
  resource?: string;
  resourceId?: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  additionalData?: Record<string, unknown>;
}

export interface ErrorMetadata {
  code: ErrorCode;
  severity: ErrorSeverity;
  category: 'authentication' | 'authorization' | 'business' | 'data' | 'external' | 'system' | 'security';
  retryable: boolean;
  sanitizeForClient: boolean;
  auditRequired: boolean;
  alertRequired: boolean;
}

export class EnterpriseError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly category: string;
  public readonly context: ErrorContext;
  public readonly metadata: ErrorMetadata;
  public readonly timestamp: Date;
  public readonly retryable: boolean;
  public readonly cause?: Error;

  constructor(
    message: string,
    code: ErrorCode,
    context: ErrorContext,
    metadata?: Partial<ErrorMetadata>,
    cause?: Error
  ) {
    super(message);
    this.name = 'EnterpriseError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    this.cause = cause;
    
    // Set metadata with defaults
    this.metadata = {
      code,
      severity: metadata?.severity || this.getDefaultSeverity(code),
      category: metadata?.category || this.getDefaultCategory(code),
      retryable: metadata?.retryable ?? this.getDefaultRetryable(code),
      sanitizeForClient: metadata?.sanitizeForClient ?? this.getDefaultSanitize(code),
      auditRequired: metadata?.auditRequired ?? this.getDefaultAuditRequired(code),
      alertRequired: metadata?.alertRequired ?? this.getDefaultAlertRequired(code),
      ...metadata,
    };
    
    this.severity = this.metadata.severity;
    this.category = this.metadata.category;
    this.retryable = this.metadata.retryable;

    // Capture stack trace
    Error.captureStackTrace(this, EnterpriseError);
  }

  /**
   * Get sanitized error message for client response
   */
  getClientMessage(): string {
    if (!this.metadata.sanitizeForClient) {
      return this.message;
    }

    // Return generic message for security-sensitive errors
    switch (this.metadata.category) {
      case 'security':
        return 'A security violation was detected';
      case 'authentication':
        return 'Authentication failed';
      case 'authorization':
        return 'Access denied';
      case 'system':
        return 'A system error occurred';
      default:
        return 'An error occurred while processing your request';
    }
  }

  /**
   * Get HTTP status code for this error
   */
  getHttpStatus(): HttpStatus {
    switch (this.code) {
      case ErrorCode.AUTHENTICATION_FAILED:
      case ErrorCode.TOKEN_EXPIRED:
      case ErrorCode.INVALID_CREDENTIALS:
        return HttpStatus.UNAUTHORIZED;
        
      case ErrorCode.AUTHORIZATION_FAILED:
      case ErrorCode.INSUFFICIENT_PERMISSIONS:
        return HttpStatus.FORBIDDEN;
        
      case ErrorCode.RESOURCE_NOT_FOUND:
        return HttpStatus.NOT_FOUND;
        
      case ErrorCode.DUPLICATE_RESOURCE:
      case ErrorCode.CONSTRAINT_VIOLATION:
      case ErrorCode.POLICY_VALIDATION_FAILED:
      case ErrorCode.INPUT_VALIDATION_FAILED:
        return HttpStatus.BAD_REQUEST;
        
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return HttpStatus.TOO_MANY_REQUESTS;
        
      case ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE:
      case ErrorCode.SERVICE_DEGRADED:
        return HttpStatus.SERVICE_UNAVAILABLE;
        
      case ErrorCode.EXTERNAL_SERVICE_TIMEOUT:
        return HttpStatus.GATEWAY_TIMEOUT;
        
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }

  /**
   * Convert to HTTP exception
   */
  toHttpException(): HttpException {
    const status = this.getHttpStatus();
    const response = {
      statusCode: status,
      error: this.code,
      message: this.getClientMessage(),
      correlationId: this.context.correlationId,
      timestamp: this.timestamp.toISOString(),
      path: this.context.operation,
    };

    return new HttpException(response, status);
  }

  /**
   * Get structured log data
   */
  toLogData(): Record<string, unknown> {
    return {
      error: {
        name: this.name,
        message: this.message,
        code: this.code,
        severity: this.severity,
        category: this.category,
        retryable: this.retryable,
        stack: this.stack,
      },
      context: this.context,
      metadata: this.metadata,
      timestamp: this.timestamp.toISOString(),
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack,
      } : undefined,
    };
  }

  private getDefaultSeverity(code: ErrorCode): ErrorSeverity {
    const criticalCodes = [
      ErrorCode.SECURITY_VIOLATION,
      ErrorCode.DATA_CORRUPTION,
      ErrorCode.AUDIT_LOG_CORRUPTION,
    ];
    
    const highCodes = [
      ErrorCode.SUSPICIOUS_ACTIVITY,
      ErrorCode.INJECTION_ATTEMPT,
      ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
    ];
    
    if (criticalCodes.includes(code)) return ErrorSeverity.CRITICAL;
    if (highCodes.includes(code)) return ErrorSeverity.HIGH;
    return ErrorSeverity.MEDIUM;
  }

  private getDefaultCategory(code: ErrorCode): ErrorMetadata['category'] {
    if (code.startsWith('AUTH_')) return 'authentication';
    if (code.startsWith('BIZ_')) return 'business';
    if (code.startsWith('DATA_')) return 'data';
    if (code.startsWith('EXT_')) return 'external';
    if (code.startsWith('SYS_')) return 'system';
    if (code.startsWith('SEC_')) return 'security';
    return 'system';
  }

  private getDefaultRetryable(code: ErrorCode): boolean {
    const retryableCodes = [
      ErrorCode.EXTERNAL_SERVICE_TIMEOUT,
      ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
      ErrorCode.RESOURCE_EXHAUSTED,
      ErrorCode.SERVICE_DEGRADED,
    ];
    return retryableCodes.includes(code);
  }

  private getDefaultSanitize(code: ErrorCode): boolean {
    const sanitizeCodes = [
      ErrorCode.SECURITY_VIOLATION,
      ErrorCode.SUSPICIOUS_ACTIVITY,
      ErrorCode.INJECTION_ATTEMPT,
      ErrorCode.CONFIGURATION_ERROR,
    ];
    return sanitizeCodes.includes(code);
  }

  private getDefaultAuditRequired(code: ErrorCode): boolean {
    const auditCodes = [
      ErrorCode.AUTHENTICATION_FAILED,
      ErrorCode.AUTHORIZATION_FAILED,
      ErrorCode.SECURITY_VIOLATION,
      ErrorCode.SUSPICIOUS_ACTIVITY,
      ErrorCode.INJECTION_ATTEMPT,
    ];
    return auditCodes.includes(code);
  }

  private getDefaultAlertRequired(code: ErrorCode): boolean {
    const alertCodes = [
      ErrorCode.SECURITY_VIOLATION,
      ErrorCode.SUSPICIOUS_ACTIVITY,
      ErrorCode.DATA_CORRUPTION,
      ErrorCode.AUDIT_LOG_CORRUPTION,
    ];
    return alertCodes.includes(code);
  }
}

/**
 * Factory functions for common error types
 */
export class ErrorFactory {
  static createAuthenticationError(
    message: string,
    context: ErrorContext,
    cause?: Error
  ): EnterpriseError {
    return new EnterpriseError(
      message,
      ErrorCode.AUTHENTICATION_FAILED,
      context,
      { category: 'authentication' },
      cause
    );
  }

  static createAuthorizationError(
    message: string,
    context: ErrorContext,
    cause?: Error
  ): EnterpriseError {
    return new EnterpriseError(
      message,
      ErrorCode.AUTHORIZATION_FAILED,
      context,
      { category: 'authorization' },
      cause
    );
  }

  static createValidationError(
    message: string,
    context: ErrorContext,
    cause?: Error
  ): EnterpriseError {
    return new EnterpriseError(
      message,
      ErrorCode.POLICY_VALIDATION_FAILED,
      context,
      { category: 'business', retryable: false },
      cause
    );
  }

  static createNotFoundError(
    message: string,
    context: ErrorContext,
    cause?: Error
  ): EnterpriseError {
    return new EnterpriseError(
      message,
      ErrorCode.RESOURCE_NOT_FOUND,
      context,
      { category: 'data', retryable: false },
      cause
    );
  }

  static createSecurityError(
    message: string,
    context: ErrorContext,
    cause?: Error
  ): EnterpriseError {
    return new EnterpriseError(
      message,
      ErrorCode.SECURITY_VIOLATION,
      context,
      { 
        category: 'security',
        severity: ErrorSeverity.CRITICAL,
        sanitizeForClient: true,
        auditRequired: true,
        alertRequired: true,
      },
      cause
    );
  }

  static createExternalServiceError(
    message: string,
    context: ErrorContext,
    cause?: Error
  ): EnterpriseError {
    return new EnterpriseError(
      message,
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      context,
      { category: 'external', retryable: true },
      cause
    );
  }
}

/**
 * Type guards for error handling
 */
export function isEnterpriseError(error: unknown): error is EnterpriseError {
  return error instanceof EnterpriseError;
}

export function isRetryableError(error: unknown): boolean {
  return isEnterpriseError(error) && error.retryable;
}

export function requiresAudit(error: unknown): boolean {
  return isEnterpriseError(error) && error.metadata.auditRequired;
}

export function requiresAlert(error: unknown): boolean {
  return isEnterpriseError(error) && error.metadata.alertRequired;
}