import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Base pagination DTO for query parameters
 */
export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 10,
    minimum: 1,
    maximum: 100,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page size must be an integer' })
  @Min(1, { message: 'Page size must be at least 1' })
  @Max(100, { message: 'Page size cannot exceed 100' })
  pageSize?: number = 10;

  @ApiPropertyOptional({
    description: 'Alias for pageSize (for compatibility)',
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number;

  @ApiPropertyOptional({
    description: 'Number of items to skip (alternative to page)',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Offset must be an integer' })
  @Min(0, { message: 'Offset must be non-negative' })
  offset?: number;
}

/**
 * Extended pagination DTO with sorting
 */
export class PaginationWithSortDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString({ message: 'Sort field must be a string' })
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['ASC', 'DESC', 'asc', 'desc'],
    default: 'ASC',
    example: 'DESC',
  })
  @IsOptional()
  @IsString({ message: 'Sort order must be a string' })
  @IsIn(['ASC', 'DESC', 'asc', 'desc'], {
    message: 'Sort order must be ASC or DESC',
  })
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc' = 'ASC';
}

/**
 * Search and filter DTO
 */
export class SearchDto {
  @ApiPropertyOptional({
    description: 'Search query string',
    example: 'user search term',
  })
  @IsOptional()
  @IsString({ message: 'Search query must be a string' })
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiPropertyOptional({
    description: 'Search fields to include (comma-separated)',
    example: 'name,email,description',
  })
  @IsOptional()
  @IsString({ message: 'Search fields must be a string' })
  searchFields?: string;
}

/**
 * Date range filter DTO
 */
export class DateRangeDto {
  @ApiPropertyOptional({
    description: 'Start date (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'End date (ISO string)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  endDate?: Date;
}

/**
 * Combined pagination, sorting, search, and filtering DTO
 */
export class QueryDto extends PaginationWithSortDto {
  @ApiPropertyOptional({
    description: 'Search query string',
    example: 'search term',
  })
  @IsOptional()
  @IsString({ message: 'Search query must be a string' })
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiPropertyOptional({
    description: 'Fields to include in response (comma-separated)',
    example: 'id,name,email,createdAt',
  })
  @IsOptional()
  @IsString({ message: 'Select fields must be a string' })
  select?: string;

  @ApiPropertyOptional({
    description: 'Relations to include (comma-separated)',
    example: 'profile,roles,organization',
  })
  @IsOptional()
  @IsString({ message: 'Include relations must be a string' })
  include?: string;

  @ApiPropertyOptional({
    description: 'Start date for date range filtering (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'End date for date range filtering (ISO string)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  endDate?: Date;
}

/**
 * Cursor-based pagination DTO for infinite scroll
 */
export class CursorPaginationDto {
  @ApiPropertyOptional({
    description: 'Cursor for pagination (usually an ID or timestamp)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString({ message: 'Cursor must be a string' })
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of items to fetch',
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Direction to paginate',
    enum: ['forward', 'backward'],
    default: 'forward',
  })
  @IsOptional()
  @IsString({ message: 'Direction must be a string' })
  @IsIn(['forward', 'backward'], {
    message: 'Direction must be forward or backward',
  })
  direction?: 'forward' | 'backward' = 'forward';
}

/**
 * Service-specific pagination configurations
 */
export class PaginationConfigDto {
  static readonly USER_CONFIG = {
    defaultPageSize: 10,
    maxPageSize: 50,
    allowedSortFields: ['id', 'email', 'name', 'createdAt', 'updatedAt', 'lastLoginAt'],
  };

  static readonly AUDIT_CONFIG = {
    defaultPageSize: 20,
    maxPageSize: 100,
    allowedSortFields: ['id', 'findingNumber', 'severity', 'status', 'createdAt', 'updatedAt'],
  };

  static readonly CONTROL_CONFIG = {
    defaultPageSize: 15,
    maxPageSize: 50,
    allowedSortFields: ['id', 'code', 'title', 'category', 'implementationStatus', 'createdAt'],
  };

  static readonly EVIDENCE_CONFIG = {
    defaultPageSize: 25,
    maxPageSize: 100,
    allowedSortFields: ['id', 'title', 'type', 'collectedDate', 'verified', 'createdAt'],
  };

  static readonly POLICY_CONFIG = {
    defaultPageSize: 10,
    maxPageSize: 50,
    allowedSortFields: ['id', 'title', 'version', 'category', 'status', 'approvedAt', 'createdAt'],
  };

  static readonly CLIENT_CONFIG = {
    defaultPageSize: 10,
    maxPageSize: 25,
    allowedSortFields: [
      'id',
      'name',
      'slug',
      'industry',
      'status',
      'complianceStatus',
      'createdAt',
    ],
  };

  static readonly PROJECT_CONFIG = {
    defaultPageSize: 10,
    maxPageSize: 50,
    allowedSortFields: ['id', 'name', 'type', 'status', 'startDate', 'targetEndDate', 'createdAt'],
  };

  static readonly NOTIFICATION_CONFIG = {
    defaultPageSize: 20,
    maxPageSize: 100,
    allowedSortFields: ['id', 'type', 'priority', 'status', 'createdAt', 'scheduledFor'],
  };

  static readonly WORKFLOW_CONFIG = {
    defaultPageSize: 15,
    maxPageSize: 50,
    allowedSortFields: ['id', 'name', 'status', 'priority', 'createdAt', 'updatedAt'],
  };

  static readonly INTEGRATION_CONFIG = {
    defaultPageSize: 10,
    maxPageSize: 50,
    allowedSortFields: ['id', 'name', 'type', 'status', 'lastSyncAt', 'createdAt'],
  };

  static readonly REPORT_CONFIG = {
    defaultPageSize: 10,
    maxPageSize: 25,
    allowedSortFields: ['id', 'name', 'type', 'status', 'generatedAt', 'createdAt'],
  };
}

/**
 * Response metadata DTO for pagination info
 */
export class PaginationMetadataDto {
  @ApiPropertyOptional({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
  })
  pageSize: number;

  @ApiPropertyOptional({
    description: 'Total number of items',
    example: 100,
  })
  total: number;

  @ApiPropertyOptional({
    description: 'Total number of pages',
    example: 10,
  })
  totalPages: number;

  @ApiPropertyOptional({
    description: 'Whether there is a next page',
    example: true,
  })
  hasNext: boolean;

  @ApiPropertyOptional({
    description: 'Whether there is a previous page',
    example: false,
  })
  hasPrev: boolean;

  @ApiPropertyOptional({
    description: 'Offset from the beginning',
    example: 0,
  })
  offset?: number;
}
