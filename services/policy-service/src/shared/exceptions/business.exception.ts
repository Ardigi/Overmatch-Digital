import { HttpException, HttpStatus } from '@nestjs/common';

export enum BusinessErrorCode {
  // Policy errors
  POLICY_NOT_FOUND = 'POLICY_NOT_FOUND',
  POLICY_ALREADY_EXISTS = 'POLICY_ALREADY_EXISTS',
  INVALID_POLICY_TRANSITION = 'INVALID_POLICY_TRANSITION',
  POLICY_NOT_EVALUATABLE = 'POLICY_NOT_EVALUATABLE',
  POLICY_EXPIRED = 'POLICY_EXPIRED',
  POLICY_NOT_APPROVED = 'POLICY_NOT_APPROVED',

  // Control errors
  CONTROL_NOT_FOUND = 'CONTROL_NOT_FOUND',
  CONTROL_ALREADY_EXISTS = 'CONTROL_ALREADY_EXISTS',
  INVALID_CONTROL_STATUS = 'INVALID_CONTROL_STATUS',
  CONTROL_TEST_FAILED = 'CONTROL_TEST_FAILED',

  // Risk errors
  RISK_NOT_FOUND = 'RISK_NOT_FOUND',
  RISK_ALREADY_EXISTS = 'RISK_ALREADY_EXISTS',
  INVALID_RISK_ASSESSMENT = 'INVALID_RISK_ASSESSMENT',

  // Framework errors
  FRAMEWORK_NOT_FOUND = 'FRAMEWORK_NOT_FOUND',
  FRAMEWORK_ALREADY_EXISTS = 'FRAMEWORK_ALREADY_EXISTS',
  FRAMEWORK_IN_USE = 'FRAMEWORK_IN_USE',

  // Authorization errors
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ORGANIZATION_ACCESS_DENIED = 'ORGANIZATION_ACCESS_DENIED',
  RESOURCE_ACCESS_DENIED = 'RESOURCE_ACCESS_DENIED',

  // Workflow errors
  INVALID_WORKFLOW_STATE = 'INVALID_WORKFLOW_STATE',
  WORKFLOW_TRANSITION_NOT_ALLOWED = 'WORKFLOW_TRANSITION_NOT_ALLOWED',

  // Integration errors
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  OPA_COMPILATION_ERROR = 'OPA_COMPILATION_ERROR',
  ELASTICSEARCH_ERROR = 'ELASTICSEARCH_ERROR',

  // Validation errors
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',

  // Generic errors
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',
}

export interface BusinessErrorDetails {
  code: BusinessErrorCode;
  message: string;
  details?: any;
  field?: string;
  resource?: string;
  resourceId?: string;
}

export class BusinessException extends HttpException {
  constructor(
    private readonly errorDetails: BusinessErrorDetails,
    status: HttpStatus = HttpStatus.BAD_REQUEST
  ) {
    super(
      {
        code: errorDetails.code,
        message: errorDetails.message,
        details: errorDetails.details,
        field: errorDetails.field,
        resource: errorDetails.resource,
        resourceId: errorDetails.resourceId,
        timestamp: new Date().toISOString(),
      },
      status
    );
  }

  getErrorCode(): BusinessErrorCode {
    return this.errorDetails.code;
  }

  getErrorDetails(): BusinessErrorDetails {
    return this.errorDetails;
  }
}

// Convenience exception classes for common scenarios
export class ResourceNotFoundException extends BusinessException {
  constructor(resource: string, resourceId: string) {
    super(
      {
        code: BusinessErrorCode.POLICY_NOT_FOUND,
        message: `${resource} with ID ${resourceId} not found`,
        resource,
        resourceId,
      },
      HttpStatus.NOT_FOUND
    );
  }
}

export class ResourceAlreadyExistsException extends BusinessException {
  constructor(resource: string, field: string, value: string) {
    super(
      {
        code: BusinessErrorCode.POLICY_ALREADY_EXISTS,
        message: `${resource} with ${field} '${value}' already exists`,
        resource,
        field,
        details: { [field]: value },
      },
      HttpStatus.CONFLICT
    );
  }
}

export class InvalidStateTransitionException extends BusinessException {
  constructor(resource: string, currentState: string, targetState: string) {
    super(
      {
        code: BusinessErrorCode.INVALID_POLICY_TRANSITION,
        message: `Cannot transition ${resource} from ${currentState} to ${targetState}`,
        resource,
        details: { currentState, targetState },
      },
      HttpStatus.BAD_REQUEST
    );
  }
}

export class InsufficientPermissionsException extends BusinessException {
  constructor(action: string, resource: string, resourceId?: string) {
    super(
      {
        code: BusinessErrorCode.INSUFFICIENT_PERMISSIONS,
        message: `Insufficient permissions to ${action} ${resource}`,
        resource,
        resourceId,
        details: { action },
      },
      HttpStatus.FORBIDDEN
    );
  }
}

export class ExternalServiceException extends BusinessException {
  constructor(service: string, operation: string, details?: any) {
    super(
      {
        code: BusinessErrorCode.EXTERNAL_SERVICE_ERROR,
        message: `External service error: ${service} failed during ${operation}`,
        details: { service, operation, ...details },
      },
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }
}

export class ValidationException extends BusinessException {
  constructor(field: string, message: string, value?: any) {
    super(
      {
        code: BusinessErrorCode.INVALID_INPUT,
        message,
        field,
        details: { value },
      },
      HttpStatus.BAD_REQUEST
    );
  }
}

export class ConcurrentModificationException extends BusinessException {
  constructor(resource: string, resourceId: string) {
    super(
      {
        code: BusinessErrorCode.CONCURRENT_MODIFICATION,
        message: `${resource} was modified by another user`,
        resource,
        resourceId,
      },
      HttpStatus.CONFLICT
    );
  }
}
