# SOC Compliance Platform - Monitoring and Observability Guide

This guide provides comprehensive information about the monitoring and observability infrastructure for the SOC Compliance Platform.

**Last Updated**: August 4, 2025

## 🔐 NEW: Secrets Management Monitoring

The platform now includes comprehensive monitoring for the enterprise secrets management system with dedicated dashboards, metrics, and alerts.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [Secrets Management Monitoring](#secrets-management-monitoring) **NEW!**
5. [Service Instrumentation](#service-instrumentation)
6. [Metrics](#metrics)
7. [Logging](#logging)
8. [Distributed Tracing](#distributed-tracing)
9. [Dashboards](#dashboards)
10. [Alerting](#alerting)
11. [Troubleshooting](#troubleshooting)

## Overview

The SOC Compliance Platform implements comprehensive monitoring and observability using:

- **Metrics**: Prometheus + Grafana for metrics collection and visualization
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana) for centralized logging
- **Tracing**: Jaeger with OpenTelemetry for distributed tracing
- **APM**: Custom instrumentation for application performance monitoring
- **Alerting**: AlertManager for alert routing and notification

### Key Features

- Real-time service health monitoring
- Performance metrics and SLA tracking
- Compliance-specific metrics and dashboards
- Security event monitoring
- Automated alerting and incident response
- Full audit trail for compliance requirements

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Microservices                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │  Auth   │ │ Client  │ │ Policy  │ │Control  │ │   ...   │  │
│  │ Service │ │ Service │ │ Service │ │ Service │ │Services │  │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │
│       │           │           │           │           │         │
│       └───────────┴───────────┴───────────┴───────────┘         │
│                               │                                  │
│                     OpenTelemetry SDK                           │
└───────────────────────────────┬─────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │  OTLP Collector     │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
┌───────┴────────┐    ┌────────┴────────┐   ┌────────┴────────┐
│   Prometheus   │    │     Jaeger      │   │   Logstash     │
│                │    │                 │   │                │
└───────┬────────┘    └────────┬────────┘   └────────┬────────┘
        │                      │                      │
┌───────┴────────┐    ┌────────┴────────┐   ┌────────┴────────┐
│    Grafana     │    │  Jaeger UI     │   │ Elasticsearch  │
│                │    │                 │   │                │
└────────────────┘    └─────────────────┘   └────────┬────────┘
                                                      │
                                             ┌────────┴────────┐
                                             │     Kibana      │
                                             └─────────────────┘
```

## Components

### 1. Monitoring Stack

Start the monitoring stack:

```bash
# Start all monitoring services
npm run monitoring:start

# Or using Docker Compose directly
docker-compose -f docker-compose.monitoring.yml up -d

# Check status
npm run monitoring:status

# View logs
npm run monitoring:logs

# Stop monitoring
npm run monitoring:stop
```

### 2. Access URLs

| Component | URL | Credentials |
|-----------|-----|-------------|
| Grafana | http://localhost:3100 | admin / soc_grafana_admin |
| Prometheus | http://localhost:9090 | N/A |
| Kibana | http://localhost:5601 | N/A |
| Jaeger | http://localhost:16686 | N/A |
| AlertManager | http://localhost:9093 | N/A |

## Secrets Management Monitoring

### Overview
The secrets management system includes comprehensive monitoring with:
- **20+ custom Prometheus metrics** for all secret operations
- **3 dedicated Grafana dashboards** for different use cases
- **25+ intelligent alerts** for proactive monitoring
- **Health check endpoints** for Kubernetes readiness/liveness probes

### Metrics

#### Access Metrics
```
secrets_access_total - Total secret access attempts
secrets_access_duration_seconds - Secret access latency
secrets_cache_hits_total - Cache hit count
secrets_cache_misses_total - Cache miss count
```

#### Rotation Metrics
```
secrets_rotation_total - Total rotation attempts
secrets_rotation_success_total - Successful rotations
secrets_rotation_failure_total - Failed rotations
secrets_age_seconds - Current age of each secret
```

#### Provider Health
```
secrets_provider_health - Provider connectivity status (0/1)
secrets_provider_latency_seconds - Provider response time
secrets_circuit_breaker_state - Circuit breaker status
```

#### Security Metrics
```
secrets_violations_total - Security policy violations
secrets_unauthorized_access_total - Unauthorized access attempts
secrets_audit_events_total - Audit events by type
```

### Dashboards

#### 1. Secrets Operations Dashboard
**File**: `monitoring/grafana/dashboards/secrets-operations.json`

Key panels:
- Secret access rate and latency
- Top accessed secrets
- Cache performance
- Error rates and types
- Service breakdown

#### 2. Secrets Security Dashboard
**File**: `monitoring/grafana/dashboards/secrets-security.json`

Key panels:
- Security violations timeline
- Unauthorized access attempts
- Audit event stream
- Anomaly detection
- Compliance metrics

#### 3. Provider Health Dashboard
**File**: `monitoring/grafana/dashboards/secrets-providers.json`

Key panels:
- Provider availability
- Circuit breaker status
- Latency by provider
- Rotation success rate
- Provider-specific metrics

### Alerts

Critical alerts configured in `monitoring/prometheus/alerts/secrets-alerts.yml`:

#### Critical Alerts
```yaml
- SecretRotationFailure: Rotation failed for > 5 minutes
- SecretProviderDown: Provider unreachable for > 2 minutes
- SecretExpired: Secret age > rotation policy
- SecurityViolation: Unauthorized access detected
```

#### Warning Alerts
```yaml
- HighSecretAccessRate: > 1000 req/min
- CacheMissRateHigh: Cache miss rate > 50%
- CircuitBreakerOpen: Circuit breaker tripped
- SecretNearExpiry: Secret expires in < 5 days
```

### Health Checks

```bash
# Check secrets service health
curl http://localhost:3001/health/secrets

# Response:
{
  "status": "up",
  "details": {
    "providers": {
      "aws": { "status": "up", "latency": 45 },
      "vault": { "status": "up", "latency": 12 },
      "local": { "status": "up", "latency": 1 }
    },
    "cache": {
      "status": "up",
      "hitRate": 0.92,
      "size": 47
    },
    "rotation": {
      "nextRotation": "2025-08-29T00:00:00Z",
      "overdue": []
    }
  }
}
```

### Integration Example

```typescript
// Automatic metrics collection in services
@Injectable()
export class PaymentService {
  constructor(
    @InjectSecret('stripe.api_key') private stripeKey: string,
    private secretsMonitoring: SecretsMonitoringService
  ) {}

  async processPayment(amount: number) {
    // Secret access is automatically monitored
    const stripe = new Stripe(this.stripeKey);
    
    // Custom security event
    this.secretsMonitoring.recordSecurityEvent({
      event: 'payment_processed',
      secretsUsed: ['stripe.api_key'],
      metadata: { amount }
    });
  }
}
```

## Service Instrumentation

### Current Status (August 5, 2025)

| Service | Monitoring Package | Instrumentation | Decorators | Status |
|---------|-------------------|----------------|------------|---------|
| Auth | ✅ Available | ✅ **Complete** | 4 decorators | ✅ **Production Ready** |
| Client | ✅ Available | ✅ **Complete** | 9 decorators | ✅ **Production Ready** |
| Policy | ✅ Available | 🔄 Next Phase | - | Ready for Integration |
| Control | ✅ Available | 🔄 Next Phase | - | Ready for Integration |
| Evidence | ✅ Available | 🔄 Next Phase | - | Ready for Integration |
| Workflow | ✅ Available | 🔄 Next Phase | - | Ready for Integration |
| Reporting | ✅ Available | ⏳ Remaining | - | Ready for Integration |
| Audit | ✅ Available | ⏳ Remaining | - | Ready for Integration |
| Integration | ✅ Available | ⏳ Remaining | - | Ready for Integration |
| Notification | ✅ Available | ⏳ Remaining | - | Ready for Integration |
| AI | ✅ Available | ⏳ Remaining | - | Ready for Integration |

**✅ Implementation Complete**: Auth and Client services now have comprehensive monitoring with enterprise-grade observability decorators.

**🚀 Ready for Rollout**: Established patterns make integration of remaining 9 services straightforward using the same decorator and dependency injection approach.

### Implemented Examples

#### Auth Service Implementation
```typescript
import { Observable, Traced, Metered, MetricsService, TracingService, LoggingService } from '@soc-compliance/monitoring';

@Injectable()
export class AuthService {
  constructor(
    // ... other dependencies
    private readonly metricsService: MetricsService,
    private readonly tracingService: TracingService,
    private readonly loggingService: LoggingService,
  ) {}

  @Observable({ spanName: 'user-registration', metricName: 'auth_registration_duration_seconds' })
  async register(registerDto: RegisterDto) {
    // Complete observability: tracing, metrics, and logging
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }
    // ... rest of implementation
  }

  @Observable({ spanName: 'user-login', metricName: 'auth_login_duration_seconds' })
  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    // Business-critical login flow with full observability
    // ... authentication logic with anomaly detection
  }

  @Traced('user-logout')
  async logout(userId: string, sessionId?: string) {
    // Distributed tracing for session termination
    await this.refreshTokenService.revokeRefreshToken(userId);
    // ... cleanup logic
  }

  @Metered('auth_token_refresh_duration_seconds')
  async refreshAccessToken(refreshToken: string, ipAddress?: string, userAgent?: string) {
    // Performance metrics for critical token operations
    const tokenData = await this.refreshTokenService.validateRefreshToken(refreshToken);
    // ... token refresh logic
  }
}
```

#### Client Service Implementation
```typescript
import { Observable, Traced, Metered, MetricsService, TracingService, LoggingService } from '@soc-compliance/monitoring';

@Injectable()
export class ClientsService {
  constructor(
    // ... TypeORM repositories and other dependencies
    private readonly metricsService: MetricsService,
    private readonly tracingService: TracingService,
    private readonly loggingService: LoggingService,
  ) {}

  @Observable({ spanName: 'client-creation', metricName: 'client_creation_duration_seconds' })
  async create(createClientDto: CreateClientDto, userId: string): Promise<Client> {
    // Business-critical client creation with full observability
    const existingClient = await this.clientRepository.findOne({
      where: { name: createClientDto.name, isDeleted: false },
    });
    // ... creation logic with validation and events
  }

  @Observable({ spanName: 'client-update', metricName: 'client_update_duration_seconds' })
  async update(id: string, updateClientDto: UpdateClientDto, userId: string): Promise<Client> {
    // Track all client updates for compliance auditing
    const client = await this.findOne(id);
    // ... update logic with change tracking
  }

  @Observable({ spanName: 'compliance-status-update', metricName: 'compliance_status_update_duration_seconds' })
  async updateComplianceStatus(id: string, status: ComplianceStatus, userId: string, notes?: string): Promise<Client> {
    // Critical compliance operations with business metrics
    const client = await this.findOne(id);
    // ... compliance status change logic
  }

  @Traced('client-list-query')
  async findAll(query: QueryClientDto): Promise<{ data: Client[]; meta: any }> {
    // Query performance tracking with Redis caching
    const cachedResult = await this.redisService.getCachedClientList(organizationId, query);
    // ... query logic
  }

  @Metered('compliance_metrics_fetch_duration_seconds')
  async getComplianceMetrics(id: string): Promise<ComplianceMetrics> {
    // Performance tracking for business intelligence operations
    const client = await this.findOne(id);
    // ... metrics calculation
  }
}
```

### Testing Pattern for Monitored Services

To avoid OpenTelemetry conflicts in Jest tests, use module mocking:

```typescript
// jest.config.unit.js
moduleNameMapper: {
  '^@soc-compliance/monitoring$': '<rootDir>/src/__mocks__/@soc-compliance/monitoring.js',
}

// src/__mocks__/@soc-compliance/monitoring.js
const mockMetricsService = {
  recordHttpRequest: jest.fn(),
  registerCounter: jest.fn().mockReturnValue({ inc: jest.fn() }),
  registerHistogram: jest.fn().mockReturnValue({ observe: jest.fn() }),
  config: { serviceName: 'test-service' },
};

const Observable = (options = {}) => (target, propertyKey, descriptor) => descriptor;
const Traced = (spanName) => (target, propertyKey, descriptor) => descriptor;
const Metered = (metricName) => (target, propertyKey, descriptor) => descriptor;

module.exports = {
  MetricsService: jest.fn().mockImplementation(() => mockMetricsService),
  TracingService: jest.fn().mockImplementation(() => mockTracingService),  
  LoggingService: jest.fn().mockImplementation(() => mockLoggingService),
  Observable, Traced, Metered,
};

// Unit test with manual instantiation (TypeORM compatibility)
describe('ClientsService', () => {
  let service: ClientsService;
  
  beforeEach(() => {
    const mockRepository = { find: jest.fn(), save: jest.fn() };
    service = new ClientsService(
      mockRepository,
      // ... other mocks
      mockMetricsService,
      mockTracingService,
      mockLoggingService,
    );
  });
  
  it('should have monitoring services injected', () => {
    expect(service['metricsService']).toBeDefined();
    expect(service['tracingService']).toBeDefined();
    expect(service['loggingService']).toBeDefined();
  });
});
```

### 1. Add Monitoring Package

Each service must include the monitoring package:

```typescript
// package.json
{
  "dependencies": {
    "@soc-compliance/monitoring": "^1.0.0"
  }
}
```

### 2. Configure Monitoring Module

```typescript
// src/app.module.ts
import { MonitoringModule } from '@soc-compliance/monitoring';

@Module({
  imports: [
    MonitoringModule.forRoot({
      metrics: {
        serviceName: 'auth-service',
        port: 3001,
        path: '/metrics',
        defaultLabels: {
          environment: process.env.NODE_ENV,
          version: process.env.SERVICE_VERSION || '1.0.0',
        },
      },
      tracing: {
        serviceName: 'auth-service',
        endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
        samplingRatio: 1.0, // Sample all traces in development
      },
      logging: {
        serviceName: 'auth-service',
        level: process.env.LOG_LEVEL || 'info',
        elasticsearch: {
          node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
          index: 'soc-logs',
        },
      },
    }),
    // ... other modules
  ],
})
export class AppModule {}
```

### 3. Use Monitoring Decorators

```typescript
import { Observable, Traced, Metered, Logged } from '@soc-compliance/monitoring';

@Injectable()
export class AuthService {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly loggingService: LoggingService,
    private readonly tracingService: TracingService,
  ) {}

  @Observable() // Combines tracing, metrics, and logging
  async login(credentials: LoginDto): Promise<AuthResponse> {
    // Method is automatically traced, metered, and logged
    return this.authenticate(credentials);
  }

  @Traced('auth.verify_mfa')
  async verifyMFA(userId: string, code: string): Promise<boolean> {
    // Custom span name for tracing
    const span = this.tracingService.getCurrentSpan();
    span?.setAttribute('user.id', userId);
    
    const result = await this.mfaService.verify(userId, code);
    
    // Record business metric
    const metric = this.metricsService.getMetric('mfa_verifications_total');
    metric?.inc({ method: 'totp', result: result ? 'success' : 'failure' });
    
    return result;
  }

  @Metered('auth_token_generation_duration')
  async generateToken(user: User): Promise<string> {
    // Custom metric name
    return this.jwtService.sign(user);
  }
}
```

## Metrics

### 1. Default Metrics

All services automatically export:

- **HTTP Metrics**
  - `http_requests_total`: Total HTTP requests
  - `http_request_duration_seconds`: Request duration histogram
  - `http_requests_in_flight`: Currently processing requests

- **System Metrics**
  - `process_cpu_usage`: CPU usage
  - `process_memory_usage_bytes`: Memory usage
  - `nodejs_gc_duration_seconds`: Garbage collection duration

### 2. Business Metrics

SOC compliance specific metrics:

```typescript
// Compliance metrics
compliance_checks_total{framework, control_id, result}
compliance_score{framework, organization_id}
compliance_check_duration_seconds{framework, control_id}

// Audit metrics
audit_events_total{event_type, user_id, organization_id}
audit_log_size_bytes{organization_id}

// Security metrics
auth_attempts_total{method, result}
unauthorized_access_attempts_total{resource, user_id}
mfa_verifications_total{method, result}

// Evidence metrics
evidence_uploads_total{type, organization_id}
evidence_storage_bytes{organization_id}

// Workflow metrics
active_workflows{workflow_type, organization_id}
workflow_completion_time_seconds{workflow_type}
```

### 3. Custom Metrics

Register custom metrics:

```typescript
// Register a custom counter
const customCounter = this.metricsService.registerCounter(
  'custom_events_total',
  'Total custom events',
  ['event_type', 'status']
);

// Use the counter
customCounter.inc({ 
  event_type: 'user_action', 
  status: 'success',
  service: 'auth-service' 
});

// Register a custom histogram
const customHistogram = this.metricsService.registerHistogram(
  'custom_operation_duration_seconds',
  'Duration of custom operations',
  ['operation_type'],
  [0.1, 0.5, 1, 5, 10] // buckets
);

// Record a duration
const timer = customHistogram.startTimer({ operation_type: 'data_processing' });
// ... do work ...
timer();
```

## Logging

### 1. Structured Logging

All logs follow a structured format:

```json
{
  "timestamp": "2024-01-30T10:15:30.123Z",
  "level": "info",
  "service": "auth-service",
  "message": "User login successful",
  "correlationId": "abc-123-def",
  "trace": {
    "traceId": "1234567890abcdef",
    "spanId": "abcdef1234567890"
  },
  "user": {
    "id": "user-123",
    "organizationId": "org-456"
  },
  "http": {
    "method": "POST",
    "path": "/auth/login",
    "statusCode": 200,
    "duration": 145
  }
}
```

### 2. Log Levels

Use appropriate log levels:

```typescript
// Debug - Detailed information for debugging
this.loggingService.debug('Processing authentication request', context);

// Info - General informational messages
this.loggingService.log('User logged in successfully', context);

// Warn - Warning messages
this.loggingService.warn('Rate limit approaching', context);

// Error - Error messages with stack traces
this.loggingService.error('Authentication failed', error.stack, context);
```

### 3. Specialized Logging

```typescript
// Security events
this.loggingService.logSecurityEvent('unauthorized_access', {
  resource: '/admin/users',
  ip: request.ip,
  userAgent: request.headers['user-agent'],
});

// Compliance events
this.loggingService.logComplianceEvent(
  'SOC2',
  'CC6.1',
  'passed',
  { evidenceId: 'ev-123', score: 95 }
);

// Audit events
this.loggingService.logAuditEvent(
  'user.create',
  '/users/123',
  userId,
  'success',
  { email: 'user@example.com' }
);
```

## Distributed Tracing

### 1. Trace Context Propagation

Traces are automatically propagated across service boundaries:

```typescript
// Trace context is automatically added to Kafka events
await this.eventBus.emit('user.created', {
  userId: user.id,
  // Trace context included automatically
});

// HTTP calls include trace headers
const response = await this.httpService.get('/api/users', {
  headers: {
    // W3C Trace Context headers added automatically
  }
});
```

### 2. Custom Spans

Create custom spans for important operations:

```typescript
async processComplexOperation(data: any): Promise<Result> {
  return this.tracingService.withSpan(
    'process_complex_operation',
    async (span) => {
      span.setAttribute('data.size', data.length);
      
      // Step 1: Validation
      const validationSpan = this.tracingService.createSpan('validate_data');
      const isValid = await this.validate(data);
      validationSpan.setAttribute('validation.result', isValid);
      validationSpan.end();
      
      if (!isValid) {
        span.setStatus(SpanStatusCode.ERROR, 'Validation failed');
        throw new ValidationError('Invalid data');
      }
      
      // Step 2: Processing
      const result = await this.process(data);
      span.setAttribute('result.size', result.length);
      
      return result;
    }
  );
}
```

## Dashboards

### 1. Service Overview Dashboard

Access at: http://localhost:3100/d/soc-service-overview

Shows:
- Service health status
- Request rates and error rates
- Response time percentiles
- Active alerts

### 2. Creating Custom Dashboards

1. Access Grafana at http://localhost:3100
2. Create new dashboard
3. Add panels with queries:

```promql
# Request rate by service
sum(rate(http_requests_total[5m])) by (job)

# Error rate percentage
rate(http_requests_total{status=~"5.."}[5m]) 
/ rate(http_requests_total[5m]) * 100

# P95 response time
histogram_quantile(0.95, 
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, job)
)

# Compliance score by organization
compliance_score{framework="SOC2"}
```

### 3. Kibana Dashboards

Access at: http://localhost:5601

Create visualizations for:
- Log volume by service
- Error logs analysis
- Security events timeline
- Audit trail visualization

## Alerting

### 1. Alert Configuration

Alerts are defined in `monitoring/prometheus/alerts.yml`:

```yaml
- alert: ServiceDown
  expr: up == 0
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Service {{ $labels.job }} is down"
```

### 2. Alert Routing

Configure alert routing in `monitoring/alertmanager/config.yml`:

```yaml
route:
  group_by: ['alertname', 'cluster', 'service']
  routes:
    - match:
        severity: critical
      receiver: pagerduty
    - match:
        severity: warning
      receiver: slack
```

### 3. Custom Alerts

Add service-specific alerts:

```yaml
# High authentication failure rate
- alert: HighAuthFailureRate
  expr: rate(auth_failures_total[5m]) > 10
  for: 2m
  labels:
    severity: warning
    service: auth
  annotations:
    summary: "High authentication failure rate"
    description: "More than 10 auth failures per second"

# Compliance check failure
- alert: ComplianceCheckFailed
  expr: compliance_checks_total{result="failed"} > 0
  for: 1m
  labels:
    severity: critical
    compliance: true
  annotations:
    summary: "Compliance check failed"
    description: "Framework {{ $labels.framework }} check failed"
```

## Troubleshooting

### 1. Missing Metrics

If metrics are not appearing:

```bash
# Check if service is exposing metrics
curl http://localhost:3001/metrics

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check service logs
docker-compose logs auth-service | grep metrics
```

### 2. No Traces

If traces are not appearing:

```bash
# Check OTLP collector status
curl http://localhost:13133/

# Check Jaeger
curl http://localhost:16686/api/traces?service=auth-service

# Enable debug logging
export OTEL_LOG_LEVEL=debug
```

### 3. Log Ingestion Issues

If logs are not appearing in Kibana:

```bash
# Check Elasticsearch health
curl http://localhost:9200/_cluster/health

# Check Logstash pipeline
curl http://localhost:9600/_node/stats/pipelines

# Check index patterns
curl http://localhost:9200/_cat/indices?v
```

### 4. Performance Impact

Monitor the overhead of observability:

```promql
# CPU usage by monitoring components
rate(container_cpu_usage_seconds_total{name=~"soc-(prometheus|grafana|elasticsearch|jaeger).*"}[5m])

# Memory usage
container_memory_usage_bytes{name=~"soc-(prometheus|grafana|elasticsearch|jaeger).*"}
```

## Best Practices

### 1. Metric Naming

Follow Prometheus naming conventions:
- Use lowercase with underscores
- End counters with `_total`
- End histograms with `_seconds` or `_bytes`
- Include unit in the name

### 2. Label Cardinality

Avoid high cardinality labels:
- ❌ `user_id` (millions of values)
- ✅ `user_type` (limited values)
- ❌ `session_id` (unique per session)
- ✅ `organization_id` (limited tenants)

### 3. Logging Guidelines

- Use correlation IDs for request tracking
- Include structured context in all logs
- Avoid logging sensitive data (passwords, tokens)
- Use appropriate log levels

### 4. Tracing Best Practices

- Create spans for significant operations
- Add relevant attributes to spans
- Use semantic conventions for attribute names
- Set appropriate span status on errors

### 5. Dashboard Design

- Group related metrics
- Use meaningful panel titles
- Include description and units
- Set appropriate refresh intervals
- Use variables for filtering

## Maintenance

### 1. Data Retention

Configure retention policies:

```yaml
# Prometheus (30 days)
--storage.tsdb.retention.time=30d

# Elasticsearch (90 days for logs)
PUT _ilm/policy/soc-logs-policy
{
  "policy": {
    "phases": {
      "delete": {
        "min_age": "90d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}

# Jaeger (7 days)
SPAN_STORAGE_TYPE=elasticsearch
ES_TAGS_AS_FIELDS_ALL=true
ES_ARCHIVE_ENABLED=true
```

### 2. Backup

Regular backups of:
- Grafana dashboards and settings
- Prometheus rules and configuration
- Kibana saved objects
- AlertManager configuration

### 3. Updates

Keep monitoring stack updated:

```bash
# Pull latest images
docker-compose -f docker-compose.monitoring.yml pull

# Restart with new images
docker-compose -f docker-compose.monitoring.yml up -d
```

## Integration with CI/CD

### 1. Performance Testing

Include performance benchmarks in CI:

```yaml
- name: Run Performance Tests
  run: |
    npm run test:performance
    # Export metrics to Prometheus Pushgateway
    curl -X POST http://pushgateway:9091/metrics/job/ci-performance

- name: Check Performance Regression
  run: |
    # Query Prometheus for performance metrics
    ./scripts/check-performance-regression.sh
```

### 2. Synthetic Monitoring

Deploy synthetic monitoring checks:

```typescript
// Synthetic check for auth service
@Injectable()
export class SyntheticMonitor {
  @Cron('*/5 * * * *') // Every 5 minutes
  async checkAuthService() {
    const start = Date.now();
    try {
      const result = await this.http.post('/auth/health');
      const duration = Date.now() - start;
      
      this.metrics.recordSyntheticCheck('auth_health', true, duration);
    } catch (error) {
      this.metrics.recordSyntheticCheck('auth_health', false, 0);
      this.logger.error('Synthetic check failed', error);
    }
  }
}
```

## Security Considerations

### 1. Access Control

Secure monitoring endpoints:

```typescript
// Protect metrics endpoint
@Controller()
@UseGuards(MetricsAuthGuard)
export class MetricsController {
  @Get('/metrics')
  async getMetrics() {
    // Only accessible with valid metrics token
  }
}
```

### 2. Data Sensitivity

- Mask sensitive data in logs
- Exclude sensitive attributes from traces
- Use sampling for high-volume endpoints
- Encrypt data in transit

### 3. Compliance

Ensure monitoring meets compliance requirements:
- Audit log retention (7 years for SOC 2)
- Access logs for all monitoring tools
- Regular security assessments
- Data residency requirements

## Recent Updates (July 31, 2025)

### Infrastructure Deployment
- ✅ Monitoring stack configured with Docker Compose
- ✅ Prometheus, Grafana, ELK Stack, and Jaeger ready
- ✅ NPM scripts added for easy management
- ✅ Default dashboards and alerts configured

### Package Creation
- ✅ Monitoring package created at `packages/monitoring`
- ✅ Includes metrics, logging, and tracing modules
- ✅ Decorators for easy instrumentation
- ✅ OpenTelemetry SDK integration

### Next Steps
1. **Service Integration**: Add monitoring package to each service's dependencies
2. **Configure Instrumentation**: Update app.module.ts in each service
3. **Deploy Dashboards**: Import pre-built Grafana dashboards
4. **Set Up Alerts**: Configure service-specific alerts
5. **Test End-to-End**: Verify metrics, logs, and traces flow correctly

### Quick Integration Guide

For each service, run:
```bash
# Add monitoring dependency
cd services/[service-name]
npm install @soc-compliance/monitoring

# Update app.module.ts with monitoring configuration
# Add decorators to key methods
# Restart service to apply changes
```

## Detailed Service Integration Guide

### Step 1: Add Dependency
```json
{
  "dependencies": {
    "@soc-compliance/monitoring": "^1.0.0"
  }
}
```

### Step 2: Import in app.module.ts
```typescript
import { Module } from '@nestjs/common';
import { MonitoringModule } from '@soc-compliance/monitoring';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MonitoringModule.forRoot({
      serviceName: 'auth-service',
      metrics: { 
        enabled: true,
        port: 9090,  // Prometheus metrics port
        defaultLabels: { service: 'auth' }
      },
      tracing: { 
        enabled: true,
        jaegerUrl: process.env.JAEGER_URL || 'http://localhost:14268/api/traces'
      },
      logging: { 
        enabled: true,
        level: process.env.LOG_LEVEL || 'info'
      }
    }),
    // ... other imports
  ]
})
export class AppModule {}
```

### Step 3: Add Monitoring Endpoints to main.ts
```typescript
import { NestFactory } from '@nestjs/core';
import { MonitoringService } from '@soc-compliance/monitoring';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Get monitoring service
  const monitoringService = app.get(MonitoringService);
  
  // Start metrics server
  await monitoringService.startMetricsServer();
  
  // Add graceful shutdown
  process.on('SIGTERM', async () => {
    await monitoringService.close();
    await app.close();
  });
  
  await app.listen(3001);
}
```

### Step 4: Add Environment Variables
```env
# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9090
TRACING_ENABLED=true
JAEGER_URL=http://localhost:14268/api/traces
LOG_LEVEL=info
```

### Step 5: Instrument Your Code
```typescript
import { Injectable } from '@nestjs/common';
import { MetricsService, TracingService } from '@soc-compliance/monitoring';

@Injectable()
export class YourService {
  constructor(
    private metrics: MetricsService,
    private tracing: TracingService
  ) {}

  async performOperation() {
    // Start timer for metrics
    const timer = this.metrics.startTimer('operation_duration', {
      operation: 'create_user'
    });

    // Start span for tracing
    const span = this.tracing.startSpan('createUser');

    try {
      // Your business logic here
      const result = await this.doWork();
      
      // Record success metric
      this.metrics.increment('operation_success', { operation: 'create_user' });
      
      return result;
    } catch (error) {
      // Record failure metric
      this.metrics.increment('operation_failure', { operation: 'create_user' });
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      timer.end();
      span.end();
    }
  }
}
```

---

**Document Status**: Complete monitoring infrastructure ready for service integration