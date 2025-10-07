# Integration Guide: Standardized Response Utilities

This guide shows how to integrate the new standardized response utilities into existing services across the SOC Compliance Platform.

## 🎯 Overview

The HTTP Common package now provides:
- **ResponseBuilder**: Utility for creating standardized responses
- **ResponseInterceptor**: Global interceptor for automatic response formatting
- **PaginationUtil**: Complete pagination support with TypeORM integration
- **Validation Pipes**: Automatic pagination parameter validation
- **Consistent Error Handling**: Standardized error response format

## 🚀 Step-by-Step Integration

### Step 1: Update Service Module

Add the HTTP Common module to your service's `app.module.ts`:

```typescript
// services/[service-name]/src/app.module.ts
import { HttpCommonModule } from '@soc-compliance/http-common';

@Module({
  imports: [
    // ... existing imports
    HttpCommonModule.forRoot({
      serviceName: 'user-service', // Replace with your service name
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
```

### Step 2: Update Controllers

#### Before (Old Pattern)
```typescript
@Controller('users')
export class UsersController {
  @Get(':id')
  async getUser(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { success: true, data: user };
  }

  @Get()
  async getUsers(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 10
  ) {
    const users = await this.usersService.findAll(page, pageSize);
    return { success: true, data: users };
  }
}
```

#### After (New Pattern)
```typescript
import { 
  ResponseBuilder, 
  ServiceResponse, 
  PaginatedResponse,
  QueryDto,
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
    @Query(new PaginationValidationPipe()) query: QueryDto
  ): Promise<ServiceResponse<PaginatedResponse<User>>> {
    const { items, total } = await this.usersService.findPaginated(query);
    return ResponseBuilder.paginated(items, total, query.page!, query.pageSize!);
  }
}
```

### Step 3: Update Services

#### Before (Old Pattern)
```typescript
@Injectable()
export class UsersService {
  async findAll(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [users, total] = await this.userRepository.findAndCount({
      skip,
      take: pageSize
    });
    return { users, total, page, pageSize };
  }
}
```

#### After (New Pattern)
```typescript
import { PaginationUtil, QueryDto } from '@soc-compliance/http-common';

@Injectable()
export class UsersService {
  async findPaginated(query: QueryDto): Promise<{ items: User[]; total: number }> {
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

  // For complex queries, use manual implementation
  async searchUsers(query: QueryDto, filters: any): Promise<{ items: User[]; total: number }> {
    const pagination = PaginationUtil.normalizePagination(query);
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // Apply search filters
    if (filters.search) {
      queryBuilder.where(
        'user.name ILIKE :search OR user.email ILIKE :search',
        { search: `%${filters.search}%` }
      );
    }

    // Apply pagination and sorting
    queryBuilder.skip(pagination.offset);
    queryBuilder.take(pagination.pageSize);
    
    if (pagination.sortBy) {
      queryBuilder.orderBy(`user.${pagination.sortBy}`, pagination.sortOrder);
    }

    const [items, total] = await queryBuilder.getManyAndCount();
    return { items, total };
  }
}
```

## 📋 Service-Specific Examples

### Auth Service Integration

```typescript
// services/auth-service/src/modules/auth/auth.controller.ts
import { ResponseBuilder, ServiceResponse } from '@soc-compliance/http-common';

@Controller('auth')
export class AuthController {
  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<ServiceResponse<LoginResponse>> {
    try {
      const result = await this.authService.login(loginDto);
      return ResponseBuilder.success(result, 'Login successful');
    } catch (error) {
      if (error.message === 'Invalid credentials') {
        return ResponseBuilder.unauthorized('Invalid email or password');
      }
      throw error; // Let global handler deal with unexpected errors
    }
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<ServiceResponse<User>> {
    try {
      const user = await this.authService.register(registerDto);
      return ResponseBuilder.success(user, 'User registered successfully');
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        return ResponseBuilder.conflict('User', 'email address');
      }
      throw error;
    }
  }
}
```

### Client Service Integration

```typescript
// services/client-service/src/modules/clients/clients.controller.ts
import { 
  ResponseBuilder, 
  ServiceResponse, 
  PaginatedResponse,
  QueryDto,
  PaginationPipes 
} from '@soc-compliance/http-common';

@Controller('clients')
export class ClientsController {
  @Get()
  async getClients(
    @Query(PaginationPipes.Client) query: QueryDto
  ): Promise<ServiceResponse<PaginatedResponse<Client>>> {
    const { items, total } = await this.clientsService.findPaginated(query);
    return ResponseBuilder.paginated(items, total, query.page!, query.pageSize!);
  }

  @Get('search')
  async searchClients(
    @Query(PaginationPipes.Client) query: QueryDto
  ): Promise<ServiceResponse<PaginatedResponse<Client>>> {
    const { items, total } = await this.clientsService.searchClients(query);
    return ResponseBuilder.paginated(
      items, 
      total, 
      query.page!, 
      query.pageSize!,
      `Found ${total} client records`
    );
  }
}
```

### Audit Service Integration

```typescript
// services/audit-service/src/modules/audits/audits.controller.ts
import { 
  ResponseBuilder, 
  ServiceResponse, 
  PaginatedResponse,
  QueryDto,
  PaginationPipes 
} from '@soc-compliance/http-common';

@Controller('audits')
export class AuditsController {
  @Get('findings')
  async getFindings(
    @Query(PaginationPipes.Audit) query: QueryDto
  ): Promise<ServiceResponse<PaginatedResponse<AuditFinding>>> {
    const { items, total } = await this.auditsService.findFindings(query);
    return ResponseBuilder.paginated(items, total, query.page!, query.pageSize!);
  }

  @Get('findings/summary')
  async getFindingsSummary(): Promise<ServiceResponse<FindingsSummary>> {
    const summary = await this.auditsService.getFindingsSummary();
    return ResponseBuilder.success(summary, 'Findings summary retrieved');
  }

  @Post('findings/:id/resolve')
  async resolveFinding(
    @Param('id') id: string,
    @Body() resolution: ResolutionDto
  ): Promise<ServiceResponse<AuditFinding>> {
    const finding = await this.auditsService.resolveFinding(id, resolution);
    return ResponseBuilder.success(finding, 'Finding resolved successfully');
  }
}
```

### Control Service Integration

```typescript
// services/control-service/src/modules/controls/controls.controller.ts
import { 
  ResponseBuilder, 
  ServiceResponse, 
  PaginatedResponse,
  QueryDto,
  PaginationPipes 
} from '@soc-compliance/http-common';

@Controller('controls')
export class ControlsController {
  @Get()
  async getControls(
    @Query(PaginationPipes.Control) query: QueryDto
  ): Promise<ServiceResponse<PaginatedResponse<Control>>> {
    const config = {
      defaultPageSize: 15,
      maxPageSize: 50,
      allowedSortFields: ['code', 'title', 'category', 'implementationStatus', 'createdAt']
    };
    
    const { items, total } = await this.controlsService.findPaginated(query, config);
    return ResponseBuilder.paginated(items, total, query.page!, query.pageSize!);
  }

  @Get('summary')
  async getControlsSummary(): Promise<ServiceResponse<ControlSummary>> {
    const summary = await this.controlsService.getSummary();
    return ResponseBuilder.success(summary, 'Control summary retrieved');
  }

  @Post(':id/test')
  async testControl(
    @Param('id') id: string,
    @Body() testData: ControlTestDto
  ): Promise<ServiceResponse<ControlTestResult>> {
    const result = await this.controlsService.testControl(id, testData);
    return ResponseBuilder.success(result, 'Control test completed');
  }
}
```

## 🔄 Migration Strategy

### Phase 1: Add Module (Non-Breaking)
1. Add `HttpCommonModule` to each service module
2. Install the response interceptor globally
3. Existing endpoints continue to work unchanged

### Phase 2: Update Controllers (Gradual)
1. Update one controller at a time
2. Change return types to `ServiceResponse<T>`
3. Use `ResponseBuilder` for responses
4. Update error handling patterns

### Phase 3: Update Services (Internal)
1. Update service methods to use pagination utilities
2. Standardize error throwing/handling
3. Update TypeORM query patterns

### Phase 4: Frontend Updates
1. Update frontend code to expect new response format
2. Handle pagination metadata
3. Update error handling to use new error format

## 🧪 Testing Updates

### Controller Tests

```typescript
// Before
describe('UsersController', () => {
  it('should return users', async () => {
    const result = await controller.getUsers(1, 10);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});

// After
import { ResponseBuilder } from '@soc-compliance/http-common';

describe('UsersController', () => {
  it('should return paginated users', async () => {
    const query = { page: 1, pageSize: 10 };
    const result = await controller.getUsers(query);
    
    expect(result).toMatchObject({
      success: true,
      data: {
        items: expect.any(Array),
        total: expect.any(Number),
        page: 1,
        pageSize: 10,
        totalPages: expect.any(Number)
      },
      metadata: expect.objectContaining({
        requestId: expect.any(String),
        timestamp: expect.any(Date)
      })
    });
  });

  it('should return not found for invalid user', async () => {
    jest.spyOn(service, 'findById').mockResolvedValue(null);
    
    const result = await controller.getUser('invalid-id');
    expect(result).toEqual(ResponseBuilder.notFound('User', 'invalid-id'));
  });
});
```

### Service Tests

```typescript
// Test pagination utilities
import { PaginationUtil } from '@soc-compliance/http-common';

describe('UsersService', () => {
  it('should normalize pagination correctly', () => {
    const query = { page: 2, pageSize: 20, sortBy: 'name', sortOrder: 'DESC' };
    const normalized = PaginationUtil.normalizePagination(query);
    
    expect(normalized).toEqual({
      page: 2,
      pageSize: 20,
      offset: 20,
      sortBy: 'name',
      sortOrder: 'DESC'
    });
  });

  it('should execute paginated query', async () => {
    const query = { page: 1, pageSize: 10 };
    const mockRepository = {
      findAndCount: jest.fn().mockResolvedValue([mockUsers, 50])
    };
    
    const result = await PaginationUtil.executePaginatedQuery(
      mockRepository,
      PaginationUtil.normalizePagination(query),
      { where: { active: true } }
    );
    
    expect(result).toEqual({
      items: mockUsers,
      total: 50
    });
  });
});
```

## 📊 Response Format Examples

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

### Paginated Response
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "pageSize": 10,
    "totalPages": 10
  },
  "metadata": {
    "requestId": "uuid-v4",
    "pagination": {
      "hasNext": true,
      "hasPrev": false,
      "offset": 0
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "details": {
      "type": "VALIDATION",
      "validationErrors": [
        {
          "field": "email",
          "message": "Invalid email format",
          "value": "invalid-email"
        }
      ]
    }
  },
  "metadata": {
    "requestId": "uuid-v4",
    "correlationId": "correlation-uuid"
  }
}
```

## 🔧 Configuration Options

### Service-Specific Pagination
```typescript
// Each service can have custom pagination config
const userServiceConfig = {
  defaultPageSize: 10,
  maxPageSize: 50,
  allowedSortFields: ['id', 'name', 'email', 'createdAt']
};

const auditServiceConfig = {
  defaultPageSize: 20,
  maxPageSize: 100,
  allowedSortFields: ['id', 'severity', 'status', 'createdAt']
};
```

### Response Interceptor Options
```typescript
HttpCommonModule.forRoot({
  enableResponseInterceptor: true,
  responseInterceptorConfig: {
    enableLogging: process.env.NODE_ENV !== 'production',
    enableTiming: true,
    enableCorrelationId: true,
    productionErrorMode: process.env.NODE_ENV === 'production'
  }
})
```

## 🚀 Deployment Checklist

### Before Deployment
- [ ] Update service module with HttpCommonModule
- [ ] Update all controller methods to return ServiceResponse<T>
- [ ] Update service methods to use pagination utilities
- [ ] Update tests to expect new response format
- [ ] Test pagination with various parameters
- [ ] Test error scenarios return standardized format

### After Deployment
- [ ] Monitor response times (should be minimal impact)
- [ ] Verify correlation IDs are flowing correctly
- [ ] Check that pagination works across all endpoints
- [ ] Validate error responses are consistent
- [ ] Update frontend code to handle new format
- [ ] Update API documentation

## 🐛 Common Issues & Solutions

### Issue: TypeORM Type Conflicts
```typescript
// Problem: TypeORM types don't match exactly
const [items, total] = await repository.findAndCount(typeormOptions);

// Solution: Use QueryBuilder for complex queries
const queryBuilder = repository.createQueryBuilder('entity');
queryBuilder.skip(pagination.offset);
queryBuilder.take(pagination.pageSize);
const [items, total] = await queryBuilder.getManyAndCount();
```

### Issue: Existing Frontend Expects Old Format
```typescript
// Temporary: Support both formats during migration
if (response.success !== undefined) {
  // New format
  return response.data;
} else {
  // Old format
  return response;
}
```

### Issue: Performance Impact
```typescript
// Disable features for high-performance endpoints
HttpCommonModule.forRoot({
  responseInterceptorConfig: {
    enableLogging: false, // Disable for production
    enableTiming: false,  // Disable for high-throughput endpoints
  }
})

// Or disable interceptor for specific routes
@UseInterceptors() // Empty decorator disables global interceptors
async highPerformanceEndpoint() { ... }
```

This integration guide provides a complete roadmap for adopting the standardized response utilities across all services in the SOC Compliance Platform. The migration can be done gradually, ensuring zero downtime and smooth transition to the new format.