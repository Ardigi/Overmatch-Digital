# Actual Service Communication Patterns

**Last Updated**: August 10, 2025  
**Status**: Implementation Documentation (Not Aspirational)

## Overview

This document describes the **actual implemented** communication patterns between services in the SOC Compliance Platform, based on code analysis performed on August 10, 2025.

## Communication Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Kong API Gateway                             │
│                          (Port 8000)                                 │
└─────────────────────────────────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│ Auth Service  │       │Client Service │       │Policy Service │
│  Port 3001    │       │  Port 3002    │       │  Port 3003    │
└───────────────┘       └───────────────┘       └───────────────┘
        │                        │                        │
        └────────────┬───────────┴────────────┬──────────┘
                     ▼                         ▼
            ┌──────────────┐          ┌──────────────┐
            │    Kafka     │          │    Redis     │
            │  Port 9092   │          │  Port 6379   │
            └──────────────┘          └──────────────┘
```

## 1. Kafka Event-Driven Communication

### Implemented Event Topics

| Topic | Producer Services | Consumer Services | Purpose |
|-------|------------------|-------------------|---------|
| `auth-events` | Auth Service | Notification, Audit | User lifecycle events |
| `notification-requests` | All Services | Notification Service | Cross-service notifications |
| `audit-events` | All Services | Audit Service | Compliance audit trail |
| `client.events` | Client Service | Multiple | Organization changes |

### Actual Event Publishing Code

**Auth Service Publishing:**
```typescript
// services/auth-service/src/modules/auth/services/auth.service.ts
await this.kafkaService.publishAuthEvent({
  eventType: AuthEventType.USER_CREATED,
  userId: user.id,
  organizationId: user.organizationId,
  timestamp: new Date(),
  metadata: {
    email: user.email,
    role: user.role
  }
});
```

**Notification Service Consuming:**
```typescript
// services/notification-service/src/modules/notification/services/event-handler.service.ts
@EventPattern('user.created')
async handleUserCreated(@Payload() data: any) {
  await this.eventHandlerService.handleEvent('user.created', data);
}
```

### Event Patterns Currently Used

1. **Authentication Events**
   - `auth.user.created`
   - `auth.user.updated`
   - `auth.session.created`
   - `auth.mfa.enabled`

2. **Client Management Events**
   - `client.organization.created`
   - `client.organization.updated`
   - `client.user.assigned`

3. **Compliance Events**
   - `control.created`
   - `control.implemented`
   - `evidence.uploaded`
   - `audit.started`

## 2. Direct HTTP/REST Communication

### Implemented Service-to-Service Calls

**Notification → Auth Service:**
```typescript
// services/notification-service/src/modules/notification/services/user.service.ts
async getUserById(userId: string): Promise<UserData | null> {
  try {
    const response = await firstValueFrom(
      this.httpService.get(
        `${this.authServiceUrl}/api/users/${userId}`,
        {
          headers: {
            'X-Internal-Service': 'notification-service',
          },
        }
      )
    );
    return response.data;
  } catch (error) {
    this.logger.error(`Failed to fetch user: ${error.message}`);
    return null;
  }
}
```

**Notification → Client Service:**
```typescript
// services/notification-service/src/modules/notification/services/organization.service.ts
async getOrganizationById(organizationId: string): Promise<OrganizationData | null> {
  const response = await firstValueFrom(
    this.httpService.get(
      `${this.clientServiceUrl}/api/organizations/${organizationId}`,
      {
        headers: {
          'X-Internal-Service': 'notification-service',
        },
      }
    )
  );
  return response.data;
}
```

### Service URLs Configuration

```typescript
// Environment-based configuration
authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:3001'
clientServiceUrl: process.env.CLIENT_SERVICE_URL || 'http://127.0.0.1:3002'
policyServiceUrl: process.env.POLICY_SERVICE_URL || 'http://127.0.0.1:3003'
```

## 3. Kong API Gateway Routing

### Actual Kong Configuration

```yaml
# Loaded from Kong admin API
services:
  - name: auth-service
    url: http://auth-service:3000
    routes:
      - paths: [/api/v1/auth]
    plugins:
      - name: jwt
      - name: rate-limiting
        config:
          minute: 100
          hour: 10000

  - name: client-service  
    url: http://client-service:3001
    routes:
      - paths: [/api/v1/clients]
    plugins:
      - name: jwt
      - name: cors
```

### Headers Added by Kong

```typescript
// Headers available to services
headers: {
  'x-consumer-id': 'user-uuid',          // From JWT auth
  'x-consumer-custom-id': 'org-uuid',    // Organization ID
  'x-consumer-username': 'user@email.com'
}
```

## 4. Redis Usage Patterns

### Session Management (Auth Service)

```typescript
// Store session
await this.redisService.set(
  `session:${sessionId}`,
  JSON.stringify(sessionData),
  3600 // 1 hour TTL
);

// Retrieve session
const sessionData = await this.redisService.get(`session:${sessionId}`);
```

### MFA Data (Auth Service)

```typescript
// Store MFA setup
await this.redisService.set(
  `mfa:setup:${userId}`,
  JSON.stringify({ 
    secret: secret.base32, 
    timestamp: Date.now() 
  }),
  600 // 10 minutes TTL
);

// Store trusted device
await this.redisService.set(
  `trusted_device:${userId}:${hashedFingerprint}`,
  JSON.stringify({ 
    fingerprint, 
    trustedAt: Date.now() 
  }),
  duration / 1000
);
```

### Response Caching (All Services)

```typescript
// Cache user data
await this.cacheService.set(
  `user:${userId}`,
  JSON.stringify(userData),
  { ttl: 3600 } // 1 hour
);

// Cache organization settings
await this.cacheService.set(
  `org:${organizationId}:settings`,
  JSON.stringify(settings),
  { ttl: 1800 } // 30 minutes
);
```

## 5. Database Access Patterns

### No Cross-Service Database Access

Each service strictly accesses only its own database:

| Service | Database | Access Pattern |
|---------|----------|---------------|
| Auth | soc_auth | TypeORM via Repository pattern |
| Client | soc_clients | TypeORM via Repository pattern |
| Policy | soc_policies | TypeORM via Repository pattern |
| Control | soc_controls | TypeORM via Repository pattern |
| Evidence | soc_evidence | TypeORM via Repository pattern |
| Workflow | soc_workflows | TypeORM via Repository pattern |
| Reporting | soc_reporting | TypeORM via Repository pattern |
| Audit | soc_audits | TypeORM via Repository pattern |
| Integration | soc_integrations | TypeORM via Repository pattern |
| Notification | soc_notifications | TypeORM via Repository pattern |
| AI | soc_ai | TypeORM via Repository pattern |

## 6. Error Handling and Resilience

### Circuit Breaker Pattern (Not Yet Implemented)

Currently using try-catch with fallbacks:

```typescript
try {
  const response = await firstValueFrom(
    this.httpService.get(url).pipe(
      timeout(5000), // 5 second timeout
      retry(2) // Retry twice
    )
  );
  return response.data;
} catch (error) {
  this.logger.error(`Service call failed: ${error.message}`);
  // Return cached data if available
  const cached = await this.cacheService.get(cacheKey);
  return cached ? JSON.parse(cached) : null;
}
```

### Health Checks

Each service exposes `/health` endpoint:

```typescript
@Get('health')
healthCheck() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'auth-service',
    version: process.env.npm_package_version
  };
}
```

## 7. Authentication Between Services

### Internal Service Headers

```typescript
// Services identify themselves
headers: {
  'X-Internal-Service': 'notification-service',
  'X-Request-ID': uuidv4(), // For tracing
}
```

### JWT Validation (Via Kong)

Services trust Kong's JWT validation:

```typescript
// Headers from Kong after JWT validation
const userId = request.headers['x-consumer-id'];
const organizationId = request.headers['x-consumer-custom-id'];
// No need to re-validate JWT
```

## 8. Monitoring and Observability

### OpenTelemetry Integration

```typescript
// Trace inter-service calls
const span = this.tracer.startSpan('fetch-user-data');
try {
  const user = await this.getUserById(userId);
  span.setStatus({ code: SpanStatusCode.OK });
  return user;
} catch (error) {
  span.setStatus({ 
    code: SpanStatusCode.ERROR,
    message: error.message 
  });
  throw error;
} finally {
  span.end();
}
```

### Metrics Collection

```typescript
// Track service call latency
const timer = this.metricsService.startTimer('http_request_duration');
const response = await this.httpService.get(url);
timer.end({ service: 'auth', method: 'GET' });
```

## 9. Service Dependencies

### Dependency Matrix

| Service | Depends On | Communication Method |
|---------|------------|---------------------|
| Auth | Redis, Kafka | Direct, Events |
| Client | Auth, Kafka | HTTP, Events |
| Policy | Client, Kafka | HTTP, Events |
| Control | Policy, Kafka | HTTP, Events |
| Evidence | Control, Client | HTTP, Events |
| Workflow | All Services | Events |
| Reporting | All Services | HTTP, Events |
| Audit | Kafka Only | Events |
| Integration | Multiple | HTTP, Events |
| Notification | Auth, Client | HTTP, Events |
| AI | Evidence, Control | HTTP, Events |

## 10. Known Issues and TODOs

### Current Limitations

1. **No Circuit Breaker**: Services use simple retry with fallback
2. **No Service Mesh**: Direct service-to-service communication
3. **Limited Load Balancing**: Single instance per service
4. **Manual Service Discovery**: URLs in configuration

### Planned Improvements

1. Implement Hystrix or similar circuit breaker
2. Add service mesh (Istio/Linkerd)
3. Implement proper service discovery (Consul/Eureka)
4. Add distributed tracing (Jaeger)
5. Implement saga pattern for distributed transactions

## Testing Inter-Service Communication

### Integration Test Example

```typescript
// Test Kafka event flow
it('should handle user creation event', async () => {
  // Publish event
  await kafkaProducer.send({
    topic: 'auth-events',
    messages: [{
      value: JSON.stringify({
        type: 'user.created',
        userId: 'test-user-id',
        organizationId: 'test-org-id'
      })
    }]
  });

  // Wait for consumer
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Verify notification was created
  const notification = await notificationRepository.findOne({
    where: { userId: 'test-user-id' }
  });
  expect(notification).toBeDefined();
});
```

### Manual Testing Commands

```bash
# Test Kafka connectivity
docker exec overmatch-digital-kafka-1 kafka-topics --list --bootstrap-server localhost:9092

# Test Redis connectivity
docker exec overmatch-digital-redis-1 redis-cli -a soc_redis_pass ping

# Test service health
curl http://localhost:3001/health
curl http://localhost:3002/health

# Test Kong routing
curl http://localhost:8000/api/v1/auth/health
```

## Conclusion

The SOC Compliance Platform implements a hybrid communication architecture combining:

1. **Event-driven architecture** via Kafka for asynchronous operations
2. **Direct HTTP calls** for synchronous data retrieval
3. **Kong API Gateway** for external API management
4. **Redis** for caching and session management
5. **Strong service isolation** with no cross-database access

This architecture provides good separation of concerns while maintaining performance and reliability. Future improvements should focus on adding circuit breakers, service mesh, and better observability tools.