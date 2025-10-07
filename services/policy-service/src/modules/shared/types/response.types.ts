/**
 * Enterprise Response Types for Policy Service
 * These types ensure consistent API responses across all endpoints
 */

/**
 * Pagination metadata for API responses
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Generic paginated response with metadata
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Alternative paginated response format used by some endpoints
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  meta?: PaginationMeta;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: Array<{
    item: any;
    error: string;
  }>;
  results?: any[];
}

/**
 * Validation result for data validation operations
 */
export interface ValidationResult {
  valid: boolean;
  issues: string[];
  errors?: Array<{
    field: string;
    message: string;
    value?: any;
  }>;
}

/**
 * Import operation result
 */
export interface ImportResult {
  imported: number;
  failed: number;
  errors: Array<{
    line?: number;
    data?: any;
    error: string;
  }>;
}

/**
 * Statistics result for analytics endpoints
 */
export interface StatisticsResult {
  total: number;
  byStatus?: Record<string, number>;
  byType?: Record<string, number>;
  byCategory?: Record<string, number>;
  trend?: {
    period: string;
    data: Array<{
      date: string;
      value: number;
    }>;
  };
}

/**
 * Coverage report result
 */
export interface CoverageResult {
  totalControls: number;
  coveredControls: number;
  coveragePercentage: number;
  byCategory?: Record<string, {
    total: number;
    covered: number;
    percentage: number;
  }>;
  gaps?: Array<{
    control: string;
    description: string;
    priority: string;
  }>;
}

/**
 * Compliance score result
 */
export interface ComplianceScoreResult {
  score: number;
  maxScore: number;
  percentage: number;
  breakdown?: Record<string, {
    score: number;
    maxScore: number;
    percentage: number;
  }>;
  recommendations?: string[];
}

/**
 * Audit trail entry
 */
export interface AuditEntry {
  timestamp: Date;
  action: string;
  userId: string;
  userName?: string;
  changes?: Record<string, {
    old: any;
    new: any;
  }>;
  metadata?: Record<string, any>;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp?: Date;
}

/**
 * Error response with details
 */
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: Date;
  path?: string;
  details?: any;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'ok' | 'error' | 'degraded';
  info?: Record<string, any>;
  error?: Record<string, any>;
  details?: Record<string, {
    status: string;
    message?: string;
  }>;
}

/**
 * Search result with highlights
 */
export interface SearchResult<T> {
  items: T[];
  total: number;
  took: number;
  highlights?: Record<string, string[]>;
  facets?: Record<string, Array<{
    value: string;
    count: number;
  }>>;
}

/**
 * Workflow transition result
 */
export interface WorkflowTransitionResult {
  success: boolean;
  fromState: string;
  toState: string;
  transitionTime: Date;
  performedBy: string;
  reason?: string;
  metadata?: Record<string, any>;
}