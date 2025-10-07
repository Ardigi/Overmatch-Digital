import { v4 as uuidv4 } from 'uuid';
import type {
  PaginatedResponse,
  ResponseMetadata,
  ServiceError,
  ServiceResponse,
} from '../interfaces/http-response.interface';

/**
 * Utility class for building standardized API responses
 * Ensures consistent response format across all services
 */
export class ResponseBuilder {
  /**
   * Build a successful response
   * @param data - The response data
   * @param message - Optional success message
   * @param metadata - Optional response metadata
   * @returns Standardized success response
   */
  static success<T>(
    data: T,
    message?: string,
    metadata?: Partial<ResponseMetadata>
  ): ServiceResponse<T> {
    return {
      success: true,
      data,
      metadata: {
        requestId: uuidv4(),
        timestamp: new Date(),
        ...metadata,
        ...(message && { message }),
      },
    };
  }

  /**
   * Build an error response
   * @param code - Error code
   * @param message - Error message
   * @param details - Optional error details
   * @param service - Service name that generated the error
   * @returns Standardized error response
   */
  static error(
    code: string,
    message: string,
    details?: any,
    service?: string
  ): ServiceResponse<null> {
    const error: ServiceError = {
      code,
      message,
      timestamp: new Date(),
      ...(details && { details }),
      ...(service && { service }),
    };

    return {
      success: false,
      error,
      metadata: {
        requestId: uuidv4(),
        timestamp: new Date(),
        ...(service && { service }),
      },
    };
  }

  /**
   * Build a paginated response
   * @param items - Array of items
   * @param total - Total number of items
   * @param page - Current page number (1-based)
   * @param pageSize - Number of items per page
   * @param message - Optional success message
   * @param metadata - Optional response metadata
   * @returns Standardized paginated response
   */
  static paginated<T>(
    items: T[],
    total: number,
    page: number,
    pageSize: number,
    message?: string,
    metadata?: Partial<ResponseMetadata>
  ): ServiceResponse<PaginatedResponse<T>> {
    const totalPages = Math.ceil(total / pageSize);

    const paginatedData: PaginatedResponse<T> = {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };

    return ResponseBuilder.success(paginatedData, message, {
      ...metadata,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  }

  /**
   * Build a response with validation errors
   * @param validationErrors - Array of validation error details
   * @param message - Optional error message
   * @returns Standardized validation error response
   */
  static validationError(
    validationErrors: Array<{
      field: string;
      message: string;
      value?: any;
      constraint?: string;
    }>,
    message = 'Validation failed'
  ): ServiceResponse<null> {
    return ResponseBuilder.error('VALIDATION_FAILED', message, {
      validationErrors,
      type: 'VALIDATION',
    });
  }

  /**
   * Build a not found error response
   * @param resource - The resource that was not found
   * @param id - Optional resource ID
   * @returns Standardized not found error response
   */
  static notFound(resource: string, id?: string): ServiceResponse<null> {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;

    return ResponseBuilder.error('NOT_FOUND', message, {
      resource,
      ...(id && { id }),
      type: 'NOT_FOUND',
    });
  }

  /**
   * Build an unauthorized error response
   * @param message - Optional error message
   * @returns Standardized unauthorized error response
   */
  static unauthorized(message = 'Unauthorized access'): ServiceResponse<null> {
    return ResponseBuilder.error('UNAUTHORIZED', message, {
      type: 'AUTHORIZATION',
    });
  }

  /**
   * Build a forbidden error response
   * @param message - Optional error message
   * @param requiredRole - Optional required role information
   * @returns Standardized forbidden error response
   */
  static forbidden(message = 'Access forbidden', requiredRole?: string): ServiceResponse<null> {
    return ResponseBuilder.error('FORBIDDEN', message, {
      type: 'AUTHORIZATION',
      ...(requiredRole && { requiredRole }),
    });
  }

  /**
   * Build a conflict error response
   * @param resource - The resource that conflicts
   * @param constraint - The constraint that was violated
   * @returns Standardized conflict error response
   */
  static conflict(resource: string, constraint?: string): ServiceResponse<null> {
    const message = constraint
      ? `${resource} conflicts with existing ${constraint}`
      : `${resource} already exists`;

    return ResponseBuilder.error('CONFLICT', message, {
      resource,
      ...(constraint && { constraint }),
      type: 'CONFLICT',
    });
  }

  /**
   * Build an internal server error response
   * @param message - Optional error message
   * @param errorDetails - Optional error details (should not include sensitive info)
   * @returns Standardized internal server error response
   */
  static internalError(
    message = 'Internal server error',
    errorDetails?: any
  ): ServiceResponse<null> {
    return ResponseBuilder.error('INTERNAL_ERROR', message, {
      type: 'INTERNAL',
      ...(errorDetails && { details: errorDetails }),
    });
  }

  /**
   * Build a bad request error response
   * @param message - Error message
   * @param details - Optional error details
   * @returns Standardized bad request error response
   */
  static badRequest(message: string, details?: any): ServiceResponse<null> {
    return ResponseBuilder.error('BAD_REQUEST', message, {
      type: 'VALIDATION',
      ...(details && { details }),
    });
  }

  /**
   * Build a rate limit exceeded error response
   * @param retryAfter - Seconds until retry is allowed
   * @returns Standardized rate limit error response
   */
  static rateLimitExceeded(retryAfter?: number): ServiceResponse<null> {
    return ResponseBuilder.error('RATE_LIMIT_EXCEEDED', 'Too many requests', {
      type: 'RATE_LIMIT',
      ...(retryAfter && { retryAfter }),
    });
  }

  /**
   * Build a service unavailable error response
   * @param service - The unavailable service
   * @param retryAfter - Optional retry time in seconds
   * @returns Standardized service unavailable error response
   */
  static serviceUnavailable(service?: string, retryAfter?: number): ServiceResponse<null> {
    const message = service
      ? `Service ${service} is temporarily unavailable`
      : 'Service temporarily unavailable';

    return ResponseBuilder.error('SERVICE_UNAVAILABLE', message, {
      type: 'EXTERNAL',
      ...(service && { service }),
      ...(retryAfter && { retryAfter }),
    });
  }

  /**
   * Transform any data into a standardized response
   * @param data - The data to transform
   * @param metadata - Optional metadata
   * @returns Standardized response
   */
  static wrap<T>(data: T, metadata?: Partial<ResponseMetadata>): ServiceResponse<T> {
    // If data is already a ServiceResponse, return as-is
    if (data && typeof data === 'object' && 'success' in data) {
      return data as ServiceResponse<T>;
    }

    return ResponseBuilder.success(data, undefined, metadata);
  }

  /**
   * Create metadata with timing information
   * @param startTime - Request start time
   * @param service - Service name
   * @param version - Service version
   * @param correlationId - Correlation ID
   * @returns Response metadata with duration
   */
  static createMetadata(
    startTime: Date,
    service?: string,
    version?: string,
    correlationId?: string
  ): ResponseMetadata {
    const duration = Date.now() - startTime.getTime();

    return {
      requestId: uuidv4(),
      duration,
      timestamp: new Date(),
      ...(service && { service }),
      ...(version && { version }),
      ...(correlationId && { correlationId }),
    };
  }
}

/**
 * Pagination helper utilities
 */
export class PaginationHelper {
  /**
   * Calculate pagination metadata
   * @param page - Current page (1-based)
   * @param pageSize - Items per page
   * @param total - Total number of items
   * @returns Pagination metadata
   */
  static calculatePagination(page: number, pageSize: number, total: number) {
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    return {
      page,
      pageSize,
      total,
      totalPages,
      offset,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      isFirst: page === 1,
      isLast: page === totalPages,
    };
  }

  /**
   * Validate pagination parameters
   * @param page - Page number
   * @param pageSize - Page size
   * @param maxPageSize - Maximum allowed page size
   * @returns Validated and normalized pagination params
   */
  static validatePagination(page: number = 1, pageSize: number = 10, maxPageSize: number = 100) {
    // Normalize page (minimum 1)
    const normalizedPage = Math.max(1, Math.floor(page));

    // Normalize page size (minimum 1, maximum maxPageSize)
    const normalizedPageSize = Math.min(maxPageSize, Math.max(1, Math.floor(pageSize)));

    return {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      offset: (normalizedPage - 1) * normalizedPageSize,
    };
  }

  /**
   * Create pagination links for REST APIs
   * @param baseUrl - Base URL for the resource
   * @param page - Current page
   * @param pageSize - Page size
   * @param total - Total items
   * @param queryParams - Additional query parameters
   * @returns Pagination links
   */
  static createPaginationLinks(
    baseUrl: string,
    page: number,
    pageSize: number,
    total: number,
    queryParams: Record<string, any> = {}
  ) {
    const totalPages = Math.ceil(total / pageSize);
    const queryString = new URLSearchParams({
      ...queryParams,
      pageSize: pageSize.toString(),
    }).toString();

    const buildUrl = (targetPage: number) => {
      const params = new URLSearchParams({
        ...queryParams,
        page: targetPage.toString(),
        pageSize: pageSize.toString(),
      });
      return `${baseUrl}?${params.toString()}`;
    };

    const links: Record<string, string> = {
      self: buildUrl(page),
    };

    if (page > 1) {
      links.first = buildUrl(1);
      links.prev = buildUrl(page - 1);
    }

    if (page < totalPages) {
      links.next = buildUrl(page + 1);
      links.last = buildUrl(totalPages);
    }

    return links;
  }
}
