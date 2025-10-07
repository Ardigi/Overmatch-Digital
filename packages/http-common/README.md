# HTTP Common Package

Standardized HTTP response utilities for the SOC Compliance Platform. This package provides consistent response formatting, pagination, error handling, and interceptors across all microservices.

## 🚀 Features

- **Standardized Response Format**: All services return responses in the same `ServiceResponse<T>` format
- **Automatic Response Wrapping**: Global interceptor automatically formats responses
- **Pagination Utilities**: Complete pagination support with validation and TypeORM integration
- **Error Standardization**: Consistent error response format across all services
- **Performance Monitoring**: Automatic request timing and correlation ID tracking
- **Type Safety**: Full TypeScript support with proper interfaces

## 📦 Installation

This package is part of the SOC Compliance Platform workspace and is automatically available to all services.

```bash
# Build the package (run from project root)
npm run build:shared
```

## 🔧 Quick Setup

### 1. Add to Your Service Module

```typescript
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
      },
    }),
  ],
})
export class AppModule {}
```

### 2. Use in Controllers

```typescript
import { 
  ResponseBuilder, 
  PaginationDto, 
  ServiceResponse, 
  PaginationValidationPipe 
} from '@soc-compliance/http-common';

@Controller('users')
export class UsersController {
  
  @Get(':id')
  async getUser(@Param('id') id: string): Promise<ServiceResponse<User>> {
    const user = await this.usersService.findById(id);
    
    if (!user) {
      return ResponseBuilder.notFound('User', id);
    }
    
    return ResponseBuilder.success(user, 'User retrieved successfully');
  }

  @Get()
  async getUsers(
    @Query(new PaginationValidationPipe()) query: PaginationDto
  ): Promise<ServiceResponse<PaginatedResponse<User>>> {
    const { items, total } = await this.usersService.findPaginated(query);
    
    return ResponseBuilder.paginated(
      items, 
      total, 
      query.page, 
      query.pageSize
    );
  }
}
```

## 📋 Response Format

All API responses follow this standardized format:

### Success Response
```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "metadata": {
    "requestId": "uuid-v4",
    "duration": 45,
    "service": "user-service",
    "version": "1.0.0",
    "correlationId": "correlation-uuid",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User with ID '123' not found",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "details": {
      "resource": "User",
      "id": "123",
      "type": "NOT_FOUND"
    }
  },
  "metadata": {
    "requestId": "uuid-v4",
    "duration": 12,
    "service": "user-service",
    "correlationId": "correlation-uuid"
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": {
    "items": [
      { "id": "1", "name": "User 1" },
      { "id": "2", "name": "User 2" }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 10,
    "totalPages": 10
  },
  "metadata": {
    "requestId": "uuid-v4",
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 100,
      "totalPages": 10,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

## 🔨 ResponseBuilder API

The `ResponseBuilder` class provides static methods for creating standardized responses:

### Success Responses
```typescript
// Simple success
ResponseBuilder.success(data, 'Operation successful');

// Success with metadata
ResponseBuilder.success(data, 'User created', { 
  type: 'user_creation' 
});

// Paginated response
ResponseBuilder.paginated(items, total, page, pageSize, 'Users retrieved');
```

### Error Responses
```typescript
// Validation error
ResponseBuilder.validationError([
  { field: 'email', message: 'Invalid email format' }
]);

// Not found
ResponseBuilder.notFound('User', 'user-id');

// Unauthorized
ResponseBuilder.unauthorized('Invalid credentials');

// Forbidden
ResponseBuilder.forbidden('Admin access required', 'admin');

// Conflict
ResponseBuilder.conflict('User', 'email address');

// Rate limit
ResponseBuilder.rateLimitExceeded(60); // retry after 60 seconds

// Internal error
ResponseBuilder.internalError('Something went wrong');
```

## 📄 Pagination

### Basic Pagination
```typescript
import { PaginationDto, PaginationUtil } from '@soc-compliance/http-common';

@Get()
async getUsers(@Query() query: PaginationDto) {
  // Normalize pagination parameters
  const pagination = PaginationUtil.normalizePagination(query);
  
  // Use with TypeORM
  const { items, total } = await PaginationUtil.executePaginatedQuery(
    this.userRepository,
    pagination,
    { relations: ['profile'] }
  );
  
  return ResponseBuilder.paginated(items, total, pagination.page, pagination.pageSize);
}
```

### Advanced Pagination with Search
```typescript
import { QueryDto, PaginationValidationPipe } from '@soc-compliance/http-common';

@Get('search')
async searchUsers(
  @Query(new PaginationValidationPipe({
    defaultPageSize: 10,
    maxPageSize: 100,
    allowedSortFields: ['id', 'name', 'email', 'createdAt']
  })) query: QueryDto
) {
  const pagination = PaginationUtil.normalizePagination(query);
  
  // Your search implementation
  const { items, total } = await this.usersService.searchPaginated(pagination, {
    search: query.search,
    startDate: query.startDate,
    endDate: query.endDate
  });
  
  return ResponseBuilder.paginated(items, total, pagination.page, pagination.pageSize);
}
```

### Pagination Query Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `page` | number | Page number (1-based) | 1 |
| `pageSize` | number | Items per page | 10 |
| `limit` | number | Alias for pageSize | - |
| `offset` | number | Items to skip | - |
| `sortBy` | string | Field to sort by | - |
| `sortOrder` | string | ASC or DESC | ASC |
| `search` | string | Search query | - |
| `startDate` | Date | Start date filter | - |
| `endDate` | Date | End date filter | - |

## 🔍 Validation

### Pagination Validation Pipe
```typescript
import { PaginationValidationPipe } from '@soc-compliance/http-common';

// Basic validation
@Query(new PaginationValidationPipe()) query: PaginationDto

// With custom config
@Query(new PaginationValidationPipe({
  defaultPageSize: 20,
  maxPageSize: 100,
  allowedSortFields: ['name', 'createdAt', 'status']
})) query: QueryDto

// Pre-configured pipes for specific services
@Query(PaginationPipes.User) query: QueryDto
@Query(PaginationPipes.Audit) query: QueryDto
@Query(PaginationPipes.Control) query: QueryDto
```

## 🌐 Global Response Interceptor

The response interceptor automatically:

1. **Wraps Responses**: Converts raw data to `ServiceResponse<T>` format
2. **Adds Metadata**: Includes timing, service info, and correlation IDs
3. **Handles Errors**: Transforms exceptions to standardized error responses
4. **Sets Headers**: Adds debugging headers for request tracking

### Configuration Options
```typescript
HttpCommonModule.forRoot({
  enableResponseInterceptor: true,
  responseInterceptorConfig: {
    enableLogging: true,        // Log requests/responses
    enableTiming: true,         // Add duration metadata
    enableCorrelationId: true,  // Track requests across services
    productionErrorMode: false  // Hide error details in production
  }
})
```

### Response Headers
The interceptor adds these headers to all responses:
- `x-correlation-id`: Request correlation ID
- `x-service`: Service name
- `x-service-version`: Service version
- `x-pagination-*`: Pagination metadata (for paginated responses)

## 🔧 TypeORM Integration

### Repository Pattern
```typescript
import { PaginationUtil } from '@soc-compliance/http-common';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  async findPaginated(query: any) {
    const pagination = PaginationUtil.normalizePagination(query);
    
    return PaginationUtil.executePaginatedQuery(
      this.userRepository,
      pagination,
      {
        relations: ['profile', 'roles'],
        where: { deletedAt: null }
      }
    );
  }

  async searchUsers(pagination: any, filters: any) {
    const queryBuilder = this.userRepository.createQueryBuilder('user');
    
    // Apply search filters
    if (filters.search) {
      queryBuilder.where(
        'user.name ILIKE :search OR user.email ILIKE :search',
        { search: `%${filters.search}%` }
      );
    }
    
    // Apply pagination
    const typeormOptions = PaginationUtil.toTypeORMOptions(pagination);
    queryBuilder.skip(typeormOptions.skip);
    queryBuilder.take(typeormOptions.take);
    
    if (typeormOptions.order) {
      Object.entries(typeormOptions.order).forEach(([field, direction]) => {
        queryBuilder.addOrderBy(`user.${field}`, direction);
      });
    }
    
    const [items, total] = await queryBuilder.getManyAndCount();
    return { items, total };
  }
}
```

## 🎯 Service-Specific Configurations

Pre-configured pagination settings for each service:

```typescript
import { PaginationConfigDto, PaginationPipes } from '@soc-compliance/http-common';

// Use service-specific configurations
@Query(PaginationPipes.User)     // 10 items, max 50
@Query(PaginationPipes.Audit)    // 20 items, max 100  
@Query(PaginationPipes.Control)  // 15 items, max 50
@Query(PaginationPipes.Evidence) // 25 items, max 100
@Query(PaginationPipes.Policy)   // 10 items, max 50
@Query(PaginationPipes.Client)   // 10 items, max 25

// Or use the configuration objects directly
const userConfig = PaginationConfigDto.USER_CONFIG;
const auditConfig = PaginationConfigDto.AUDIT_CONFIG;
```

## 🚀 Advanced Usage

### Custom Error Handling
```typescript
@Controller('users')
export class UsersController {
  @Post()
  async createUser(@Body() userData: CreateUserDto) {
    try {
      const user = await this.usersService.create(userData);
      return ResponseBuilder.success(user, 'User created successfully');
    } catch (error) {
      // Custom error mapping
      if (error.code === '23505') {
        return ResponseBuilder.conflict('User', 'email address');
      }
      if (error.name === 'ValidationError') {
        return ResponseBuilder.validationError(error.details);
      }
      // Let global handler deal with unexpected errors
      throw error;
    }
  }
}
```

### Cursor-Based Pagination
```typescript
import { CursorPaginationDto, PaginationUtil } from '@soc-compliance/http-common';

@Get('infinite')
async getInfiniteUsers(@Query() query: CursorPaginationDto) {
  const users = await this.usersService.findByCursor(query);
  
  return ResponseBuilder.success(
    PaginationUtil.createCursorPagination(users, 'createdAt', query.limit)
  );
}
```

### Response Transformation
```typescript
// Transform any data to standardized response
const response = ResponseBuilder.wrap(rawData);

// Add custom metadata
const response = ResponseBuilder.success(data, 'Success', {
  executionTime: Date.now() - startTime,
  cacheHit: true,
  customField: 'value'
});
```

## 🧪 Testing

### Testing Controllers
```typescript
import { ResponseBuilder } from '@soc-compliance/http-common';

describe('UsersController', () => {
  it('should return standardized success response', async () => {
    const result = await controller.getUser('123');
    
    expect(result).toMatchObject({
      success: true,
      data: expect.any(Object),
      metadata: expect.objectContaining({
        requestId: expect.any(String),
        timestamp: expect.any(Date)
      })
    });
  });

  it('should return not found response', async () => {
    jest.spyOn(service, 'findById').mockResolvedValue(null);
    
    const result = await controller.getUser('999');
    
    expect(result).toEqual(ResponseBuilder.notFound('User', '999'));
  });
});
```

### Testing Pagination
```typescript
import { PaginationUtil } from '@soc-compliance/http-common';

describe('PaginationUtil', () => {
  it('should normalize pagination parameters', () => {
    const result = PaginationUtil.normalizePagination({
      page: 2,
      pageSize: 20,
      sortBy: 'name',
      sortOrder: 'DESC'
    });
    
    expect(result).toEqual({
      page: 2,
      pageSize: 20,
      offset: 20,
      sortBy: 'name',
      sortOrder: 'DESC'
    });
  });
});
```

## 📚 API Reference

### ResponseBuilder Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `success(data, message?, metadata?)` | Create success response | `ServiceResponse<T>` |
| `error(code, message, details?, service?)` | Create error response | `ServiceResponse<null>` |
| `paginated(items, total, page, pageSize, message?, metadata?)` | Create paginated response | `ServiceResponse<PaginatedResponse<T>>` |
| `validationError(errors, message?)` | Create validation error | `ServiceResponse<null>` |
| `notFound(resource, id?)` | Create not found error | `ServiceResponse<null>` |
| `unauthorized(message?)` | Create unauthorized error | `ServiceResponse<null>` |
| `forbidden(message?, requiredRole?)` | Create forbidden error | `ServiceResponse<null>` |
| `conflict(resource, constraint?)` | Create conflict error | `ServiceResponse<null>` |
| `rateLimitExceeded(retryAfter?)` | Create rate limit error | `ServiceResponse<null>` |
| `serviceUnavailable(service?, retryAfter?)` | Create service unavailable error | `ServiceResponse<null>` |
| `internalError(message?, details?)` | Create internal error | `ServiceResponse<null>` |
| `badRequest(message, details?)` | Create bad request error | `ServiceResponse<null>` |

### PaginationUtil Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `normalizePagination(query, config?)` | Normalize pagination params | `NormalizedPagination` |
| `toTypeORMOptions(pagination)` | Convert to TypeORM options | `TypeORMPaginationOptions` |
| `executePaginatedQuery(repository, pagination, options?)` | Execute paginated TypeORM query | `Promise<{items, total}>` |
| `validatePagination(query, config?)` | Validate pagination params | `void` (throws on error) |
| `createPaginationHeaders(pagination, total, baseUrl?)` | Create pagination headers | `Record<string, string>` |
| `getStatistics(pagination, total)` | Get pagination statistics | `PaginationStatistics` |

## 🔗 Related Packages

- `@soc-compliance/shared-contracts` - TypeScript interfaces and contracts
- `@soc-compliance/auth-common` - Authentication utilities
- `@soc-compliance/monitoring` - Monitoring and observability

## 📝 Examples

See the [examples directory](./src/examples/) for comprehensive usage examples covering:
- Basic controller implementation
- Advanced search and filtering
- Error handling patterns
- TypeORM integration
- Custom validation
- Bulk operations
- Health checks

## 🐛 Troubleshooting

### Common Issues

1. **Module Not Found**: Ensure you've run `npm run build:shared` after making changes
2. **Type Errors**: Make sure all services are using the same version of the interfaces
3. **Pagination Not Working**: Check that you're using the validation pipe and normalizing parameters
4. **Response Not Formatted**: Verify the response interceptor is enabled in your module configuration

### Debug Mode
```typescript
// Enable debug logging
HttpCommonModule.forRoot({
  responseInterceptorConfig: {
    enableLogging: true,
    productionErrorMode: false
  }
})
```

## 🤝 Contributing

When making changes to this package:

1. Update the version in `package.json`
2. Run `npm run build` to compile TypeScript
3. Update documentation if adding new features
4. Test changes across multiple services
5. Run `npm run build:shared` from the project root

## 📄 License

Part of the SOC Compliance Platform - Internal Use Only