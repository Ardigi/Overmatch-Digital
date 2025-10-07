export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ServiceError;
  metadata?: ResponseMetadata;
}

export interface ServiceError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  service?: string;
}

export interface ResponseMetadata {
  requestId?: string;
  duration?: number;
  service?: string;
  version?: string;
  correlationId?: string;
  timestamp?: Date;
  message?: string;
  type?: string;
  pagination?: PaginationMetadata;
}

export interface PaginationMetadata {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  offset?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  service: string;
  version?: string;
  uptime?: number;
  timestamp: Date;
  details?: {
    database?: HealthStatus;
    redis?: HealthStatus;
    kafka?: HealthStatus;
    connectivity?: HealthStatus;
    dependencies?: Record<string, HealthStatus>;
    note?: string;
    healthEndpoints?: string;
  };
}

export interface HealthStatus {
  status: 'up' | 'down' | 'degraded';
  message?: string;
  lastCheck?: Date;
}
