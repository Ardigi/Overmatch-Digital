# Service Dependency Map

**Last Updated**: August 10, 2025  
**Status**: Current Implementation

## Visual Dependency Graph

```mermaid
graph TB
    %% External Entry Points
    User[User/Browser]
    API[External API Clients]
    
    %% API Gateway
    Kong[Kong API Gateway<br/>:8000]
    
    %% Frontend
    Frontend[Frontend Next.js<br/>:3000]
    
    %% Core Services
    Auth[Auth Service<br/>:3001]
    Client[Client Service<br/>:3002]
    Policy[Policy Service<br/>:3003]
    Control[Control Service<br/>:3004]
    Evidence[Evidence Service<br/>:3005]
    Workflow[Workflow Service<br/>:3006]
    Reporting[Reporting Service<br/>:3007]
    Audit[Audit Service<br/>:3008]
    Integration[Integration Service<br/>:3009]
    Notification[Notification Service<br/>:3010]
    AI[AI Service<br/>:3011]
    
    %% Infrastructure Services
    Postgres[(PostgreSQL<br/>:5432)]
    MongoDB[(MongoDB<br/>:27017)]
    Redis[(Redis<br/>:6379)]
    Kafka[/Kafka<br/>:9092\]
    Elastic[(Elasticsearch<br/>:9200)]
    
    %% User Flow
    User --> Frontend
    User --> Kong
    API --> Kong
    
    %% Frontend Dependencies
    Frontend --> Kong
    Frontend -.->|WebSocket| Notification
    
    %% Kong Routes
    Kong --> Auth
    Kong --> Client
    Kong --> Policy
    Kong --> Control
    Kong --> Evidence
    Kong --> Workflow
    Kong --> Reporting
    Kong --> Audit
    Kong --> Integration
    Kong --> Notification
    Kong --> AI
    
    %% Service Dependencies
    Client -->|HTTP| Auth
    Policy -->|HTTP| Client
    Control -->|HTTP| Policy
    Evidence -->|HTTP| Control
    Evidence -->|HTTP| Client
    Workflow -->|Events| Kafka
    Reporting -->|HTTP| Client
    Reporting -->|HTTP| Policy
    Reporting -->|HTTP| Control
    Reporting -->|HTTP| Evidence
    Notification -->|HTTP| Auth
    Notification -->|HTTP| Client
    AI -->|HTTP| Evidence
    AI -->|HTTP| Control
    
    %% Database Dependencies
    Auth --> Postgres
    Auth --> Redis
    Client --> Postgres
    Policy --> Postgres
    Control --> Postgres
    Evidence --> Postgres
    Evidence --> MongoDB
    Workflow --> Postgres
    Reporting --> Postgres
    Reporting --> Elastic
    Audit --> Postgres
    Integration --> Postgres
    Notification --> Postgres
    AI --> Postgres
    AI --> MongoDB
    
    %% Event Bus
    Auth -->|Publish| Kafka
    Client -->|Publish| Kafka
    Policy -->|Publish| Kafka
    Control -->|Publish| Kafka
    Evidence -->|Publish| Kafka
    Workflow -->|Pub/Sub| Kafka
    Audit -->|Subscribe| Kafka
    Notification -->|Subscribe| Kafka
    
    %% Caching
    Auth --> Redis
    Client --> Redis
    Policy --> Redis
    Control --> Redis
    Evidence --> Redis
    Notification --> Redis
    
    %% Styling
    classDef userNode fill:#e1f5fe,stroke:#01579b,stroke-width:3px
    classDef gatewayNode fill:#fff3e0,stroke:#e65100,stroke-width:3px
    classDef serviceNode fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef dbNode fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef messageNode fill:#fce4ec,stroke:#880e4f,stroke-width:2px
    
    class User,API userNode
    class Kong,Frontend gatewayNode
    class Auth,Client,Policy,Control,Evidence,Workflow,Reporting,Audit,Integration,Notification,AI serviceNode
    class Postgres,MongoDB,Redis,Elastic dbNode
    class Kafka messageNode
```

## Service Dependency Matrix

| Service | Depends On (Direct) | Depended By | Database | Cache | Events |
|---------|-------------------|-------------|----------|--------|---------|
| **Auth** | Redis, Kafka | Client, Notification | PostgreSQL (soc_auth) | Redis | Publishes |
| **Client** | Auth, Kafka | Policy, Evidence, Reporting, Notification | PostgreSQL (soc_clients) | Redis | Publishes |
| **Policy** | Client, Kafka | Control, Reporting | PostgreSQL (soc_policies) | Redis | Publishes |
| **Control** | Policy, Kafka | Evidence, Reporting, AI | PostgreSQL (soc_controls) | Redis | Publishes |
| **Evidence** | Control, Client, Kafka, MongoDB | Reporting, AI | PostgreSQL (soc_evidence), MongoDB | Redis | Publishes |
| **Workflow** | Kafka | - | PostgreSQL (soc_workflows) | - | Pub/Sub |
| **Reporting** | Client, Policy, Control, Evidence, Elasticsearch | - | PostgreSQL (soc_reporting), Elasticsearch | - | Consumes |
| **Audit** | Kafka | - | PostgreSQL (soc_audits) | - | Consumes |
| **Integration** | Multiple (varies) | - | PostgreSQL (soc_integrations) | - | Publishes |
| **Notification** | Auth, Client, Kafka | - | PostgreSQL (soc_notifications) | Redis | Consumes |
| **AI** | Evidence, Control, MongoDB | - | PostgreSQL (soc_ai), MongoDB | - | Consumes |

## Dependency Types

### 1. HTTP Dependencies (Synchronous)
Direct service-to-service HTTP calls for data retrieval:

```
Client → Auth: User data
Policy → Client: Organization data
Control → Policy: Policy details
Evidence → Control: Control requirements
Evidence → Client: Organization context
Notification → Auth: User information
Notification → Client: Organization settings
AI → Evidence: Evidence analysis
AI → Control: Control recommendations
Reporting → Multiple: Report generation
```

### 2. Event Dependencies (Asynchronous)
Kafka-based event publishing and consumption:

```
Publishers:
- Auth: user.*, session.*, mfa.*
- Client: organization.*, client.*
- Policy: policy.*, compliance.*
- Control: control.*, framework.*
- Evidence: evidence.*, document.*
- Integration: integration.*

Consumers:
- Audit: ALL events (audit trail)
- Notification: Selected events for alerts
- Workflow: Process orchestration events
- AI: Learning from events
```

### 3. Database Dependencies
Each service has exclusive access to its database:

```
PostgreSQL Databases:
- soc_auth (Auth Service)
- soc_clients (Client Service)
- soc_policies (Policy Service)
- soc_controls (Control Service)
- soc_evidence (Evidence Service)
- soc_workflows (Workflow Service)
- soc_reporting (Reporting Service)
- soc_audits (Audit Service)
- soc_integrations (Integration Service)
- soc_notifications (Notification Service)
- soc_ai (AI Service)

MongoDB Collections:
- Evidence documents
- AI training data

Elasticsearch Indices:
- Reporting analytics
- Full-text search
```

### 4. Cache Dependencies
Redis usage patterns:

```
Session Management:
- Auth Service: User sessions, MFA tokens

Data Caching:
- Client Service: Organization data
- Policy Service: Policy templates
- Control Service: Framework data
- Evidence Service: Document metadata
- Notification Service: User preferences
```

## Critical Dependency Paths

### 1. User Authentication Flow
```
User → Kong → Auth → Redis (session)
                   ↓
              Kafka (event)
                   ↓
         Audit & Notification
```

### 2. Compliance Workflow
```
Organization Setup → Policy Creation → Control Mapping → Evidence Collection
    (Client)           (Policy)         (Control)         (Evidence)
        ↓                 ↓                 ↓                 ↓
    Kafka Events     Kafka Events     Kafka Events     Kafka Events
        ↓                 ↓                 ↓                 ↓
                     Audit Service (Complete Trail)
```

### 3. Reporting Pipeline
```
Reporting Service → Client (org data)
                 → Policy (policies)
                 → Control (controls)
                 → Evidence (documents)
                 → Elasticsearch (analytics)
```

## Service Start Order

Based on dependencies, services should start in this order:

### Phase 1: Infrastructure (Required First)
1. PostgreSQL
2. MongoDB
3. Redis
4. Kafka + Zookeeper
5. Elasticsearch
6. Kong

### Phase 2: Core Services
1. Auth Service (no service dependencies)
2. Client Service (depends on Auth)
3. Policy Service (depends on Client)
4. Control Service (depends on Policy)

### Phase 3: Dependent Services
1. Evidence Service (depends on Control, Client)
2. Workflow Service (event-driven)
3. Audit Service (event consumer)
4. Notification Service (depends on Auth, Client)

### Phase 4: Aggregate Services
1. Reporting Service (depends on multiple)
2. AI Service (depends on Evidence, Control)
3. Integration Service (varies by integration)

### Phase 5: Frontend
1. Next.js Frontend (depends on all APIs via Kong)

## Failure Impact Analysis

### High Impact Failures
Service failures that affect multiple downstream services:

| Failed Service | Impact | Affected Services |
|---------------|--------|-------------------|
| **PostgreSQL** | CRITICAL | All services fail |
| **Redis** | HIGH | Auth degraded, caching disabled |
| **Kafka** | HIGH | No events, audit trail broken |
| **Kong** | HIGH | No external API access |
| **Auth** | HIGH | No authentication, Client service degraded |
| **Client** | MEDIUM | Policy, Evidence, Reporting degraded |

### Resilience Patterns

#### Circuit Breakers (Planned)
```javascript
// Not yet implemented, but planned:
- HTTP calls with fallback
- Cached data retrieval
- Graceful degradation
```

#### Current Resilience
```javascript
// Retry with exponential backoff
// Timeout configurations
// Cache fallbacks
// Event replay capability
```

## Database Relationships

### Cross-Service References
While services don't directly access other databases, they maintain references:

```sql
-- Evidence Service references
evidence.organizationId -> client.organizations.id (via API)
evidence.controlId -> control.controls.id (via API)

-- Control Service references  
controls.policyId -> policy.policies.id (via API)
controls.frameworkId -> policy.frameworks.id (via API)

-- Notification references
notifications.userId -> auth.users.id (via API)
notifications.organizationId -> client.organizations.id (via API)
```

## Performance Considerations

### Bottlenecks
1. **Reporting Service**: Makes multiple HTTP calls
   - Solution: Implement data aggregation service
   - Cache frequently accessed data

2. **Notification Service**: High event volume
   - Solution: Batch processing
   - Priority queues

3. **Evidence Service**: Large file handling
   - Solution: MongoDB GridFS
   - CDN for static content

### Optimization Opportunities
1. **GraphQL Federation**: Reduce HTTP calls
2. **Event Sourcing**: Rebuild state from events
3. **CQRS**: Separate read/write models
4. **Service Mesh**: Better load balancing

## Monitoring Points

### Critical Metrics
```yaml
# Service Health
- Service uptime
- Response times
- Error rates
- Request volume

# Dependencies
- Database connection pools
- Redis memory usage
- Kafka lag
- HTTP client timeouts

# Business Metrics
- Authentication success rate
- Policy compliance score
- Evidence collection rate
- Report generation time
```

### Health Check Endpoints
All services expose `/health` with dependency status:

```json
{
  "status": "healthy",
  "timestamp": "2025-08-10T10:00:00Z",
  "service": "policy-service",
  "dependencies": {
    "database": "connected",
    "redis": "connected",
    "kafka": "connected",
    "client-service": "reachable"
  }
}
```

## Deployment Considerations

### Container Dependencies
```yaml
depends_on:
  postgres:
    condition: service_healthy
  redis:
    condition: service_started
  kafka:
    condition: service_healthy
```

### Environment Variables
```bash
# Service Discovery
AUTH_SERVICE_URL=http://auth-service:3001
CLIENT_SERVICE_URL=http://client-service:3002

# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/soc_service

# Cache
REDIS_URL=redis://redis:6379

# Events
KAFKA_BROKERS=kafka:29092
```

## Future Improvements

### Short Term
1. Implement circuit breakers
2. Add service mesh (Istio/Linkerd)
3. Centralized configuration (Consul)
4. Distributed tracing (Jaeger)

### Long Term
1. GraphQL Federation
2. Event sourcing
3. CQRS implementation
4. Microservices orchestration (Temporal)
5. Multi-region deployment

## Testing Dependencies

### Integration Test Order
Based on dependencies, integration tests should run in order:
1. Auth Service tests
2. Client Service tests (needs Auth)
3. Policy Service tests (needs Client)
4. Control Service tests (needs Policy)
5. Evidence Service tests (needs Control + Client)
6. Reporting Service tests (needs all)

### Mock Services
For isolated testing, provide mocks for:
- External HTTP services
- Kafka events
- Redis cache
- Database connections