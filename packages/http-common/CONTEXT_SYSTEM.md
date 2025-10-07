# Request Context Propagation System

A comprehensive request context propagation system that tracks request metadata across service boundaries in the SOC compliance platform.

## Features

- **Correlation ID Generation & Propagation**: Automatic correlation ID creation and propagation across all service calls
- **User Context Tracking**: Tracks user ID, organization ID, roles, and other user metadata
- **Audit Context**: Comprehensive audit logging with action, resource, timestamp, and metadata
- **Request Metadata**: Tracks source service, target service, HTTP methods, and timing information
- **AsyncLocalStorage**: Uses Node.js AsyncLocalStorage for request-scoped storage without explicit passing
- **Automatic Header Injection**: HTTP client automatically adds context headers to outgoing requests
- **Kong Integration**: Extracts user context from Kong gateway headers (x-consumer-id, x-consumer-custom-id)

## Quick Start

### 1. Module Setup

```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { HttpCommonModule, ContextMiddleware } from '@soc-compliance/http-common';

@Module({
  imports: [
    HttpCommonModule.forRoot({
      enableRequestContext: true,
      enableContextInterceptor: true,
      contextOptions: {
        includeUserContext: true,
        includeAuditContext: true,
        includeRequestMetadata: true,
      },
    }),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ContextMiddleware).forRoutes('*');
  }
}
```

### 2. Service Usage

```typescript
@Injectable()
export class UserService {
  constructor(
    private readonly contextService: RequestContextService,
    private readonly httpClient: HttpClientService,
  ) {}

  async getUserProfile(userId: string) {
    // Get current context
    const context = this.contextService.getCurrentContext();
    console.log('Correlation ID:', context?.correlationId);
    
    // Make HTTP call - context automatically propagated
    const response = await this.httpClient.get(
      `/user-service/users/${userId}`,
      undefined,
      { name: 'user-service' }
    );
    
    return response.data;
  }
}
```

### 3. Controller Usage

```typescript
@Controller('users')
export class UserController {
  constructor(private readonly contextService: RequestContextService) {}

  @Post()
  async createUser(@Body() userData: any) {
    // Update audit context
    this.contextService.updateContext({
      audit: {
        action: 'create_user',
        resource: 'users',
        timestamp: new Date(),
        metadata: { userData },
      },
    });

    // Process continues with updated context
    return this.userService.createUser(userData);
  }
}
```

## Components

### Core Services

- **RequestContextService**: Main service for managing request context using AsyncLocalStorage
- **ContextMiddleware**: Express middleware that initializes context from incoming requests
- **ContextInterceptor**: NestJS interceptor for enhanced logging and audit tracking

### Context Data

- **RequestContext**: Main context interface containing correlation ID, user, audit, and request metadata
- **UserContext**: User information (ID, organization, roles, email)
- **AuditContext**: Audit information (action, resource, timestamp, client IP, user agent)
- **RequestMetadata**: Request information (source/target services, method, path, timing)

### HTTP Integration

- **Automatic Header Propagation**: Context headers automatically added to outgoing HTTP requests
- **Kong Gateway Integration**: Extracts user context from Kong headers
- **Configurable Options**: Control what context information to include in propagation

## Context Headers

The system uses standardized headers for context propagation:

- `x-correlation-id`: Unique request identifier
- `x-user-id`: User identifier
- `x-organization-id`: Organization identifier  
- `x-user-roles`: Comma-separated user roles
- `x-source-service`: Service making the request
- `x-target-service`: Service receiving the request
- `x-audit-action`: Action being performed
- `x-audit-resource`: Resource being accessed
- `x-client-ip`: Client IP address
- `x-request-timestamp`: Request start timestamp

## Advanced Usage

### Background Jobs

```typescript
// Create context for background processing
const contextHeaders = this.httpClient.createMinimalContextHeaders(
  correlationId,
  'background-processor'
);

await this.httpClient.requestWithContext(
  'POST',
  '/workflow-service/jobs',
  contextHeaders,
  jobData
);
```

### Testing

```typescript
it('should process with context', async () => {
  const testContext: RequestContext = {
    correlationId: 'test-123',
    user: { userId: 'user-123', organizationId: 'org-456', roles: ['user'] },
    // ... other context data
  };

  await contextService.runWithContext(testContext, async () => {
    const result = await service.processData();
    expect(contextService.getCorrelationId()).toBe('test-123');
  });
});
```

### Custom Context Data

```typescript
// Store custom data in context
this.contextService.setCustomData('orderId', '12345');

// Retrieve custom data
const orderId = this.contextService.getCustomData<string>('orderId');
```

## Benefits

1. **Request Tracing**: Full request tracing across all microservices with correlation IDs
2. **Audit Compliance**: Comprehensive audit logging for SOC compliance requirements  
3. **User Context**: Automatic user context propagation for multi-tenant applications
4. **Debugging**: Enhanced logging with request correlation and context information
5. **Security**: Tracks user actions and resource access for security monitoring
6. **Performance**: Minimal overhead using AsyncLocalStorage and optional context inclusion

## See Also

- `src/examples/context-usage-examples.ts` - Comprehensive usage examples
- `src/interfaces/request-context.interface.ts` - Type definitions
- `src/context/` - Core implementation files