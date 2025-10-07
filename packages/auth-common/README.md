# @soc-compliance/auth-common

Shared authentication utilities, guards, and decorators for the SOC Compliance Platform microservices.

## Installation

```bash
npm install @soc-compliance/auth-common
```

## Features

- JWT authentication guards
- Service-to-service authentication
- Role-based access control (RBAC)
- Centralized API key management
- Custom decorators for auth context

## Service API Keys Configuration

The `ServiceApiKeysConfig` class provides centralized management of service API keys across all microservices.

### Basic Usage

```typescript
import { ServiceApiKeysConfig } from '@soc-compliance/auth-common';

// Get API key for a service
const apiKey = ServiceApiKeysConfig.getApiKey('evidence-service');

// Check if using default (development) key
const isDefault = ServiceApiKeysConfig.isUsingDefault('evidence-service');

// Validate an API key
const isValid = ServiceApiKeysConfig.validateApiKey('evidence-service', providedKey);

// Get JWT secret for service authentication
const jwtSecret = ServiceApiKeysConfig.getServiceJwtSecret();
```

### Configuration

#### Development Environment
In development, the configuration automatically provides default API keys for all services:

```bash
# Default keys are automatically used if environment variables are not set
SERVICE_API_KEY_AUTH_SERVICE=dev-auth-service-api-key-2024
SERVICE_API_KEY_CLIENT_SERVICE=dev-client-service-api-key-2024
# ... etc
```

#### Production Environment
In production, you MUST configure API keys via environment variables:

```bash
# Required environment variables
SERVICE_API_KEY_AUTH_SERVICE=<secure-random-key>
SERVICE_API_KEY_CLIENT_SERVICE=<secure-random-key>
SERVICE_API_KEY_POLICY_SERVICE=<secure-random-key>
SERVICE_API_KEY_CONTROL_SERVICE=<secure-random-key>
SERVICE_API_KEY_EVIDENCE_SERVICE=<secure-random-key>
SERVICE_API_KEY_WORKFLOW_SERVICE=<secure-random-key>
SERVICE_API_KEY_REPORTING_SERVICE=<secure-random-key>
SERVICE_API_KEY_AUDIT_SERVICE=<secure-random-key>
SERVICE_API_KEY_INTEGRATION_SERVICE=<secure-random-key>
SERVICE_API_KEY_NOTIFICATION_SERVICE=<secure-random-key>
SERVICE_API_KEY_AI_SERVICE=<secure-random-key>
SERVICE_JWT_SECRET=<secure-jwt-secret>
```

## Guards

### ServiceAuthGuard

Allows endpoints to accept both user JWT tokens and service API keys:

```typescript
import { ServiceAuth } from '@soc-compliance/auth-common';
import { UseGuards } from '@nestjs/common';

@Controller('evidence')
export class EvidenceController {
  @Get('insights/:organizationId')
  @ServiceAuth() // Accepts both JWT and API key
  async getInsights(@Param('organizationId') organizationId: string) {
    // Endpoint can be called by:
    // 1. Authenticated users with valid JWT
    // 2. Other services using their API key
    return this.evidenceService.getInsights(organizationId);
  }
}
```

### KongAuthGuard

Standard authentication guard for user requests coming through Kong API Gateway:

```typescript
import { KongAuthGuard } from '@soc-compliance/auth-common';

@Controller('users')
@UseGuards(KongAuthGuard)
export class UserController {
  // All routes require authentication
}
```

### KongRolesGuard

Role-based access control for authenticated users:

```typescript
import { KongRolesGuard, Roles } from '@soc-compliance/auth-common';

@Controller('admin')
@UseGuards(KongAuthGuard, KongRolesGuard)
export class AdminController {
  @Post('users')
  @Roles('admin', 'super_admin')
  createUser(@Body() dto: CreateUserDto) {
    // Only admin and super_admin can access
  }
}
```

## Decorators

### @KongUser()

Extract authenticated user information from request:

```typescript
import { KongUser } from '@soc-compliance/auth-common';

@Controller('profile')
export class ProfileController {
  @Get()
  getProfile(@KongUser() user: KongUser) {
    // user contains: id, email, organizationId, roles
    return this.profileService.getProfile(user.id);
  }
}
```

### @ServiceAuth()

Decorator that combines guards to allow both user and service authentication:

```typescript
@Get('data/:id')
@ServiceAuth()
async getData(@Param('id') id: string) {
  // Can be called by users or services
}
```

## Integration with HTTP Client

When using the `@soc-compliance/http-common` package, service API keys are automatically included:

```typescript
import { HttpClientService } from '@soc-compliance/http-common';

@Injectable()
export class MyService {
  constructor(private httpClient: HttpClientService) {}

  async callAnotherService() {
    // API key is automatically added based on service name
    const response = await this.httpClient.get(
      'http://evidence-service:3005/evidence/insights/org-123',
      {},
      { name: 'evidence-service' }
    );
    
    return response.data;
  }
}
```

## Security Best Practices

1. **Never commit API keys** - Use environment variables or secrets management
2. **Rotate keys regularly** - Implement key rotation in production
3. **Use HTTPS in production** - Ensure encrypted communication
4. **Monitor API key usage** - Track which services are communicating
5. **Implement rate limiting** - Prevent abuse even between services
6. **Use least privilege** - Only grant necessary permissions

## Error Handling

The guards provide clear error messages:

- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Valid authentication but insufficient permissions
- `400 Bad Request` - Malformed authentication headers

## Development Tips

1. In development, default API keys are automatically configured
2. Use `NODE_ENV=production` to enforce production security requirements
3. The configuration logs warnings when using default keys
4. All API keys follow the pattern: `dev-{service-name}-api-key-2024`

## Migration Guide

If migrating from hardcoded API keys:

```typescript
// Old approach (hardcoded)
const API_KEYS = {
  'auth-service': 'hardcoded-key',
  // ...
};

// New approach (centralized)
import { ServiceApiKeysConfig } from '@soc-compliance/auth-common';

const apiKey = ServiceApiKeysConfig.getApiKey('auth-service');
```

## Support

For issues or questions, please refer to the main project documentation or create an issue in the repository.