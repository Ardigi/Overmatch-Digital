/**
 * Usage examples for the HTTP Common package response utilities
 * 
 * This file demonstrates how to use the standardized response utilities
 * across all services in the SOC Compliance Platform.
 */

import { BadRequestException, Body, Controller, Get, Injectable, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Repository } from 'typeorm';
import { 
  type PaginatedResponse, 
  PaginationDto, 
  PaginationUtil, 
  PaginationValidationPipe,
  type QueryDto,
  ResponseBuilder, 
  type ServiceResponse
} from '../index';

// ==========================================
// Example 1: Basic Controller Usage
// ==========================================

@ApiTags('users')
@Controller('users')
export class ExampleUsersController {
  constructor(private readonly usersService: ExampleUsersService) {}

  /**
   * Example: Simple success response
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUser(@Query('id') id: string): Promise<ServiceResponse<any>> {
    const user = await this.usersService.findById(id);
    
    if (!user) {
      // Return standardized not found response
      return ResponseBuilder.notFound('User', id);
    }

    // Return standardized success response
    return ResponseBuilder.success(user, 'User retrieved successfully');
  }

  /**
   * Example: Paginated response with validation
   */
  @Get()
  @ApiOperation({ summary: 'Get users with pagination' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getUsers(
    @Query(new PaginationValidationPipe()) query: QueryDto
  ): Promise<ServiceResponse<PaginatedResponse<any>>> {
    // Normalize pagination parameters
    const pagination = PaginationUtil.normalizePagination(query);
    
    // Execute paginated query
    const { items, total } = await this.usersService.findPaginated(pagination);
    
    // Return standardized paginated response
    return ResponseBuilder.paginated(
      items,
      total,
      pagination.page,
      pagination.pageSize,
      'Users retrieved successfully'
    );
  }

  /**
   * Example: Create user with validation error handling
   */
  @Post()
  @ApiOperation({ summary: 'Create new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async createUser(@Body() createUserDto: any): Promise<ServiceResponse<any>> {
    try {
      const user = await this.usersService.create(createUserDto);
      
      return ResponseBuilder.success(user, 'User created successfully', {
        type: 'user_creation',
      });
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        return ResponseBuilder.conflict('User', 'email address');
      }
      
      if (error.name === 'ValidationError') {
        return ResponseBuilder.validationError(error.details);
      }
      
      // Let the global error handler deal with unexpected errors
      throw error;
    }
  }
}

// ==========================================
// Example 2: Service Implementation
// ==========================================

@Injectable()
export class ExampleUsersService {
  constructor(
    private readonly userRepository: Repository<any>
  ) {}

  async findById(id: string): Promise<any> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findPaginated(pagination: any): Promise<{ items: any[]; total: number }> {
    // Using PaginationUtil with TypeORM
    return PaginationUtil.executePaginatedQuery(
      this.userRepository,
      pagination,
      {
        // Additional TypeORM options
        relations: ['profile', 'roles'],
        where: { deletedAt: null },
      }
    );
  }

  async create(userData: any): Promise<any> {
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }
}

// ==========================================
// Example 3: Advanced Controller with Search
// ==========================================

@ApiTags('audits')
@Controller('audits')
export class ExampleAuditsController {
  constructor(private readonly auditsService: ExampleAuditsService) {}

  /**
   * Example: Advanced search with multiple filters
   */
  @Get('search')
  @ApiOperation({ summary: 'Search audits with advanced filtering' })
  async searchAudits(
    @Query() query: QueryDto
  ): Promise<ServiceResponse<PaginatedResponse<any>>> {
    // Validate pagination with service-specific config
    const pagination = PaginationUtil.normalizePagination(query, {
      defaultPageSize: 20,
      maxPageSize: 100,
      allowedSortFields: ['id', 'status', 'severity', 'createdAt', 'updatedAt'],
    });

    // Build search filters
    const filters: any = {};
    
    if (query.search) {
      filters.search = query.search;
    }
    
    if (query.startDate || query.endDate) {
      filters.dateRange = {
        start: query.startDate,
        end: query.endDate,
      };
    }

    try {
      const { items, total } = await this.auditsService.searchPaginated(
        pagination,
        filters
      );

      return ResponseBuilder.paginated(
        items,
        total,
        pagination.page,
        pagination.pageSize,
        `Found ${total} audit records`
      );
    } catch (error: any) {
      if (error.message?.includes('Invalid search')) {
        throw new BadRequestException(
          'Invalid search parameters',
          { cause: { allowedFields: ['title', 'description', 'status'] } }
        );
      }
      throw error;
    }
  }

  /**
   * Example: Bulk operations response
   */
  @Post('bulk-update')
  @ApiOperation({ summary: 'Bulk update audit records' })
  async bulkUpdate(
    @Body() updateData: { ids: string[]; updates: any }
  ): Promise<ServiceResponse<{ updated: number; failed: string[] }>> {
    const { ids, updates } = updateData;

    if (!ids || ids.length === 0) {
      throw new BadRequestException('No audit IDs provided');
    }

    if (ids.length > 100) {
      throw new BadRequestException(
        'Too many records',
        { cause: { maxAllowed: 100, provided: ids.length } }
      );
    }

    const result = await this.auditsService.bulkUpdate(ids, updates);

    return ResponseBuilder.success(result, 
      `Successfully updated ${result.updated} audit records`
    );
  }
}

// ==========================================
// Example 4: Error Handling Patterns
// ==========================================

@Injectable()
export class ExampleAuditsService {
  constructor(private readonly auditRepository: Repository<any>) {}

  async searchPaginated(pagination: any, filters: any) {
    // TypeORM query building with search
    const queryBuilder = this.auditRepository.createQueryBuilder('audit');

    // Apply search filters
    if (filters.search) {
      queryBuilder.where(
        'audit.title ILIKE :search OR audit.description ILIKE :search',
        { search: `%${filters.search}%` }
      );
    }

    // Apply date range filter
    if (filters.dateRange) {
      if (filters.dateRange.start) {
        queryBuilder.andWhere('audit.createdAt >= :startDate', {
          startDate: filters.dateRange.start,
        });
      }
      if (filters.dateRange.end) {
        queryBuilder.andWhere('audit.createdAt <= :endDate', {
          endDate: filters.dateRange.end,
        });
      }
    }

    // Apply pagination and sorting
    if (pagination.sortBy) {
      queryBuilder.orderBy(`audit.${pagination.sortBy}`, pagination.sortOrder);
    }

    queryBuilder.skip(pagination.offset);
    queryBuilder.take(pagination.pageSize);

    // Execute query
    const [items, total] = await queryBuilder.getManyAndCount();

    return { items, total };
  }

  async bulkUpdate(ids: string[], updates: any) {
    const failed: string[] = [];
    let updated = 0;

    // Process each ID individually to handle partial failures
    for (const id of ids) {
      try {
        const result = await this.auditRepository.update(id, updates);
        if (result.affected && result.affected > 0) {
          updated++;
        } else {
          failed.push(id);
        }
      } catch (error) {
        failed.push(id);
      }
    }

    return { updated, failed };
  }
}

// ==========================================
// Example 5: Health Check Usage
// ==========================================

@Controller('health')
export class ExampleHealthController {
  /**
   * Example: Health check with standardized response
   */
  @Get()
  @ApiOperation({ summary: 'Service health check' })
  async healthCheck(): Promise<ServiceResponse<any>> {
    const healthData = {
      status: 'healthy',
      service: 'example-service',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date(),
      details: {
        database: { status: 'up', message: 'Connected' },
        redis: { status: 'up', message: 'Connected' },
        kafka: { status: 'up', message: 'Connected' },
      },
    };

    return ResponseBuilder.success(healthData, 'Service is healthy', {
      type: 'health_check',
    });
  }
}

// ==========================================
// Example 6: Response Transformations
// ==========================================

export class ResponseExamples {
  /**
   * Transform any data to standardized response
   */
  static transformToStandardResponse<T>(data: T): ServiceResponse<T> {
    return ResponseBuilder.wrap(data);
  }

  /**
   * Create error responses for different scenarios
   */
  static createErrorResponses() {
    return {
      // Validation error with field details
      validation: ResponseBuilder.validationError([
        { field: 'email', message: 'Invalid email format', value: 'invalid-email' },
        { field: 'age', message: 'Must be at least 18', value: 16 },
      ]),

      // Not found with resource info
      notFound: ResponseBuilder.notFound('User', '123'),

      // Unauthorized access
      unauthorized: ResponseBuilder.unauthorized('Invalid credentials'),

      // Forbidden with role requirement
      forbidden: ResponseBuilder.forbidden('Admin access required', 'admin'),

      // Conflict with constraint info
      conflict: ResponseBuilder.conflict('User', 'email address'),

      // Rate limit with retry info
      rateLimit: ResponseBuilder.rateLimitExceeded(60), // retry after 60 seconds

      // Service unavailable
      serviceUnavailable: ResponseBuilder.serviceUnavailable('database', 120),

      // Internal error (production safe)
      internalError: ResponseBuilder.internalError(),
    };
  }

  /**
   * Create success responses for different scenarios
   */
  static createSuccessResponses() {
    const sampleUser = { id: '1', name: 'John Doe', email: 'john@example.com' };
    const sampleUsers = Array(25).fill(sampleUser).map((user, i) => ({ ...user, id: String(i + 1) }));

    return {
      // Simple success
      simple: ResponseBuilder.success(sampleUser, 'User retrieved'),

      // Success with metadata
      withMetadata: ResponseBuilder.success(sampleUser, 'User created', {
        type: 'user_creation',
        service: 'user-service',
        version: '1.0.0',
      }),

      // Paginated response
      paginated: ResponseBuilder.paginated(
        sampleUsers.slice(0, 10), // items
        25, // total
        1, // page
        10, // pageSize
        'Users retrieved successfully'
      ),

      // Empty results
      empty: ResponseBuilder.success([], 'No users found'),

      // Boolean result
      boolean: ResponseBuilder.success(true, 'Operation completed'),
    };
  }
}

// ==========================================
// Example 7: Module Configuration
// ==========================================

/*
// In your service's app.module.ts:

import { HttpCommonModule } from '@soc-compliance/http-common';

@Module({
  imports: [
    HttpCommonModule.forRoot({
      serviceName: 'user-service',
      serviceVersion: '1.0.0',
      enableResponseInterceptor: true,
      responseInterceptorConfig: {
        enableLogging: true,
        enableTiming: true,
        enableCorrelationId: true,
        productionErrorMode: process.env.NODE_ENV === 'production',
      },
    }),
    // ... other imports
  ],
})
export class AppModule {}

// The response interceptor will automatically:
// 1. Wrap all responses in ServiceResponse format
// 2. Add metadata (timing, service info, correlation IDs)
// 3. Handle errors consistently
// 4. Add response headers for debugging
*/

// ==========================================
// Example 8: Custom Validation Pipes
// ==========================================

export class CustomPaginationExamples {
  /**
   * Service-specific pagination configuration
   */
  static createUserPaginationPipe() {
    return new PaginationValidationPipe({
      defaultPageSize: 10,
      maxPageSize: 50,
      allowedSortFields: ['id', 'email', 'name', 'createdAt', 'lastLoginAt'],
    });
  }

  /**
   * Usage in controller
   */
  /*
  @Get()
  async getUsers(
    @Query(CustomPaginationExamples.createUserPaginationPipe()) 
    query: QueryDto
  ) {
    // Query is automatically validated and normalized
    const pagination = PaginationUtil.normalizePagination(query);
    // ... rest of implementation
  }
  */
}

// ==========================================
// Example 9: TypeORM Integration
// ==========================================

export class TypeORMIntegrationExample {
  // Example integration with TypeORM - adapt types based on your entities
  
  static async findPaginatedExample(
    repository: any, // Use actual Repository<YourEntity> type
    query: QueryDto,
    config: any = {}
  ): Promise<{ items: any[]; total: number }> {
    // Normalize pagination
    const pagination = PaginationUtil.normalizePagination(query, config);

    // Manual TypeORM query to avoid type issues in examples
    const queryBuilder = repository.createQueryBuilder('entity');
    
    // Apply pagination
    queryBuilder.skip(pagination.offset);
    queryBuilder.take(pagination.pageSize);

    // Apply sorting
    if (pagination.sortBy) {
      queryBuilder.orderBy(`entity.${pagination.sortBy}`, pagination.sortOrder);
    }

    const [items, total] = await queryBuilder.getManyAndCount();
    return { items, total };
  }

  static async findWithSearchExample(
    repository: any, // Use actual Repository<YourEntity> type
    query: QueryDto,
    searchFields: string[] = ['name', 'email']
  ): Promise<{ items: any[]; total: number }> {
    const pagination = PaginationUtil.normalizePagination(query);
    const queryBuilder = repository.createQueryBuilder('entity');

    // Apply search
    if (query.search) {
      const searchConditions = searchFields
        .map(field => `entity.${field} ILIKE :search`)
        .join(' OR ');
      
      queryBuilder.where(`(${searchConditions})`, {
        search: `%${query.search}%`,
      });
    }

    // Apply pagination
    queryBuilder.skip(pagination.offset);
    queryBuilder.take(pagination.pageSize);

    // Apply sorting
    if (pagination.sortBy) {
      queryBuilder.orderBy(`entity.${pagination.sortBy}`, pagination.sortOrder);
    }

    const [items, total] = await queryBuilder.getManyAndCount();
    return { items, total };
  }
}

export default {
  ResponseExamples,
  CustomPaginationExamples,
  TypeORMIntegrationExample,
};