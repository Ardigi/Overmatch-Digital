import type { ServiceResponse } from '../interfaces/http-response.interface';
import { ResponseBuilder } from './response-builder';

/**
 * Standard pagination query parameters
 */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  limit?: number; // alias for pageSize
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc';
}

/**
 * Normalized pagination parameters
 */
export interface NormalizedPagination {
  page: number;
  pageSize: number;
  offset: number;
  sortBy?: string;
  sortOrder: 'ASC' | 'DESC';
}

/**
 * Pagination configuration options
 */
export interface PaginationConfig {
  defaultPageSize: number;
  maxPageSize: number;
  defaultSortOrder: 'ASC' | 'DESC';
  allowedSortFields?: string[];
}

/**
 * TypeORM-compatible pagination options
 */
export interface TypeORMPaginationOptions {
  skip: number;
  take: number;
  order?: Record<string, 'ASC' | 'DESC'>;
}

/**
 * Raw query result for counting
 */
export interface CountResult {
  total: number;
  items: any[];
}

/**
 * Utility class for handling pagination across services
 */
export class PaginationUtil {
  private static readonly DEFAULT_CONFIG: PaginationConfig = {
    defaultPageSize: 10,
    maxPageSize: 100,
    defaultSortOrder: 'ASC',
  };

  /**
   * Normalize pagination query parameters
   * @param query - Raw query parameters
   * @param config - Pagination configuration
   * @returns Normalized pagination parameters
   */
  static normalizePagination(
    query: PaginationQuery,
    config: Partial<PaginationConfig> = {}
  ): NormalizedPagination {
    const mergedConfig = { ...PaginationUtil.DEFAULT_CONFIG, ...config };

    // Handle page and pageSize
    let page = Math.max(1, Math.floor(query.page || 1));
    let pageSize = Math.floor(query.pageSize || query.limit || mergedConfig.defaultPageSize);

    // Clamp pageSize to allowed range
    pageSize = Math.min(mergedConfig.maxPageSize, Math.max(1, pageSize));

    // Handle offset-based pagination
    if (query.offset !== undefined) {
      const offset = Math.max(0, Math.floor(query.offset));
      page = Math.floor(offset / pageSize) + 1;
    }

    const offset = (page - 1) * pageSize;

    // Handle sorting
    let sortOrder: 'ASC' | 'DESC' = mergedConfig.defaultSortOrder;
    if (query.sortOrder) {
      sortOrder = query.sortOrder.toUpperCase() as 'ASC' | 'DESC';
      if (!['ASC', 'DESC'].includes(sortOrder)) {
        sortOrder = mergedConfig.defaultSortOrder;
      }
    }

    // Validate sort field if restrictions exist
    let sortBy = query.sortBy;
    if (sortBy && config.allowedSortFields && !config.allowedSortFields.includes(sortBy)) {
      sortBy = undefined;
    }

    return {
      page,
      pageSize,
      offset,
      ...(sortBy && { sortBy }),
      sortOrder,
    };
  }

  /**
   * Convert pagination to TypeORM options
   * @param pagination - Normalized pagination
   * @returns TypeORM-compatible options
   */
  static toTypeORMOptions(pagination: NormalizedPagination): TypeORMPaginationOptions {
    const options: TypeORMPaginationOptions = {
      skip: pagination.offset,
      take: pagination.pageSize,
    };

    if (pagination.sortBy) {
      options.order = {
        [pagination.sortBy]: pagination.sortOrder,
      };
    }

    return options;
  }

  /**
   * Create a paginated response from query results
   * @param items - Array of items
   * @param total - Total count
   * @param pagination - Pagination parameters
   * @param message - Optional success message
   * @returns Standardized paginated response
   */
  static createPaginatedResponse<T>(
    items: T[],
    total: number,
    pagination: NormalizedPagination,
    message?: string
  ): ServiceResponse<any> {
    return ResponseBuilder.paginated(items, total, pagination.page, pagination.pageSize, message);
  }

  /**
   * Execute paginated query with TypeORM repository
   * @param repository - TypeORM repository
   * @param pagination - Pagination parameters
   * @param findOptions - Additional find options
   * @returns Promise of paginated results
   */
  static async executePaginatedQuery<T>(
    repository: any, // TypeORM Repository
    pagination: NormalizedPagination,
    findOptions: any = {}
  ): Promise<{ items: T[]; total: number }> {
    const typeormOptions = PaginationUtil.toTypeORMOptions(pagination);

    const [items, total] = await repository.findAndCount({
      ...findOptions,
      ...typeormOptions,
    });

    return { items, total };
  }

  /**
   * Create pagination metadata for response headers
   * @param pagination - Pagination parameters
   * @param total - Total items
   * @param baseUrl - Base URL for pagination links
   * @returns Pagination headers
   */
  static createPaginationHeaders(
    pagination: NormalizedPagination,
    total: number,
    baseUrl?: string
  ): Record<string, string> {
    const totalPages = Math.ceil(total / pagination.pageSize);

    const headers: Record<string, string> = {
      'x-pagination-page': pagination.page.toString(),
      'x-pagination-page-size': pagination.pageSize.toString(),
      'x-pagination-total': total.toString(),
      'x-pagination-total-pages': totalPages.toString(),
      'x-pagination-has-next': (pagination.page < totalPages).toString(),
      'x-pagination-has-prev': (pagination.page > 1).toString(),
    };

    // Add Link header for REST API navigation
    if (baseUrl) {
      const links: string[] = [];

      if (pagination.page > 1) {
        links.push(`<${baseUrl}?page=1&pageSize=${pagination.pageSize}>; rel="first"`);
        links.push(
          `<${baseUrl}?page=${pagination.page - 1}&pageSize=${pagination.pageSize}>; rel="prev"`
        );
      }

      if (pagination.page < totalPages) {
        links.push(
          `<${baseUrl}?page=${pagination.page + 1}&pageSize=${pagination.pageSize}>; rel="next"`
        );
        links.push(`<${baseUrl}?page=${totalPages}&pageSize=${pagination.pageSize}>; rel="last"`);
      }

      if (links.length > 0) {
        headers['Link'] = links.join(', ');
      }
    }

    return headers;
  }

  /**
   * Extract pagination from query string
   * @param query - Express query object
   * @param config - Pagination configuration
   * @returns Normalized pagination
   */
  static fromQuery(
    query: Record<string, any>,
    config: Partial<PaginationConfig> = {}
  ): NormalizedPagination {
    const paginationQuery: PaginationQuery = {
      page: query.page ? parseInt(query.page, 10) : undefined,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
      sortBy: query.sortBy || query.sort,
      sortOrder: query.sortOrder || query.order,
    };

    return PaginationUtil.normalizePagination(paginationQuery, config);
  }

  /**
   * Validate pagination parameters and throw appropriate errors
   * @param query - Pagination query
   * @param config - Pagination configuration
   * @throws Error if parameters are invalid
   */
  static validatePagination(query: PaginationQuery, config: Partial<PaginationConfig> = {}): void {
    const mergedConfig = { ...PaginationUtil.DEFAULT_CONFIG, ...config };

    if (query.page !== undefined && (query.page < 1 || !Number.isInteger(query.page))) {
      throw new Error('Page must be a positive integer');
    }

    if (query.pageSize !== undefined) {
      if (query.pageSize < 1 || !Number.isInteger(query.pageSize)) {
        throw new Error('Page size must be a positive integer');
      }
      if (query.pageSize > mergedConfig.maxPageSize) {
        throw new Error(`Page size cannot exceed ${mergedConfig.maxPageSize}`);
      }
    }

    if (query.offset !== undefined && (query.offset < 0 || !Number.isInteger(query.offset))) {
      throw new Error('Offset must be a non-negative integer');
    }

    if (query.sortOrder && !['ASC', 'DESC', 'asc', 'desc'].includes(query.sortOrder)) {
      throw new Error('Sort order must be ASC or DESC');
    }

    if (
      query.sortBy &&
      config.allowedSortFields &&
      !config.allowedSortFields.includes(query.sortBy)
    ) {
      throw new Error(
        `Sort field '${query.sortBy}' is not allowed. Allowed fields: ${config.allowedSortFields.join(', ')}`
      );
    }
  }

  /**
   * Create cursor-based pagination for infinite scroll
   * @param items - Array of items
   * @param cursorField - Field to use as cursor
   * @param limit - Number of items per page
   * @returns Cursor pagination result
   */
  static createCursorPagination<T>(
    items: T[],
    cursorField: keyof T,
    limit: number
  ): {
    items: T[];
    hasNext: boolean;
    nextCursor?: string;
    hasPrev: boolean;
    prevCursor?: string;
  } {
    const hasNext = items.length > limit;
    const actualItems = hasNext ? items.slice(0, limit) : items;

    let nextCursor: string | undefined;
    let prevCursor: string | undefined;

    if (actualItems.length > 0) {
      nextCursor = hasNext ? String(actualItems[actualItems.length - 1][cursorField]) : undefined;
      prevCursor = String(actualItems[0][cursorField]);
    }

    return {
      items: actualItems,
      hasNext,
      nextCursor,
      hasPrev: false, // This would need to be determined by the calling code
      prevCursor,
    };
  }

  /**
   * Calculate pagination statistics
   * @param pagination - Pagination parameters
   * @param total - Total items
   * @returns Pagination statistics
   */
  static getStatistics(
    pagination: NormalizedPagination,
    total: number
  ): {
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    isFirst: boolean;
    isLast: boolean;
    itemsOnPage: number;
    startItem: number;
    endItem: number;
  } {
    const totalPages = Math.ceil(total / pagination.pageSize);
    const startItem = pagination.offset + 1;
    const endItem = Math.min(pagination.offset + pagination.pageSize, total);
    const itemsOnPage = Math.max(0, endItem - startItem + 1);

    return {
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1,
      isFirst: pagination.page === 1,
      isLast: pagination.page === totalPages,
      itemsOnPage,
      startItem: total > 0 ? startItem : 0,
      endItem: total > 0 ? endItem : 0,
    };
  }
}
