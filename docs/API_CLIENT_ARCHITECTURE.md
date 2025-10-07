# API Client Architecture

## Overview

The SOC Compliance Platform uses a centralized API client architecture for frontend-to-backend communication. This document outlines the service client pattern, lazy initialization approach, and best practices.

## Service Client Pattern

### Architecture

```
Frontend Components
    ↓
Service-Specific Clients (authClient, clientServiceClient, etc.)
    ↓
Base ApiClient Class
    ↓
Backend Services
```

### Service Clients

Located in `lib/api/service-clients.ts`, these provide pre-configured instances for each backend service:

- `authClient` - Authentication service (port 3001)
- `clientServiceClient` - Client management (port 3002) 
- `policyClient` - Policy management (port 3003)
- `controlClient` - Control framework (port 3004)
- `evidenceClient` - Evidence collection (port 3005)
- `workflowClient` - Workflow engine (port 3006)
- `reportingClient` - Report generation (port 3007)
- `auditClient` - Audit trails (port 3008)
- `integrationClient` - External integrations (port 3009)
- `notificationClient` - Notifications (port 3010)
- `aiClient` - AI processing (port 3011)

## Lazy Initialization Pattern

### Problem Solved

**Circular Dependency Chain**:
```
api-client.ts → token-manager.ts → auth.ts → service-clients.ts → api-client.ts
```

This created a temporal dead zone error: `"can't access lexical declaration 'ApiClient' before initialization"`

### Solution Implementation

**Before (Immediate Instantiation)**:
```typescript
import { ApiClient } from './api-client';
import { apiConfig } from './config';

export const authClient = new ApiClient({
  service: 'auth',
  baseURL: apiConfig.useKong ? apiConfig.baseURL : undefined,
});
```

**After (Lazy Initialization)**:
```typescript
import type { ApiClient as ApiClientType } from './api-client';

let _authClient: ApiClientType | undefined;

Object.defineProperty(exports, 'authClient', {
  get: function() {
    if (!_authClient) {
      const { ApiClient } = require('./api-client');
      const { apiConfig } = require('./config');
      _authClient = new ApiClient({
        service: 'auth',
        baseURL: apiConfig.useKong ? apiConfig.baseURL : undefined,
      });
    }
    return _authClient;
  }
});
```

### Key Benefits

1. **Breaks Circular Dependencies**: Modules load without immediate instantiation
2. **Singleton Pattern**: Each client is created once and reused
3. **Dynamic Loading**: Dependencies resolved only when accessed
4. **Type Safety**: Uses type imports to avoid runtime dependencies

## Usage Examples

### Basic Usage

```typescript
import { authClient } from '@/lib/api/service-clients';

// Client is instantiated on first access
const response = await authClient.post('/login', credentials);
```

### Error Handling

```typescript
try {
  const data = await clientServiceClient.get('/organizations');
  return data;
} catch (error) {
  if (error instanceof ApiClientError) {
    console.error('API Error:', error.message, error.status);
  }
  throw error;
}
```

## Configuration

### Environment-based Routing

```typescript
// Development: Direct service URLs
authClient → http://localhost:3001
clientServiceClient → http://localhost:3002

// Production: Kong Gateway
authClient → http://gateway:8000/api/auth
clientServiceClient → http://gateway:8000/api/clients
```

### ApiConfig Structure

```typescript
interface ApiConfig {
  useKong: boolean;
  baseURL: string;
  services: ServiceEndpoints;
}
```

## Best Practices

### 1. Import Pattern
```typescript
// ✅ Use service clients
import { authClient } from '@/lib/api/service-clients';

// ❌ Don't instantiate directly
import { ApiClient } from '@/lib/api/api-client';
const client = new ApiClient();
```

### 2. Error Handling
```typescript
// ✅ Handle specific errors
catch (error) {
  if (error.status === 401) {
    // Handle authentication
  }
}

// ❌ Generic catch-all
catch (error) {
  console.log(error);
}
```

### 3. Type Safety
```typescript
// ✅ Type your responses
interface LoginResponse {
  user: User;
  access_token: string;
}

const response = await authClient.post<LoginResponse>('/login', data);
```

## Troubleshooting

### Common Issues

1. **"ApiClient before initialization"**
   - Cause: Circular dependency
   - Solution: Already implemented with lazy loading

2. **"Cannot resolve service-clients"**
   - Cause: Build cache issue
   - Solution: `npm run build:shared`

3. **Service not responding**
   - Check service is running on expected port
   - Verify Docker services are up
   - Check network connectivity

### Debug Tips

```typescript
// Check if client is instantiated
console.log('Auth client:', typeof authClient);

// Monitor API calls
authClient.interceptors.request.use(config => {
  console.log('API Request:', config);
  return config;
});
```

## Migration from Direct Instantiation

If converting from direct ApiClient usage:

```typescript
// Old approach
const client = new ApiClient({ service: 'auth' });

// New approach  
import { authClient } from '@/lib/api/service-clients';
// Use authClient directly
```

## Testing

### Unit Tests

```typescript
// Mock the service client
jest.mock('@/lib/api/service-clients', () => ({
  authClient: {
    post: jest.fn(),
    get: jest.fn(),
  }
}));
```

### Integration Tests

```typescript
// Test actual client instantiation
describe('Service Clients', () => {
  it('should instantiate auth client on first access', () => {
    const client = authClient;
    expect(client).toBeDefined();
    expect(typeof client.post).toBe('function');
  });
});
```

## Related Documentation

- [`lib/api/api-client.ts`](../lib/api/api-client.ts) - Base ApiClient implementation
- [`lib/api/config.ts`](../lib/api/config.ts) - Environment configuration
- [`CLAUDE.md`](../CLAUDE.md) - Development troubleshooting guide