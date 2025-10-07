import {
  type ArgumentMetadata,
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationDto, PaginationWithSortDto, QueryDto } from '../dto/pagination.dto';
import {
  type PaginationConfig,
  type PaginationQuery,
  PaginationUtil,
} from '../utils/pagination.util';

/**
 * Validation pipe for pagination query parameters
 */
@Injectable()
export class PaginationValidationPipe implements PipeTransform {
  private readonly config: Partial<PaginationConfig>;
  private readonly dtoClass: any;

  constructor(
    config?: Partial<PaginationConfig>,
    dtoClass?: any
  ) {
    this.config = config || {};
    this.dtoClass = dtoClass || PaginationDto;
  }

  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    if (metadata.type !== 'query') {
      return value;
    }

    // Transform to DTO instance
    const dto = plainToClass(this.dtoClass, value);

    // Validate using class-validator
    const errors = await validate(dto);

    if (errors.length > 0) {
      const errorMessages = errors
        .map((error) => Object.values(error.constraints || {}).join(', '))
        .join('; ');

      throw new BadRequestException(`Validation failed: ${errorMessages}`);
    }

    // Additional custom validation using PaginationUtil
    try {
      const paginationQuery: PaginationQuery = {
        page: (dto as any).page,
        pageSize: (dto as any).pageSize || (dto as any).limit,
        offset: (dto as any).offset,
        sortBy: (dto as any).sortBy,
        sortOrder: (dto as any).sortOrder,
      };

      PaginationUtil.validatePagination(paginationQuery, this.config);
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }

    return dto;
  }
}

/**
 * Factory function to create pagination validation pipe with config
 */
export function createPaginationPipe(
  config?: Partial<PaginationConfig>,
  dtoClass: any = PaginationDto
): PaginationValidationPipe {
  return new PaginationValidationPipe(config, dtoClass);
}

/**
 * Pre-configured pagination pipes for different services
 */
export class PaginationPipes {
  static readonly User = new PaginationValidationPipe(
    {
      defaultPageSize: 10,
      maxPageSize: 50,
      allowedSortFields: ['id', 'email', 'name', 'createdAt', 'updatedAt'],
    },
    QueryDto
  );

  static readonly Audit = new PaginationValidationPipe(
    {
      defaultPageSize: 20,
      maxPageSize: 100,
      allowedSortFields: ['id', 'findingNumber', 'severity', 'status', 'createdAt'],
    },
    QueryDto
  );

  static readonly Control = new PaginationValidationPipe(
    {
      defaultPageSize: 15,
      maxPageSize: 50,
      allowedSortFields: ['id', 'code', 'title', 'category', 'implementationStatus'],
    },
    QueryDto
  );

  static readonly Evidence = new PaginationValidationPipe(
    {
      defaultPageSize: 25,
      maxPageSize: 100,
      allowedSortFields: ['id', 'title', 'type', 'collectedDate', 'verified'],
    },
    QueryDto
  );

  static readonly Policy = new PaginationValidationPipe(
    {
      defaultPageSize: 10,
      maxPageSize: 50,
      allowedSortFields: ['id', 'title', 'version', 'category', 'status'],
    },
    QueryDto
  );

  static readonly Client = new PaginationValidationPipe(
    {
      defaultPageSize: 10,
      maxPageSize: 25,
      allowedSortFields: ['id', 'name', 'slug', 'industry', 'status'],
    },
    QueryDto
  );

  static readonly Basic = new PaginationValidationPipe(
    {
      defaultPageSize: 10,
      maxPageSize: 100,
    },
    PaginationDto
  );

  static readonly WithSort = new PaginationValidationPipe(
    {
      defaultPageSize: 10,
      maxPageSize: 100,
    },
    PaginationWithSortDto
  );
}

/**
 * Transform pipe to normalize pagination parameters
 */
@Injectable()
export class PaginationTransformPipe implements PipeTransform {
  private readonly config: Partial<PaginationConfig>;

  constructor(config?: Partial<PaginationConfig>) {
    this.config = config || {};
  }

  transform(value: any, metadata: ArgumentMetadata): any {
    if (metadata.type !== 'query') {
      return value;
    }

    const paginationQuery: PaginationQuery = {
      page: value.page ? parseInt(value.page, 10) : undefined,
      pageSize: value.pageSize ? parseInt(value.pageSize, 10) : undefined,
      limit: value.limit ? parseInt(value.limit, 10) : undefined,
      offset: value.offset ? parseInt(value.offset, 10) : undefined,
      sortBy: value.sortBy || value.sort,
      sortOrder: value.sortOrder || value.order,
    };

    const normalized = PaginationUtil.normalizePagination(paginationQuery, this.config);

    return {
      ...value,
      ...normalized,
    };
  }
}

/**
 * Decorator for easy pagination validation
 */
export function ValidatePagination(config?: Partial<PaginationConfig>) {
  return (target: any, propertyKey: string, parameterIndex: number) => {
    // This would be used with a custom decorator implementation
    // For now, we'll use it as a marker for documentation
  };
}

/**
 * Custom validation functions
 */
export class PaginationValidators {
  /**
   * Validate that page is a positive integer
   */
  static isValidPage(page: any): boolean {
    return Number.isInteger(page) && page >= 1;
  }

  /**
   * Validate that pageSize is within allowed range
   */
  static isValidPageSize(pageSize: any, maxSize = 100): boolean {
    return Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= maxSize;
  }

  /**
   * Validate that offset is non-negative
   */
  static isValidOffset(offset: any): boolean {
    return Number.isInteger(offset) && offset >= 0;
  }

  /**
   * Validate sort field against allowed list
   */
  static isValidSortField(sortBy: string, allowedFields: string[]): boolean {
    return allowedFields.includes(sortBy);
  }

  /**
   * Validate sort order
   */
  static isValidSortOrder(sortOrder: string): boolean {
    return ['ASC', 'DESC', 'asc', 'desc'].includes(sortOrder);
  }

  /**
   * Comprehensive pagination validation
   */
  static validateAll(
    query: PaginationQuery,
    config: Partial<PaginationConfig> = {}
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const mergedConfig = {
      maxPageSize: 100,
      allowedSortFields: [],
      ...config,
    };

    if (query.page !== undefined && !PaginationValidators.isValidPage(query.page)) {
      errors.push('Page must be a positive integer');
    }

    if (
      query.pageSize !== undefined &&
      !PaginationValidators.isValidPageSize(query.pageSize, mergedConfig.maxPageSize)
    ) {
      errors.push(`Page size must be between 1 and ${mergedConfig.maxPageSize}`);
    }

    if (query.offset !== undefined && !PaginationValidators.isValidOffset(query.offset)) {
      errors.push('Offset must be a non-negative integer');
    }

    if (query.sortBy && mergedConfig.allowedSortFields?.length > 0) {
      if (!PaginationValidators.isValidSortField(query.sortBy, mergedConfig.allowedSortFields)) {
        errors.push(`Sort field must be one of: ${mergedConfig.allowedSortFields.join(', ')}`);
      }
    }

    if (query.sortOrder && !PaginationValidators.isValidSortOrder(query.sortOrder)) {
      errors.push('Sort order must be ASC or DESC');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
